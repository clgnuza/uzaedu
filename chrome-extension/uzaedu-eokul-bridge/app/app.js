const grid = document.getElementById('moduleGrid');
const gridEmpty = document.getElementById('gridEmpty');
const shellMeta = document.getElementById('shellMeta');
const shellTitle = document.getElementById('shellTitle');
const btnGateBack = document.getElementById('btnGateBack');

const DIR_LABEL = {
  pull: UZA_BRAND.dirPull,
  push: UZA_BRAND.dirPush,
  both: UZA_BRAND.dirBoth,
};

const MENU_PLATFORM = {
  mebbisPuantajBordro: 'mebbis',
  kbsEkDersBordro: 'kbs',
  kbsMaasBordro: 'kbs',
};

const PLATFORM_LABEL = UZA_BRAND.platformLabel;
const PLATFORM_ICON = UZA_BRAND.platformIcon;

let activeFilter = 'all';

function platformForMenu(id) {
  if (MENU_PLATFORM[id]) return MENU_PLATFORM[id];
  if (/mebbis/i.test(id)) return 'mebbis';
  if (/^kbs/i.test(id)) return 'kbs';
  return 'eokul';
}

function setSessionChip(el, ready) {
  if (!el) return;
  el.classList.remove('ok', 'wait');
  el.classList.add(ready ? 'ok' : 'wait');
}

async function refreshSessionStrip() {
  try {
    const st = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_STATUS });
    if (!st?.ok) return;
    setSessionChip(document.getElementById('chipPanel'), st.portalConnected);
    setSessionChip(document.getElementById('chipEokul'), st.eokulReady);
    setSessionChip(document.getElementById('chipMebbis'), st.mebbisReady);
    setSessionChip(document.getElementById('chipKbs'), st.kbsReady);
  } catch {
    /* sessiz */
  }
}

btnGateBack?.addEventListener('click', () => {
  window.location.href = chrome.runtime.getURL('gate/gate.html');
});

function badgeForMenu(m) {
  if (m.enabled) return { cls: 'live', text: 'Aktif' };
  return { cls: 'phase', text: `Faz ${m.phase}` };
}

function menuSupportsKurum(m, kurumKey) {
  const keys = m?.supportedKurumKeys;
  if (!Array.isArray(keys) || !keys.length) return kurumKey === 'ilkOgretim';
  return keys.includes(kurumKey);
}

function renderMenus(ui, kurumKey) {
  const menus = ui?.menus ?? {};
  const ids = ui?.menuIds ?? Object.keys(menus);
  grid.innerHTML = '';
  const filtersEl = document.getElementById('gridFilters');
  if (!ids.length) {
    gridEmpty.hidden = false;
    if (filtersEl) filtersEl.hidden = true;
    return;
  }
  gridEmpty.hidden = true;
  const soon = ui?.app?.shell?.phaseSoon ?? 'Yakında';
  let hasMebbis = false;
  let hasKbs = false;

  for (const id of ids) {
    if (id === 'oturumAcik') continue;
    const m = menus[id];
    if (!m) continue;
    if (!menuSupportsKurum(m, kurumKey)) continue;
    const platform = platformForMenu(id);
    if (platform === 'mebbis') hasMebbis = true;
    if (platform === 'kbs') hasKbs = true;
    if (activeFilter !== 'all' && platform !== activeFilter) continue;
    const b = badgeForMenu(m);
    const card = document.createElement('article');
    card.className = `module-card platform-${platform}${m.enabled ? ' enabled' : ''}`;
    card.dataset.platform = platform;
    card.innerHTML = `
      <div class="module-icon" aria-hidden="true">${PLATFORM_ICON[platform] || 'EO'}</div>
      <div class="module-head">
        <h3>${escapeHtml(m.label || id)}</h3>
        <span class="badge ${b.cls}">${escapeHtml(b.text)}</span>
      </div>
      <p>${escapeHtml(m.description || '')}</p>
      <p class="module-dir">${escapeHtml(DIR_LABEL[m.direction] || m.direction || '')}</p>
      <div class="module-foot">
        <span class="module-platform-tag">${escapeHtml(PLATFORM_LABEL[platform] || '')}</span>
        <span>${m.enabled ? 'Başlat →' : soon}</span>
      </div>
    `;
    if (m.enabled) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        if (id === 'kelebekSinavOgrenciAktar') {
          window.location.href = chrome.runtime.getURL('menus/kelebek.html');
        } else if (id === 'gunlukDevamsizlikAktar') {
          window.location.href = chrome.runtime.getURL('menus/gunluk.html');
        } else if (id === 'eyoklamaDersDevamsizlikAktar') {
          window.location.href = chrome.runtime.getURL('menus/gunluk.html?kind=ders');
        } else if (id === 'toplamDevamsizlikAktar') {
          window.location.href = chrome.runtime.getURL('menus/toplam.html');
        } else if (id === 'devamsizlikMektubuEokul') {
          window.location.href = chrome.runtime.getURL('menus/mektup.html');
        } else if (id === 'ogrenciRehberEokul') {
          window.location.href = chrome.runtime.getURL('menus/rehber.html');
        } else if (id === 'evciCarsiIzin') {
          window.location.href = chrome.runtime.getURL('menus/izin.html');
        } else if (id === 'dersProgramiEokul') {
          window.location.href = chrome.runtime.getURL('menus/ders-programi.html');
        } else if (id === 'gunlukDevamsizlikYaz') {
          window.location.href = chrome.runtime.getURL('menus/gunluk-yaz.html');
        } else if (id === 'topluOzursuzDevam') {
          window.location.href = chrome.runtime.getURL('menus/toplu-ozursuz.html');
        } else if (id === 'topluOzurluDevam') {
          window.location.href = chrome.runtime.getURL('menus/ozurlu.html');
        } else if (id === 'ozursuzdenOzurluye') {
          window.location.href = chrome.runtime.getURL('menus/ozursuz-ozurlu.html');
        } else if (id === 'ogrenciDosyaBilgileriAl') {
          window.location.href = chrome.runtime.getURL('menus/ogrenci-dosya.html');
        } else if (id === 'veliBilgiGuncelle') {
          window.location.href = chrome.runtime.getURL('menus/veli-guncelle.html');
        } else if (id === 'topluFaaliyet') {
          window.location.href = chrome.runtime.getURL('menus/faaliyet.html');
        } else if (id === 'mebbisPuantajBordro') {
          window.location.href = chrome.runtime.getURL('menus/bordro.html?type=mebbis_puantaj');
        } else if (id === 'kbsEkDersBordro') {
          window.location.href = chrome.runtime.getURL('menus/bordro.html?type=ek_ders_bordro');
        } else if (id === 'kbsMaasBordro') {
          window.location.href = chrome.runtime.getURL('menus/bordro.html?type=maas_bordro');
        }
      });
    }
    grid.appendChild(card);
  }

  if (filtersEl) {
    filtersEl.hidden = !(hasMebbis || hasKbs);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const selKurum = document.getElementById('selKurum');
const blockOkulTuru = document.getElementById('blockOkulTuru');
const selOkulTuru = document.getElementById('selOkulTuru');
let cachedUi = null;

async function uzaRefreshOkulTuruUi(kurumKey) {
  if (!blockOkulTuru || !selOkulTuru) return;
  const orta = kurumKey === 'ortaOgretim';
  blockOkulTuru.hidden = !orta;
  if (!orta) return;
  selOkulTuru.innerHTML = '<option value="">Yükleniyor…</option>';
  const pack = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_ORTA_OKUL_TUR });
  const opts = Array.isArray(pack?.options) ? pack.options : [];
  if (!opts.length) {
    const fetched = await chrome.runtime.sendMessage({ type: UZA_MSG_ORTA_OKUL_TUR_FETCH });
    if (fetched?.ok) {
      const again = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_ORTA_OKUL_TUR });
      uzaFillOkulTuruSelect(again?.options || [], again?.selected || '');
      return;
    }
    selOkulTuru.innerHTML = '<option value="">' + UZA_ERR.okulNetSessionRequired() + '</option>';
    return;
  }
  uzaFillOkulTuruSelect(opts, pack?.selected || '');
}

function uzaFillOkulTuruSelect(options, selected) {
  if (!selOkulTuru) return;
  selOkulTuru.replaceChildren();
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.text || o.value;
    selOkulTuru.appendChild(opt);
  }
  if (selected) selOkulTuru.value = selected;
}

selOkulTuru?.addEventListener('change', async () => {
  const v = selOkulTuru.value;
  if (!v) return;
  await chrome.runtime.sendMessage({ type: UZA_MSG_ORTA_OKUL_TUR_SET, value: v });
});

document.getElementById('gridFilters')?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-filter]');
  if (!btn) return;
  activeFilter = btn.dataset.filter || 'all';
  document.querySelectorAll('.filter-pill').forEach((p) => p.classList.toggle('active', p === btn));
  if (cachedUi) renderMenus(cachedUi, selKurum?.value || 'ilkOgretim');
});

selKurum?.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: UZA_MSG_SET_KURUM, kurumKey: selKurum.value });
  if (cachedUi) renderMenus(cachedUi, selKurum.value);
  await uzaRefreshOkulTuruUi(selKurum.value);
});

const chkOturumPing = document.getElementById('chkOturumPing');
chkOturumPing?.addEventListener('change', () => {
  void chrome.runtime.sendMessage({ type: UZA_MSG_OTURUM_SET, enabled: chkOturumPing.checked });
});
void chrome.storage.local.get([UZA_OTURUM_ENABLED_KEY]).then((st) => {
  if (chkOturumPing && st[UZA_OTURUM_ENABLED_KEY] != null) {
    chkOturumPing.checked = !!st[UZA_OTURUM_ENABLED_KEY];
  }
});

const chkMebbisPing = document.getElementById('chkMebbisPing');
chkMebbisPing?.addEventListener('change', () => {
  void chrome.runtime.sendMessage({ type: UZA_MSG_MEBBIS_OTURUM_SET, enabled: chkMebbisPing.checked });
});
void chrome.storage.local.get([UZA_MEBBIS_OTURUM_ENABLED_KEY]).then((st) => {
  if (chkMebbisPing && st[UZA_MEBBIS_OTURUM_ENABLED_KEY] != null) {
    chkMebbisPing.checked = !!st[UZA_MEBBIS_OTURUM_ENABLED_KEY];
  }
});

const chkAutoConfirm = document.getElementById('chkAutoConfirm');
chkAutoConfirm?.addEventListener('change', () => {
  void chrome.storage.local.set({ uzaEokulAutoConfirm: !!chkAutoConfirm.checked });
});
void chrome.storage.local.get(['uzaEokulAutoConfirm']).then((st) => {
  if (chkAutoConfirm) chkAutoConfirm.checked = !!st.uzaEokulAutoConfirm;
});

(async function appEntry() {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  const gate = data[UZA_SESSION_GATE_KEY];
  const school = gate.schoolName ? ` · ${gate.schoolName}` : '';
  shellMeta.textContent = `${gate.displayName || 'Kullanıcı'}${school}`;
  const kr = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_KURUM });
  const kurumKey = kr?.kurumKey || gate.kurumKey || 'ilkOgretim';
  if (selKurum) selKurum.value = kurumKey;
  await uzaRefreshOkulTuruUi(kurumKey);

  try {
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI });
    if (res?.extensionUi) {
      if (res.extensionUi.app?.shell?.title) shellTitle.textContent = res.extensionUi.app.shell.title;
      const ui = { ...res.extensionUi, menuIds: res.menuIds ?? res.extensionUi.menuIds };
      cachedUi = ui;
      renderMenus(ui, kurumKey);
    } else {
      gridEmpty.hidden = false;
    }
  } catch {
    gridEmpty.hidden = false;
  }
  await refreshSessionStrip();
  setInterval(refreshSessionStrip, 5000);
})();
