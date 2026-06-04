var uzaTopluOzursuzLock = false;

function uzaParseOgrNoLines(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);
}

function uzaNormalizePending(typeMap, kurumKey) {
  const activeTypes = uzaTopluOzursuzActiveTypes(kurumKey);
  const raw = typeMap && typeof typeMap === 'object' ? typeMap : {};
  const line = (v) =>
    typeof v === 'string'
      ? uzaParseOgrNoLines(v)
      : Array.isArray(v)
        ? v.map((n) => String(n).replace(/\D/g, '')).filter(Boolean)
        : [];
  const pendingByType = {
    t: new Set(line(raw.t)),
    y: new Set(line(raw.y)),
    s: new Set(line(raw.s)),
    o: new Set(line(raw.o)),
    n: new Set(line(raw.n)),
    g: new Set(line(raw.g)),
  };
  if (kurumKey === 'ortaOgretim') {
    for (const no of line(raw.y)) pendingByType.s.add(no);
  }
  return { pendingByType, activeTypes };
}

async function uzaRunTopluOzursuzWriteHtml(profile, kurumKey, opts, listeleTarih) {
  const { pendingByType, activeTypes } = uzaNormalizePending(opts.typeMap || {}, kurumKey);
  if (uzaPendingTotal(pendingByType) < 1) {
    return { ok: false, error: 'En az bir okul numarası girin.' };
  }
  const jd = await uzaOkl08001FetchInitialDataHtml(profile, kurumKey);
  if (!jd.ok) return { ok: false, error: 'e-Okul oturumu gerekli.' };
  let baseHtml = jd._baseHtml;
  let savedClasses = 0;
  let matchedTotal = 0;
  let blockedTotal = 0;
  for (const opt of jd.options) {
    if (uzaPendingTotal(pendingByType) < 1) break;
    const lr = await uzaOkl08001PostListeleHtml(profile, kurumKey, baseHtml, opt.value, listeleTarih);
    if (!lr.ok) {
      if (lr.error === 'login') return { ok: false, error: 'Oturum sona erdi.' };
      continue;
    }
    const scraped = await uzaScrapeOzursuzEditableRows(lr.html, kurumKey);
    if (!scraped.ok) {
      if (scraped.code === 'gunlukTableMissing') continue;
      return { ok: false, error: 'Sınıf tablosu okunamadı.' };
    }
    const ap = uzaApplyTopluTypesToHtmlRows(scraped.rows, pendingByType, activeTypes);
    matchedTotal += ap.matched;
    blockedTotal += (ap.blockedNumbers || []).length;
    if (!ap.changed) continue;
    const ks = await uzaOkl08001KaydetHtml(profile, kurumKey, lr.html, ap.toCheck, ap.toUncheck);
    if (!ks.ok) {
      return { ok: false, error: ks.error === 'login' ? 'Oturum sona erdi.' : ks.error || 'Kaydet başarısız.' };
    }
    savedClasses += 1;
    baseHtml = ks.html;
    await new Promise((r) => setTimeout(r, 400));
  }
  return {
    ok: true,
    savedClasses,
    matchedTotal,
    blockedTotal,
    remaining: uzaPendingTotal(pendingByType),
  };
}

async function uzaRunTopluOzursuzWrite(opts) {
  if (uzaTopluOzursuzLock) return { ok: false, error: 'İşlem sürüyor.' };
  const kurumKey = uzaGetKurumKey();
  const listeleTarih = uzaFormatListeleDate(opts.tarihIso);
  if (!listeleTarih) return { ok: false, error: 'Geçersiz tarih.' };
  const profile = uzaProfileFromBootstrap(kurumKey);
  if (!profile?.okl08001) return { ok: false, error: 'Profil yok.' };

  uzaTopluOzursuzLock = true;
  try {
    if (!uzaOkl08001UsesJsonApi(kurumKey)) {
      await uzaWarmOkl08001(profile);
      const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
      if (!turSync.ok) return turSync;
      return await uzaRunTopluOzursuzWriteHtml(profile, kurumKey, opts, listeleTarih);
    }

    const { pendingByType, activeTypes } = uzaNormalizePending(opts.typeMap || {}, kurumKey);
    if (uzaPendingTotal(pendingByType) < 1) {
      return { ok: false, error: 'En az bir okul numarası girin.' };
    }

    let savedClasses = 0;
    let matchedTotal = 0;
    let blockedTotal = 0;
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001FetchInitialDataJson(profile);
    if (!jd.ok) return { ok: false, error: 'e-Okul oturumu gerekli.' };
    const meta = {
      donemKodu: String(jd.donemKodu || '').trim(),
      kurumKodu: String(jd.kurumKodu || '').trim(),
    };

    for (const opt of jd.options) {
      if (uzaPendingTotal(pendingByType) < 1) break;
      const lr = await uzaOkl08001PostListeleJson(profile, {
        donemKodu: meta.donemKodu,
        subeKodu: opt.value,
        tarih: listeleTarih,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!lr.ok) {
        if (lr.error === 'login') return { ok: false, error: 'Oturum sona erdi.' };
        continue;
      }
      const ap = uzaApplyTopluTypesToJsonRows(lr.liste, pendingByType, activeTypes);
      matchedTotal += ap.matched;
      blockedTotal += (ap.blockedNumbers || []).length;
      if (!ap.changed) continue;
      const ks = await uzaOkl08001KaydetJson(profile, {
        kayitlar: ap.kayitlar,
        donemKodu: meta.donemKodu,
        tarih: listeleTarih,
        kurumKoduFrontend: meta.kurumKodu,
      });
      if (!ks.ok) {
        return { ok: false, error: ks.error === 'login' ? 'Oturum sona erdi.' : ks.error || 'Kaydet başarısız.' };
      }
      savedClasses += 1;
      await new Promise((r) => setTimeout(r, 400));
    }

    return {
      ok: true,
      savedClasses,
      matchedTotal,
      blockedTotal,
      remaining: uzaPendingTotal(pendingByType),
    };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaTopluOzursuzLock = false;
  }
}
