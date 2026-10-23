#!/usr/bin/env node
// Drives src/event-source.mjs in a VM with a fake MessagePort and verifies the
// request/response shape used by the session/debug poller.
//
//   node tools/ci/test-debug-source.mjs

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { eventSource } from '../../src/event-source.mjs';

const SESSION = 'sess-1';
const WORKSPACE = 'F:\\Project\\ZcodeAIModels';

// --- same marshalling as the ZCode bundles -------------------------------
function writeVarint(out, value) {
  value >>>= 0;
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  out.push(value & 0x7f);
}

function writeBytes(out, bytes) {
  writeVarint(out, bytes.length);
  for (const byte of bytes) out.push(byte);
}

function encodeValue(out, value) {
  if (value === undefined) {
    out.push(0);
  } else if (typeof value === 'string') {
    out.push(1);
    writeBytes(out, new TextEncoder().encode(value));
  } else if (Array.isArray(value)) {
    out.push(4);
    writeVarint(out, value.length);
    for (const item of value) encodeValue(out, item);
  } else if (typeof value === 'number' && (value | 0) === value) {
    out.push(6);
    writeVarint(out, value);
  } else {
    out.push(5);
    writeBytes(out, new TextEncoder().encode(JSON.stringify(value)));
  }
}

function encodeFrame(head, data) {
  const out = [];
  encodeValue(out, head);
  encodeValue(out, data);
  return new Uint8Array(out);
}

function decodeValue(u8, state) {
  const type = u8[state.pos++];
  const varint = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = u8[state.pos++];
      value |= (byte & 127) << shift;
      if (!(byte & 128)) return value;
      shift += 7;
    }
  };
  const bytes = (n) => u8.subarray(state.pos, (state.pos += n));
  switch (type) {
    case 0: return undefined;
    case 1: return new TextDecoder().decode(bytes(varint()));
    case 2:
    case 3: { const n = varint(); state.pos += n; return null; }
    case 4: {
      const count = varint();
      const out = [];
      for (let i = 0; i < count; i++) out.push(decodeValue(u8, state));
      return out;
    }
    case 5: return JSON.parse(new TextDecoder().decode(bytes(varint())));
    case 6: return varint();
    default: throw new Error('unknown type ' + type);
  }
}

function decodeFrame(u8) {
  const state = { pos: 0 };
  return { head: decodeValue(u8, state), data: decodeValue(u8, state) };
}

// --- fake browser --------------------------------------------------------
class FakeWindow {
  constructor() {
    this.listeners = new Map();
    this.posted = [];
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatchEvent(event) {
    for (const fn of this.listeners.get(event.type) ?? []) fn(event);
  }
  postMessage(message) {
    this.posted.push(message);
  }
}

class FakePort {
  constructor() {
    this.listeners = new Map();
    this.sent = [];
    this.started = false;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    const index = list.indexOf(fn);
    if (index >= 0) list.splice(index, 1);
  }
  start() { this.started = true; }
  postMessage(message) { this.sent.push(message); }
  receive(frame) {
    const event = { data: frame };
    for (const fn of this.listeners.get('message') ?? []) fn(event);
  }
}

class FakeMessagePort extends FakePort {}
FakeMessagePort.prototype.addEventListener = FakePort.prototype.addEventListener;
FakeMessagePort.prototype.removeEventListener = FakePort.prototype.removeEventListener;
FakeMessagePort.prototype.start = FakePort.prototype.start;
FakeMessagePort.prototype.postMessage = FakePort.prototype.postMessage;

const fakeWindow = new FakeWindow();
const element = {
  getAttribute: () => SESSION,
  getBoundingClientRect: () => ({ width: 100, height: 100 })
};
const fakeDocument = {
  hidden: false,
  querySelectorAll: () => [element],
  addEventListener() {}
};
const fakeLocation = {
  search: '?initialWorkspacePath=' + encodeURIComponent(WORKSPACE)
};

// Mutable clock + captured interval so the tests can drive the poller without
// waiting for real seconds (idle back-off is timing behaviour).
const clock = { now: 1000 };
const intervals = [];
const advance = (ms) => { clock.now += ms; };

const context = {
  window: fakeWindow,
  document: fakeDocument,
  location: fakeLocation,
  MessagePort: FakeMessagePort,
  performance: { now: () => clock.now },
  setInterval: (fn) => { intervals.push(fn); return intervals.length; },
  setTimeout: () => 1,
  TextEncoder,
  TextDecoder,
  URLSearchParams,
  Uint8Array,
  ArrayBuffer,
  JSON,
  console
};
context.globalThis = context;

const source = '(' + eventSource.toString() + ')()';
vm.runInNewContext(source, context, { filename: 'event-source.mjs' });

// --- capture the base port ----------------------------------------------
const port = new FakeMessagePort();
fakeWindow.dispatchEvent({
  type: 'message',
  source: fakeWindow,
  data: { type: 'zcode:service-port', databaseStartupId: 'db-1' },
  ports: [port]
});

// The tap must only attach a listener. The App's MessagePortProtocol starts
// the port and consumes the queued Initialize(200); starting it here stole
// that frame and hung the real splash page.
assert.equal(port.started, false, 'tap must not start the port');
assert.equal(port.sent.length, 0, 'no request before Initialize');
assert.equal(port.listeners.get('message')?.length, 1, 'tap attaches one listener');

// Simulate the App's MessagePortProtocol: start, then deliver Initialize.
port.start();
port.receive(encodeFrame([200], undefined));
assert.equal(port.sent.length, 1, 'one request after Initialize');
assert.ok(port.sent[0] instanceof Uint8Array, 'request must be a Uint8Array');

const request = decodeFrame(port.sent[0]);
assert.deepEqual(request.head.slice(0, 4), [100, request.head[1], 'zcode-agent', 'readSessionDebug']);
assert.deepEqual(request.data, [{ workspacePath: WORKSPACE, sessionId: SESSION }]);

// --- snapshot response ---------------------------------------------------
const snapshot = {
  sessionId: SESSION,
  rounds: [{
    eventKey: 'e1',
    requestId: 'r1',
    requestIndex: 1,
    recordedAt: 1,
    usage: {
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      reasoningTokens: 12,
      cachedInputTokens: 60,
      cachedWriteInputTokens: 0
    },
    hitRate: 0.6,
    generationDurationMs: 2000,
    tokensPerSecond: 20
  }, {
    eventKey: 'e2',
    requestId: 'r2',
    requestIndex: 2,
    recordedAt: 2,
    usage: {
      inputTokens: 200,
      outputTokens: 80,
      totalTokens: 280,
      reasoningTokens: 24,
      cachedInputTokens: 120,
      cachedWriteInputTokens: 0
    },
    hitRate: 0.6,
    generationDurationMs: 2000,
    tokensPerSecond: 40
  }, {
    // Real panel artifact: 388 output / 6 ms = 64,666.7 tok/s. It must not
    // enter avg/max/min, and the badge must not show it as the current round.
    eventKey: 'e3',
    requestId: 'r3',
    requestIndex: 3,
    recordedAt: 3,
    usage: {
      inputTokens: 612799,
      outputTokens: 388,
      totalTokens: 613187,
      reasoningTokens: 0,
      cachedInputTokens: 612608,
      cachedWriteInputTokens: 0
    },
    hitRate: 1,
    generationDurationMs: 6,
    tokensPerSecond: 64666.7
  }],
  networkEntries: [{ requestHeaders: { authorization: 'secret' } }],
  cache: {
    hitRateRequestCount: 3,
    totalInputTokens: 613099,
    totalCacheReadTokens: 612788,
    hitRate: 1
  }
};
// The real payload carries up to 100 network records, each with 512-char
// headers and a 2 KB message. None of it is needed, and it must never be
// decoded: this fixture is ~1.4 MB.
const networkHeaders = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [
  'x-header-' + i, 'v'.repeat(480)
]));
snapshot.networkEntries = Array.from({ length: 100 }, (_, i) => ({
  eventKey: 'n' + i,
  traceId: 't' + i,
  statusType: 'model_request_completed',
  recordedAt: i,
  requestHeaders: networkHeaders,
  responseHeaders: { 'content-type': 'application/json' },
  requestHeaderCount: 24,
  responseHeaderCount: 1,
  message: 'm'.repeat(2000)
}));
port.receive(encodeFrame([201, request.head[1]], snapshot));

const debugMessages = () => fakeWindow.posted
  .map((m) => (typeof m === 'string' ? JSON.parse(m) : m))
  .filter((m) => m && m.src === 'zcode-tps-debug');
const snap = debugMessages().find((m) => m.kind === 'snapshot');
assert.ok(snap, 'snapshot must be forwarded');
assert.equal(snap.count, 3);
assert.equal(snap.round.tokensPerSecond, 64666.7);
assert.equal(snap.round.usage.reasoningTokens, 0);
assert.deepEqual(snap.stats, { count: 2, avg: 30, max: 40, min: 20 });
assert.equal(snap.plausible, false);
assert.equal(snap.cache.hitRate, 1);
assert.equal('networkEntries' in snap, false, 'network headers must not leave the tap');

// Slicing proof: only rounds/cache/sessionId were parsed, not the ~1.4 MB of
// network entries. `fallback` staying at 0 means the byte scanner handled it.
const tapStats = fakeWindow.__zcodeTpsTapStats;
assert.ok(tapStats, 'tap exposes counters');
assert.equal(tapStats.picked, 1, 'response must be sliced, not fully decoded');
assert.equal(tapStats.fallback, 0, 'no full JSON.parse fallback on the normal shape');
assert.ok(
  tapStats.parsedBytes < 64 * 1024,
  `only the needed fields are parsed (got ${tapStats.parsedBytes} bytes for a ~1.4 MB payload)`
);

// --- identical snapshots are not re-posted ---------------------------------
const snapshotPosts = () => debugMessages().filter((m) => m.kind === 'snapshot').length;
assert.equal(snapshotPosts(), 1);
advance(1100);                      // still inside the 5 s active window
intervals.at(-1)();
assert.equal(port.sent.length, 2, 'active polling continues once per second');
const repeat = decodeFrame(port.sent[1]);
port.receive(encodeFrame([201, repeat.head[1]], snapshot));
assert.equal(snapshotPosts(), 1, 'an unchanged snapshot is not posted again');

// --- idle back-off ---------------------------------------------------------
advance(7000);                      // >5 s since activity, <10 s since last poll
intervals.at(-1)();
assert.equal(port.sent.length, 2, 'idle polls back off to 10 s');
advance(3000);                      // now 10.1 s since the last poll
intervals.at(-1)();
assert.equal(port.sent.length, 3, 'idle poll fires after the back-off window');
const idlePoll = decodeFrame(port.sent[2]);
assert.deepEqual(idlePoll.data, [{ workspacePath: WORKSPACE, sessionId: SESSION }]);

// --- activity ------------------------------------------------------------
const activityCount = () => debugMessages().filter((m) => m.kind === 'activity').length;
assert.equal(activityCount(), 0);

// Frames on other topics are not activity.
port.receive(encodeFrame([204, 1], {
  topic: 'workspace/presentation',
  payload: { kind: 'deltas', deltas: [{ op: 'x' }] }
}));
assert.equal(activityCount(), 0, 'non-conversation frames are ignored');

// A resume snapshot (`deltas: []`) is not generation either.
port.receive(encodeFrame([204, 2], {
  topic: 'conversation/' + SESSION,
  payload: { kind: 'snapshot', deltas: [] }
}));
assert.equal(activityCount(), 0, 'empty deltas are not activity');

// The session id is read from the topic bytes even without a parse.
assert.equal(fakeWindow.__zcodeTpsSessionId, SESSION);

port.receive(encodeFrame([204, 3], {
  topic: 'conversation/' + SESSION,
  payload: { kind: 'deltas', deltas: [{ op: 'row.delta', rowId: 1, path: 'text', append: 'x' }] }
}));
assert.ok(debugMessages().some((m) => m.kind === 'activity'), 'activity must be forwarded');

// A big conversation snapshot (resume) must be classified from its bytes, not
// decoded: the rows carry the whole message history.
const bigRows = Array.from({ length: 200 }, (_, i) => ({
  id: 'row' + i,
  text: 'x'.repeat(2000),
  tool: { name: 'read', argv: ['"deltas":[]'], result: 'y'.repeat(500) }
}));
const beforeFrames = fakeWindow.__zcodeTpsTapStats.frames;
port.receive(encodeFrame([204, 4], {
  topic: 'conversation/' + SESSION,
  payload: { kind: 'snapshot', rows: bigRows, deltas: [] }
}));
assert.equal(fakeWindow.__zcodeTpsTapStats.frames, beforeFrames + 1, 'frame counted');
assert.equal(activityCount(), 1, 'a resume snapshot is not generation');

// --- error response on a reconnected port --------------------------------
const port2 = new FakeMessagePort();
fakeWindow.dispatchEvent({
  type: 'message',
  source: fakeWindow,
  data: { type: 'zcode:service-port', databaseStartupId: 'db-1' },
  ports: [port2]
});
port2.start();
port2.receive(encodeFrame([200], undefined));
assert.equal(port2.sent.length, 1, 'a new base port polls after Initialize');
const second = decodeFrame(port2.sent[0]);
port2.receive(encodeFrame([202, second.head[1]], { message: 'boom' }));
assert.ok(debugMessages().some((m) => m.kind === 'error' && m.message === 'boom'));

// --- scoped workspace metadata wins over the window URL ------------------
fakeWindow.dispatchEvent({
  type: 'message',
  source: fakeWindow,
  data: {
    type: 'zcode:scoped-service-port',
    sessionId: SESSION,
    workspacePath: 'F:\\Remote\\Project',
    workspaceIdentity: 'ssh:host'
  },
  ports: []
});
const port3 = new FakeMessagePort();
fakeWindow.dispatchEvent({
  type: 'message',
  source: fakeWindow,
  data: { type: 'zcode:service-port', databaseStartupId: 'db-1' },
  ports: [port3]
});
port3.start();
port3.receive(encodeFrame([200], undefined));
const third = decodeFrame(port3.sent[0]);
assert.deepEqual(third.data, [{
  workspacePath: 'F:\\Remote\\Project',
  workspaceIdentity: 'ssh:host',
  sessionId: SESSION
}]);

console.log('debug-source: request shape, snapshot forwarding, activity, error, scoped workspace');

// --- update/startup window is skipped entirely ----------------------------
const gateWindow = new FakeWindow();
const gateContext = {
  ...context,
  window: gateWindow,
  location: { search: '?windowKind=update-status' },
  document: { hidden: false, querySelectorAll: () => [], addEventListener() {} }
};
gateContext.globalThis = gateContext;
vm.runInNewContext(source, gateContext, { filename: 'event-source.mjs' });
assert.equal(gateWindow.listeners.get('message'), undefined, 'update-status window must not install a tap');
assert.equal(gateWindow.__zcodeTpsEventTap, undefined);

console.log('debug-source: request shape, snapshot forwarding, activity, error, scoped workspace, startup handshake');
