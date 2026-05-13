import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import fs from 'fs';

function cell(v) {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}
function parseWeekOrder(h) {
  const one = String(h).replace(/\r?\n/g, ' ');
  const m = one.match(/(\d+)\s*\.\s*Hafta/i);
  return m ? parseInt(m[1], 10) : null;
}

const buf = fs.readFileSync('C:\\Users\\mehme\\OneDrive\\Desktop\\yiillik-plan-sablon.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.Sayfa1, { header: 1, defval: '' });
let headerRow = -1;
for (let i = 0; i < 10; i++) {
  const r = rows[i];
  if (!r || r.length < 5) continue;
  const h1 = String(r[1] ?? '').toUpperCase();
  const h3 = String(r[3] ?? '').toUpperCase();
  if (h1.includes('HAFT') && (h3.includes('ÜNİTE') || h3.includes('UNITE') || h3.includes('TEMA'))) {
    headerRow = i;
    break;
  }
}
console.log('headerRow', headerRow);
const C = { h: 1, ds: 2, u: 3, k: 4, kaz: 5, sb: 6, ol: 7, sos: 8, deg: 9, ok: 10, bel: 11, z: 12, okul: 13 };
const m = new Map();
let last = 0;
for (let i = headerRow + 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length === 0) continue;
  const ha = cell(r[C.h]);
  if (!ha && !cell(r[C.u]) && !cell(r[C.k]) && !cell(r[C.kaz])) continue;
  let wo = parseWeekOrder(ha);
  if (wo == null) {
    if (last > 0 && last < 38) wo = last + 1;
    else continue;
  }
  if (wo < 1 || wo > 38) continue;
  const rawDs = r[C.ds];
  const ds = typeof rawDs === 'number' ? rawDs : parseInt(String(rawDs ?? '').replace(/\D/g, ''), 10);
  m.set(wo, { week_order: wo, ha: ha.slice(0, 20) });
  last = wo;
}
console.log('weeks', m.size);
