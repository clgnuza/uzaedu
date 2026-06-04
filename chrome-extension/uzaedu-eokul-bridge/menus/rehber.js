const status = document.getElementById('status');
const classList = document.getElementById('classList');
const btnAll = document.getElementById('btnAll');

async function runExport(sinifValues) {
  btnAll.disabled = true;
  status.textContent = 'Okunuyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_REHBER_EXPORT,
      sinifValues,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    const d = res.data || {};
    status.textContent = `+${d.inserted ?? 0} yeni, ${d.updated ?? 0} güncellendi, ${d.skipped ?? 0} atlandı.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnAll.disabled = false;
  }
}

btnAll?.addEventListener('click', () => void runExport(null));

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  status.textContent = 'Sınıflar yükleniyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_KELEBEK_LIST,
      kurumKey: await uzaMenuKurumKey(),
    });
    if (!res?.ok || !res.options?.length) {
      status.textContent = res?.error || 'Sınıf listesi alınamadı.';
      return;
    }
    classList.hidden = false;
    classList.innerHTML = '';
    for (const opt of res.options) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = opt.text;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-primary';
      btn.textContent = 'Aktar';
      btn.addEventListener('click', () => void runExport([opt.value]));
      li.append(label, btn);
      classList.appendChild(li);
    }
    status.textContent = `${res.options.length} sınıf hazır.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  }
})();
