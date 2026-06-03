function uzaAppendFormFields(form, params, ogrNo, mode) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset') continue;
    if (type === 'file') continue;
    const name = el.name;
    if (/Ogrenci.*No|Okul.*No|ogr.*no/i.test(name) && type === 'text') {
      params.set(name, String(ogrNo || '').trim());
      continue;
    }
    if (mode === 'yeni' && name === 'hdnYeni') {
      params.set(name, '1');
      continue;
    }
    if (tag === 'select') params.append(name, el.value);
    else if (tag === 'textarea') params.append(name, el.value);
    else if (type === 'checkbox') {
      if (el.checked) params.append(name, el.value || 'on');
    } else if (type === 'radio') {
      if (el.checked) params.append(name, el.value);
    } else params.append(name, el.value);
  }
}

function uzaBuildOgr01001Search(html, ogrNo, profile) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const form = doc.querySelector('form#aspnetForm') || doc.querySelector('form');
  if (!form) return { ok: false, error: 'ogr01001 form' };
  const params = new URLSearchParams();
  uzaAppendFormFields(form, params, ogrNo, 'yeni');
  const btn = form.querySelector('input[type="submit"][value*="Ara"], button[id*="Ara"]');
  if (btn?.name) params.set(btn.name, btn.value || 'Ara');
  const base = String(profile?.ogrBase || '').replace(/\/+$/, '');
  const action = form.getAttribute('action') || profile?.ogr01001File || 'IOG01001.aspx';
  let postUrl = profile?.ogr01001;
  try {
    postUrl = new URL(action, base + '/').href;
  } catch {
    /* keep */
  }
  return { ok: true, body: params.toString(), postUrl, referer: profile?.ogr01001 };
}

function uzaLooksLikeOgrDetail(html) {
  const t = String(html || '').slice(0, 150000);
  if (uzaLooksLikeLoginPage(t)) return false;
  if (/bulunamad/i.test(t) && /öğrenci/i.test(t)) return false;
  return /02001\.aspx|Öğrenci\s*Bilgi|ogrenci/i.test(t);
}

async function uzaFetchOgr02015Totals(profile, ogrNo, state) {
  if (!state.ogr01001Html) {
    const g = await uzaHtmlSessionFetch(profile.ogr01001, { method: 'GET', refUrl: profile.okl08001 });
    state.ogr01001Html = await g.text();
    if (uzaLooksLikeLoginPage(state.ogr01001Html)) return { ok: false, error: 'login' };
  }
  const built = uzaBuildOgr01001Search(state.ogr01001Html, ogrNo, profile);
  if (!built.ok) return built;
  const searchRes = await uzaHtmlSessionFetch(built.postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built.body,
    refUrl: built.referer,
  });
  const detailHtml = await searchRes.text();
  if (!uzaLooksLikeOgrDetail(detailHtml)) return { ok: false, error: 'detay' };
  const res15 = await uzaHtmlSessionFetch(profile.ogr02015, {
    method: 'GET',
    refUrl: searchRes.url || profile.ogr02001,
  });
  const html15 = await res15.text();
  if (uzaLooksLikeLoginPage(html15)) return { ok: false, error: 'login' };
  return uzaScrapeOgr02015Totals(html15);
}

function uzaScrapeOgr02015Totals(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const needleOzurlu = 'Özürlü Devamsızlık Toplamı';
  const needleOzursuz = 'Özürsüz Devamsızlık Toplamı';
  const parseGun = (root, needle) => {
    for (const tr of root.querySelectorAll('tr')) {
      const tds = [...tr.querySelectorAll('td')];
      for (let i = 0; i < tds.length; i++) {
        const txt = String(tds[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt.includes(needle)) continue;
        const m = txt.match(/(\d+(?:[,.]\d+)?)\s*gün/i);
        if (m) return parseFloat(m[1].replace(',', '.'));
        for (let j = i + 1; j < tds.length; j++) {
          const m2 = String(tds[j].textContent || '').match(/(\d+(?:[,.]\d+)?)/);
          if (m2) return parseFloat(m2[1].replace(',', '.'));
        }
      }
    }
    return 0;
  };
  const ozurluRoot = doc.querySelector('#tblOzurluDevamsizlikToplam') || doc.body;
  const ozursuzRoot = doc.querySelector('#tblOzursuzDevamsizlikToplam') || doc.body;
  return {
    ok: true,
    ozurlu_gun: parseGun(ozurluRoot, needleOzurlu),
    ozursuz_gun: parseGun(ozursuzRoot, needleOzursuz),
  };
}
