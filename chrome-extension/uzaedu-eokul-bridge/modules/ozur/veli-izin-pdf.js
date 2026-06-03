function uzaNedeniIsIzinli(nedeni) {
  const meta = globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.ozursuzdenOzurluye;
  const ui = globalThis.UZA_BOOTSTRAP_CACHE?.extensionUi?.ozurClient;
  const vals = meta?.izinliNedeniValues || ui?.izinliNedeniValues || ['İ', 'I', '1'];
  const v = String(nedeni || '').trim();
  return vals.some((x) => String(x).trim() === v);
}

async function uzaDownloadVeliIzinPdf(opts) {
  const path =
    globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.ozursuzdenOzurluye?.veliIzinPdfPath ||
    globalThis.UZA_BOOTSTRAP_CACHE?.extensionUi?.ozurClient?.veliIzinPdfPath ||
    '/eokul-bridge/v1/ozur/veli-izin-pdf';
  const student = opts.student || {};
  const satirlar = Array.isArray(opts.satirlar) ? opts.satirlar : [];
  const body = {
    ogrenci: {
      ad_soyad: [student.ad, student.soyad].filter(Boolean).join(' ').trim() || String(student.ad_soyad || ''),
      ogrenci_no: String(student.okulNo || opts.ogrNo || '').trim(),
      sinif: String(student.sinif || '').trim(),
    },
    satirlar: satirlar.map((r) => ({ tarih: String(r.tarih || '').trim(), tur: String(r.tur || '').trim() })),
  };
  if (opts.schoolId) body.school_id = opts.schoolId;
  const blob = await uzaFetchBlob(path, {
    method: 'POST',
    token: opts.token,
    body,
    accept: 'application/pdf',
  });
  const ad = body.ogrenci.ad_soyad
    .replace(/[^\w\u00C0-\u024F\s-]+/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `${ad || 'ogrenci'}_-_Veli_Izin_Dilekcesi.pdf`,
      saveAs: true,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
  return { ok: true };
}
