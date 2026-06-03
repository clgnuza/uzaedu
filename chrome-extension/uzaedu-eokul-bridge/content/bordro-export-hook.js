/** PersonelNet/MaliNet «Excele Aktar» — aynı oturumla dosyayı köprüye iletir. */

function uzaNorm(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uzaIsExportControl(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  const text = uzaNorm(el.textContent || el.value || el.title || el.getAttribute('aria-label'));
  const href = uzaNorm(el.getAttribute?.('href') || '');
  const onclick = uzaNorm(el.getAttribute?.('onclick') || '');
  const blob = /excel|xls|aktar|dışa|export|indir/.test(text + ' ' + href + ' ' + onclick);
  if (!blob) return false;
  if (tag === 'a' || tag === 'button' || tag === 'input') return true;
  return el.closest?.('a, button, [role="button"]');
}

function uzaBufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function uzaFetchExportUrl(url) {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const buf = await res.arrayBuffer();
  let filename = 'bordro.xlsx';
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
  if (m) filename = decodeURIComponent(m[1].trim());
  else if (/\.xls/i.test(url)) filename = url.split('/').pop() || filename;
  const source = /muhasebat|kbs/i.test(location.hostname) ? 'kbs' : 'mebbis';
  return {
    ok: true,
    fileBase64: uzaBufToBase64(buf),
    filename,
    contentType: ct,
    source,
    url: res.url,
  };
}

document.addEventListener(
  'click',
  (ev) => {
    const el = ev.target.closest?.('a, button, input[type="button"], input[type="submit"], [role="button"]');
    if (!uzaIsExportControl(el)) return;
    const href = el.getAttribute?.('href');
    if (href && href !== '#' && !/^javascript:/i.test(href)) {
      ev.preventDefault();
      ev.stopPropagation();
      chrome.runtime
        .sendMessage({ type: 'UZA_BORDRO_CAPTURE_URL', url: new URL(href, location.href).href })
        .then((r) => {
          if (r?.ok) {
            chrome.runtime.sendMessage({
              type: 'UZA_BORDRO_EXCEL_STORED',
              notify: true,
              label: r.filename,
            });
          }
        })
        .catch(() => {});
      return;
    }
    chrome.runtime.sendMessage({ type: 'UZA_BORDRO_EXPORT_CLICKED', pageUrl: location.href });
  },
  true,
);

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === 'UZA_BORDRO_FETCH_EXPORT') {
    uzaFetchExportUrl(msg.url)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
  if (msg?.type === 'UZA_BORDRO_PING') {
    fetch(location.href, { credentials: 'include', cache: 'no-store', method: 'GET' }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});
