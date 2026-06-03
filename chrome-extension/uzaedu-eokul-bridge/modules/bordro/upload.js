const UZA_BORDRO_TYPES = {
  mebbis_puantaj: {
    label: 'PersonelNet Puantaj',
    panelPath: '/mesaj-merkezi/mebbis-puantaj',
    privacy: 'Puantaj mesajları öğretmenlere ayrı gönderilir.',
  },
  ek_ders_bordro: {
    label: 'MaliNet Ek Ders Bordro',
    panelPath: '/mesaj-merkezi/kbs-ek-ders',
    privacy: 'Ek ders bordro mesajları öğretmenlere ayrı gönderilir.',
  },
  maas_bordro: {
    label: 'MaliNet Maaş Bordro',
    panelPath: '/mesaj-merkezi/kbs-maas',
    privacy: 'Maaş bordroları gizlidir; her öğretmene kişisel mesaj gider.',
  },
};

function uzaBordroMeta(type) {
  return UZA_BORDRO_TYPES[type] || UZA_BORDRO_TYPES.mebbis_puantaj;
}

function uzaBordroSchoolQ(schoolId) {
  return schoolId ? `&school_id=${encodeURIComponent(schoolId)}` : '';
}

async function uzaParseBordroExcel(opts) {
  const type = String(opts.type || 'mebbis_puantaj');
  const donem = String(opts.donem || '').trim();
  if (!donem) return { ok: false, error: 'Dönem girin.' };
  if (!opts.fileBuffer) return { ok: false, error: 'Dosya yok.' };
  const blob = new Blob([opts.fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fd = new FormData();
  fd.append('file', blob, opts.filename || 'bordro.xlsx');
  const path = `/messaging/bordro/parse?type=${encodeURIComponent(type)}&donem=${encodeURIComponent(donem)}${uzaBordroSchoolQ(opts.schoolId)}`;
  try {
    const data = await uzaFetchFormData(path, { token: opts.token, formData: fd });
    return {
      ok: true,
      matched: Array.isArray(data?.matched) ? data.matched : [],
      unmatched: Array.isArray(data?.unmatched) ? data.unmatched : [],
      excelFormat: data?.excelFormat,
      excelFormatLabel: data?.excelFormatLabel,
      rowCount: data?.rowCount,
    };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function uzaParseBordroFromStoredExcel(opts) {
  const entry = await uzaGetLastBordroExcel();
  if (!entry?.fileBase64) {
    return { ok: false, error: 'Son Excel yok. PersonelNet/MaliNet’te «Excele Aktar» kullanın veya dosya seçin.' };
  }
  const buf = Uint8Array.from(atob(entry.fileBase64), (c) => c.charCodeAt(0));
  return uzaParseBordroExcel({
    type: opts.bordroType || opts.type,
    donem: opts.donem,
    token: opts.token,
    schoolId: opts.schoolId,
    fileBuffer: buf.buffer,
    filename: entry.filename || 'bordro.xlsx',
    schoolName: opts.schoolName,
    footerNote: opts.footerNote,
  }).then((data) => {
    if (!data.ok) return data;
    return { ...data, fromStoredExcel: true, storedSource: entry.source };
  });
}

async function uzaCreateBordroCampaignJson(opts) {
  const type = String(opts.type || 'mebbis_puantaj');
  const donem = String(opts.donem || '').trim();
  const path = `/messaging/bordro/campaign-json${uzaBordroSchoolQ(opts.schoolId)}`;
  try {
    const campaign = await uzaFetchJson(path, {
      method: 'POST',
      token: opts.token,
      body: {
        type,
        title: String(opts.title || `${donem} — ${type}`).trim(),
        donem,
        headers: opts.headers || [],
        rows: opts.rows || [],
        schoolName: opts.schoolName,
        footerNote: opts.footerNote,
        manualPhones: opts.manualPhones || {},
        scrapeUrl: opts.scrapeUrl,
        pageTitle: opts.pageTitle,
      },
    });
    return { ok: true, campaign };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function uzaCreateBordroCampaign(opts) {
  const type = String(opts.type || 'mebbis_puantaj');
  const donem = String(opts.donem || '').trim();
  if (!opts.fileBuffer) return { ok: false, error: 'Dosya yok.' };
  const blob = new Blob([opts.fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fd = new FormData();
  fd.append('file', blob, opts.filename || 'bordro.xlsx');
  fd.append('title', String(opts.title || `${donem} — ${type}`).trim());
  fd.append('donem', donem);
  if (opts.schoolName) fd.append('schoolName', opts.schoolName);
  if (opts.footerNote) fd.append('footerNote', opts.footerNote);
  if (opts.manualPhones && Object.keys(opts.manualPhones).length) {
    fd.append('manualPhones', JSON.stringify(opts.manualPhones));
  }
  const path = `/messaging/bordro/campaign?type=${encodeURIComponent(type)}${uzaBordroSchoolQ(opts.schoolId)}`;
  try {
    const campaign = await uzaFetchFormData(path, { token: opts.token, formData: fd });
    return { ok: true, campaign };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
