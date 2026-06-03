importScripts(
  '../shared/brand-names.js',
  '../shared/messaging.js',
  '../shared/storage.js',
  '../shared/api.js',
  '../modules/eokul/core.js',
  '../modules/eokul/kurum.js',
  '../modules/eokul/okl08001-json.js',
  '../modules/eokul/okl08001-html.js',
  '../modules/eokul/orta-okul-tur.js',
  '../modules/kelebek/export.js',
  '../modules/devamsizlik/export.js',
  '../modules/devamsizlik/write.js',
  '../modules/devamsizlik/toplu-ozursuz.js',
  '../modules/ozur/ogr02013-save.js',
  '../modules/ozur/ogr02012-scrape.js',
  '../modules/ozur/ozursuz-ozurlu-transfer.js',
  '../modules/ozur/veli-izin-pdf.js',
  '../modules/shared/csv-download.js',
  '../modules/shared/zip-store.js',
  '../modules/ogrenci-dosya/veli-fields.js',
  '../modules/ogrenci-dosya/ogr-detail.js',
  '../modules/ogrenci-dosya/photos.js',
  '../modules/ogrenci-dosya/export.js',
  '../modules/eokul/meb-ajanda.js',
  '../modules/veli/dom-push.js',
  '../modules/ders-dagit/eokul-upload.js',
  '../modules/bordro/upload.js',
  '../modules/bordro/scrape.js',
  '../modules/bordro/download-capture.js',
  '../modules/bordro/compare-api.js',
  '../modules/veli/push.js',
  '../modules/faaliyet/write.js',
  '../modules/eokul/okl08002-mektup.js',
  '../modules/eokul/ogr-nav.js',
  '../modules/mektup/export.js',
  '../modules/toplam/export.js',
  '../modules/eokul/ogr-veli-json.js',
  '../modules/rehber/export.js',
  '../modules/izin/export.js',
  '../modules/ders-dagit/import.js',
);

let UZA_BOOTSTRAP_CACHE = null;
let UZA_EXTENSION_UI = null;

async function uzaEnsureBootstrap(token) {
  if (UZA_BOOTSTRAP_CACHE && UZA_EXTENSION_UI) return UZA_BOOTSTRAP_CACHE;
  const data = await uzaFetchJson('/eokul-bridge/v1/bootstrap', { token });
  UZA_BOOTSTRAP_CACHE = data;
  UZA_EXTENSION_UI = data?.extensionUi ?? null;
  globalThis.UZA_EXTENSION_UI = UZA_EXTENSION_UI;
  await uzaLoadKurumKeyFromStorage();
  return data;
}

function uzaTabPatterns(path) {
  const v = UZA_EXTENSION_UI?.chromeTabQueries?.[path];
  return Array.isArray(v) ? v : [];
}

async function uzaCollectTabs(patterns) {
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

const UZA_DEFAULT_PORTAL_PATTERNS = [
  'http://localhost:3000/*',
  'http://127.0.0.1:3000/*',
  'https://admin.uzaedu.com/*',
  'https://uzaedu.com/*',
  'https://www.uzaedu.com/*',
];

function uzaPortalPatterns() {
  const p = uzaTabPatterns('portalSiteTabPatterns');
  return p.length ? p : UZA_DEFAULT_PORTAL_PATTERNS;
}

async function uzaReadPanelAuth() {
  const portalTabs = await uzaCollectTabs(uzaPortalPatterns());
  if (!portalTabs.length) {
    return { ok: false, error: 'Uzaedu panel sekmesi bulunamadı. Önce panele giriş yapın.' };
  }
  const apiBase = uzaApiBase(UZA_EXTENSION_UI);
  for (const tab of portalTabs) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'UZA_READ_PANEL_AUTH', apiBase });
      if (r?.ok) return { ok: true, token: r.bearer, me: r.me, tabId: tab.id };
    } catch {
      /* içerik betiği henüz yok */
    }
  }
  return {
    ok: false,
    error: 'Panel oturumu okunamadı. Sayfayı yenileyip tekrar deneyin.',
  };
}

async function uzaLoadBootstrapViaPanel() {
  const portalTabs = await uzaCollectTabs(uzaPortalPatterns());
  const apiBase = uzaApiBase(UZA_EXTENSION_UI);
  for (const tab of portalTabs) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'UZA_FETCH_BOOTSTRAP', apiBase });
      if (r?.ok && r.bootstrap) {
        UZA_BOOTSTRAP_CACHE = r.bootstrap;
        UZA_EXTENSION_UI = r.bootstrap.extensionUi ?? null;
        globalThis.UZA_EXTENSION_UI = UZA_EXTENSION_UI;
        await uzaLoadKurumKeyFromStorage();
        return { ok: true, token: r.bearer || null, bootstrap: r.bootstrap };
      }
    } catch {
      /* ignore */
    }
  }
  return { ok: false, error: 'Bootstrap yüklenemedi' };
}

async function uzaEokulTabReady() {
  const pat = uzaTabPatterns('eokulTabMatchPattern');
  const patterns = pat.length ? pat : ['https://e-okul.meb.gov.tr/*'];
  const tabs = await uzaCollectTabs(patterns);
  return { ok: tabs.length > 0, tabs };
}

async function runGateFlow() {
  const feature = await uzaFetchJson('/eokul-bridge/v1/extension/feature-enabled');
  if (!feature?.enabled) {
    throw new Error(feature?.message || 'Köprü geçici olarak kapalı.');
  }
  const auth = await uzaReadPanelAuth();
  if (!auth.ok) throw new Error(auth.error || 'Panel oturumu yok');
  const loaded = await uzaLoadBootstrapViaPanel();
  if (!loaded.ok) {
    const token = auth.token;
    if (token) await uzaEnsureBootstrap(token);
    else throw new Error(loaded.error || 'Yapılandırma alınamadı');
  }
  const eokul = await uzaEokulTabReady();
  if (!eokul.ok) {
    throw new Error(UZA_ERR.okulNetTabNotFound());
  }
  let kurumKey = 'ilkOgretim';
  const eokulTab = eokul.tabs?.[0];
  if (eokulTab?.url) {
    const detected = uzaDetectKurumFromUrl(eokulTab.url);
    if (detected) kurumKey = detected;
  }
  await uzaSaveKurumKey(kurumKey);
  const me = auth.me || {};
  const payload = {
    at: Date.now(),
    userId: me.id ?? null,
    schoolId: me.school_id ?? me.schoolId ?? null,
    displayName: me.display_name || me.name || me.email || '',
    schoolName: me.school_name || me.schoolName || '',
    role: me.role ?? null,
    kurumKey,
  };
  await uzaStorageSet({ [UZA_SESSION_GATE_KEY]: payload });
  if (kurumKey === 'ortaOgretim') {
    const profile = uzaProfileFromBootstrap(kurumKey);
    if (profile?.okl01001) {
      await uzaFetchAndStoreOrtaOkulTurOptions(profile, '');
    }
  }
  return { ok: true, payload };
}

function uzaMebbisTabPatterns() {
  const p = UZA_EXTENSION_UI?.chromeTabQueries?.mebbisTabPatterns;
  return Array.isArray(p) && p.length
    ? p
    : [
        'https://mebbis.meb.gov.tr/*',
        'https://www.mebbis.meb.gov.tr/*',
        'https://mebbisyd.meb.gov.tr/*',
        'https://www.mebbisyd.meb.gov.tr/*',
      ];
}

function uzaKbsTabPatterns() {
  const p = UZA_EXTENSION_UI?.chromeTabQueries?.kbsTabPatterns;
  return Array.isArray(p) && p.length
    ? p
    : ['https://kbs.muhasebat.gov.tr/*', 'https://www.kbs.muhasebat.gov.tr/*'];
}

async function getGateStatus() {
  if (!UZA_EXTENSION_UI) {
    try {
      await uzaFetchJson('/eokul-bridge/v1/extension/feature-enabled');
    } catch {
      /* bootstrap öncesi */
    }
  }
  const portal = await uzaCollectTabs(uzaPortalPatterns());
  const eokul = await uzaEokulTabReady();
  const mebbisTabs = await uzaCollectTabs(uzaMebbisTabPatterns());
  const kbsTabs = await uzaCollectTabs(uzaKbsTabPatterns());
  return {
    ok: true,
    portalConnected: portal.length > 0,
    eokulReady: eokul.ok,
    mebbisReady: mebbisTabs.length > 0,
    kbsReady: kbsTabs.length > 0,
    portalTabCount: portal.length,
    eokulTabCount: eokul.tabs?.length ?? 0,
    mebbisTabCount: mebbisTabs.length,
    kbsTabCount: kbsTabs.length,
  };
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('gate/gate.html') });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    if (msg?.type === UZA_MSG_GATE_VERSION) {
      return uzaFetchJson(
        `/eokul-bridge/v1/extension/version-check?version=${encodeURIComponent(msg.version || '')}`,
      );
    }
    if (msg?.type === UZA_MSG_GATE_FEATURE) {
      return uzaFetchJson('/eokul-bridge/v1/extension/feature-enabled');
    }
    if (msg?.type === UZA_MSG_GATE_STATUS) {
      return getGateStatus();
    }
    if (msg?.type === UZA_MSG_GATE_RUN) {
      return runGateFlow();
    }
    if (msg?.type === UZA_MSG_SET_KURUM) {
      const k = await uzaSaveKurumKey(msg.kurumKey);
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY];
      if (gate) {
        gate.kurumKey = k;
        await uzaStorageSet({ [UZA_SESSION_GATE_KEY]: gate });
      }
      if (k === 'ortaOgretim') {
        const profile = uzaProfileFromBootstrap(k);
        if (profile?.okl01001) await uzaFetchAndStoreOrtaOkulTurOptions(profile, '');
      }
      return { ok: true, kurumKey: k };
    }
    if (msg?.type === UZA_MSG_GET_KURUM) {
      await uzaLoadKurumKeyFromStorage();
      return { ok: true, kurumKey: uzaGetKurumKey() };
    }
    if (msg?.type === UZA_MSG_GET_ORTA_OKUL_TUR) {
      const st = await chrome.storage.session.get([UZA_ORTA_OKUL_TUR_PACK_KEY, UZA_OKUL_ALT_TUR_SECIM_KEY]);
      const pack = st[UZA_ORTA_OKUL_TUR_PACK_KEY];
      return {
        ok: true,
        options: pack?.options || [],
        selected: st[UZA_OKUL_ALT_TUR_SECIM_KEY] || pack?.defaultValue || '',
      };
    }
    if (msg?.type === UZA_MSG_ORTA_OKUL_TUR_FETCH) {
      await uzaLoadKurumKeyFromStorage();
      const profile = uzaProfileFromBootstrap('ortaOgretim');
      if (!profile?.okl01001) return { ok: false, error: 'Profil yok.' };
      return uzaFetchAndStoreOrtaOkulTurOptions(profile, msg.preferLabel || '');
    }
    if (msg?.type === UZA_MSG_ORTA_OKUL_TUR_SET) {
      const v = String(msg.value || '').trim();
      if (!v) return { ok: false, error: 'Seçim gerekli.' };
      await chrome.storage.session.set({ [UZA_OKUL_ALT_TUR_SECIM_KEY]: v });
      const profile = uzaProfileFromBootstrap('ortaOgretim');
      if (!profile?.okl01001) return { ok: true };
      return uzaPostOrtaOkulAltTurChange(profile, v);
    }
    if (msg?.type === UZA_MSG_GET_BOOTSTRAP) {
      const data = await uzaEnsureBootstrap(msg.token);
      return { ok: true, bootstrap: data };
    }
    if (msg?.type === UZA_MSG_GET_EXTENSION_UI) {
      if (msg.token) {
        await uzaEnsureBootstrap(msg.token);
      } else if (!UZA_EXTENSION_UI) {
        await uzaLoadBootstrapViaPanel();
      }
      return {
        ok: true,
        extensionUi: UZA_EXTENSION_UI,
        menuIds: UZA_BOOTSTRAP_CACHE?.menuIds ?? UZA_EXTENSION_UI?.menuIds ?? [],
      };
    }
    if (msg?.type === UZA_MSG_KELEBEK_LIST) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      await uzaLoadKurumKeyFromStorage();
      return uzaListKelebekSinifOptions(msg.kurumKey || uzaGetKurumKey());
    }
    if (msg?.type === UZA_MSG_KELEBEK_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunKelebekExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        kurumKey: msg.kurumKey || uzaGetKurumKey(),
        sinifValues: msg.sinifValues ?? null,
        siraTipi: msg.siraTipi,
        grupSayisi: msg.grupSayisi,
      });
    }
    if (msg?.type === UZA_MSG_GET_MEKTUP_PREFILL || msg?.type === 'UZA_GET_MEKTUP_PREFILL') {
      const data = await uzaStorageGet([UZA_MEKTUP_PREFILL_KEY]);
      const pre = data[UZA_MEKTUP_PREFILL_KEY];
      if (pre?.recipients) {
        await uzaStorageRemove([UZA_MEKTUP_PREFILL_KEY]);
      }
      return { ok: true, recipients: pre?.recipients ?? null };
    }
    if (msg?.type === UZA_MSG_MEKTUP_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      const res = await uzaRunMektupExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        uyariDilimi: msg.uyariDilimi || '1',
        uyariDilimiLabel: msg.uyariDilimiLabel || '',
        includeSent: !!msg.includeSent,
      });
      if (res?.ok && UZA_EXTENSION_UI?.portalApi?.portalSiteOrigin) {
        const origin = UZA_EXTENSION_UI.portalApi.portalSiteOrigin.replace(/\/+$/, '');
        chrome.tabs.create({ url: `${origin}/mesaj-merkezi/devamsizlik-mektup?eokul_prefill=1` });
      }
      return res;
    }
    if (msg?.type === UZA_MSG_REHBER_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunVeliRehberExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        sinifValues: msg.sinifValues ?? null,
      });
    }
    if (msg?.type === UZA_MSG_TOPLAM_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunToplamDevamsizlikExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        sinifValues: msg.sinifValues ?? null,
        useOzursuz: msg.useOzursuz,
        useOzurlu: msg.useOzurlu,
        ozursuzMin: msg.ozursuzMin,
        ozursuzMax: msg.ozursuzMax,
        ozurluMin: msg.ozurluMin,
        ozurluMax: msg.ozurluMax,
        combineAnd: msg.combineAnd,
      });
    }
    if (msg?.type === UZA_MSG_DD_LIST_STUDIOS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      try {
        const studios = await uzaFetchStudios(auth.token);
        return { ok: true, token: auth.token, studios: Array.isArray(studios) ? studios : [] };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DD_LIST_PROGRAMS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      try {
        const programs = await uzaFetchPrograms(auth.token, msg.studioId);
        return { ok: true, programs: Array.isArray(programs) ? programs : [] };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DD_EOKUL_EXPORT) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      try {
        return await uzaDownloadProgramEokulXlsx({
          token: auth.token,
          studioId: msg.studioId,
          programId: msg.programId,
        });
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DD_EOKUL_PREVIEW) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      try {
        const preview = await uzaPreviewDersDagitEokul({
          token: auth.token,
          studioId: msg.studioId,
          fileBase64: msg.fileBase64,
          format: msg.format,
          schoolId: msg.schoolId,
        });
        return { ok: true, preview };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DD_EOKUL_IMPORT) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      return uzaImportDersDagitEokul({
        token: auth.token,
        studioId: msg.studioId,
        fileBase64: msg.fileBase64,
        format: msg.format,
        replace: msg.replace,
        autoElectiveGroups: msg.autoElectiveGroups,
        schoolId: msg.schoolId,
      });
    }
    if (msg?.type === UZA_MSG_IZIN_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunIzinExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        tarihIso: msg.tarihIso,
      });
    }
    if (msg?.type === UZA_MSG_OTURUM_SET) {
      await uzaSyncOturumAlarm(!!msg.enabled);
      return { ok: true, enabled: !!msg.enabled };
    }
    if (msg?.type === UZA_MSG_DEVAMSIZLIK_CAMPAIGNS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        const q = gate.schoolId ? `?school_id=${encodeURIComponent(gate.schoolId)}` : '';
        const campaigns = await uzaFetchJson(`/eokul-bridge/v1/devamsizlik-campaigns${q}`, {
          token: auth.token,
        });
        return { ok: true, campaigns: Array.isArray(campaigns) ? campaigns : [] };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DEVAMSIZLIK_WRITE_PAYLOAD) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        const q = gate.schoolId ? `?school_id=${encodeURIComponent(gate.schoolId)}` : '';
        const payload = await uzaFetchJson(
          `/eokul-bridge/v1/devamsizlik-campaigns/${msg.campaignId}/write-payload${q}`,
          { token: auth.token },
        );
        return { ok: true, payload, kind: payload.kind };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_DEVAMSIZLIK_WRITE) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunDevamsizlikCampaignWrite({
        siniflar: msg.siniflar,
        tarihIso: msg.tarihIso,
        kind: msg.kind,
      });
    }
    if (msg?.type === UZA_MSG_TOPLU_OZURSUZ_WRITE) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunTopluOzursuzWrite({
        tarihIso: msg.tarihIso,
        typeMap: msg.typeMap,
      });
    }
    if (msg?.type === UZA_MSG_TOPLU_OZURLU_WRITE) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunTopluOzurluWrite({
        nedeni: msg.nedeni,
        aciklama: msg.aciklama,
        rowsText: msg.rowsText,
        ogrNosText: msg.ogrNosText,
      });
    }
    if (msg?.type === UZA_MSG_OZURSUZ_LISTE) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunOzursuzOzurluListe({ ogrNo: msg.ogrNo });
    }
    if (msg?.type === UZA_MSG_OZURSUZ_AKTAR) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunOzursuzOzurluAktar({
        ogrNo: msg.ogrNo,
        nedeni: msg.nedeni,
        aciklama: msg.aciklama,
        rows: msg.rows,
      });
    }
    if (msg?.type === UZA_MSG_VELI_IZIN_PDF) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaDownloadVeliIzinPdf({
        token: auth.token,
        schoolId: gate.schoolId || null,
        ogrNo: msg.ogrNo,
        student: msg.student,
        satirlar: msg.satirlar,
      });
    }
    if (msg?.type === UZA_MSG_OGRENCI_DOSYA_EXPORT) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const auth = await uzaReadPanelAuth();
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunOgrenciDosyaExport({
        sinifValues: msg.sinifValues ?? null,
        groupId: msg.groupId,
        fieldIds: msg.fieldIds,
        importToPanel: !!msg.importToPanel,
        token: auth.ok ? auth.token : null,
        schoolId: gate.schoolId || null,
        mebAjandaCode: msg.mebAjandaCode || null,
        userName: gate.displayName || '',
      });
    }
    if (msg?.type === UZA_MSG_MEB_AJANDA_VERIFY) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const profile = uzaActiveProfile();
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaVerifyMebAjandaCode(profile, msg.code, profile?.ogr02019, gate.displayName || '');
    }
    if (msg?.type === UZA_MSG_VELI_PUSH) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunVeliPush({
        token: auth.token,
        schoolId: gate.schoolId || null,
        eokulTabId: eokul.tabs?.[0]?.id ?? null,
        mebAjandaCode: msg.mebAjandaCode || null,
        userName: gate.displayName || '',
      });
    }
    if (msg?.type === UZA_MSG_FAALIYET_WRITE) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunTopluFaaliyetWrite({
        tarihIso: msg.tarihIso,
        sure: msg.sure,
        aciklama: msg.aciklama,
        ogrNosText: msg.ogrNosText,
      });
    }
    if (msg?.type === UZA_MSG_DEVAMSIZLIK_EXPORT) {
      if (!UZA_BOOTSTRAP_CACHE) {
        const loaded = await uzaLoadBootstrapViaPanel();
        if (!loaded.ok) return loaded;
      }
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaRunDevamsizlikExport({
        token: auth.token,
        schoolId: gate.schoolId || null,
        kind: msg.kind === 'ders' ? 'ders' : 'gunluk',
        tarihIso: msg.tarihIso,
        sinifValues: msg.sinifValues ?? null,
      });
    }
    if (msg?.type === UZA_MSG_OPEN_GUNLUK_YAZ) {
      const url = chrome.runtime.getURL('menus/gunluk-yaz.html');
      await chrome.tabs.create({ url });
      return { ok: true };
    }
    if (msg?.type === UZA_MSG_OPEN_APP) {
      await chrome.tabs.create({ url: chrome.runtime.getURL('app/app.html') });
      return { ok: true };
    }
    if (msg?.type === UZA_MSG_BORDRO_PARSE) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      const buf = Uint8Array.from(atob(msg.fileBase64 || ''), (c) => c.charCodeAt(0));
      return uzaParseBordroExcel({
        type: msg.bordroType,
        donem: msg.donem,
        token: auth.token,
        schoolId: gate.schoolId || null,
        fileBuffer: buf.buffer,
        filename: msg.filename,
      });
    }
    if (msg?.type === UZA_MSG_BORDRO_CAMPAIGN) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      const buf = Uint8Array.from(atob(msg.fileBase64 || ''), (c) => c.charCodeAt(0));
      return uzaCreateBordroCampaign({
        type: msg.bordroType,
        donem: msg.donem,
        title: msg.title,
        schoolName: msg.schoolName || gate.schoolName,
        footerNote: msg.footerNote,
        token: auth.token,
        schoolId: gate.schoolId || null,
        fileBuffer: buf.buffer,
        filename: msg.filename,
        manualPhones: msg.manualPhones,
      });
    }
    if (msg?.type === UZA_MSG_BORDRO_SCRAPE_PARSE) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        const data = await uzaBordroScrapeAndParse({
          bordroType: msg.bordroType,
          donem: msg.donem,
          schoolName: msg.schoolName || gate.schoolName,
          footerNote: msg.footerNote,
          token: auth.token,
          schoolId: gate.schoolId || null,
          scrapeMode: msg.scrapeMode,
        });
        return { ok: true, ...data };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_BORDRO_SCRAPE_CAMPAIGN) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        if (msg.headers?.length && msg.rows?.length) {
          const campaign = await uzaCreateBordroCampaignJson({
            type: msg.bordroType,
            donem: msg.donem,
            title: msg.title,
            schoolName: msg.schoolName || gate.schoolName,
            footerNote: msg.footerNote,
            token: auth.token,
            schoolId: gate.schoolId || null,
            manualPhones: msg.manualPhones,
            headers: msg.headers,
            rows: msg.rows,
            scrapeUrl: msg.scrapeUrl,
          });
          return campaign;
        }
        const data = await uzaBordroScrapeAndCampaign({
          bordroType: msg.bordroType,
          donem: msg.donem,
          title: msg.title,
          schoolName: msg.schoolName || gate.schoolName,
          footerNote: msg.footerNote,
          token: auth.token,
          schoolId: gate.schoolId || null,
          manualPhones: msg.manualPhones,
        });
        return { ok: true, ...data };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_BORDRO_OPEN_TAB) {
      const url =
        msg.bordroType === 'mebbis_puantaj'
          ? 'https://mebbis.meb.gov.tr/'
          : 'https://kbs.muhasebat.gov.tr/';
      await chrome.tabs.create({ url });
      return { ok: true };
    }
    if (msg?.type === UZA_MSG_BORDRO_OPEN_MEBBIS_REPORT) {
      return uzaOpenMebbisReport();
    }
    if (msg?.type === UZA_MSG_BORDRO_LAST_EXCEL_PARSE) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      return uzaParseBordroFromStoredExcel({
        bordroType: msg.bordroType,
        donem: msg.donem,
        token: auth.token,
        schoolId: gate.schoolId || null,
        schoolName: msg.schoolName || gate.schoolName,
        footerNote: msg.footerNote,
      });
    }
    if (msg?.type === UZA_MSG_BORDRO_CAPTURE_URL) {
      const tabs = await uzaCollectTabsByPatterns([
        ...uzaBordroTabPatterns('mebbis_puantaj'),
        ...uzaBordroTabPatterns('ek_ders_bordro'),
      ]);
      const tab = tabs.find((t) => t.active) || tabs[0];
      if (!tab?.id) return { ok: false, error: UZA_ERR.personelMaliTabRequired() };
      return uzaCaptureBordroFromUrl(tab.id, msg.url);
    }
    if (msg?.type === UZA_MSG_BORDRO_SNAPSHOT_MEBBIS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      return uzaBordroScrapeAndSnapshot('mebbis_puantaj', UZA_BORDRO_SNAPSHOT_MEBBIS, msg.scrapeMode || 'puantaj');
    }
    if (msg?.type === UZA_MSG_BORDRO_SNAPSHOT_KBS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const mode = msg.scrapeMode || (msg.bordroType === 'maas_bordro' ? 'bordro' : 'bordro');
      return uzaBordroScrapeAndSnapshot(msg.bordroType || 'ek_ders_bordro', UZA_BORDRO_SNAPSHOT_KBS, mode);
    }
    if (msg?.type === UZA_MSG_BORDRO_COMPARE) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        const data = await uzaBordroCompareSnapshots({ token: auth.token, schoolId: gate.schoolId });
        return { ok: true, ...data };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_BORDRO_TC_AUDIT) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        if (msg.headers && msg.rows) {
          const data = await uzaBordroTcAudit({
            token: auth.token,
            schoolId: gate.schoolId,
            headers: msg.headers,
            rows: msg.rows,
          });
          return { ok: true, ...data };
        }
        const scraped = await uzaScrapeBordroActiveTab(msg.bordroType || 'mebbis_puantaj');
        if (!scraped.ok) return scraped;
        const data = await uzaBordroTcAudit({
          token: auth.token,
          schoolId: gate.schoolId,
          headers: scraped.table.headers,
          rows: scraped.table.rows,
        });
        return { ok: true, ...data };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    if (msg?.type === UZA_MSG_MEBBIS_OTURUM_SET) {
      await uzaSyncMebbisOturumAlarm(!!msg.enabled);
      return { ok: true, enabled: !!msg.enabled };
    }
    if (msg?.type === UZA_MSG_DD_EOKUL_UPLOAD_TO_MEB) {
      const eokul = await uzaEokulTabReady();
      if (!eokul.ok) return { ok: false, error: UZA_ERR.okulNetTabRequired() };
      return uzaRunDersProgramEokulUpload({
        fileBase64: msg.fileBase64,
        filename: msg.filename,
      });
    }
    return { ok: false, error: 'Bilinmeyen mesaj' };
  };
  run()
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
});

async function uzaMebbisPingTick() {
  const st = await chrome.storage.local.get([UZA_MEBBIS_OTURUM_ENABLED_KEY]);
  if (!st[UZA_MEBBIS_OTURUM_ENABLED_KEY]) return;
  const patterns = uzaBordroTabPatterns('mebbis_puantaj');
  const tabs = await uzaCollectTabsByPatterns(patterns);
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'UZA_BORDRO_PING' });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/bordro-export-hook.js'],
        });
        await chrome.tabs.sendMessage(tab.id, { type: 'UZA_BORDRO_PING' });
      } catch {
        /* sessiz */
      }
    }
  }
}

async function uzaOturumPingTick() {
  const st = await chrome.storage.local.get([UZA_OTURUM_ENABLED_KEY, UZA_MEBBIS_OTURUM_ENABLED_KEY]);
  if (st[UZA_MEBBIS_OTURUM_ENABLED_KEY]) void uzaMebbisPingTick();
  if (!st[UZA_OTURUM_ENABLED_KEY]) return;
  const eokul = await uzaEokulTabReady();
  if (!eokul.ok) return;
  try {
    if (!UZA_BOOTSTRAP_CACHE) await uzaLoadBootstrapViaPanel();
    const profile = uzaActiveProfile();
    if (profile?.okl08001) await uzaWarmOkl08001(profile);
  } catch {
    /* sessiz */
  }
}

async function uzaSyncMebbisOturumAlarm(enabled) {
  await chrome.storage.local.set({ [UZA_MEBBIS_OTURUM_ENABLED_KEY]: !!enabled });
  if (enabled) {
    const mins = Number(UZA_BOOTSTRAP_CACHE?.menusMeta?.mebbisOturumAcik?.pingIntervalMinutes) || 20;
    chrome.alarms.create(UZA_MEBBIS_OTURUM_ALARM, { periodInMinutes: Math.max(5, mins) });
    void uzaMebbisPingTick();
  } else {
    await chrome.alarms.clear(UZA_MEBBIS_OTURUM_ALARM);
  }
}

async function uzaSyncOturumAlarm(enabled) {
  await chrome.storage.local.set({ [UZA_OTURUM_ENABLED_KEY]: !!enabled });
  if (enabled) {
    const mins = Number(UZA_BOOTSTRAP_CACHE?.menusMeta?.oturumAcik?.pingIntervalMinutes) || 20;
    chrome.alarms.create(UZA_OTURUM_ALARM, { periodInMinutes: Math.max(5, mins) });
    void uzaOturumPingTick();
  } else {
    await chrome.alarms.clear(UZA_OTURUM_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UZA_OTURUM_ALARM) void uzaOturumPingTick();
  if (alarm.name === UZA_MEBBIS_OTURUM_ALARM) void uzaMebbisPingTick();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('gate/gate.html') });
    void chrome.storage.local.set({ [UZA_OTURUM_ENABLED_KEY]: true, [UZA_MEBBIS_OTURUM_ENABLED_KEY]: true });
    void uzaSyncOturumAlarm(true);
    void uzaSyncMebbisOturumAlarm(true);
  }
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.local.get([UZA_OTURUM_ENABLED_KEY]).then((st) => {
    if (st[UZA_OTURUM_ENABLED_KEY]) void uzaSyncOturumAlarm(true);
  });
});

void chrome.storage.local.get([UZA_OTURUM_ENABLED_KEY, UZA_MEBBIS_OTURUM_ENABLED_KEY]).then((st) => {
  if (st[UZA_OTURUM_ENABLED_KEY]) void uzaSyncOturumAlarm(true);
  if (st[UZA_MEBBIS_OTURUM_ENABLED_KEY]) void uzaSyncMebbisOturumAlarm(true);
});
