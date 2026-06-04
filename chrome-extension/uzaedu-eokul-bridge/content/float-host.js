(function uzaFloatHost() {
  if (window.top !== window.self) return;

  const HOST_ID = 'uza-float-host-root';
  const FLOAT_BUILD = '13';
  const OPEN_CLASS = 'is-open';
  const FAB_POS_KEY = 'uzaFloatFabPos';
  const FAB_SIZE = 50;
  const DRAG_THRESHOLD = 6;
  let memFabPos = null;
  let tornDown = false;

  function extAlive() {
    if (tornDown) return false;
    try {
      return Boolean(chrome.runtime?.id && chrome.runtime.getURL('manifest.json'));
    } catch {
      return false;
    }
  }

  function extInvalidated(err) {
    const m = String(err?.message || err || '');
    return /extension context invalidated|context invalidated/i.test(m);
  }

  function teardownHost() {
    if (tornDown) return;
    tornDown = true;
    try {
      document.getElementById(HOST_ID)?.remove();
    } catch {
      /* */
    }
  }

  const existing = document.getElementById(HOST_ID);
  if (!extAlive()) {
    existing?.remove();
    return;
  }
  if (existing?.getAttribute('data-uza-build') === FLOAT_BUILD) return;
  existing?.remove();

  async function safeSend(msg) {
    if (!extAlive()) return null;
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (extInvalidated(e)) teardownHost();
      return null;
    }
  }

  function extUrl(path) {
    try {
      if (!extAlive()) return '';
      return chrome.runtime.getURL(path);
    } catch (e) {
      if (extInvalidated(e)) teardownHost();
      return '';
    }
  }

  async function storageLocalGet(keys) {
    const r = await safeSend({ type: 'UZA_FLOAT_STORAGE_GET', keys });
    if (r?.ok && r.data) return r.data;
    return memFallback(keys);
  }

  function memFallback(keys) {
    const out = {};
    if (Array.isArray(keys) && memFabPos && keys.includes(FAB_POS_KEY)) {
      out[FAB_POS_KEY] = memFabPos;
    }
    return out;
  }

  async function storageLocalSet(data) {
    if (!extAlive()) {
      if (data?.[FAB_POS_KEY]) memFabPos = data[FAB_POS_KEY];
      return;
    }
    const r = await safeSend({ type: 'UZA_FLOAT_STORAGE_SET', data });
    if (!r?.ok && data?.[FAB_POS_KEY]) memFabPos = data[FAB_POS_KEY];
  }

  async function storageSessionGet(keys) {
    const r = await safeSend({ type: 'UZA_FLOAT_SESSION_GET', keys });
    if (r?.ok && r.data) return r.data;
    return {};
  }

  const cssHref = extUrl('content/float-host.css');
  const icon48 = extUrl('assets/icon48.png');
  const icon32 = extUrl('assets/icon32.png');
  if (!cssHref || !icon48) return;

  const root = document.createElement('div');
  root.id = HOST_ID;
  root.setAttribute('data-uza-build', FLOAT_BUILD);
  const shadow = root.attachShadow({ mode: 'closed' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;

  const wrap = document.createElement('div');
  wrap.className = 'uza-float-host';

  wrap.innerHTML = `
    <div class="uza-float-backdrop" data-uza-close aria-hidden="true"></div>
    <button type="button" class="uza-float-fab" id="uzaFab" title="Sürükleyerek taşıyın · tıklayarak paneli açın">
      <span class="uza-float-fab__ring" aria-hidden="true"></span>
      <span class="uza-float-fab__logo">
        <img src="${icon48}" alt="" width="42" height="42" />
      </span>
    </button>
    <div class="uza-float-panel" id="uzaPanel" role="dialog" aria-label="Uzaedu Okul Köprüsü">
      <div class="uza-float-panel__bar">
        <div class="uza-float-panel__brand">
          <img src="${icon32}" alt="" width="28" height="28" />
          <span>Uzaedu Okul Köprüsü</span>
        </div>
        <div class="uza-float-panel__actions">
          <button type="button" class="uza-float-panel__btn" id="uzaMin" title="Küçült">−</button>
          <button type="button" class="uza-float-panel__btn" id="uzaClose" title="Kapat">×</button>
        </div>
      </div>
      <div class="uza-float-panel__frame-wrap">
        <iframe class="uza-float-panel__frame" id="uzaFrame" title="Köprü paneli"></iframe>
      </div>
    </div>
  `;

  shadow.appendChild(link);
  shadow.appendChild(wrap);
  document.documentElement.appendChild(root);

  const fab = shadow.getElementById('uzaFab');
  const panel = shadow.getElementById('uzaPanel');
  const frame = shadow.getElementById('uzaFrame');
  const hostEl = wrap;

  const RELOAD_HINT =
    '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>body{font:13px system-ui,sans-serif;margin:0;padding:16px;color:#0f172a;line-height:1.5}p{margin:0}</style></head><body><p><strong>Eklenti güncellendi.</strong></p><p>Sayfayı yenileyin (F5), ardından köprüyü tekrar açın.</p></body></html>';

  function showReloadHint() {
    if (!frame) return;
    frame.removeAttribute('src');
    frame.srcdoc = RELOAD_HINT;
  }

  function embedQ(path) {
    const base = extUrl(path);
    if (!base) return '';
    return base + (base.includes('?') ? '&' : '?') + 'embed=1';
  }

  async function frameUrl() {
    if (!extAlive()) return '';
    const st = await storageSessionGet(['uzaGatePayload']);
    if (!extAlive()) return '';
    return st.uzaGatePayload ? embedQ('app/app.html') : embedQ('gate/gate.html');
  }

  async function loadFrame() {
    if (!frame || tornDown) return;
    if (!extAlive()) {
      showReloadHint();
      return;
    }
    try {
      const url = await frameUrl();
      if (!url) {
        showReloadHint();
        return;
      }
      frame.removeAttribute('srcdoc');
      frame.src = url;
    } catch (e) {
      if (extInvalidated(e)) teardownHost();
      else showReloadHint();
    }
  }

  function openPanel() {
    if (tornDown || !extAlive()) {
      showReloadHint();
      return;
    }
    hostEl.classList.add(OPEN_CLASS);
    panel.classList.add(OPEN_CLASS);
    fab.classList.add(OPEN_CLASS);
    void loadFrame().catch(() => showReloadHint());
  }

  function closePanel() {
    hostEl.classList.remove(OPEN_CLASS);
    panel.classList.remove(OPEN_CLASS);
    fab.classList.remove(OPEN_CLASS);
  }

  function togglePanel() {
    if (panel.classList.contains(OPEN_CLASS)) closePanel();
    else openPanel();
  }

  function defaultFabPosition() {
    const pad = 14;
    return clampFabPos(window.innerWidth - FAB_SIZE - pad, 10);
  }

  function clampFabPos(left, top) {
    const pad = 8;
    const maxL = Math.max(pad, window.innerWidth - FAB_SIZE - pad);
    const maxT = Math.max(pad, window.innerHeight - FAB_SIZE - pad);
    return {
      left: Math.min(maxL, Math.max(pad, left)),
      top: Math.min(maxT, Math.max(pad, top)),
    };
  }

  function applyFabPosition(pos) {
    const p =
      pos && typeof pos.left === 'number' && typeof pos.top === 'number'
        ? clampFabPos(pos.left, pos.top)
        : defaultFabPosition();
    fab.style.left = `${p.left}px`;
    fab.style.top = `${p.top}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }

  function saveFabPosition(pos) {
    memFabPos = pos;
    void storageLocalSet({ [FAB_POS_KEY]: pos });
  }

  let fabDrag = null;

  fab.addEventListener('pointerdown', (e) => {
    if (!extAlive()) {
      teardownHost();
      return;
    }
    if (e.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    fabDrag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    fab.setPointerCapture(e.pointerId);
    fab.classList.add('is-dragging');
    e.preventDefault();
  });

  fab.addEventListener('pointermove', (e) => {
    if (!fabDrag || e.pointerId !== fabDrag.pointerId) return;
    const dx = e.clientX - fabDrag.startX;
    const dy = e.clientY - fabDrag.startY;
    if (!fabDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    fabDrag.moved = true;
    const p = clampFabPos(fabDrag.originLeft + dx, fabDrag.originTop + dy);
    fab.style.left = `${p.left}px`;
    fab.style.top = `${p.top}px`;
    fab.style.right = 'auto';
  });

  function endFabDrag(e) {
    if (!fabDrag || e.pointerId !== fabDrag.pointerId) return;
    try {
      fab.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    fab.classList.remove('is-dragging');
    if (fabDrag.moved) {
      const rect = fab.getBoundingClientRect();
      saveFabPosition({ left: rect.left, top: rect.top });
    } else {
      togglePanel();
    }
    fabDrag = null;
  }

  fab.addEventListener('pointerup', endFabDrag);
  fab.addEventListener('pointercancel', endFabDrag);

  window.addEventListener(
    'resize',
    () => {
      if (tornDown || !extAlive()) return;
      const rect = fab.getBoundingClientRect();
      applyFabPosition({ left: rect.left, top: rect.top });
    },
    { passive: true },
  );

  void storageLocalGet([FAB_POS_KEY])
    .then((st) => {
      if (!tornDown) applyFabPosition(st[FAB_POS_KEY] || memFabPos);
    })
    .catch(() => {
      if (!tornDown) applyFabPosition(memFabPos);
    });

  shadow.getElementById('uzaClose')?.addEventListener('click', closePanel);
  shadow.getElementById('uzaMin')?.addEventListener('click', closePanel);
  shadow.querySelector('[data-uza-close]')?.addEventListener('click', closePanel);

  window.addEventListener('message', (ev) => {
    if (ev.data?.source !== 'uzaedu-bridge') return;
    if (ev.data.type === 'UZA_FLOAT_CLOSE') closePanel();
    if (ev.data.type === 'UZA_FLOAT_RELOAD') void loadFrame().catch(() => showReloadHint());
    if (ev.data.type === 'UZA_FLOAT_OPEN') openPanel();
  });

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      try {
        if (msg?.type === 'UZA_FLOAT_TEARDOWN') {
          teardownHost();
          sendResponse?.({ ok: true });
          return true;
        }
        if (!extAlive()) {
          teardownHost();
          sendResponse?.({ ok: false, error: 'context_invalidated' });
          return true;
        }
        if (msg?.type === 'UZA_FLOAT_TOGGLE') {
          togglePanel();
          sendResponse({ ok: true, open: panel.classList.contains(OPEN_CLASS) });
          return true;
        }
        if (msg?.type === 'UZA_FLOAT_OPEN') {
          openPanel();
          sendResponse({ ok: true, open: true });
          return true;
        }
        if (msg?.type === 'UZA_FLOAT_CLOSE') {
          closePanel();
          sendResponse({ ok: true, open: false });
          return true;
        }
      } catch (e) {
        if (extInvalidated(e)) teardownHost();
      }
      return false;
    });
  } catch {
    /* */
  }

  void storageSessionGet(['uzaGatePayload'])
    .then((st) => {
      if (!tornDown && st.uzaGatePayload) fab.classList.add('uza-float-fab--ready');
    })
    .catch(() => {
      /* */
    });
})();
