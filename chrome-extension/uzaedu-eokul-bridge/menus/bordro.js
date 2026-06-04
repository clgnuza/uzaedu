const BORDRO_SOURCE_HINTS = {
  mebbis_puantaj: [
    'mebbis.meb.gov.tr/EKD/ekd04002.aspx',
    'Filtreler → «Rapor Görüntüle» (btnRaporGoruntule)',
    '«Açık sekmeden çek» (rapor yoksa otomatik tetikler) veya Excele Aktar',
  ],
  ek_ders_bordro: [
    'https://www.kbs.gov.tr/yeniakademik/p_yenirapor.htm',
    'Rapor oluştur → Excel indir',
    '«Son indirilen Excel» veya «KBS’de indir (yakala)»',
  ],
  maas_bordro: [
    'https://www.kbs.gov.tr/maasRapor/maasRapor.htm',
    'Dönem seç → rapor oluştur → Excel indir',
    '«Son indirilen Excel» veya «KBS’de indir (yakala)»',
  ],
};

const BORDRO_PAGE_META = {
  mebbis_puantaj: {
    label: UZA_BRAND.personelNet + ' Puantaj',
    panelPath: '/mesaj-merkezi/mebbis-puantaj',
    privacy: 'Puantaj mesajları öğretmenlere ayrı gönderilir.',
  },
  ek_ders_bordro: {
    label: UZA_BRAND.maliNet + ' Ek Ders Bordro',
    panelPath: '/mesaj-merkezi/kbs-ek-ders',
    privacy: 'Ek ders bordro mesajları öğretmenlere ayrı gönderilir.',
  },
  maas_bordro: {
    label: UZA_BRAND.maliNet + ' Maaş Bordro',
    panelPath: '/mesaj-merkezi/kbs-maas',
    privacy: 'Maaş bordroları gizlidir; her öğretmene kişisel mesaj gider.',
  },
};

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const params = new URLSearchParams(location.search);
const bordroType = params.get('type') || 'mebbis_puantaj';
const meta = BORDRO_PAGE_META[bordroType] || BORDRO_PAGE_META.mebbis_puantaj;

const pageTitle = document.getElementById('pageTitle');
const privacyNote = document.getElementById('privacyNote');
const status = document.getElementById('status');
const stepForm = document.getElementById('stepForm');
const stepMatch = document.getElementById('stepMatch');
const stepDone = document.getElementById('stepDone');
const matchSummary = document.getElementById('matchSummary');
const matchList = document.getElementById('matchList');
const unmatchedPhonesEl = document.getElementById('unmatchedPhones');
const panelLink = document.getElementById('panelLink');
const formatDetected = document.getElementById('formatDetected');
const kbsWarnings = document.getElementById('kbsWarnings');
const compareBox = document.getElementById('compareBox');
const tcAuditBox = document.getElementById('tcAuditBox');

let fileBuffer = null;
let fileName = '';
let parseResult = null;
let fromScrape = false;
let manualPhones = {};
let lastTablePayload = null;
let gatePayload = null;

const TYPE_SKIN = {
  mebbis_puantaj: { rootClass: 'type-mebbis', badge: UZA_BRAND.personelNet },
  ek_ders_bordro: { rootClass: 'type-ek_ders', badge: UZA_BRAND.maliNet + ' Ek Ders' },
  maas_bordro: { rootClass: 'type-maas', badge: UZA_BRAND.maliNet + ' Maaş' },
};
const skin = TYPE_SKIN[bordroType] || TYPE_SKIN.mebbis_puantaj;
const bordroRoot = document.getElementById('bordroRoot');
if (bordroRoot) {
  bordroRoot.classList.remove('type-mebbis', 'type-ek_ders', 'type-maas');
  bordroRoot.classList.add(skin.rootClass);
}
const typeBadge = document.getElementById('typeBadge');
if (typeBadge) typeBadge.textContent = skin.badge;

const isKbs = bordroType === 'ek_ders_bordro' || bordroType === 'maas_bordro';
const btnOpenTab = document.getElementById('btnOpenTab');
if (btnOpenTab) {
  btnOpenTab.textContent =
    bordroType === 'mebbis_puantaj'
      ? UZA_BRAND.personelNet + ' sekmesi aç'
      : UZA_BRAND.maliNet + ' sekmesi aç';
}
if (document.getElementById('btnMebbisReport')) {
  document.getElementById('btnMebbisReport').hidden = bordroType !== 'mebbis_puantaj';
}
if (document.getElementById('btnMebbisViewReport')) {
  document.getElementById('btnMebbisViewReport').hidden = bordroType !== 'mebbis_puantaj';
}
if (document.getElementById('btnSnapshotMebbis')) {
  document.getElementById('btnSnapshotMebbis').hidden = bordroType === 'maas_bordro';
}
if (document.getElementById('btnSnapshotKbs')) {
  document.getElementById('btnSnapshotKbs').hidden = bordroType === 'mebbis_puantaj';
}
if (document.getElementById('btnCompare')) {
  document.getElementById('btnCompare').hidden = bordroType === 'maas_bordro';
}
if (document.getElementById('btnScrapePuantaj')) {
  document.getElementById('btnScrapePuantaj').hidden = !isKbs || bordroType === 'maas_bordro';
}
if (document.getElementById('btnScrapeBordro')) {
  document.getElementById('btnScrapeBordro').hidden = bordroType !== 'ek_ders_bordro';
}
const btnKbsExport = document.getElementById('btnMaasExport');
const btnLastExcel = document.getElementById('btnLastExcel');
const btnScrape = document.getElementById('btnScrape');
const scrapeSection = document.getElementById('scrapeSection');
const scrapeSectionTitle = document.getElementById('scrapeSectionTitle');
const kbsDownloadFlow = bordroType === 'maas_bordro' || bordroType === 'ek_ders_bordro';
if (kbsDownloadFlow) {
  if (btnKbsExport) btnKbsExport.hidden = false;
  if (btnLastExcel) {
    btnLastExcel.classList.remove('secondary');
    btnLastExcel.classList.add('primary');
  }
  if (btnScrape) btnScrape.hidden = true;
  if (document.getElementById('btnScrapeBordro')) {
    document.getElementById('btnScrapeBordro').hidden = true;
  }
  if (scrapeSectionTitle) {
    scrapeSectionTitle.textContent =
      bordroType === 'maas_bordro' ? 'KBS maaş raporu' : 'KBS ek ders raporu';
  }
  if (scrapeSection) scrapeSection.classList.add('kbs-download-mode');
}

function uzaSetPageTitle(text) {
  if (pageTitle) pageTitle.textContent = text;
  var th = document.querySelector('.uza-toolbar-text h1');
  if (th) th.textContent = text;
}
uzaSetPageTitle(meta.label);
var uzaToolbar = document.querySelector('.uza-toolbar');
if (uzaToolbar) {
  var plat = bordroType === 'mebbis_puantaj' ? 'mebbis' : 'kbs';
  uzaToolbar.classList.remove('platform-eokul', 'platform-mebbis', 'platform-kbs');
  uzaToolbar.classList.add('platform-' + plat);
}
privacyNote.textContent = meta.privacy || '';
privacyNote.hidden = !meta.privacy;
privacyNote.classList.add('bordro-alert', 'privacy');
const hintsEl = document.getElementById('sourceHints');
const hints = BORDRO_SOURCE_HINTS[bordroType] || [];
if (hintsEl && hints.length) {
  hintsEl.innerHTML = hints.map((h) => `<li>${h}</li>`).join('');
  hintsEl.hidden = false;
}

function showStep(name) {
  stepForm.hidden = name !== 'form';
  stepMatch.hidden = name !== 'match';
  stepDone.hidden = name !== 'done';
}

function formCommon() {
  return {
    bordroType,
    donem: document.getElementById('donem')?.value?.trim(),
    schoolName: document.getElementById('schoolName')?.value?.trim(),
    footerNote: document.getElementById('footerNote')?.value?.trim(),
  };
}

function requireDonem() {
  const donem = document.getElementById('donem')?.value?.trim();
  if (!donem) {
    setStatus('Dönem girin.', 'error');
    return null;
  }
  return donem;
}

function setStatus(msg, tone) {
  if (!status) return;
  if (typeof UZA_NOTIFY !== 'undefined' && status.uzaNotify) {
    status.uzaNotify(msg || '', tone);
    return;
  }
  status.textContent = msg || '';
  status.classList.remove('error', 'success');
  if (tone) status.classList.add(tone);
}

function renderUnmatchedPhones(unmatched) {
  if (!unmatchedPhonesEl) return;
  unmatchedPhonesEl.innerHTML = '';
  const list = unmatched || [];
  if (!list.length) return;
  const title = document.createElement('p');
  title.className = 'bordro-phones-title';
  title.textContent = 'Telefon eksik — manuel girin';
  unmatchedPhonesEl.appendChild(title);
  for (const t of list) {
    const row = document.createElement('div');
    row.className = 'bordro-phone-row';
    const info = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = t.name || '?';
    info.appendChild(nameEl);
    if (t.tc) {
      const tcEl = document.createElement('div');
      tcEl.className = 'tc';
      tcEl.textContent = `${t.tc.slice(0, 3)}***${t.tc.slice(-3)}`;
      info.appendChild(tcEl);
    }
    const inp = document.createElement('input');
    inp.placeholder = '+905…';
    inp.value = manualPhones[t.name] || '';
    inp.addEventListener('input', () => {
      manualPhones[t.name] = inp.value.trim();
    });
    row.appendChild(info);
    row.appendChild(inp);
    unmatchedPhonesEl.appendChild(row);
  }
}

function applyParseResult(res) {
  parseResult = res;
  fromScrape = !!res.fromScrape;
  if (res.table) lastTablePayload = res.table;
  const extra = res.rowCount ? ` · ${res.rowCount} satır` : '';
  const scrapeNote = res.scrapeUrl ? ` · ${new URL(res.scrapeUrl).hostname}` : '';
  const matchedN = res.matched?.length ?? 0;
  const unmatchedN = res.unmatched?.length ?? 0;
  const statMatched = document.getElementById('statMatched');
  const statUnmatched = document.getElementById('statUnmatched');
  if (statMatched) statMatched.textContent = String(matchedN);
  if (statUnmatched) statUnmatched.textContent = String(unmatchedN);
  matchSummary.textContent = `${matchedN} eşleşti, ${unmatchedN} telefon eksik${extra}${scrapeNote}`;
  if (formatDetected && res.excelFormatLabel) {
    formatDetected.textContent = `Algılanan format: ${res.excelFormatLabel}`;
    formatDetected.hidden = false;
  }
  if (kbsWarnings) {
    const w = res.kbsWarnings || [];
    if (w.length) {
      kbsWarnings.textContent = w.join(' ');
      kbsWarnings.hidden = false;
    } else {
      kbsWarnings.hidden = true;
    }
  }
  matchList.innerHTML = '';
  const matched = res.matched || [];
  for (const t of matched.slice(0, 25)) {
    const li = document.createElement('li');
    li.textContent = `${t.name || '?'} — tel OK`;
    matchList.appendChild(li);
  }
  if (matched.length > 25) {
    const li = document.createElement('li');
    li.textContent = `… +${matched.length - 25} eşleşen`;
    matchList.appendChild(li);
  }
  renderUnmatchedPhones(res.unmatched);
  showStep('match');
  setStatus('');
}

document.getElementById('fileInput')?.addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  fileBuffer = null;
  fromScrape = false;
  if (!f) return;
  fileBuffer = await f.arrayBuffer();
  fileName = f.name;
});

document.getElementById('btnMebbisReport')?.addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ type: UZA_MSG_BORDRO_OPEN_MEBBIS_REPORT });
  setStatus(r?.hint || 'ekd04002 açıldı — filtreleri doldurup «Rapor Görüntüle».', 'success');
});

document.getElementById('btnMebbisViewReport')?.addEventListener('click', async () => {
  if (!requireDonem()) return;
  setStatus('Rapor görüntüleniyor…');
  const r = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_MEBBIS_VIEW_REPORT,
    ...formCommon(),
  });
  if (!r?.ok) {
    setStatus(r?.error || 'Rapor açılamadı.', 'error');
    return;
  }
  applyParseResult({ ...r, fromScrape: true });
});

document.getElementById('btnOpenTab')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: UZA_MSG_BORDRO_OPEN_TAB, bordroType });
  setStatus(
    bordroType === 'mebbis_puantaj'
      ? UZA_BRAND.personelNet +
        ': ekd04002 → Rapor Görüntüle → çek veya Excele Aktar.'
      : bordroType === 'maas_bordro'
        ? 'maasRapor.htm açıldı. Dönem seçin → indirin → «Son indirilen Excel».'
        : bordroType === 'ek_ders_bordro'
          ? 'p_yenirapor.htm açıldı. Rapor oluşturun → indirin → «Son indirilen Excel».'
          : UZA_BRAND.maliNet + ': personel/bordro listesini açın.',
    'success',
  );
});

async function runScrapeParse(scrapeMode) {
  if (!requireDonem()) return;
  setStatus('Sekme taranıyor…');
  const res = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_SCRAPE_PARSE,
    ...formCommon(),
    scrapeMode: scrapeMode || '',
  });
  if (!res?.ok) {
    setStatus(res?.error || 'Çekim başarısız.', 'error');
    return;
  }
  applyParseResult({ ...res, fromScrape: true });
}

document.getElementById('btnScrape')?.addEventListener('click', () =>
  runScrapeParse(bordroType === 'maas_bordro' ? 'bordro' : ''),
);
document.getElementById('btnScrapePuantaj')?.addEventListener('click', () => runScrapeParse('puantaj'));
document.getElementById('btnScrapeBordro')?.addEventListener('click', () => runScrapeParse('bordro'));

document.getElementById('btnMaasExport')?.addEventListener('click', async () => {
  if (!requireDonem()) return;
  setStatus('KBS indirme tetikleniyor…');
  const r = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_KBS_CLICK_EXPORT,
    bordroType,
  });
  if (!r?.ok) {
    setStatus(r?.error || 'İndirme yakalanamadı.', 'error');
    return;
  }
  setStatus(`Excel yakalandı: ${r.filename || 'bordro.xlsx'} — ayrıştırılıyor…`, 'success');
  const res = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_LAST_EXCEL_PARSE,
    ...formCommon(),
  });
  if (!res?.ok) {
    setStatus(res?.error || 'Ayrıştırma başarısız.', 'error');
    return;
  }
  applyParseResult({ ...res, fromStoredExcel: true });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'UZA_BORDRO_EXCEL_STORED' && msg.notify) {
    setStatus(`Excel hazır: ${msg.label || 'bordro.xlsx'} — «Son indirilen Excel» ile devam edin.`, 'success');
  }
});

document.getElementById('btnLastExcel')?.addEventListener('click', async () => {
  if (!requireDonem()) return;
  setStatus('Son Excel okunuyor…');
  const res = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_LAST_EXCEL_PARSE,
    ...formCommon(),
  });
  if (!res?.ok) {
    setStatus(res?.error || 'Son Excel yok.', 'error');
    return;
  }
  applyParseResult({ ...res, fromStoredExcel: true });
});

document.getElementById('btnSnapshotMebbis')?.addEventListener('click', async () => {
  setStatus(UZA_BRAND.personelNet + ' kaydediliyor…');
  const r = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_SNAPSHOT_MEBBIS,
    scrapeMode: 'puantaj',
  });
  setStatus(
    r?.ok
      ? `${UZA_BRAND.personelNet}: ${r.table?.rowCount || 0} satır kaydedildi.`
      : r?.error || 'Hata',
    r?.ok ? 'success' : 'error',
  );
});

document.getElementById('btnSnapshotKbs')?.addEventListener('click', async () => {
  setStatus(UZA_BRAND.maliNet + ' kaydediliyor…');
  const r = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_SNAPSHOT_KBS,
    bordroType,
    scrapeMode: 'bordro',
  });
  setStatus(
    r?.ok ? `${UZA_BRAND.maliNet}: ${r.table?.rowCount || 0} satır kaydedildi.` : r?.error || 'Hata',
    r?.ok ? 'success' : 'error',
  );
});

document.getElementById('btnCompare')?.addEventListener('click', async () => {
  setStatus('Karşılaştırılıyor…');
  const r = await chrome.runtime.sendMessage({ type: UZA_MSG_BORDRO_COMPARE });
  if (!r?.ok) {
    setStatus(r?.error || 'Karşılaştırma başarısız.', 'error');
    return;
  }
  const s = r.summary || {};
  const lines = [
    `Uyumlu: ${s.ok ?? 0} · Fark: ${s.mismatch ?? 0} · Yalnız ${UZA_BRAND.personelNet}: ${s.mebbisOnly ?? 0} · Yalnız ${UZA_BRAND.maliNet}: ${s.kbsOnly ?? 0}`,
  ];
  for (const row of (r.rows || []).filter((x) => x.status !== 'ok').slice(0, 12)) {
    lines.push(
      `${row.name}: ${UZA_BRAND.personelNet} ${row.mebbisHours} / ${UZA_BRAND.maliNet} ${row.kbsHours} (Δ ${row.delta})`,
    );
  }
  if (compareBox) {
    compareBox.textContent = lines.join('\n');
    compareBox.hidden = false;
  }
  setStatus('Karşılaştırma tamam.', 'success');
});

document.getElementById('btnTcAudit')?.addEventListener('click', async () => {
  setStatus('TC kontrol…');
  const payload = lastTablePayload
    ? { type: UZA_MSG_BORDRO_TC_AUDIT, bordroType, headers: lastTablePayload.headers, rows: lastTablePayload.rows }
    : { type: UZA_MSG_BORDRO_TC_AUDIT, bordroType };
  const r = await chrome.runtime.sendMessage(payload);
  if (!r?.ok) {
    setStatus(r?.error || 'Kontrol başarısız.', 'error');
    return;
  }
  const lines = [
    `Excel’de DB’de yok: ${r.missingInDb ?? 0}`,
    `DB’de Excel’de yok: ${r.missingInExcel ?? 0}`,
  ];
  for (const row of (r.rows || []).filter((x) => !x.inSchoolDb || !x.inExcel).slice(0, 10)) {
    lines.push(`${row.name} — excel:${row.inExcel ? '✓' : '✗'} db:${row.inSchoolDb ? '✓' : '✗'}`);
  }
  if (tcAuditBox) {
    tcAuditBox.textContent = lines.join('\n');
    tcAuditBox.hidden = false;
  }
  setStatus('TC kontrol tamam.', 'success');
});

document.getElementById('btnParse')?.addEventListener('click', async () => {
  if (!requireDonem()) return;
  if (!fileBuffer) {
    setStatus('Excel seçin.', 'error');
    return;
  }
  document.getElementById('btnParse').disabled = true;
  setStatus('Ayrıştırılıyor…');
  const res = await chrome.runtime.sendMessage({
    type: UZA_MSG_BORDRO_PARSE,
    ...formCommon(),
    fileBase64: arrayBufferToBase64(fileBuffer),
    filename: fileName,
  });
  document.getElementById('btnParse').disabled = false;
  if (!res?.ok) {
    setStatus(res?.error || 'Ayrıştırma başarısız.', 'error');
    return;
  }
  applyParseResult({ ...res, fromScrape: false });
});

document.getElementById('btnBack')?.addEventListener('click', () => showStep('form'));

document.getElementById('btnCampaign')?.addEventListener('click', async () => {
  if (!requireDonem()) return;
  document.getElementById('btnCampaign').disabled = true;
  setStatus('Kampanya oluşturuluyor…');
  const common = {
    ...formCommon(),
    title: document.getElementById('campaignTitle')?.value?.trim(),
    manualPhones,
  };
  const res = await chrome.runtime.sendMessage(
    fromScrape && lastTablePayload
      ? {
          type: UZA_MSG_BORDRO_SCRAPE_CAMPAIGN,
          ...common,
          headers: lastTablePayload.headers,
          rows: lastTablePayload.rows,
          scrapeUrl: parseResult?.scrapeUrl,
        }
      : fromScrape
        ? { type: UZA_MSG_BORDRO_SCRAPE_CAMPAIGN, ...common }
        : {
            type: UZA_MSG_BORDRO_CAMPAIGN,
            ...common,
            fileBase64: arrayBufferToBase64(fileBuffer),
            filename: fileName,
          },
  );
  document.getElementById('btnCampaign').disabled = false;
  if (!res?.ok) {
    setStatus(res?.error || 'Kampanya oluşturulamadı.', 'error');
    return;
  }
  const id = res.campaign?.id || '';
  document.getElementById('doneText').textContent = `Kampanya oluşturuldu${id ? ` (${id.slice(0, 8)}…)` : ''}. Gönderim panelden yapılır.`;
  const ui = await chrome.runtime.sendMessage({ type: UZA_MSG_GET_EXTENSION_UI });
  const origin = ui?.extensionUi?.portalApi?.portalSiteOrigin || 'http://localhost:3000';
  panelLink.href = `${origin.replace(/\/+$/, '')}${meta.panelPath || '/mesaj-merkezi'}${id ? `?campaign=${id}` : ''}`;
  showStep('done');
  setStatus('');
});

(async () => {
  const data = await chrome.storage.session.get(UZA_SESSION_GATE_KEY);
  if (!data[UZA_SESSION_GATE_KEY]) {
    window.location.replace(typeof uzaExtUrl==='function'?uzaExtUrl('gate/gate.html'):chrome.runtime.getURL('gate/gate.html'));
    return;
  }
  gatePayload = data[UZA_SESSION_GATE_KEY];
  if (gatePayload.schoolName) {
    const sn = document.getElementById('schoolName');
    if (sn) sn.value = gatePayload.schoolName;
  }
})();
