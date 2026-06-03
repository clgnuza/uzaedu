const UZA_MEBBIS_TAB_PATTERNS = [
  'https://mebbis.meb.gov.tr/*',
  'https://www.mebbis.meb.gov.tr/*',
  'https://mebbisyd.meb.gov.tr/*',
  'https://www.mebbisyd.meb.gov.tr/*',
];

const UZA_KBS_TAB_PATTERNS = [
  'https://kbs.muhasebat.gov.tr/*',
  'https://www.kbs.muhasebat.gov.tr/*',
];

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

async function uzaScrapeBordroActiveTab(bordroType, scrapeMode) {
  const patterns = uzaBordroTabPatterns(bordroType);
  const tabs = await uzaCollectTabsByPatterns(patterns);
  if (!tabs.length) {
    const site = bordroType === 'mebbis_puantaj' ? 'mebbis.meb.gov.tr' : 'kbs.muhasebat.gov.tr';
    return { ok: false, error: `${site} sekmesi bulunamadı. Oturum açıp ilgili raporu ekranda açın.` };
  }
  const tab = tabs.find((t) => t.active) || tabs[0];
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
  if (!scraped?.ok || !scraped.table?.rows?.length) {
    return {
      ok: false,
      error: scraped?.hint || 'Tabloda personel verisi bulunamadı. Liste/rapor ekranını açın.',
      url: scraped?.url,
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
    return { ok: false, error: 'Önce PersonelNet ve MaliNet anlık görüntüsü alın.' };
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
  'Ek Ders Modülü → Raporlar → Ek Ders Listesi (puantaj) veya Veri Tipi Bazlı Çizelge';

async function uzaOpenMebbisReport() {
  const tabs = await uzaCollectTabsByPatterns(uzaBordroTabPatterns('mebbis_puantaj'));
  const url = 'https://mebbis.meb.gov.tr/';
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return { ok: true, hint: UZA_MEBBIS_REPORT_PATH_HINT };
  }
  await chrome.tabs.create({ url });
  return { ok: true, hint: UZA_MEBBIS_REPORT_PATH_HINT };
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
