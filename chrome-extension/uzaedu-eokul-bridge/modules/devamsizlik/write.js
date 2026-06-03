var uzaDevamsizlikWriteLock = false;

function uzaFormatListeleDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

async function uzaRunDevamsizlikCampaignWriteHtml(profile, kurumKey, opts) {
  const kind = opts.kind === 'ders' ? 'ders' : 'gunluk';
  const siniflar = opts.siniflar || [];
  if (!siniflar.length) return { ok: false, error: 'Sınıf verisi yok.' };
  const listeleTarih = uzaFormatListeleDate(String(opts.tarihIso || '').trim());
  if (!listeleTarih) return { ok: false, error: 'Geçersiz tarih.' };

  const bySinifAdi = new Map();
  for (const s of siniflar) {
    bySinifAdi.set(String(s.sinif_adi || '').trim(), s);
  }

  const jd = await uzaOkl08001FetchInitialDataHtml(profile, kurumKey);
  if (!jd.ok) {
    return { ok: false, error: jd.error === 'login' ? 'OkulNet oturumu gerekli.' : 'Sınıf listesi yok.' };
  }
  let baseHtml = jd._baseHtml;
  let savedClasses = 0;
  let matchedTotal = 0;
  let blockedTotal = 0;
  const scrapeMode = kind === 'ders' ? 'ders_yoklama' : 'gunluk';

  for (const opt of jd.options) {
    const payload = bySinifAdi.get(String(opt.text || '').trim());
    if (!payload?.ogrenciler?.length) continue;
    const byNo = uzaBuildOgrenciWriteMap([payload]);

    const lr = await uzaOkl08001PostListeleHtml(profile, kurumKey, baseHtml, opt.value, listeleTarih);
    if (!lr.ok) {
      if (lr.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
      continue;
    }
    const scraped = uzaScrapeGunlukGridEditableRows(lr.html, kurumKey, scrapeMode);
    if (!scraped.ok) continue;

    let ap;
    if (kind === 'ders') {
      ap = uzaApplyDersYoklamaWriteToHtmlRows(scraped.rows, byNo);
    } else {
      ap = uzaApplyGunlukWriteToHtmlRows(scraped.rows, byNo, kurumKey);
    }
    matchedTotal += ap.matched;
    blockedTotal += ap.blocked;
    if (!ap.changed) continue;

    const ks = await uzaOkl08001KaydetHtml(
      profile,
      kurumKey,
      lr.html,
      ap.toCheck || [],
      ap.toUncheck || [],
      ap.selectSets,
    );
    if (!ks.ok) {
      return { ok: false, error: ks.error === 'login' ? 'OkulNet oturumu sona erdi.' : ks.error || 'Kaydet başarısız.' };
    }
    savedClasses += 1;
    baseHtml = ks.html;
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!savedClasses && !matchedTotal) {
    return { ok: false, error: 'Eşleşen veya kaydedilebilir kayıt yok.' };
  }
  return { ok: true, savedClasses, matchedTotal, blockedTotal };
}

async function uzaRunDevamsizlikCampaignWrite(opts) {
  const kind = opts.kind === 'ders' ? 'ders' : 'gunluk';
  if (uzaDevamsizlikWriteLock) return { ok: false, error: 'İşlem sürüyor.' };
  const kurumKey = uzaGetKurumKey();
  const profile = uzaProfileFromBootstrap(kurumKey);
  if (!profile?.okl08001) return { ok: false, error: 'Profil yok.' };

  uzaDevamsizlikWriteLock = true;
  try {
    if (!uzaOkl08001UsesJsonApi(kurumKey)) {
      await uzaWarmOkl08001(profile);
      const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
      if (!turSync.ok) return turSync;
      return await uzaRunDevamsizlikCampaignWriteHtml(profile, kurumKey, opts);
    }

    const siniflar = opts.siniflar || [];
    if (!siniflar.length) return { ok: false, error: 'Sınıf verisi yok.' };
    const tarihIso = String(opts.tarihIso || '').trim();
    const listeleTarih = uzaFormatListeleDate(tarihIso);
    if (!listeleTarih) return { ok: false, error: 'Geçersiz tarih.' };

    let savedClasses = 0;
    let matchedTotal = 0;
    let blockedTotal = 0;
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001FetchInitialDataJson(profile);
    if (!jd.ok) {
      return { ok: false, error: jd.error === 'login' ? 'OkulNet oturumu gerekli.' : 'Sınıf listesi yok.' };
    }
    const meta = {
      donemKodu: String(jd.donemKodu || '').trim(),
      kurumKodu: String(jd.kurumKodu || '').trim(),
    };
    const bySinifAdi = new Map();
    for (const s of siniflar) {
      bySinifAdi.set(String(s.sinif_adi || '').trim(), s);
    }

    for (const opt of jd.options) {
      const payload = bySinifAdi.get(String(opt.text || '').trim());
      if (!payload?.ogrenciler?.length) continue;

      const lr = await uzaOkl08001PostListeleJson(profile, {
        donemKodu: meta.donemKodu,
        subeKodu: opt.value,
        tarih: listeleTarih,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!lr.ok) {
        if (lr.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
        continue;
      }

      const byNo = uzaBuildOgrenciWriteMap([payload]);
      const ap =
        kind === 'ders'
          ? uzaApplyDersYoklamaWriteToJsonRows(lr.liste, byNo)
          : uzaApplyGunlukWriteToJsonRows(lr.liste, byNo);
      matchedTotal += ap.matched;
      blockedTotal += ap.blocked;
      if (!ap.changed) continue;

      const ks = await uzaOkl08001KaydetJson(profile, {
        kayitlar: ap.kayitlar,
        donemKodu: meta.donemKodu,
        tarih: listeleTarih,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!ks.ok) {
        return { ok: false, error: ks.error === 'login' ? 'OkulNet oturumu sona erdi.' : ks.error || 'Kaydet başarısız.' };
      }
      savedClasses += 1;
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!savedClasses && !matchedTotal) {
      return { ok: false, error: 'Eşleşen veya kaydedilebilir kayıt yok.' };
    }
    return { ok: true, savedClasses, matchedTotal, blockedTotal };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaDevamsizlikWriteLock = false;
  }
}
