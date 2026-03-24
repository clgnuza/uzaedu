/**
 * BYF Coğrafya 2025-2026 yıllık plan SQL üretir (UTF-8).
 * Kullanım (backend): node tools/emit-bilsem-byf-seed.cjs
 */
const fs = require('fs');
const path = require('path');
const w1 = require('./bilsem-byf-w01-13.cjs');
const w2 = require('./bilsem-byf-w14-26.cjs');
const w3 = require('./bilsem-byf-w27-38.cjs');

const weeks = [].concat(w1, w2, w3);

const header = `-- BİLSEM Coğrafya BYF-1 — yillik_plan_icerik (2025-2026), curriculum_model = bilsem
-- UTF-8: cd backend && node tools/run-sql-utf8.cjs migrations/seed-yillik-plan-bilsem-cografya-byf-2025-2026.sql

DELETE FROM yillik_plan_icerik
WHERE subject_code = 'bilsem_cografya'
  AND academic_year = '2025-2026'
  AND curriculum_model = 'bilsem'
  AND ana_grup = 'GENEL_YETENEK'
  AND alt_grup = 'BYF-1';

INSERT INTO yillik_plan_icerik (
  id,
  subject_code,
  subject_label,
  grade,
  ana_grup,
  alt_grup,
  section,
  academic_year,
  week_order,
  unite,
  konu,
  kazanimlar,
  ders_saati,
  belirli_gun_haftalar,
  surec_bilesenleri,
  olcme_degerlendirme,
  sosyal_duygusal,
  degerler,
  okuryazarlik_becerileri,
  zenginlestirme,
  okul_temelli_planlama,
  sort_order,
  curriculum_model,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'bilsem_cografya',
  'Coğrafya',
  NULL,
  'GENEL_YETENEK',
  'BYF-1',
  NULL,
  '2025-2026',
  x.wo,
  LEFT(NULLIF(TRIM(x.u), ''), 256),
  LEFT(NULLIF(TRIM(x.k), ''), 512),
  x.kaz::text,
  COALESCE(x.ds, 2),
  LEFT(NULLIF(TRIM(x.bel), ''), 256),
  x.sur::text,
  'Kontrol listesi, ürün değerlendirmesi',
  NULLIF(TRIM(x.sd), '')::text,
  NULLIF(TRIM(x.deg), '')::text,
  NULLIF(TRIM(x.okr), '')::text,
  NULL,
  NULL,
  x.wo,
  'bilsem',
  NOW(),
  NOW()
FROM (
VALUES
`;

const rows = weeks.map((w, i) => {
  const p = `z${String(i).padStart(2, '0')}`;
  const u = w.unite == null ? '' : String(w.unite);
  const k = w.konu == null ? '' : String(w.konu);
  const kaz = w.kazanimlar == null ? '' : String(w.kazanimlar);
  const sur = w.surec == null ? '' : String(w.surec);
  const bel = w.belirli_gun == null ? '' : String(w.belirli_gun);
  const sd = w.sosyal_duygusal == null ? '' : String(w.sosyal_duygusal);
  const deg = w.degerler == null ? '' : String(w.degerler);
  const okr = w.okuryazarlik == null ? '' : String(w.okuryazarlik);
  const ds = w.ders_saati != null ? w.ders_saati : 2;
  return `  (${w.week_order}, $${p}u$${u}$${p}u$, $${p}k$${k}$${p}k$, $${p}kaz$${kaz}$${p}kaz$, $${p}s$${sur}$${p}s$, $${p}b$${bel}$${p}b$, $${p}sd$${sd}$${p}sd$, $${p}d$${deg}$${p}d$, $${p}o$${okr}$${p}o$, ${ds})`;
});

const footer = `
) AS x(wo, u, k, kaz, sur, bel, sd, deg, okr, ds);
`;

const out = path.join(__dirname, '..', 'migrations', 'seed-yillik-plan-bilsem-cografya-byf-2025-2026.sql');
const sql = header + rows.join(',\n') + footer;
fs.writeFileSync(out, sql, 'utf8');
process.stdout.write(out + '\n');
