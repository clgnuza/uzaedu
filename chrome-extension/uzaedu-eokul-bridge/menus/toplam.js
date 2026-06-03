const status = document.getElementById('status');

async function run(sinifValues) {
  const btn = document.getElementById('btnAll');
  btn.disabled = true;
  status.textContent = 'Okunuyor (bu işlem uzun sürebilir)…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_TOPLAM_EXPORT,
      sinifValues,
      useOzursuz: document.getElementById('useOzursuz')?.checked,
      useOzurlu: document.getElementById('useOzurlu')?.checked,
      ozursuzMin: Number(document.getElementById('ozMin')?.value || 1),
      ozursuzMax: 180,
      ozurluMin: 0,
      ozurluMax: 180,
      combineAnd: false,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    const d = res.data || {};
    status.textContent = `Kampanya: ${d.recipientCount ?? 0} alıcı (${d.skippedNoPhone ?? 0} telefonsuz atlandı).`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('btnAll')?.addEventListener('click', () => void run(null));

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) window.location.replace(chrome.runtime.getURL('gate/gate.html'));
})();
