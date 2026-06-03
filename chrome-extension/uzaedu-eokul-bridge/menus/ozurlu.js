const status = document.getElementById('status');
const btnOz = document.getElementById('btnOz');

btnOz?.addEventListener('click', async () => {
  btnOz.disabled = true;
  status.textContent = 'Yazılıyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_TOPLU_OZURLU_WRITE,
      nedeni: document.getElementById('ozNedeni')?.value,
      aciklama: document.getElementById('ozAciklama')?.value,
      rowsText: document.getElementById('ozRows')?.value,
      ogrNosText: document.getElementById('ozNos')?.value,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    const inv = (res.invalid || []).length;
    status.textContent = `${res.saved ?? 0}/${res.total ?? 0} öğrenci kaydedildi${inv ? ` · ${inv} atlandı` : ''}.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnOz.disabled = false;
  }
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
  }
})();
