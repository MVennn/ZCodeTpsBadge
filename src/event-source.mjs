// Main-world service-port tap. Serialized with toString() and injected into the
// main world via webFrame.executeJavaScript.
//
// Two jobs:
//   1. Ask the host for the same snapshot the Developer Tools panel shows
//      (`zcode-agent.readSessionDebug`) once per second. Each completed
//      main-turn request carries provider usage (input / output / reasoning /
//      cache tokens) and `tokensPerSecond`, computed exactly as the panel does:
//      outputTokens ÷ (durationMs − timeToFirstContentMs). No character
//      counting, so folded reasoning still contributes its real tokens.
//   2. Watch conversation EventFire frames only to report "activity", so the
//      badge can tell whether a request is currently generating. No counts are
//      derived from row text anymore.
//
// Wire format (verified against desktop@2.x bundles):
//   message = one VSBuffer per port message, holding two marshalled values:
//     [1] array [msgType, requestId, ...]   (Promise = 100, EventFire = 204,
//         PromiseSuccess = 201, PromiseError = 202, PromiseErrorObj = 203)
//     [2] the event / request / response payload value
//   marshalled value = 1 type byte:
//     0 Undefined | 1 String | 2 Buffer | 3 VSBuffer | 4 Array | 5 Object | 6 Int
//   String/Buffer/VSBuffer/Object are prefixed by a LEB128 varint length;
//   Object payload is JSON (Uint8Array → {__zcode_rpc_nested_uint8array_v1,base64});
//   Array is [varint count][values]; Int is a bare varint.
//
//   Request we send on the base service port:
//     [100, id, "zcode-agent", "readSessionDebug"] + [[{workspacePath,
//       workspaceIdentity?, sessionId}]]
//   The host answers [201, id] + {sessionId, rounds, networkEntries, cache}.
//   Only the last round and the session cache totals are forwarded to the
//   isolated badge; network headers and request messages never leave the tap.
//
// Conversation frames (payload values): {topic:"conversation/<id>",
//   payload:{kind:"snapshot"|"deltas", deltas:[…]}}. Any delta means the task
//   is active; the tap reports activity (throttled) and nothing else.
//
// The tap never mutates app state. Requests are read-only, one in flight at a
// time, and failures are swallowed after reporting a short error to the badge.

export function eventSource() {
  // The update/startup window uses the same preload but not the chat service
  // handshake; touching its ports is what hung the splash page once.
  try {
    if (new URLSearchParams(location.search).get('windowKind') === 'update-status') return;
  } catch {}
  if (window.__zcodeTpsEventTap) return;
  window.__zcodeTpsEventTap = true;

  var POST = 'zcode-tps-debug';
  var SERVICE_PORT = 'zcode:service-port';
  var SCOPED_PORT = 'zcode:scoped-service-port';
  var CHANNEL = 'zcode-agent';
  var METHOD = 'readSessionDebug';
  var POLL_MS = 1000;

  // Structured objects do not reliably cross contextIsolation; send a JSON
  // string and let the badge parse it (CODE-RULES §2.9).
  function send(msg) {
    try { window.postMessage(JSON.stringify(msg), '*'); } catch {}
  }

  // --- varint + marshalled value reader ---------------------------------
  function makeReader(u8) {
    return {
      pos: 0,
      read(n) {
        if (this.pos + n > u8.length) throw new RangeError('eof');
        const s = u8.subarray(this.pos, this.pos + n);
        this.pos += n;
        return s;
      }
    };
  }

  function readVarint(r) {
    let v = 0, shift = 0;
    for (;;) {
      const b = r.read(1)[0];
      v |= (b & 127) << shift;
      if (!(b & 128)) return v;
      shift += 7;
      if (shift > 35) throw new RangeError('varint');
    }
  }

  function decodeValue(r, depth) {
    if (depth > 24) throw new RangeError('depth');
    const type = r.read(1)[0];
    switch (type) {
      case 0: return undefined;
      case 1: {
        const n = readVarint(r);
        return new TextDecoder().decode(r.read(n));
      }
      case 2: case 3: {
        const n = readVarint(r);
        r.read(n);
        return null;
      }
      case 4: {
        const count = readVarint(r);
        const out = [];
        for (let i = 0; i < count; i++) out.push(decodeValue(r, depth + 1));
        return out;
      }
      case 5: {
        const n = readVarint(r);
        try { return JSON.parse(new TextDecoder().decode(r.read(n))); } catch { return null; }
      }
      case 6: return readVarint(r);
      default: throw new RangeError('type ' + type);
    }
  }

  // One port message → {head, data} or null.
  function decodeRpc(u8) {
    try {
      const r = makeReader(u8);
      const head = decodeValue(r, 0);
      // Initialize is a one-element head: [200] + undefined.
      if (!Array.isArray(head) || head.length < 1) return null;
      const data = decodeValue(r, 0);
      return { head, data };
    } catch {
      return null;
    }
  }

  // --- marshalled value writer (request side) ---------------------------
  function writeVarint(out, value) {
    value = value >>> 0;
    while (value >= 0x80) {
      out.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    out.push(value & 0x7f);
  }

  function writeBytes(out, bytes) {
    writeVarint(out, bytes.length);
    for (let i = 0; i < bytes.length; i++) out.push(bytes[i]);
  }

  function encodeValue(out, value) {
    if (value === undefined) {
      out.push(0);
      return;
    }
    if (typeof value === 'string') {
      out.push(1);
      writeBytes(out, new TextEncoder().encode(value));
      return;
    }
    if (Array.isArray(value)) {
      out.push(4);
      writeVarint(out, value.length);
      for (let i = 0; i < value.length; i++) encodeValue(out, value[i]);
      return;
    }
    if (typeof value === 'number' && (value | 0) === value) {
      out.push(6);
      writeVarint(out, value);
      return;
    }
    out.push(5);
    writeBytes(out, new TextEncoder().encode(JSON.stringify(value)));
  }

  function encodeFrame(head, data) {
    const out = [];
    encodeValue(out, head);
    encodeValue(out, data);
    return new Uint8Array(out);
  }

  // Cheap ASCII substring check before paying for a full decode.
  function hasAscii(u8, text) {
    const pat = new TextEncoder().encode(text);
    outer: for (let i = 0; i <= u8.length - pat.length; i++) {
      for (let j = 0; j < pat.length; j++) {
        if (u8[i + j] !== pat[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  }

  // --- workspace / session discovery -----------------------------------
  // The window URL carries the workspace Path for local windows. Requests the
  // app sends over the same port also carry it; keep the last one as a fallback
  // (remote windows / in-place workspace switches).
  let sniffedPath = '';
  let sniffedIdentity = '';
  let selfPost = false;
  // sessionId -> { path, identity } from the scoped service-port message. That
  // message carries the exact workspace the app uses for the session, which is
  // more reliable than the window URL for remote / switched workspaces.
  // A Map (not a plain object) so the oldest sessions can be evicted.
  const scopedInfo = new Map();
  const SCOPED_MAX = 32;

  // Only scan plausible RPC frames: tiny heartbeats cannot carry a workspace
  // path, and huge payloads (file chunks, clipboard, session snapshots) would
  // pay an O(n*m) scan for nothing.
  const SNIFF_MIN_BYTES = 64;
  const SNIFF_MAX_BYTES = 512 * 1024;

  function sniffOutgoing(u8) {
    if (u8.length < SNIFF_MIN_BYTES || u8.length > SNIFF_MAX_BYTES) return;
    if (!hasAscii(u8, 'workspacePath')) return;
    const msg = decodeRpc(u8);
    if (!msg || msg.head[0] !== 100) return;
    const args = msg.data;
    const arg = Array.isArray(args) && args[0] && typeof args[0] === 'object' ? args[0] : null;
    if (!arg) return;
    if (typeof arg.workspacePath === 'string' && arg.workspacePath) sniffedPath = arg.workspacePath;
    if (typeof arg.workspaceIdentity === 'string' && arg.workspaceIdentity) sniffedIdentity = arg.workspaceIdentity;
  }

  function workspacePath(sessionId) {
    const scoped = scopedInfo.get(sessionId);
    if (scoped && scoped.path) return scoped.path;
    const fromUrl = new URLSearchParams(location.search).get('initialWorkspacePath');
    return fromUrl || sniffedPath || '';
  }

  function workspaceIdentity(sessionId) {
    const scoped = scopedInfo.get(sessionId);
    if (scoped && scoped.identity) return scoped.identity;
    return sniffedIdentity || '';
  }

  function visibleSessionId() {
    const nodes = document.querySelectorAll('[data-session-id]');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const id = el.getAttribute('data-session-id');
      if (!id || id === 'draft') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return id;
    }
    // Fallback: the last conversation topic seen by the tap. Background
    // sessions can overwrite it, so the visible DOM attribute wins.
    return typeof window.__zcodeTpsSessionId === 'string' ? window.__zcodeTpsSessionId : '';
  }

  // --- debug polling ----------------------------------------------------
  let servicePort = null;
  let portReady = false;
  let pendingId = 0;
  let pendingAt = 0;
  let nextPollAt = 0;
  let seq = 1000000000;
  let lastError = '';

  function reportError(message) {
    nextPollAt = performance.now() + 5000;
    if (lastError === message) return;
    lastError = message;
    try { console.warn('[zcode-tps] readSessionDebug failed:', message); } catch {}
    send({ src: POST, kind: 'error', message: message });
  }

  // The panel computes TPS as outputTokens ÷ (durationMs − timeToFirstContentMs).
  // A cached/compaction request can report a near-zero generation window
  // (e.g. 388 tok / 6 ms = 64,666.7 tok/s), which is a timing artifact rather
  // than a real speed. Keep those rounds out of the session stats and tell the
  // badge not to display them as the current round.
  const MAX_PLAUSIBLE_TPS = 2000;
  const MIN_GENERATION_MS = 100;

  function isPlausibleRound(round) {
    if (!round || typeof round.tokensPerSecond !== 'number' || !isFinite(round.tokensPerSecond)) return false;
    if (round.tokensPerSecond <= 0 || round.tokensPerSecond > MAX_PLAUSIBLE_TPS) return false;
    const ms = round.generationDurationMs;
    if (typeof ms !== 'number' || !isFinite(ms) || ms < MIN_GENERATION_MS) return false;
    return true;
  }

  function forwardSnapshot(data, fallbackSessionId) {
    if (!data || !Array.isArray(data.rounds)) return;
    const rounds = data.rounds;
    const last = rounds.length > 0 ? rounds[rounds.length - 1] : null;

    // Per-round TPS stats over the snapshot's rounds (the agent caps this at
    // 200, same as the Developer Tools table). Rounds without a usable TPS
    // are skipped; 0 is not a speed and would poison "lowest".
    let count = 0;
    let sum = 0;
    let max = 0;
    let min = 0;
    for (const round of rounds) {
      if (!isPlausibleRound(round)) continue;
      const tps = round.tokensPerSecond;
      count++;
      sum += tps;
      if (tps > max) max = tps;
      if (min === 0 || tps < min) min = tps;
    }
    const stats = count > 0
      ? { count: count, avg: sum / count, max: max, min: min }
      : null;

    send({
      src: POST,
      kind: 'snapshot',
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : fallbackSessionId,
      count: rounds.length,
      round: last,
      plausible: isPlausibleRound(last),
      cache: data.cache || null,
      stats: stats
    });
  }

  function onPortMessage(event) {
    const u8 = asBytes(event.data);
    if (!u8) return;
    const msg = decodeRpc(u8);
    if (!msg) return;
    const type = msg.head[0];
    const id = msg.head[1];
    if (type === 204) {
      handleFrame(msg.data);
      return;
    }
    // The host's ChannelServer sends Initialize(200) once, queued until the
    // port is started. Wait for it before polling: the App's ChannelClient
    // must see it first, and polling during its startup is what hung the
    // splash page once.
    if (type === 200) {
      portReady = true;
      nextPollAt = 0;
      poll();
      return;
    }
    if (id !== pendingId) return;
    if (type === 201) {
      pendingId = 0;
      lastError = '';
      nextPollAt = 0;
      forwardSnapshot(msg.data, '');
      return;
    }
    if (type === 202) {
      pendingId = 0;
      const detail = msg.data && typeof msg.data.message === 'string' ? msg.data.message : 'readSessionDebug failed';
      // A restored/just-created session may not be attached to the agent yet;
      // that is normal startup, not a broken data source.
      if (/not active|session_unavailable|session unavailable/i.test(detail)) {
        nextPollAt = performance.now() + 1000;
        return;
      }
      reportError(detail.slice(0, 160));
      return;
    }
    if (type === 203) {
      pendingId = 0;
      reportError('readSessionDebug returned an object error');
    }
  }

  function poll() {
    if (!servicePort || !portReady || document.hidden) return;
    const now = performance.now();
    if (pendingId) {
      if (now - pendingAt > 4000) {
        pendingId = 0;
        reportError('readSessionDebug timeout');
      }
      return;
    }
    if (now < nextPollAt) return;

    const sessionId = visibleSessionId();
    if (!sessionId) return;
    const path = workspacePath(sessionId);
    if (!path) return;

    if (seq > 2000000000) seq = 1000000000;
    const id = seq++;
    const params = { workspacePath: path, sessionId: sessionId };
    const identity = workspaceIdentity(sessionId);
    if (identity) params.workspaceIdentity = identity;
    const frame = encodeFrame([100, id, CHANNEL, METHOD], [params]);

    pendingId = id;
    pendingAt = now;
    selfPost = true;
    try {
      // The app's ChannelClient sends the VSBuffer's Uint8Array (`e.buffer`),
      // not its underlying ArrayBuffer. Match it: the host's MessagePortProtocol
      // only accepts `instanceof Uint8Array`.
      servicePort.postMessage(frame);
    } catch {
      pendingId = 0;
      reportError('service port postMessage failed');
    } finally {
      selfPost = false;
    }
  }

  // --- conversation activity -------------------------------------------
  let lastActivityAt = 0;

  function emitActivity() {
    const now = performance.now();
    if (now - lastActivityAt < 250) return;
    lastActivityAt = now;
    send({ src: POST, kind: 'activity' });
  }

  function handleFrame(frame) {
    if (!frame || typeof frame !== 'object') return;
    const topic = typeof frame.topic === 'string' ? frame.topic : '';
    if (topic.indexOf('conversation/') !== 0) return;
    const sid = topic.slice('conversation/'.length);
    if (sid) window.__zcodeTpsSessionId = sid;
    const payload = frame.payload;
    if (!payload || typeof payload !== 'object') return;
    const deltas = payload.deltas;
    if (!Array.isArray(deltas) || deltas.length === 0) return;   // snapshot on resume, not generation
    emitActivity();
  }

  // --- port capture -----------------------------------------------------
  // The preload forwards `zcode:service-port` from the main process with the
  // base (unscoped) MessagePort. The app's own listener attaches too; a port
  // supports multiple listeners, so this stays passive.
  function onWindowMessage(event) {
    if (event.source !== window) return;
    const d = event.data;
    if (!d) return;

    if (d.type === SCOPED_PORT) {
      if (typeof d.sessionId === 'string' && typeof d.workspacePath === 'string' && d.workspacePath) {
        // delete + set makes the Map a real LRU: the oldest entry is evicted first.
        scopedInfo.delete(d.sessionId);
        scopedInfo.set(d.sessionId, {
          path: d.workspacePath,
          identity: typeof d.workspaceIdentity === 'string' ? d.workspaceIdentity : ''
        });
        while (scopedInfo.size > SCOPED_MAX) {
          const oldest = scopedInfo.keys().next().value;
          scopedInfo.delete(oldest);
        }
      }
      return;
    }

    if (d.type !== SERVICE_PORT) return;
    const port = event.ports && event.ports[0];
    if (!port) return;
    if (port === servicePort) return;

    if (servicePort) {
      try { servicePort.removeEventListener('message', onPortMessage); } catch {}
    }
    servicePort = port;
    portReady = false;
    pendingId = 0;
    nextPollAt = 0;
    lastError = '';
    // A new port means a new window / workspace: the previous sniff result no
    // longer describes it, and stale paths would leak into the next session.
    // scopedInfo is keyed by sessionId and may arrive before the port, so it
    // is not cleared here.
    sniffedPath = '';
    sniffedIdentity = '';
    installPortSniffer(port);
    // Only attach. Do NOT call port.start(): the App's MessagePortProtocol
    // owns startup and must receive the queued Initialize(200) itself.
    // Starting it here steals that frame; the App's ChannelClient stays
    // Uninitialized and the splash page hangs (reproduced on 2026-10-22).
    try { port.addEventListener('message', onPortMessage); } catch {}
    // Fallback if Initialize was already consumed before this listener
    // attached (or the host variant does not send one).
    setTimeout(() => {
      if (servicePort === port && !portReady) {
        portReady = true;
        poll();
      }
    }, 2000);
  }

  window.addEventListener('message', onWindowMessage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      nextPollAt = 0;
      poll();
    }
  });
  setInterval(poll, POLL_MS);

  // --- outbound sniff (instance-scoped) --------------------------------
  // Wrap only the service port we captured. Patching MessagePort.prototype
  // would put a scan on every port in the renderer (files, clipboard, session
  // snapshots) and cannot be undone without restarting the process.
  const sniffedPorts = new WeakSet();

  function installPortSniffer(port) {
    try {
      if (sniffedPorts.has(port)) return;
      sniffedPorts.add(port);
      const origPost = port.postMessage;
      Object.defineProperty(port, 'postMessage', {
        configurable: true,
        value: function (message, transfer) {
          try {
            if (!selfPost) {
              const u8 = asBytes(message);
              if (u8) sniffOutgoing(u8);
            }
          } catch {}
          return origPost.apply(this, arguments);
        }
      });
    } catch {}
  }
}
