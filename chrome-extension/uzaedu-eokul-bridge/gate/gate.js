const btnGateRun = document.getElementById('btnGateRun');
const gateMessage = document.getElementById('gateMessage');
const gateOverlay = document.getElementById('gateOverlay');
const pillPortal = document.getElementById('pillPortal');
const pillEokul = document.getElementById('pillEokul');
const pillMebbis = document.getElementById('pillMebbis');
const pillKbs = document.getElementById('pillKbs');
const pillVersion = document.getElementById('pillVersion');
const schoolCard = document.getElementById('schoolCard');
const schoolCardKicker = document.getElementById('schoolCardKicker');
const schoolName = document.getElementById('schoolName');
const schoolMeta = document.getElementById('schoolMeta');
const schoolAccessMsg = document.getElementById('schoolAccessMsg');
const codeFormBlock = document.getElementById('codeFormBlock');
const inpBridgeCode = document.getElementById('inpBridgeCode');
const btnVerifyCode = document.getElementById('btnVerifyCode');
const oturumStatusGrid = document.getElementById('oturumStatusGrid');

let lastSchoolAccess = null;

function setSchoolPanelMode(mode) {
  if (!schoolCard) return;
  schoolCard.classList.remove('school-panel--ready', 'school-panel--warn', 'school-panel--err');
  if (mode) schoolCard.classList.add(`school-panel--${mode}`);
}

function setPill(el, state, text) {
  if (!el) return;
  let extra = '';
  if (el.id === 'pillEokul') extra = ' chip--eokul';
  else if (el.id === 'pillMebbis') extra = ' chip--mebbis';
  else if (el.id === 'pillKbs') extra = ' chip--kbs';
  el.className = `chip chip--${state}${extra}`;
  el.textContent = text;
}

function tabPillLabel(ready, count) {
  if (!ready) return 'Yok';
  if (count > 1) return `${count} sekme`;
  return 'Açık';
}

function setOverlay(on) {
  gateOverlay.hidden = !on;
}

function gateNotify(msg, tone) {
  if (!gateMessage) return;
  const text = msg ? (typeof uzaHumanError === 'function' ? uzaHumanError(msg) : msg) : '';
  if (!text) {
    gateMessage.hidden = true;
    gateMessage.textContent = '';
    gateMessage.className = 'gate-alert';
    return;
  }
  gateMessage.hidden = false;
  gateMessage.textContent = text;
  gateMessage.className = 'gate-alert';
  if (tone === 'error') gateMessage.classList.add('gate-alert--error');
  else if (tone === 'success') gateMessage.classList.add('gate-alert--success');
}

function formatDiagnostic(report) {
  if (!report) return '';
  const lines = [`Eklenti v${report.extVersion || '?'}`];
  if (report.auth?.ok) {
    lines.push(`Oturum: ${report.auth.me?.school?.name || report.auth.me?.display_name || 'OK'}`);
  } else if (report.auth?.error) {
    lines.push(report.auth.error);
  }
  return lines.join('\n');
}

async function fetchDiagnostic() {
  try {
    return await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_DIAGNOSTIC });
  } catch {
    return null;
  }
}

function showSchoolCardError(title, detail, report) {
  schoolCard.hidden = false;
  setSchoolPanelMode('err');
  if (schoolCardKicker) schoolCardKicker.textContent = 'Bağlantı';
  schoolName.textContent = title;
  const raw = String(detail || '').trim();
  const human =
    /is not defined/i.test(raw) && typeof uzaHumanError === 'function' ? uzaHumanError(raw) : raw;
  const diag = report ? formatDiagnostic(report) : '';
  schoolMeta.textContent = diag ? `${human}\n\n${diag}` : human;
  schoolAccessMsg.hidden = true;
  codeFormBlock.hidden = true;
  btnGateRun.disabled = true;
}

function updateContinueButton(access) {
  const ok = !!access?.moduleEnabled && !!access?.canUseBridge && !access?.requiresCode;
  btnGateRun.disabled = !ok;
  btnGateRun.textContent = ok ? 'Devam et' : 'Önce Market modülünü açın';
}

function renderSchoolAccess(access) {
  lastSchoolAccess = access;
  if (!access?.school) {
    schoolCard.hidden = true;
    updateContinueButton(null);
    return;
  }
  schoolCard.hidden = false;
  const s = access.school;
  const loc = [s.district, s.city].filter(Boolean).join(' / ');
  const inst = s.institutionCode ? `Kurum ${s.institutionCode}` : '';

  if (access.moduleEnabled && access.canUseBridge) {
    setSchoolPanelMode('ready');
    if (schoolCardKicker) schoolCardKicker.textContent = 'Bağlı okul';
    schoolName.textContent = s.name || 'Okul';
    schoolMeta.textContent = [loc, inst].filter(Boolean).join(' · ') || '—';
    schoolAccessMsg.hidden = true;
  } else {
    setSchoolPanelMode('warn');
    if (schoolCardKicker) schoolCardKicker.textContent = 'Okul';
    schoolName.textContent = s.name || 'Okul';
    schoolMeta.textContent = [loc, inst].filter(Boolean).join(' · ') || '—';
    schoolAccessMsg.hidden = false;
    schoolAccessMsg.textContent =
      access.message || 'Okul Köprüsü modülü Market üzerinden açılmalıdır.';
  }

  const bridgeReady = !!access.moduleEnabled && !!access.canUseBridge;
  if (codeFormBlock) {
    if (access.requiresCode) {
      codeFormBlock.hidden = false;
      codeFormBlock.open = true;
    } else if (bridgeReady) {
      codeFormBlock.hidden = true;
      codeFormBlock.open = false;
    } else {
      codeFormBlock.hidden = false;
      codeFormBlock.open = false;
    }
  }
  updateContinueButton(access);
}

function renderOturumSites(rows) {
  if (!oturumStatusGrid) return;
  oturumStatusGrid.innerHTML = '';
  for (const row of rows || []) {
    const el = document.createElement('div');
    el.className = 'step-item';
    const state = !row.pingOn ? 'wait' : row.ready ? 'ok' : 'wait';
    const statusText = !row.pingOn
      ? 'Kapalı'
      : row.ready
        ? tabPillLabel(true, row.tabCount)
        : 'Yok';
    el.innerHTML = `
      <div class="step-copy">
        <span class="step-name">${row.label}</span>
        ${row.hint ? `<span class="step-hint">${row.hint}</span>` : ''}
      </div>
      <span class="chip chip--${state}">${statusText}</span>`;
    oturumStatusGrid.appendChild(el);
  }
}

async function loadSchoolAccess() {
  try {
    const r = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_SCHOOL_ACCESS });
    if (chrome.runtime.lastError) {
      const diag = await fetchDiagnostic();
      showSchoolCardError('Köprü yanıt vermedi', chrome.runtime.lastError.message, diag?.report);
      return;
    }
    if (r?.ok && r.access) renderSchoolAccess(r.access);
    else if (r?.error) {
      const err = String(r.error);
      const title = /giriş|oturum/i.test(err) ? 'Panele giriş gerekli' : 'Panel bağlantısı yok';
      const diag = await fetchDiagnostic();
      showSchoolCardError(title, err, diag?.report);
    } else if (!r) {
      const diag = await fetchDiagnostic();
      showSchoolCardError(
        'Köprü yanıt vermedi',
        'Eklentiyi yenileyin (chrome://extensions) ve panel sekmesinde F5 yapın.',
        diag?.report,
      );
    }
  } catch (e) {
    const diag = await fetchDiagnostic();
    showSchoolCardError('Okul bilgisi alınamadı', e?.message || String(e), diag?.report);
  }
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
      if (st.panelSessionOk) {
        setPill(pillPortal, 'ok', 'Oturum açık');
      } else if (st.portalConnected) {
        setPill(pillPortal, 'wait', st.portalTabCount > 1 ? `${st.portalTabCount} sekme` : 'Giriş yok');
      } else {
        setPill(pillPortal, 'wait', 'Sekme yok');
      }
      const eokulHint = document.getElementById('eokulStepHint');
      if (eokulHint) {
        eokulHint.textContent = st.eokulOptional
          ? 'İsteğe bağlı (MEBBİS/KBS yeterli)'
          : st.eokulReady
            ? 'Modüller için hazır'
            : 'e-Okul modülleri için';
      }
      setPill(
        pillEokul,
        st.eokulReady ? 'ok' : st.eokulOptional ? 'wait' : 'wait',
        st.eokulReady
          ? tabPillLabel(true, st.eokulTabCount)
          : st.eokulOptional
            ? 'İsteğe bağlı'
            : 'Yok',
      );
      if (pillMebbis) {
        setPill(
          pillMebbis,
          st.mebbisReady ? 'ok' : 'wait',
          st.mebbisReady ? tabPillLabel(true, st.mebbisTabCount) : 'Yok',
        );
      }
      if (pillKbs) {
        setPill(pillKbs, st.kbsReady ? 'ok' : 'wait', st.kbsReady ? tabPillLabel(true, st.kbsTabCount) : 'Yok');
      }
      if (st.schoolAccess) renderSchoolAccess(st.schoolAccess);
      renderOturumSites(st.oturumSites);
    }
  } catch {
    /* sessiz */
  }
}

btnVerifyCode?.addEventListener('click', async () => {
  const code = inpBridgeCode?.value?.trim();
  if (!code) {
    gateNotify('Kod girin veya Market modülü ile devam edin.', 'error');
    return;
  }
  btnVerifyCode.disabled = true;
  try {
    const r = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_VERIFY_CODE, code });
    if (r?.ok && r.access) {
      renderSchoolAccess(r.access);
      gateNotify('Kod kaydedildi.', 'success');
    } else {
      gateNotify(r?.error || 'Kod hatalı.', 'error');
    }
  } catch (e) {
    gateNotify(e?.message || String(e), 'error');
  } finally {
    btnVerifyCode.disabled = false;
  }
});

btnGateRun?.addEventListener('click', async () => {
  gateNotify('', '');
  btnGateRun.disabled = true;
  setOverlay(true);
  let leave = false;
  try {
    const ver = chrome.runtime.getManifest().version;
    const versionRes = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_VERSION, version: ver });
    if (!versionRes?.ok || !versionRes.enabled) {
      gateNotify(versionRes?.message || 'Eklenti güncel değil.', 'error');
      return;
    }
    const feature = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_FEATURE });
    if (!feature?.ok || !feature.enabled) {
      gateNotify(feature?.message || 'Köprü devre dışı.', 'error');
      return;
    }
    if (lastSchoolAccess?.requiresCode) {
      gateNotify('Önce kodu doğrulayın.', 'error');
      return;
    }
    if (!lastSchoolAccess?.canUseBridge) {
      gateNotify('Market’ten Okul Köprüsü modülünü açın.', 'error');
      return;
    }
    const res = await chrome.runtime.sendMessage({ type: UZA_MSG_GATE_RUN });
    if (res?.ok) {
      leave = true;
      const embed =
        window.UZA_EMBED ||
        new URLSearchParams(location.search).has('embed') ||
        window.parent !== window;
      const appUrl =
        typeof uzaExtUrl === 'function'
          ? uzaExtUrl('app/app.html')
          : chrome.runtime.getURL('app/app.html');
      if (embed) {
        window.location.replace(appUrl);
        if (typeof uzaFloatPost === 'function') uzaFloatPost({ type: 'UZA_FLOAT_RELOAD' });
        return;
      }
      await chrome.tabs.create({ url: appUrl });
      window.close();
      return;
    }
    gateNotify(res?.error || 'Bağlantı kurulamadı.', 'error');
  } catch (e) {
    gateNotify(e?.message || String(e), 'error');
  } finally {
    if (!leave) {
      setOverlay(false);
      updateContinueButton(lastSchoolAccess);
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
    /* varsayılan */
  }
  await loadSchoolAccess();
  await refreshStatus();
  setInterval(refreshStatus, 4000);
})();
