function uzaOkl08001UsesJsonApi(kurumKey) {
  return String(kurumKey || '').trim() === 'ilkOgretim';
}

function uzaOkl08001JsonEndpoint(profile, suffix) {
  const page = String(profile?.okl08001 || '').replace(/\?.*$/, '');
  if (!page) return '';
  return `${page}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

async function uzaOkl08001JsonPost(profile, pathSuffix, bodyObj) {
  const url = uzaOkl08001JsonEndpoint(profile, pathSuffix);
  if (!url) return { ok: false, res: null, error: 'okl08001' };
  const res = await uzaHtmlSessionFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json, */*',
    },
    body: JSON.stringify(bodyObj && typeof bodyObj === 'object' ? bodyObj : {}),
    refUrl: profile.okl08001,
  });
  return { ok: res.ok, res, error: res.ok ? '' : String(res.status) };
}

function uzaOkl08001ParseJsonText(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

function uzaOkl08001UnwrapD(json) {
  if (!json || typeof json !== 'object') return null;
  const d = json.d != null ? json.d : json.D;
  return d && typeof d === 'object' ? d : null;
}

async function uzaOkl08001FetchInitialDataJson(profile) {
  const { ok, res, error } = await uzaOkl08001JsonPost(profile, '/GetInitialData', {});
  if (!ok || !res) return { ok: false, error: error || 'http' };
  const rawText = await res.text();
  if (uzaLooksLikeLoginPage(rawText)) return { ok: false, error: 'login' };
  const json = uzaOkl08001ParseJsonText(rawText);
  const d = uzaOkl08001UnwrapD(json);
  if (!d) return { ok: false, error: 'parse' };
  const hm = d.HataMesaji != null ? d.HataMesaji : d.hataMesaji;
  if (hm) return { ok: false, error: String(hm) };
  const raw = Array.isArray(d.Subeler) ? d.Subeler : Array.isArray(d.subeler) ? d.subeler : [];
  const options = raw
    .map((x) => ({
      value: String((x && (x.Value != null ? x.Value : x.value)) || '').trim(),
      text: String((x && (x.Text != null ? x.Text : x.text)) || '')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter((o) => o.value && o.text);
  const donemKodu = d.DonemKodu != null ? String(d.DonemKodu) : d.donemKodu != null ? String(d.donemKodu) : '';
  const gununTarihi = d.GununTarihi != null ? String(d.GununTarihi) : d.gununTarihi != null ? String(d.gununTarihi) : '';
  const kurumKodu = d.KurumKodu != null ? String(d.KurumKodu) : d.kurumKodu != null ? String(d.kurumKodu) : '';
  if (!options.length) return { ok: false, error: 'sube' };
  return { ok: true, options, donemKodu, gununTarihi, kurumKodu };
}

async function uzaOkl08001PostListeleJson(profile, payload) {
  const body = {
    donemKodu: String(payload.donemKodu || ''),
    subeKodu: String(payload.subeKodu || ''),
    tarih: String(payload.tarih || ''),
    kurumKoduFrontend: String(payload.kurumKoduFrontend || ''),
  };
  const { ok, res, error } = await uzaOkl08001JsonPost(profile, '/Listele', body);
  if (!ok || !res) return { ok: false, error: error || 'http' };
  const rawText = await res.text();
  if (uzaLooksLikeLoginPage(rawText)) return { ok: false, error: 'login' };
  const json = uzaOkl08001ParseJsonText(rawText);
  const d = uzaOkl08001UnwrapD(json);
  if (!d) return { ok: false, error: 'parse' };
  const basarili = d.Basarili !== false && d.basarili !== false;
  const mesaj = d.Mesaj != null ? String(d.Mesaj) : d.mesaj != null ? String(d.mesaj) : '';
  const liste = Array.isArray(d.Liste) ? d.Liste : Array.isArray(d.liste) ? d.liste : [];
  if (!basarili && !liste.length) return { ok: false, error: mesaj || 'listele', mesaj };
  return { ok: true, liste, mesaj };
}

function uzaOkl08001ListeleJsonToDevamsizlikRows(liste, scrapeMode) {
  const mode = String(scrapeMode || 'gunluk').trim() || 'gunluk';
  const rows = [];
  for (const r of liste || []) {
    const locked = !!(r.IsLocked != null ? r.IsLocked : r.isLocked);
    if (locked) continue;

    const enTam = !!(r.ChkTamGunEnabled != null ? r.ChkTamGunEnabled : r.chkTamGunEnabled);
    const enYar = !!(r.ChkYarimGunEnabled != null ? r.ChkYarimGunEnabled : r.chkYarimGunEnabled);
    const enGec = !!(r.ChkGecEnabled != null ? r.ChkGecEnabled : r.chkGecEnabled);
    if (!enTam && !enYar && !enGec) continue;

    const tamGun = !!(r.ChkTamGun != null ? r.ChkTamGun : r.chkTamGun);
    const yarimGun = !!(r.ChkYarimGun != null ? r.ChkYarimGun : r.chkYarimGun);
    const yarimSabah = yarimGun;
    const yarimOglen = false;
    const nobet = false;
    const gec = !!(r.ChkGec != null ? r.ChkGec : r.chkGec);
    const ogrt = r.OgrtDevam != null ? r.OgrtDevam : r.ogrtDevam;
    const dersYoklama = String(ogrt != null ? ogrt : '')
      .replace(/\s+/g, ' ')
      .trim();

    if (mode === 'ders_yoklama') {
      if (!tamGun && !yarimSabah && !yarimOglen && !nobet && !gec && !dersYoklama) continue;
    } else if (!tamGun && !yarimSabah && !yarimOglen && !nobet && !gec) {
      continue;
    }

    const sinifSube = String(r.Sube != null ? r.Sube : r.sube || '')
      .replace(/\s+/g, ' ')
      .trim();
    const tcKimlik = String(r.TcNo != null ? r.TcNo : r.tcNo || '')
      .replace(/\s+/g, ' ')
      .trim();
    const ogrenciNo = String(r.OgrNo != null ? r.OgrNo : r.ogrNo || '')
      .replace(/\s+/g, ' ')
      .trim();
    const adSoyad = String(r.AdSoyad != null ? r.AdSoyad : r.adSoyad || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!ogrenciNo && !adSoyad) continue;

    rows.push({
      sinifSube,
      tcKimlik,
      ogrenciNo,
      adSoyad,
      tamGun,
      yarimSabah,
      yarimOglen,
      nobet,
      gec,
      dersYoklama: mode === 'ders_yoklama' ? dersYoklama : '',
    });
  }
  return rows;
}

async function uzaOkl08001KaydetJson(profile, payload) {
  const body = {
    kayitlar: Array.isArray(payload.kayitlar) ? payload.kayitlar : [],
    donemKodu: String(payload.donemKodu || ''),
    tarih: String(payload.tarih || ''),
    kurumKoduFrontend: String(payload.kurumKoduFrontend || ''),
  };
  const { ok, res, error } = await uzaOkl08001JsonPost(profile, '/Kaydet', body);
  if (!ok || !res) return { ok: false, error: error || 'http' };
  const rawText = await res.text();
  if (uzaLooksLikeLoginPage(rawText)) return { ok: false, error: 'login' };
  const json = uzaOkl08001ParseJsonText(rawText);
  const d = uzaOkl08001UnwrapD(json);
  if (!d) return { ok: false, error: 'parse' };
  const basarili = d.Basarili !== false && d.basarili !== false;
  const mesaj = d.Mesaj != null ? String(d.Mesaj) : d.mesaj != null ? String(d.mesaj) : '';
  if (!basarili) return { ok: false, error: mesaj || 'kaydet' };
  return { ok: true, mesaj };
}

function uzaBuildOgrenciWriteMap(siniflar) {
  const map = new Map();
  for (const s of siniflar || []) {
    for (const o of s.ogrenciler || []) {
      const no = String(o.ogrenci_no || '').replace(/\D/g, '');
      if (no) map.set(no, o);
    }
  }
  return map;
}

function uzaApplyTopluTypesToJsonRows(kayitlar, pendingByType, activeTypes) {
  let changed = false;
  let matched = 0;
  const blockedNumbers = [];
  const order = ['t', 'y', 'g'];
  for (const r of kayitlar || []) {
    const no = String(r.OgrNo != null ? r.OgrNo : r.ogrNo || '').replace(/\D/g, '');
    if (!no) continue;
    if (r.IsLocked === true || r.isLocked === true) {
      for (const type of order) {
        if (!activeTypes.has(type)) continue;
        if (pendingByType[type]?.has(no)) {
          pendingByType[type].delete(no);
          blockedNumbers.push(no);
        }
      }
      continue;
    }
    for (const type of order) {
      if (!activeTypes.has(type)) continue;
      const set = pendingByType[type];
      if (!set?.has(no)) continue;
      let rowChanged = false;
      if (type === 't') {
        if (r.ChkTamGunEnabled === false || r.chkTamGunEnabled === false) continue;
        const prevY = !!(r.ChkYarimGun || r.chkYarimGun);
        const prevG = !!(r.ChkGec || r.chkGec);
        const checked = !!(r.ChkTamGun || r.chkTamGun);
        r.ChkTamGun = true;
        r.chkTamGun = true;
        r.ChkYarimGun = false;
        r.chkYarimGun = false;
        r.ChkGec = false;
        r.chkGec = false;
        if (!checked || prevY || prevG) rowChanged = true;
      } else if (type === 'y') {
        if (r.ChkYarimGunEnabled === false || r.chkYarimGunEnabled === false) continue;
        const prevT = !!(r.ChkTamGun || r.chkTamGun);
        const prevG = !!(r.ChkGec || r.chkGec);
        const checked = !!(r.ChkYarimGun || r.chkYarimGun);
        r.ChkYarimGun = true;
        r.chkYarimGun = true;
        r.ChkTamGun = false;
        r.chkTamGun = false;
        r.ChkGec = false;
        r.chkGec = false;
        if (!checked || prevT || prevG) rowChanged = true;
      } else if (type === 'g') {
        if (r.ChkGecEnabled === false || r.chkGecEnabled === false) continue;
        const prevT = !!(r.ChkTamGun || r.chkTamGun);
        const prevY = !!(r.ChkYarimGun || r.chkYarimGun);
        const checked = !!(r.ChkGec || r.chkGec);
        r.ChkGec = true;
        r.chkGec = true;
        r.ChkTamGun = false;
        r.chkTamGun = false;
        r.ChkYarimGun = false;
        r.chkYarimGun = false;
        if (!checked || prevT || prevY) rowChanged = true;
      }
      if (rowChanged) {
        r.Degisti = true;
        r.degisti = true;
        changed = true;
      }
      set.delete(no);
      matched += 1;
      break;
    }
  }
  return { changed, matched, kayitlar, blockedNumbers };
}

function uzaPendingTotal(pendingByType) {
  let n = 0;
  for (const k of ['t', 'y', 's', 'o', 'n', 'g']) n += pendingByType[k]?.size || 0;
  return n;
}

function uzaApplyGunlukWriteToJsonRows(kayitlar, byNo) {
  let changed = false;
  let matched = 0;
  let blocked = 0;
  for (const r of kayitlar || []) {
    const no = String(r.OgrNo != null ? r.OgrNo : r.ogrNo || '').replace(/\D/g, '');
    const want = byNo.get(no);
    if (!want) continue;
    if (r.IsLocked === true || r.isLocked === true) {
      blocked += 1;
      byNo.delete(no);
      continue;
    }
    const tam = !!want.tam_gun;
    const yarim = !!(want.yarim_sabah || want.yarim_oglen);
    const gec = !!want.gec;
    if (!tam && !yarim && !gec) {
      byNo.delete(no);
      continue;
    }
    matched += 1;
    let rowChanged = false;
    if (tam) {
      if (r.ChkTamGunEnabled !== false && r.chkTamGunEnabled !== false) {
        if (!r.ChkTamGun && !r.chkTamGun) rowChanged = true;
        r.ChkTamGun = true;
        r.chkTamGun = true;
        r.ChkYarimGun = false;
        r.chkYarimGun = false;
        r.ChkGec = false;
        r.chkGec = false;
      }
    } else if (yarim) {
      if (r.ChkYarimGunEnabled !== false && r.chkYarimGunEnabled !== false) {
        if (!r.ChkYarimGun && !r.chkYarimGun) rowChanged = true;
        r.ChkYarimGun = true;
        r.chkYarimGun = true;
        r.ChkTamGun = false;
        r.chkTamGun = false;
        r.ChkGec = false;
        r.chkGec = false;
      }
    } else if (gec) {
      if (r.ChkGecEnabled !== false && r.chkGecEnabled !== false) {
        if (!r.ChkGec && !r.chkGec) rowChanged = true;
        r.ChkGec = true;
        r.chkGec = true;
        r.ChkTamGun = false;
        r.chkTamGun = false;
        r.ChkYarimGun = false;
        r.chkYarimGun = false;
      }
    }
    if (rowChanged) {
      r.Degisti = true;
      r.degisti = true;
      changed = true;
    }
    byNo.delete(no);
  }
  return { changed, kayitlar, matched, blocked, remaining: byNo.size };
}

function uzaApplyDersYoklamaWriteToJsonRows(kayitlar, byNo) {
  let changed = false;
  let matched = 0;
  let blocked = 0;
  for (const r of kayitlar || []) {
    const no = String(r.OgrNo != null ? r.OgrNo : r.ogrNo || '').replace(/\D/g, '');
    const want = byNo.get(no);
    if (!want) continue;
    if (r.IsLocked === true || r.isLocked === true) {
      blocked += 1;
      byNo.delete(no);
      continue;
    }
    const code = String(want.ders_yoklama || '').trim();
    if (!code) {
      byNo.delete(no);
      continue;
    }
    matched += 1;
    const prev = String(r.OgrtDevam != null ? r.OgrtDevam : r.ogrtDevam || '').trim();
    if (prev !== code) {
      r.OgrtDevam = code;
      r.ogrtDevam = code;
      r.Degisti = true;
      r.degisti = true;
      changed = true;
    }
    byNo.delete(no);
  }
  return { changed, kayitlar, matched, blocked };
}

function uzaOkl08001ListeleJsonToStudentRows(liste) {
  const rows = [];
  for (const r of liste || []) {
    const sube = String(r.Sube != null ? r.Sube : r.sube || '')
      .replace(/\s+/g, ' ')
      .trim();
    const ogrNo = String(r.OgrNo != null ? r.OgrNo : r.ogrNo || '')
      .replace(/\s+/g, ' ')
      .trim();
    const ad = String(r.AdSoyad != null ? r.AdSoyad : r.adSoyad || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!ogrNo && !ad) continue;
    rows.push([sube, ogrNo, ad]);
  }
  return rows;
}
