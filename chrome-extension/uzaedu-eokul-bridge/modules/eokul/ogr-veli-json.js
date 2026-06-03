function uzaJsonRolesRoot(json) {
  const d = json?.d != null ? json.d : json?.D;
  return d && typeof d === 'object' ? d : {};
}

function uzaParseMessageJson(msg) {
  if (typeof msg === 'string') {
    try {
      return JSON.parse(msg);
    } catch {
      return {};
    }
  }
  return msg && typeof msg === 'object' ? msg : {};
}

function uzaVeliJoinName(detay, meta) {
  const d = detay && typeof detay === 'object' ? detay : {};
  const m = meta && typeof meta === 'object' ? meta : {};
  const fromDet = [String(d.VELIADI || '').trim(), String(d.VELISOYADI || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fromDet || String(m.YAKIN_ADI_SOYADI || '').trim();
}

function uzaNormalizeTrPhone(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '-') return '';
  let digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  return digits;
}

async function uzaNavigateStudentDetail(profile, ogrNo, state) {
  if (!state.ogr01001Html) {
    const g = await uzaHtmlSessionFetch(profile.ogr01001, { method: 'GET', refUrl: profile.okl08001 });
    state.ogr01001Html = await g.text();
    if (uzaLooksLikeLoginPage(state.ogr01001Html)) return { ok: false, error: 'login' };
  }
  const built = uzaBuildOgr01001Search(state.ogr01001Html, ogrNo, profile);
  if (!built.ok) return { ok: false, error: 'arama' };
  const searchRes = await uzaHtmlSessionFetch(built.postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built.body,
    refUrl: built.referer,
  });
  const detailHtml = await searchRes.text();
  if (uzaLooksLikeLoginPage(detailHtml)) return { ok: false, error: 'login' };
  if (!uzaLooksLikeOgrDetail(detailHtml)) return { ok: false, error: 'detay' };
  state.lastDetailUrl = searchRes.url || profile.ogr02001;
  return { ok: true, detailUrl: state.lastDetailUrl };
}

async function uzaFetchVeliYakinlar(profile, refUrl) {
  const page = String(profile?.ogr02019 || '').replace(/\?.*$/, '');
  const endpoint = `${page}/GetPageController`;
  const res = await uzaHtmlSessionFetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: '',
    refUrl,
  });
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const root = uzaJsonRolesRoot(json || {});
  if (root?.error) {
    const msg = String(root?.message || 'veli');
    if (uzaLooksLikeMebAjandaMessage(msg)) return { ok: false, needMebAjanda: true, error: msg };
    return { ok: false, error: msg };
  }
  const obj = uzaParseMessageJson(root?.message);
  return { ok: true, yakinlar: Array.isArray(obj?.yakinlar) ? obj.yakinlar : [] };
}

async function uzaFetchVeliDetay(profile, refUrl, yakinId) {
  const page = String(profile?.ogr02019 || '').replace(/\?.*$/, '');
  const endpoint = `${page}/GetVeliDetayBilgileri`;
  const res = await uzaHtmlSessionFetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ Keys: ['yakinId'], Degerler: [Number(yakinId)] }),
    refUrl,
  });
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const root = uzaJsonRolesRoot(json || {});
  if (root?.error) return { ok: false, error: String(root?.message || 'detay') };
  const obj = uzaParseMessageJson(root?.message);
  const detay = Array.isArray(obj?.yakindetay) ? obj.yakindetay[0] || null : null;
  return { ok: true, detay };
}

async function uzaFetchVeliContactsForStudent(profile, ogrNo, state) {
  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return nav;
  const page = String(profile?.ogr02019 || '').trim();
  const warm = await uzaHtmlSessionFetch(page, { method: 'GET', refUrl: nav.detailUrl });
  if (uzaLooksLikeLoginPage(await warm.text())) return { ok: false, error: 'login' };
  const yk = await uzaFetchVeliYakinlar(profile, page);
  if (!yk.ok) return yk;
  const anne = yk.yakinlar.find((x) => String(x?.YAKINLIK || '') === '2');
  const baba = yk.yakinlar.find((x) => String(x?.YAKINLIK || '') === '1');
  let anneAd = '';
  let anneTel = '';
  let babaAd = '';
  let babaTel = '';
  if (anne?.YAKIN_ID) {
    const d = await uzaFetchVeliDetay(profile, page, anne.YAKIN_ID);
    if (d.ok) {
      anneAd = uzaVeliJoinName(d.detay, anne);
      anneTel = uzaNormalizeTrPhone(d.detay?.CEP_TEL);
    }
  }
  if (baba?.YAKIN_ID) {
    const d = await uzaFetchVeliDetay(profile, page, baba.YAKIN_ID);
    if (d.ok) {
      babaAd = uzaVeliJoinName(d.detay, baba);
      babaTel = uzaNormalizeTrPhone(d.detay?.CEP_TEL);
    }
  }
  if (!anneTel && !babaTel) return { ok: false, error: 'telefon' };
  return { ok: true, anneAd, anneTel, babaAd, babaTel };
}
