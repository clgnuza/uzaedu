/** PersonelNet / MaliNet açık sekmedeki tabloları kazır (MV3 content script). */

function uzaNormHeader(c) {
  return String(c ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uzaCellText(el) {
  return String(el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uzaLooksLikeTc(s) {
  const d = String(s).replace(/\D/g, '');
  return d.length >= 10 && d.length <= 11;
}

function uzaHeaderScore(headers) {
  const norms = headers.map(uzaNormHeader);
  let score = 0;
  if (norms.some((h) => /t\.?\s*c|kimlik|tc\s*no/.test(h))) score += 40;
  if (norms.some((h) => /ad.*soyad|personel\s*ad|soyad/.test(h))) score += 35;
  if (norms.some((h) => /veri\s*tip/.test(h))) score += 25;
  if (norms.some((h) => /toplam\s*saat|net\s*ödenecek|brüt|kesinti|net\s*maaş/.test(h))) score += 20;
  if (norms.filter((h) => /^gün\s*\d+|^gun\s*\d+|^g\d+$/.test(h)).length >= 3) score += 30;
  return score;
}

function uzaScrapeHtmlTable(table) {
  const trs = [...table.querySelectorAll('tr')];
  if (!trs.length) return null;

  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(trs.length, 25); i++) {
    const cells = [...trs[i].querySelectorAll('th, td')];
    if (cells.length < 2) continue;
    const texts = cells.map(uzaCellText);
    const norms = texts.map(uzaNormHeader);
    const hasTc = norms.some((h) => /t\.?\s*c|kimlik/.test(h));
    const hasName = norms.some((h) => /ad.*soyad|personel|soyad/.test(h));
    const hasVeri = norms.some((h) => /veri\s*tip/.test(h));
    const hasMoney = norms.some((h) => /net|brüt|kesinti|tutar/.test(h));
    if (hasTc || hasName || hasVeri || hasMoney) {
      headerIdx = i;
      headers = texts.map((t, j) => (t ? t : `Sütun ${j + 1}`));
      break;
    }
  }
  if (headerIdx < 0) return null;

  const rows = [];
  for (let i = headerIdx + 1; i < trs.length; i++) {
    const cells = [...trs[i].querySelectorAll('td, th')];
    if (cells.length < 2) continue;
    const obj = {};
    let nonEmpty = false;
    for (let c = 0; c < headers.length; c++) {
      const val = uzaCellText(cells[c]);
      if (val) nonEmpty = true;
      obj[headers[c]] = val;
    }
    if (!nonEmpty) continue;
    const nameKey = headers.find((h) => /ad.*soyad|personel/i.test(h)) || headers[1] || headers[0];
    const nm = String(obj[nameKey] || '').toUpperCase();
    if (/^(TOPLAM|GENEL|ARA\s*TOPLAM)/.test(nm)) continue;
    const status = uzaRowBordroStatus(trs[i]);
    if (status) obj.__kbsDurum = status;
    rows.push(obj);
  }
  if (!rows.length) return null;
  return { headers, rows, score: uzaHeaderScore(headers) + rows.length };
}

function uzaRowBordroStatus(tr) {
  const el = tr;
  const bg = getComputedStyle(el).backgroundColor || '';
  const cls = (el.className || '') + ' ' + (el.getAttribute('style') || '');
  const s = (bg + ' ' + cls).toLowerCase();
  if (/rgb\(\s*0,\s*128|rgb\(\s*\d+,\s*\d+,\s*0|green|success|#0f0|#008000/.test(s)) return 'onay_bekliyor';
  if (/rgb\(\s*0,\s*0,\s*255|blue|#00f|primary/.test(s)) return 'muhasebeye_gitti';
  if (/rgb\(\s*255,\s*0,\s*0|red|danger|#f00|#ff0000/.test(s)) return 'muhasebe_tamam';
  return '';
}

function uzaKbsStatusSummary(rows) {
  const counts = { onay_bekliyor: 0, muhasebeye_gitti: 0, muhasebe_tamam: 0 };
  for (const r of rows) {
    const k = r.__kbsDurum;
    if (k && counts[k] != null) counts[k] += 1;
  }
  const warnings = [];
  if (counts.onay_bekliyor > 0) {
    warnings.push(`${counts.onay_bekliyor} satır henüz muhasebeye gönderilmemiş olabilir (yeşil).`);
  }
  return { counts, warnings };
}

function uzaCollectTables() {
  const seen = new WeakSet();
  const tables = [];
  const selectors = [
    '.k-grid-content table',
    '.dx-datagrid-rowsview table',
    'table[id*="grid" i]',
    'table[id*="liste" i]',
    'table[id*="personel" i]',
    'table.dataTable',
    'table.table',
    'table',
  ];
  for (const sel of selectors) {
    for (const table of document.querySelectorAll(sel)) {
      if (seen.has(table)) continue;
      seen.add(table);
      const data = uzaScrapeHtmlTable(table);
      if (data) tables.push(data);
    }
  }
  return tables;
}

function uzaPickBestTable(tables, kind, scrapeMode) {
  let best = null;
  for (const t of tables) {
    let score = t.score;
    const norms = t.headers.map(uzaNormHeader);
    if (kind === 'mebbis_puantaj' || scrapeMode === 'puantaj') {
      if (norms.some((h) => /veri\s*tip/.test(h))) score += 15;
      if (norms.some((h) => /toplam\s*saat|saat/.test(h))) score += 10;
      if (norms.filter((h) => /^gün\s*\d+|^gun\s*\d+/.test(h)).length >= 3) score += 20;
    }
    if (scrapeMode === 'bordro' || kind === 'kbs') {
      if (norms.some((h) => /net|brüt|kesinti|ödenecek/.test(h))) score += 25;
    }
    if (scrapeMode === 'veri_tipi') {
      if (norms.some((h) => /veri\s*tip/.test(h))) score += 30;
    }
    if (!best || score > best._score) {
      best = { ...t, _score: score };
    }
  }
  if (!best) return null;
  const cleanRows = best.rows.map((r) => {
    const o = { ...r };
    delete o.__kbsDurum;
    return o;
  });
  const status = uzaKbsStatusSummary(best.rows);
  return {
    headers: best.headers,
    rows: cleanRows,
    rowCount: cleanRows.length,
    kbsStatus: status,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'UZA_BORDRO_SCRAPE_PING') {
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type !== 'UZA_BORDRO_SCRAPE_PAGE') return;
  const tables = uzaCollectTables();
  const kind = msg.bordroType === 'mebbis_puantaj' ? 'mebbis_puantaj' : 'kbs';
  const table = uzaPickBestTable(tables, kind, msg.scrapeMode || '');
  sendResponse({
    ok: !!table,
    table,
    tablesFound: tables.length,
    pageTitle: document.title,
    url: location.href,
    kbsWarnings: table?.kbsStatus?.warnings || [],
    hint: table
      ? null
      : 'Personel listesi / Ek Ders Listesi (MaliNet) / bordro tablosu görünür ekranda olmalı.',
  });
  return true;
});
