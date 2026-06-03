var uzaToplamExportLock = false;

function uzaToplamMatches(ozs, ozr, f) {
  const useOzursuz = f.useOzursuz !== false;
  const useOzurlu = f.useOzurlu !== false;
  const ozsOk = !useOzursuz || (ozs >= f.ozursuzMin && ozs <= f.ozursuzMax);
  const ozrOk = !useOzurlu || (ozr >= f.ozurluMin && ozr <= f.ozurluMax);
  if (useOzursuz && useOzurlu) return f.combineAnd ? ozsOk && ozrOk : ozsOk || ozrOk;
  if (useOzursuz) return ozsOk;
  if (useOzurlu) return ozrOk;
  return false;
}

async function uzaRunToplamDevamsizlikExport(opts) {
  if (uzaToplamExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.okl08001) return { ok: false, error: 'Profil yok.' };
  uzaToplamExportLock = true;
  const state = { ogr01001Html: null };
  const filters = {
    useOzursuz: opts.useOzursuz !== false,
    useOzurlu: opts.useOzurlu !== false,
    ozursuzMin: Number(opts.ozursuzMin ?? 1),
    ozursuzMax: Number(opts.ozursuzMax ?? 180),
    ozurluMin: Number(opts.ozurluMin ?? 0),
    ozurluMax: Number(opts.ozurluMax ?? 180),
    combineAnd: opts.combineAnd !== false,
  };
  try {
    const kurumKey = uzaGetKurumKey();
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001FetchInitialDataJson(profile);
    if (!jd.ok) return { ok: false, error: jd.error === 'login' ? 'Oturum gerekli.' : 'Sınıf listesi yok.' };
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
    const candidates = [];
    for (const opt of options) {
      const lr = await uzaOkl08001PostListeleJson(profile, {
        donemKodu: meta.donemKodu,
        subeKodu: opt.value,
        tarih: meta.gununTarihi,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!lr.ok) continue;
      for (const row of uzaOkl08001ListeleJsonToStudentRows(lr.liste)) {
        const ogrNo = String(row[1] || '').trim();
        if (!ogrNo) continue;
        candidates.push({ ogrNo, adSoyad: String(row[2] || '').trim(), sinifAdi: opt.text });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!candidates.length) return { ok: false, error: 'Öğrenci bulunamadı.' };

    const ogrenciler = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const t = await uzaFetchOgr02015Totals(profile, c.ogrNo, state);
      if (!t.ok) continue;
      const ozs = Number(t.ozursuz_gun ?? 0);
      const ozr = Number(t.ozurlu_gun ?? 0);
      if (!uzaToplamMatches(ozs, ozr, filters)) continue;
      ogrenciler.push({
        ogrenci_no: c.ogrNo,
        ad_soyad: c.adSoyad,
        sinif_adi: c.sinifAdi,
        ozursuz_gun: ozs,
        ozurlu_gun: ozr,
      });
      await new Promise((r) => setTimeout(r, 450));
    }
    if (!ogrenciler.length) return { ok: false, error: 'Filtreye uyan öğrenci yok.' };

    const path =
      globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.toplamDevamsizlikAktar?.importPath ||
      '/eokul-bridge/v1/import/toplam-devamsizlik';
    const body = {
      ogrenciler,
      use_ozursuz: filters.useOzursuz,
      use_ozurlu: filters.useOzurlu,
      ozursuz_min: filters.ozursuzMin,
      ozursuz_max: filters.ozursuzMax,
      ozurlu_min: filters.ozurluMin,
      ozurlu_max: filters.ozurluMax,
      combine_and: filters.combineAnd,
    };
    if (opts.schoolId) body.school_id = opts.schoolId;
    const data = await uzaFetchJson(path, { method: 'POST', token: opts.token, body });
    return { ok: true, data, matched: ogrenciler.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaToplamExportLock = false;
  }
}
