// Build the standalone preview pages used to check the badge's look and scope.
// Output is generated into tools/preview/site/.
//
//   node tools/preview/build.mjs
//   node tools/preview/serve.mjs
//
// Visual preview:  http://127.0.0.1:8766/index.html
// Scope test:      http://127.0.0.1:8766/index.html?test=1
//   (no auto-stream; use window.__appendAssistant / __appendSidebar /
//    __appendUser / __appendTool to drive specific regions)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badgeSource } from '../../src/badge-source.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, 'site');
const badge = badgeSource.toString();

const themes = {
  dark: {
    cls: 'dark',
    card: '#262626',
    border: '#fafafa1a',
    fg: '#e5e5e5',
    bg: '#161616',
    sub: '#e5e5e599',
  },
  light: {
    cls: 'theme-zai-light',
    card: '#ffffff',
    border: '#0d0d0d1a',
    fg: '#262626',
    bg: '#f8f8f8',
    sub: '#26262699',
  },
};

for (const [name, t] of Object.entries(themes)) {
  const html = `<!doctype html>
<html class="${t.cls}">
<head>
<meta charset="utf-8">
<title>ZCode badge preview (${name})</title>
<style>
  :root{
    --color-card:${t.card};
    --color-border:${t.border};
    --color-foreground:${t.fg};
    --color-foreground-subtle:${t.sub};
    --color-background:${t.bg};
    --font-sans:ui-sans-serif,system-ui,sans-serif;
  }
  html,body{margin:0;height:100%}
  body{background:var(--color-background);color:var(--color-foreground);font:14px/1.6 var(--font-sans)}
  .layout{display:grid;grid-template-columns:180px 1fr;height:100vh}
  .sidebar{border-right:1px solid var(--color-border);padding:16px;color:var(--color-foreground-subtle);font-size:12px;background:var(--color-background)}
  .sidebar-title{font-weight:600;margin-bottom:8px;color:var(--color-foreground)}
  .main{display:flex;flex-direction:column;min-width:0;min-height:0;height:100vh}
  .chat{flex:1;min-height:0;overflow:auto;padding:24px}
  .composer{flex:0 0 auto;padding:10px 24px 16px}
  .composer-row{display:flex;align-items:center;gap:12px;background:var(--color-card);border:1px solid var(--color-border);border-radius:12px;padding:8px 12px}
  .composer-leading{display:flex;align-items:center;gap:10px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--color-foreground-subtle);font-size:12px}
  .composer-trailing{margin-left:auto;display:flex;flex:0 0 auto;align-items:center;gap:6px;color:var(--color-foreground-subtle);font-size:12px}
  .usage{font-variant-numeric:tabular-nums}
  .send{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:var(--color-foreground);color:var(--color-background);font-size:14px}
  .row{display:flex;margin-bottom:14px}
  .row[data-trajectory-message-role="user"]{justify-content:flex-end}
  .bubble{max-width:520px;background:var(--color-card);border:1px solid var(--color-border);border-radius:12px;padding:12px 14px;min-height:52px;white-space:pre-wrap}
  .row[data-trajectory-message-role="user"] .bubble{opacity:.9}
  .tool{margin-top:10px;padding:8px 10px;border:1px dashed var(--color-border);border-radius:8px;color:var(--color-foreground-subtle);font-size:12px}
  .reasoning{margin-bottom:8px;padding:8px 10px;border-left:2px solid var(--color-border);color:var(--color-foreground-subtle);font-size:12px;white-space:pre-wrap}
  .reasoning-label{font-size:11px;opacity:.6;margin-bottom:4px}
  .label{font-size:11px;color:var(--color-foreground-subtle);margin-bottom:6px}
  .caret{display:inline-block;width:1px;height:14px;background:var(--color-foreground);vertical-align:-2px;animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
</style>
</head>
<body>
<div id="root">
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-title">侧边栏</div>
      <div>会话列表、文件树、预览面板都算这里。</div>
      <div id="sidebar-text"></div>
    </aside>
    <main class="main">
      <div class="chat" data-testid="chat-view">
        <div class="label">chat-view</div>
        <div class="row" data-trajectory-message-role="user">
          <div class="bubble" id="user-text" data-v4-user-input-bubble>用户消息（不应计数）</div>
        </div>
        <div class="row" data-trajectory-message-role="assistant">
          <div class="bubble" data-trajectory-message-content>
            <div class="reasoning" data-reasoning-content>
              <div class="reasoning-label" data-reasoning-label>思考中</div>
              <span id="reasoning-text"></span>
            </div>
            <span id="assistant-text"></span><span class="caret"></span>
            <div class="tool" data-tool-call-id="tool-1"><span id="tool-text">工具调用（应计数）</span></div>
          </div>
        </div>
      </div>
      <div class="composer" data-v4-composer-dock>
        <div class="composer-row">
          <div class="composer-leading">+ 完全访问 · 电脑操作</div>
          <div class="composer-trailing" data-composer-trailing-actions>
            <span class="usage">用量 12%</span>
            <span class="model">global:deepseek-v4.1-flash-sg</span>
            <span class="send">↑</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
<script>(${badge})();</script>
<script>
  var assistant = document.getElementById('assistant-text');
  var reasoning = document.getElementById('reasoning-text');
  var sidebar = document.getElementById('sidebar-text');
  var user = document.getElementById('user-text');
  var tool = document.getElementById('tool-text');

  window.__appendAssistant = function (text) { assistant.textContent += text; };
  window.__appendReasoning = function (text) { reasoning.textContent += text; };
  window.__appendSidebar = function (text) { sidebar.textContent += text; };
  window.__appendUser = function (text) { user.textContent += text; };
  window.__appendTool = function (text) { tool.textContent += text; };
  window.__replaceAssistant = function () { assistant.textContent = assistant.textContent; };
  window.__addHistoryMessage = function (text) {
    var row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('data-trajectory-message-role', 'assistant');
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.setAttribute('data-trajectory-message-content', '');
    bubble.textContent = text;
    row.appendChild(bubble);
    document.querySelector('[data-testid="chat-view"]').appendChild(row);
  };

  // The badge reads the same snapshot as the Developer Tools panel. Drive it
  // with synthetic rounds; appending DOM text must NOT change the number.
  var sessionId = 'preview-session';
  var count = 0;
  window.__debugSnapshot = function (next) {
    count += 1;
    window.postMessage(JSON.stringify({
      src: 'zcode-tps-debug',
      kind: 'snapshot',
      sessionId: sessionId,
      count: count,
      round: next,
      stats: { count: count, avg: 44.8, max: 61.4, min: 31.2 },
      cache: {
        hitRateRequestCount: count,
        totalInputTokens: 12000 * count,
        totalCacheReadTokens: 8000 * count,
        hitRate: 0.66
      }
    }), '*');
  };
  window.__debugActivity = function () {
    window.postMessage(JSON.stringify({ src: 'zcode-tps-debug', kind: 'activity' }), '*');
  };
  window.__debugError = function (message) {
    window.postMessage(JSON.stringify({ src: 'zcode-tps-debug', kind: 'error', message: message }), '*');
  };

  var params = new URLSearchParams(location.search);
  if (params.get('test') !== '1') {
    var speeds = [31.2, 44.8, 52.1, 39.6, 61.4, 48.0];
    var i = 0;
    setInterval(function () {
      window.__debugActivity();
    }, 700);
    setInterval(function () {
      window.__debugSnapshot({
        requestIndex: i + 1,
        tokensPerSecond: speeds[i % speeds.length],
        generationDurationMs: 2400,
        usage: {
          inputTokens: 18234,
          outputTokens: 1432,
          reasoningTokens: 612,
          totalTokens: 19666,
          cachedInputTokens: 12088,
          cachedWriteInputTokens: 0
        }
      });
      i += 1;
    }, 5200);
  }
</script>
</body>
</html>
`;
  const out = name === 'dark' ? path.join(site, 'index.html') : path.join(site, name, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('wrote', path.relative(here, out), html.length);
}
