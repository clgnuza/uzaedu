var uzaRehberExportLock = false;

async function uzaRunVeliRehberExport(opts) {
  if (uzaRehberExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02019) return { ok: false, error: 'Profil yok.' };
  uzaRehberExportLock = true;
  const state = { ogr01001Html: null, lastDetailUrl: null };
  try {
    const kurumKey = uzaGetKurumKey();
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001FetchInitialDataJson(profile);
    if (!jd.ok) return { ok: false, error: jd.error === 'login' ? 'Oturum gerekli.' : 'Sınıf yok.' };
    const meta = {
      donemKodu: String(jd.donemKodu || '').trim(),
      kurumKodu: String(jd.kurumKodu || '').trim(),
      gununTarihi: String(jd.gununTarihi || '').trim(),
    };
    let options = jd.options;
    if (opts.sinifValues != null) {
      const allowed = new Set((opts.sinifValues || []).map(String));
      options = options.filter((o) => allowed.has(String(o.value)));
    }
    const rows = [];
    for (const opt of options) {
      const lr = await uzaOkl08001PostListeleJson(profile, {
        donemKodu: meta.donemKodu,
        subeKodu: opt.value,
        tarih: meta.gununTarihi,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!lr.ok) continue;
      for (const r of uzaOkl08001ListeleJsonToStudentRows(lr.liste)) {
        const ogrNo = String(r[1] || '').trim();
        const adSoyad = String(r[2] || '').trim();
        if (!ogrNo) continue;
        const veli = await uzaFetchVeliContactsForStudent(profile, ogrNo, state);
        if (!veli.ok) continue;
        rows.push({
          sinif_adi: opt.text,
          ogrenci_no: ogrNo,
          ad_soyad: adSoyad,
          anne_ad_soyad: veli.anneAd || '',
          anne_telefon: veli.anneTel || '',
          baba_ad_soyad: veli.babaAd || '',
          baba_telefon: veli.babaTel || '',
        });
        await new Promise((r) => setTimeout(r, 500));
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!rows.length) return { ok: false, error: 'Veli telefonu bulunamadı.' };
    const path =
      globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.ogrenciRehberEokul?.importPath ||
      '/eokul-bridge/v1/import/veli-rehber';
    const body = { rows };
    if (opts.schoolId) body.school_id = opts.schoolId;
    const data = await uzaFetchJson(path, { method: 'POST', token: opts.token, body });
    return { ok: true, data, rowCount: rows.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaRehberExportLock = false;
  }
}
