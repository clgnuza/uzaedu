export type DeployStatusReason = 'ready' | 'disabled' | 'misconfigured' | 'windows';

export type DeployStatusDto = {
  canDeploy: boolean;
  reason: DeployStatusReason;
  /** Sunucu ikinci doğrulama istiyor (DEPLOY_HEADER_TOKEN) */
  requiresHeaderToken: boolean;
  /** DEPLOY_ALLOWED_IPS dolu — yalnızca izinli IP’lerden çalışır */
  requiresIpAllowlist: boolean;
  /** Node süreç ortamı (panel: win32 ise yerel geliştirme veya canlı Linux API kullanın) */
  runtimePlatform: NodeJS.Platform;
  /** APP_ENV local/development/test: GET /deploy/data-mirror-export açık */
  dataMirrorExportAvailable: boolean;
};
