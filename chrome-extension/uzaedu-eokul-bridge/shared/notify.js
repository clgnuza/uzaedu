/**
 * Durum / hata / başarı mesajları — modern bildirim kutusu.
 */
var UZA_NOTIFY = (function () {
  var SELECTOR = '.gate-message, .bordro-status, .uza-status, #gateMessage, .message.gate-message';

  var LOADING_RE =
    /yüklen|okunuyor|taranıyor|ayrıştırıl|oluşturul|kaydediliyor|karşılaştırıl|kontrol|bekleyin|…|\.\.\./i;
  var SUCCESS_RE =
    /tamam|başarı|kaydedildi|güncellendi|indirildi|alıcı|açıldı|oluşturuldu|tamamlandı|yeni,|satır kaydedildi/i;
  var ERROR_RE =
    /başarısız|hata|gerekli|bulunamadı|yok\.|yok,|devre dışı|güncel değil|kurulamadı|seçin|geçersiz|oturum|sekme yok/i;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconFor(tone) {
    if (typeof UZA_ICON === 'undefined') return '';
    var map = { error: 'alert', success: 'check', warn: 'warn', info: 'info', loading: 'loader' };
    return UZA_ICON.svg(map[tone] || 'info', 20);
  }

  function inferTone(msg, el) {
    if (el) {
      if (el.classList.contains('error')) return 'error';
      if (el.classList.contains('success')) return 'success';
    }
    var t = (msg || '').trim();
    if (!t) return '';
    if (LOADING_RE.test(t)) return 'loading';
    if (ERROR_RE.test(t)) return 'error';
    if (SUCCESS_RE.test(t)) return 'success';
    return 'info';
  }

  function show(el, message, tone) {
    if (!el) return;
    var msg = (message ?? '').toString().trim();
    var t = tone || inferTone(msg, el);

    el.classList.add('uza-notice');
    el.classList.remove('error', 'success', 'warn', 'info', 'loading', 'is-empty');

    if (!msg) {
      el.classList.add('is-empty');
      el.hidden = true;
      el.innerHTML = '';
      el.removeAttribute('role');
      return;
    }

    el.hidden = false;
    if (t) el.classList.add(t);
    if (t === 'error') el.setAttribute('role', 'alert');
    else el.setAttribute('role', 'status');

    el.innerHTML =
      '<span class="uza-notice__icon">' +
      iconFor(t) +
      '</span><span class="uza-notice__text">' +
      escapeHtml(msg) +
      '</span>';
  }

  function bind(el) {
    if (!el || el.__uzaNotifyBound) return el;
    el.__uzaNotifyBound = true;
    el.classList.add('uza-notice', 'is-empty');
    el.hidden = true;

    var _msg = '';
    var _tone = '';

    el.uzaNotify = function (msg, tone) {
      _msg = (msg ?? '').toString();
      _tone = tone || '';
      show(el, _msg, _tone);
    };

    try {
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get: function () {
          return el.querySelector('.uza-notice__text')?.textContent ?? _msg;
        },
        set: function (v) {
          _msg = (v ?? '').toString();
          var tone = _tone;
          if (el.classList.contains('error')) tone = 'error';
          else if (el.classList.contains('success')) tone = 'success';
          else if (!_tone) tone = inferTone(_msg, el);
          show(el, _msg, tone);
        },
      });
    } catch {
      /* eski tarayıcı */
    }

    return el;
  }

  function bindAll(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(bind);
  }

  return { show: show, bind: bind, bindAll: bindAll, inferTone: inferTone };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    UZA_NOTIFY.bindAll();
  });
} else {
  UZA_NOTIFY.bindAll();
}
