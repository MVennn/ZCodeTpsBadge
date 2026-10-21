// Build the standalone preview pages used to check the badge's look before
// applying the patch. Output is generated into tools/preview/site/.
//
//   node tools/preview/build.mjs
//   node tools/preview/serve.mjs

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
  body{background:var(--color-background);color:var(--color-foreground);font:14px/1.6 var(--font-sans);display:flex;align-items:center;justify-content:center}
  .app{width:640px;max-width:90vw}
  .title{font-size:12px;color:var(--color-foreground-subtle);margin-bottom:10px;letter-spacing:.02em}
  .msg{background:var(--color-card);border:1px solid var(--color-border);border-radius:12px;padding:14px 16px;min-height:120px}
  .stream{white-space:pre-wrap}
  .caret{display:inline-block;width:1px;height:14px;background:var(--color-foreground);vertical-align:-2px;animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
</style>
</head>
<body>
<div id="root"><div class="app"><div class="title">ZCode · tok/s badge preview (${name})</div><div class="msg"><span class="stream"></span><span class="caret"></span></div></div></div>
<script>(${badge})();</script>
<script>
  const src = '流式输出测试：正在把模型返回的文本一段一段写进 DOM，徽标应当实时显示吞吐量。The quick brown fox jumps over the lazy dog. ';
  const el = document.querySelector('.stream');
  let i = 0;
  setInterval(() => { el.textContent += src.slice(i, i + 3); i = (i + 3) % src.length; }, 90);
</script>
</body>
</html>
`;
  const out = name === 'dark' ? path.join(site, 'index.html') : path.join(site, name, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('wrote', path.relative(here, out), html.length);
}
