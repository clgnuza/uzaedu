function uzaPhotoPageUrl(profile, kurumKey) {
  const k = String(kurumKey || '').trim();
  if (k === 'ilkOgretim') return 'https://e-okul.meb.gov.tr/IlkOgretim/OKL/IOK05002.aspx';
  if (k === 'okulOncesi') return 'https://e-okul.meb.gov.tr/OkulOncesi/OKL/AOK05002.aspx';
  if (k === 'ortaOgretim') return 'https://e-okul.meb.gov.tr/OrtaOgretim/OKL/OOK05002.aspx';
  const from = String(profile?.okl08001 || '').trim();
  return from ? from.replace(/([A-Z]{3})08001\.aspx/i, '$105002.aspx') : '';
}

async function uzaFetchPhotoClassList(profile, kurumKey, pageUrl) {
  const warm = await uzaHtmlSessionFetch(pageUrl, {
    method: 'GET',
    refUrl: String(profile?.ogr01001 || pageUrl).trim() || pageUrl,
  });
  if (!warm.ok) return { ok: false, error: String(warm.status) };
  const warmHtml = await warm.text();
  if (uzaLooksLikeLoginPage(warmHtml)) return { ok: false, error: 'login' };

  const isOrta = kurumKey === 'ortaOgretim';
  const endpoint = isOrta
    ? 'https://e-okul.meb.gov.tr/Common/eOkulService.asmx/GetSinifSubeListesi'
    : 'https://e-okul.meb.gov.tr/Common/eOkulService.asmx/GetSinifSubeListesiAcikKapaliCombo';
  const body = isOrta
    ? JSON.stringify({ Keys: ['kademe', 'strSinifKodlari', 'strSubeKodlari'], Degerler: ['2', '-1', '-1'] })
    : '';
  const res = await uzaHtmlSessionFetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    refUrl: pageUrl,
  });
  if (!res.ok) return { ok: false, error: String(res.status) };
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  const classes = (Array.isArray(json?.d) ? json.d : [])
    .map((x) => ({
      eIndex: String(x?.eIndex || '').trim(),
      eAdi: String(x?.eAdi || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((x) => x.eIndex && x.eAdi);
  if (!classes.length) return { ok: false, error: 'Sınıf yok' };
  return { ok: true, classes };
}

async function uzaFetchStudentPhotosForClass(profile, kurumKey, sinifValue, sinifLabel) {
  const pageUrl = uzaPhotoPageUrl(profile, kurumKey);
  if (!pageUrl) return { ok: false, error: 'sayfa' };
  const classRes = await uzaFetchPhotoClassList(profile, kurumKey, pageUrl);
  if (!classRes.ok) return classRes;
  const target = String(sinifLabel || '').trim().toLocaleLowerCase('tr-TR');
  const picked =
    classRes.classes.find((x) => String(x.eIndex) === String(sinifValue)) ||
    classRes.classes.find((x) => x.eAdi.toLocaleLowerCase('tr-TR') === target);
  if (!picked) return { ok: false, error: 'Sınıf bulunamadı' };

  const payload =
    kurumKey === 'ortaOgretim'
      ? { Keys: ['subekodu', 'donemkodu'], Degerler: [picked.eIndex, '59'] }
      : { Keys: ['subekodu'], Degerler: [picked.eIndex] };
  const photoEndpoint = `${pageUrl.replace(/\?.*$/, '')}/GetFotograflar`;
  const photoRes = await uzaHtmlSessionFetch(photoEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
    refUrl: pageUrl,
  });
  if (!photoRes.ok) return { ok: false, error: String(photoRes.status) };
  let json = null;
  try {
    json = JSON.parse(await photoRes.text());
  } catch {
    json = null;
  }
  const students = (Array.isArray(json?.d) ? json.d : [])
    .map((x) => {
      const adi = String(x?.Adi || '').trim();
      const soyadi = String(x?.Soyadi || '').trim();
      return {
        ogrenciNo: String(x?.OgrNo || '').trim(),
        adSoyad: `${adi} ${soyadi}`.replace(/\s+/g, ' ').trim(),
        photoDataUrl: String(x?.OgrenciFoto || '').trim(),
      };
    })
    .filter((x) => x.ogrenciNo || x.adSoyad);
  if (!students.length) return { ok: false, error: 'Resim yok' };
  return { ok: true, classLabel: picked.eAdi, students };
}

async function uzaRunOgrenciResmiExport(opts) {
  const profile = uzaActiveProfile();
  const kurumKey = uzaGetKurumKey();
  const pageUrl = uzaPhotoPageUrl(profile, kurumKey);
  if (!pageUrl) return { ok: false, error: 'Profil yok.' };

  let sinifValue = null;
  let sinifLabel = '';
  if (opts.sinifValues?.length === 1) {
    sinifValue = opts.sinifValues[0];
  } else if (!opts.sinifValues) {
    await uzaWarmOkl08001(profile);
    const jd = await uzaOkl08001FetchInitialDataJson(profile);
    if (!jd.ok || !jd.options?.length) return { ok: false, error: 'Sınıf yok.' };
    sinifValue = jd.options[0].value;
    sinifLabel = jd.options[0].text;
  } else {
    return { ok: false, error: 'Resim için tek sınıf seçin.' };
  }

  const photos = await uzaFetchStudentPhotosForClass(profile, kurumKey, sinifValue, sinifLabel);
  if (!photos.ok) return photos;

  const zipFiles = [];
  for (const st of photos.students) {
    const bytes = uzaDataUrlToBytes(st.photoDataUrl);
    if (!bytes.length) continue;
    const safe = `${st.ogrenciNo || 'ogr'}_${(st.adSoyad || 'foto').replace(/[^\w\u00C0-\u024F-]+/gu, '_')}`.slice(
      0,
      80,
    );
    zipFiles.push({ name: `${safe}.jpg`, bytes });
  }
  if (!zipFiles.length) return { ok: false, error: 'JPEG verisi yok.' };

  const zipBytes = uzaBuildStoredZip(zipFiles);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const label = (photos.classLabel || 'sinif').replace(/[^\w\u00C0-\u024F-]+/gu, '_');
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `Ogrenci_Resimleri_${label}.zip`,
      saveAs: true,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
  return { ok: true, rowCount: zipFiles.length, classLabel: photos.classLabel };
}
