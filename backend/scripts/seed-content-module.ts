/**
 * Varsayılan kanallar, kaynaklar ve örnek içerikler seed.
 * Çalıştırma: cd backend && npm run seed-content
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { env } from '../src/config/env';

/** MEB merkez/genel kaynakları */
const MEB_SOURCES = [
  { key: 'personel_gm', label: 'Personel GM', base_url: 'https://personel.meb.gov.tr', rss_url: 'https://personel.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'tegm', label: 'TEGM', base_url: 'https://tegm.meb.gov.tr', rss_url: 'https://tegm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'ogm', label: 'OGM', base_url: 'https://ogm.meb.gov.tr', rss_url: 'https://ogm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'dogm', label: 'DÖGM', base_url: 'https://dogm.meb.gov.tr', rss_url: 'https://dogm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'yegitek', label: 'YEĞİTEK', base_url: 'https://yegitek.meb.gov.tr', rss_url: 'https://yegitek.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'orgm', label: 'ORGM', base_url: 'https://orgm.meb.gov.tr', rss_url: 'https://orgm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'ttkb', label: 'TTKB', base_url: 'https://ttkb.meb.gov.tr', rss_url: 'https://ttkb.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'odsgm', label: 'ÖDSGM', base_url: 'https://odsgm.meb.gov.tr', rss_url: 'https://odsgm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'mtegm', label: 'MTEGM', base_url: 'https://mtegm.meb.gov.tr', rss_url: 'https://mtegm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'sgb', label: 'Strateji Geliştirme Başkanlığı', base_url: 'https://sgb.meb.gov.tr', rss_url: 'https://sgb.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'akademi', label: 'Millî Eğitim Akademisi', base_url: 'https://akademi.meb.gov.tr', rss_url: 'https://akademi.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
  { key: 'yyegm', label: 'YYEGM', base_url: 'https://yyegm.meb.gov.tr', rss_url: 'https://yyegm.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml' },
];

/** 81 İl MEB – subdomain (meb.gov.tr alt alan adı) → label. city_filter = subdomain. RSS limit 10. */
const IL_MEB_SUBDOMAINS = [
  'adana', 'adiyaman', 'afyon', 'agri', 'amasya', 'ankara', 'antalya', 'artvin', 'aydin', 'balikesir',
  'bilecik', 'bingol', 'bitlis', 'bolu', 'burdur', 'bursa', 'canakkale', 'cankiri', 'corum', 'denizli',
  'diyarbakir', 'edirne', 'elazig', 'erzincan', 'erzurum', 'eskisehir', 'gaziantep', 'giresun', 'gumushane',
  'hakkari', 'hatay', 'isparta', 'mersin', 'istanbul', 'izmir', 'kars', 'kastamonu', 'kayseri', 'kirklareli',
  'kirsehir', 'kocaeli', 'konya', 'kutahya', 'malatya', 'manisa', 'kmaras', 'mardin', 'mugla', 'mus',
  'nevsehir', 'nigde', 'ordu', 'rize', 'sakarya', 'samsun', 'siirt', 'sinop', 'sivas', 'tekirdag',
  'tokat', 'trabzon', 'tunceli', 'sanliurfa', 'usak', 'van', 'yozgat', 'zonguldak', 'aksaray', 'bayburt',
  'karaman', 'kirikkale', 'batman', 'sirnak', 'bartin', 'ardahan', 'igdir', 'yalova', 'karabuk', 'kilis',
  'osmaniye', 'duzce',
];

const IL_LABELS: Record<string, string> = {
  kmaras: 'Kahramanmaraş',
  sanliurfa: 'Şanlıurfa',
  sirnak: 'Şırnak',
  afyon: 'Afyonkarahisar',
  aydin: 'Aydın',
  balikesir: 'Balıkesir',
  canakkale: 'Çanakkale',
  cankiri: 'Çankırı',
  corum: 'Çorum',
  diyarbakir: 'Diyarbakır',
  elazig: 'Elazığ',
  erzincan: 'Erzincan',
  gumushane: 'Gümüşhane',
  kirklareli: 'Kırklareli',
  kirsehir: 'Kırşehir',
  kutahya: 'Kütahya',
  mugla: 'Muğla',
  mus: 'Muş',
  nigde: 'Niğde',
  tekirdag: 'Tekirdağ',
  usak: 'Uşak',
  kirikkale: 'Kırıkkale',
  karabuk: 'Karabük',
};

function ilLabel(sub: string): string {
  return IL_LABELS[sub] ?? sub.charAt(0).toUpperCase() + sub.slice(1);
}

/** Sıra: MEB(0), Haberler(1), Eğitim(2), İl(3), Yarışmalar(4) */
const CHANNELS = [
  { key: 'meb_duyurulari', label: 'MEB Duyuruları', sort_order: 0 },
  { key: 'haberler', label: 'Haberler', sort_order: 1 },
  { key: 'egitim_duyurulari', label: 'Eğitim Duyuruları', sort_order: 2 },
  { key: 'il_duyurulari', label: 'İl Duyuruları', sort_order: 3 },
  { key: 'yarismalar', label: 'Yarışmalar', sort_order: 4 },
];

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: env.db.host,
    port: env.db.port,
    username: env.db.username,
    password: env.db.password,
    database: env.db.database,
  });

  await ds.initialize();

  // Olmayacak RSS kaynaklarını sil (bbc_turkce, dw_turkce, aa_egitim, eski il_meb)
  await ds.query(
    `DELETE FROM content_items WHERE source_id IN (SELECT id FROM content_sources WHERE key IN ('bbc_turkce', 'dw_turkce', 'aa_egitim', 'il_meb'))`,
  );
  await ds.query(
    `DELETE FROM channel_sources WHERE source_id IN (SELECT id FROM content_sources WHERE key IN ('bbc_turkce', 'dw_turkce', 'aa_egitim', 'il_meb'))`,
  );
  await ds.query(
    `DELETE FROM content_sources WHERE key IN ('bbc_turkce', 'dw_turkce', 'aa_egitim', 'il_meb')`,
  );
  console.log('Eski kaynaklar kaldırıldı.');

  // MEB image_url'lerini https'e çevir (mixed content engeli)
  const imgResult = await ds.query(
    `UPDATE content_items SET image_url = 'https://' || SUBSTRING(image_url FROM 8)
     WHERE image_url LIKE 'http://%.meb.gov.tr%' AND image_url NOT LIKE 'https://%'`,
  );
  const imgUpdated = (imgResult as unknown[])?.[0] ?? 0;
  if (imgUpdated && typeof imgUpdated === 'object' && 'rowCount' in imgUpdated) {
    console.log(`Görsel URL'leri HTTPS'e güncellendi: ${(imgUpdated as { rowCount?: number }).rowCount ?? 0} kayıt.`);
  }

  // Insert merkez MEB sources
  for (const s of MEB_SOURCES) {
    const rssUrl = (s as { rss_url?: string }).rss_url;
    await ds.query(
      rssUrl
        ? `INSERT INTO content_sources (id, key, label, base_url, rss_url, sync_interval_minutes, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 120, true)
           ON CONFLICT (key) DO UPDATE SET rss_url = EXCLUDED.rss_url`
        : `INSERT INTO content_sources (id, key, label, base_url, sync_interval_minutes, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, 120, true)
           ON CONFLICT (key) DO NOTHING`,
      rssUrl ? [s.key, s.label, s.base_url, rssUrl] : [s.key, s.label, s.base_url],
    );
  }
  console.log(`${MEB_SOURCES.length} merkez MEB kaynak eklendi.`);

  // Insert 81 İl MEB (RSS limit 10, city_filter ile eşleşecek)
  for (const sub of IL_MEB_SUBDOMAINS) {
    const key = `il_${sub}`;
    const label = `${ilLabel(sub)} İl Millî Eğitim`;
    const baseUrl = `https://${sub}.meb.gov.tr`;
    const rssUrl = `https://${sub}.meb.gov.tr/meb_iys_dosyalar/xml/rss_duyurular.xml`;
    await ds.query(
      `INSERT INTO content_sources (id, key, label, base_url, rss_url, rss_item_limit, sync_interval_minutes, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 10, 120, true)
       ON CONFLICT (key) DO UPDATE SET rss_url = EXCLUDED.rss_url, rss_item_limit = 10`,
      [key, label, baseUrl, rssUrl],
    );
  }
  console.log(`${IL_MEB_SUBDOMAINS.length} il MEB kaynak eklendi.`);

  // Personel GM RSS kullanıyor; scrape_config kaldırıldı

  // Insert channels
  for (const c of CHANNELS) {
    await ds.query(
      `INSERT INTO content_channels (id, key, label, sort_order, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, true)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = true`,
      [c.key, c.label, c.sort_order],
    );
  }
  console.log(`${CHANNELS.length} kanal eklendi.`);

  // MEB Duyuruları: sadece merkez MEB kaynakları (Personel, TEGM, OGM, TTKB vb.)
  // Önce il kaynaklarını meb_duyurulari'den kaldır (migrasyon)
  await ds.query(
    `DELETE FROM channel_sources WHERE channel_id = (SELECT id FROM content_channels WHERE key = 'meb_duyurulari')
     AND source_id IN (SELECT id FROM content_sources WHERE key LIKE 'il_%')`,
  );
  for (const sk of MEB_SOURCES.map((s) => s.key)) {
    await ds.query(
      `INSERT INTO channel_sources (channel_id, source_id)
       SELECT ch.id, s.id FROM content_channels ch, content_sources s
       WHERE ch.key = 'meb_duyurulari' AND s.key = $1
       ON CONFLICT (channel_id, source_id) DO NOTHING`,
      [sk],
    );
  }
  // İl Duyuruları: sadece 81 il MEB kaynakları
  for (const sk of IL_MEB_SUBDOMAINS.map((s) => `il_${s}`)) {
    await ds.query(
      `INSERT INTO channel_sources (channel_id, source_id)
       SELECT ch.id, s.id FROM content_channels ch, content_sources s
       WHERE ch.key = 'il_duyurulari' AND s.key = $1
       ON CONFLICT (channel_id, source_id) DO NOTHING`,
      [sk],
    );
  }
  // Link haberler kanalına MEB merkez + tüm il kaynakları (il haberleri city filtre ile)
  const haberlerSources = ['ttkb', 'yegitek', 'sgb', 'orgm', 'personel_gm', ...IL_MEB_SUBDOMAINS.map((s) => `il_${s}`)];
  for (const sk of haberlerSources) {
    await ds.query(
      `INSERT INTO channel_sources (channel_id, source_id)
       SELECT ch.id, s.id FROM content_channels ch, content_sources s
       WHERE ch.key = 'haberler' AND s.key = $1
       ON CONFLICT (channel_id, source_id) DO NOTHING`,
      [sk],
    );
  }
  console.log('Kanallara kaynaklar bağlandı.');

  // Yarışmalar ve Eğitim Duyuruları kanallarına kaynak bağla
  for (const sk of ['ogm', 'tegm', 'yegitek', 'mtegm']) {
    await ds.query(
      `INSERT INTO channel_sources (channel_id, source_id)
       SELECT ch.id, s.id FROM content_channels ch, content_sources s
       WHERE ch.key = 'yarismalar' AND s.key = $1
       ON CONFLICT (channel_id, source_id) DO NOTHING`,
      [sk],
    );
  }
  const allSourceKeys = [...MEB_SOURCES.map((s) => s.key), ...IL_MEB_SUBDOMAINS.map((s) => `il_${s}`)];
  for (const sk of allSourceKeys) {
    await ds.query(
      `INSERT INTO channel_sources (channel_id, source_id)
       SELECT ch.id, s.id FROM content_channels ch, content_sources s
       WHERE ch.key = 'egitim_duyurulari' AND s.key = $1
       ON CONFLICT (channel_id, source_id) DO NOTHING`,
      [sk],
    );
  }
  console.log('Yarışmalar ve Eğitim Duyuruları kanallarına kaynaklar bağlandı.');

  // Örnek içerikler (Defterdoldur haftalik-bulten tarzı – gerçek MEB ve eğitim linkleri). image_url RSS’te varsa eklenir.
  const SAMPLE_ITEMS: { source_key: string; title: string; source_url: string; content_type: string; image_url?: string }[] = [
    // MEB Duyuruları / Personel
    {
      source_key: 'personel_gm',
      title: 'Millî Eğitim Akademisi Sözleşmeli Eğitim Personeli Alımı Başvuru Süresinin Uzatıldığına İlişkin Duyuru',
      source_url: 'https://personel.meb.gov.tr/www/milli-egitim-akademisi-sozlesmeli-egitim-personeli-alimi-basvuru-suresinin-uzatildigina-iliskin-duyuru/icerik/1701',
      content_type: 'announcement',
      image_url: 'https://personel.meb.gov.tr/www/images/mansetresim.png',
    },
    {
      source_key: 'personel_gm',
      title: 'Sözleşmeli Öğretmenlik Sözlü Sınav Sonucu Sorgulama',
      source_url: 'https://personel.meb.gov.tr/www/2025-yili-sozlesmeli-ogretmen-alimi-sozlu-sinav-sonuc-bilgisi/icerik/1665',
      content_type: 'announcement',
      image_url: 'https://personel.meb.gov.tr/www/images/mansetresim.png',
    },
    // TEGM / Yarışmalar
    {
      source_key: 'tegm',
      title: '"KORKMA! GENÇLİĞİN RUHU BURADA!" TEMALI YARIŞMALAR SONUÇLANDI',
      source_url: 'https://tegm.meb.gov.tr/www/korkma-gencligin-ruhu-burada-temali-yarismalar-sonuclandi/icerik/1241',
      content_type: 'competition',
      image_url: 'https://tegm.meb.gov.tr/meb_iys_dosyalar/2025_12/30224311_adsiztasarim.jpg',
    },
    {
      source_key: 'ogm',
      title: '"KORKMA! GENÇLİĞİN RUHU BURADA" TEMALI MÜZİK ÖĞRETMENLERİ ARASI BESTE YARIŞMASI SONUÇLARI BELLİ OLDU',
      source_url: 'https://ogm.meb.gov.tr/www/korkma-gencligin-ruhu-burada-temali-muzik-ogretmenleri-arasi-beste-yarismasi-sonuclari-belli-oldu/icerik/2497',
      content_type: 'competition',
      image_url: 'https://ogm.meb.gov.tr/www/images/mansetresim.png',
    },
    // YEĞİTEK / ORGM
    {
      source_key: 'yegitek',
      title: 'Eğitimde Teknoloji Kullanımı İyi Uygulama Örnekleri Çağrısı Açıldı',
      source_url: 'https://yegitek.meb.gov.tr/www/egitimde-teknoloji-kullanimi-iyi-uygulama-ornekleri-cagrisi-acildi/icerik/3928',
      content_type: 'announcement',
      image_url: 'https://yegitek.meb.gov.tr/www/images/mansetresim.png',
    },
    {
      source_key: 'orgm',
      title: 'EĞİTSEL DEĞERLENDİRME VE TARAMA ARAÇLARI EĞİTİMİ İLE E BEP EĞİTİMİ BAŞLADI',
      source_url: 'https://orgm.meb.gov.tr/www/egitsel-degerlendirme-ve-tarama-araclari-egitimi-ile-e-bep-egitimi-basladi/icerik/3536',
      content_type: 'announcement',
      image_url: 'https://orgm.meb.gov.tr/meb_iys_dosyalar/2026_02/c74b8388efdea9092c0515030e255745.jpg',
    },
    {
      source_key: 'orgm',
      title: 'ÖZEL EĞİTİM MESLEK OKULU MESLEK PROGRAM KILAVUZLARI TAMAMLANDI',
      source_url: 'https://orgm.meb.gov.tr/www/ozel-egitim-meslek-okulu-meslek-program-kilavuzlari-tamamlandi/icerik/3538',
      content_type: 'announcement',
      image_url: 'https://orgm.meb.gov.tr/meb_iys_dosyalar/2026_02/c18ada0e9910930366deff4348406eb7.jpg',
    },
    // TTKB / ÖDSGM
    {
      source_key: 'ttkb',
      title: 'Millî Eğitim Dergisi Uluslararası Açık Bilim Altyapılarında Yerini Güçlendiriyor',
      source_url: 'https://ttkb.meb.gov.tr/www/milli-egitim-dergisi-uluslararasi-acik-bilim-altyapilarinda-yerini-guclendiriyor/icerik/872',
      content_type: 'news',
      image_url: 'https://ttkb.meb.gov.tr/www/images/mansetresim.png',
    },
    {
      source_key: 'ttkb',
      title: '"Ders Kitapları ve Öğretim Materyalleri İnceleme ve Değerlendirme Süreçleri" Dokümanı Paydaşların Erişimine Sunuldu',
      source_url: 'https://ttkb.meb.gov.tr/www/ders-kitaplari-ve-ogretim-materyalleri-inceleme-ve-degerlendirme-surecleri-dokumani-paydaslarin-erisimine-sunuldu/icerik/871',
      content_type: 'announcement',
      image_url: 'https://ttkb.meb.gov.tr/meb_iys_dosyalar/2026_02/b8122edfdc2c42ff3f99d74fe53aca62.jpg',
    },
    {
      source_key: 'odsgm',
      title: '2026 Yılı İlköğretim ve Ortaöğretim Kurumları Bursluluk Sınavı Başvuru Kılavuzu',
      source_url: 'https://odsgm.meb.gov.tr/www/2026-ilkogretim-ve-ortaogretim-kurumlari-bursluluk-sinavi-basvuru-ve-uygulama-kilavuzu-yayimlandi/icerik/1537',
      content_type: 'exam',
      image_url: 'https://odsgm.meb.gov.tr/www/images/mansetresim.png',
    },
  ];

  for (const it of SAMPLE_ITEMS) {
    const srcRows = await ds.query('SELECT id FROM content_sources WHERE key = $1', [it.source_key]);
    if (srcRows.length === 0) continue;
    const sourceId = srcRows[0].id;
    const exists = await ds.query(
      'SELECT 1 FROM content_items WHERE source_id = $1 AND title = $2 LIMIT 1',
      [sourceId, it.title],
    );
    if (exists.length > 0) {
      // Mevcut kayıtlarda image_url ve anasayfa source_url güncelle
      await ds.query(
        `UPDATE content_items SET image_url = COALESCE(NULLIF(image_url, ''), $1), source_url = $2
         WHERE source_id = $3 AND title = $4`,
        [it.image_url ?? null, it.source_url, sourceId, it.title],
      );
      continue;
    }
    await ds.query(
      `INSERT INTO content_items (id, source_id, content_type, title, source_url, image_url, published_at, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), true)`,
      [sourceId, it.content_type, it.title, it.source_url, it.image_url ?? null],
    );
  }
  console.log(`${SAMPLE_ITEMS.length} örnek içerik eklendi.`);

  await ds.destroy();
  console.log('Seed tamamlandı.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
