const UZA_MEBBIS_TAB_PATTERNS = [
  'https://mebbis.meb.gov.tr/*',
  'https://www.mebbis.meb.gov.tr/*',
  'https://mebbisyd.meb.gov.tr/*',
  'https://www.mebbisyd.meb.gov.tr/*',
];

/* UZA_KBS_TAB_PATTERNS, uzaKbsOpenUrl — shared/kbs-urls.js (service worker importScripts) */

function uzaBordroTabPatterns(bordroType) {
  const ui = globalThis.UZA_EXTENSION_UI?.chromeTabQueries;
  if (bordroType === 'mebbis_puantaj') {
    const p = ui?.mebbisTabPatterns;
    return Array.isArray(p) && p.length ? p : UZA_MEBBIS_TAB_PATTERNS;
  }
  const k = ui?.kbsTabPatterns;
  return Array.isArray(k) && k.length ? k : UZA_KBS_TAB_PATTERNS;
}

async function uzaCollectTabsByPatterns(patterns) {
  const seen = new Set();
  const out = [];
  for (const url of patterns) {
    const tabs = await chrome.tabs.query({ url });
    for (const t of tabs) {
      if (t.id != null && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  return out;
}

async function uzaEnsureBordroScrapeScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UZA_BORDRO_SCRAPE_PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/bordro-scrape.js'],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function uzaEnsureBordroExportHook(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UZA_BORDRO_PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/bordro-export-hook.js'],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function uzaMebbisViewReportOnTab(tabId) {
  await uzaEnsureBordroExportHook(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'UZA_BORDRO_MEBBIS_VIEW_REPORT' });
  } catch (e) {
    return { ok: false, error: e?.message || 'Rapor tetiklenemedi' };
  }
}

const UZA_BORDRO_SNAPSHOT_MEBBIS = 'uzaBordroSnapshotMebbis';
const UZA_BORDRO_SNAPSHOT_KBS = 'uzaBordroSnapshotKbs';

async function uzaSaveBordroSnapshot(key, table, meta) {
  await chrome.storage.session.set({
    [key]: { table, meta, at: Date.now() },
  });
}

async function uzaGetBordroSnapshots() {
  const st = await chrome.storage.session.get([UZA_BORDRO_SNAPSHOT_MEBBIS, UZA_BORDRO_SNAPSHOT_KBS]);
  return { mebbis: st[UZA_BORDRO_SNAPSHOT_MEBBIS] || null, kbs: st[UZA_BORDRO_SNAPSHOT_KBS] || null };
}

function uzaPickBordroTab(tabs, bordroType) {
  if (!tabs.length) return null;
  const u = (t) => String(t.url || '').toLowerCase();
  if (bordroType === 'mebbis_puantaj') {
    const ekd = tabs.find((t) => uzaMebbisPuantajPage(t.url));
    if (ekd) return tabs.find((t) => t.active) || ekd;
    const ek = tabs.find((t) => uzaMebbisEkdPath(t.url));
    if (ek) return tabs.find((t) => t.active) || ek;
  }
  if (bordroType === 'maas_bordro') {
    const maas = tabs.find((t) => uzaKbsUrlLooksLikeMaas(u(t)));
    if (maas) return tabs.find((t) => t.active) || maas;
  }
  if (bordroType === 'ek_ders_bordro') {
    const rapor = tabs.find((t) => uzaKbsUrlLooksLikeEkDersRapor(u(t)));
    if (rapor) return tabs.find((t) => t.active) || rapor;
    const ek = tabs.find((t) => uzaKbsUrlLooksLikeEkDersBordro(u(t)));
    if (ek) return tabs.find((t) => t.active) || ek;
  }
  return tabs.find((t) => t.active) || tabs[0];
}

async function uzaScrapeBordroActiveTab(bordroType, scrapeMode) {
  const patterns = uzaBordroTabPatterns(bordroType);
  const tabs = await uzaCollectTabsByPatterns(patterns);
  if (!tabs.length) {
    const site =
      bordroType === 'mebbis_puantaj'
        ? 'mebbis.meb.gov.tr'
        : 'kbs.gov.tr (KPHYS)';
    return {
      ok: false,
      error: `${site} sekmesi bulunamadı. ${typeof uzaKbsScrapeHint === 'function' ? uzaKbsScrapeHint(bordroType) : 'Oturum açıp listeyi ekranda gösterin.'}`,
    };
  }
  const tab = uzaPickBordroTab(tabs, bordroType);
  const injected = await uzaEnsureBordroScrapeScript(tab.id);
  if (!injected) {
    return { ok: false, error: 'Sekmeye köprü betiği enjekte edilemedi. Sayfayı yenileyin.' };
  }
  let scraped;
  try {
    scraped = await chrome.tabs.sendMessage(tab.id, {
      type: 'UZA_BORDRO_SCRAPE_PAGE',
      bordroType,
      scrapeMode: scrapeMode || '',
    });
  } catch (e) {
    return { ok: false, error: e?.message || 'Sekme verisi okunamadı' };
  }
  if (
    (!scraped?.ok || !scraped.table?.rows?.length) &&
    bordroType === 'mebbis_puantaj' &&
    uzaMebbisPuantajPage(tab.url)
  ) {
    const view = await uzaMebbisViewReportOnTab(tab.id);
    if (view?.ok) {
      await new Promise((r) => setTimeout(r, 3500));
      try {
        scraped = await chrome.tabs.sendMessage(tab.id, {
          type: 'UZA_BORDRO_SCRAPE_PAGE',
          bordroType,
          scrapeMode: scrapeMode || 'puantaj',
        });
      } catch {
        /* */
      }
    } else if (view?.error) {
      return {
        ok: false,
        error: `${view.error} Sonra «Açık sekmeden çek» veya Excele Aktar.`,
        url: tab.url,
      };
    }
  }
  if (!scraped?.ok || !scraped.table?.rows?.length) {
    const href = scraped?.url || '';
    const downloadOnly = uzaKbsIsDownloadOnlyPage(href);
    const dlHint =
      downloadOnly || bordroType === 'maas_bordro' || bordroType === 'ek_ders_bordro'
        ? uzaKbsScrapeHint(bordroType) || 'KBS’de Excel indirin, sonra «Son indirilen Excel».'
        : null;
    return {
      ok: false,
      error: dlHint || scraped?.hint || 'Tabloda personel verisi bulunamadı. Liste/rapor ekranını açın.',
      url: scraped?.url,
      useExcelDownload: !!(downloadOnly || bordroType === 'maas_bordro' || bordroType === 'ek_ders_bordro'),
    };
  }
  return {
    ok: true,
    tabId: tab.id,
    table: scraped.table,
    pageTitle: scraped.pageTitle,
    url: scraped.url,
    tablesFound: scraped.tablesFound,
    kbsWarnings: scraped.kbsWarnings || [],
  };
}

async function uzaBordroScrapeDiag(bordroType, scrapeMode) {
  const patterns = uzaBordroTabPatterns(bordroType);
  const tabs = await uzaCollectTabsByPatterns(patterns);
  const tab = uzaPickBordroTab(tabs, bordroType);
  if (!tab?.id) {
    return { ok: false, error: 'KBS sekmesi yok.', tabs: tabs.map((t) => t.url) };
  }
  const injected = await uzaEnsureBordroScrapeScript(tab.id);
  if (!injected) return { ok: false, error: 'bordro-scrape enjekte edilemedi', tabUrl: tab.url };
  try {
    const diag = await chrome.tabs.sendMessage(tab.id, {
      type: 'UZA_BORDRO_SCRAPE_DIAG',
      bordroType,
      scrapeMode: scrapeMode || '',
    });
    return { ok: true, tabId: tab.id, tabUrl: tab.url, ...diag };
  } catch (e) {
    return { ok: false, error: e?.message || String(e), tabUrl: tab.url };
  }
}

async function uzaBordroScrapeAndSnapshot(bordroType, snapshotKey, scrapeMode) {
  const scraped = await uzaScrapeBordroActiveTab(bordroType, scrapeMode);
  if (!scraped.ok) return scraped;
  await uzaSaveBordroSnapshot(snapshotKey, scraped.table, {
    url: scraped.url,
    pageTitle: scraped.pageTitle,
    kbsWarnings: scraped.kbsWarnings,
  });
  return scraped;
}

async function uzaBordroCompareSnapshots(opts) {
  const snaps = await uzaGetBordroSnapshots();
  if (!snaps.mebbis?.table?.rows?.length || !snaps.kbs?.table?.rows?.length) {
    return { ok: false, error: 'Önce MEBBİS ve KBS anlık görüntüsü alın.' };
  }
  const data = await uzaBordroComparePayload({
    token: opts.token,
    schoolId: opts.schoolId,
    mebbis: snaps.mebbis.table,
    kbs: snaps.kbs.table,
  });
  return { ok: true, ...data };
}

const UZA_MEBBIS_REPORT_PATH_HINT =
  'ekd04002: ay/yıl ve filtreleri seçin → «Rapor Görüntüle» (btnRaporGoruntule) → çek veya Excele Aktar';

async function uzaOpenMebbisReport() {
  const url = UZA_MEBBIS_PUANTAJ_URL;
  const tabs = await uzaCollectTabsByPatterns(uzaBordroTabPatterns('mebbis_puantaj'));
  const ekd = tabs.find((t) => uzaMebbisPuantajPage(t.url));
  if (ekd?.id) {
    await chrome.tabs.update(ekd.id, { active: true });
    return { ok: true, url, hint: UZA_MEBBIS_REPORT_PATH_HINT };
  }
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true, url });
    return { ok: true, url, hint: UZA_MEBBIS_REPORT_PATH_HINT };
  }
  await chrome.tabs.create({ url });
  return { ok: true, url, hint: UZA_MEBBIS_REPORT_PATH_HINT };
}

async function uzaBordroScrapeAndParse(opts) {
  const scraped = await uzaScrapeBordroActiveTab(opts.bordroType || opts.type, opts.scrapeMode);
  if (!scraped.ok) return scraped;
  const path = `/messaging/bordro/parse-json${uzaBordroSchoolQ(opts.schoolId)}`;
  const data = await uzaFetchJson(path, {
    method: 'POST',
    token: opts.token,
    body: {
      type: opts.bordroType || opts.type,
      donem: opts.donem,
      headers: scraped.table.headers,
      rows: scraped.table.rows,
      schoolName: opts.schoolName,
      footerNote: opts.footerNote,
      scrapeUrl: scraped.url,
      pageTitle: scraped.pageTitle,
    },
  });
  return {
    ok: true,
    ...data,
    scrapeUrl: scraped.url,
    rowCount: scraped.table.rowCount,
    kbsWarnings: scraped.kbsWarnings,
    table: scraped.table,
  };
}

async function uzaBordroScrapeAndCampaign(opts) {
  const scraped = await uzaScrapeBordroActiveTab(opts.bordroType || opts.type);
  if (!scraped.ok) return scraped;
  const path = `/messaging/bordro/campaign-json${uzaBordroSchoolQ(opts.schoolId)}`;
  const data = await uzaFetchJson(path, {
    method: 'POST',
    token: opts.token,
    body: {
      type: opts.bordroType || opts.type,
      title: opts.title,
      donem: opts.donem,
      headers: scraped.table.headers,
      rows: scraped.table.rows,
      schoolName: opts.schoolName,
      footerNote: opts.footerNote,
      manualPhones: opts.manualPhones || {},
      scrapeUrl: scraped.url,
      pageTitle: scraped.pageTitle,
    },
  });
  return { ok: true, campaign: data, scrapeUrl: scraped.url };
}
