export const env = {
  port: parseInt(process.env.APP_PORT || '4000', 10),
  nodeEnv: process.env.APP_ENV || 'local',
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
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expire: parseInt(process.env.JWT_EXPIRE || '86400', 10),
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001').split(',').map((s) => s.trim()),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@ogretmenpro.com',
  },
};
