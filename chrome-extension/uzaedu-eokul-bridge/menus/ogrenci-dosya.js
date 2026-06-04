const status = document.getElementById('status');
const classList = document.getElementById('classList');
const btnAll = document.getElementById('btnAll');
const groupSelect = document.getElementById('groupId');
const fieldBox = document.getElementById('fieldBox');
const fieldList = document.getElementById('fieldList');
const mebAjandaBox = document.getElementById('mebAjandaBox');
const mebAjandaCode = document.getElementById('mebAjandaCode');
const chkPortalImport = document.getElementById('chkPortalImport');
const btnFieldsAll = document.getElementById('btnFieldsAll');
const btnFieldsNone = document.getElementById('btnFieldsNone');
const btnAllIcon = document.getElementById('btnAllIcon');

let bootstrapGroups = [];
let kurumKey = 'ilkOgretim';

function setStatus(msg, tone) {
  if (typeof UZA_NOTIFY !== 'undefined' && status) UZA_NOTIFY.show(status, msg, tone);
  else if (status) status.textContent = msg || '';
}

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
    label.className = 'uza-chip-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = f.id;
    cb.checked = true;
    const box = document.createElement('span');
    box.className = 'uza-chip-check__box';
    box.setAttribute('aria-hidden', 'true');
    const span = document.createElement('span');
    span.className = 'uza-chip-check__text';
    span.textContent = f.label || f.id;
    label.append(cb, box, span);
    if (cb.checked) label.classList.add('is-checked');
    fieldList.appendChild(label);
  }
}

function setAllFields(checked) {
  fieldList.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = checked;
    cb.closest('.uza-chip-check')?.classList.toggle('is-checked', checked);
  });
}

btnFieldsAll?.addEventListener('click', () => setAllFields(true));
btnFieldsNone?.addEventListener('click', () => setAllFields(false));
fieldList?.addEventListener('change', (ev) => {
  const cb = ev.target;
  if (cb?.type !== 'checkbox') return;
  cb.closest('.uza-chip-check')?.classList.toggle('is-checked', cb.checked);
});

async function runExport(sinifValues) {
  const fieldIds = selectedFieldIds();
  if (!fieldIds.length) {
    setStatus('En az bir alan seçin.', 'error');
    return;
  }
  btnAll.disabled = true;
  setStatus('Okunuyor…', 'loading');
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
      setStatus(res?.error || 'MEB Ajanda kodu girin.', 'error');
      return;
    }
    if (!res?.ok) {
      setStatus(res?.error || 'Başarısız.', 'error');
      return;
    }
    let msg = `${res.rowCount ?? 0} satır indirildi.`;
    if (res.importResult?.created != null) {
      msg += ` Panel: +${res.importResult.created} / ~${res.importResult.updated ?? 0}.`;
    } else if (res.importResult?.stored) {
      msg += ` Panel: ${res.importResult.stored} kayıt alındı.`;
    }
    setStatus(msg, 'success');
  } catch (e) {
    setStatus(e?.message || String(e), 'error');
  } finally {
    btnAll.disabled = false;
  }
}

btnAll?.addEventListener('click', () => void runExport(null));
groupSelect?.addEventListener('change', renderFields);

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  setStatus('Yapılandırma yükleniyor…', 'loading');
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
    if (btnAllIcon && typeof UZA_ICON !== 'undefined') {
      btnAllIcon.innerHTML = UZA_ICON.svg('download', 18);
    }

    const res = await chrome.runtime.sendMessage({
      type: UZA_MSG_KELEBEK_LIST,
      kurumKey: await uzaMenuKurumKey(),
    });
    if (!res?.ok || !res.options?.length) {
      setStatus(res?.error || 'Sınıf listesi alınamadı.', 'error');
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
    setStatus(`${res.options.length} sınıf hazır.`, 'success');
  } catch (e) {
    setStatus(e?.message || String(e), 'error');
  }
})();
