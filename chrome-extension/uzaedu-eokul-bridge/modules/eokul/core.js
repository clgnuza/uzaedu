const UZA_MEB_ORIGIN = 'https://e-okul.meb.gov.tr';

function uzaProfileFromBootstrap(kurumKey) {
  const b = globalThis.UZA_BOOTSTRAP_CACHE;
  const p = b?.kurumProfiles?.[kurumKey];
  return p && typeof p === 'object' ? p : null;
}

function uzaTplUrl(template, profile) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, k) => profile?.[k] || '');
}

function uzaLooksLikeLoginPage(text) {
  const t = String(text || '').slice(0, 120000);
  if (!t) return false;
  if (/OkulNet-Ogretmen-Portal/i.test(t) && /(login|giri[sş])/i.test(t)) return true;
  if (/<input[^>]+type=["']password/i.test(t) && /(giri[sş]|login)/i.test(t)) return true;
  return false;
}

async function uzaHtmlSessionFetch(url, init = {}) {
  const refererOverride = init.refUrl;
  const { refUrl: _drop, ...fetchInit } = init;
  const method = String(fetchInit.method || 'GET').toUpperCase();
  const merged = {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    ...fetchInit,
    headers: {
      Accept:
        method === 'POST'
          ? '*/*'
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      ...(fetchInit.headers || {}),
    },
  };
  if (!merged.headers.Origin) merged.headers.Origin = UZA_MEB_ORIGIN;
  if (!merged.headers.Referer) merged.headers.Referer = refererOverride || UZA_MEB_ORIGIN;
  return fetch(url, merged);
}

async function uzaWarmOkl08001(profile) {
  const url = String(profile?.okl08001 || '').trim();
  if (!url) throw new Error('okl08001');
  const res = await uzaHtmlSessionFetch(url, { method: 'GET', refUrl: url });
  const text = await res.text();
  if (uzaLooksLikeLoginPage(text)) throw new Error('login');
  if (!res.ok) throw new Error(String(res.status));
  return { res, html: text };
}

function uzaSplitAdSoyad(adSoyadRaw) {
  const kelimeler = String(adSoyadRaw || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!kelimeler.length) return { ad: '', soyad: '' };
  const soyad = kelimeler.pop();
  return { ad: kelimeler.join(' '), soyad: soyad || '' };
}
