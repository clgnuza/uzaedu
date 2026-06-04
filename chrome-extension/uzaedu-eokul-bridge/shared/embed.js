/** Gömülü panel (sayfa üstü iframe) modu */
(function uzaEmbedBoot() {
  var params = new URLSearchParams(location.search);
  var embed = params.has('embed') || window.parent !== window;
  if (!embed) return;
  document.documentElement.classList.add('uza-embed-root');
  if (document.body) document.body.classList.add('uza-embed');
  else document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('uza-embed');
  });

  window.UZA_EMBED = true;
  window.uzaExtUrl = function (path) {
    var u = chrome.runtime.getURL(path);
    if (!window.UZA_EMBED) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'embed=1';
  };

  window.uzaFloatPost = function (payload) {
    try {
      window.parent.postMessage(Object.assign({ source: 'uzaedu-bridge' }, payload), '*');
    } catch {
      /* */
    }
  };
})();
