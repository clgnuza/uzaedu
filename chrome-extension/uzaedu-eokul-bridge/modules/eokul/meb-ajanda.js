function uzaMebAjandaVerificationCode(profile) {
  const page = String(profile?.ogr02019 || '').trim();
  const m = page.match(/\/([A-Z]{3}02019)\.aspx/i);
  return m ? String(m[1]).toUpperCase() : '';
}

async function uzaVerifyMebAjandaCode(profile, code, refUrl, userName) {
  const oneTimeCode = String(code || '').trim();
  if (!/^\d{6}$/.test(oneTimeCode)) {
    return { ok: false, needMebAjanda: true, error: 'MEB Ajanda kodu 6 haneli olmalıdır.' };
  }
  const verification = uzaMebAjandaVerificationCode(profile);
  if (!verification) return { ok: false, needMebAjanda: true, error: 'Doğrulama kodu üretilemedi.' };
  const payload = {
    Keys: ['MebAnahtar', 'benihatirla', 'User_Name', 'verification'],
    Degerler: [oneTimeCode, '0', String(userName || '').trim(), verification],
  };
  const res = await uzaHtmlSessionFetch('https://e-okul.meb.gov.tr/logineOkul.aspx/MebAnahtar', {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
    refUrl: String(refUrl || profile?.ogr02019 || 'https://e-okul.meb.gov.tr').trim(),
  });
  if (!res.ok) return { ok: false, needMebAjanda: true, error: String(res.status) };
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const root = uzaJsonRolesRoot(json || {});
  if (root?.success !== false && !root?.error) return { ok: true };
  return {
    ok: false,
    needMebAjanda: true,
    error: String(root?.message || 'MEB Ajanda kodu doğrulanamadı.'),
  };
}

function uzaLooksLikeMebAjandaMessage(text) {
  const s = String(text || '').toLocaleLowerCase('tr-TR');
  return s.includes('meb anahtar') || s.includes('meb ajanda') || s.includes('doğrulanamadı');
}
