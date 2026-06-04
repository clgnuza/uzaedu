/** Oturum açık tut — EduPanel tarzı MEB siteleri */
var UZA_OTURUM_SITES_KEY = 'uzaOturumSites';
var UZA_MSG_OTURUM_SITES_SET = 'UZA_OTURUM_SITES_SET';

var UZA_OTURUM_SITE_DEFS = [
  {
    id: 'mebbis',
    label: 'MEBBİS',
    hint: 'Bakanlık uygulama girişi (MEBBİS vb.)',
    icon: 'payroll',
    platform: 'mebbis',
    defaultOn: true,
    tabPatterns: [
      'https://mebbis.meb.gov.tr/*',
      'https://www.mebbis.meb.gov.tr/*',
      'https://mebbisyd.meb.gov.tr/*',
      'https://www.mebbisyd.meb.gov.tr/*',
    ],
    pingType: 'UZA_BORDRO_PING',
    pingScript: 'content/bordro-export-hook.js',
  },
  {
    id: 'eokul',
    label: 'e-Okul',
    hint: 'Okul bilgi sistemi (e-Okul)',
    icon: 'school',
    platform: 'eokul',
    defaultOn: true,
    tabPatterns: ['https://e-okul.meb.gov.tr/*', 'https://eokulyd.meb.gov.tr/*'],
    pingType: 'UZA_EOKUL_PING',
    pingScript: 'content/eokul-oturum-ping.js',
    warmOkl08001: true,
  },
  {
    id: 'ebys',
    label: 'EBYS',
    hint: 'Elektronik belge yönetimi',
    icon: 'file',
    platform: 'panel',
    defaultOn: true,
    tabPatterns: ['https://ebys.meb.gov.tr/*', 'https://www.ebys.meb.gov.tr/*'],
    pingType: 'UZA_MEB_OTURUM_PING',
    pingScript: 'content/meb-oturum-ping.js',
  },
  {
    id: 'k12',
    label: 'K12 Panel',
    hint: 'Okul web sitesi yönetimi (meb.k12.tr)',
    icon: 'users',
    platform: 'panel',
    defaultOn: false,
    tabPatterns: ['https://meb.k12.tr/*', 'https://*.meb.k12.tr/*'],
    pingType: 'UZA_MEB_OTURUM_PING',
    pingScript: 'content/meb-oturum-ping.js',
  },
  {
    id: 'tefbis',
    label: 'TEFBİS',
    hint: 'Temel eğitim bilgi sistemi',
    icon: 'school',
    platform: 'panel',
    defaultOn: false,
    tabPatterns: ['https://tefbis.meb.gov.tr/*', 'https://www.tefbis.meb.gov.tr/*'],
    pingType: 'UZA_MEB_OTURUM_PING',
    pingScript: 'content/meb-oturum-ping.js',
  },
  {
    id: 'ekurs',
    label: 'e-Kurs',
    hint: 'Kurs yönetim sistemi',
    icon: 'calendar',
    platform: 'panel',
    defaultOn: false,
    tabPatterns: [
      'https://e-kurs.meb.gov.tr/*',
      'https://www.e-kurs.meb.gov.tr/*',
      'https://ekurs.meb.gov.tr/*',
      'https://www.ekurs.meb.gov.tr/*',
    ],
    pingType: 'UZA_MEB_OTURUM_PING',
    pingScript: 'content/meb-oturum-ping.js',
  },
];

function uzaOturumSiteDef(siteId) {
  for (var i = 0; i < UZA_OTURUM_SITE_DEFS.length; i++) {
    if (UZA_OTURUM_SITE_DEFS[i].id === siteId) return UZA_OTURUM_SITE_DEFS[i];
  }
  return null;
}

function uzaOturumSiteEnabled(sitesMap, siteId) {
  var def = uzaOturumSiteDef(siteId);
  if (!sitesMap || sitesMap[siteId] === undefined) return def ? !!def.defaultOn : false;
  return !!sitesMap[siteId];
}

function uzaOturumAnySiteEnabled(sitesMap) {
  for (var i = 0; i < UZA_OTURUM_SITE_DEFS.length; i++) {
    if (uzaOturumSiteEnabled(sitesMap, UZA_OTURUM_SITE_DEFS[i].id)) return true;
  }
  return false;
}

function uzaOturumDefaultSitesMap() {
  var map = {};
  for (var i = 0; i < UZA_OTURUM_SITE_DEFS.length; i++) {
    var s = UZA_OTURUM_SITE_DEFS[i];
    map[s.id] = !!s.defaultOn;
  }
  return map;
}

function uzaOturumSitesFromLegacy(stored) {
  var map = uzaOturumDefaultSitesMap();
  if (!stored) return map;
  if (stored[UZA_OTURUM_SITES_KEY] && typeof stored[UZA_OTURUM_SITES_KEY] === 'object') {
    return Object.assign(map, stored[UZA_OTURUM_SITES_KEY]);
  }
  for (var i = 0; i < UZA_OTURUM_SITE_DEFS.length; i++) {
    var id = UZA_OTURUM_SITE_DEFS[i].id;
    if (stored[id] !== undefined) map[id] = !!stored[id];
  }
  if (stored[UZA_OTURUM_ENABLED_KEY] !== undefined) map.eokul = !!stored[UZA_OTURUM_ENABLED_KEY];
  if (stored[UZA_MEBBIS_OTURUM_ENABLED_KEY] !== undefined) map.mebbis = !!stored[UZA_MEBBIS_OTURUM_ENABLED_KEY];
  return map;
}

function uzaOturumLegacyKeysFromSites(sitesMap) {
  var out = {};
  if (sitesMap) {
    if (sitesMap.eokul !== undefined) out[UZA_OTURUM_ENABLED_KEY] = !!sitesMap.eokul;
    if (sitesMap.mebbis !== undefined) out[UZA_MEBBIS_OTURUM_ENABLED_KEY] = !!sitesMap.mebbis;
  }
  return out;
}
