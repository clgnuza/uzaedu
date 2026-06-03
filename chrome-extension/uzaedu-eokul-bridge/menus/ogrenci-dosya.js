const status = document.getElementById('status');
const classList = document.getElementById('classList');
const btnAll = document.getElementById('btnAll');
const groupSelect = document.getElementById('groupId');
const fieldBox = document.getElementById('fieldBox');
const fieldList = document.getElementById('fieldList');
const mebAjandaBox = document.getElementById('mebAjandaBox');
const mebAjandaCode = document.getElementById('mebAjandaCode');
const chkPortalImport = document.getElementById('chkPortalImport');

let bootstrapGroups = [];
let kurumKey = 'ilkOgretim';

function selectedFieldIds() {
  return [...fieldList.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value);
}

function syncMebAjandaUi() {
  const gid = groupSelect?.value || '';
  const show = gid === 'veliBilgileri';
  if (mebAjandaBox) mebAjandaBox.hidden = !show;
}

function renderFields() {
  const gid = groupSelect?.value || '';
  syncMebAjandaUi();
  const group = bootstrapGroups.find((g) => g.id === gid);
  const fields = group?.fieldsByKurum?.[kurumKey] || group?.fieldsByKurum?.ilkOgretim || [];
  fieldList.innerHTML = '';
  if (!fields.length) {
    fieldBox.hidden = true;
    return;
  }
  fieldBox.hidden = false;
  for (const f of fields) {
    const label = document.createElement('label');
    label.className = 'sinif-sube-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = f.id;
    cb.checked = true;
    const span = document.createElement('span');
    span.className = 'sinif-sube-row-text';
    span.textContent = f.label || f.id;
    label.append(cb, span);
    fieldList.appendChild(label);
  }
}

async function runExport(sinifValues) {
  const fieldIds = selectedFieldIds();
  if (!fieldIds.length) {
    status.textContent = 'En az bir alan seçin.';
    return;
  }
  btnAll.disabled = true;
  status.textContent = 'Okunuyor…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_OGRENCI_DOSYA_EXPORT,
      sinifValues,
      groupId: groupSelect?.value,
      fieldIds,
      importToPanel: !!chkPortalImport?.checked,
      mebAjandaCode: mebAjandaCode?.value?.trim() || null,
    });
    if (res?.needMebAjanda) {
      status.textContent = res?.error || 'MEB Ajanda kodu girin.';
      return;
    }
    if (!res?.ok) {
      status.textContent = res?.error || 'Başarısız.';
      return;
    }
    let msg = `${res.rowCount ?? 0} satır indirildi.`;
    if (res.importResult?.created != null) {
      msg += ` Panel: +${res.importResult.created} / ~${res.importResult.updated ?? 0}.`;
    } else if (res.importResult?.stored) {
      msg += ` Panel: ${res.importResult.stored} kayıt alındı.`;
    }
    status.textContent = msg;
  } catch (e) {
    status.textContent = e?.message || String(e);
  } finally {
    btnAll.disabled = false;
  }
}

btnAll?.addEventListener('click', () => void runExport(null));
groupSelect?.addEventListener('change', renderFields);

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  status.textContent = 'Yapılandırma yükleniyor…';
  try {
    const bootRes = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_BOOTSTRAP });
    const boot = bootRes?.bootstrap || bootRes;
    bootstrapGroups = boot?.menusMeta?.ogrenciDosyaBilgileriAl?.groups || [];
    kurumKey = (await chrome.runtime.sendMessage({ type: UZA_MSG_GET_KURUM }))?.kurumKey || 'ilkOgretim';
    groupSelect.innerHTML = '';
    for (const g of bootstrapGroups) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.label || g.id;
      groupSelect.appendChild(opt);
    }
    if (!bootstrapGroups.length) {
      const opt = document.createElement('option');
      opt.value = 'veliBilgileri';
      opt.textContent = 'Veli bilgileri';
      groupSelect.appendChild(opt);
    }
    renderFields();

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
      btn.textContent = 'İndir';
      btn.addEventListener('click', () => void runExport([opt.value]));
      li.append(label, btn);
      classList.appendChild(li);
    }
    status.textContent = `${res.options.length} sınıf hazır.`;
  } catch (e) {
    status.textContent = e?.message || String(e);
  }
})();
