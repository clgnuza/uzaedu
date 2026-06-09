import { generateMebWorkCalendar } from '../dist/config/meb-calendar.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'KİMYA TASLAK YILLIK PLANLAR');
const fen = fs.readdirSync(dir).find((f) => f.includes('FEN'));
const rows = XLSX.utils.sheet_to_json(
  XLSX.readFile(path.join(dir, fen)).Sheets['9. SINIF FEN LİSESİ KİMYA'],
  { header: 1, defval: '' },
);

const kimya = [];
for (let i = 3; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const ay = String(r[0] ?? '').trim();
  const hafta = String(r[1] ?? '').replace(/\r/g, ' ').trim();
  const ds = String(r[2] ?? '').trim();
  if (!ay && !hafta && !ds) continue;
  const m = hafta.match(/(\d+)\s*\.\s*Hafta/i);
  if (m) {
    kimya.push({ kind: 'teach', wo: parseInt(m[1], 10), ay: ay || '-', label: hafta.replace(/\s+/g, ' ') });
    continue;
  }
  const tatil = ay || hafta || ds;
  if (/tatil|seminer|uyum/i.test(tatil)) {
    kimya.push({ kind: 'break', ay: ay || '-', label: tatil.replace(/\s+/g, ' ') });
  }
}

const meb = generateMebWorkCalendar('2025-2026');
let diffs = 0;
for (const k of kimya.filter((x) => x.kind === 'teach')) {
  const m = meb.find((x) => x.week_order === k.wo);
  const km = k.label.match(/Hafta:\s*(.+)$/i)?.[1]?.trim() ?? '';
  const mm = m?.hafta_label.replace(/^\d+\.\s*Hafta:\s*/i, '').trim() ?? 'MISSING';
  const norm = (s) =>
    s
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/İ/g, 'I')
      .replace(/Ş/g, 'S')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C');
  if (!m) {
    console.log('MISSING week', k.wo, k.label);
    diffs++;
  } else if (norm(mm) !== norm(km)) {
    console.log('DIFF wo', k.wo, '\n  KIMYA', km, '\n  MEB ', mm);
    diffs++;
  }
}
for (const k of kimya.filter((x) => x.kind === 'break')) {
  const hit = meb.find(
    (x) =>
      x.is_tatil &&
      norm((x.tatil_label || x.hafta_label || '').replace(/\s+/g, ' ')).includes(
        norm(k.label.slice(0, 24)),
      ),
  );
  if (!hit) {
    console.log('BREAK missing in MEB', k.label);
    diffs++;
  }
}
function norm(s) {
  return String(s)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');
}
console.log('diffs', diffs);
console.log('MEB teaching weeks sample:');
for (const x of meb.filter((w) => w.week_order >= 1 && w.week_order <= 5)) {
  console.log(x.week_order, x.week_start, x.hafta_label);
}
