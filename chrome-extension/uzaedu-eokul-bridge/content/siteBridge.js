(function () {
  const FALLBACK_API = 'http://127.0.0.1:4000/api';

  function apiBaseFromMsg(msg) {
    return typeof msg.apiBase === 'string' && msg.apiBase.startsWith('http')
      ? msg.apiBase.replace(/\/+$/, '')
      : FALLBACK_API;
  }

  function authHeaders(bearer) {
    const headers = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'UZA_READ_PANEL_AUTH') {
      (async () => {
        try {
          const apiBase = apiBaseFromMsg(msg);
          const bearer = sessionStorage.getItem('ogp_bearer') || '';
          const res = await fetch(`${apiBase}/me`, {
            method: 'GET',
            credentials: 'include',
            headers: authHeaders(bearer),
          });
          const me = res.ok ? await res.json().catch(() => null) : null;
          sendResponse({
            ok: !!me?.id,
            bearer: bearer || null,
            me,
            tabUrl: location.href,
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
          const apiBase = apiBaseFromMsg(msg);
          const bearer = sessionStorage.getItem('ogp_bearer') || '';
          const res = await fetch(`${apiBase}/eokul-bridge/v1/bootstrap`, {
            method: 'GET',
            credentials: 'include',
            headers: authHeaders(bearer),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            sendResponse({ ok: false, error: data?.message || 'Bootstrap alınamadı' });
            return;
          }
          sendResponse({ ok: true, bootstrap: data, bearer: bearer || null });
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
