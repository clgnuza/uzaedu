const status = document.getElementById('status');
const campSelect = document.getElementById('campSelect');
const btnWrite = document.getElementById('btnWrite');

btnWrite?.addEventListener('click', () => void runWrite());

async function runWrite() {
  const id = campSelect?.value;
  if (!id) return;
  btnWrite.disabled = true;
  status.textContent = 'Yükleniyor…';
  try {
    const payloadRes = await chrome.runtime.sendMessage({
      type: UZA_MSG_DEVAMSIZLIK_WRITE_PAYLOAD,
      campaignId: id,
    });
    if (!payloadRes?.ok) {
      status.textContent = payloadRes?.error || 'Kampanya yüklenemedi.';
      return;
    }
    const p = payloadRes.payload;
    status.textContent = 'OkulNet\'a yazılıyor…';
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_DEVAMSIZLIK_WRITE,
      siniflar: p.siniflar,
      tarihIso: p.tarih_iso,
      kind: p.kind,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Yazma başarısız.';
      return;
    }
    status.textContent = `${res.savedClasses ?? 0} sınıf kaydedildi · ${res.matchedTotal ?? 0} öğrenci · ${res.blockedTotal ?? 0} kilitli.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnWrite.disabled = false;
  }
}

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  status.textContent = 'Kampanyalar…';
  try {
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_DEVAMSIZLIK_CAMPAIGNS });
    if (!res?.ok) {
      status.textContent = res?.error || 'Liste alınamadı.';
      return;
    }
    const list = res.campaigns || [];
    campSelect.innerHTML = '';
    for (const c of list) {
      const opt = document.createElement('option');
      opt.value = c.id;
      const tag = c.type === 'ders_devamsizlik' ? 'Sınıf Yoklama' : 'günlük';
      opt.textContent = `${c.title} [${tag}] (${c.tarih_iso || '?'})`;
      campSelect.appendChild(opt);
    }
    btnWrite.disabled = !list.length;
    status.textContent = list.length ? 'Kampanya seçip yazın.' : 'Önce köprü ile devamsızlık aktarın.';
  } catch (e) {
    status.textContent = e?.message || String(e);
  }
})();
