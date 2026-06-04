(function () {
  if (globalThis.__UZA_PANEL_BRIDGE__) return;
  globalThis.__UZA_PANEL_BRIDGE__ = true;

  const COOKIE_SESSION = '__cookie_session__';

  function devPanelBeApi(origin) {
    try {
      const u = new URL(origin || location.origin);
      const h = u.hostname.toLowerCase();
      const dev =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '0.0.0.0' ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h);
      if (dev && (u.port === '3000' || (u.port === '' && h === 'localhost'))) {
        return `${u.origin.replace(/\/+$/, '')}/be-api`;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function apiBaseFromMsg(msg) {
    if (typeof uzaResolvePanelApiBase === 'function') {
      return uzaResolvePanelApiBase(msg);
    }
    const fromTab =
      typeof uzaPanelBrowserApiBaseFromTabUrl === 'function'
        ? uzaPanelBrowserApiBaseFromTabUrl(msg?.tabUrl || location.href, msg)
        : null;
    if (fromTab) return fromTab;
    const dev = devPanelBeApi(location.origin);
    if (dev) return dev;
    return typeof msg?.apiBase === 'string' && msg.apiBase.startsWith('http')
      ? msg.apiBase.replace(/\/+$/, '')
      : 'http://127.0.0.1:4000/api';
  }

  function readBearer(msg) {
    const fromMsg = msg?.pageBearer;
    if (fromMsg && fromMsg !== COOKIE_SESSION) return String(fromMsg);
    try {
      const b = sessionStorage.getItem('ogp_bearer') || localStorage.getItem('ogretmenpro_token') || '';
      if (!b || b === COOKIE_SESSION) return '';
      return b;
    } catch {
      return '';
    }
  }

  function authHeaders(extra, msg) {
    const headers = { Accept: 'application/json', ...(extra || {}) };
    const bearer = readBearer(msg);
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  }

  async function panelFetch(path, msg, opts) {
    const apiBase = apiBaseFromMsg(msg);
    const method = opts?.method || 'GET';
    const headers = authHeaders(
      opts?.json ? { 'Content-Type': 'application/json' } : undefined,
      msg,
    );
    const res = await fetch(`${apiBase}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { res, data, apiBase };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'UZA_PANEL_BRIDGE_PING') {
      sendResponse({
        ok: true,
        href: location.href,
        apiBase: apiBaseFromMsg(msg),
        hasBearer: !!readBearer(msg),
      });
      return true;
    }
    if (msg?.type === 'UZA_PANEL_BRIDGE_DIAG') {
      (async () => {
        try {
          const apiBase = apiBaseFromMsg(msg);
          const { res, data } = await panelFetch('/me', msg);
          sendResponse({
            ok: true,
            href: location.href,
            apiBase,
            hasBearer: !!readBearer(msg),
            meStatus: res.status,
            meOk: !!data?.id,
            schoolName: data?.school?.name || data?.school_name || null,
          });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e), href: location.href });
        }
      })();
      return true;
    }
    if (msg?.type === 'UZA_READ_PANEL_AUTH') {
      (async () => {
        try {
          const { res, data, apiBase } = await panelFetch('/me', msg);
          if (!data?.id) {
            sendResponse({
              ok: false,
              error:
                res.status === 401
                  ? 'Panele giriş yapılmamış.'
                  : `Panel oturumu okunamadı (${apiBase}/me → boş). Aynı sekmede panele tekrar giriş yapıp F5 yapın.`,
              apiBase,
              meStatus: res.status,
            });
            return;
          }
          sendResponse({
            ok: true,
            bearer: readBearer(msg) || null,
            me: data,
            tabUrl: location.href,
            apiBase,
          });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }
    if (msg?.type === 'UZA_FETCH_BOOTSTRAP') {
      (async () => {
        try {
          const { res, data, apiBase } = await panelFetch('/eokul-bridge/v1/bootstrap', msg);
          if (!res.ok) {
            sendResponse({ ok: false, error: data?.message || 'Bootstrap alınamadı' });
            return;
          }
          sendResponse({ ok: true, bootstrap: data, bearer: readBearer() || null, apiBase });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }
    if (msg?.type === 'UZA_FETCH_SCHOOL_ACCESS') {
      (async () => {
        try {
          const { res, data, apiBase } = await panelFetch('/eokul-bridge/v1/school-access', msg);
          if (!res.ok) {
            const m = data?.message;
            sendResponse({
              ok: false,
              error:
                typeof m === 'string' ? m : Array.isArray(m) ? m.join(' ') : 'Okul lisansı alınamadı',
              apiBase,
            });
            return;
          }
          sendResponse({ ok: true, access: data, bearer: readBearer() || null, apiBase });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }
    if (msg?.type === 'UZA_VERIFY_SCHOOL_ACCESS') {
      (async () => {
        try {
          const { res, data, apiBase } = await panelFetch('/eokul-bridge/v1/school-access/verify', msg, {
            method: 'POST',
            json: true,
            body: { code: String(msg.code || '').trim() },
          });
          if (!res.ok) {
            const m = data?.message;
            sendResponse({
              ok: false,
              error: typeof m === 'string' ? m : Array.isArray(m) ? m.join(' ') : 'Kod doğrulanamadı',
            });
            return;
          }
          sendResponse({ ok: true, access: data, bearer: readBearer() || null, apiBase });
        } catch (e) {
          sendResponse({ ok: false, error: e?.message || String(e) });
        }
      })();
      return true;
    }
    return false;
  });

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.data?.type !== 'UZA_REQUEST_MEKTUP_PREFILL') return;
    chrome.runtime.sendMessage({ type: 'UZA_GET_MEKTUP_PREFILL' }, (res) => {
      if (chrome.runtime.lastError) return;
      window.postMessage(
        { type: 'UZA_MEKTUP_PREFILL', recipients: res?.recipients ?? null },
        '*',
      );
    });
  });
})();
