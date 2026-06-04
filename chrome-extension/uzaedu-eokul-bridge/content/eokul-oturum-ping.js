chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type !== 'UZA_EOKUL_PING') return;
  fetch(location.href, { credentials: 'include', cache: 'no-store', method: 'GET' }).catch(() => {});
  sendResponse({ ok: true });
  return true;
});
