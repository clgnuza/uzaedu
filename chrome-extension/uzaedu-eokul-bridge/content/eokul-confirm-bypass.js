(function () {
  if (!/meb\.gov\.tr/i.test(location.hostname)) return;
  chrome.storage.local.get(['uzaEokulAutoConfirm'], (st) => {
    if (!st?.uzaEokulAutoConfirm) return;
    const orig = window.confirm;
    window.confirm = function (msg) {
      console.log('[Uzaedu köprü] confirm → true:', msg);
      return true;
    };
    const origAlert = window.alert;
    window.alert = function (msg) {
      console.log('[Uzaedu köprü] alert:', msg);
    };
    window.__uzaConfirmBypass = true;
  });
})();
