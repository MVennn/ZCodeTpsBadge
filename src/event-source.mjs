// Main-world service-port tap. Serialized with toString() and injected into the
// main world via webFrame.executeJavaScript.
//
// Two jobs:
//   1. Ask the host for the same snapshot the Developer Tools panel shows
//      (`zcode-agent.readSessionDebug`) once per second while a request is
//      generating, backing off to one per 10 s when the window is idle. Each
//      completed main-turn request carries provider usage (input / output /
//      reasoning / cache tokens) and `tokensPerSecond`, computed exactly as the
//      panel does: outputTokens ÷ (durationMs − timeToFirstContentMs). No
//      character counting, so folded reasoning still contributes its real tokens.
//   2. Watch conversation EventFire frames only to report "activity", so the
//      badge can tell whether a request is currently generating. No counts are
//      derived from row text anymore.
//
// Memory discipline:
//   The service port carries every RPC of the workspace: conversation
//   snapshots, file contents, tool output. Decoding each message into objects
//   just to read its type id built and dropped megabytes per second. So the tap
//   now decodes the *head* only, and:
//     - messages that are not ours are dropped without touching the payload;
//     - conversation frames are classified by scanning the raw JSON bytes
//       (topic + whether `deltas` is a non-empty array);
//     - the poll response is sliced at the byte level for `sessionId`, `rounds`
//       and `cache`. The response's network log (up to 100 records, each with
//       512-char headers and a 2 KB message) is never decoded nor parsed.
//   Everything falls back to a full decode when a shape is unexpected.
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
//   The host answers [201, id] + {sessionId, rounds, networkLog, cache}.
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
  var IDLE_POLL_MS = 10000;
  var ACTIVE_WINDOW_MS = 5000;

  // One decoder/encoder for the lifetime of the window: allocating them per
  // decoded string is pure churn on a path that runs for every port message.
  var DECODER = new TextDecoder();
  var ENCODER = new TextEncoder();
  var asciiCache = new Map();

  function ascii(text) {
    var cached = asciiCache.get(text);
    if (!cached) {
      cached = ENCODER.encode(text);
      asciiCache.set(text, cached);
    }
    return cached;
  }

  var NEEDLE_TOPIC = ascii('"topic":"conversation/');
  var NEEDLE_DELTAS = ascii('"deltas":');
  var NEEDLE_WORKSPACE = ascii('workspacePath');

  // Diagnostics only: counts, never payloads. Surfaced for the debug console
  // and asserted by tools/ci/test-debug-source.mjs.
  var stats = { msgs: 0, skipped: 0, frames: 0, picked: 0, fallback: 0, parsedBytes: 0 };
  try { window.__zcodeTpsTapStats = stats; } catch {}

  // Structured objects do not reliably cross contextIsolation; send a JSON
  // string and let the badge parse it (CODE-RULES §2.9).
  function send(msg) {
    try { window.postMessage(JSON.stringify(msg), '*'); } catch {}
  }

  // --- varint + marshalled value reader ---------------------------------
  function makeReader(u8, pos) {
    return {
      pos: pos || 0,
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
        return DECODER.decode(r.read(n));
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
        try { return JSON.parse(DECODER.decode(r.read(n))); } catch { return null; }
      }
      case 6: return readVarint(r);
      default: throw new RangeError('type ' + type);
    }
  }

  // Head only: [msgType, requestId, …] is a handful of small values, so this
  // stays cheap for every message on the port.
  function decodeHead(u8) {
    try {
      const r = makeReader(u8, 0);
      const head = decodeValue(r, 0);
      if (!Array.isArray(head) || head.length < 1) return null;
      return { head: head, pos: r.pos };
    } catch {
      return null;
    }
  }

  function readVarintAt(u8, pos) {
    let v = 0, shift = 0, b;
    for (;;) {
      if (pos >= u8.length) throw new RangeError('eof');
      b = u8[pos++];
      v |= (b & 127) << shift;
      if (!(b & 128)) return { value: v, pos: pos };
      shift += 7;
      if (shift > 35) throw new RangeError('varint');
    }
  }

  // Byte range of a length-prefixed marshalled value (String / Buffer /
  // VSBuffer / Object-JSON) without materialising it. Arrays, ints and
  // undefined return null: their callers fall back to a full decode, and none
  // of them carries a large payload.
  function byteRange(u8, pos) {
    const type = u8[pos];
    if (type !== 1 && type !== 2 && type !== 3 && type !== 5) return null;
    try {
      const at = readVarintAt(u8, pos + 1);
      const start = at.pos;
      const end = start + at.value;
      if (end > u8.length) return null;
      return { type: type, start: start, end: end };
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
      writeBytes(out, ENCODER.encode(value));
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
    writeBytes(out, ENCODER.encode(JSON.stringify(value)));
  }

  function encodeFrame(head, data) {
    const out = [];
    encodeValue(out, head);
    encodeValue(out, data);
    return new Uint8Array(out);
  }

  // ASCII substring search over a byte range. Pattern bytes are cached, and the
  // first byte is compared before the rest, so a miss costs ~1 compare/byte.
  function findAscii(u8, from, to, pattern) {
    const last = to - pattern.length;
    outer: for (let i = from; i <= last; i++) {
      if (u8[i] !== pattern[0]) continue;
      for (let j = 1; j < pattern.length; j++) {
        if (u8[i + j] !== pattern[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    return null;
  }

  // --- JSON slicing ------------------------------------------------------
  // Minimal JSON scanner: it never builds objects, it only finds the byte
  // ranges of the top-level members the tap actually reads.
  function skipWs(u8, i, to) {
    while (i < to) {
      const b = u8[i];
      if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) break;
      i++;
    }
    return i;
  }

  function skipString(u8, i, to) {
    i++;
    while (i < to) {
      const b = u8[i];
      if (b === 0x5c) { i += 2; continue; }
      if (b === 0x22) return i + 1;
      i++;
    }
    throw new RangeError('string');
  }

  function skipValue(u8, i, to) {
    const c = u8[i];
    if (c === 0x22) return skipString(u8, i, to);
    if (c === 0x7b || c === 0x5b) {
      let depth = 0;
      while (i < to) {
        const b = u8[i];
        if (b === 0x22) { i = skipString(u8, i, to); continue; }
        if (b === 0x7b || b === 0x5b) { depth++; i++; continue; }
        if (b === 0x7d || b === 0x5d) {
          depth--;
          i++;
          if (depth === 0) return i;
          continue;
        }
        i++;
      }
      throw new RangeError('container');
    }
    while (i < to) {
      const b = u8[i];
      if (b === 0x2c || b === 0x7d || b === 0x5d) return i;
      i++;
    }
    throw new RangeError('scalar');
  }

  // Parse only the requested top-level members of a JSON object. Returns null
  // when the shape is unexpected so the caller can fall back to JSON.parse.
  function pickTopLevel(u8, start, end, wanted) {
    let i = skipWs(u8, start, end);
    if (u8[i] !== 0x7b) return null;
    i++;
    const out = {};
    for (;;) {
      i = skipWs(u8, i, end);
      if (i >= end) return null;
      if (u8[i] === 0x7d) break;
      if (u8[i] !== 0x22) return null;
      const keyEnd = skipString(u8, i, end);
      let key;
      try { key = JSON.parse(DECODER.decode(u8.subarray(i, keyEnd))); } catch { return null; }
      i = skipWs(u8, keyEnd, end);
      if (u8[i] !== 0x3a) return null;
      i = skipWs(u8, i + 1, end);
      const valueEnd = skipValue(u8, i, end);
      if (wanted[key]) {
        out[key] = JSON.parse(DECODER.decode(u8.subarray(i, valueEnd)));
        stats.parsedBytes += valueEnd - i;
      }
      i = skipWs(u8, valueEnd, end);
      if (u8[i] === 0x2c) { i++; continue; }
      if (u8[i] === 0x7d) break;
      return null;
    }
    return out;
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
  const SNIFF_MAX_BYTES = 128 * 1024;

  function sniffOutgoing(u8) {
    if (u8.length < SNIFF_MIN_BYTES || u8.length > SNIFF_MAX_BYTES) return;
    if (findAscii(u8, 0, u8.length, NEEDLE_WORKSPACE) < 0) return;
    const msg = decodeHead(u8);
    if (!msg || msg.head[0] !== 100) return;
    let args;
    try { args = decodeValue(makeReader(u8, msg.pos), 0); } catch { return; }
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
  let lastPollAt = -1e9;
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

  // An identical snapshot carries no new information for the badge, and idle
  // polling repeats it every 10 s; posting it again would re-parse and re-render
  // for nothing. The signature covers everything the badge displays.
  let lastSignature = '';

  function snapshotSignature(rounds, last, stats2, cache) {
    return [
      rounds.length,
      last ? last.eventKey : '',
      last ? last.tokensPerSecond : '',
      stats2 ? stats2.count + ':' + stats2.avg : '',
      cache ? cache.hitRateRequestCount + ':' + cache.totalInputTokens + ':' + cache.totalCacheReadTokens : ''
    ].join('|');
  }

  function forwardSnapshot(data, fallbackSessionId, force) {
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
    const stats2 = count > 0
      ? { count: count, avg: sum / count, max: max, min: min }
      : null;

    const signature = snapshotSignature(rounds, last, stats2, data.cache || null);
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    send({
      src: POST,
      kind: 'snapshot',
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : fallbackSessionId,
      count: rounds.length,
      round: last,
      plausible: isPlausibleRound(last),
      cache: data.cache || null,
      stats: stats2
    });
  }

  // Slice the poll response instead of decoding it: the network log alone can
  // hold 100 records of headers plus a 2 KB message each, and none of it is
  // ever used.
  function forwardResponse(u8, pos, fallbackSessionId, force) {
    const range = byteRange(u8, pos);
    if (range && range.type === 5) {
      let picked = null;
      try {
        picked = pickTopLevel(u8, range.start, range.end, {
          sessionId: true, rounds: true, cache: true
        });
      } catch {}
      if (picked && Array.isArray(picked.rounds)) {
        stats.picked++;
        forwardSnapshot({
          sessionId: picked.sessionId,
          rounds: picked.rounds,
          cache: picked.cache || null
        }, fallbackSessionId, force);
        return;
      }
    }
    stats.fallback++;
    let data;
    try { data = decodeValue(makeReader(u8, pos), 0); } catch { return; }
    forwardSnapshot(data, fallbackSessionId, force);
  }

  function onPortMessage(event) {
    const u8 = asBytes(event.data);
    if (!u8) return;
    const msg = decodeHead(u8);
    if (!msg) return;
    stats.msgs++;
    const type = msg.head[0];
    const id = msg.head[1];

    if (type === 204) {
      stats.frames++;
      handleFrame(u8, msg.pos);
      return;
    }
    // The host's ChannelServer sends Initialize(200) once, queued until the
    // port is started. Wait for it before polling: the App's ChannelClient
    // must see it first, and polling during its startup is what hung the
    // splash page once.
    if (type === 200) {
      portReady = true;
      nextPollAt = 0;
      poll(true);
      return;
    }
    // Everything else on this port belongs to the App. Unless it answers the
    // request we sent, its payload is dropped without being decoded.
    if (id !== pendingId) {
      stats.skipped++;
      return;
    }
    if (type === 201) {
      const recovered = lastError !== '';
      pendingId = 0;
      lastError = '';
      nextPollAt = 0;
      forwardResponse(u8, msg.pos, '', recovered);
      return;
    }
    let data = null;
    try { data = decodeValue(makeReader(u8, msg.pos), 0); } catch {}
    if (type === 202) {
      pendingId = 0;
      const detail = data && typeof data.message === 'string' ? data.message : 'readSessionDebug failed';
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

  function poll(force) {
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
    // Ask once a second only while something is generating; the panel-equivalent
    // snapshot is expensive on the host side too (it rebuilds 200 rounds and
    // 100 network entries), so idle windows back off hard.
    const gap = force || now - lastActivityAt < ACTIVE_WINDOW_MS ? POLL_MS : IDLE_POLL_MS;
    if (now - lastPollAt < gap) return;

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
    lastPollAt = now;
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

  // Read a conversation frame's two relevant facts straight from its JSON
  // bytes: the session id in `topic` and whether `deltas` is a non-empty array.
  // Returns null when the bytes do not look like a marshalled JSON object, so
  // the caller can fall back to a full decode.
  function scanConversationFrame(u8, pos) {
    const range = byteRange(u8, pos);
    if (!range) return null;
    if (range.type !== 5) return { sid: '', active: false };
    const at = findAscii(u8, range.start, range.end, NEEDLE_TOPIC);
    if (at < 0) return { sid: '', active: false };
    const sidStart = at + NEEDLE_TOPIC.length;
    let i = sidStart;
    while (i < range.end && u8[i] !== 0x22) i++;
    if (i >= range.end) return null;
    let sid = '';
    try { sid = DECODER.decode(u8.subarray(sidStart, i)); } catch {}
    let active = false;
    const d = findAscii(u8, range.start, range.end, NEEDLE_DELTAS);
    if (d >= 0) {
      let j = skipWs(u8, d + NEEDLE_DELTAS.length, range.end);
      if (u8[j] === 0x5b) {
        j = skipWs(u8, j + 1, range.end);
        active = u8[j] !== 0x5d;    // ']' means an empty list (snapshot on resume)
      }
    }
    return { sid: sid, active: active };
  }

  function handleFrame(u8, pos) {
    let scanned = scanConversationFrame(u8, pos);
    if (!scanned) {
      // Unexpected shape (older / newer host): decode, exactly as before.
      let frame;
      try { frame = decodeValue(makeReader(u8, pos), 0); } catch { return; }
      if (!frame || typeof frame !== 'object') return;
      const topic = typeof frame.topic === 'string' ? frame.topic : '';
      if (topic.indexOf('conversation/') !== 0) return;
      const payload = frame.payload;
      const deltas = payload && typeof payload === 'object' ? payload.deltas : null;
      if (!Array.isArray(deltas) || deltas.length === 0) return;
      scanned = { sid: topic.slice('conversation/'.length), active: true };
    }
    if (scanned.sid) window.__zcodeTpsSessionId = scanned.sid;
    if (scanned.active) emitActivity();
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
    lastPollAt = -1e9;
    lastError = '';
    lastSignature = '';
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
        poll(true);
      }
    }, 2000);
  }

  window.addEventListener('message', onWindowMessage);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      nextPollAt = 0;
      poll(true);
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
