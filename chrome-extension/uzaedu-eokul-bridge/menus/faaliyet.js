const status = document.getElementById('status');
const btnRun = document.getElementById('btnRun');

btnRun?.addEventListener('click', async () => {
  const tarihIso = document.getElementById('tarih')?.value;
  const sure = document.getElementById('sure')?.value;
  const aciklama = document.getElementById('aciklama')?.value;
  const ogrNosText = document.getElementById('ogrNos')?.value;
  btnRun.disabled = true;
  status.textContent = 'İşleniyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_FAALIYET_WRITE,
      tarihIso,
      sure,
      aciklama,
      ogrNosText,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    status.textContent = `Kayıt: ${res.saved ?? 0}/${res.total ?? 0}, hata: ${(res.invalid || []).length}.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnRun.disabled = false;
  }
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  const t = document.getElementById('tarih');
  if (t && !t.value) t.value = new Date().toISOString().slice(0, 10);
})();
