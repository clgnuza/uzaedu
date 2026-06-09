import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const weeks = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/config/meb-work-calendar-2025-2026.json'), 'utf8'),
);
const esc = (s) => String(s ?? '').replace(/'/g, "''");
const lines = [
  '-- 2025-2026 çalışma takvimi: MEB Fen Lisesi Kimya taslak yıllık planı (TYMM)',
];
for (const w of weeks) {
  lines.push(
    `UPDATE work_calendar SET week_order=${w.week_order}, ay='${esc(w.ay)}', hafta_label='${esc(w.hafta_label)}', is_tatil=${w.is_tatil}, tatil_label=${w.tatil_label ? `'${esc(w.tatil_label)}'` : 'NULL'}, sinav_etiketleri=${w.sinav_etiketleri ? `'${esc(w.sinav_etiketleri)}'` : 'NULL'}, updated_at=NOW() WHERE academic_year='2025-2026' AND week_start='${w.week_start}'::date AND week_end='${w.week_end}'::date;`,
  );
}
fs.writeFileSync(path.join(__dirname, '../migrations/sync-work-calendar-2025-2026-kimya.sql'), lines.join('\n'), 'utf8');
console.log('sql updates', lines.length - 1);
