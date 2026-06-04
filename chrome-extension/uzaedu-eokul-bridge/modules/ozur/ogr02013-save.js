var uzaOzurluWriteLock = false;

const UZA_02013_PAGE_YENI = 'yeniKayit';
const UZA_02013_PAGE_DEVAM = 'kaydetDevam';

function uzaParseOzurRows(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const p = line.split(/[|;]/).map((s) => s.trim());
    if (p.length < 2) continue;
    rows.push({ tarih: p[0], tur: p[1] });
  }
  return rows;
}

function uzaBuild02013SaveBody(html, row, nedeni, aciklama, pageMode) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const form = doc.querySelector('form#aspnetForm') || doc.querySelector('form');
  if (!form) return { ok: false, error: '02013 form' };
  const isDevam = pageMode === UZA_02013_PAGE_DEVAM;
  const dateFieldName = 'txtTarih';
  const skip = new Set([dateFieldName]);
  const params = new URLSearchParams();
  for (const el of form.elements) {
    if (!el.name) continue;
    const type = (el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset' || type === 'file') continue;
    if (skip.has(el.name)) continue;
    if (type === 'checkbox') {
      if (el.checked) params.append(el.name, el.value || 'on');
    } else if (type === 'radio') {
      if (el.checked) params.append(el.name, el.value);
    } else {
      params.append(el.name, el.value);
    }
  }
  params.set('pageMode', pageMode);
  params.set('hiddenKaydet', 'Kaydet');
  params.set('ddlNedeni', String(nedeni || ''));
  params.set(dateFieldName, String(row?.tarih || ''));
  params.set('txtAciklama', String(aciklama || '').substring(0, 29));
  if (!isDevam) {
    const isYarim = /yarım|yarim/i.test(String(row?.tur || ''));
    params.set('txtSure', isYarim ? '0,5' : '1');
  }
  if (!params.has('__EVENTTARGET')) params.set('__EVENTTARGET', '');
  if (!params.has('__EVENTARGUMENT')) params.set('__EVENTARGUMENT', '');
  return { ok: true, body: params.toString() };
}

async function uzaPostOzurluKayitIkiAsama(profile, detailUrl, row, nedeni, aciklama) {
  const pageUrl = profile.ogr02013;
  const getRes = await uzaHtmlSessionFetch(pageUrl, { method: 'GET', refUrl: detailUrl });
  if (!getRes.ok) return { ok: false, error: '02013 yükleme' };
  let html = await getRes.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };

  const built1 = await uzaBuild02013SaveBody(html, row, nedeni, aciklama, UZA_02013_PAGE_YENI);
  if (!built1.ok) return built1;
  const post1 = await uzaHtmlSessionFetch(pageUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built1.body,
    refUrl: detailUrl,
  });
  html = await post1.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };

  const built2 = await uzaBuild02013SaveBody(html, row, nedeni, aciklama, UZA_02013_PAGE_DEVAM);
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

async function uzaRunTopluOzurluWrite(opts) {
  if (uzaOzurluWriteLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02013) return { ok: false, error: 'Profil yok.' };
  const nedeni = String(opts.nedeni || '').trim();
  const aciklama = String(opts.aciklama || '').trim().substring(0, 29);
  const rows = uzaParseOzurRows(opts.rowsText);
  const ogrNos = String(opts.ogrNosText || '')
    .split(/[\s,;]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);
  if (!nedeni) return { ok: false, error: 'Özür nedeni gerekli (ddl kodu).' };
  if (!rows.length) return { ok: false, error: 'En az bir tarih|tür satırı.' };
  if (!ogrNos.length) return { ok: false, error: 'Okul numarası gerekli.' };

  uzaOzurluWriteLock = true;
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
      let okStudent = true;
      for (const row of rows) {
        const r = await uzaPostOzurluKayitIkiAsama(profile, nav.detailUrl, row, nedeni, aciklama);
        if (!r.ok) {
          okStudent = false;
          if (r.error === 'login') return { ok: false, error: 'e-Okul oturumu sona erdi.' };
          break;
        }
        await new Promise((res) => setTimeout(res, 350));
      }
      if (okStudent) saved += 1;
      else invalid.push(ogrNo);
      await new Promise((res) => setTimeout(res, 500));
    }
    return { ok: true, saved, invalid, total: ogrNos.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaOzurluWriteLock = false;
  }
}
