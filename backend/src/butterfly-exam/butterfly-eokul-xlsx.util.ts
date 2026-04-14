import * as XLSX from 'xlsx';

export type EokulPreviewRow = {
  row: number;
  name: string;
  studentNumber: string | null;
  classRaw: string | null;
};

/** E-Okul / okul listesi Excel: ilk sayfa, başlık satırı tahmini */
export function previewEokulStyleSheet(buffer: Buffer, maxRows = 200): { headers: string[]; rows: EokulPreviewRow[] } {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' }) as unknown[][];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i] as unknown[];
    const joined = row.map((c) => String(c ?? '').toLowerCase()).join(' ');
    if (joined.includes('numara') || joined.includes('ad') || joined.includes('soyad') || joined.includes('sınıf')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (data[headerRowIdx] as unknown[]).map((c) => String(c ?? '').trim());
  const nameIdx = headers.findIndex((h) => /ad|soyad|adı|adi/i.test(h));
  const numIdx = headers.findIndex((h) => /numara|öğrenci|ogrenci|no/i.test(h));
  const classIdx = headers.findIndex((h) => /sınıf|sinif|şube|sube|derslik/i.test(h));

  const rows: EokulPreviewRow[] = [];
  for (let r = headerRowIdx + 1; r < data.length && rows.length < maxRows; r++) {
    const row = data[r] as unknown[];
    if (!row || row.every((c) => String(c ?? '').trim() === '')) continue;
    const name =
      nameIdx >= 0
        ? String(row[nameIdx] ?? '').trim()
        : [row[1], row[2]].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
    const studentNumber = numIdx >= 0 ? String(row[numIdx] ?? '').trim() || null : null;
    const classRaw = classIdx >= 0 ? String(row[classIdx] ?? '').trim() || null : null;
    if (!name && !studentNumber) continue;
    rows.push({ row: r + 1, name: name || '—', studentNumber, classRaw });
  }

  return { headers, rows };
}
