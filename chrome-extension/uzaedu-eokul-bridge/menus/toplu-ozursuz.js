const status = document.getElementById('status');
const tozTarih = document.getElementById('tozTarih');
const tozIlk = document.getElementById('tozIlk');
const tozOrta = document.getElementById('tozOrta');
const tozTam = document.getElementById('tozTam');
const tozYarim = document.getElementById('tozYarim');
const tozGec = document.getElementById('tozGec');
const tozSabah = document.getElementById('tozSabah');
const tozOglen = document.getElementById('tozOglen');
const tozNobet = document.getElementById('tozNobet');
const btnToz = document.getElementById('btnToz');

tozTarih.value = new Date().toISOString().slice(0, 10);

function uzaTozApplyKurumUi(kurumKey) {
  const orta = kurumKey === 'ortaOgretim';
  if (tozIlk) tozIlk.hidden = orta;
  if (tozOrta) tozOrta.hidden = !orta;
}

btnToz?.addEventListener('click', async () => {
  btnToz.disabled = true;
  status.textContent = 'Yazılıyor…';
  try {
    const kur = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_KURUM });
    const orta = kur?.kurumKey === 'ortaOgretim';
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_TOPLU_OZURSUZ_WRITE,
      tarihIso: tozTarih.value,
      typeMap: orta
        ? { t: tozTam.value, s: tozSabah?.value, o: tozOglen?.value, n: tozNobet?.value, g: tozGec.value }
        : { t: tozTam.value, y: tozYarim.value, g: tozGec.value },
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    status.textContent = `${res.savedClasses ?? 0} sınıf · ${res.matchedTotal ?? 0} eşleşme · ${res.remaining ?? 0} kalan numara.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnToz.disabled = false;
  }
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
  }
  try {
    const kur = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_KURUM });
    uzaTozApplyKurumUi(kur?.kurumKey);
  } catch {
    /* ignore */
  }
})();
