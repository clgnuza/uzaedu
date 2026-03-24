/**
 * Boşluklu test ders programı üretir ve backend'e yükler.
 * Kullanım: node scripts/gen-test-timetable.js
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const MAX_LESSONS = 8;

// Gerçek öğretmen adları (DB'den)
const teachers = [
  { no: 1, ad: 'Ali Çelik' },
  { no: 2, ad: 'Ayşe Yılmaz' },
  { no: 3, ad: 'Elif Şahin' },
  { no: 4, ad: 'Fatma Öz' },
  { no: 5, ad: 'Hasan Demir' },
  { no: 6, ad: 'Hülya Akın' },
  { no: 7, ad: 'Mehmet Kaya' },
  { no: 8, ad: 'Test Öğretmen' },
  { no: 9, ad: 'Zeynep Arslan' },
  { no: 10, ad: 'İbrahim Yıldız' },
];

// Boşluklu ders programı: [dayIdx(0=Pzt), lessonNum(1-8), 'SINIF-DERS']
// Kasıtlı boşluklar: bazı saatler boş (nöbet tespiti için)
const schedules = {
  'Ali Çelik': [
    [0,1,'7A-MAT'],[0,2,'8B-MAT'],                  // Pzt: 1,2 dolu; 3-8 BOŞ
    [1,1,'9A-MAT'],[1,2,'9B-MAT'],[1,3,'10A-MAT'],  // Sal: 1,2,3 dolu
    [2,2,'7B-MAT'],[2,4,'8A-MAT'],                   // Çar: 2,4 dolu; 1,3 BOŞ
    [3,1,'6A-MAT'],[3,3,'6B-MAT'],[3,5,'7C-MAT'],   // Per: 1,3,5 dolu; 2,4 BOŞ
    [4,2,'8C-MAT'],[4,4,'9C-MAT'],                   // Cum: 2,4 dolu
  ],
  'Ayşe Yılmaz': [
    [0,2,'7A-TRK'],[0,4,'8A-TRK'],                  // Pzt: 2,4 dolu; 1,3 BOŞ
    [1,1,'6C-TRK'],[1,3,'7D-TRK'],
    [2,1,'9A-TRK'],[2,2,'9B-TRK'],[2,3,'10A-TRK'],
    [3,2,'6A-TRK'],                                  // Per: sadece 2. ders dolu
    [4,1,'8C-TRK'],[4,3,'7B-TRK'],[4,5,'6B-TRK'],
  ],
  'Elif Şahin': [
    [0,1,'9A-ING'],[0,3,'9B-ING'],[0,5,'10A-ING'],
    [1,2,'8A-ING'],[1,4,'8B-ING'],                  // Sal: 2,4 dolu; 1,3 BOŞ
    [2,1,'7A-ING'],[2,3,'7B-ING'],
    [3,1,'6A-ING'],[3,2,'6B-ING'],[3,4,'10B-ING'],  // Per: 1,2,4 dolu; 3 BOŞ
    [4,3,'9C-ING'],                                  // Cum: sadece 3. ders
  ],
  'Fatma Öz': [
    [0,1,'8A-FEN'],[0,6,'9B-FEN'],                  // Pzt: 1,6 dolu; 2-5 BOŞ
    [1,3,'7C-FEN'],[1,5,'7D-FEN'],
    [2,2,'8B-FEN'],[2,4,'8C-FEN'],
    [3,1,'9A-FEN'],[3,3,'9C-FEN'],[3,5,'10A-FEN'],
    [4,2,'7A-FEN'],[4,4,'6A-FEN'],
  ],
  'Hasan Demir': [
    [0,3,'9A-TAR'],[0,5,'9B-TAR'],
    [1,1,'10A-TAR'],[1,4,'10B-TAR'],                // Sal: 1,4 dolu; 2,3 BOŞ
    [2,2,'11A-TAR'],[2,3,'11B-TAR'],
    [3,1,'8A-TAR'],                                  // Per: sadece 1. ders
    [4,1,'7A-TAR'],[4,2,'7B-TAR'],[4,4,'8B-TAR'],
  ],
  'Hülya Akın': [
    [0,2,'7A-MÜZ'],[0,4,'8A-MÜZ'],
    [1,1,'9A-MÜZ'],[1,3,'9B-MÜZ'],
    [2,2,'6A-MÜZ'],[2,5,'6B-MÜZ'],                 // Çar: 2,5 dolu; 3,4 BOŞ
    [3,3,'10A-MÜZ'],[3,4,'10B-MÜZ'],
    [4,1,'11A-MÜZ'],                                 // Cum: sadece 1. ders dolu
  ],
  'Mehmet Kaya': [
    [0,4,'9C-COĞ'],[0,6,'10A-COĞ'],
    [1,2,'10B-COĞ'],[1,5,'11A-COĞ'],
    [2,1,'7A-COĞ'],[2,3,'8A-COĞ'],
    [3,4,'9A-COĞ'],[3,6,'9B-COĞ'],                 // Per: 4,6 dolu; 5 BOŞ
    [4,3,'10C-COĞ'],[4,5,'11B-COĞ'],
  ],
  'Test Öğretmen': [
    [0,1,'6A-BED'],[0,3,'6B-BED'],[0,5,'7A-BED'],
    [1,2,'7B-BED'],[1,4,'8A-BED'],
    [2,1,'8B-BED'],[2,3,'9A-BED'],
    [3,2,'9B-BED'],[3,4,'10A-BED'],
    [4,1,'10B-BED'],[4,3,'11A-BED'],
  ],
  'Zeynep Arslan': [
    [0,2,'7A-KİM'],[0,5,'8A-KİM'],                 // Pzt: 2,5 dolu; 1,3,4 BOŞ
    [1,1,'9A-KİM'],[1,3,'9B-KİM'],[1,5,'10A-KİM'],
    [2,2,'10B-KİM'],[2,4,'11A-KİM'],
    [3,1,'7B-KİM'],[3,3,'8B-KİM'],
    [4,4,'9C-KİM'],                                  // Cum: sadece 4. ders
  ],
  'İbrahim Yıldız': [
    [0,1,'9A-FİZ'],[0,3,'9B-FİZ'],[0,5,'10A-FİZ'],
    [1,2,'10B-FİZ'],[1,4,'11A-FİZ'],
    [2,1,'7A-FİZ'],[2,3,'8A-FİZ'],[2,5,'8B-FİZ'],
    [3,2,'9C-FİZ'],[3,4,'10C-FİZ'],
    [4,1,'11B-FİZ'],[4,3,'7B-FİZ'],
  ],
};

// Excel oluştur
const infoRows = [
  ['# Ders Programı Excel Şablonu – wide format'],
  ['# Hücre formatı: SINIF-DERS (örn: 7A-MAT, 9B-TRK, 10A-COĞ)'],
  ['# SINIF: Sınıf şubesi (7A, 8B, 9C vb.)'],
  ['# DERS: Branş kısaltması (MAT=Matematik, TRK=Türkçe, COĞ=Coğrafya, FEN=Fen vb.)'],
  [`# Gün sütunları: ${MAX_LESSONS} ders saati (okulun ders saatine göre ayarlayın)`],
  ['# MEB Madde 91/a: Sistem bu tablodan en az dersli günü hesaplayarak nöbeti o güne verir.'],
  ['# Önemli: Ad_Soyad sistemdeki öğretmen e-posta veya adı ile birebir eşleşmeli.'],
  ['# Müdür ve müdür yardımcılarını tabloya eklemeyin (nöbetten muaf).'],
  [''],
];

const header = ['No', 'Ad_Soyad'];
for (const d of DAYS) {
  for (let i = 1; i <= MAX_LESSONS; i++) header.push(`${d}_ders${i}`);
}
const colCount = header.length;

const rows = [...infoRows, header];

for (const t of teachers) {
  const row = Array(colCount).fill('');
  row[0] = t.no;
  row[1] = t.ad;
  const fills = schedules[t.ad] || [];
  for (const [dayIdx, lesson, val] of fills) {
    const colOffset = 2 + dayIdx * MAX_LESSONS + (lesson - 1);
    if (colOffset < colCount) row[colOffset] = val;
  }
  rows.push(row);
}

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'DersProgram');

const outPath = path.join(__dirname, 'test-timetable-gapful.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Excel oluşturuldu:', outPath);

// Ders başına doluluk istatistiklerini yazdır
console.log('\n=== Öğretmen başına ders sayıları ===');
for (const t of teachers) {
  const fills = schedules[t.ad] || [];
  const perDay = [0,0,0,0,0];
  for (const [dayIdx] of fills) perDay[dayIdx]++;
  console.log(`${t.ad.padEnd(16)} Toplam:${fills.length} | Günlük:[${perDay.join(',')}]`);
}
