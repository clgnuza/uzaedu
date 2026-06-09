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

const AY_MAP = {
  ocak: 1,
  şubat: 2,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  mayis: 5,
  haziran: 6,
  eylül: 9,
  eylul: 9,
  ekim: 10,
  kasım: 11,
  kasim: 11,
  aralık: 12,
  aralik: 12,
};

function parseMonth(s) {
  const t = s.toLocaleLowerCase('tr-TR').trim();
  for (const [k, v] of Object.entries(AY_MAP)) {
    if (t.startsWith(k) || t === k) return v;
  }
  return null;
}

function mondayOfWeek(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function parseDateRange(text, defaultYearStart = 2025, defaultYearEnd = 2026) {
  const t = text.replace(/\s+/g, ' ').trim();
  const cross = t.match(/^(\d{1,2})\s+(\S+)\s*-\s*(\d{1,2})\s+(\S+)$/i);
  if (cross) {
    const m1 = parseMonth(cross[2]);
    const m2 = parseMonth(cross[4]);
    if (!m1 || !m2) return null;
    const y1 = m1 >= 9 ? defaultYearStart : defaultYearEnd;
    const y2 = m2 >= 9 ? defaultYearStart : defaultYearEnd;
    const start = mondayOfWeek(y1, m1, parseInt(cross[1], 10));
    const endDt = new Date(Date.UTC(y2, m2 - 1, parseInt(cross[3], 10), 12));
    const end = endDt.toISOString().slice(0, 10);
    return { start, end };
  }
  const same = t.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+(\S+)$/i);
  if (same) {
    const m = parseMonth(same[3]);
    if (!m) return null;
    const y = m >= 9 ? defaultYearStart : defaultYearEnd;
    const start = mondayOfWeek(y, m, parseInt(same[1], 10));
    const endDt = new Date(Date.UTC(y, m - 1, parseInt(same[2], 10), 12));
    return { start, end: endDt.toISOString().slice(0, 10) };
  }
  return null;
}

const items = [];
let carryAy = '';
for (let i = 3; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  const ay = String(r[0] ?? '').trim();
  const hafta = String(r[1] ?? '').replace(/\r/g, ' ').trim();
  const ds = String(r[2] ?? '').trim();
  if (ay) carryAy = ay.toUpperCase().replace(/İ/g, 'İ');
  if (!ay && !hafta && !ds) continue;

  const m = hafta.match(/(\d+)\s*\.\s*Hafta\s*:\s*(.+)$/i);
  if (m) {
    const wo = parseInt(m[1], 10);
    const range = parseDateRange(m[2].trim());
    const ayNorm = carryAy || ay.toUpperCase();
    items.push({
      week_order: wo,
      week_start: range?.start ?? '',
      week_end: range?.end ?? '',
      ay: ayNorm,
      hafta_label: `${wo}. Hafta: ${m[2].trim().replace(/\s+/g, ' ')}`,
      is_tatil: false,
      tatil_label: null,
      sinav_etiketleri: null,
    });
    continue;
  }

  const breakText = [ay, hafta, ds].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (/tatil|seminer|uyum/i.test(breakText)) {
    let week_start = '';
    let week_end = '';
    const dm = breakText.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+(\S+)(?:\s+(\d{4}))?/i);
    if (dm) {
      const m1 = parseMonth(dm[3]);
      const y = dm[4] ? parseInt(dm[4], 10) : m1 && m1 >= 9 ? 2025 : 2026;
      if (m1) {
        week_start = mondayOfWeek(y, m1, parseInt(dm[1], 10));
        const endDt = new Date(Date.UTC(y, m1 - 1, parseInt(dm[2], 10), 12));
        week_end = endDt.toISOString().slice(0, 10);
      }
    }
    items.push({
      week_order: 0,
      week_start,
      week_end,
      ay: carryAy || ay.toUpperCase() || '—',
      hafta_label: breakText,
      is_tatil: true,
      tatil_label: breakText,
      sinav_etiketleri: null,
    });
  }
}

// seminer from MEB (not in kimya sheet but needed)
items.unshift({
  week_order: 0,
  week_start: '2025-09-01',
  week_end: '2025-09-08',
  ay: 'EYLÜL',
  hafta_label: 'Seminer Haftası & İlköğretim Uyum Haftası',
  is_tatil: true,
  tatil_label: 'Seminer Haftası & İlköğretim Uyum Haftası',
  sinav_etiketleri: null,
});
items.push({
  week_order: 0,
  week_start: '2026-06-29',
  week_end: '2026-07-03',
  ay: 'HAZİRAN',
  hafta_label: 'Eğitim Öğretim Yılı Sonu Seminer Haftası',
  is_tatil: true,
  tatil_label: 'Eğitim Öğretim Yılı Sonu Seminer Haftası',
  sinav_etiketleri: null,
});

console.log(JSON.stringify(items, null, 2));
