function uzaParseGetVeriRow(json) {
  const d = json?.d != null ? json.d : json?.D;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

function uzaPickJsonD(json) {
  const d = json?.d != null ? json.d : json?.D;
  return d && typeof d === 'object' ? d : null;
}

function uzaNormLabelText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function uzaScrapeValueByLabel(html, labelMatch) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const needle = uzaNormLabelText(labelMatch);
  if (!needle) return '';
  for (const tr of doc.querySelectorAll('tr')) {
    const cells = [...tr.querySelectorAll('th,td,label')];
    for (let i = 0; i < cells.length - 1; i++) {
      const t = uzaNormLabelText(cells[i].textContent);
      if (!t || !t.includes(needle)) continue;
      const v = String(cells[i + 1].textContent || '').replace(/\s+/g, ' ').trim();
      if (v) return v;
    }
  }
  for (const lab of doc.querySelectorAll('label')) {
    const t = uzaNormLabelText(lab.textContent);
    if (!t.includes(needle)) continue;
    const forId = lab.getAttribute('for');
    if (forId) {
      const el = doc.getElementById(forId);
      if (el) return String(el.value || el.textContent || '').trim();
    }
    const sib = lab.nextElementSibling;
    if (sib) return String(sib.textContent || sib.value || '').trim();
  }
  return '';
}

function uzaExtractIlkOgrenciBilgileriMap(d) {
  const src = d && typeof d === 'object' ? d : {};
  const ob = src.ogrenciBilgi && typeof src.ogrenciBilgi === 'object' ? src.ogrenciBilgi : {};
  const pickList = (list, code) => {
    const arr = Array.isArray(list) ? list : [];
    const hit = arr.find((x) => String(x?.KOD ?? x?.kod ?? x?.value ?? '') === String(code ?? ''));
    return String(hit?.ACIKLAMA ?? hit?.text ?? hit?.label ?? code ?? '').trim();
  };
  return {
    tcKimlikNo: String(ob.OGR_OB_TCNO || '').trim(),
    adi: String(ob.OGR_OB_ADI || '').trim(),
    soyadi: String(ob.OGR_OB_SOYADI || '').trim(),
    dogumTarihi: String(ob.DOGUM_TARIHI || '').trim(),
    okulNumarasi: String(ob.OGR_OB_OGR_NO || '').trim(),
    durumu: pickList(src.durumuListesi, ob.OGR_OB_DURUMU),
    velisiKim: pickList(src.velisiListesi, ob.OGR_OB_VELI_KIM),
    smsBilgilendirme: pickList(src.smsListesi, ob.OGR_OB_SMS),
    yabanciDil: pickList(src.yabanciDilListesi, ob.OGR_OB_YABANCI_DIL),
    sinifSube: String(ob.SINIFI || '').trim(),
  };
}

async function uzaNavigateStudentWithHtml(profile, ogrNo, state, pageUrl) {
  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return nav;
  const url = String(pageUrl || profile.ogr02001 || '').trim();
  const g = await uzaHtmlSessionFetch(url, { method: 'GET', refUrl: nav.detailUrl || profile.ogr01001 });
  const html = await g.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  return { ok: true, html, detailUrl: nav.detailUrl };
}

async function uzaFetchOgr02001ApiMap(profile, refUrl) {
  const page = String(profile?.ogr02001 || '').replace(/\?.*$/, '');
  if (!page) return { ok: false, error: '02001' };
  const endpoint = `${page}/GetInitialData`;
  const res = await uzaHtmlSessionFetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: '{}',
    refUrl: String(refUrl || page).trim(),
  });
  if (!res.ok) return { ok: false, error: String(res.status) };
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const d = uzaPickJsonD(json);
  if (!d) return { ok: false, error: 'api' };
  return { ok: true, values: uzaExtractIlkOgrenciBilgileriMap(d) };
}

async function uzaFetchNufusGetVeri(profile, refUrl) {
  const endpoint = String(profile?.ogr02003GetVeri || '').trim();
  if (!endpoint) return { ok: false, error: '02003' };
  const keys =
    globalThis.UZA_BOOTSTRAP_CACHE?.constants?.ogr02003GetVeriKeys &&
    typeof globalThis.UZA_BOOTSTRAP_CACHE.constants.ogr02003GetVeriKeys === 'object'
      ? globalThis.UZA_BOOTSTRAP_CACHE.constants.ogr02003GetVeriKeys
      : {};
  const res = await uzaHtmlSessionFetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(keys),
    refUrl: String(refUrl || profile.ogr02001 || '').trim(),
  });
  if (!res.ok) return { ok: false, error: String(res.status) };
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const row = uzaParseGetVeriRow(json);
  if (!row || String(row.hata || '0') !== '0') return { ok: false, error: 'nufus' };
  return { ok: true, row };
}

async function uzaFetchOgrDosyaGroupValues(profile, ogrNo, state, groupId, fieldDefs, listRow) {
  const sube = String(listRow?.sube || '').trim();
  const ogrNoStr = String(listRow?.ogrNo || ogrNo || '').trim();
  const adSoyad = String(listRow?.adSoyad || '').trim();

  if (groupId === 'ogrenciBilgileri') {
    const base = { sinif: sube, ogrenciNo: ogrNoStr, adSoyad };
    const nav = await uzaNavigateStudentDetail(profile, ogrNoStr, state);
    if (!nav.ok) return { ok: true, values: base };
    const api = await uzaFetchOgr02001ApiMap(profile, nav.detailUrl);
    if (!api.ok) return { ok: true, values: base };
    return { ok: true, values: { ...base, ...api.values } };
  }

  if (groupId === 'nufusBilgileri') {
    const nav = await uzaNavigateStudentDetail(profile, ogrNoStr, state);
    if (!nav.ok) return nav;
    const nufus = await uzaFetchNufusGetVeri(profile, nav.detailUrl);
    if (!nufus.ok) return nufus;
    const values = {};
    for (const f of fieldDefs) {
      const key = String(f.jsonKey || f.id || '').trim();
      values[f.id] = String(nufus.row?.[key] ?? nufus.row?.[key.toUpperCase()] ?? '').trim();
    }
    return { ok: true, values };
  }

  if (groupId === 'ogrenciGenelBilgileri') {
    const nav = await uzaNavigateStudentWithHtml(profile, ogrNoStr, state, profile.ogr02002);
    if (!nav.ok) return nav;
    const values = {};
    for (const f of fieldDefs) {
      values[f.id] = uzaScrapeValueByLabel(nav.html, f.labelMatch || f.label);
    }
    return { ok: true, values };
  }

  if (groupId === 'ogrenciOzelBilgileri') {
    const nav = await uzaNavigateStudentWithHtml(profile, ogrNoStr, state, profile.ogr02014);
    if (!nav.ok) return nav;
    const values = {};
    for (const f of fieldDefs) {
      values[f.id] = uzaScrapeValueByLabel(nav.html, f.labelMatch || f.label);
    }
    return { ok: true, values };
  }

  if (groupId === 'veliBilgileri') {
    const veli = await uzaFetchVeliFlatForStudent(profile, ogrNoStr, state);
    if (veli.needMebAjanda) return veli;
    if (!veli.ok) return veli;
    return { ok: true, values: veli.flat };
  }

  return { ok: false, error: 'grup' };
}
