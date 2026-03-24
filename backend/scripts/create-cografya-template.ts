/**
 * Örnek Coğrafya yıllık plan xlsx oluşturur (R2/local fallback için).
 * Kullanım: cd backend && npx ts-node -r tsconfig-paths/register scripts/create-cografya-template.ts
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_FILE = 'ornek-yillik-plan-cografya.xlsx';
const templatesDir = path.join(__dirname, '..', 'templates');
const filePath = path.join(templatesDir, OUT_FILE);

// Merge placeholder'lar: {okul_adi}, {ogretim_yili}, {sinif}, {ders_adi}, {baslik_bloku} vb.
const data: (string | number)[][] = [
  ['{baslik_bloku}'],
  [],
  ['{ogretim_yili} – {okul_adi_upper} – {sinif}. Sınıf {ders_adi} Yıllık Plan'],
  [],
  ['SÜRE', 'AY', 'HAFTA', 'DERS SAATİ'],
  ['AY', 'EYLÜL', '1', 2],
  ['', '', '2', 2],
  ['', '', '3', 2],
  ['', '', '4', 2],
  ['AY', 'EKİM', '5', 2],
  ['', '', '6', 2],
  ['', '', '7', 2],
  ['', 'SINAV HAFTASI', '8', 2],
  ['AY', 'KASIM', '9', 2],
  ['', '1. DÖNEM ARA TATİLİ: 10 - 14 Kasım', '', ''],
  ['', '', '10', 2],
  ['', '', '11', 2],
  // ... özet satırlar; tam plan için gerçek şablon kullanılır
];

const ws = XLSX.utils.aoa_to_sheet(data);
ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]; // Başlık
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '9. Sınıf');

if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });
XLSX.writeFile(wb, filePath);
console.log('Oluşturuldu:', filePath);
