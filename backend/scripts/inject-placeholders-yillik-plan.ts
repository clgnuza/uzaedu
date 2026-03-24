/**
 * Orijinal yıllık plan DOCX'e merge placeholder'ları ekler.
 * header1.xml içindeki başlık metni {yillik_plan_baslik} ile değiştirilir;
 * docxtemplater merge sırasında buildMergeData'daki yillik_plan_baslik kullanılır.
 *
 * Kullanım: npm run inject-placeholders-yillik-plan
 */

import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const SRC = path.join(TEMPLATES_DIR, 'ornek-yillik-plan-cografya.docx');
const DST = path.join(TEMPLATES_DIR, 'ornek-yillik-plan-cografya-merged.docx');

const PLACEHOLDER = '{yillik_plan_baslik}';

// Orijinal başlık metni (dots + LİSESİ 2025-2026 ... PLANI) – bunu tek placeholder ile değiştiriyoruz
const OLD_HEADER_PATTERN =
  /(<w:r><w:rPr><w:b\/><w:bCs\/><w:sz w:val="24"\/><w:szCs w:val="24"\/><\/w:rPr><w:t>……………………………………………………………\.<\/w:t><\/w:r>)(<w:r[^>]*>[\s\S]*?<w:t[^>]*>.*?LİSESİ[\s\S]*?PLANI<\/w:t><\/w:r>)/;
const NEW_HEADER_RUN = `<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${PLACEHOLDER}</w:t></w:r>`;

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Kaynak şablon bulunamadı:', SRC);
    process.exit(1);
  }

  const buf = fs.readFileSync(SRC);
  const zip = new PizZip(buf);

  // word/header1.xml
  const headerPath = 'word/header1.xml';
  let headerXml = zip.file(headerPath)?.asText();
  if (!headerXml) {
    console.error('header1.xml bulunamadı.');
    process.exit(1);
  }

  // Basit replace: "……………………………………………………………." ile başlayan ve "PLANI" ile biten tüm run'ları
  // tek {yillik_plan_baslik} run'ı ile değiştir.
  // Word metni parçalara böldüğü için regex yerine hedef metni bulup değiştiriyoruz.
  const dotsRun =
    '<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>…………………………………………………………….</w:t></w:r>';
  const runWithLisesi = headerXml.indexOf('LİSESİ 202');
  if (runWithLisesi === -1) {
    console.error('Header içinde "LİSESİ 202" bulunamadı. Şablon yapısı farklı olabilir.');
    process.exit(1);
  }

  // dots run'dan sonra PLANI'ya kadar olan tüm run'ları tek placeholder run ile değiştir
  // Strategy: dots run + (LİSESİ ... PLANI) kısmı -> dots run + placeholder run
  // Aslında yillik_plan_baslik zaten noktaları içeriyor, o yüzden tüm ilk paragrafı tek run yapalım.
  const firstParaStart = headerXml.indexOf('<w:p ', headerXml.indexOf('<w:hdr'));
  const firstParaEnd = headerXml.indexOf('</w:p>', firstParaStart) + 5;
  const paraContent = headerXml.substring(
    headerXml.indexOf('>', firstParaStart) + 1,
    firstParaEnd - 5
  );
  const pPrMatch = paraContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : '';

  const newContent =
    pPr +
    NEW_HEADER_RUN;
  const newPara =
    headerXml.substring(firstParaStart, headerXml.indexOf('>', firstParaStart) + 1) +
    newContent +
    '</w:p>';

  const beforePara = headerXml.substring(0, firstParaStart);
  const afterPara = headerXml.substring(firstParaEnd);
  headerXml = beforePara + newPara + afterPara;

  zip.file(headerPath, headerXml);
  const out = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(DST, out);
  console.log('Placeholder enjekte edildi:', DST);
}

main();
