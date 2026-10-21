// Main-world service-port tap. Serialized with toString() and injected into the
// main world via webFrame.executeJavaScript. ZCode streams chat rows to the
// renderer over a binary RPC protocol (VSCode-style VSBuffer marshalling)
// carried by the MessagePort delivered with the `zcode:service-port` window
// message. We passively observe every port's messages, decode EventFire
// frames, and forward per-delta character counts to the badge (isolated
// world) via window.postMessage. Never mutates app state; decode errors are
// swallowed.
//
// Wire format (verified against desktop@2.x subagentsStore bundle):
//   message = one VSBuffer per port message, holding two marshalled values:
//     [1] array [msgType, requestId, ...]   (EventFire = 204)
//     [2] the event payload value
//   marshalled value = 1 type byte:
//     0 Undefined | 1 String | 2 Buffer | 3 VSBuffer | 4 Array | 5 Object | 6 Int
//   String/Buffer/VSBuffer/Object are prefixed by a LEB128 varint length;
//   Object payload is JSON (Uint8Array → {__zcode_rpc_nested_uint8array_v1,base64});
//   Array is [varint count][values]; Int is a bare varint.
//
// Conversation frames (payload values): {topic:"conversation/<id>",
//   payload:{kind:"snapshot"|"deltas", deltas:[{op:"row.appended"|"row.upserted"|
//   "row.delta"|"row.removed", ...}]}} with row kinds assistantText / reasoning /
//   toolCall; text lives in row.text (assistantText, reasoning) or row.inputText
//   (toolCall); row.delta carries {rowId, append, path}.

export function eventSource() {
  if (window.__zcodeTpsEventTap) return;
  window.__zcodeTpsEventTap = true;

  var POST = 'zcode-tps-event';

  function send(msg) {
    try { window.postMessage(msg, '*'); } catch {}
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

  // One port message → {type, id, data} or null.
  function decodeRpc(u8) {
    try {
      const r = makeReader(u8);
      const head = decodeValue(r, 0);
      if (!Array.isArray(head) || head.length < 2) return null;
      const data = decodeValue(r, 0);
      return { type: head[0], id: head[1], data };
    } catch {
      return null;
    }
  }

  // --- row text bookkeeping (for appended/upserted/snapshot rows) -------
  const rowLen = new Map();   // rowId -> last seen text length
  let rowSweep = 0;

  function rowText(row) {
    if (!row || typeof row !== 'object') return '';
    if (row.kind === 'toolCall') {
      const s = row.state && typeof row.state === 'object' ? row.state.input : row.inputText;
      return typeof s === 'string' ? s : '';
    }
    return typeof row.text === 'string' ? row.text : '';
  }

  function emitRowDelta(rowId, nextText) {
    const prev = rowLen.get(rowId) || 0;
    rowLen.set(rowId, nextText.length);
    const diff = nextText.length - prev;
    if (diff > 0) send({ src: POST, kind: 'delta', n: diff });
  }

  function handleRowOp(op) {
    if (!op || typeof op !== 'object') return;
    if (op.op === 'row.delta') {
      if (typeof op.append === 'string' && op.append.length > 0) {
        const prev = rowLen.get(op.rowId) || 0;
        rowLen.set(op.rowId, prev + op.append.length);
        send({ src: POST, kind: 'delta', n: op.append.length });
      }
      return;
    }
    if (op.op === 'row.appended' || op.op === 'row.upserted') {
      emitRowDelta(op.rowId || (op.row && op.row.rowId), rowText(op.row));
      return;
    }
    if (op.op === 'row.removed' && typeof op.fromRowId === 'string') {
      rowLen.delete(op.fromRowId);
    }
  }

  function pruneRows() {
    if (rowLen.size < 8192) return;
    rowLen.clear();
  }

  function handleFrame(frame) {
    if (!frame || typeof frame !== 'object') return;
    const topic = typeof frame.topic === 'string' ? frame.topic : '';
    if (!topic.startsWith('conversation/')) return;
    const payload = frame.payload;
    if (!payload || typeof payload !== 'object') return;
    const deltas = payload.deltas;
    if (!Array.isArray(deltas)) return;   // snapshots also carry rows via deltas in v4
    for (const op of deltas) handleRowOp(op);
    pruneRows();
  }

  function handleRpc(msg) {
    if (!msg || msg.type !== 204) return;   // EventFire only
    handleFrame(msg.data);
  }

  // --- port tap ----------------------------------------------------------
  // Wrap MessagePort.prototype.addEventListener and the onmessage setter so
  // every port (service port included) gets an extra passive listener. The
  // app's own listeners are untouched.
  const proto = typeof MessagePort !== 'undefined' ? MessagePort.prototype : null;
  if (!proto) return;

  const origAdd = proto.addEventListener;
  proto.addEventListener = function (type, listener, options) {
    try {
      if (type === 'message' && !this.__zcodeTpsTapped) {
        this.__zcodeTpsTapped = true;
        const tap = (e) => {
          try {
            const d = e.data;
            if (!(d instanceof Uint8Array)) return;
            const msg = decodeRpc(d);
            if (msg) handleRpc(msg);
          } catch {}
        };
        origAdd.call(this, 'message', tap);
      }
    } catch {}
    return origAdd.call(this, type, listener, options);
  };
  try {
    const desc = Object.getOwnPropertyDescriptor(proto, 'onmessage');
    if (desc && desc.set && desc.configurable) {
      Object.defineProperty(proto, 'onmessage', {
        get: desc.get,
        set(value) {
          try {
            if (!this.__zcodeTpsTapped) {
              this.__zcodeTpsTapped = true;
              const tap = (e) => {
                try {
                  const d = e.data;
                  if (!(d instanceof Uint8Array)) return;
                  const msg = decodeRpc(d);
                  if (msg) handleRpc(msg);
                } catch {}
              };
              origAdd.call(this, 'message', tap);
            }
          } catch {}
          desc.set.call(this, value);
        },
        configurable: true,
        enumerable: desc.enumerable
      });
    }
  } catch {}
}
