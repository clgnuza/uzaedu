async function uzaWaitTabLoad(tabId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    if (tab.status === 'complete') return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function uzaUploadXlsxToEokulTab(tabId, base64, filename) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (b64, name) => {
      const input =
        document.querySelector('input[type="file"]') ||
        document.querySelector('input[type="FILE"]');
      if (!input) return { ok: false, error: 'file_input' };
      try {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], name, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const submit =
          document.querySelector('input[type="submit"][value*="Yükle"]') ||
          document.querySelector('input[type="submit"][value*="Kaydet"]') ||
          document.querySelector('button[type="submit"]');
        if (submit) submit.click();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    },
    args: [base64, filename || 'ders_programi.xlsx'],
  });
  return result || { ok: false, error: 'script' };
}

async function uzaRunDersProgramEokulUpload(opts) {
  const profile = uzaActiveProfile();
  const page = String(profile?.oklProgramImport || '').trim();
  if (!page) return { ok: false, error: 'Bu kurum için program yükleme sayfası tanımlı değil.' };
  if (!opts.fileBase64) return { ok: false, error: 'Dosya yok.' };
  const eokul = await uzaEokulTabReady();
  if (!eokul.ok || !eokul.tabs?.[0]?.id) return { ok: false, error: 'e-Okul sekmesi gerekli.' };
  const tabId = eokul.tabs[0].id;
  await chrome.tabs.update(tabId, { url: page, active: true });
  if (!(await uzaWaitTabLoad(tabId))) return { ok: false, error: 'Sayfa yüklenmedi.' };
  await new Promise((r) => setTimeout(r, 800));
  const up = await uzaUploadXlsxToEokulTab(tabId, opts.fileBase64, opts.filename || 'ders_programi.xlsx');
  if (!up.ok) {
    return {
      ok: false,
      error:
        up.error === 'file_input'
          ? 'e-Okul program sayfasında dosya alanı bulunamadı. Sayfayı elle açıp deneyin.'
          : up.error || 'Yükleme başarısız.',
    };
  }
  return { ok: true, experimental: true };
}
