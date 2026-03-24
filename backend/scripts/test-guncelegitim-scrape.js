/**
 * Güncel Eğitim scrape testi – #headline container ile parse doğrulama
 */
const cheerio = require('cheerio');

const url = 'https://www.guncelegitim.com/haberler/sinav-gorevi/';
const base = 'https://www.guncelegitim.com';

async function test() {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const containerSelector = '#headline';
  const itemSelector = 'a[href*="/haber/"]';
  const $scope = containerSelector ? $(containerSelector).first() : $.root();
  const items = $scope.find(itemSelector);

  console.log('container:', containerSelector);
  console.log('Bulunan sınav görevi link sayısı:', items.length);
  console.log('\n--- Parse edilen başlıklar (ilk 20) ---\n');

  const results = [];
  items.each((i, el) => {
    const $el = $(el);
    let href = $el.attr('href') ?? '';
    if (href.startsWith('/')) href = base + href;
    else if (!href.startsWith('http')) href = base + '/' + href;

    let title = $el.text().trim();
    title = title.replace(/^SINAV GÖREVİ\s*/i, '').trim() || title;

    results.push({ title, href });
  });

  results.slice(0, 20).forEach((r, i) => {
    console.log((i + 1) + '.', r.title?.slice(0, 65));
    console.log('   ', r.href?.slice(-55));
  });

  console.log('\n--- Kategori örnekleri (ilk 5) ---');
  function inferCategory(title) {
    const t = (title || '').toLowerCase();
    if (/ösym|osym/i.test(t)) return 'osym';
    if (/aöf|açık öğretim/i.test(t) && !/ataaof|ata-aöf/i.test(t)) return 'aof';
    if (/meb|milli eğitim|lgs|eğitim bakanlığı/i.test(t)) return 'meb';
    return 'meb';
  }
  results.slice(0, 5).forEach((r, i) => {
    console.log((i + 1) + '.', inferCategory(r.title), '|', r.title?.slice(0, 50));
  });

  console.log('\n✓ Test tamamlandı');
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
