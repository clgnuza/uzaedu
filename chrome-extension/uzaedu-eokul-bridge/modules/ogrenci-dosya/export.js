var uzaOgrDosyaLock = false;

const UZA_OGR_DOSYA_FILE_BASE = {
  ogrenciBilgileri: 'Ogrenci_Bilgileri',
  nufusBilgileri: 'Nufus_Bilgileri',
  ogrenciGenelBilgileri: 'Ogrenci_Genel_Bilgileri',
  ogrenciOzelBilgileri: 'Ogrenci_Ozel_Bilgileri',
  veliBilgileri: 'Veli_Bilgileri',
};

async function uzaRunOgrenciDosyaExport(opts) {
  if (uzaOgrDosyaLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02019) return { ok: false, error: 'Profil yok.' };
  const groupId = String(opts.groupId || 'veliBilgileri').trim();
  if (groupId === 'ogrenciResmi') {
    return uzaRunOgrenciResmiExport({ sinifValues: opts.sinifValues ?? null });
  }
  const kurumKey = uzaGetKurumKey();
  const fieldIds = uzaOgrDosyaResolveFieldIds(groupId, kurumKey, opts.fieldIds);
  const fieldDefs = uzaOgrDosyaFieldsForGroup(groupId, kurumKey).filter((f) =>
    fieldIds.includes(String(f.id)),
  );
  if (!fieldIds.length) return { ok: false, error: 'Alan seçin.' };

  uzaOgrDosyaLock = true;
  const state = { ogr01001Html: null, lastDetailUrl: null };
  const headers = uzaOgrDosyaCsvHeaders(groupId, kurumKey, fieldIds);
  const csvRows = [];
  const portalRows = [];
  const fileBase = UZA_OGR_DOSYA_FILE_BASE[groupId] || 'Ogrenci_Dosya';

  try {
    const kurum = uzaGetKurumKey();
    if (opts.mebAjandaCode && kurum !== 'ortaOgretim' && groupId === 'veliBilgileri') {
      const aj = await uzaVerifyMebAjandaCode(
        profile,
        opts.mebAjandaCode,
        profile.ogr02019,
        opts.userName || '',
      );
      if (!aj.ok) return aj;
    }
    await uzaWarmOkl08001(profile);
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
        const sube = String(r[0] || opt.text || '').trim();
        if (!ogrNo) continue;

        const got = await uzaFetchOgrDosyaGroupValues(profile, ogrNo, state, groupId, fieldDefs, {
          sube,
          ogrNo,
          adSoyad,
        });
        if (got.needMebAjanda) {
          return { ok: false, needMebAjanda: true, error: got.error || 'MEB Ajanda kodu gerekli.' };
        }
        if (!got.ok) continue;
        const rowVals = fieldIds.map((id) => String(got.values?.[id] ?? ''));
        csvRows.push(rowVals);
        const values = {};
        fieldIds.forEach((id, i) => {
          values[id] = rowVals[i] ?? '';
        });
        portalRows.push({
          sinif: sube,
          ogrenci_no: ogrNo,
          ad_soyad: adSoyad,
          values,
        });
        await new Promise((res) => setTimeout(res, groupId === 'veliBilgileri' ? 450 : 300));
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    if (!csvRows.length) return { ok: false, error: 'Dışa aktarılacak öğrenci yok.' };
    const stamp = new Date().toISOString().slice(0, 10);
    await uzaDownloadCsv(`${fileBase}_${stamp}.csv`, headers, csvRows);
    let importResult = null;
    if (opts.importToPanel && opts.token && portalRows.length) {
      const path =
        globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.ogrenciDosyaBilgileriAl?.importPath ||
        '/eokul-bridge/v1/import/ogrenci-dosya';
      const body = { group_id: groupId, rows: portalRows };
      if (opts.schoolId) body.school_id = opts.schoolId;
      importResult = await uzaFetchJson(path, { method: 'POST', token: opts.token, body });
    }
    return { ok: true, rowCount: csvRows.length, groupId, importResult };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaOgrDosyaLock = false;
  }
}
