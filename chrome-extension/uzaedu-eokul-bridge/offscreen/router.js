(function () {
  const ALLOW = new Set(
    typeof UZA_DOM_REMOTE_FUNCS !== 'undefined' && Array.isArray(UZA_DOM_REMOTE_FUNCS)
      ? UZA_DOM_REMOTE_FUNCS
      : [],
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.ch !== 'UZA_OffscreenDom') return false;
    if (msg._bootstrap && typeof msg._bootstrap === 'object') {
      globalThis.UZA_BOOTSTRAP_CACHE = msg._bootstrap;
    }
    if (msg._kurumKey) {
      globalThis.UZA_ACTIVE_KURUM_KEY = String(msg._kurumKey);
    }
    if (msg.op !== 'call') {
      sendResponse({ ok: false, error: 'op' });
      return true;
    }
    const fnName = String(msg.fn || '').trim();
    if (!fnName || !ALLOW.has(fnName)) {
      sendResponse({ ok: false, error: 'fn' });
      return true;
    }
    const fn = globalThis[fnName];
    if (typeof fn !== 'function') {
      sendResponse({ ok: false, error: 'missing' });
      return true;
    }
    Promise.resolve()
      .then(() => fn(...(Array.isArray(msg.args) ? msg.args : [])))
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  });
})();
