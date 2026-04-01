/** .env’de tırnak veya \\n ile saklanan PEM anahtarını düzeltir */
function normalizeFirebasePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export const env = {
  port: parseInt(process.env.APP_PORT || '4000', 10),
  nodeEnv: process.env.APP_ENV || 'local',
  /**
   * true: `seed/demo-credentials.ts` ile giriş (canlıda risk — yalnız bilinçli kullanın).
   * Yerelde APP_ENV=local/development iken zaten geçerli; bu bayrak production’da aynı davranışı açar.
   */
  allowDemoLogin: process.env.ALLOW_DEMO_LOGIN === 'true' || process.env.ALLOW_DEMO_LOGIN === '1',
  /** local + true: TypeORM synchronize. false: şema elle (migration SQL) */
  typeormSync: process.env.TYPEORM_SYNC !== 'false',
  debug: process.env.APP_DEBUG === 'true',
  useSqlite: process.env.APP_USE_SQLITE === 'true',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'ogretmenpro',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    /** node-pg Pool: eşzamanlı bağlantı üst sınırı */
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    poolIdleMs: parseInt(process.env.DB_POOL_IDLE_MS || '30000', 10),
    poolConnectionTimeoutMs: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '10000', 10),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
    privateKey: normalizeFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expire: parseInt(process.env.JWT_EXPIRE || '86400', 10),
  },
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://admin.uzaedu.com,https://uzaedu.com,https://www.uzaedu.com'
  )
    .split(',')
    .map((s) => s.trim()),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  /**
   * Oturum çerezi Domain (örn. .uzaedu.com) — admin + api alt alanlarında paylaşım.
   * Boşsa SESSION_COOKIE_DOMAIN veya production + FRONTEND_URL=uzaedu ise .uzaedu.com önerilir.
   */
  sessionCookieDomain: (() => {
    const explicit = process.env.SESSION_COOKIE_DOMAIN?.trim();
    if (explicit) return explicit;
    const front = process.env.FRONTEND_URL?.trim();
    if (!front || (process.env.APP_ENV || 'local') !== 'production') return undefined;
    try {
      const host = new URL(front).hostname;
      if (host === 'admin.uzaedu.com' || host.endsWith('.uzaedu.com')) {
        return '.uzaedu.com';
      }
    } catch {
      /* ignore */
    }
    return undefined;
  })(),
  /** Nginx / load balancer arkasında doğru client IP ve X-Forwarded-Proto (üretimde açık tutun) */
  trustProxy:
    process.env.TRUST_PROXY === 'true' ||
    process.env.TRUST_PROXY === '1' ||
    ((process.env.APP_ENV || 'local') === 'production' && process.env.TRUST_PROXY !== 'false' && process.env.TRUST_PROXY !== '0'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@ogretmenpro.com',
  },
  /** Yalnızca canlı sunucuda: süper admin şifre + betik ile git pull / restart */
  deploy: {
    enabled: process.env.DEPLOY_ENABLED === 'true',
    secret: process.env.DEPLOY_SECRET || '',
    scriptPath: process.env.DEPLOY_SCRIPT_PATH || '',
    /** Boş değilse yalnızca bu IPv4/IPv6 adresleri (virgülle); X-Forwarded-For ile uyumlu */
    allowedIps: (process.env.DEPLOY_ALLOWED_IPS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    /** Tanımlıysa istekte aynı değer gönderilmeli (body veya önerilen: X-Deploy-Token başlığı) */
    headerToken: process.env.DEPLOY_HEADER_TOKEN || '',
  },
  tickets: {
    autoCloseWaitingRequesterDays: parseInt(process.env.TICKETS_AUTO_CLOSE_WAITING_REQUESTER_DAYS || '7', 10),
  },
};
