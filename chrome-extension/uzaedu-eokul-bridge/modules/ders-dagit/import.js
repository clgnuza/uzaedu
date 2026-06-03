var uzaDdEokulLock = false;

function uzaArrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function uzaFetchStudios(token) {
  return uzaFetchJson('/ders-dagit/studios', { token });
}

async function uzaFetchPrograms(token, studioId) {
  return uzaFetchJson(`/ders-dagit/studios/${studioId}/programs`, { token });
}

async function uzaDownloadProgramEokulXlsx(opts) {
  const path = `/ders-dagit/studios/${opts.studioId}/programs/${opts.programId}/export/eokul.xlsx`;
  const blob = await uzaFetchBlob(path, { token: opts.token });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename: `eokul-ders-dagit-${String(opts.programId).slice(0, 8)}.xlsx`,
      saveAs: true,
    });
    return { ok: true };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}

async function uzaPreviewDersDagitEokul(opts) {
  const path =
    globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.dersProgramiEokul?.previewPath ||
    '/eokul-bridge/v1/import/ders-dagit-eokul/preview';
  const body = {
    studio_id: opts.studioId,
    file_base64: opts.fileBase64,
    format: opts.format || 'auto',
  };
  if (opts.schoolId) body.school_id = opts.schoolId;
  return uzaFetchJson(path, { method: 'POST', token: opts.token, body });
}

async function uzaImportDersDagitEokul(opts) {
  if (uzaDdEokulLock) return { ok: false, error: 'İşlem sürüyor.' };
  uzaDdEokulLock = true;
  try {
    const path =
      globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.dersProgramiEokul?.importPath ||
      '/eokul-bridge/v1/import/ders-dagit-eokul';
    const body = {
      studio_id: opts.studioId,
      file_base64: opts.fileBase64,
      format: opts.format || 'auto',
      replace: !!opts.replace,
      auto_elective_groups: opts.autoElectiveGroups !== false,
    };
    if (opts.schoolId) body.school_id = opts.schoolId;
    const data = await uzaFetchJson(path, { method: 'POST', token: opts.token, body });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaDdEokulLock = false;
  }
}
