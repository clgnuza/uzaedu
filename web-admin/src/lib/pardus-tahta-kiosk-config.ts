/** Pardus kiosk conf + Chromium policy (deb-pack döngüsel import yok). */

function originPattern(base: string): string {
  const u = new URL(base.endsWith('/') ? base : `${base}/`);
  return `${u.protocol}//${u.host}/*`;
}

export function buildChromiumManagedPolicyJson(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  allowYoutubeEmbeds: boolean;
}): string {
  const allow: string[] = [originPattern(args.panelOrigin), originPattern(args.apiBaseUrl)];
  if (args.allowYoutubeEmbeds) {
    allow.push(
      'https://www.youtube.com/*',
      'https://www.youtube-nocookie.com/*',
      'https://i.ytimg.com/*',
      'https://www.google.com/*',
    );
  }
  const unique = [...new Set(allow)];
  return `${JSON.stringify(
    {
      URLBlocklist: ['*'],
      URLAllowlist: unique,
      IncognitoModeAvailability: 1,
      DeveloperToolsAvailability: 2,
      DefaultPopupsSetting: 2,
      DownloadRestrictions: 3,
      PrintingEnabled: false,
      EditBookmarksEnabled: false,
      BookmarkBarEnabled: false,
      SavingBrowserHistoryDisabled: true,
      DefaultSearchProviderEnabled: false,
      PasswordManagerEnabled: false,
      AutofillAddressEnabled: false,
      AutofillCreditCardEnabled: false,
      ExtensionInstallBlocklist: ['*'],
      BrowserAddPersonEnabled: false,
      BrowserGuestModeEnabled: false,
      TaskManagerEndProcessEnabled: false,
      MetricsReportingEnabled: false,
      BrowserSignin: 0,
      SyncDisabled: true,
      SafeBrowsingEnabled: true,
      BackgroundModeEnabled: false,
      NetworkPredictionOptions: 2,
      PromptForDownloadLocation: false,
    },
    null,
    2,
  )}\n`;
}

export function buildConf(args: {
  panelOrigin: string;
  schoolId: string;
  deviceId: string;
  kiosk: boolean;
  apiBaseUrl: string;
  tahtaKilit: boolean;
}): string {
  const o = args.panelOrigin.replace(/\/$/, '');
  return `# Uzaedu Öğretmen akıllı tahta — okul/cihaz bağlamı (yeniden indirip kurun)
PANEL_ORIGIN=${o}
SCHOOL_ID=${args.schoolId}
DEVICE_ID=${args.deviceId}
KIOSK_MODE=${args.kiosk ? '1' : '0'}
KILIT_MODE=${args.tahtaKilit ? '1' : '0'}
API_BASE_URL=${args.apiBaseUrl.replace(/\/$/, '')}
CHROME_EXTRA_FLAGS=
`;
}
