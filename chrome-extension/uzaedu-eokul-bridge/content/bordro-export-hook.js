/** MEBBİS/KBS «Excele Aktar» / maaş raporu indirme — köprüye iletir. */

function uzaParseDoPostBackJs(hrefOrOnclick) {
  const s = String(hrefOrOnclick || '');
  const m = s.match(/__doPostBack\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/i);
  if (!m) return null;
  return { target: m[1], arg: m[2] ?? '' };
}

function uzaDoPostBack(eventTarget, eventArgument) {
  const target = String(eventTarget || '');
  const arg = eventArgument ?? '';
  if (typeof globalThis.__doPostBack === 'function') {
    globalThis.__doPostBack(target, arg);
    return true;
  }
  const form = document.forms[0] || document.querySelector('form');
  if (!form) return false;
  let et = form.querySelector('input[name="__EVENTTARGET"]');
  if (!et) {
    et = document.createElement('input');
    et.type = 'hidden';
    et.name = '__EVENTTARGET';
    form.appendChild(et);
  }
  let ea = form.querySelector('input[name="__EVENTARGUMENT"]');
  if (!ea) {
    ea = document.createElement('input');
    ea.type = 'hidden';
    ea.name = '__EVENTARGUMENT';
    form.appendChild(ea);
  }
  et.value = target;
  ea.value = arg;
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.submit();
  return true;
}

function uzaMebbisPuantajFormPage() {
  return /\/EKD\/ekd04002\.aspx/i.test(location.pathname + location.href);
}

function uzaIsMebbisRaporViewControl(el) {
  if (!el) return false;
  const id = uzaNorm(el.id || el.name || '');
  const text = uzaNorm(el.textContent || el.value || el.title || '');
  const href = String(el.getAttribute?.('href') || '');
  if (/btnraporgoruntule|raporgoruntule/.test(id)) return true;
  if (/rapor\s*görüntüle|rapor\s*goruntule|listele|raporu\s*göster/.test(text)) return true;
  if (/btnRaporGoruntule/i.test(href)) return true;
  return false;
}

function uzaFindMebbisRaporViewButton() {
  const byId = document.getElementById('btnRaporGoruntule');
  if (byId) return byId;
  for (const el of document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')) {
    const href = el.getAttribute?.('href') || '';
    if (/btnRaporGoruntule/i.test(href)) return el;
    if (uzaIsMebbisRaporViewControl(el)) return el;
  }
  return null;
}

function uzaTriggerMebbisRaporView() {
  const btn = uzaFindMebbisRaporViewButton();
  if (btn) {
    const href = btn.getAttribute?.('href') || '';
    const onclick = btn.getAttribute?.('onclick') || '';
    const pb = uzaParseDoPostBackJs(href) || uzaParseDoPostBackJs(onclick);
    if (pb) return uzaDoPostBack(pb.target, pb.arg);
    btn.click();
    return true;
  }
  if (uzaMebbisPuantajFormPage()) {
    return uzaDoPostBack('btnRaporGoruntule', '');
  }
  return false;
}

function uzaNorm(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uzaIsKbsDownloadOnlyPage() {
  const h = location.pathname + location.href;
  return (
    /maasrapor/i.test(h) || /yeniakademik|p_yenirapor|yenirapor/i.test(h)
  );
}

function uzaIsExportControl(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  const text = uzaNorm(el.textContent || el.value || el.title || el.getAttribute('aria-label'));
  const href = uzaNorm(el.getAttribute?.('href') || '');
  const onclick = uzaNorm(el.getAttribute?.('onclick') || '');
  const name = uzaNorm(el.getAttribute?.('name') || '');
  const id = uzaNorm(el.getAttribute?.('id') || '');
  const blob =
    /excel|xls|aktar|dışa|disa|export|indir|rapor|liste|dosya|çıkt|cikti|yazdır|yazdir/.test(
      text + ' ' + href + ' ' + onclick + ' ' + name + ' ' + id,
    );
  if (!blob) return false;
  if (tag === 'a' || tag === 'button' || tag === 'input') return true;
  return el.closest?.('a, button, [role="button"]');
}

function uzaExportControls() {
  const seen = new Set();
  const out = [];
  for (const el of document.querySelectorAll('a, button, input, [role="button"]')) {
    if (!uzaIsExportControl(el) || seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
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
  const host = location.hostname || '';
  const source = /muhasebat\.gov\.tr|kbs\.gov\.tr/i.test(host) ? 'kbs' : 'mebbis';
  return {
    ok: true,
    fileBase64: uzaBufToBase64(buf),
    filename,
    contentType: ct,
    source,
    url: res.url,
  };
}

function uzaStoreExcelToBridge(payload) {
  return chrome.runtime.sendMessage({
    type: 'UZA_BORDRO_EXCEL_STORED',
    notify: true,
    label: payload.filename,
    ...payload,
  });
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.type !== 'UZA_BORDRO_EXCEL_CAPTURE') return;
  if (!ev.data.fileBase64) return;
  uzaStoreExcelToBridge(ev.data).catch(() => {});
});

document.addEventListener(
  'click',
  (ev) => {
    const el = ev.target.closest?.('a, button, input[type="button"], input[type="submit"], [role="button"]');
    if (!uzaIsExportControl(el)) return;
    const href = el.getAttribute?.('href');
    if (href && /^javascript:/i.test(href)) {
      const pb = uzaParseDoPostBackJs(href);
      if (pb) {
        if (uzaIsMebbisRaporViewControl(el) || /btnRaporGoruntule/i.test(pb.target)) {
          uzaDoPostBack(pb.target, pb.arg);
          chrome.runtime.sendMessage({
            type: 'UZA_BORDRO_MEBBIS_REPORT_VIEWED',
            pageUrl: location.href,
            target: pb.target,
          });
          return;
        }
      }
    }
    if (href && href !== '#' && !/^javascript:/i.test(href)) {
      ev.preventDefault();
      ev.stopPropagation();
      uzaFetchExportUrl(new URL(href, location.href).href)
        .then((r) => {
          if (r?.ok) uzaStoreExcelToBridge(r);
        })
        .catch(() => {});
      return;
    }
    if (uzaIsMebbisRaporViewControl(el)) {
      uzaTriggerMebbisRaporView();
      chrome.runtime.sendMessage({ type: 'UZA_BORDRO_MEBBIS_REPORT_VIEWED', pageUrl: location.href });
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
  if (msg?.type === 'UZA_BORDRO_LIST_EXPORTS') {
    const controls = uzaExportControls();
    sendResponse({
      ok: true,
      downloadOnlyPage: uzaIsKbsDownloadOnlyPage(),
      count: controls.length,
      labels: controls.slice(0, 12).map((el) => uzaNorm(el.textContent || el.value || el.title).slice(0, 80)),
    });
    return true;
  }
  if (msg?.type === 'UZA_BORDRO_CLICK_EXPORT') {
    const controls = uzaExportControls();
    if (!controls.length) {
      sendResponse({
        ok: false,
        error: uzaIsKbsDownloadOnlyPage()
          ? 'İndirme düğmesi bulunamadı. Raporu oluşturup tekrar deneyin.'
          : 'Excel / indir düğmesi bulunamadı.',
      });
      return true;
    }
    controls[0].click();
    sendResponse({ ok: true, clicked: controls.length });
    return true;
  }
  if (msg?.type === 'UZA_BORDRO_MEBBIS_VIEW_REPORT') {
    const ok = uzaTriggerMebbisRaporView();
    sendResponse({
      ok,
      error: ok ? null : 'btnRaporGoruntule bulunamadı — ekd04002 filtrelerini doldurun.',
      pageUrl: location.href,
      puantajForm: uzaMebbisPuantajFormPage(),
    });
    return true;
  }
  if (msg?.type === 'UZA_BORDRO_PING') {
    fetch(location.href, { credentials: 'include', cache: 'no-store', method: 'GET' }).catch(() => {});
    sendResponse({
      ok: true,
      downloadOnlyPage: uzaIsKbsDownloadOnlyPage(),
      puantajForm: uzaMebbisPuantajFormPage(),
      hasRaporBtn: !!uzaFindMebbisRaporViewButton(),
    });
    return true;
  }
});
