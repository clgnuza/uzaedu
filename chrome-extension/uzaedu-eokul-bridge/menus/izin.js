const status = document.getElementById('status');
const btnIzin = document.getElementById('btnIzin');
const izinTarih = document.getElementById('izinTarih');

izinTarih.value = new Date().toISOString().slice(0, 10);

btnIzin?.addEventListener('click', async () => {
  btnIzin.disabled = true;
  status.textContent = 'Okunuyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_IZIN_EXPORT,
      tarihIso: izinTarih.value,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    const d = res.data || {};
    status.textContent = `${d.recipientCount ?? 0} alıcı, ${d.skippedNoPhone ?? 0} telefonsuz atlandı.`;
    if (d.campaignId) {
      const origin = (await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI }))?.extensionUi
        ?.portalApi?.portalSiteOrigin;
      if (origin) {
        chrome.tabs.create({ url: `${origin.replace(/\/+$/, '')}/mesaj-merkezi/izin` });
      }
    }
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnIzin.disabled = false;
  }
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
  }
})();
