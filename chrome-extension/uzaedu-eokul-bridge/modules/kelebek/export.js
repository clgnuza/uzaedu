var uzaKelebekExportLock = false;

function uzaBuildKelebekSiniflarJson(pendingSheets) {
  return pendingSheets.map((sh) => ({
    sinif_adi: sh.name,
    ogrenciler: sh.rows.map((row) => {
      const ogrNo = String(row[1] || '').trim();
      const { ad, soyad } = uzaSplitAdSoyad(row[2]);
      return { ogrenci_no: ogrNo, ad, soyad };
    }),
  }));
}

async function uzaPostKelebekImport(token, body, schoolId) {
  const path =
    globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.kelebekSinavOgrenciAktar?.importPath ||
    '/eokul-bridge/v1/import/kelebek-students';
  const payload = { ...body };
  if (schoolId) payload.school_id = schoolId;
  return uzaFetchJson(path, { method: 'POST', token, body: payload });
}

/**
 * @param {{ kurumKey?: string, sinifValues?: string[]|null, siraTipi?: string, grupSayisi?: number, schoolId?: string, token: string }} opts
 */
async function uzaRunKelebekExport(opts) {
  if (uzaKelebekExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  const kurumKey = String(opts.kurumKey || uzaGetKurumKey()).trim();
  const profile = uzaProfileFromBootstrap(kurumKey);
  if (!profile?.okl08001) return { ok: false, error: 'Kurum profili yok.' };

  uzaKelebekExportLock = true;
  try {
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001ResolveInitialData(profile, kurumKey);
    if (!jd.ok || !jd.options?.length) {
      if (jd.error === 'login') return { ok: false, error: 'OkulNet oturumu gerekli.' };
      return { ok: false, error: 'Sınıf listesi alınamadı.' };
    }
    const meta = {
      donemKodu: String(jd.donemKodu || '').trim(),
      kurumKodu: String(jd.kurumKodu || '').trim(),
      gununTarihi: String(jd.gununTarihi || '').trim(),
      _baseHtml: jd._baseHtml || null,
    };

    let options = jd.options;
    if (opts.sinifValues != null) {
      const allowed = new Set((opts.sinifValues || []).map((v) => String(v)));
      options = options.filter((o) => allowed.has(String(o.value)));
      if (!options.length) return { ok: false, error: 'Seçili sınıf bulunamadı.' };
    }

    const pendingSheets = [];
    for (const opt of options) {
      const lr = await uzaOkl08001FetchClassStudentRows(profile, kurumKey, meta, opt, meta.gununTarihi);
      if (!lr.ok) {
        if (lr.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
        continue;
      }
      const rows = lr.rows || [];
      if (rows.length) {
        pendingSheets.push({
          name: opt.text,
          rows: rows.map((r) => [r[0], r[1], r[2]]),
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!pendingSheets.length) return { ok: false, error: 'Öğrenci bulunamadı.' };

    const siniflar = uzaBuildKelebekSiniflarJson(pendingSheets);
    const data = await uzaPostKelebekImport(
      opts.token,
      {
        siniflar,
        sira_tipi: opts.siraTipi || 'ikili',
        grup_sayisi: Number(opts.grupSayisi) || 3,
        create_missing_classes: true,
      },
      opts.schoolId || null,
    );
    return { ok: true, data, sinifCount: pendingSheets.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaKelebekExportLock = false;
  }
}

async function uzaListKelebekSinifOptions(kurumKey) {
  const key = String(kurumKey || uzaGetKurumKey()).trim();
  const profile = uzaProfileFromBootstrap(key);
  if (!profile) return { ok: false, error: 'Profil yok.' };
  await uzaWarmOkl08001(profile);
  const jd = await uzaOkl08001ResolveInitialData(profile, key);
  if (!jd.ok) {
    if (jd.error === 'login') return { ok: false, error: 'OkulNet oturumu gerekli.' };
    return { ok: false, error: 'Liste alınamadı.' };
  }
  return { ok: true, options: jd.options };
}
