var uzaFaaliyetLock = false;

function uzaIsoToTrDate(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

function uzaBuildFaaliyetBody(html, tarihTr, sure, aciklama, pageMode) {
  const built = uzaBuild02013SaveBody(
    html,
    { tarih: tarihTr, tur: 'tam' },
    'F',
    String(aciklama || '').trim().substring(0, 29),
    pageMode,
  );
  if (!built.ok) return built;
  const params = new URLSearchParams(built.body);
  params.set('txtSure', String(sure || '1'));
  return { ok: true, body: params.toString() };
}

async function uzaPostFaaliyetKayit(profile, detailUrl, tarihTr, sure, aciklama) {
  const pageUrl = profile.ogr02013;
  const getRes = await uzaHtmlSessionFetch(pageUrl, { method: 'GET', refUrl: detailUrl });
  if (!getRes.ok) return { ok: false, error: '02013 yükleme' };
  let html = await getRes.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };

  const built1 = uzaBuildFaaliyetBody(html, tarihTr, sure, aciklama, UZA_02013_PAGE_YENI);
  if (!built1.ok) return built1;
  const post1 = await uzaHtmlSessionFetch(pageUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built1.body,
    refUrl: detailUrl,
  });
  html = await post1.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };

  const built2 = uzaBuildFaaliyetBody(html, tarihTr, sure, aciklama, UZA_02013_PAGE_DEVAM);
  if (!built2.ok) return built2;
  const post2 = await uzaHtmlSessionFetch(pageUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built2.body,
    refUrl: detailUrl,
  });
  if (uzaLooksLikeLoginPage(await post2.text())) return { ok: false, error: 'login' };
  return { ok: true };
}

async function uzaRunTopluFaaliyetWrite(opts) {
  if (uzaFaaliyetLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02013) return { ok: false, error: 'Profil yok.' };
  const tarihTr = uzaIsoToTrDate(opts.tarihIso);
  const sure = String(opts.sure || '1').trim();
  const aciklama = String(opts.aciklama || '').trim();
  const ogrNos = String(opts.ogrNosText || '')
    .split(/[\s,;]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);
  if (!tarihTr || !aciklama) return { ok: false, error: 'Tarih ve faaliyet adı gerekli.' };
  if (!ogrNos.length) return { ok: false, error: 'Okul numarası gerekli.' };

  uzaFaaliyetLock = true;
  const state = { ogr01001Html: null };
  let saved = 0;
  const invalid = [];
  try {
    await uzaWarmOkl08001(profile);
    for (const ogrNo of ogrNos) {
      const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
      if (!nav.ok) {
        invalid.push(ogrNo);
        continue;
      }
      const r = await uzaPostFaaliyetKayit(profile, nav.detailUrl, tarihTr, sure, aciklama);
      if (!r.ok) {
        if (r.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
        invalid.push(ogrNo);
      } else {
        saved += 1;
      }
      await new Promise((res) => setTimeout(res, 550));
    }
    return { ok: true, saved, invalid, total: ogrNos.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaFaaliyetLock = false;
  }
}
