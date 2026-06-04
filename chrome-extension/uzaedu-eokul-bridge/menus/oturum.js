const oturumList = document.getElementById('oturumList');
const oturumStatus = document.getElementById('oturumStatus');
const oturumInterval = document.getElementById('oturumInterval');

let sitesMap = {};

function setStatus(msg, tone) {
  if (typeof UZA_NOTIFY !== 'undefined' && oturumStatus?.uzaNotify) {
    oturumStatus.uzaNotify(msg, tone);
  } else if (oturumStatus) {
    oturumStatus.textContent = msg || '';
  }
}

async function ensureGate() {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(
      typeof uzaExtUrl === 'function'
        ? uzaExtUrl('gate/gate.html')
        : chrome.runtime.getURL('gate/gate.html'),
    );
    return false;
  }
  return true;
}

async function loadIntervalLabel() {
  try {
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI });
    const mins = Number(res?.extensionUi?.menusMeta?.oturumAcik?.pingIntervalMinutes) || 10;
    if (oturumInterval) {
      oturumInterval.textContent = `Yenileme aralığı: yaklaşık ${mins} dakika`;
    }
  } catch {
    /* varsayılan */
  }
}

function renderSites() {
  if (!oturumList || !UZA_OTURUM_SITE_DEFS) return;
  const iconFn = typeof UZA_ICON !== 'undefined' ? UZA_ICON.svg : () => '';
  oturumList.innerHTML = '';

  for (const site of UZA_OTURUM_SITE_DEFS) {
    const on = uzaOturumSiteEnabled(sitesMap, site.id);
    const li = document.createElement('li');
    li.className = `oturum-item platform-${site.platform}`;
    li.innerHTML = `
      <span class="oturum-item__icon" aria-hidden="true">${iconFn(site.icon, 20)}</span>
      <div class="oturum-item__body">
        <strong>${site.label}</strong>
        <span>${site.hint}</span>
      </div>
      <label class="uza-toggle">
        <input type="checkbox" data-site="${site.id}" ${on ? 'checked' : ''} />
        <span class="uza-toggle__track" aria-hidden="true"></span>
      </label>
    `;
    li.querySelector('input').addEventListener('change', (ev) => void onToggle(site, ev.target));
    oturumList.appendChild(li);
  }
}

async function persistSites() {
  await chrome.runtime.sendMessage({ type: UZA_MSG_OTURUM_SITES_SET, sites: sitesMap });
  await chrome.storage.local.set({ [UZA_OTURUM_SITES_KEY]: sitesMap });
}

async function onToggle(site, input) {
  const enabled = !!input.checked;
  sitesMap[site.id] = enabled;
  input.disabled = true;
  setStatus('Kaydediliyor…', 'loading');
  try {
    await persistSites();
    setStatus(enabled ? `${site.label} oturum koruması açık.` : 'Kapatıldı.', 'success');
  } catch (e) {
    sitesMap[site.id] = !enabled;
    input.checked = !enabled;
    setStatus(e?.message || 'Kaydedilemedi.', 'error');
  } finally {
    input.disabled = false;
  }
}

(async function oturumEntry() {
  if (!(await ensureGate())) return;
  await loadIntervalLabel();

  const stored = await chrome.storage.local.get([
    UZA_OTURUM_SITES_KEY,
    UZA_OTURUM_ENABLED_KEY,
    UZA_MEBBIS_OTURUM_ENABLED_KEY,
  ]);
  if (stored[UZA_OTURUM_SITES_KEY] && typeof stored[UZA_OTURUM_SITES_KEY] === 'object') {
    sitesMap = Object.assign(uzaOturumDefaultSitesMap(), stored[UZA_OTURUM_SITES_KEY]);
  } else {
    sitesMap = uzaOturumSitesFromLegacy(stored);
    await persistSites();
  }

  renderSites();
  setStatus('Açık sekmelere sayfa yenilemeden hafif sinyal gönderilir.', 'info');
})();
