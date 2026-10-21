// ZCode tok/s badge - CDP injector (fallback if the preload patch is not applied).
// Usage: node tools/injector.mjs [port]
//
// ZCode must be started with: --remote-debugging-port=<port>
// The badge is injected into the main renderer page (out/renderer/index.html).

import { badgeSource } from '../src/badge-source.mjs';

const PORT = Number(process.argv[2] || 9222);
const BASE = `http://127.0.0.1:${PORT}`;
const BADGE = `(${badgeSource.toString()})();`;

const attached = new Map();

async function listTargets() {
  const res = await fetch(`${BASE}/json/list`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function attach(target) {
  if (attached.has(target.id)) return;
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  attached.set(target.id, ws);
  let seq = 0;
  const send = (method, params) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ id: ++seq, method, params }));
    }
  };
  ws.addEventListener('open', () => {
    send('Page.enable');
    send('Page.addScriptToEvaluateOnNewDocument', { source: BADGE });
    send('Runtime.evaluate', { expression: BADGE });
  });
  ws.addEventListener('close', () => attached.delete(target.id));
  ws.addEventListener('error', () => {
    try { ws.close(); } catch {}
  });
}

async function main() {
  const startedAt = Date.now();
  let everUp = false;
  let misses = 0;
  for (;;) {
    try {
      const targets = await listTargets();
      everUp = true;
      misses = 0;
      for (const t of targets) {
        if (t.type === 'page' && /index\.html/i.test(t.url || '')) attach(t);
      }
    } catch {
      if (everUp && ++misses >= 6) process.exit(0);
      if (!everUp && Date.now() - startedAt > 120000) process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main();
