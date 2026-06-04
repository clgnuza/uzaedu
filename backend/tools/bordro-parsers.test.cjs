/**
 * node backend/tools/bordro-parsers.test.cjs
 */
const path = require('path');
const XLSX = require('xlsx');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});

const {
  parseMebbisPuantaj,
  parseEkDersBordro,
  parseMaasBordro,
} = require(path.join(__dirname, '../src/messaging/parsers/bordro-parsers.ts'));

function sheetBuf(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sayfa1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// MEBBİS Ek Ders Listesi (KBS) benzeri
const mebbisBuf = sheetBuf([
  ['T.C. Kimlik No', 'Adı Soyadı', 'Veri Tipi', 'Toplam Saat', 'Ünvan'],
  ['12345678901', 'AHMET YILMAZ', '101', '12', 'Öğretmen'],
  ['12345678901', 'AHMET YILMAZ', '110', '8', 'Öğretmen'],
  ['98765432109', 'AYŞE DEMİR', '101', '20', 'Öğretmen'],
]);
const mebbis = parseMebbisPuantaj(mebbisBuf, 'Kasım 2025', 'Test Okulu');
assert(mebbis.excelFormat === 'mebbis_ek_ders_kbs', 'format mebbis');
assert(mebbis.teachers.length === 2, '2 teachers');
const ahmet = mebbis.teachers.find((t) => t.name.includes('AHMET'));
assert(ahmet && ahmet.messageText.includes('20 saat'), 'toplam saat 12+8');
assert(ahmet.messageText.includes('Veri tipi'), 'veri tip özeti');

// KBS puantaj yükleme: gün sütunları
const kbsBuf = sheetBuf([
  ['T.C. Numarası', 'Veri Tip', 'Gün 1', 'Gün 2', 'Gün 3', 'Adı Soyadı'],
  ['11111111111', 'Ek Ders 101', '2', '3', '1', 'MEHMET KAYA'],
]);
const kbs = parseMebbisPuantaj(kbsBuf, 'Ekim 2025');
assert(kbs.excelFormat === 'kbs_puantaj_yukleme', 'kbs puantaj format');
assert(kbs.teachers[0].messageText.includes('6 saat'), 'gun toplami');

// KBS ek ders bordro
const bordroBuf = sheetBuf([
  ['Adı Soyadı', 'T.C.', 'Brüt Ücret', 'Kesinti', 'Net Ödenecek'],
  ['FATMA ÖZ', '22222222222', '30000', '5000', '25000'],
]);
const ek = parseEkDersBordro(bordroBuf, 'Eylül 2025');
assert(ek.excelFormat === 'kbs_ek_ders_bordro', 'ek bordro format');
assert(ek.teachers[0].messageText.includes('25.000'), 'net tutar');

// KBS yeni rapor benzeri sütun adları (p_yenirapor / maasRapor export)
const kbsRaporBuf = sheetBuf([
  ['T.C. Kimlik Numarası', 'Personelin Adı Soyadı', 'Brüt Tutar', 'Kesintiler Toplamı', 'Net Ödenen Tutar'],
  ['33333333333', 'ALI VELI', '10000', '1000', '9000'],
]);
const ek2 = parseEkDersBordro(kbsRaporBuf, '2025');
assert(ek2.excelFormat === 'kbs_ek_ders_bordro', 'kbs rapor sütunları');
assert(ek2.teachers[0].messageText.includes('9.000'), 'net ödenen');

const maas = parseMaasBordro(kbsRaporBuf, '2025');
assert(maas.excelFormat === 'kbs_maas_bordro', 'maas format from kbs cols');
assert(maas.teachers[0].messageText.includes('9.000'), 'maas net');

console.log('bordro-parsers.test.cjs OK');
