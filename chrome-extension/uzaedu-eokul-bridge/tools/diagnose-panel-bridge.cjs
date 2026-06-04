/**
 * Panel köprüsü tanı — Node 18+
 * Kullanım: node tools/diagnose-panel-bridge.cjs
 */
const PANEL = process.env.UZA_PANEL_ORIGIN || 'http://localhost:3000';
const API = `${PANEL.replace(/\/+$/, '')}/be-api`;

async function main() {
  const health = await fetch(`${API.replace(/\/be-api$/, '')}/be-api/health`.replace('//be-api', '/be-api')).catch(() => null);
  const healthUrl = `${PANEL}/be-api/health`;
  const h = await fetch(healthUrl).then((r) => ({ ok: r.ok, status: r.status })).catch((e) => ({ ok: false, error: e.message }));
  const me = await fetch(`${API}/me`, { credentials: 'include' }).then(async (r) => ({
    status: r.status,
    body: await r.text(),
  }));
  console.log(JSON.stringify({ panel: PANEL, health: h, me }, null, 2));
  if (me.body === 'null' || me.body === '') {
    console.log('\nNot: /me null = oturum yok (normal). Tarayıcıda girişli sekmede eklenti köprüsü çalışır.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
