const params = new URLSearchParams(location.search);
const KIND = params.get('kind') === 'ders' ? 'ders' : 'gunluk';

const gdTitle = document.getElementById('gdTitle');
const gdLead = document.getElementById('gdLead');
const gdTarih = document.getElementById('gdTarih');
const gdStatus = document.getElementById('gdStatus');
const gdClassList = document.getElementById('gdClassList');
const btnGdAll = document.getElementById('btnGdAll');

if (KIND === 'ders') {
  if (gdTitle) gdTitle.textContent = 'E-yoklama (ders)';
  if (gdLead) gdLead.textContent = 'Ders yoklamasını mesaj merkezine aktarır.';
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

if (gdTarih) gdTarih.value = todayIso();

function setStatus(text) {
  if (gdStatus) gdStatus.textContent = text || '';
}

async function ensureGate() {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
    return false;
  }
  return true;
}

async function runExport(sinifValues) {
  const tarihIso = gdTarih?.value || todayIso();
  btnGdAll.disabled = true;
  setStatus('e-Okul’ten okunuyor…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DEVAMSIZLIK_EXPORT,
      kind: KIND,
      tarihIso,
      sinifValues,
    });
    if (!res?.ok) {
      setStatus(res?.error || 'Aktarım başarısız.');
      return;
    }
    const d = res.data || {};
    const panel = d.campaignId
      ? ` Kampanya: ${d.recipientCount ?? 0} alıcı (önizleme).`
      : '';
    const skip =
      d.skippedNoPhone != null ? ` ${d.skippedNoPhone} öğrencide veli telefonu yok.` : '';
    setStatus(`Tamam.${panel}${skip}`);
  } catch (e) {
    setStatus(e?.message || String(e));
  } finally {
    btnGdAll.disabled = false;
  }
}

btnGdAll?.addEventListener('click', () => void runExport(null));

(async () => {
  if (!(await ensureGate())) return;
  setStatus('Sınıflar yükleniyor…');
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_KELEBEK_LIST,
      kurumKey: await uzaMenuKurumKey(),
    });
    if (!res?.ok || !res.options?.length) {
      setStatus(res?.error || 'Sınıf listesi alınamadı.');
      return;
    }
    gdClassList.hidden = false;
    gdClassList.innerHTML = '';
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
      gdClassList.appendChild(li);
    }
    setStatus(`${res.options.length} sınıf hazır.`);
  } catch (e) {
    setStatus(e?.message || String(e));
  }
})();
