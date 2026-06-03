var uzaOzurTransferLock = false;

async function uzaFetchOgr02012Ozursuz(profile, ogrNo, state) {
  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return nav;
  const res = await uzaHtmlSessionFetch(profile.ogr02012, {
    method: 'GET',
    refUrl: nav.detailUrl,
  });
  if (!res.ok) return { ok: false, error: `02012 (${res.status})` };
  const html = await res.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  const scraped = uzaScrapeOgr02012OzursuzList(html);
  let ozurlu_gun = 0;
  let ozursuz_gun = 0;
  try {
    const t = await uzaFetchOgr02015Totals(profile, ogrNo, state);
    if (t.ok) {
      ozurlu_gun = t.ozurlu_gun ?? 0;
      ozursuz_gun = t.ozursuz_gun ?? 0;
    }
  } catch {
    /* optional */
  }
  return {
    ok: true,
    detailUrl: nav.detailUrl,
    student: {
      okulNo: scraped.okulNo || ogrNo,
      sinif: scraped.sinif,
      ad: scraped.ad,
      soyad: scraped.soyad,
    },
    rows: scraped.rows,
    ozurluToplamGun: ozurlu_gun,
    ozursuzToplamGun: ozursuz_gun,
  };
}

async function uzaRunOzursuzOzurluListe(opts) {
  if (uzaOzurTransferLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02012) return { ok: false, error: 'Profil yok.' };
  uzaOzurTransferLock = true;
  const state = { ogr01001Html: null };
  try {
    await uzaWarmOkl08001(profile);
    return await uzaFetchOgr02012Ozursuz(profile, String(opts.ogrNo || '').trim(), state);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaOzurTransferLock = false;
  }
}

async function uzaRunOzursuzOzurluAktar(opts) {
  if (uzaOzurTransferLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02013) return { ok: false, error: 'Profil yok.' };
  const ogrNo = String(opts.ogrNo || '').trim();
  const nedeni = String(opts.nedeni || '').trim();
  const aciklama = String(opts.aciklama || '').trim().substring(0, 29);
  const rows = (opts.rows || [])
    .map((r) => ({
      tarih: String(r?.tarih || '').trim(),
      tur: String(r?.tur || '').trim(),
    }))
    .filter((r) => r.tarih);
  if (!ogrNo || !nedeni || !rows.length) {
    return { ok: false, error: 'Numara, özür nedeni ve en az bir satır gerekli.' };
  }

  uzaOzurTransferLock = true;
  const state = { ogr01001Html: null };
  try {
    await uzaWarmOkl08001(profile);
    const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
    if (!nav.ok) {
      return { ok: false, error: nav.error === 'login' ? 'Oturum sona erdi.' : 'Öğrenci bulunamadı.' };
    }
    let saved = 0;
    const failed = [];
    for (const row of rows) {
      const r = await uzaPostOzurluKayitIkiAsama(profile, nav.detailUrl, row, nedeni, aciklama);
      if (!r.ok) {
        if (r.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
        failed.push({ tarih: row.tarih, error: r.error });
        continue;
      }
      saved += 1;
      await new Promise((res) => setTimeout(res, 350));
    }
    return { ok: true, saved, failed, total: rows.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaOzurTransferLock = false;
  }
}
