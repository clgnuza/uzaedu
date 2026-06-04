const status = document.getElementById('status');
const btnRun = document.getElementById('btnRun');
const mebAjandaCode = document.getElementById('mebAjandaCode');

btnRun?.addEventListener('click', async () => {
  btnRun.disabled = true;
  status.textContent = 'Yazılıyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_VELI_PUSH,
      mebAjandaCode: mebAjandaCode?.value?.trim() || null,
    });
    if (res?.needMebAjanda) {
      status.textContent = res?.error || 'MEB Ajanda kodu gerekli.';
      return;
    }
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    status.textContent = `Güncellenen: ${res.updated ?? 0}, aynı: ${res.unchanged ?? 0}, hata: ${res.failed ?? 0}.`;
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
