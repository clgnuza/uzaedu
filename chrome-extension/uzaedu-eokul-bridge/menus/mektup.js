const status = document.getElementById('status');
const btnRun = document.getElementById('btnRun');

btnRun?.addEventListener('click', async () => {
  btnRun.disabled = true;
  status.textContent = 'e-Okul okunuyor…';
  try {
    const uyari = document.getElementById('uyari')?.value || '1';
    const includeSent = !!document.getElementById('includeSent')?.checked;
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_MEKTUP_EXPORT,
      uyariDilimi: uyari,
      uyariDilimiLabel: document.getElementById('uyari')?.selectedOptions?.[0]?.text || '',
      includeSent,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    status.textContent = `${res.data?.recipients?.length ?? res.rowCount ?? 0} alıcı — panel sekmesi açıldı.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnRun.disabled = false;
  }
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
  }
})();
