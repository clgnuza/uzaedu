/**
 * Örnek yıllık plan Excel dosyasını inceler, yapıyı çıkarır.
 * Çalıştırma: node scripts/inspect-plan-xlsx.js "C:\Users\mehme\OneDrive\Desktop\FEN LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx"
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  'OneDrive',
  'Desktop',
  'FEN LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx'
);

if (!fs.existsSync(filePath)) {
  console.error('Dosya bulunamadı:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);
console.log('=== SAYFA ADLARI ===');
console.log(workbook.SheetNames);
console.log('');

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  console.log('=== SAYFA:', sheetName, '===');
  console.log('Satır: ', range.e.r + 1, ', Sütun:', range.e.c + 1);
  console.log('');

  // İlk 15 satırı göster
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('İlk 15 satır (ham):');
  json.slice(0, 15).forEach((row, i) => {
    console.log('  ', i + 1, ':', JSON.stringify(row));
  });
  console.log('');
}
