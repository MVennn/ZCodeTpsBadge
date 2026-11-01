// ZCode tok/s badge - CDP injector (fallback if the preload patch is not applied).
// Usage: node tools/injector.mjs [port]
//
// ZCode must be started with: --remote-debugging-port=<port>
// The badge is injected into the main renderer page (out/renderer/index.html).

import { badgeSource } from '../src/badge-source.mjs';
import { eventSource } from '../src/event-source.mjs';

const PORT = Number(process.argv[2] || 9222);
const BASE = `http://127.0.0.1:${PORT}`;
// CDP evaluates this in the page's main world, so the debug tap must be
// installed right here: badge-source's installTap() needs require('electron'),
// which does not exist in a page injected over CDP. patch.mjs binds
// __tpsEventTapSource for the preload path; this fallback has to do both.
const BADGE = `(${eventSource.toString()})();\n(${badgeSource.toString()})();`;

if (typeof WebSocket === 'undefined') {
  console.error('Node 22+ is required (global WebSocket is missing).');
  process.exit(2);
}

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
      for (const t of targets) {
        if (t.type === 'page' && /index\.html/i.test(t.url || '')) attach(t);
      }
      // Reset only when the attach loop threw nothing synchronously: a sync
      // failure (bad target URL, missing WebSocket global) lands in the catch
      // below and keeps counting toward the miss limit. A WebSocket that dies
      // asynchronously is not counted on purpose: /json/list succeeded, so
      // ZCode is alive and the next pass simply retries the attach.
      misses = 0;
    } catch (e) {
      if (everUp && ++misses >= 6) {
        console.error('CDP attach failed repeatedly:', e && e.message ? e.message : e);
        process.exit(1);
      }
      if (!everUp && Date.now() - startedAt > 300000) {
        console.error('ZCode did not expose the debugging port within 5 minutes.');
        process.exit(0);
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main();
