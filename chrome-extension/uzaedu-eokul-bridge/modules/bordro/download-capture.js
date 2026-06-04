const UZA_LAST_BORDRO_EXCEL_KEY = 'uzaLastBordroExcel';

const UZA_BORDRO_DOWNLOAD_HOSTS = /mebbis\.meb\.gov\.tr|muhasebat\.gov\.tr|kbs\.gov\.tr/i;

function uzaGuessBordroSource(url, filename) {
  const s = `${url || ''} ${filename || ''}`.toLowerCase();
  if (/muhasebat|kbs|maas/.test(s)) return 'kbs';
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

async function uzaWaitForBordroExcel(timeoutMs = 20000, pollMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const entry = await uzaGetLastBordroExcel();
    if (entry && entry.at >= start - 500) return entry;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
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

async function uzaClickKbsExportOnTab(bordroType) {
  const type = bordroType || 'maas_bordro';
  const patterns = uzaBordroTabPatterns(type);
  const tabs = await uzaCollectTabsByPatterns(patterns);
  const tab = uzaPickBordroTab(tabs, type);
  if (!tab?.id) {
    const openHint =
      type === 'ek_ders_bordro'
        ? 'p_yenirapor.htm'
        : 'maasRapor.htm';
    return { ok: false, error: `KBS rapor sekmesi yok. «Sekme aç» ile ${openHint} açın.` };
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'UZA_BORDRO_PING' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/bordro-export-hook.js'],
    });
  }
  const before = await uzaGetLastBordroExcel();
  const beforeAt = before?.at || 0;
  const click = await chrome.tabs.sendMessage(tab.id, { type: 'UZA_BORDRO_CLICK_EXPORT' });
  if (!click?.ok) return click;
  const entry = await uzaWaitForBordroExcel(25000);
  if (entry && entry.at > beforeAt) {
    return { ok: true, filename: entry.filename, tabUrl: tab.url };
  }
  return {
    ok: false,
    error:
      'Excel henüz yakalanmadı. KBS’de «İndir»e siz de tıklayın; ardından «Son indirilen Excel».',
    tabUrl: tab.url,
  };
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
      uzaPendingBordroDownloadTabId: item.tabId ?? null,
    });
  });

  chrome.downloads.onChanged.addListener(async (delta) => {
    if (delta.state?.current !== 'complete') return;
    const st = await chrome.storage.session.get([
      'uzaPendingBordroDownloadId',
      'uzaPendingBordroDownloadTabId',
    ]);
    if (st.uzaPendingBordroDownloadId !== delta.id) return;
    const [item] = await chrome.downloads.search({ id: delta.id });
    await chrome.storage.session.remove(['uzaPendingBordroDownloadId', 'uzaPendingBordroDownloadTabId']);
    if (!item) return;
    const url = item.url || item.finalUrl || '';
    const tabId = item.tabId ?? st.uzaPendingBordroDownloadTabId;
    if (tabId && /^https?:/i.test(url)) {
      const r = await uzaCaptureBordroFromUrl(tabId, url);
      if (r?.ok) {
        chrome.runtime.sendMessage({
          type: 'UZA_BORDRO_EXCEL_STORED',
          notify: true,
          label: r.filename,
          ...r,
        });
        return;
      }
    }
    chrome.runtime.sendMessage({
      type: 'UZA_BORDRO_DOWNLOAD_COMPLETE',
      filename: item.filename,
      url,
      source: uzaGuessBordroSource(url, item.filename),
    });
  });
}

uzaInitBordroDownloadListener();
