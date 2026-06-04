/**
 * E-Okul köprüsü — sunucu yapılandırması (Faz 0+).
 * MEB sayfa değişikliklerinde bu dosya + deploy ile güncellenir.
 */

import {
  EOKUL_BRIDGE_CONSTANTS,
  EOKUL_BRIDGE_FETCH_CHAINS,
  EOKUL_BRIDGE_KURUM_PROFILES,
  EOKUL_BRIDGE_KURUM_ALL,
  EOKUL_BRIDGE_MEB_ORIGIN,
} from './eokul-bridge.meb-profiles';
import { EOKUL_BRIDGE_DOM_RUNTIME } from './eokul-bridge.dom-runtime';
import { EOKUL_BRIDGE_OGR_DOSYA_GROUPS } from './eokul-bridge-ogr-dosya-groups';

export const EOKUL_BRIDGE_MIN_EXTENSION_VERSION = '0.6.0';

export const EOKUL_BRIDGE_KURUM_ILK = ['okulOncesi', 'ilkOgretim'] as const;
export const EOKUL_BRIDGE_KURUM_BOTH = ['ilkOgretim', 'ortaOgretim'] as const;

export type EokulBridgeMenuDef = {
  id: string;
  label: string;
  description: string;
  phase: number;
  direction: 'pull' | 'push' | 'both';
  panelPath?: string;
  enabled: boolean;
};

export const EOKUL_BRIDGE_MENUS: EokulBridgeMenuDef[] = [
  {
    id: 'kelebekSinavOgrenciAktar',
    label: 'Kelebek sınıf/öğrenci',
    description: 'e-Okul sınıf/öğrenci listesini kelebek modülüne aktarır.',
    phase: 1,
    direction: 'pull',
    panelPath: '/kelebek-sinav/sinif-ogrenci',
    enabled: true,
  },
  {
    id: 'gunlukDevamsizlikAktar',
    label: 'Günlük devamsızlık',
    description: 'e-Okul günlük devamsızlığı mesaj merkezi kampanyasına aktarır.',
    phase: 2,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/devamsizlik',
    enabled: true,
  },
  {
    id: 'eyoklamaDersDevamsizlikAktar',
    label: 'Sınıf yoklama (ders)',
    description: 'e-yoklama (ders bazlı) listesini mesaj merkezine aktarır.',
    phase: 2,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/ders-devamsizlik',
    enabled: true,
  },
  {
    id: 'toplamDevamsizlikAktar',
    label: 'Toplam devamsızlık',
    description: 'Özürlü/özürsüz toplamları mesaj merkezine aktarır (Faz 3).',
    phase: 3,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/devamsizlik',
    enabled: true,
  },
  {
    id: 'devamsizlikMektubuEokul',
    label: 'Devamsızlık mektubu',
    description: 'OKL08002 mektup listesini alıcı olarak panele aktarır (PDF panelde üretilir).',
    phase: 3,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/devamsizlik-mektup',
    enabled: true,
  },
  {
    id: 'ogrenciDosyaBilgileriAl',
    label: 'Öğrenci dosya bilgileri',
    description: 'Grup/alan seçerek CSV dışa aktarım (öğrenci listesi, veli bilgileri).',
    phase: 4,
    direction: 'pull',
    panelPath: '/classes-subjects',
    enabled: true,
  },
  {
    id: 'ogrenciRehberEokul',
    label: 'Öğrenci rehber',
    description: 'e-Okul anne/baba cep telefonunu veli rehberine aktarır.',
    phase: 4,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/veli-rehber',
    enabled: true,
  },
  {
    id: 'veliBilgiGuncelle',
    label: 'Veli bilgisi güncelle',
    description: 'Veli rehberindeki cep telefonunu e-Okul veli kaydına yazar (API + DOM yedeği).',
    phase: 4,
    direction: 'push',
    panelPath: '/mesaj-merkezi/veli-rehber',
    enabled: true,
  },
  {
    id: 'ozursuzdenOzurluye',
    label: 'Özürsüz → özürlü',
    description: '02012 özürsüz günleri 02013 özürlüye aktarır; izinli nedende veli dilekçe PDF.',
    phase: 5,
    direction: 'push',
    enabled: true,
  },
  {
    id: 'topluOzurluDevam',
    label: 'Toplu özürlü giriş',
    description: 'Toplu özürlü devamsızlık kaydı (02013).',
    phase: 5,
    direction: 'push',
    enabled: true,
  },
  {
    id: 'topluOzursuzDevam',
    label: 'Toplu özürsüz giriş',
    description: 'Numara listesini OKL08001 günlük listesine işler.',
    phase: 5,
    direction: 'push',
    enabled: true,
  },
  {
    id: 'gunlukDevamsizlikYaz',
    label: 'Günlük devamsızlık yaz',
    description: 'Mesaj merkezi kampanyasını e-Okul günlük listesine yazar.',
    phase: 6,
    direction: 'push',
    enabled: true,
  },
  {
    id: 'topluFaaliyet',
    label: 'Toplu faaliyet',
    description: 'Toplu faaliyet kaydı (02013, nedeni F).',
    phase: 7,
    direction: 'push',
    enabled: true,
  },
  {
    id: 'dersProgramiEokul',
    label: 'Ders programı',
    description: 'Ders dağıtım ↔ e-Okul dosyası (içe/dışa aktarma).',
    phase: 8,
    direction: 'both',
    panelPath: '/ders-dagit/studyo/atamalar',
    enabled: true,
  },
  {
    id: 'evciCarsiIzin',
    label: 'Evci / çarşı izin',
    description: 'Pansiyon izin listesi raporundan mesaj merkezine aktarır (Faz 9).',
    phase: 9,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/izin',
    enabled: true,
  },
  {
    id: 'mebbisPuantajBordro',
    label: 'MEBBİS puantaj bordro',
    description: 'MEBBİS Excel → mesaj merkezi puantaj kampanyası.',
    phase: 10,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/mebbis-puantaj',
    enabled: true,
  },
  {
    id: 'kbsEkDersBordro',
    label: 'KBS ek ders bordro',
    description: 'KBS ek ders Excel → mesaj merkezi kampanyası.',
    phase: 10,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/kbs-ek-ders',
    enabled: true,
  },
  {
    id: 'kbsMaasBordro',
    label: 'KBS maaş bordro',
    description: 'KBS maaş Excel → mesaj merkezi kampanyası (gizli).',
    phase: 10,
    direction: 'pull',
    panelPath: '/mesaj-merkezi/kbs-maas',
    enabled: true,
  },
  {
    id: 'oturumAcik',
    label: 'Oturum açık tut',
    description:
      'MEBBİS, e-Okul, EBYS, K12, TEFBİS ve e-Kurs sekmelerinde oturumu canlı tutar (~10 dk).',
    phase: 12,
    direction: 'push',
    enabled: true,
  },
];

function resolvePanelBrowserApiBase(portalSiteOrigin: string, apiRoot: string): string {
  try {
    const u = new URL(portalSiteOrigin);
    const h = u.hostname.toLowerCase();
    const devHost =
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '10.0.2.2' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
    if (devHost && (u.port === '3000' || u.port === '')) {
      return `${u.origin}/be-api`;
    }
  } catch {
    /* ignore */
  }
  return apiRoot;
}

export function buildEokulBridgeBootstrap(portalSiteOrigin: string, apiBase: string) {
  const origin = portalSiteOrigin.replace(/\/+$/, '');
  const apiRoot = apiBase.replace(/\/+$/, '');
  const panelBrowserApiBase = resolvePanelBrowserApiBase(origin, apiRoot);

  return {
    version: 1,
    minExtensionVersion: EOKUL_BRIDGE_MIN_EXTENSION_VERSION,
    extensionEnabled: process.env.EOKUL_BRIDGE_ENABLED !== 'false',
    extensionUi: {
      portalApi: {
        portalSiteOrigin: origin,
        apiBase: apiRoot,
        panelBrowserApiBase,
        authMePath: '/me',
        bootstrapPath: '/eokul-bridge/v1/bootstrap',
      },
      chromeTabQueries: {
        portalSiteTabPatterns: buildPortalTabPatterns(origin),
        eokulTabMatchPattern: 'https://e-okul.meb.gov.tr/*',
        mebbisTabPatterns: [
          'https://mebbis.meb.gov.tr/*',
          'https://www.mebbis.meb.gov.tr/*',
          'https://mebbisyd.meb.gov.tr/*',
          'https://www.mebbisyd.meb.gov.tr/*',
        ],
        kbsTabPatterns: [
          'https://kbs.muhasebat.gov.tr/*',
          'https://www.kbs.muhasebat.gov.tr/*',
          'https://kbs.gov.tr/*',
          'https://www.kbs.gov.tr/*',
          'https://giris.hmb.gov.tr/*',
        ],
        kbsLoginUrl: 'https://www.kbs.gov.tr/gen/login.htm',
        kbsMaasRaporUrl: 'https://www.kbs.gov.tr/maasRapor/maasRapor.htm',
        kbsEkDersRaporUrl: 'https://www.kbs.gov.tr/yeniakademik/p_yenirapor.htm',
        kbsEkDersEntryUrl: 'https://www.kbs.gov.tr/yeniakademik/p_yenirapor.htm',
      },
      app: {
        gate: {
          title: 'Uzaedu Okul Köprüsü',
          subtitle: 'Uzaedu paneli ile e-Okul arasında güvenli bağlantı',
          runButton: 'Bağlantıyı doğrula ve devam et',
          portalBadge: 'Panel oturumu',
          eokulBadge: 'e-Okul sekmesi',
        },
        shell: {
          title: 'Uzaedu Okul Köprüsü',
          phaseSoon: 'Yakında',
          phasePrefix: 'Faz',
        },
      },
      ozurClient: {
        izinliNedeniValues: ['İ', 'I', '1'],
        veliIzinPdfPath: '/eokul-bridge/v1/ozur/veli-izin-pdf',
      },
      menus: Object.fromEntries(
        EOKUL_BRIDGE_MENUS.map((m) => [
          m.id,
          {
            label: m.label,
            description: m.description,
            phase: m.phase,
            direction: m.direction,
            panelPath: m.panelPath ?? null,
            enabled: m.enabled,
            ...(m.id === 'kelebekSinavOgrenciAktar'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  defaultSiraTipi: 'ikili',
                  defaultGrupSayisi: 3,
                  importPath: '/eokul-bridge/v1/import/kelebek-students',
                }
              : {}),
            ...(m.id === 'gunlukDevamsizlikAktar'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  importPath: '/eokul-bridge/v1/import/gunluk-devamsizlik',
                }
              : {}),
            ...(m.id === 'eyoklamaDersDevamsizlikAktar'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  importPath: '/eokul-bridge/v1/import/ders-devamsizlik',
                }
              : {}),
            ...(m.id === 'toplamDevamsizlikAktar'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  importPath: '/eokul-bridge/v1/import/toplam-devamsizlik',
                }
              : {}),
            ...(m.id === 'devamsizlikMektubuEokul'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  importPath: '/eokul-bridge/v1/import/devamsizlik-mektup-recipients',
                }
              : {}),
            ...(m.id === 'ogrenciRehberEokul'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  importPath: '/eokul-bridge/v1/import/veli-rehber',
                }
              : {}),
            ...(m.id === 'ogrenciDosyaBilgileriAl'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  groups: EOKUL_BRIDGE_OGR_DOSYA_GROUPS,
                  importPath: '/eokul-bridge/v1/import/ogrenci-dosya',
                }
              : {}),
            ...(m.id === 'veliBilgiGuncelle'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  pushQueuePath: '/eokul-bridge/v1/veli-push-queue',
                }
              : {}),
            ...(m.id === 'topluFaaliyet'
              ? { supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL] }
              : {}),
            ...(m.id === 'ozursuzdenOzurluye' || m.id === 'topluOzurluDevam'
              ? { supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL] }
              : {}),
            ...(m.id === 'evciCarsiIzin'
              ? {
                  importPath: '/eokul-bridge/v1/import/izin',
                  scrapeHint: 'e-Pansiyon → Evci ve Çarşı İzin Listesi raporu açık olsun.',
                }
              : {}),
            ...(m.id === 'dersProgramiEokul'
              ? {
                  previewPath: '/eokul-bridge/v1/import/ders-dagit-eokul/preview',
                  importPath: '/eokul-bridge/v1/import/ders-dagit-eokul',
                }
              : {}),
            ...(m.id === 'mebbisPuantajBordro'
              ? {
                  bordroType: 'mebbis_puantaj',
                  parsePath: '/messaging/bordro/parse',
                  campaignPath: '/messaging/bordro/campaign',
                  panelPath: '/mesaj-merkezi/mebbis-puantaj',
                }
              : {}),
            ...(m.id === 'kbsEkDersBordro'
              ? {
                  bordroType: 'ek_ders_bordro',
                  parsePath: '/messaging/bordro/parse',
                  campaignPath: '/messaging/bordro/campaign',
                  panelPath: '/mesaj-merkezi/kbs-ek-ders',
                }
              : {}),
            ...(m.id === 'kbsMaasBordro'
              ? {
                  bordroType: 'maas_bordro',
                  parsePath: '/messaging/bordro/parse',
                  campaignPath: '/messaging/bordro/campaign',
                  panelPath: '/mesaj-merkezi/kbs-maas',
                }
              : {}),
            ...(m.id === 'gunlukDevamsizlikYaz'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                  listCampaignsPath: '/eokul-bridge/v1/devamsizlik-campaigns',
                }
              : {}),
            ...(m.id === 'topluOzursuzDevam'
              ? {
                  supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
                }
              : {}),
            ...(m.id === 'oturumAcik'
              ? {
                  pingIntervalMinutes: 10,
                }
              : {}),
          },
        ]),
      ),
      menuIds: EOKUL_BRIDGE_MENUS.map((m) => m.id),
    },
    menuIds: EOKUL_BRIDGE_MENUS.map((m) => m.id),
    mebOrigin: EOKUL_BRIDGE_MEB_ORIGIN,
    kurumProfiles: {
      okulOncesi: EOKUL_BRIDGE_KURUM_PROFILES.okulOncesi,
      ilkOgretim: EOKUL_BRIDGE_KURUM_PROFILES.ilkOgretim,
      ortaOgretim: EOKUL_BRIDGE_KURUM_PROFILES.ortaOgretim,
    },
    constants: EOKUL_BRIDGE_CONSTANTS,
    fetchChains: EOKUL_BRIDGE_FETCH_CHAINS,
    domRuntime: EOKUL_BRIDGE_DOM_RUNTIME,
    kurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
    defaultKurumKey: 'ilkOgretim',
    menusMeta: {
      kelebekSinavOgrenciAktar: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        defaultSiraTipi: 'ikili',
        defaultGrupSayisi: 3,
        importPath: '/eokul-bridge/v1/import/kelebek-students',
      },
      gunlukDevamsizlikAktar: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        importPath: '/eokul-bridge/v1/import/gunluk-devamsizlik',
      },
      eyoklamaDersDevamsizlikAktar: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        importPath: '/eokul-bridge/v1/import/ders-devamsizlik',
      },
      toplamDevamsizlikAktar: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        importPath: '/eokul-bridge/v1/import/toplam-devamsizlik',
      },
      devamsizlikMektubuEokul: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        importPath: '/eokul-bridge/v1/import/devamsizlik-mektup-recipients',
      },
      ogrenciRehberEokul: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        importPath: '/eokul-bridge/v1/import/veli-rehber',
      },
      ogrenciDosyaBilgileriAl: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        groups: EOKUL_BRIDGE_OGR_DOSYA_GROUPS,
        importPath: '/eokul-bridge/v1/import/ogrenci-dosya',
      },
      veliBilgiGuncelle: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        pushQueuePath: '/eokul-bridge/v1/veli-push-queue',
      },
      topluFaaliyet: { supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL] },
      evciCarsiIzin: {
        importPath: '/eokul-bridge/v1/import/izin',
        scrapeHint: 'e-Pansiyon → Evci ve Çarşı İzin Listesi raporu açık olsun.',
      },
      dersProgramiEokul: {
        previewPath: '/eokul-bridge/v1/import/ders-dagit-eokul/preview',
        importPath: '/eokul-bridge/v1/import/ders-dagit-eokul',
      },
      mebbisPuantajBordro: {
        bordroType: 'mebbis_puantaj',
        parsePath: '/messaging/bordro/parse',
        campaignPath: '/messaging/bordro/campaign',
        panelPath: '/mesaj-merkezi/mebbis-puantaj',
      },
      kbsEkDersBordro: {
        bordroType: 'ek_ders_bordro',
        parsePath: '/messaging/bordro/parse',
        campaignPath: '/messaging/bordro/campaign',
        panelPath: '/mesaj-merkezi/kbs-ek-ders',
      },
      kbsMaasBordro: {
        bordroType: 'maas_bordro',
        parsePath: '/messaging/bordro/parse',
        campaignPath: '/messaging/bordro/campaign',
        panelPath: '/mesaj-merkezi/kbs-maas',
      },
      gunlukDevamsizlikYaz: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        listCampaignsPath: '/eokul-bridge/v1/devamsizlik-campaigns',
      },
      topluOzursuzDevam: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
      },
      ozursuzdenOzurluye: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
        veliIzinPdfPath: '/eokul-bridge/v1/ozur/veli-izin-pdf',
        izinliNedeniValues: ['İ', 'I', '1'],
      },
      topluOzurluDevam: {
        supportedKurumKeys: [...EOKUL_BRIDGE_KURUM_ALL],
      },
      oturumAcik: {
        pingIntervalMinutes: 10,
      },
      mebbisOturumAcik: {
        pingIntervalMinutes: 10,
      },
      kbsOturumAcik: {
        pingIntervalMinutes: 10,
      },
    },
  };
}

function buildPortalTabPatterns(portalOrigin: string): string[] {
  const patterns = new Set<string>();
  try {
    const u = new URL(portalOrigin);
    patterns.add(`${u.origin}/*`);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      patterns.add('http://localhost:3000/*');
      patterns.add('http://127.0.0.1:3000/*');
      patterns.add('http://0.0.0.0:3000/*');
    }
    if (u.hostname === 'admin.uzaedu.com' || u.hostname.endsWith('.uzaedu.com')) {
      patterns.add('https://admin.uzaedu.com/*');
      patterns.add('https://uzaedu.com/*');
      patterns.add('https://www.uzaedu.com/*');
    }
  } catch {
    patterns.add('http://localhost:3000/*');
    patterns.add('https://admin.uzaedu.com/*');
  }
  return [...patterns];
}
