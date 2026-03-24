/**
 * Örnek evrak şablonları oluşturur.
 * Placeholder'lar docxtemplater ile doldurulacak: {ogretmen_adi}, {okul_adi}, vb.
 * Çalıştırma: node scripts/create-veli-tutanak-template.js
 */
const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'templates');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// --- Veli Toplantı Tutanağı (öğretmenEvrak tarzı tam içerik) ---
const veliTutanak = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          text: 'VELİ TOPLANTI TUTANAĞI',
          heading: 'Heading1',
          alignment: 'CENTER',
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'OKUL BİLGİLERİ', heading: 'Heading2' }),
        new Paragraph({ children: [new TextRun({ text: 'Okul Adı: {okul_adi}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'İl: {il}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'İlçe: {ilce}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Okul Müdürü: {mudur_adi}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Öğretim Yılı: {ogretim_yili}' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'TOPLANTI BİLGİLERİ', heading: 'Heading2' }),
        new Paragraph({ children: [new TextRun({ text: 'Sınıf: {sinif}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Sınıf Öğretmeni: {ogretmen_adi}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Toplantı Tarihi: {tarih}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Katılımcı Veli Sayısı: {veli_sayisi}' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'GÜNDEM MADDELERİ:', heading: 'Heading2' }),
        new Paragraph({ children: [new TextRun({ text: '{gundem_maddeleri}' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'TOPLANTIDA ALINAN KARARLAR:', heading: 'Heading2' }),
        new Paragraph({ children: [new TextRun({ text: '{alinan_kararlar}' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Bu tutanak {tarih} tarihinde {okul_adi} okulunda gerçekleştirilen veli toplantısında alınan kararları içermektedir.',
          alignment: 'CENTER',
        }),
      ],
    },
  ],
});

// --- İzin Dilekçesi (basit örnek) ---
const izinDilekcesi = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({ text: 'DİLEKÇE', heading: 'Heading1', alignment: 'CENTER' }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: '{okul_adi}' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Okul Müdürlüğüne' })] }),
        new Paragraph({ children: [new TextRun({ text: '{il} / {ilce}' })] }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'İlgide yazılı sebeple {izin_baslangic} - {izin_bitis} tarihleri arasında {gun_sayisi} gün izinli sayılmamı saygılarımla arz ederim.',
            }),
          ],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'İzin Nedeni: {izin_nedeni}' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Tarih: {tarih}' }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '{ogretmen_adi}' }),
        new Paragraph({ text: 'Öğretmen' }),
      ],
    },
  ],
});

Packer.toBuffer(veliTutanak).then((buf) => {
  fs.writeFileSync(path.join(dir, 'veli-toplanti-tutanak.docx'), buf);
  console.log('Oluşturuldu: veli-toplanti-tutanak.docx');
});

Packer.toBuffer(izinDilekcesi).then((buf) => {
  fs.writeFileSync(path.join(dir, 'izin-dilekcesi.docx'), buf);
  console.log('Oluşturuldu: izin-dilekcesi.docx');
});
