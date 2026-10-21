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
      'display:inline-flex',
      'flex:0 0 auto',
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
      'pointer-events:auto',
      'cursor:default',
      'user-select:none',
      'box-shadow:0 1px 2px rgba(0,0,0,.25)',
      'transition:padding .15s ease,font-size .15s ease,color .15s ease,border-color .15s ease'
    ].join(';');

    const dot = document.createElement('span');
    dot.className = 'zcode-tps-dot';
    dot.style.cssText =
      'width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.45;' +
      'transition:opacity .15s ease';
    const value = document.createElement('span');
    value.className = 'zcode-tps-value';
    value.textContent = '\u2014';
    value.style.cssText = 'opacity:.62;transition:opacity .15s ease';
    const unit = document.createElement('span');
    unit.className = 'zcode-tps-unit';
    unit.textContent = 'tok/s';
    unit.style.cssText = 'opacity:.55';
    host.append(dot, value, unit);

    const tip = document.createElement('div');
    tip.id = 'zcode-tps-tip';
    const tipTitle = document.createElement('div');
    tipTitle.className = 'zcode-tps-tip-title';
    tipTitle.textContent = '速度统计 · 本次运行';
    tip.append(tipTitle);
    const tipValues = {};
    for (const [key, label] of [
      ['cur', '当前'],
      ['avg', '平均'],
      ['max', '最高'],
      ['min', '最低'],
      ['total', '累计'],
      ['active', '活跃']
    ]) {
      const row = document.createElement('div');
      row.className = 'zcode-tps-tip-row';
      const name = document.createElement('span');
      name.textContent = label;
      const val = document.createElement('span');
      val.className = 'zcode-tps-tip-value';
      row.append(name, val);
      tip.append(row);
      tipValues[key] = val;
    }
    document.documentElement.appendChild(tip);

    if (!document.getElementById('zcode-tps-badge-style')) {
      const style = document.createElement('style');
      style.id = 'zcode-tps-badge-style';
      style.textContent = [
        '#zcode-tps-badge[data-compact="1"] .zcode-tps-dot{display:none}',
        '#zcode-tps-badge[data-compact="2"] .zcode-tps-dot,',
        '#zcode-tps-badge[data-compact="2"] .zcode-tps-unit{display:none}',
        '#zcode-tps-badge[data-compact="3"] .zcode-tps-dot,',
        '#zcode-tps-badge[data-compact="3"] .zcode-tps-unit{display:none}',
        '#zcode-tps-tip{position:fixed;z-index:2147483647;display:flex;flex-direction:column;gap:3px;',
        'min-width:172px;padding:8px 10px;border-radius:10px;background:var(--color-card,#2b2b2b);',
        'border:1px solid var(--color-border,rgba(255,255,255,.10));color:var(--color-foreground,#e5e5e5);',
        'font:500 11px/1.5 var(--font-sans,ui-sans-serif,system-ui,sans-serif);',
        'box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;opacity:0;transform:translateY(4px);',
        'transition:opacity .12s ease,transform .12s ease;visibility:hidden}',
        '#zcode-tps-tip[data-open="1"]{opacity:1;transform:translateY(0);visibility:visible}',
        '#zcode-tps-tip .zcode-tps-tip-title{font-size:10px;letter-spacing:.02em;opacity:.55;margin-bottom:2px}',
        '#zcode-tps-tip .zcode-tps-tip-row{display:flex;align-items:baseline;justify-content:space-between;gap:20px;white-space:nowrap}',
        '#zcode-tps-tip .zcode-tps-tip-row>span:first-child{opacity:.6}',
        '#zcode-tps-tip .zcode-tps-tip-value{font-variant-numeric:tabular-nums}'
      ].join('');
      document.head.appendChild(style);
    }

    function visible(el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function findComposerActions() {
      const docks = document.querySelectorAll('[data-v4-composer-dock]');
      for (const dock of docks) {
        if (!visible(dock)) continue;
        const actions = dock.querySelector('[data-composer-trailing-actions]');
        if (actions && visible(actions)) return actions;
      }
      const nodes = document.querySelectorAll('[data-composer-trailing-actions]');
      for (const el of nodes) {
        if (visible(el)) return el;
      }
      return null;
    }

    function setInline() {
      host.style.position = 'static';
      host.style.right = '';
      host.style.bottom = '';
      host.style.zIndex = '';
    }

    let dockEl = null;
    let dockObserver = null;

    function updateCompact() {
      if (!dockEl) return;
      const w = dockEl.getBoundingClientRect().width;
      const level = w < 360 ? 3 : w < 480 ? 2 : w < 600 ? 1 : 0;
      if (level) host.dataset.compact = String(level);
      else delete host.dataset.compact;
      host.style.fontSize = level === 3 ? '10px' : '11px';
      host.style.padding = level === 3 ? '3px 7px' : '4px 9px';
      if (tip.dataset.open === '1') positionTip();
    }

    function observeDock(actions) {
      const dock = actions.closest('[data-v4-composer-dock]') || actions.parentElement;
      if (!dock) return;
      if (dock === dockEl) {
        updateCompact();
        return;
      }
      if (dockObserver) dockObserver.disconnect();
      dockEl = dock;
      if (typeof ResizeObserver === 'function') {
        dockObserver = new ResizeObserver(updateCompact);
        dockObserver.observe(dock);
      }
      updateCompact();
    }

    // Wait for the composer; never fall back to a floating corner badge.
    function placeBadge() {
      const actions = findComposerActions();
      if (!actions) {
        delete tip.dataset.open;
        return false;
      }
      if (!host.isConnected || host.parentElement !== actions) {
        setInline();
        actions.prepend(host);
        observeDock(actions);
      } else if (!dockEl || !dockEl.isConnected) {
        observeDock(actions);
      }
      return true;
    }

    let attempts = 0;
    function initialPlace() {
      if (placeBadge()) return;
      if (++attempts < 300) setTimeout(initialPlace, 100);
    }
    initialPlace();

    let tokens = 0;
    let ema = 0;
    let lastAt = performance.now();
    let lastTextAt = 0;
    let frames = 0;
    let statSamples = 0;
    let statTokens = 0;
    let statActiveMs = 0;
    let statMax = 0;
    let statMin = 0;

    function estimateTokens(s) {
      if (!s) return 0;
      let cjk = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (
          (c >= 0x4e00 && c <= 0x9fff) ||
          (c >= 0x3040 && c <= 0x30ff) ||
          (c >= 0xac00 && c <= 0xd7af)
        ) cjk++;
      }
      return cjk * 0.6 + (s.length - cjk) * 0.25;
    }

    function fmtSpeed(n) {
      if (!isFinite(n) || n <= 0) return '\u2014';
      return (n >= 100 ? String(Math.round(n)) : n.toFixed(1)) + ' tok/s';
    }

    function fmtInt(n) {
      return Math.round(n).toLocaleString('zh-CN');
    }

    function updateTip() {
      const avg = statActiveMs > 0 ? statTokens / (statActiveMs / 1000) : 0;
      tipValues.cur.textContent = fmtSpeed(ema);
      tipValues.avg.textContent = fmtSpeed(avg);
      tipValues.max.textContent = fmtSpeed(statMax);
      tipValues.min.textContent = fmtSpeed(statMin);
      tipValues.total.textContent = statSamples > 0 ? fmtInt(statTokens) + ' tokens' : '\u2014';
      tipValues.active.textContent = statActiveMs > 0 ? (statActiveMs / 1000).toFixed(1) + ' s' : '\u2014';
    }

    function placeTip() {
      const r = host.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(8, Math.min(left, innerWidth - tr.width - 8));
      let top = r.top - tr.height - 8;
      if (top < 8) top = r.bottom + 8;
      tip.style.left = Math.round(left) + 'px';
      tip.style.top = Math.round(top) + 'px';
    }

    function positionTip() {
      if (tip.dataset.open === '1') placeTip();
    }

    let showTimer = 0;
    let hideTimer = 0;
    function showTip() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      showTimer = setTimeout(() => {
        updateTip();
        placeTip();
        tip.dataset.open = '1';
      }, 120);
    }
    function hideTip() {
      clearTimeout(showTimer);
      hideTimer = setTimeout(() => {
        delete tip.dataset.open;
      }, 80);
    }
    host.addEventListener('mouseenter', showTip);
    host.addEventListener('mouseleave', hideTip);
    window.addEventListener('resize', positionTip);

    const SKIP = [
      'textarea',
      'input',
      'button',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[data-testid="chat-input"]',
      '[data-testid^="background-bash"]',
      '[data-testid="execute-detail"]',
      '[data-testid="execute-command"]',
      '[data-testid="execute-command-prompt"]',
      '[data-testid="developer-tools-pane"]',
      '[data-v4-composer-dock]',
      '[data-v4-user-input-bubble]',
      '[data-v4-user-input-collapsible-content]',
      '[data-v4-user-input-quotes]',
      '[data-v4-user-input-attachments]',
      '[data-v4-user-input-media-attachments]',
      '[data-trajectory-message-role="user"]',
      '[data-trajectory-message-role="tool"]',
      '[data-trajectory-message-role="system"]',
      '[data-tool-call-id]',
      '[data-zcode-tool-stream-animate]',
      '[data-trajectory-finish-pill]',
      '[data-trajectory-user-call-metadata]',
      '[data-trajectory-user-call-datetime]',
      '[data-trajectory-message-actions]',
      '[data-trajectory-message-copy]',
      '[data-trajectory-message-chevron]',
      '[data-trajectory-role-label]',
      '[data-v4-timeline-header-slot]',
      '[data-zcode-chat-loading-slot]',
      '[data-zcode-chat-loading-animate]',
      '[data-status-todo-preview-content]'
    ].join(',');

    function skipEl(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el === host || host.contains(el)) return true;
      try { return !!el.closest(SKIP); } catch { return false; }
    }

    const CHAT_ROOT_SELECTOR = '[data-testid="chat-view"], [data-v4-timeline-message-layer]';
    const MESSAGE_MARKER =
      '[data-v4-user-input-bubble], [data-tool-call-id], [data-trajectory-message-role], [data-v4-topic-messages]';
    let chatRoot = null;
    let rootTotal = 0;

    function findChatRoot() {
      const roots = document.querySelectorAll(CHAT_ROOT_SELECTOR);
      let fallbackRoot = null;
      for (const el of roots) {
        if (!visible(el)) continue;
        if (!fallbackRoot) fallbackRoot = el;
        if (el.querySelector(MESSAGE_MARKER)) return el;
      }
      const docks = document.querySelectorAll('[data-v4-composer-dock]');
      let fallbackDockParent = null;
      for (const dock of docks) {
        if (!visible(dock)) continue;
        const parent = dock.parentElement;
        if (!parent) continue;
        if (!fallbackDockParent) fallbackDockParent = parent;
        if (parent.querySelector(MESSAGE_MARKER)) return parent;
      }
      return fallbackDockParent || fallbackRoot;
    }

    function rootTokenTotal(root) {
      let sum = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!skipEl(n.parentElement)) sum += estimateTokens(n.data);
      }
      return sum;
    }

    function ensureRoot() {
      if (chatRoot && chatRoot.isConnected && visible(chatRoot)) return true;
      chatRoot = findChatRoot();
      if (!chatRoot) return false;
      rootTotal = rootTokenTotal(chatRoot);
      return true;
    }

    function touchesRoot(node) {
      if (!chatRoot || !node) return false;
      const el = node.nodeType === 3 ? node.parentElement : node;
      if (!el || !chatRoot.contains(el)) return false;
      return !skipEl(el);
    }

    // Count growth of the whole chat root, not individual nodes: markdown
    // re-renders replace nodes, and the sidebar is outside this root.
    new MutationObserver((muts) => {
      const ready = ensureRoot();
      let dirty = false;
      let bulk = false;
      if (ready) {
        for (const m of muts) {
          if (m.type === 'characterData') {
            if (touchesRoot(m.target)) { dirty = true; break; }
            continue;
          }
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.textContent || '').length > 400) bulk = true;
            if (touchesRoot(n)) { dirty = true; break; }
          }
          if (dirty) break;
        }
      }
      if (dirty) {
        const now = rootTokenTotal(chatRoot);
        const delta = now - rootTotal;
        rootTotal = now;
        if (!bulk && delta > 0) tokens += delta;
      }
      if (!host.isConnected) placeBadge();
    }).observe(document.body, { subtree: true, childList: true, characterData: true });

    function setActive(on) {
      value.style.opacity = on ? '1' : '.62';
      dot.style.opacity = on ? '1' : '.45';
    }

    function tick() {
      const now = performance.now();
      const dt = (now - lastAt) / 1000;
      if (dt >= 0.35) {
        const counted = tokens;
        const instant = counted / dt;
        tokens = 0;
        lastAt = now;
        if (instant >= 0.05) {
          lastTextAt = now;
          statSamples++;
          statTokens += counted;
          statActiveMs += dt * 1000;
          if (instant > statMax) statMax = instant;
          if (statMin === 0 || instant < statMin) statMin = instant;
          ema = ema === 0 ? instant : ema * 0.6 + instant * 0.4;
          value.textContent = ema >= 100 ? String(Math.round(ema)) : ema.toFixed(1);
          setActive(true);
        } else if (ema > 0 && now - lastTextAt > 1800) {
          ema = 0;
          value.textContent = '\u2014';
          setActive(false);
        }
        if (tip.dataset.open === '1') updateTip();
      }
      if (++frames >= 60) {
        frames = 0;
        placeBadge();
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
