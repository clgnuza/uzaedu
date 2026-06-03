const kbStatus = document.getElementById('kbStatus');
const kbClassList = document.getElementById('kbClassList');
const btnKbAll = document.getElementById('btnKbAll');

function setStatus(text) {
  if (kbStatus) kbStatus.textContent = text || '';
}

async function ensureGate() {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
    return false;
  }
  return true;
}

async function runExport(sinifValues) {
  btnKbAll.disabled = true;
  setStatus('OkulNet’ten okunuyor…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_KELEBEK_EXPORT,
      kurumKey: await uzaMenuKurumKey(),
      sinifValues,
      siraTipi: 'ikili',
      grupSayisi: 3,
    });
    if (!res?.ok) {
      setStatus(res?.error || 'Aktarım başarısız.');
      return;
    }
    const d = res.data || {};
    setStatus(
      `Tamam: ${d.created ?? 0} yeni, ${d.updated ?? 0} güncellendi, ${d.skipped ?? 0} atlandı.`,
    );
  } catch (e) {
    setStatus(e?.message || String(e));
  } finally {
    btnKbAll.disabled = false;
  }
}

btnKbAll?.addEventListener('click', () => void runExport(null));

(async () => {
  if (!(await ensureGate())) return;
  setStatus('Sınıflar yükleniyor…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_KELEBEK_LIST,
      kurumKey: await uzaMenuKurumKey(),
    });
    if (!res?.ok || !res.options?.length) {
      setStatus(res?.error || 'Sınıf listesi alınamadı. OkulNet oturumunu kontrol edin.');
      return;
    }
    kbClassList.hidden = false;
    kbClassList.innerHTML = '';
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
      kbClassList.appendChild(li);
    }
    setStatus(`${res.options.length} sınıf hazır.`);
  } catch (e) {
    setStatus(e?.message || String(e));
  }
})();
