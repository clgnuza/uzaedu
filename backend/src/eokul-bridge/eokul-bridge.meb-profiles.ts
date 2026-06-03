/** E-Okul URL şablonları — bootstrap ile eklentiye gider (Faz 1: ilköğretim JSON). */

const MEB = 'https://e-okul.meb.gov.tr';

export const EOKUL_BRIDGE_MEB_ORIGIN = MEB;

export const EOKUL_BRIDGE_KURUM_PROFILES: Record<string, Record<string, string>> = {
  okulOncesi: {
    label: 'Okul öncesi',
    oklPrefix: 'AOK',
    ogrPrefix: 'AOG',
    oklPageCode: 'AOK08001',
    okl08001: `${MEB}/OkulOncesi/OKL/AOK08001.aspx`,
    okl08002: `${MEB}/OkulOncesi/OKL/AOK08002.aspx`,
    ogrBase: `${MEB}/OkulOncesi/OGR/`,
    ogr01001: `${MEB}/OkulOncesi/OGR/AOG01001.aspx`,
    ogr01001File: 'AOG01001.aspx',
    ogr02001: `${MEB}/OkulOncesi/OGR/AOG02001.aspx`,
    ogr02002: `${MEB}/OkulOncesi/OGR/AOG02002.aspx`,
    ogr02003GetVeri: `${MEB}/OkulOncesi/OGR/AOG02003.aspx/GetVeri`,
    ogr02014: `${MEB}/OkulOncesi/OGR/AOG02014.aspx`,
    ogr02015: `${MEB}/OkulOncesi/OGR/AOG02015.aspx`,
    ogr02019: `${MEB}/OkulOncesi/OGR/AOG02019.aspx`,
    oklProgramImport: `${MEB}/OkulOncesi/OKL/AOK03001.aspx`,
  },
  ilkOgretim: {
    label: 'İlköğretim',
    oklPrefix: 'IOK',
    ogrPrefix: 'IOG',
    oklPageCode: 'IOK08001',
    okl08001: `${MEB}/IlkOgretim/OKL/IOK08001.aspx`,
    okl08002: `${MEB}/IlkOgretim/OKL/IOK08002.aspx`,
    okl00001: `${MEB}/IlkOgretim/OKL/IOK00001.aspx`,
    ogrBase: `${MEB}/IlkOgretim/OGR/`,
    ogr01001: `${MEB}/IlkOgretim/OGR/IOG01001.aspx`,
    ogr01001File: 'IOG01001.aspx',
    ogr02001: `${MEB}/IlkOgretim/OGR/IOG02001.aspx`,
    ogr02001File: 'IOG02001.aspx',
    ogr02002: `${MEB}/IlkOgretim/OGR/IOG02002.aspx`,
    ogr02003GetVeri: `${MEB}/IlkOgretim/OGR/IOG02003.aspx/GetVeri`,
    ogr02014: `${MEB}/IlkOgretim/OGR/IOG02014.aspx`,
    ogr02015: `${MEB}/IlkOgretim/OGR/IOG02015.aspx`,
    ogr02015File: 'IOG02015.aspx',
    ogr02019: `${MEB}/IlkOgretim/OGR/IOG02019.aspx`,
    ogr02019File: 'IOG02019.aspx',
    ogr02012: `${MEB}/IlkOgretim/OGR/IOG02012.aspx`,
    ogr02012File: 'IOG02012.aspx',
    ogr02013: `${MEB}/IlkOgretim/OGR/IOG02013.aspx`,
    ogr02013File: 'IOG02013.aspx',
    oklProgramImport: `${MEB}/IlkOgretim/OKL/IOK03001.aspx`,
  },
  ortaOgretim: {
    label: 'Ortaöğretim',
    oklPrefix: 'OOK',
    ogrPrefix: 'OOG',
    oklPageCode: 'OOK08001',
    okl01001: `${MEB}/OrtaOgretim/OKL/OOK01001.aspx`,
    okl08001: `${MEB}/OrtaOgretim/OKL/OOK08001.aspx`,
    okl08002: `${MEB}/OrtaOgretim/OKL/OOK08002.aspx`,
    okl00001: `${MEB}/OrtaOgretim/OKL/OOK00001.aspx`,
    ogrBase: `${MEB}/OrtaOgretim/OGR/`,
    ogr01001: `${MEB}/OrtaOgretim/OGR/OOG01001.aspx`,
    ogr01001File: 'OOG01001.aspx',
    ogr02001: `${MEB}/OrtaOgretim/OGR/OOG02001.aspx`,
    ogr02002: `${MEB}/OrtaOgretim/OGR/OOG02002.aspx`,
    ogr02003GetVeri: `${MEB}/OrtaOgretim/OGR/OOG02003.aspx/GetVeri`,
    ogr02014: `${MEB}/OrtaOgretim/OGR/OOG02014.aspx`,
    ogr02012: `${MEB}/OrtaOgretim/OGR/OOG02012.aspx`,
    ogr02013: `${MEB}/OrtaOgretim/OGR/OOG02013.aspx`,
    ogr02015: `${MEB}/OrtaOgretim/OGR/OOG02015.aspx`,
    ogr02019: `${MEB}/OrtaOgretim/OGR/OOG02019.aspx`,
    oklProgramImport: `${MEB}/OrtaOgretim/OKL/OOK03001.aspx`,
  },
};

export const EOKUL_BRIDGE_KURUM_ALL = ['okulOncesi', 'ilkOgretim', 'ortaOgretim'] as const;

export const EOKUL_BRIDGE_CONSTANTS = {
  mebAllowedHostname: 'e-okul.meb.gov.tr',
  girisPathNormalized: '/E-Okul-Ogretmen-Portal/Account/Login',
  loginResponseUrlRegex: '(?i)login|giris|Account',
  fetchChainKeys: {
    sessionWarm: 'sessionWarm',
    listPageTwice: 'listPageTwice',
    mektup08002Twice: 'mektup08002Twice',
  },
  loginPageHeuristics: {
    pathMarkers: ['login', 'giris'],
    passwordMarkers: ['password', 'sifre', 'şifre'],
    maxScanChars: 120000,
  },
  coreErrors: {
    fetchChainMissing: 'Zincir tanımı eksik',
    profileFieldMissing: 'Profil alanı eksik',
    k08001Invalid: 'Liste sayfası yüklenemedi',
  },
  ogr02003GetVeriKeys: {},
};

export const EOKUL_BRIDGE_FETCH_CHAINS: Record<string, Array<{ url: string; method: string; keepLastHtml?: boolean }>> = {
  sessionWarm: [{ url: '{{okl08001}}', method: 'GET' }],
  listPageTwice: [{ url: '{{okl08001}}', method: 'GET', keepLastHtml: true }],
  mektup08002Twice: [{ url: '{{okl08002}}', method: 'GET', keepLastHtml: true }],
};
