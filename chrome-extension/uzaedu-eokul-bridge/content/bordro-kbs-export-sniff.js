/** KBS maaş / ek ders rapor — fetch/XHR Excel yanıtını köprüye iletir (MAIN world). */
(function () {
  const href = location.pathname + location.href;
  const isMaas = /maasrapor/i.test(href);
  const isEkRapor = /yeniakademik|p_yenirapor|yenirapor/i.test(href);
  if (!isMaas && !isEkRapor) return;

  const defaultName = isMaas ? 'maas_bordro.xlsx' : 'ek_ders_bordro.xlsx';

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function filenameFrom(res, url) {
    const cd = res.headers?.get?.('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
    if (m) return decodeURIComponent(m[1].trim());
    const u = String(url || '');
    if (/\.xls/i.test(u)) return u.split('/').pop() || defaultName;
    return defaultName;
  }

  function emit(buf, res, url) {
    if (!buf || buf.byteLength < 64) return;
    window.postMessage(
      {
        type: 'UZA_BORDRO_EXCEL_CAPTURE',
        fileBase64: bufToB64(buf),
        filename: filenameFrom(res, url),
        contentType: res.headers?.get?.('content-type') || '',
        source: 'kbs',
        url: String(url || location.href),
      },
      '*',
    );
  }

  function maybeCapture(res, url) {
    const ct = res.headers?.get?.('content-type') || '';
    if (!/sheet|excel|spreadsheet|octet-stream|ms-excel|vnd\.ms/i.test(ct)) return;
    res
      .clone()
      .arrayBuffer()
      .then((buf) => emit(buf, res, url))
      .catch(() => {});
  }

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      return origFetch.apply(this, args).then((res) => {
        maybeCapture(res, url);
        return res;
      });
    };
  }

  const xOpen = XMLHttpRequest.prototype.open;
  const xSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__uzaBordroUrl = url;
    return xOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const ct = this.getResponseHeader('content-type') || '';
        if (!/sheet|excel|spreadsheet|octet-stream|ms-excel/i.test(ct)) return;
        const buf = this.response;
        if (!buf || buf.byteLength < 64) return;
        emit(buf, { headers: { get: (k) => (k === 'content-type' ? ct : '') } }, this.__uzaBordroUrl);
      } catch {
        /* */
      }
    });
    return xSend.apply(this, args);
  };
})();
