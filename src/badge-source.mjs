// Self-contained badge script. Serialized with toString() and injected into the
// preload (sandboxed). Keep it dependency-free.
//
// The number comes from the same `session/debug` snapshot the Developer Tools
// panel shows (src/event-source.mjs): each completed main-turn request carries
// provider usage and tokensPerSecond = outputTokens ÷ generation time. There is
// no character estimation and no per-second sampling; the badge shows the last
// completed round, and a dot pulse while a new request is generating.

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
    tipTitle.textContent = '本轮 / 会话 · 开发者工具同源';
    tip.append(tipTitle);
    const tipValues = {};
    for (const [key, label] of [
      ['tps', '本轮速度'],
      ['avg', '平均速度'],
      ['max', '最高速度'],
      ['min', '最低速度'],
      ['output', '输出'],
      ['reasoning', '思考'],
      ['input', '输入'],
      ['cache', '缓存命中'],
      ['duration', '生成耗时'],
      ['requests', '会话请求'],
      ['inputTotal', '累计输入'],
      ['cacheTotal', '累计命中'],
      ['status', '状态']
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
        '#zcode-tps-badge[data-running="1"] .zcode-tps-dot{animation:zcode-tps-pulse 1.2s ease-in-out infinite}',
        '@keyframes zcode-tps-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
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

    // ------------------------------------------------------------------
    // Data source: the same `session/debug` snapshot the Developer Tools
    // panel shows (src/event-source.mjs). Every completed main-turn request
    // carries provider usage and `tokensPerSecond`; the badge never estimates
    // tokens from characters. Reasoning tokens are part of the provider's
    // output usage, so folded thinking still contributes here.
    // ------------------------------------------------------------------
    let lastRound = null;
    let lastRoundPlausible = true;
    let cache = null;
    let stats = null;
    let roundCount = 0;
    let sessionId = '';
    let lastActivityAt = 0;
    let generating = false;
    let error = '';
    let gotSnapshot = false;
    let frames = 0;

    function fmtSpeed(n) {
      if (typeof n !== 'number' || !isFinite(n) || n < 0) return '\u2014';
      return n >= 100 ? String(Math.round(n)) : n.toFixed(1);
    }

    // The panel formats TPS with maximumFractionDigits: 1; the hover card
    // matches it exactly so the two numbers can be compared without rounding.
    function fmtSpeedExact(n) {
      return typeof n === 'number' && isFinite(n) && n >= 0 ? n.toFixed(1) : '\u2014';
    }

    function fmtInt(n) {
      return typeof n === 'number' && isFinite(n) ? Math.round(n).toLocaleString('zh-CN') : '\u2014';
    }

    function fmtDuration(ms) {
      return typeof ms === 'number' && isFinite(ms) && ms > 0 ? (ms / 1000).toFixed(1) + ' s' : '\u2014';
    }

    function updateBadge() {
      const tps = lastRound && lastRoundPlausible && typeof lastRound.tokensPerSecond === 'number'
        ? lastRound.tokensPerSecond
        : null;
      value.textContent = tps === null ? '\u2014' : fmtSpeed(tps);
      value.style.opacity = tps === null || error ? '.62' : '1';
      host.dataset.running = generating ? '1' : '';
      dot.style.opacity = generating ? '1' : '.45';
    }

    function updateTip() {
      const round = lastRound;
      const usage = round && round.usage && typeof round.usage === 'object' ? round.usage : {};
      tipValues.tps.textContent = round && lastRoundPlausible && typeof round.tokensPerSecond === 'number'
        ? fmtSpeedExact(round.tokensPerSecond) + ' tok/s'
        : '\u2014';
      tipValues.avg.textContent = stats ? fmtSpeedExact(stats.avg) + ' tok/s' : '\u2014';
      tipValues.max.textContent = stats ? fmtSpeedExact(stats.max) + ' tok/s' : '\u2014';
      tipValues.min.textContent = stats ? fmtSpeedExact(stats.min) + ' tok/s' : '\u2014';
      tipValues.output.textContent = fmtInt(usage.outputTokens);
      tipValues.reasoning.textContent = fmtInt(usage.reasoningTokens);
      tipValues.input.textContent = fmtInt(usage.inputTokens);
      tipValues.cache.textContent = fmtInt(usage.cachedInputTokens);
      tipValues.duration.textContent = fmtDuration(round && round.generationDurationMs);
      tipValues.requests.textContent = cache && typeof cache.hitRateRequestCount === 'number'
        ? fmtInt(cache.hitRateRequestCount)
        : fmtInt(roundCount);
      tipValues.inputTotal.textContent = cache ? fmtInt(cache.totalInputTokens) : '\u2014';
      tipValues.cacheTotal.textContent = cache ? fmtInt(cache.totalCacheReadTokens) : '\u2014';
      tipValues.status.textContent = error
        ? '\u6570\u636e\u6e90\u4e0d\u53ef\u7528'
        : round && !lastRoundPlausible
          ? '\u672c\u8f6e TPS \u5f02\u5e38\uff08\u5df2\u8df3\u8fc7\uff09'
          : generating
            ? '\u751f\u6210\u4e2d\uff08\u663e\u793a\u4e0a\u4e00\u8f6e\uff09'
            : round
              ? '\u7a7a\u95f2'
              : '\u7b49\u5f85\u9996\u4e2a\u8bf7\u6c42';
    }

    // The tap lives in the main world and posts JSON strings across the
    // isolation boundary. Snapshots carry only the last round and session
    // totals — never text, headers or request messages.
    window.addEventListener('message', (e) => {
      let d = e.data;
      if (typeof d === 'string') {
        try { d = JSON.parse(d); } catch { return; }
      }
      if (!d || d.src !== 'zcode-tps-debug') return;

      if (d.kind === 'activity') {
        lastActivityAt = performance.now();
        generating = true;
        updateBadge();
        if (tip.dataset.open === '1') updateTip();
        return;
      }

      if (d.kind === 'error') {
        error = typeof d.message === 'string' && d.message ? d.message : 'debug data unavailable';
        generating = false;
        updateBadge();
        if (tip.dataset.open === '1') updateTip();
        return;
      }

      if (d.kind !== 'snapshot') return;

      gotSnapshot = true;
      error = '';
      if (typeof d.sessionId === 'string' && d.sessionId && d.sessionId !== sessionId) {
        sessionId = d.sessionId;
        lastRound = null;
        lastRoundPlausible = true;
        cache = null;
        stats = null;
        roundCount = 0;
      }
      lastRound = d.round && typeof d.round === 'object' ? d.round : null;
      lastRoundPlausible = d.plausible !== false;
      cache = d.cache && typeof d.cache === 'object' ? d.cache : null;
      stats = d.stats && typeof d.stats === 'object' ? d.stats : null;
      if (typeof d.count === 'number') {
        // A new completed round means the previous request finished; the next
        // activity delta flips this back to generating.
        if (d.count > roundCount) generating = false;
        roundCount = d.count;
      }
      updateBadge();
      if (tip.dataset.open === '1') updateTip();
    });

    // If the tap failed to install (or the RPC shape changed), say so on
    // hover instead of showing a silent dash forever.
    setTimeout(() => {
      if (!gotSnapshot && !error) {
        error = '\u672a\u6536\u5230\u8c03\u8bd5\u6570\u636e';
        try { console.warn('[zcode-tps] no session/debug snapshot after 12s'); } catch {}
        updateBadge();
      }
    }, 12000);

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

    function tick() {
      const now = performance.now();
      // Activity covers the gap between "request started generating" and the
      // next completed round. It drives the dot only; the number always stays
      // the last completed request's TPS.
      if (generating && now - lastActivityAt > 2000) {
        generating = false;
        updateBadge();
      }
      if (++frames >= 60) {
        frames = 0;
        placeBadge();
      }
      requestAnimationFrame(tick);
    }
    updateBadge();
    requestAnimationFrame(tick);
  }

  // --- main-world debug tap bridge --------------------------------------
  // The preload is sandboxed and isolated; the app's MessagePort traffic
  // lives in the main world. webFrame.executeJavaScript runs the tap there.
  // The tap polls the host for session debug data and reports snapshots via
  // window.postMessage, which crosses worlds.
  // patch.mjs binds `__tpsEventTapSource` to the *function*, so it must be
  // serialized and invoked here; a bare function source is only a declaration
  // and would install nothing. (0.2.0-0.2.2 shipped that bug: the event path
  // never ran and only the DOM fallback counted.)
  function installTap() {
    try {
      let tap = null;
      if (typeof __tpsEventTapSource === 'function') {
        tap = '(' + __tpsEventTapSource.toString() + ')()';
      } else if (typeof __tpsEventTapSource === 'string') {
        tap = __tpsEventTapSource;
      } else if (typeof eventTapSource === 'function') {
        tap = '(' + eventTapSource.toString() + ')()';
      }
      if (!tap) return;
      const { webFrame } = require('electron');
      webFrame.executeJavaScript(tap, false).catch(() => {});
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  installTap();
}
