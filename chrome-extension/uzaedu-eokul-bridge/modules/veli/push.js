var uzaVeliPushLock = false;

function uzaCepForEokulForm(norm90) {
  const d = String(norm90 || '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) return `0${d.slice(2)}`;
  if (d.length === 10 && d.startsWith('5')) return `0${d}`;
  return d;
}

function uzaPickVeliTarget(contactName, anneTel, babaTel, panelPhone) {
  const p = uzaNormalizeTrPhone(panelPhone);
  if (!p) return null;
  if (anneTel === p) return null;
  if (babaTel === p) return null;
  const n = String(contactName || '').toLocaleLowerCase('tr-TR');
  if (n.includes('baba')) return { yakinlik: '1', field: 'baba' };
  if (n.includes('anne')) return { yakinlik: '2', field: 'anne' };
  if (!anneTel && babaTel) return { yakinlik: '2', field: 'anne' };
  if (anneTel && !babaTel) return { yakinlik: '1', field: 'baba' };
  return { yakinlik: '2', field: 'anne' };
}

async function uzaTrySetVeliCepTel(profile, refUrl, yakinId, cepDisplay) {
  const page = String(profile?.ogr02019 || '').replace(/\?.*$/, '');
  const tries = [
    'SetVeliDetayBilgileri',
    'KaydetVeliDetayBilgileri',
    'SaveVeliDetayBilgileri',
    'UpdateVeliDetayBilgileri',
  ];
  for (const ep of tries) {
    const endpoint = `${page}/${ep}`;
    const res = await uzaHtmlSessionFetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ Keys: ['yakinId', 'CEP_TEL'], Degerler: [Number(yakinId), cepDisplay] }),
      refUrl,
    });
    if (!res.ok) continue;
    let json = null;
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
    const root = uzaJsonRolesRoot(json || {});
    if (!root?.error && root?.success !== false) return { ok: true };
  }
  const det = await uzaFetchVeliDetay(profile, refUrl, yakinId);
  if (!det.ok || !det.detay) return { ok: false, error: 'kaydet' };
  const d = { ...det.detay, CEP_TEL: cepDisplay };
  const keys = Object.keys(d).filter((k) => d[k] != null && String(d[k]).trim() !== '');
  const vals = keys.map((k) => d[k]);
  for (const ep of ['KaydetVeliDetayBilgileri', 'SetVeliDetayBilgileri']) {
    const endpoint = `${page}/${ep}`;
    const res = await uzaHtmlSessionFetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ Keys: keys, Degerler: vals }),
      refUrl,
    });
    if (!res.ok) continue;
    let json = null;
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
    const root = uzaJsonRolesRoot(json || {});
    if (!root?.error && root?.success !== false) return { ok: true };
  }
  return { ok: false, error: 'kaydet' };
}

async function uzaPushVeliPhoneForStudent(profile, queueRow, state, opts) {
  const ogrNo = String(queueRow.student_number || '').trim();
  const panelPhone = uzaNormalizeTrPhone(queueRow.phone);
  if (!ogrNo || panelPhone.length < 10) return { ok: false, skip: true };

  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return { ok: false, error: 'detay' };
  const page = String(profile.ogr02019 || '').trim();
  const warm = await uzaHtmlSessionFetch(page, { method: 'GET', refUrl: nav.detailUrl });
  if (uzaLooksLikeLoginPage(await warm.text())) return { ok: false, error: 'login' };

  const yk = await uzaFetchVeliYakinlar(profile, page);
  if (!yk.ok) return { ok: false, error: yk.error || 'veli' };
  const veli = await uzaFetchVeliContactsForStudent(profile, ogrNo, state);
  if (!veli.ok) return { ok: false, error: 'telefon' };

  const target = uzaPickVeliTarget(queueRow.contact_name, veli.anneTel, veli.babaTel, panelPhone);
  if (!target) return { ok: true, unchanged: true };

  const yakin = yk.yakinlar.find((x) => String(x?.YAKINLIK || '') === target.yakinlik);
  if (!yakin?.YAKIN_ID) return { ok: false, error: 'yakin' };

  const cepDisplay = uzaCepForEokulForm(panelPhone);
  let upd = await uzaTrySetVeliCepTel(profile, page, yakin.YAKIN_ID, cepDisplay);
  if (!upd.ok && opts.eokulTabId) {
    upd = await uzaTrySetVeliCepTelDom(opts.eokulTabId, profile, ogrNo, state, target, cepDisplay);
  }
  if (!upd.ok) return { ok: false, error: upd.error };
  return { ok: true, updated: true, via: upd.via || 'api' };
}

async function uzaRunVeliPush(opts) {
  if (uzaVeliPushLock) return { ok: false, error: 'İşlem sürüyor.' };
  const profile = uzaActiveProfile();
  if (!profile?.ogr02019) return { ok: false, error: 'Profil yok.' };
  const eokulTabId = opts.eokulTabId || null;
  const path =
    globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.veliBilgiGuncelle?.pushQueuePath ||
    '/eokul-bridge/v1/veli-push-queue';
  uzaVeliPushLock = true;
  const state = { ogr01001Html: null, lastDetailUrl: null };
  try {
    const kurum = uzaGetKurumKey();
    if (opts.mebAjandaCode && kurum !== 'ortaOgretim') {
      const aj = await uzaVerifyMebAjandaCode(
        profile,
        opts.mebAjandaCode,
        profile.ogr02019,
        opts.userName || '',
      );
      if (!aj.ok) return aj;
    }
    const q = opts.schoolId ? `?school_id=${encodeURIComponent(opts.schoolId)}` : '';
    const queue = await uzaFetchJson(`${path}${q}`, { token: opts.token });
    const rows = Array.isArray(queue?.rows) ? queue.rows : [];
    if (!rows.length) return { ok: false, error: 'Veli rehberi boş. Önce rehber aktarın.' };
    const kurumKey = uzaGetKurumKey();
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    for (const row of rows) {
      const r = await uzaPushVeliPhoneForStudent(profile, row, state, {
        eokulTabId: opts.eokulTabId,
      });
      if (r.ok) {
        if (r.updated) updated += 1;
        else unchanged += 1;
      } else if (!r.skip) failed += 1;
      await new Promise((res) => setTimeout(res, 500));
    }
    return { ok: true, updated, unchanged, failed, total: rows.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaVeliPushLock = false;
  }
}
