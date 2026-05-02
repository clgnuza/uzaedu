/**
 * ÖğretmenX sınav görevi arama sayfası — migration scrape_config seçicilerini doğrular (ağ gerekir).
 * Usage: node tools/verify-ogretmenx-exam-duty-scrape.mjs
 */
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const base = 'https://www.ogretmenx.com';
const listUrl = '/arama?q=s%C4%B1nav+g%C3%B6revi&type=post';
const url = `${base}${listUrl}`;

const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html;charset=utf-8,*/*' } });
console.log('HTTP', res.status, res.ok ? 'OK' : 'FAIL');
if (!res.ok) process.exit(1);

const html = await res.text();
const $ = cheerio.load(html);

const container = $('.result-category');
console.log('container .result-category count:', container.length);

const itemSel = '.col-lg-6.border-bottom';
const items = container.find(itemSel);
console.log('items (.col-lg-6.border-bottom):', items.length);

let ok = 0;
let bad = 0;
items.each((i, el) => {
  const $el = $(el);
  const $a = $el.find('a.d-block').first();
  const $h4 = $el.find('h4.title-2-line').first();
  const href = $a.attr('href') || '';
  const title = ($h4.text() || '').trim();
  if (!href || !title) {
    bad++;
    return;
  }
  const full = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;
  ok++;
  if (i < 5) console.log(' —', title.slice(0, 72), '→', full.slice(0, 80));
});

console.log('parsed_ok:', ok, 'parsed_bad:', bad);

const first = container.find(itemSel).first();
const firstHref = first.find('a.d-block').attr('href') || '';
const articleUrl = firstHref.startsWith('http')
  ? firstHref
  : `${base}${firstHref.startsWith('/') ? '' : '/'}${firstHref}`;
const ar = await fetch(articleUrl, { headers: { 'User-Agent': UA, Accept: 'text/html;charset=utf-8,*/*' } });
console.log('detail HTTP', ar.status, articleUrl.slice(0, 70));
if (ar.ok) {
  const $d = cheerio.load(await ar.text());
  const bodySel =
    'article, .post-content, .content, .entry-content, main, .haber-detay, .haber-content, [itemprop=articleBody], .yazi-icerik, .news-content';
  let detailChars = 0;
  for (const s of bodySel.split(',').map((x) => x.trim())) {
    const t = $d(s).first().text().trim();
    if (t.length > detailChars) detailChars = t.length;
  }
  console.log('detail_body_max_chars (varsayılan scrape seçicileri):', detailChars);
  if (detailChars < 80) process.exit(1);
}

process.exit(ok > 0 && bad === 0 ? 0 : 1);
