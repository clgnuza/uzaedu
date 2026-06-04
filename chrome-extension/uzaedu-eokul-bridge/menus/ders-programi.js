function uzaArrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const status = document.getElementById('status');
const ddStudio = document.getElementById('ddStudio');
const ddProgram = document.getElementById('ddProgram');
const btnDdExport = document.getElementById('btnDdExport');
const btnDdUploadMeb = document.getElementById('btnDdUploadMeb');
const ddFormat = document.getElementById('ddFormat');
const ddFile = document.getElementById('ddFile');
const ddReplace = document.getElementById('ddReplace');
const ddElective = document.getElementById('ddElective');
const btnDdImport = document.getElementById('btnDdImport');
const previewList = document.getElementById('previewList');

let fileB64 = null;
let gatePayload = null;
let authToken = null;

ddFile?.addEventListener('change', () => void onFileSelected());

btnDdImport?.addEventListener('click', () => void runImport());
btnDdExport?.addEventListener('click', () => void runExport());
btnDdUploadMeb?.addEventListener('click', () => void runUploadMeb());
ddStudio?.addEventListener('change', () => void loadPrograms());

async function loadPrograms() {
  btnDdExport.disabled = true;
  ddProgram.innerHTML = '';
  if (!ddStudio?.value) return;
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DD_LIST_PROGRAMS,
      studioId: ddStudio.value,
    });
    if (!res?.ok) return;
    const programs = res.programs || [];
    for (const p of programs) {
      const opt = document.createElement('option');
      opt.value = p.id;
      const label = p.name || p.label || `Program ${p.id.slice(0, 8)}`;
      opt.textContent = `${label} (${p.status || '?'})`;
      ddProgram.appendChild(opt);
    }
    btnDdExport.disabled = !programs.length;
  } catch {
    /* ignore */
  }
}

async function runUploadMeb() {
  if (!fileB64) {
    status.textContent = 'Önce panelden veya dosyadan XLSX seçin.';
    return;
  }
  btnDdUploadMeb.disabled = true;
  status.textContent = 'e-Okul sayfasına yükleniyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DD_EOKUL_UPLOAD_TO_MEB,
      fileBase64: fileB64,
      filename: ddFile?.files?.[0]?.name || 'ders_programi.xlsx',
    });
    status.textContent = res?.ok
      ? 'Dosya e-Okul sayfasına verildi (kaydı kontrol edin).'
      : res?.error || 'Yükleme başarısız.';
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnDdUploadMeb.disabled = false;
  }
}

async function runExport() {
  if (!ddStudio?.value || !ddProgram?.value) return;
  btnDdExport.disabled = true;
  status.textContent = 'İndiriliyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DD_EOKUL_EXPORT,
      studioId: ddStudio.value,
      programId: ddProgram.value,
    });
    status.textContent = res?.ok ? 'Dosya indirildi.' : res?.error || 'İndirme başarısız.';
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnDdExport.disabled = !programs.length;
    if (btnDdUploadMeb) btnDdUploadMeb.disabled = !programs.length;
  }
}

async function onFileSelected() {
  const f = ddFile?.files?.[0];
  fileB64 = null;
  btnDdImport.disabled = true;
  previewList.hidden = true;
  previewList.innerHTML = '';
  if (!f) return;
  if (!authToken || !ddStudio?.value) {
    status.textContent = 'Stüdyo yüklenemedi.';
    return;
  }
  status.textContent = 'Önizleme…';
  try {
    const buf = await f.arrayBuffer();
    fileB64 = uzaArrayBufferToBase64(buf);
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DD_EOKUL_PREVIEW,
      studioId: ddStudio.value,
      fileBase64: fileB64,
      format: ddFormat?.value || 'auto',
      schoolId: gatePayload?.schoolId || null,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Önizleme başarısız.';
      return;
    }
    const p = res.preview || {};
    const rows = p.rows || [];
    status.textContent = `${rows.length} atama · format: ${p.format || '?'}`;
    if (p.warnings?.length) {
      status.textContent += ` · ${p.warnings.length} uyarı`;
    }
    previewList.hidden = false;
    previewList.innerHTML = '';
    for (const r of rows.slice(0, 15)) {
      const li = document.createElement('li');
      const sec = (r.class_sections || []).join(', ');
      li.textContent = `${sec} — ${r.subject_name} (${r.weekly_hours} saat)`;
      previewList.appendChild(li);
    }
    btnDdImport.disabled = !rows.length;
    if (btnDdUploadMeb) btnDdUploadMeb.disabled = !fileB64;
  } catch (e) {
    status.textContent = e?.message || String(e);
  }
}

async function runImport() {
  if (!fileB64 || !ddStudio?.value) return;
  btnDdImport.disabled = true;
  status.textContent = 'Aktarılıyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DD_EOKUL_IMPORT,
      studioId: ddStudio.value,
      fileBase64: fileB64,
      format: ddFormat?.value || 'auto',
      replace: !!ddReplace?.checked,
      autoElectiveGroups: !!ddElective?.checked,
      schoolId: gatePayload?.schoolId || null,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    const d = res.data || {};
    status.textContent = `${d.imported ?? 0} atama içe aktarıldı.`;
    const ui = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI });
    const origin = ui?.extensionUi?.portalApi?.portalSiteOrigin;
    if (origin) {
      chrome.tabs.create({ url: `${origin.replace(/\/+$/, '')}/ders-dagit/studyo/atamalar` });
    }
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnDdImport.disabled = false;
  }
}

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  gatePayload = data[UZA_SESSION_GATE_KEY];
  status.textContent = 'Stüdyolar yükleniyor…';
  try {
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_DD_LIST_STUDIOS });
    if (!res?.ok) {
      status.textContent = res?.error || 'Stüdyo listesi alınamadı (okul yöneticisi gerekir).';
      return;
    }
    authToken = res.token;
    const studios = res.studios || [];
    ddStudio.innerHTML = '';
    for (const s of studios) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.academic_year || s.id.slice(0, 8);
      ddStudio.appendChild(opt);
    }
    status.textContent = studios.length ? 'Program seçin veya dosya yükleyin.' : 'Ders dağıtım stüdyosu yok.';
    if (studios.length) await loadPrograms();
  } catch (e) {
    status.textContent = e?.message || String(e);
  }
})();
