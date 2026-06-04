const status = document.getElementById('status');
const btnList = document.getElementById('btnList');
const btnVeliPdf = document.getElementById('btnVeliPdf');
const btnAktar = document.getElementById('btnAktar');
const nedeniInput = document.getElementById('nedeni');
const rowBox = document.getElementById('rowBox');
const rowList = document.getElementById('rowList');
const studentInfo = document.getElementById('studentInfo');
let lastRows = [];
let lastOgrNo = '';
let lastStudent = null;

function syncVeliPdfBtn() {
  if (!btnVeliPdf || !nedeniInput) return;
  const v = String(nedeniInput.value || '').trim();
  const show = v === 'İ' || v === 'I' || v === '1' || /izin/i.test(v);
  btnVeliPdf.hidden = !show;
}

nedeniInput?.addEventListener('input', syncVeliPdfBtn);

btnVeliPdf?.addEventListener('click', async () => {
  const rows = selectedRows();
  if (!rows.length) {
    status.textContent = 'PDF için gün seçin.';
    return;
  }
  btnVeliPdf.disabled = true;
  status.textContent = 'PDF hazırlanıyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_VELI_IZIN_PDF,
      ogrNo: lastOgrNo,
      student: lastStudent,
      satirlar: rows,
    });
    status.textContent = res?.ok ? 'PDF indirildi.' : res?.error || 'PDF başarısız.';
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnVeliPdf.disabled = false;
  }
});

function selectedRows() {
  const out = [];
  rowList.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
    const i = Number(cb.dataset.idx);
    if (lastRows[i]) out.push(lastRows[i]);
  });
  return out;
}

btnList?.addEventListener('click', async () => {
  const ogrNo = document.getElementById('ogrNo')?.value?.trim();
  if (!ogrNo) {
    status.textContent = 'Numara girin.';
    return;
  }
  btnList.disabled = true;
  btnAktar.disabled = true;
  status.textContent = 'Liste okunuyor…';
  try {
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_OZURSUZ_LISTE, ogrNo });
    if (!res?.ok) {
      status.textContent = res?.error || 'Liste alınamadı.';
      return;
    }
    lastOgrNo = ogrNo;
    lastRows = res.rows || [];
    const s = res.student || {};
    lastStudent = s;
    studentInfo.hidden = false;
    studentInfo.textContent = `${s.sinif || ''} ${s.ad || ''} ${s.soyad || ''} — özürsüz: ${res.ozursuzToplamGun ?? '?'} gün, özürlü: ${res.ozurluToplamGun ?? '?'} gün`;
    rowList.innerHTML = '';
    if (!lastRows.length) {
      rowBox.hidden = true;
      status.textContent = 'Özürsüz kayıt yok.';
      return;
    }
    rowBox.hidden = false;
    lastRows.forEach((r, idx) => {
      const li = document.createElement('li');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.idx = String(idx);
      const label = document.createElement('span');
      label.textContent = `${r.tarih} — ${r.tur || ''}`;
      li.append(cb, label);
      rowList.appendChild(li);
    });
    btnAktar.disabled = false;
    syncVeliPdfBtn();
    status.textContent = `${lastRows.length} özürsüz satır.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnList.disabled = false;
  }
});

btnAktar?.addEventListener('click', async () => {
  const rows = selectedRows();
  const nedeni = document.getElementById('nedeni')?.value?.trim();
  const aciklama = document.getElementById('aciklama')?.value?.trim();
  if (!rows.length) {
    status.textContent = 'En az bir gün seçin.';
    return;
  }
  btnAktar.disabled = true;
  status.textContent = 'Aktarılıyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_OZURSUZ_AKTAR,
      ogrNo: lastOgrNo,
      nedeni,
      aciklama,
      rows,
    });
    if (!res?.ok) {
      status.textContent = res?.error || 'Aktarım başarısız.';
      return;
    }
    status.textContent = `Kayıt: ${res.saved ?? 0}/${res.total ?? 0}, hata: ${(res.failed || []).length}.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnAktar.disabled = false;
  }
});

syncVeliPdfBtn();

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
  }
})();
