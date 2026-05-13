import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import fs from 'fs';
const buf = fs.readFileSync('C:\\Users\\mehme\\OneDrive\\Desktop\\yiillik-plan-sablon.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.Sayfa1, { header: 1, defval: '' });
for (let i = 1; i <= 5; i++) {
  const r = rows[i];
  console.log('row', i, 'len', r?.length, 'c1', JSON.stringify(r?.[1]));
}
