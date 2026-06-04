function uzaGo(path) {
  const url =
    typeof uzaExtUrl === 'function' ? uzaExtUrl(path) : chrome.runtime.getURL(path);
  window.location.href = url;
}

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

function sessionStateLabel(ready, count) {
  if (!ready) return 'Kapalı';
  if (count > 1) return `${count} sekme`;
  return 'Açık';
}

function setSessionChip(el, stateEl, ready, count) {
  if (!el) return;
  el.classList.remove('ok', 'wait');
  el.classList.add(ready ? 'ok' : 'wait');
  if (stateEl) stateEl.textContent = sessionStateLabel(ready, count || 0);
}

async function refreshSessionStrip() {
  try {
    const st = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_STATUS });
    if (!st?.ok) return;
    setSessionChip(
      document.getElementById('chipPanel'),
      document.getElementById('chipPanelState'),
      st.portalConnected,
      st.portalTabCount,
    );
    setSessionChip(
      document.getElementById('chipEokul'),
      document.getElementById('chipEokulState'),
      st.eokulReady,
      st.eokulTabCount,
    );
    setSessionChip(
      document.getElementById('chipMebbis'),
      document.getElementById('chipMebbisState'),
      st.mebbisReady,
      st.mebbisTabCount,
    );
    setSessionChip(
      document.getElementById('chipKbs'),
      document.getElementById('chipKbsState'),
      st.kbsReady,
      st.kbsTabCount,
    );
  } catch {
    /* sessiz */
  }
}

btnGateBack?.addEventListener('click', () => {
  if (window.UZA_EMBED && typeof uzaFloatPost === 'function') {
    uzaFloatPost({ type: 'UZA_FLOAT_CLOSE' });
    return;
  }
  uzaGo('gate/gate.html');
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
    const m = menus[id];
    if (!m) continue;
    if (!menuSupportsKurum(m, kurumKey)) continue;
    const platform = platformForMenu(id);
    if (platform === 'mebbis') hasMebbis = true;
    if (platform === 'kbs') hasKbs = true;
    if (activeFilter !== 'all' && platform !== activeFilter) continue;
    const b = badgeForMenu(m);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `module-row platform-${platform}${m.enabled ? ' enabled' : ''}`;
    row.dataset.platform = platform;
    row.disabled = !m.enabled;
    const desc = [m.description, DIR_LABEL[m.direction] || m.direction]
      .filter(Boolean)
      .join(' · ');
    const iconKey =
      (typeof UZA_ICON !== 'undefined' && UZA_ICON.menu[id]) ||
      (platform === 'mebbis' || platform === 'kbs' ? 'payroll' : 'module');
    const iconHtml =
      typeof UZA_ICON !== 'undefined' ? UZA_ICON.svg(iconKey, 22) : escapeHtml(PLATFORM_ICON[platform] || 'ON');
    row.innerHTML = `
      <span class="module-row__icon" aria-hidden="true">${iconHtml}</span>
      <span class="module-row__body">
        <span class="module-row__title">${escapeHtml(m.label || id)}</span>
        <span class="module-row__desc">${escapeHtml(desc)}</span>
      </span>
      <span class="module-row__meta">
        <span class="badge ${b.cls}">${escapeHtml(b.text)}</span>
        <span class="module-row__chev" aria-hidden="true">›</span>
      </span>
    `;
    if (m.enabled) {
      row.addEventListener('click', () => {
        if (id === 'kelebekSinavOgrenciAktar') {
          uzaGo('menus/kelebek.html');
        } else if (id === 'gunlukDevamsizlikAktar') {
          uzaGo('menus/gunluk.html');
        } else if (id === 'eyoklamaDersDevamsizlikAktar') {
          uzaGo('menus/gunluk.html?kind=ders');
        } else if (id === 'toplamDevamsizlikAktar') {
          uzaGo('menus/toplam.html');
        } else if (id === 'devamsizlikMektubuEokul') {
          uzaGo('menus/mektup.html');
        } else if (id === 'ogrenciRehberEokul') {
          uzaGo('menus/rehber.html');
        } else if (id === 'evciCarsiIzin') {
          uzaGo('menus/izin.html');
        } else if (id === 'dersProgramiEokul') {
          uzaGo('menus/ders-programi.html');
        } else if (id === 'gunlukDevamsizlikYaz') {
          uzaGo('menus/gunluk-yaz.html');
        } else if (id === 'topluOzursuzDevam') {
          uzaGo('menus/toplu-ozursuz.html');
        } else if (id === 'topluOzurluDevam') {
          uzaGo('menus/ozurlu.html');
        } else if (id === 'ozursuzdenOzurluye') {
          uzaGo('menus/ozursuz-ozurlu.html');
        } else if (id === 'ogrenciDosyaBilgileriAl') {
          uzaGo('menus/ogrenci-dosya.html');
        } else if (id === 'veliBilgiGuncelle') {
          uzaGo('menus/veli-guncelle.html');
        } else if (id === 'topluFaaliyet') {
          uzaGo('menus/faaliyet.html');
        } else if (id === 'mebbisPuantajBordro') {
          uzaGo('menus/bordro.html?type=mebbis_puantaj');
        } else if (id === 'kbsEkDersBordro') {
          uzaGo('menus/bordro.html?type=ek_ders_bordro');
        } else if (id === 'kbsMaasBordro') {
          uzaGo('menus/bordro.html?type=maas_bordro');
        } else if (id === 'oturumAcik') {
          uzaGo('menus/oturum.html');
        }
      });
    }
    grid.appendChild(row);
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

document.getElementById('linkOturumPage')?.addEventListener('click', (e) => {
  e.preventDefault();
  uzaGo('menus/oturum.html');
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
    window.location.replace(
      typeof uzaExtUrl === 'function' ? uzaExtUrl('gate/gate.html') : chrome.runtime.getURL('gate/gate.html'),
    );
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
  const footerVersion = document.getElementById('footerVersion');
  if (footerVersion) {
    try {
      footerVersion.textContent = `v${chrome.runtime.getManifest().version}`;
    } catch {
      footerVersion.textContent = 'v—';
    }
  }
  const shellTagline = document.getElementById('shellTagline');
  if (shellTagline && typeof UZA_BRAND !== 'undefined') {
    shellTagline.textContent = `${UZA_BRAND.productShort} · ${UZA_BRAND.okulNet}, ${UZA_BRAND.personelNet}, ${UZA_BRAND.maliNet}`;
  }
  const modIcon = document.getElementById('modulesTitleIcon');
  if (modIcon && typeof UZA_ICON !== 'undefined') modIcon.innerHTML = UZA_ICON.svg('grid', 18);
  await refreshSessionStrip();
  setInterval(refreshSessionStrip, 5000);
})();
