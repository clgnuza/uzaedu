/** Süper yönetici — Git / canlı ortam referans bilgileri (gizli anahtar saklamayın). */
export type DevOpsConfig = {
  git_repo_url: string | null;
  git_default_branch: string | null;
  cicd_url: string | null;
  production_api_url: string | null;
  production_web_url: string | null;
  deploy_notes: string | null;
};

const DEFAULT_DEPLOY_NOTES = [
  'Sunucu: Hetzner VPS (ör. /opt/uzaedu), Nginx → API :4000, web :3000, PM2 (uzaedu-api, uzaedu-web). HTTPS/http/www: infra/nginx/uzaedu.conf + setup-certbot-and-enable-site.sh (sunucuda çalıştır).',
  'Veritabanı: Docker postgres:16-alpine (docker-compose.server.yml), yalnız 127.0.0.1:5432. DB şifre: scripts/security/generate-db-password.ps1; rotasyon: infra/scripts/rotate-postgres-password.sh. Sunucu sertleştirme: infra/scripts/harden-server.sh (UFW, .env chmod).',
  'DNS (Güzel Hosting): @, www, api, admin → sunucu IPv4; sonra certbot SSL.',
  'CI/CD: GitHub Actions "Deploy production" (SSH). Secrets: DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY (Settings → Secrets → Actions). Yerel: scripts/deploy/set-github-secrets.ps1 (gh CLI).',
  'Sunucu betiği: scripts/deploy/server-deploy.sh (git pull, npm ci, build, web-admin .env.production, pm2). DOMAIN_API / DOMAIN_SITE (NEXT_PUBLIC_SITE_URL, varsayılan uzaedu.com); admin.uzaedu.com → uzaedu.com nginx yönlendirmesi. Eski /opt/uzaedu/deploy.sh → bu betiğe yönlendirin.',
  'Yerel tetik: scripts/deploy/push-and-release.ps1 (git push + gh workflow run) veya Actions’tan Run workflow.',
  'Panel webhook: DEPLOY_ENABLED + DEPLOY_SECRET; DEPLOY_SCRIPT_PATH=/opt/uzaedu/scripts/deploy/server-deploy.sh (isteğe bağlı).',
  'Demo parola girişi (seed/demo-credentials): sunucu backend .env içinde ALLOW_DEMO_LOGIN=true; DB’de ilgili kullanıcı kaydı olmalı. Üretimde güvenlik riski — geçiş sonrası false yapın veya şifreleri tools/set-user-password.cjs ile değiştirin.',
  'Manuel SSH: ssh -i ~/.ssh/id_rsa_uzaedu root@SUNUCU_IP',
  'Yerel geliştirme: backend npm run start:dev, web-admin npm run dev, DB docker compose up (docker-compose.yml).',
].join('\n');

export const DEFAULT_DEVOPS: DevOpsConfig = {
  git_repo_url: 'https://github.com/clgnuza/uzaedu.git',
  git_default_branch: 'main',
  cicd_url:
    'https://github.com/clgnuza/uzaedu/actions/workflows/deploy-production.yml',
  production_api_url: 'https://api.uzaedu.com',
  production_web_url: 'https://uzaedu.com',
  deploy_notes: DEFAULT_DEPLOY_NOTES,
};

function pickStr(
  stored: string | null | undefined,
  fallback: string | null,
  maxLen: number,
): string | null {
  if (stored == null) return fallback;
  const t = String(stored).trim();
  if (t === '') return fallback;
  return t.slice(0, maxLen);
}

export function mergeDevOpsFromStored(stored: Partial<DevOpsConfig> | null | undefined): DevOpsConfig {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_DEVOPS };
  return {
    ...DEFAULT_DEVOPS,
    git_repo_url: pickStr(stored.git_repo_url, DEFAULT_DEVOPS.git_repo_url, 500),
    git_default_branch: pickStr(stored.git_default_branch, DEFAULT_DEVOPS.git_default_branch, 64) || 'main',
    cicd_url: pickStr(stored.cicd_url, DEFAULT_DEVOPS.cicd_url, 500),
    production_api_url: pickStr(stored.production_api_url, DEFAULT_DEVOPS.production_api_url, 500),
    production_web_url: pickStr(stored.production_web_url, DEFAULT_DEVOPS.production_web_url, 500),
    deploy_notes: pickStr(stored.deploy_notes, DEFAULT_DEVOPS.deploy_notes, 12000),
  };
}
