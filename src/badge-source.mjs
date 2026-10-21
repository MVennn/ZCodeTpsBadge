// Self-contained badge script. Serialized with toString() and injected into the
// renderer (via preload or CDP). Keep it dependency-free.

export function badgeSource() {
  if (window.__zcodeTpsBadgeInstalled) return;
  window.__zcodeTpsBadgeInstalled = true;

  function boot() {
    if (!document.getElementById('root')) return;
    if (!/index\.html$/i.test(location.pathname)) return;
    if (document.getElementById('zcode-tps-badge')) return;

    const host = document.createElement('div');
    host.id = 'zcode-tps-badge';
    host.style.cssText = [
      'position:fixed',
      'right:14px',
      'bottom:12px',
      'z-index:2147483647',
      'display:inline-flex',
      'align-items:center',
      'gap:6px',
      'padding:4px 9px',
      'border-radius:999px',
      'background:var(--color-card,#2b2b2b)',
      'border:1px solid var(--color-border,rgba(255,255,255,.10))',
      'color:var(--color-foreground,#e5e5e5)',
      'font:500 11px/1 var(--font-sans,ui-sans-serif,system-ui,sans-serif)',
      'font-variant-numeric:tabular-nums',
      'letter-spacing:.01em',
      'pointer-events:none',
      'user-select:none',
      'box-shadow:0 1px 2px rgba(0,0,0,.25)',
      'transition:color .15s ease,border-color .15s ease'
    ].join(';');

    const dot = document.createElement('span');
    dot.style.cssText =
      'width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.45;' +
      'transition:opacity .15s ease';
    const value = document.createElement('span');
    value.textContent = '\u2014';
    value.style.cssText = 'opacity:.62;transition:opacity .15s ease';
    const unit = document.createElement('span');
    unit.textContent = 'tok/s';
    unit.style.cssText = 'opacity:.55';
    host.append(dot, value, unit);
    document.documentElement.appendChild(host);

    const seen = new WeakMap();
    let tokens = 0;
    let ema = 0;
    let lastAt = performance.now();
    let idleTimer = 0;

    function countText(s) {
      if (!s) return;
      let cjk = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (
          (c >= 0x4e00 && c <= 0x9fff) ||
          (c >= 0x3040 && c <= 0x30ff) ||
          (c >= 0xac00 && c <= 0xd7af)
        ) cjk++;
      }
      tokens += cjk * 0.6 + (s.length - cjk) * 0.25;
    }

    const SKIP = [
      'textarea',
      'input',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[data-testid="chat-input"]',
      '[data-testid^="background-bash"]',
      '[data-testid="execute-detail"]',
      '[data-testid="execute-command"]',
      '[data-testid="execute-command-prompt"]',
      '[data-testid="developer-tools-pane"]'
    ].join(',');

    function skipEl(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el === host || host.contains(el)) return true;
      try { return !!el.closest(SKIP); } catch { return false; }
    }

    function countNode(node) {
      const prev = seen.get(node) || 0;
      const now = node.data.length;
      if (now > prev) countText(node.data.slice(prev));
      seen.set(node, now);
    }

    function markSubtree(el) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) seen.set(n, n.data.length);
    }

    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          if (!skipEl(m.target.parentElement)) countNode(m.target);
          continue;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType === 3) {
            if (!skipEl(n.parentElement)) {
              seen.set(n, 0);
              countNode(n);
            }
          } else if (n.nodeType === 1) {
            if (skipEl(n)) continue;
            const text = n.textContent || '';
            if (text.length > 800) continue;
            countText(text);
            markSubtree(n);
          }
        }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });

    function setActive(on) {
      value.style.opacity = on ? '1' : '.62';
      dot.style.opacity = on ? '1' : '.45';
    }

    function tick() {
      const now = performance.now();
      const dt = (now - lastAt) / 1000;
      if (dt >= 0.35) {
        const instant = tokens / dt;
        tokens = 0;
        lastAt = now;
        ema = ema === 0 ? instant : ema * 0.6 + instant * 0.4;
        if (ema >= 0.05) {
          value.textContent = ema >= 100 ? String(Math.round(ema)) : ema.toFixed(1);
          setActive(true);
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            ema = 0;
            value.textContent = '\u2014';
            setActive(false);
          }, 1800);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
