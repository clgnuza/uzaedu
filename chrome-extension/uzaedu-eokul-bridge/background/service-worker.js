importScripts(
  '../shared/brand-names.js',
  '../shared/kbs-urls.js',
  '../shared/mebbis-urls.js',
  '../shared/messaging.js',
  '../shared/panel-api-base.js',
  '../shared/oturum-sites.js',
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
  '../shared/dom-offscreen.js',
  './dom-offscreen-wrap.js',
);

let UZA_BOOTSTRAP_CACHE = null;
let UZA_EXTENSION_UI = null;

async function uzaEnsureBootstrap(token) {
  if (UZA_BOOTSTRAP_CACHE && UZA_EXTENSION_UI) return UZA_BOOTSTRAP_CACHE;
  const viaPanel = await uzaLoadBootstrapViaPanel();
  if (viaPanel.ok && viaPanel.bootstrap) return viaPanel.bootstrap;
  if (token) {
    const data = await uzaFetchJson('/eokul-bridge/v1/bootstrap', { token });
    UZA_BOOTSTRAP_CACHE = data;
    UZA_EXTENSION_UI = data?.extensionUi ?? null;
    globalThis.UZA_EXTENSION_UI = UZA_EXTENSION_UI;
    await uzaLoadKurumKeyFromStorage();
    return data;
  }
  throw new Error(viaPanel.error || 'Bootstrap yüklenemedi — panele giriş yapın.');
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

function uzaPanelApiBaseForTab(tab, apiBase) {
  if (typeof uzaPanelBrowserApiBaseFromTabUrl === 'function') {
    const fromTab = uzaPanelBrowserApiBaseFromTabUrl(tab.url, {
      apiBase,
      panelBrowserApiBase: UZA_EXTENSION_UI?.portalApi?.panelBrowserApiBase,
    });
    if (fromTab) return fromTab;
  }
  return UZA_EXTENSION_UI?.portalApi?.panelBrowserApiBase || apiBase;
}

async function uzaCookieTokenForTab(tab) {
  try {
    const u = new URL(tab.url || 'http://localhost/');
    const c = await chrome.cookies.get({ url: `${u.origin}/`, name: 'ogp_session' });
    return c?.value?.trim() || '';
  } catch {
    return '';
  }
}

async function uzaPanelFetchWithToken(panelApiBase, path, token, options = {}) {
  const base = String(panelApiBase || '').replace(/\/+$/, '');
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  if (options.body != null) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const msg = data?.message;
  const errText =
    typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(' ') : null;
  return {
    ok: res.ok,
    status: res.status,
    data,
    error: res.ok ? null : errText || res.statusText || 'İstek başarısız',
    bearer: token || null,
    apiBase: base,
  };
}

function uzaPanelBridgeMsg(tab, apiBase) {
  const panelBrowserApiBase = uzaPanelApiBaseForTab(tab, apiBase);
  return {
    apiBase,
    tabUrl: tab.url,
    panelBrowserApiBase,
  };
}

/** Panel sayfasının oturum çerezi / sessionStorage’ı yalnızca MAIN dünyada okunur. */
async function uzaPanelFetchInMainWorld(tabId, panelApiBase, path, options = {}) {
  const method = options.method || 'GET';
  const body =
    options.body != null && typeof options.body === 'object'
      ? JSON.stringify(options.body)
      : null;
  const cookieFromSw = options.cookieToken || '';
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (base, path, method, bodyStr, swCookie) => {
      const COOKIE_SESSION = '__cookie_session__';
      const root = String(base || '').replace(/\/+$/, '');
      let bearer = '';
      try {
        bearer =
          sessionStorage.getItem('ogp_bearer') ||
          localStorage.getItem('ogretmenpro_token') ||
          '';
        if (bearer === COOKIE_SESSION) bearer = '';
      } catch {
        /* ignore */
      }
      if (!bearer && swCookie) bearer = String(swCookie);
      const headers = { Accept: 'application/json' };
      if (bodyStr) headers['Content-Type'] = 'application/json';
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      const res = await fetch(`${root}${path}`, {
        method,
        credentials: 'include',
        headers,
        body: bodyStr || undefined,
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      const msg = data?.message;
      const errText =
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(' ') : null;
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: res.ok ? null : errText || res.statusText || 'İstek başarısız',
        bearer: bearer || null,
        apiBase: root,
      };
    },
    args: [panelApiBase, path, method, body, cookieFromSw],
  });
  return result || { ok: false, status: 0, data: null, error: 'Panel betiği yanıt vermedi' };
}

async function uzaPanelFetchForTab(tab, panelApiBase, path, options = {}) {
  const cookieToken = await uzaCookieTokenForTab(tab);
  if (cookieToken) {
    try {
      const viaSw = await uzaPanelFetchWithToken(panelApiBase, path, cookieToken, options);
      if (viaSw.ok || viaSw.status === 401) return viaSw;
    } catch {
      /* MAIN dünyası */
    }
  }
  return uzaPanelFetchInMainWorld(tab.id, panelApiBase, path, {
    ...options,
    cookieToken,
  });
}

async function uzaEnsurePanelBridge(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: 'UZA_PANEL_BRIDGE_PING' });
    if (ping?.ok) return true;
  } catch {
    /* enjekte et */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['shared/panel-api-base.js', 'content/siteBridge.js'],
    });
    const ping2 = await chrome.tabs.sendMessage(tabId, { type: 'UZA_PANEL_BRIDGE_PING' });
    return !!ping2?.ok;
  } catch {
    return false;
  }
}

function uzaPortalTabUsable(tab) {
  try {
    const p = new URL(tab.url || '').pathname;
    if (/^\/(login|auth|signin|kayit|register|signup)(\/|$)/i.test(p)) return false;
  } catch {
    /* ignore */
  }
  return true;
}

function uzaPortalTabScore(tab) {
  let s = 0;
  if (tab.active) s += 4;
  try {
    const p = new URL(tab.url || '').pathname;
    if (p === '/dashboard' || p.startsWith('/dashboard/')) s += 10;
    if (/e-okul-kopru|market|settings/i.test(p)) s += 3;
  } catch {
    /* ignore */
  }
  return s;
}

function uzaSortPortalTabs(tabs) {
  return [...tabs].sort((a, b) => {
    const ds = uzaPortalTabScore(b) - uzaPortalTabScore(a);
    if (ds !== 0) return ds;
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });
}

async function uzaReadPanelAuth() {
  const portalTabs = uzaSortPortalTabs(
    (await uzaCollectTabs(uzaPortalPatterns())).filter(uzaPortalTabUsable),
  );
  if (!portalTabs.length) {
    return {
      ok: false,
      error: 'Uzaedu panel sekmesi yok. http://localhost:3000 adresinde panele giriş yapın ve sekmeyi açık bırakın.',
    };
  }
  const apiBase = uzaApiBase(UZA_EXTENSION_UI);
  let scriptFailed = false;
  let lastDetail = '';
  let hadAuthResponse = false;
  for (const tab of portalTabs) {
    const panelApi = uzaPanelApiBaseForTab(tab, apiBase);
    try {
      const r = await uzaPanelFetchForTab(tab, panelApi, '/me');
      if (r?.data?.id) {
        return { ok: true, token: r.bearer, me: r.data, tabId: tab.id };
      }
      hadAuthResponse = true;
      if (r?.status === 401 || r?.data == null) {
        lastDetail =
          r?.status === 401
            ? 'Panele giriş yapılmamış.'
            : `Panel oturumu okunamadı (${r?.apiBase || panelApi}/me). Aynı sekmede panele giriş yapıp F5 yapın.`;
      } else {
        lastDetail = r?.error || `Panel oturumu okunamadı (/me HTTP ${r?.status || '?'}).`;
      }
    } catch (e) {
      scriptFailed = true;
      lastDetail = e?.message || String(e);
    }
  }
  if (hadAuthResponse) {
    return {
      ok: false,
      error: lastDetail || 'Panele giriş yapılmamış. Önce Uzaedu panelinde oturum açın.',
    };
  }
  if (scriptFailed) {
    return {
      ok: false,
      error:
        'Panel sekmesine erişilemedi. Giriş yaptığınız sekmede F5 yapın; chrome://extensions → Uzaedu Okul Köprüsü → Yenile.',
    };
  }
  return {
    ok: false,
    error: lastDetail || 'Panele giriş yapılmamış. Önce Uzaedu panelinde oturum açın.',
  };
}

async function uzaLoadBootstrapViaPanel() {
  const auth = await uzaReadPanelAuth();
  if (!auth.ok) {
    return { ok: false, error: auth.error || 'Panel oturumu yok' };
  }
  const portalTabs = uzaSortPortalTabs(
    (await uzaCollectTabs(uzaPortalPatterns())).filter(uzaPortalTabUsable),
  );
  const apiBase = uzaApiBase(UZA_EXTENSION_UI);
  for (const tab of portalTabs) {
    try {
      const panelApi = uzaPanelApiBaseForTab(tab, apiBase);
      const r = await uzaPanelFetchForTab(tab, panelApi, '/eokul-bridge/v1/bootstrap');
      if (r?.ok && r.data) {
        UZA_BOOTSTRAP_CACHE = r.data;
        UZA_EXTENSION_UI = r.data.extensionUi ?? null;
        globalThis.UZA_EXTENSION_UI = UZA_EXTENSION_UI;
        await uzaLoadKurumKeyFromStorage();
        return { ok: true, token: r.bearer || null, bootstrap: r.data };
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

async function uzaBridgeCodeVerifiedMap() {
  const st = await chrome.storage.local.get([UZA_BRIDGE_CODE_VERIFIED_KEY]);
  const m = st[UZA_BRIDGE_CODE_VERIFIED_KEY];
  return m && typeof m === 'object' ? m : {};
}

async function uzaSetBridgeCodeVerified(schoolId) {
  const map = await uzaBridgeCodeVerifiedMap();
  map[schoolId] = Date.now();
  await chrome.storage.local.set({ [UZA_BRIDGE_CODE_VERIFIED_KEY]: map });
}

async function uzaIsBridgeCodeVerified(schoolId) {
  const map = await uzaBridgeCodeVerifiedMap();
  return !!map[schoolId];
}

function uzaApplyBridgeCodeVerified(access, verifiedSchools) {
  const schoolId = access?.school?.id;
  if (schoolId && verifiedSchools[schoolId] && access?.tier === 'paid') {
    return {
      ...access,
      requiresCode: false,
      canUseBridge: access.moduleEnabled && access.licenseActive,
      codeVerified: true,
    };
  }
  return access;
}

async function uzaFetchSchoolAccessViaPanel() {
  const apiBase = uzaApiBase(UZA_EXTENSION_UI);
  const portalTabs = uzaSortPortalTabs(
    (await uzaCollectTabs(uzaPortalPatterns())).filter(uzaPortalTabUsable),
  );
  let lastErr = '';
  for (const tab of portalTabs) {
    const panelApi = uzaPanelApiBaseForTab(tab, apiBase);
    try {
      const r = await uzaPanelFetchForTab(tab, panelApi, '/eokul-bridge/v1/school-access');
      if (r?.ok && r.data) return { ok: true, access: r.data, bearer: r.bearer || null };
      if (r?.error) lastErr = r.error;
    } catch {
      /* sonraki sekme */
    }
  }
  return {
    ok: false,
    error: lastErr || 'Panel sekmesinde okul bilgisi alınamadı. Paneli F5 ile yenileyin.',
  };
}

async function uzaFetchSchoolAccess(auth) {
  const verifiedSchools = await uzaBridgeCodeVerifiedMap();
  const viaPanel = await uzaFetchSchoolAccessViaPanel();
  if (viaPanel.ok) {
    return uzaApplyBridgeCodeVerified(viaPanel.access, verifiedSchools);
  }
  if (auth?.token) {
    const data = await uzaFetchJson('/eokul-bridge/v1/school-access', { token: auth.token });
    return uzaApplyBridgeCodeVerified(data, verifiedSchools);
  }
  throw new Error(viaPanel.error || 'Okul lisansı okunamadı.');
}

async function uzaAssertSchoolBridgeAccess(auth) {
  const access = await uzaFetchSchoolAccess(auth);
  if (!access?.moduleEnabled) {
    throw new Error(access?.message || 'Okul Köprüsü modülü Market’ten açılmalıdır.');
  }
  if (!access?.canUseBridge) {
    throw new Error(access?.message || 'Köprü kullanılamıyor.');
  }
  return access;
}

async function uzaBridgeTabsSnapshot() {
  const eokul = await uzaEokulTabReady();
  const mebbisTabs = await uzaCollectTabs(uzaMebbisTabPatterns());
  const kbsTabs = await uzaCollectTabs(uzaKbsTabPatterns());
  return {
    eokul,
    mebbisTabs,
    kbsTabs,
    eokulReady: !!eokul.ok,
    mebbisReady: mebbisTabs.length > 0,
    kbsReady: kbsTabs.length > 0,
    bordroReady: mebbisTabs.length > 0 || kbsTabs.length > 0,
  };
}

async function runGateFlow() {
  const feature = await uzaFetchJson('/eokul-bridge/v1/extension/feature-enabled');
  if (!feature?.enabled) {
    throw new Error(feature?.message || 'Köprü geçici olarak kapalı.');
  }
  const auth = await uzaReadPanelAuth();
  if (!auth.ok) throw new Error(auth.error || 'Panel oturumu yok');
  await uzaAssertSchoolBridgeAccess(auth);
  const loaded = await uzaLoadBootstrapViaPanel();
  if (!loaded.ok) {
    const token = auth.token;
    if (token) await uzaEnsureBootstrap(token);
    else throw new Error(loaded.error || 'Yapılandırma alınamadı');
  }
  const tabs = await uzaBridgeTabsSnapshot();
  let kurumKey = uzaGetKurumKey() || 'ilkOgretim';
  const eokulTab = tabs.eokul.tabs?.[0];
  if (eokulTab?.url) {
    const detected = uzaDetectKurumFromUrl(eokulTab.url);
    if (detected) kurumKey = detected;
    await uzaSaveKurumKey(kurumKey);
  }
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
  return {
    ok: true,
    payload,
    eokulReady: tabs.eokulReady,
    bordroReady: tabs.bordroReady,
    hint: !tabs.eokulReady && tabs.bordroReady
      ? 'e-Okul sekmesi yok; MEBBİS/KBS modülleri kullanılabilir.'
      : !tabs.eokulReady
        ? 'e-Okul sekmesi yok; e-Okul modülleri için sekme açın.'
        : null,
  };
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
  return Array.isArray(p) && p.length ? p : UZA_KBS_TAB_PATTERNS;
}

async function uzaOturumRowsForGate() {
  const sitesMap = await uzaGetOturumSites();
  const defs = typeof UZA_OTURUM_SITE_DEFS !== 'undefined' ? UZA_OTURUM_SITE_DEFS : [];
  const rows = [];
  for (const def of defs) {
    const pingOn = typeof uzaOturumSiteEnabled === 'function' && uzaOturumSiteEnabled(sitesMap, def.id);
    const tabs = pingOn ? await uzaCollectTabs(def.tabPatterns || []) : [];
    rows.push({
      id: def.id,
      label: def.label,
      hint: def.hint || '',
      pingOn,
      tabCount: tabs.length,
      ready: tabs.length > 0,
    });
  }
  return rows;
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
  const panelAuth = await uzaReadPanelAuth();
  const tabs = await uzaBridgeTabsSnapshot();
  const oturumSites = await uzaOturumRowsForGate();
  let schoolAccess = null;
  try {
    if (panelAuth.ok) schoolAccess = await uzaFetchSchoolAccess(panelAuth);
  } catch {
    /* panel yok */
  }
  const gateStored = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY];
  return {
    ok: true,
    portalConnected: portal.length > 0,
    panelSessionOk: panelAuth.ok,
    panelAuthError: panelAuth.ok ? null : panelAuth.error || null,
    eokulReady: tabs.eokulReady,
    mebbisReady: tabs.mebbisReady,
    kbsReady: tabs.kbsReady,
    bordroReady: tabs.bordroReady,
    eokulOptional: !tabs.eokulReady && tabs.bordroReady,
    portalTabCount: portal.length,
    eokulTabCount: tabs.eokul.tabs?.length ?? 0,
    mebbisTabCount: tabs.mebbisTabs.length,
    kbsTabCount: tabs.kbsTabs.length,
    oturumSites,
    schoolAccess,
    gatePayload: gateStored || null,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    if (msg?.type === UZA_MSG_FLOAT_STORAGE_GET) {
      const keys = Array.isArray(msg.keys) ? msg.keys : [];
      const data = await chrome.storage.local.get(keys);
      return { ok: true, data };
    }
    if (msg?.type === UZA_MSG_FLOAT_STORAGE_SET) {
      const data = msg.data && typeof msg.data === 'object' ? msg.data : {};
      await chrome.storage.local.set(data);
      return { ok: true };
    }
    if (msg?.type === UZA_MSG_FLOAT_SESSION_GET) {
      const keys = Array.isArray(msg.keys) ? msg.keys : [UZA_SESSION_GATE_KEY];
      const data = await chrome.storage.session.get(keys);
      return { ok: true, data };
    }
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
    if (msg?.type === UZA_MSG_GATE_DIAGNOSTIC) {
      const apiBase = uzaApiBase(UZA_EXTENSION_UI);
      const portalTabs = uzaSortPortalTabs(
        (await uzaCollectTabs(uzaPortalPatterns())).filter(uzaPortalTabUsable),
      );
      const tabs = [];
      for (const tab of portalTabs) {
        const row = { url: tab.url, active: !!tab.active };
        const panelApi = uzaPanelApiBaseForTab(tab, apiBase);
        try {
          const meRes = await uzaPanelFetchForTab(tab, panelApi, '/me');
          row.diag = {
            ok: true,
            apiBase: meRes.apiBase || panelApi,
            hasBearer: !!meRes.bearer,
            meStatus: meRes.status,
            meOk: !!meRes.data?.id,
            schoolName: meRes.data?.school?.name || null,
          };
        } catch (e) {
          row.error = e?.message || String(e);
        }
        tabs.push(row);
      }
      const auth = await uzaReadPanelAuth();
      return {
        ok: true,
        report: {
          extVersion: chrome.runtime.getManifest().version,
          portalTabCount: portalTabs.length,
          tabs,
          auth,
        },
      };
    }
    if (msg?.type === UZA_MSG_GATE_SCHOOL_ACCESS) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error, diagnostic: true };
      try {
        const access = await uzaFetchSchoolAccess(auth);
        return { ok: true, access };
      } catch (e) {
        const raw = e?.message || String(e);
        console.error('[Uzaedu] GATE_SCHOOL_ACCESS', raw, e);
        return { ok: false, error: raw, diagnostic: true };
      }
    }
    if (msg?.type === UZA_MSG_GATE_VERIFY_CODE) {
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      try {
        const apiBase = uzaApiBase(UZA_EXTENSION_UI);
        const code = String(msg.code || '').trim();
        let r = null;
        const portalTabs = uzaSortPortalTabs(
          (await uzaCollectTabs(uzaPortalPatterns())).filter(uzaPortalTabUsable),
        );
        for (const tab of portalTabs) {
          try {
            const panelApi = uzaPanelApiBaseForTab(tab, apiBase);
            const pr = await uzaPanelFetchForTab(tab, panelApi, '/eokul-bridge/v1/school-access/verify', {
              method: 'POST',
              body: { code },
            });
            if (pr?.ok && pr.data) {
              r = pr.data;
              break;
            }
            if (pr?.error) return { ok: false, error: pr.error };
          } catch {
            /* sonraki */
          }
        }
        if (!r && auth.token) {
          r = await uzaFetchJson('/eokul-bridge/v1/school-access/verify', {
            token: auth.token,
            method: 'POST',
            body: { code },
          });
        }
        if (!r) {
          return { ok: false, error: 'Kod doğrulanamadı. Panel sekmesini yenileyin.' };
        }
        const sid = r?.school?.id;
        if (sid && r?.verified) await uzaSetBridgeCodeVerified(sid);
        const verifiedSchools = await uzaBridgeCodeVerifiedMap();
        return { ok: true, access: uzaApplyBridgeCodeVerified(r, verifiedSchools) };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
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
      if (!UZA_EXTENSION_UI) {
        try {
          if (msg.token) await uzaEnsureBootstrap(msg.token);
          else {
            const auth = await uzaReadPanelAuth();
            if (auth.ok) await uzaLoadBootstrapViaPanel();
          }
        } catch {
          /* gate varsayılan metinleri */
        }
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
    if (msg?.type === UZA_MSG_OTURUM_SITES_SET) {
      const merged = Object.assign(
        uzaOturumDefaultSitesMap(),
        msg.sites && typeof msg.sites === 'object' ? msg.sites : {},
      );
      await uzaPersistOturumSites(merged);
      await uzaRefreshOturumAlarm();
      return { ok: true, sites: merged };
    }
    if (msg?.type === UZA_MSG_OTURUM_SET) {
      const sites = await uzaGetOturumSites();
      sites.eokul = !!msg.enabled;
      await uzaPersistOturumSites(sites);
      await uzaRefreshOturumAlarm();
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
    if (msg?.type === 'UZA_BORDRO_EXCEL_STORED') {
      if (msg.fileBase64) {
        await uzaStoreBordroExcel({
          fileBase64: msg.fileBase64,
          filename: msg.filename || 'bordro.xlsx',
          contentType: msg.contentType,
          source: msg.source || 'kbs',
          url: msg.url,
        });
      }
      return { ok: true, filename: msg.filename };
    }
    if (msg?.type === UZA_MSG_BORDRO_KBS_CLICK_EXPORT || msg?.type === UZA_MSG_BORDRO_MAAS_CLICK_EXPORT) {
      return uzaClickKbsExportOnTab(msg.bordroType || 'maas_bordro');
    }
    if (msg?.type === UZA_MSG_BORDRO_OPEN_TAB) {
      const url =
        msg.bordroType === 'mebbis_puantaj'
          ? UZA_MEBBIS_PUANTAJ_URL
          : uzaKbsOpenUrl(msg.bordroType || 'ek_ders_bordro');
      await chrome.tabs.create({ url });
      return { ok: true, url };
    }
    if (msg?.type === UZA_MSG_BORDRO_OPEN_MEBBIS_REPORT) {
      return uzaOpenMebbisReport();
    }
    if (msg?.type === UZA_MSG_BORDRO_MEBBIS_VIEW_REPORT) {
      const tabs = await uzaCollectTabsByPatterns(uzaBordroTabPatterns('mebbis_puantaj'));
      const tab = uzaPickBordroTab(tabs, 'mebbis_puantaj');
      if (!tab?.id) {
        return { ok: false, error: 'MEBBİS sekmesi yok. Önce ekd04002 puantaj sayfasını açın.' };
      }
      const view = await uzaMebbisViewReportOnTab(tab.id);
      if (!view?.ok) return view;
      await new Promise((r) => setTimeout(r, 3500));
      const auth = await uzaReadPanelAuth();
      if (!auth.ok) return { ok: false, error: auth.error };
      const gate = (await uzaStorageGet([UZA_SESSION_GATE_KEY]))[UZA_SESSION_GATE_KEY] || {};
      try {
        const data = await uzaBordroScrapeAndParse({
          bordroType: 'mebbis_puantaj',
          scrapeMode: 'puantaj',
          donem: msg.donem,
          token: auth.token,
          schoolId: gate.schoolId || null,
          schoolName: msg.schoolName || gate.schoolName,
          footerNote: msg.footerNote,
        });
        return { ok: true, ...data };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
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
    if (msg?.type === UZA_MSG_BORDRO_SCRAPE_DIAG) {
      return uzaBordroScrapeDiag(msg.bordroType || 'ek_ders_bordro', msg.scrapeMode || 'bordro');
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
    if (msg?.type === UZA_MSG_KBS_OTURUM_SET) {
      await chrome.storage.local.set({ [UZA_KBS_OTURUM_ENABLED_KEY]: !!msg.enabled });
      await uzaRefreshOturumAlarm();
      return { ok: true, enabled: !!msg.enabled };
    }
    if (msg?.type === UZA_MSG_MEBBIS_OTURUM_SET) {
      const sites = await uzaGetOturumSites();
      sites.mebbis = !!msg.enabled;
      await uzaPersistOturumSites(sites);
      await uzaRefreshOturumAlarm();
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
    .catch((e) =>
      sendResponse({
        ok: false,
        error: typeof uzaHumanError === 'function' ? uzaHumanError(e?.message || e) : e?.message || String(e),
      }),
    );
  return true;
});

async function uzaPingTabsByPatterns(patterns) {
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

async function uzaGetOturumSites() {
  const st = await chrome.storage.local.get([
    UZA_OTURUM_SITES_KEY,
    UZA_OTURUM_ENABLED_KEY,
    UZA_MEBBIS_OTURUM_ENABLED_KEY,
  ]);
  if (st[UZA_OTURUM_SITES_KEY] && typeof st[UZA_OTURUM_SITES_KEY] === 'object') {
    return Object.assign(uzaOturumDefaultSitesMap(), st[UZA_OTURUM_SITES_KEY]);
  }
  return uzaOturumSitesFromLegacy(st);
}

async function uzaPersistOturumSites(sitesMap) {
  await chrome.storage.local.set({
    [UZA_OTURUM_SITES_KEY]: sitesMap,
    ...uzaOturumLegacyKeysFromSites(sitesMap),
  });
}

async function uzaPingSiteTabs(siteDef) {
  const tabs = await uzaCollectTabsByPatterns(siteDef.tabPatterns || []);
  const pingType = siteDef.pingType || 'UZA_MEB_OTURUM_PING';
  const scriptFile = siteDef.pingScript || 'content/meb-oturum-ping.js';
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: pingType });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [scriptFile],
        });
        await chrome.tabs.sendMessage(tab.id, { type: pingType });
      } catch {
        /* sessiz */
      }
    }
  }
}

async function uzaOturumPingTick() {
  const sitesMap = await uzaGetOturumSites();
  for (const def of UZA_OTURUM_SITE_DEFS) {
    if (!uzaOturumSiteEnabled(sitesMap, def.id)) continue;
    await uzaPingSiteTabs(def);
    if (def.warmOkl08001) {
      try {
        if (!UZA_BOOTSTRAP_CACHE) {
          const auth = await uzaReadPanelAuth();
          if (auth.ok) await uzaLoadBootstrapViaPanel();
        }
        const profile = uzaActiveProfile();
        if (profile?.okl08001) await uzaWarmOkl08001(profile);
      } catch {
        /* sessiz */
      }
    }
  }
  const kbsSt = await chrome.storage.local.get([UZA_KBS_OTURUM_ENABLED_KEY]);
  if (kbsSt[UZA_KBS_OTURUM_ENABLED_KEY]) {
    await uzaPingTabsByPatterns(uzaKbsTabPatterns());
  }
}

async function uzaRefreshOturumAlarm() {
  const sites = await uzaGetOturumSites();
  const kbsSt = await chrome.storage.local.get([UZA_KBS_OTURUM_ENABLED_KEY]);
  await uzaSyncOturumAlarm(uzaOturumAnySiteEnabled(sites) || !!kbsSt[UZA_KBS_OTURUM_ENABLED_KEY]);
}

async function uzaSyncOturumAlarm(enabled) {
  if (enabled) {
    const mins = Number(UZA_BOOTSTRAP_CACHE?.menusMeta?.oturumAcik?.pingIntervalMinutes) || 10;
    chrome.alarms.create(UZA_OTURUM_ALARM, { periodInMinutes: Math.max(5, mins) });
    void uzaOturumPingTick();
  } else {
    await chrome.alarms.clear(UZA_OTURUM_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UZA_OTURUM_ALARM) void uzaOturumPingTick();
});

const UZA_FLOAT_HOST_TAB_URLS = [
  'http://localhost:3000/*',
  'http://127.0.0.1:3000/*',
  'http://0.0.0.0:3000/*',
  'https://admin.uzaedu.com/*',
  'https://uzaedu.com/*',
  'https://www.uzaedu.com/*',
  'https://e-okul.meb.gov.tr/*',
  'https://eokulyd.meb.gov.tr/*',
  'https://mebbis.meb.gov.tr/*',
  'https://www.mebbis.meb.gov.tr/*',
  'https://mebbisyd.meb.gov.tr/*',
  'https://www.mebbisyd.meb.gov.tr/*',
  'https://kbs.muhasebat.gov.tr/*',
  'https://www.kbs.muhasebat.gov.tr/*',
  'https://kbs.gov.tr/*',
  'https://www.kbs.gov.tr/*',
  'https://giris.hmb.gov.tr/*',
];

async function uzaFloatHostTeardownTab(tabId) {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UZA_FLOAT_TEARDOWN' });
  } catch {
    /* */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.getElementById('uza-float-host-root')?.remove(),
    });
  } catch {
    /* */
  }
}

async function uzaFloatHostReinjectOpenTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: UZA_FLOAT_HOST_TAB_URLS });
  } catch {
    return;
  }
  for (const tab of tabs) {
    if (!tab.id) continue;
    await uzaFloatHostTeardownTab(tab.id);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/float-host.js'],
      });
    } catch {
      /* */
    }
  }
}

async function uzaFloatPanelOnTab(tabId) {
  if (tabId == null) return false;
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'UZA_FLOAT_TOGGLE' });
    if (r?.ok !== false) return true;
  } catch {
    /* içerik betiği yok veya eski bağlam */
  }
  await uzaFloatHostTeardownTab(tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/float-host.js'],
    });
    await chrome.tabs.sendMessage(tabId, { type: 'UZA_FLOAT_OPEN' });
    return true;
  } catch {
    return false;
  }
}

function uzaFloatPopupUrl() {
  const gate = chrome.runtime.getURL('gate/gate.html?embed=1');
  return gate;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  const opened = await uzaFloatPanelOnTab(tab.id);
  if (opened) return;
  const url = tab.url || '';
  if (/^(chrome|edge|about|devtools):/i.test(url) || !url) {
    await chrome.windows.create({
      url: uzaFloatPopupUrl(),
      type: 'popup',
      width: 480,
      height: 760,
      focused: true,
    });
    return;
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL('gate/gate.html') });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('gate/gate.html') });
    const sites = uzaOturumDefaultSitesMap();
    void chrome.storage.local.set({
      [UZA_OTURUM_SITES_KEY]: sites,
      ...uzaOturumLegacyKeysFromSites(sites),
      [UZA_KBS_OTURUM_ENABLED_KEY]: true,
    });
    void uzaSyncOturumAlarm(true);
  }
  if (details.reason === 'install' || details.reason === 'update') {
    void uzaFloatHostReinjectOpenTabs();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void uzaRefreshOturumAlarm();
});

void chrome.storage.local
  .get([
    UZA_OTURUM_SITES_KEY,
    UZA_OTURUM_ENABLED_KEY,
    UZA_MEBBIS_OTURUM_ENABLED_KEY,
    UZA_KBS_OTURUM_ENABLED_KEY,
  ])
  .then(async (st) => {
    if (!st[UZA_OTURUM_SITES_KEY]) {
      const sites = uzaOturumSitesFromLegacy(st);
      await chrome.storage.local.set({
        [UZA_OTURUM_SITES_KEY]: sites,
        ...uzaOturumLegacyKeysFromSites(sites),
      });
    }
    await uzaRefreshOturumAlarm();
  });
