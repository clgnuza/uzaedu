const UZA_LAST_BORDRO_EXCEL_KEY = 'uzaLastBordroExcel';

const UZA_BORDRO_DOWNLOAD_HOSTS = /mebbis\.meb\.gov\.tr|muhasebat\.gov\.tr/i;

function uzaGuessBordroSource(url, filename) {
  const s = `${url || ''} ${filename || ''}`.toLowerCase();
  if (/muhasebat|kbs/.test(s)) return 'kbs';
  return 'mebbis';
}

async function uzaStoreBordroExcel(payload) {
  const entry = {
    ...payload,
    at: Date.now(),
  };
  await chrome.storage.session.set({ [UZA_LAST_BORDRO_EXCEL_KEY]: entry });
  return entry;
}

async function uzaGetLastBordroExcel(maxAgeMs = 30 * 60 * 1000) {
  const st = await chrome.storage.session.get([UZA_LAST_BORDRO_EXCEL_KEY]);
  const entry = st[UZA_LAST_BORDRO_EXCEL_KEY];
  if (!entry?.fileBase64) return null;
  if (Date.now() - (entry.at || 0) > maxAgeMs) return null;
  return entry;
}

async function uzaCaptureBordroFromUrl(tabId, url) {
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'UZA_BORDRO_FETCH_EXPORT', url });
    if (!r?.ok) return r;
    await uzaStoreBordroExcel(r);
    return r;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/bordro-export-hook.js'],
      });
      const r = await chrome.tabs.sendMessage(tabId, { type: 'UZA_BORDRO_FETCH_EXPORT', url });
      if (r?.ok) await uzaStoreBordroExcel(r);
      return r;
    } catch (e) {
      return { ok: false, error: e?.message || 'Export alınamadı' };
    }
  }
}

function uzaInitBordroDownloadListener() {
  if (globalThis.UZA_BORDRO_DL_LISTENER) return;
  globalThis.UZA_BORDRO_DL_LISTENER = true;

  chrome.downloads.onCreated.addListener((item) => {
    const url = item.url || item.finalUrl || '';
    const fn = item.filename || '';
    if (!UZA_BORDRO_DOWNLOAD_HOSTS.test(url + fn)) return;
    if (!/\.xls/i.test(fn) && !/excel|spreadsheet/i.test(item.mime || '')) return;
    chrome.storage.session.set({
      uzaPendingBordroDownloadId: item.id,
    });
  });

  chrome.downloads.onChanged.addListener(async (delta) => {
    if (delta.state?.current !== 'complete') return;
    const st = await chrome.storage.session.get(['uzaPendingBordroDownloadId']);
    if (st.uzaPendingBordroDownloadId !== delta.id) return;
    const [item] = await chrome.downloads.search({ id: delta.id });
    await chrome.storage.session.remove(['uzaPendingBordroDownloadId']);
    if (!item) return;
    chrome.runtime.sendMessage({
      type: 'UZA_BORDRO_DOWNLOAD_COMPLETE',
      filename: item.filename,
      url: item.url,
      source: uzaGuessBordroSource(item.url, item.filename),
    });
  });
}

uzaInitBordroDownloadListener();
