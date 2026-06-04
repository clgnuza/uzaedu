/**
 * PM2 — canlı: kopyala /opt/uzaedu/scripts/deploy/ecosystem.config.cjs veya doğrudan bu dosyayı kullan.
 *   pm2 startOrReload ecosystem.config.cjs --update-env
 *
 * Cluster: PM2_API_INSTANCES=2 PM2_WEB_INSTANCES=2 (düşük RAM’de 1 yapın).
 */
const apiInstances = Math.max(1, parseInt(process.env.PM2_API_INSTANCES || '2', 10) || 2);
const webInstances = Math.max(1, parseInt(process.env.PM2_WEB_INSTANCES || '2', 10) || 2);
const apiExec =
  apiInstances > 1 ? 'cluster' : process.env.PM2_API_EXEC_MODE || 'fork';
const webExec =
  webInstances > 1 ? 'cluster' : process.env.PM2_WEB_EXEC_MODE || 'fork';

module.exports = {
  apps: [
    {
      name: 'uzaedu-api',
      cwd: process.env.UZAEDU_BACKEND_ROOT || '/opt/uzaedu/backend',
      script: 'dist/main.js',
      exec_mode: apiExec,
      instances: apiInstances,
      autorestart: true,
      max_restarts: 20,
      exp_backoff_restart_delay: 200,
      watch: false,
      merge_logs: true,
      time: true,
    },
    {
      name: 'uzaedu-web',
      cwd: process.env.UZAEDU_WEB_ROOT || '/opt/uzaedu/web-admin',
      script: 'node_modules/next/dist/bin/next',
      args: `start -H 0.0.0.0 -p ${process.env.PORT || 3000}`,
      exec_mode: webExec,
      instances: webInstances,
      autorestart: true,
      max_restarts: 20,
      exp_backoff_restart_delay: 200,
      watch: false,
      merge_logs: true,
      time: true,
    },
  ],
};
