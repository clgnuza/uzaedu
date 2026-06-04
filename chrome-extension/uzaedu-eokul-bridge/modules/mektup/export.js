var uzaMektupExportLock = false;
var UZA_MEKTUP_PREFILL_KEY = 'uzaMektupPrefill';

async function uzaRunMektupExport(opts) {
  if (uzaMektupExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.okl08002) return { ok: false, error: 'Profil yok.' };
  uzaMektupExportLock = true;
  try {
    const html = await uzaWarmOkl08002(profile);
    const built = await uzaBuildMektup08002ListeleBody(html, opts.uyariDilimi, uzaTodayDdMmYyyy());
    if (!built.ok) return { ok: false, error: 'Liste gövdesi oluşturulamadı.' };
    const res = await uzaHtmlSessionFetch(profile.okl08002, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: built.body,
      refUrl: profile.okl08002,
    });
    const listHtml = await res.text();
    if (uzaLooksLikeLoginPage(listHtml)) return { ok: false, error: 'e-Okul oturumu gerekli.' };
    const scrape = await uzaScrapeMektup08002Grid(listHtml, !!opts.includeSent);
    if (!scrape.ok || !scrape.rows?.length) return { ok: false, error: 'Kayıt bulunamadı.' };
    const ogrenciler = scrape.rows.map((r) => ({
      ogrenci_no: r.ogrenciNo,
      ad_soyad: r.ogrenciAdiSoyadi,
      sinif_adi: r.ogrenciSinifi,
      toplam_devamsizlik: r.toplamDevamsizlik,
    }));
    const path =
      globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.devamsizlikMektubuEokul?.importPath ||
      '/eokul-bridge/v1/import/devamsizlik-mektup-recipients';
    const payload = {
      uyari_dilimi: String(opts.uyariDilimi || '1'),
      uyari_dilimi_label: opts.uyariDilimiLabel || '',
      include_sent: !!opts.includeSent,
      ogrenciler,
    };
    if (opts.schoolId) payload.school_id = opts.schoolId;
    const data = await uzaFetchJson(path, { method: 'POST', token: opts.token, body: payload });
    await uzaStorageSet({
      [UZA_MEKTUP_PREFILL_KEY]: { recipients: data.recipients, at: Date.now() },
    });
    return { ok: true, data, rowCount: ogrenciler.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaMektupExportLock = false;
  }
}
