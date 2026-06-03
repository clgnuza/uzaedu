const btnGateRun = document.getElementById('btnGateRun');
const gateMessage = document.getElementById('gateMessage');
const gateOverlay = document.getElementById('gateOverlay');
const pillPortal = document.getElementById('pillPortal');
const pillEokul = document.getElementById('pillEokul');
const pillMebbis = document.getElementById('pillMebbis');
const pillKbs = document.getElementById('pillKbs');
const pillVersion = document.getElementById('pillVersion');

function setPill(el, state, text) {
  let base = 'pill';
  if (el?.id === 'pillEokul') base = 'pill eokul';
  else if (el?.id === 'pillMebbis') base = 'pill mebbis';
  else if (el?.id === 'pillKbs') base = 'pill kbs';
  el.className = `${base} ${state}`;
  el.textContent = text;
}

function setOverlay(on) {
  gateOverlay.hidden = !on;
}

async function refreshStatus() {
  try {
    const ver = chrome.runtime.getManifest().version;
    const vRes = await chrome.runtime.sendMessage({
      type: UZA_MSG_GATE_VERSION,
      version: ver,
    });
    if (vRes?.enabled) setPill(pillVersion, 'ok', `v${ver}`);
    else setPill(pillVersion, 'err', 'Güncelle');

    const st = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_STATUS });
    if (st?.ok) {
      setPill(pillPortal, st.portalConnected ? 'ok' : 'wait', st.portalConnected ? 'Bağlı' : 'Sekme yok');
      setPill(pillEokul, st.eokulReady ? 'ok' : 'wait', st.eokulReady ? 'Hazır' : 'Sekme yok');
      if (pillMebbis) {
        setPill(
          pillMebbis,
          st.mebbisReady ? 'ok' : 'wait',
          st.mebbisReady ? `Açık (${st.mebbisTabCount || 1})` : 'Sekme yok',
        );
      }
      if (pillKbs) {
        setPill(pillKbs, st.kbsReady ? 'ok' : 'wait', st.kbsReady ? `Açık (${st.kbsTabCount || 1})` : 'Sekme yok');
      }
    }
  } catch {
    /* sessiz */
  }
}

btnGateRun?.addEventListener('click', async () => {
  gateMessage.textContent = '';
  btnGateRun.disabled = true;
  setOverlay(true);
  let leave = false;
  try {
    const ver = chrome.runtime.getManifest().version;
    const versionRes = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_VERSION, version: ver });
    if (!versionRes?.ok || !versionRes.enabled) {
      gateMessage.textContent = versionRes?.message || 'Eklenti güncel değil.';
      return;
    }
    const feature = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_FEATURE });
    if (!feature?.ok || !feature.enabled) {
      gateMessage.textContent = feature?.message || 'Köprü devre dışı.';
      return;
    }
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_RUN });
    if (res?.ok) {
      leave = true;
      window.location.href = chrome.runtime.getURL('app/app.html');
      return;
    }
    gateMessage.textContent = res?.error || 'Bağlantı kurulamadı.';
  } catch (e) {
    gateMessage.textContent = e?.message || String(e);
  } finally {
    if (!leave) {
      setOverlay(false);
      btnGateRun.disabled = false;
      void refreshStatus();
    }
  }
});

void (async () => {
  try {
    const uiRes = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI });
    const g = uiRes?.extensionUi?.app?.gate;
    if (g?.title) document.getElementById('gateTitle').textContent = g.title;
    else if (typeof UZA_BRAND !== 'undefined') document.getElementById('gateTitle').textContent = UZA_BRAND.product;
    if (g?.subtitle) document.getElementById('gateSubtitle').textContent = g.subtitle;
    if (g?.runButton) btnGateRun.textContent = g.runButton;
  } catch {
    /* varsayılan metinler */
  }
  await refreshStatus();
  setInterval(refreshStatus, 4000);
})();
