require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const STUDIO = process.argv[2] || '1d812fc1-6a57-47b5-bf72-f22edafeeb2a';

(async () => {
  const c = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await c.connect();
  const st = await c.query('SELECT settings FROM ders_dagit_studio WHERE id = $1', [STUDIO]);
  const settings = st.rows[0]?.settings || {};
  const ss = settings.section_schedules || {};
  const period = settings.period || {};
  const asg = await c.query(
    'SELECT class_sections, weekly_hours, biweekly FROM ders_dagit_assignment WHERE studio_id = $1',
    [STUDIO],
  );
  const hrs = {};
  for (const a of asg.rows) {
    for (const s of a.class_sections || []) {
      const h = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      hrs[s] = (hrs[s] || 0) + h;
    }
  }
  const workDays = period.work_days?.length ? period.work_days : [1, 2, 3, 4, 5];
  const byDow = period.lessons_per_day_by_dow || {};
  let grid = 0;
  for (const d of workDays) {
    grid += Number(byDow[String(d)] || 9);
  }
  console.log('Atanan saat/şube:', hrs);
  console.log('Dönem ızgara (brüt):', grid, 'gün', workDays.join(','));
  for (const [k, v] of Object.entries(ss)) {
    const cells = v.cells || {};
    const closedAll = Object.values(cells).filter((x) => x === 'closed').length;
    const closedInGrid = Object.entries(cells).filter(([k, v]) => {
      if (v !== 'closed') return false;
      const [d, l] = k.split(':').map(Number);
      const dayMax = Number(byDow[String(d)] || 9);
      return l >= 1 && l <= dayMax;
    }).length;
    const closed = closedInGrid;
    const intern = (v.internship_days || []).length;
    console.log(`  ${k}: kapalı=${closed} (toplam_k=${closedAll}), staj_gün=${intern}, atanan=${hrs[k] ?? '?'}, açık≈${grid - closedInGrid}`);
  }
  if (!Object.keys(ss).length) console.log('  (section_schedules boş — tüm hücreler müsait)');
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
