/**
 * Yerel DB: extra_lesson_params + extra_lesson_line_item_templates -> SQL (UPSERT).
 *   node tools/export-extra-lesson-sql.cjs ../extra-lesson-import.sql
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

function lit(v, kind) {
  if (v === null || v === undefined) return 'NULL';
  if (kind === 'jsonb') return esc(JSON.stringify(v)) + '::jsonb';
  if (kind === 'date') return esc(v.toISOString().slice(0, 10)) + '::date';
  if (kind === 'ts') return esc(new Date(v).toISOString()) + '::timestamptz';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return esc(String(v));
}

(async () => {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();

  const templates = await client.query(
    `SELECT id, key, label, type, indicator_day, indicator_night, sort_order
     FROM extra_lesson_line_item_templates ORDER BY sort_order, key`,
  );
  const params = await client.query(
    `SELECT id, semester_code, title, monthly_coefficient, indicator_day, indicator_night,
            line_items, tax_brackets, gv_exemption_max, dv_exemption_max, stamp_duty_rate,
            central_exam_roles, education_levels, sgk_employee_rate, ucretli_unit_scale,
            is_active, valid_from, valid_to, created_at, updated_at
     FROM extra_lesson_params ORDER BY semester_code`,
  );

  const outPath = process.argv[2]?.trim();
  const lines = [];
  lines.push(
    '-- extra_lesson_line_item_templates + extra_lesson_params upsert; templates: ' +
      templates.rows.length +
      ', params: ' +
      params.rows.length,
  );
  lines.push('BEGIN;');

  for (const r of templates.rows) {
    lines.push(
      `INSERT INTO extra_lesson_line_item_templates (id, key, label, type, indicator_day, indicator_night, sort_order)
VALUES (${lit(r.id)}, ${lit(r.key)}, ${lit(r.label)}, ${lit(r.type)}, ${lit(r.indicator_day)}, ${
        r.indicator_night == null ? 'NULL' : lit(r.indicator_night)
      }, ${lit(r.sort_order)})
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  type = EXCLUDED.type,
  indicator_day = EXCLUDED.indicator_day,
  indicator_night = EXCLUDED.indicator_night,
  sort_order = EXCLUDED.sort_order;`,
    );
  }

  for (const r of params.rows) {
    lines.push(
      `INSERT INTO extra_lesson_params (
  id, semester_code, title, monthly_coefficient, indicator_day, indicator_night,
  line_items, tax_brackets, gv_exemption_max, dv_exemption_max, stamp_duty_rate,
  central_exam_roles, education_levels, sgk_employee_rate, ucretli_unit_scale,
  is_active, valid_from, valid_to, created_at, updated_at
) VALUES (
  ${lit(r.id)}, ${lit(r.semester_code)}, ${lit(r.title)}, ${
        r.monthly_coefficient == null ? 'NULL' : lit(r.monthly_coefficient)
      }, ${lit(r.indicator_day)}, ${lit(r.indicator_night)},
  ${lit(r.line_items, 'jsonb')}, ${lit(r.tax_brackets, 'jsonb')}, ${lit(r.gv_exemption_max)}, ${lit(
        r.dv_exemption_max,
      )}, ${lit(r.stamp_duty_rate)},
  ${r.central_exam_roles == null ? 'NULL' : lit(r.central_exam_roles, 'jsonb')}, ${
        r.education_levels == null ? 'NULL' : lit(r.education_levels, 'jsonb')
      }, ${r.sgk_employee_rate == null ? 'NULL' : lit(r.sgk_employee_rate)}, ${
        r.ucretli_unit_scale == null ? 'NULL' : lit(r.ucretli_unit_scale)
      },
  ${lit(r.is_active)}, ${r.valid_from == null ? 'NULL' : lit(r.valid_from, 'date')}, ${
        r.valid_to == null ? 'NULL' : lit(r.valid_to, 'date')
      }, ${lit(r.created_at, 'ts')}, ${lit(r.updated_at, 'ts')}
)
ON CONFLICT (semester_code) DO UPDATE SET
  title = EXCLUDED.title,
  monthly_coefficient = EXCLUDED.monthly_coefficient,
  indicator_day = EXCLUDED.indicator_day,
  indicator_night = EXCLUDED.indicator_night,
  line_items = EXCLUDED.line_items,
  tax_brackets = EXCLUDED.tax_brackets,
  gv_exemption_max = EXCLUDED.gv_exemption_max,
  dv_exemption_max = EXCLUDED.dv_exemption_max,
  stamp_duty_rate = EXCLUDED.stamp_duty_rate,
  central_exam_roles = EXCLUDED.central_exam_roles,
  education_levels = EXCLUDED.education_levels,
  sgk_employee_rate = EXCLUDED.sgk_employee_rate,
  ucretli_unit_scale = EXCLUDED.ucretli_unit_scale,
  is_active = EXCLUDED.is_active,
  valid_from = EXCLUDED.valid_from,
  valid_to = EXCLUDED.valid_to,
  updated_at = EXCLUDED.updated_at;`,
    );
  }

  lines.push('COMMIT;');
  const text = lines.join('\n') + '\n';
  if (outPath) {
    fs.writeFileSync(outPath, Buffer.from(text, 'utf8'));
    console.error(
      'Yazıldı:',
      path.resolve(outPath),
      '(şablon:',
      templates.rows.length,
      ', dönem:',
      params.rows.length + ')',
    );
  } else {
    process.stdout.write(text);
  }
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
