function uzaKurumUsesIok08001(kurumKey) {
  return kurumKey === 'ilkOgretim' || kurumKey === 'okulOncesi';
}

function uzaFindIokClassSelect(doc) {
  try {
    const ddl = doc.querySelector('#ddlSinifiSube');
    if (ddl) return ddl;
  } catch {
    /* ignore */
  }
  const appSel = String(uzaDomPick('exportPage.classSelectAppFormControl') || '#app select.form-control');
  let candidates = [];
  try {
    candidates = doc.querySelectorAll(appSel);
  } catch {
    candidates = [];
  }
  for (const el of candidates) {
    const opt0 = el.options?.[0];
    if (!opt0) continue;
    const v = String(opt0.value || '').trim();
    const t = String(opt0.textContent || opt0.text || '')
      .trim()
      .toLowerCase();
    if (v === '-1' || t.includes('seçiniz')) return el;
  }
  return candidates[0] || null;
}

function uzaDomQueryFirst(doc, path) {
  const sels = uzaDomPick(path);
  if (!Array.isArray(sels)) {
    if (typeof sels === 'string') {
      try {
        return doc.querySelector(sels);
      } catch {
        return null;
      }
    }
    return null;
  }
  for (const sel of sels) {
    if (!sel) continue;
    try {
      const el = doc.querySelector(String(sel));
      if (el) return el;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function uzaFindListeleControl(doc) {
  const selList = String(uzaDomPick('listeleUi.clickableSelectorList') || 'input[type="submit"],input[type="image"],button');
  let candidates = [];
  try {
    candidates = doc.querySelectorAll(selList);
  } catch {
    candidates = [];
  }
  for (const el of candidates) {
    const v = String(el.value || el.alt || el.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^listele$/i.test(v)) return el;
    if (v.length < 48 && /listele/i.test(v)) return el;
  }
  return null;
}

function uzaParseOkl08001Page(html, kurumKey) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  let sel = null;
  if (kurumKey === 'ortaOgretim') {
    try {
      sel = doc.querySelector('#Us_SinifSube1_ddlSinifSube');
    } catch {
      sel = null;
    }
  }
  if (uzaKurumUsesIok08001(kurumKey)) {
    sel = uzaFindIokClassSelect(doc);
  }
  if (!sel) sel = uzaDomQueryFirst(doc, 'exportPage.classSelectSelectors');
  const form =
    sel?.form ||
    uzaDomQueryFirst(doc, 'exportPage.mainFormSelectors') ||
    doc.querySelector('form');
  const listEl = uzaFindListeleControl(doc);
  const pmName = String(uzaDomPick('exportPage.pageModeInputName') || 'pageMode');
  const hasPageMode = !!doc.querySelector(`[name="${pmName}"]`) || /name=["']pageMode/i.test(String(html || ''));
  return { doc, sel, form, listEl, hasPageMode, pmName };
}

function uzaAppendFormFields(params, form, ddlName, ddlValue) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const type = (el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset' || type === 'file') {
      continue;
    }
    if (el.tagName.toLowerCase() === 'select') {
      params.append(el.name, el.name === ddlName ? ddlValue : el.value);
    } else if (type === 'checkbox') {
      if (el.checked) params.append(el.name, el.value || 'on');
    } else if (type === 'radio') {
      if (el.checked) params.append(el.name, el.value);
    } else {
      params.append(el.name, el.value);
    }
  }
}

function uzaBuildListeleBody(parsed, ddlValue, rawHtml) {
  const { form, sel, listEl, hasPageMode, pmName } = parsed;
  const ddlName = sel?.name;
  if (!form || !ddlName) return { ok: false, error: 'form' };
  const params = new URLSearchParams();
  uzaAppendFormFields(params, form, ddlName, ddlValue);
  const pmVal = String(uzaDomPick('exportPage.listelePageModeValue') || 'listele');
  const subVal = String(uzaDomPick('exportPage.listeleSubmitValue') || 'Listele');
  if (hasPageMode) {
    params.set(pmName || 'pageMode', pmVal);
    params.set('__EVENTTARGET', '');
    params.set('__EVENTARGUMENT', '');
    return { ok: true, params };
  }
  if (!listEl) return { ok: false, error: 'listele' };
  const lt = (listEl.type || '').toLowerCase();
  if ((lt === 'submit' || lt === 'image') && listEl.name) {
    if (lt === 'image') {
      params.append(listEl.name, listEl.value || subVal);
      params.append(`${listEl.name}.x`, '1');
      params.append(`${listEl.name}.y`, '1');
    } else {
      params.append(listEl.name, listEl.value || subVal);
    }
  } else {
    params.set('__EVENTTARGET', '');
    params.set('__EVENTARGUMENT', '');
    params.append(listEl.name || 'btnListele', listEl.value || subVal);
  }
  return { ok: true, params };
}

function uzaScrapeOkl08001TableRows(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const ids = uzaDomPick('tableScrape.tableIds');
  let table = null;
  if (Array.isArray(ids)) {
    for (const sel of ids) {
      try {
        table = doc.querySelector(String(sel));
        if (table) break;
      } catch {
        /* ignore */
      }
    }
  }
  if (!table) return [];
  const minTd = Number(uzaDomPick('tableScrape.minTdCount')) || 5;
  const cS = Number(uzaDomPick('tableScrape.colSinif')) || 1;
  const cT = Number(uzaDomPick('tableScrape.colTc')) || 2;
  const cO = Number(uzaDomPick('tableScrape.colOgrNo')) || 3;
  const cA = Number(uzaDomPick('tableScrape.colAdSoyad')) || 4;
  const trs = table.querySelector('tbody') ? table.querySelectorAll('tbody > tr') : table.querySelectorAll('tr');
  const rows = [];
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < minTd) continue;
    const sinif = String(tds[cS]?.textContent || '').replace(/\s+/g, ' ').trim();
    const tc = String(tds[cT]?.textContent || '').replace(/\s+/g, ' ').trim();
    const ogrNo = String(tds[cO]?.textContent || '').replace(/\s+/g, ' ').trim();
    const adSoyad = String(tds[cA]?.textContent || '').replace(/\s+/g, ' ').trim();
    if (!ogrNo && !adSoyad) continue;
    rows.push([sinif, ogrNo, adSoyad]);
  }
  return rows;
}

async function uzaOkl08001FetchInitialDataHtml(profile, kurumKey) {
  const res = await uzaHtmlSessionFetch(profile.okl08001, { method: 'GET', refUrl: profile.okl08001 });
  if (!res.ok) return { ok: false, error: String(res.status) };
  const html = await res.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  const parsed = uzaParseOkl08001Page(html, kurumKey);
  if (!parsed.sel) return { ok: false, error: 'sube' };
  const ex = String(uzaDomPick('exportPage.optionExcludeValue') ?? '-1');
  const options = Array.from(parsed.sel.options)
    .map((o) => ({
      value: String(o.value || '').trim(),
      text: String(o.textContent || o.text || '')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter((o) => o.value && o.value !== ex && o.text);
  if (!options.length) return { ok: false, error: 'sube' };
  return {
    ok: true,
    options,
    donemKodu: '',
    kurumKodu: '',
    gununTarihi: '',
    _baseHtml: html,
  };
}

async function uzaOkl08001PostListeleHtml(profile, kurumKey, baseHtml, subeValue, tarihTr) {
  let html = baseHtml;
  if (!html) {
    const g = await uzaHtmlSessionFetch(profile.okl08001, { method: 'GET', refUrl: profile.okl08001 });
    if (!g.ok) return { ok: false, error: String(g.status) };
    html = await g.text();
  }
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  const parsed = uzaParseOkl08001Page(html, kurumKey);
  const built = uzaBuildListeleBody(parsed, subeValue, html);
  if (!built.ok) return { ok: false, error: built.error || 'listele' };
  if (tarihTr) {
    const fn = uzaKurumUsesIok08001(kurumKey)
      ? String(uzaDomPick('gunlukDevamsizlik.listeleDateFieldNameIok') || 'txtTarih')
      : String(uzaDomPick('gunlukDevamsizlik.listeleDateFieldName') || 'Us_tarih1$txtTarihGiris');
    built.params.set(fn, tarihTr);
  }
  const post = await uzaHtmlSessionFetch(profile.okl08001, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built.params.toString(),
    refUrl: profile.okl08001,
  });
  if (!post.ok) return { ok: false, error: String(post.status) };
  const listHtml = await post.text();
  if (uzaLooksLikeLoginPage(listHtml)) return { ok: false, error: 'login' };
  return { ok: true, rows: uzaScrapeOkl08001TableRows(listHtml), html: listHtml };
}

async function uzaOkl08001ResolveInitialData(profile, kurumKey) {
  const j = await uzaOkl08001FetchInitialDataJson(profile);
  if (j.ok) return j;
  if (uzaKurumUsesIok08001(kurumKey)) return j;
  return uzaOkl08001FetchInitialDataHtml(profile, kurumKey);
}

function uzaRowCheckboxChecked(tr, needle) {
  const n = String(needle || '').toLowerCase();
  for (const inp of tr.querySelectorAll('input[type="checkbox"]')) {
    const nm = String(inp.name || '').toLowerCase();
    if (!nm.includes(n)) continue;
    if (inp.disabled || inp.closest('.aspNetDisabled')) return false;
    return !!inp.checked;
  }
  return false;
}

function uzaRowHasEnabledCheckbox(tr) {
  for (const inp of tr.querySelectorAll('input[type="checkbox"]')) {
    if (inp.disabled || inp.closest('.aspNetDisabled')) continue;
    return true;
  }
  return false;
}

function uzaResolveGunlukGridTable(doc, kurumKey) {
  const ids = [];
  const byKurum = uzaDomPick('gunlukDevamsizlik.gridTableIds');
  if (byKurum && typeof byKurum === 'object' && byKurum[kurumKey]) {
    ids.push(String(byKurum[kurumKey]));
  }
  ids.push(String(uzaDomPick('gunlukDevamsizlik.gridTableId') || '#dgListem'));
  if (uzaKurumUsesIok08001(kurumKey)) {
    ids.push('#tbPageDataTable', '#dgListe');
  } else {
    ids.push('#dgListem', '#dgListe');
  }
  const seen = new Set();
  for (const sel of ids) {
    const s = String(sel || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    try {
      const t = doc.querySelector(s);
      if (t) return t;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function uzaGunlukCheckboxColIndex(key) {
  const cols = uzaDomPick('gunlukDevamsizlik.checkboxColIndex');
  if (cols && typeof cols === 'object' && cols[key] != null) {
    return Number(cols[key]);
  }
  const d = { tamGun: 5, yarimGun: 6, gec: 7 };
  return d[key] ?? 5;
}

function uzaRowCheckboxInColumn(tr, colIndex) {
  const tds = tr.querySelectorAll('td');
  const el = tds[colIndex]?.querySelector('input[type="checkbox"]');
  if (!el || el.disabled || el.closest('.aspNetDisabled')) return false;
  return !!el.checked;
}

function uzaReadGunlukRowFlags(tr, kurumKey) {
  if (uzaKurumUsesIok08001(kurumKey)) {
    const tamGun = uzaRowCheckboxInColumn(tr, uzaGunlukCheckboxColIndex('tamGun'));
    const yarimGun = uzaRowCheckboxInColumn(tr, uzaGunlukCheckboxColIndex('yarimGun'));
    const gec = uzaRowCheckboxInColumn(tr, uzaGunlukCheckboxColIndex('gec'));
    return {
      tamGun,
      yarimSabah: yarimGun,
      yarimOglen: false,
      nobet: false,
      gec,
    };
  }
  let yarimSabah = uzaRowCheckboxChecked(tr, 'chkyarimgunsabah');
  let yarimOglen = uzaRowCheckboxChecked(tr, 'chkyarimgunoglen');
  if (uzaRowCheckboxChecked(tr, 'chkyarimgun') && !yarimSabah && !yarimOglen) {
    yarimSabah = true;
  }
  return {
    tamGun: uzaRowCheckboxChecked(tr, 'chktamgun'),
    yarimSabah,
    yarimOglen,
    nobet: uzaRowCheckboxChecked(tr, 'chknobet'),
    gec: uzaRowCheckboxChecked(tr, 'chkgec'),
  };
}

function uzaScrapeGunlukDevamsizlikFromHtml(html, scrapeMode, kurumKey) {
  const mode = String(scrapeMode || 'gunluk').trim() || 'gunluk';
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = uzaResolveGunlukGridTable(doc, kurumKey);
  if (!table) return [];
  const minTd = Number(uzaDomPick('tableScrape.minTdCount')) || 5;
  const cS = Number(uzaDomPick('tableScrape.colSinif')) || 1;
  const cT = Number(uzaDomPick('tableScrape.colTc')) || 2;
  const cO = Number(uzaDomPick('tableScrape.colOgrNo')) || 3;
  const cA = Number(uzaDomPick('tableScrape.colAdSoyad')) || 4;
  const trs = table.querySelector('tbody') ? table.querySelectorAll('tbody > tr') : table.querySelectorAll('tr');
  const out = [];
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < minTd) continue;
    if (!uzaRowHasEnabledCheckbox(tr)) continue;
    const flags = uzaReadGunlukRowFlags(tr, kurumKey);
    const tamGun = flags.tamGun;
    const yarimSabah = flags.yarimSabah;
    const yarimOglen = flags.yarimOglen;
    const nobet = flags.nobet;
    const gec = flags.gec;
    const dersYoklama =
      mode === 'ders_yoklama'
        ? String(tds[tds.length - 1]?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
    if (mode === 'ders_yoklama') {
      if (!tamGun && !yarimSabah && !yarimOglen && !nobet && !gec && !dersYoklama) continue;
    } else if (!tamGun && !yarimSabah && !yarimOglen && !nobet && !gec) {
      continue;
    }
    out.push({
      sinifSube: String(tds[cS]?.textContent || '').replace(/\s+/g, ' ').trim(),
      tcKimlik: String(tds[cT]?.textContent || '').replace(/\s+/g, ' ').trim(),
      ogrenciNo: String(tds[cO]?.textContent || '').replace(/\s+/g, ' ').trim(),
      adSoyad: String(tds[cA]?.textContent || '').replace(/\s+/g, ' ').trim(),
      tamGun,
      yarimSabah,
      yarimOglen,
      nobet,
      gec,
      dersYoklama,
    });
  }
  return out;
}

function uzaGunlukScrapeToApiRows(scraped, scrapeMode) {
  return (scraped || []).map((r) => ({
    ogrenci_no: r.ogrenciNo,
    ad_soyad: r.adSoyad,
    sinif_sube: r.sinifSube,
    tc_kimlik: r.tcKimlik,
    tam_gun: !!r.tamGun,
    yarim_sabah: !!r.yarimSabah,
    yarim_oglen: !!r.yarimOglen,
    nobet: !!r.nobet,
    gec: !!r.gec,
    ders_yoklama: scrapeMode === 'ders' ? String(r.dersYoklama || '').trim() : '',
  }));
}

const UZA_TOZ_TYPE_ORDER = ['t', 'y', 's', 'o', 'n', 'g'];

function uzaTopluOzursuzActiveTypes(kurumKey) {
  if (kurumKey === 'ortaOgretim') return new Set(['t', 's', 'o', 'n', 'g']);
  return new Set(['t', 'y', 'g']);
}

function uzaGetOkl08001FormPrefix(kurumKey) {
  return uzaKurumUsesIok08001(kurumKey) ? 'IOK08001' : 'OOK08001';
}

function uzaGetMainForm08001(doc, kurumKey) {
  const prefix = uzaGetOkl08001FormPrefix(kurumKey);
  const forms = doc.querySelectorAll('form');
  for (const f of forms) {
    const id = String(f.id || '');
    const name = String(f.name || '');
    if (id.includes(prefix) || name.includes(prefix)) return f;
  }
  return (
    uzaDomQueryFirst(doc, 'exportPage.mainFormSelectors') ||
    doc.querySelector('form#aspnetForm') ||
    doc.querySelector('form')
  );
}

function uzaRowCheckboxMeta(tr, needle, excludePrefixes) {
  const n = String(needle || '').toLowerCase();
  const ex = Array.isArray(excludePrefixes) ? excludePrefixes : [];
  for (const inp of tr.querySelectorAll('input[type="checkbox"]')) {
    const nm = String(inp.name || '').toLowerCase();
    if (!nm.includes(n)) continue;
    if (ex.some((p) => nm.includes(String(p || '').toLowerCase()))) continue;
    const enabled = !(inp.disabled || inp.closest('.aspNetDisabled'));
    return { name: inp.name, checked: !!inp.checked, enabled };
  }
  return { name: '', checked: false, enabled: false };
}

function uzaTopluResolvePendingTypeForNo(ogrNo, pendingByType, activeTypes) {
  const no = String(ogrNo || '').replace(/\D/g, '');
  if (!no) return '';
  for (const type of UZA_TOZ_TYPE_ORDER) {
    if (!activeTypes.has(type)) continue;
    if (pendingByType[type]?.has(no)) return type;
  }
  return '';
}

function uzaTopluResolveRowTarget(row, pendingByType, activeTypes) {
  const ogrNo = String(row?.ogrNo || '').replace(/\D/g, '');
  if (!ogrNo) return null;
  for (const type of UZA_TOZ_TYPE_ORDER) {
    if (!activeTypes.has(type)) continue;
    if (!pendingByType[type]?.has(ogrNo)) continue;
    const cb = row.checkboxes?.[type];
    if (!cb?.enabled || !cb?.name) continue;
    return { type, ogrNo, cb };
  }
  return null;
}

function uzaTopluConflictNames(row, targetType) {
  const out = [];
  const cbs = row?.checkboxes || {};
  for (const type of UZA_TOZ_TYPE_ORDER) {
    if (type === targetType) continue;
    const cb = cbs[type];
    if (!cb?.name || !cb.checked) continue;
    out.push(cb.name);
  }
  return out;
}

function uzaApplyTopluTypesToHtmlRows(rows, pendingByType, activeTypes) {
  const toCheck = [];
  const toUncheck = [];
  let matched = 0;
  const blockedNumbers = [];
  for (const row of rows || []) {
    const rowNo = String(row.ogrNo || '').replace(/\D/g, '');
    const pendingType = uzaTopluResolvePendingTypeForNo(rowNo, pendingByType, activeTypes);
    if (pendingType) {
      const desired = row.checkboxes?.[pendingType];
      if (desired?.name && !desired.enabled) {
        pendingByType[pendingType].delete(rowNo);
        blockedNumbers.push(rowNo);
        continue;
      }
    }
    const target = uzaTopluResolveRowTarget(row, pendingByType, activeTypes);
    if (!target) continue;
    if (!target.cb.checked) toCheck.push(target.cb.name);
    for (const n of uzaTopluConflictNames(row, target.type)) toUncheck.push(n);
    pendingByType[target.type].delete(target.ogrNo);
    matched += 1;
  }
  return {
    changed: toCheck.length > 0 || toUncheck.length > 0,
    matched,
    blockedNumbers,
    toCheck,
    toUncheck,
  };
}

function uzaGunlukWantType(want, kurumKey) {
  if (!want) return '';
  if (want.tam_gun) return 't';
  if (kurumKey === 'ortaOgretim') {
    if (want.yarim_sabah) return 's';
    if (want.yarim_oglen) return 'o';
    if (want.nobet) return 'n';
  } else if (want.yarim_sabah || want.yarim_oglen) {
    return 'y';
  }
  if (want.gec) return 'g';
  return '';
}

function uzaApplyGunlukWriteToHtmlRows(rows, byNo, kurumKey) {
  const toCheck = [];
  const toUncheck = [];
  let matched = 0;
  let blocked = 0;
  for (const row of rows || []) {
    const no = String(row.ogrNo || '').replace(/\D/g, '');
    const want = byNo.get(no);
    if (!want) continue;
    const targetType = uzaGunlukWantType(want, kurumKey);
    if (!targetType) {
      byNo.delete(no);
      continue;
    }
    const cb = row.checkboxes?.[targetType];
    if (!cb?.enabled || !cb?.name) {
      blocked += 1;
      byNo.delete(no);
      continue;
    }
    matched += 1;
    if (!cb.checked) toCheck.push(cb.name);
    for (const n of uzaTopluConflictNames(row, targetType)) toUncheck.push(n);
    byNo.delete(no);
  }
  return {
    changed: toCheck.length > 0 || toUncheck.length > 0,
    matched,
    blocked,
    toCheck,
    toUncheck,
  };
}

function uzaRowDersSelectMeta(tr) {
  for (const sel of tr.querySelectorAll('select')) {
    if (sel.disabled || sel.closest('.aspNetDisabled')) continue;
    const name = String(sel.name || '').trim();
    if (!name) continue;
    return { name, value: String(sel.value || '').trim(), enabled: true };
  }
  return { name: '', value: '', enabled: false };
}

function uzaScrapeGunlukGridEditableRows(html, kurumKey, mode) {
  const scrapeMode = mode === 'ders_yoklama' ? 'ders_yoklama' : 'gunluk';
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = uzaResolveGunlukGridTable(doc, kurumKey);
  if (!table) return { ok: false, code: 'gunlukTableMissing', rows: [] };
  const minTd = Number(uzaDomPick('tableScrape.minTdCount')) || 5;
  const cO = Number(uzaDomPick('tableScrape.colOgrNo')) || 3;
  const cA = Number(uzaDomPick('tableScrape.colAdSoyad')) || 4;
  const trs = table.querySelector('tbody') ? table.querySelectorAll('tbody > tr') : table.querySelectorAll('tr');
  const rows = [];
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < minTd) continue;
    if (!uzaRowHasEnabledCheckbox(tr) && !uzaRowDersSelectMeta(tr).enabled) continue;
    const ogrNo = String(tds[cO]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\D/g, '');
    const adSoyad = String(tds[cA]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!ogrNo && !adSoyad) continue;
    let cbT = uzaRowCheckboxMeta(tr, 'chktamgun');
    let cbG = uzaRowCheckboxMeta(tr, 'chkgec');
    let cbN = uzaRowCheckboxMeta(tr, 'chknobet');
    let cbS = uzaRowCheckboxMeta(tr, 'chkyarimgunsabah');
    let cbO = uzaRowCheckboxMeta(tr, 'chkyarimgunoglen');
    let cbY = uzaRowCheckboxMeta(tr, 'chkyarimgun', ['chkyarimgunsabah', 'chkyarimgunoglen']);
    if (uzaKurumUsesIok08001(kurumKey)) {
      const flags = uzaReadGunlukRowFlags(tr, kurumKey);
      const mk = (checked) => ({ name: '', checked: !!checked, enabled: true });
      cbT = mk(flags.tamGun);
      cbY = mk(flags.yarimSabah);
      cbG = mk(flags.gec);
      cbS = { name: '', checked: false, enabled: false };
      cbO = { name: '', checked: false, enabled: false };
      cbN = { name: '', checked: false, enabled: false };
    }
    const row = {
      ogrNo,
      adSoyad,
      checkboxes: {
        t: cbT,
        y: cbY || { name: '', checked: false, enabled: false },
        s: cbS,
        o: cbO,
        n: cbN,
        g: cbG,
      },
    };
    if (scrapeMode === 'ders_yoklama') {
      row.dersSelect = uzaRowDersSelectMeta(tr);
      const t = String(tds[tds.length - 1]?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      row.dersYoklamaText = t;
    }
    rows.push(row);
  }
  return { ok: true, rows };
}

function uzaScrapeOzursuzEditableRows(html, kurumKey) {
  return uzaScrapeGunlukGridEditableRows(html, kurumKey, 'gunluk');
}

function uzaApplyDersYoklamaWriteToHtmlRows(rows, byNo) {
  const selectSets = [];
  let matched = 0;
  let blocked = 0;
  for (const row of rows || []) {
    const no = String(row.ogrNo || '').replace(/\D/g, '');
    const want = byNo.get(no);
    if (!want) continue;
    const code = String(want.ders_yoklama || '').trim();
    if (!code) {
      byNo.delete(no);
      continue;
    }
    const sel = row.dersSelect;
    if (!sel?.enabled || !sel?.name) {
      blocked += 1;
      byNo.delete(no);
      continue;
    }
    selectSets.push({ name: sel.name, value: code });
    matched += 1;
    byNo.delete(no);
  }
  return { changed: selectSets.length > 0, matched, blocked, selectSets };
}

function uzaBuild08001KaydetBody(html, namesToCheck, namesToUncheck, kurumKey, selectSets) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const form = uzaGetMainForm08001(doc, kurumKey);
  if (!form) return { ok: false, error: 'form' };
  const checks = new Set((namesToCheck || []).map((x) => String(x || '')).filter(Boolean));
  const unchecks = new Set((namesToUncheck || []).map((x) => String(x || '')).filter(Boolean));
  const selectOverride = new Map();
  for (const s of selectSets || []) {
    if (s?.name) selectOverride.set(String(s.name), String(s.value ?? ''));
  }
  const touchedHdn = new Set();
  const markHdn = (cbName) => {
    const n = String(cbName || '');
    if (!n) return;
    const h = n
      .replace(/\$chkTamGun$/i, '$hdnSecim')
      .replace(/\$chkYarimGun$/i, '$hdnSecim')
      .replace(/\$chkYarimGunSabah$/i, '$hdnSecim')
      .replace(/\$chkYarimGunOglen$/i, '$hdnSecim')
      .replace(/\$chkNobet$/i, '$hdnSecim')
      .replace(/\$chkGec$/i, '$hdnSecim');
    if (h !== n) touchedHdn.add(h);
  };
  checks.forEach(markHdn);
  unchecks.forEach(markHdn);
  const params = new URLSearchParams();
  for (const el of form.elements) {
    if (!el?.name) continue;
    const tag = String(el.tagName || '').toLowerCase();
    const type = String(el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset' || type === 'file') {
      continue;
    }
    if (tag === 'select') {
      params.append(el.name, selectOverride.has(el.name) ? selectOverride.get(el.name) : el.value);
      continue;
    }
    if (tag === 'textarea') {
      params.append(el.name, el.value);
      continue;
    }
    if (type === 'checkbox') {
      if (unchecks.has(el.name) && !checks.has(el.name)) continue;
      if (el.checked || checks.has(el.name)) params.append(el.name, el.value || 'on');
      continue;
    }
    if (type === 'radio') {
      if (el.checked) params.append(el.name, el.value);
      continue;
    }
    params.append(el.name, el.value);
  }
  params.set('hiddenKaydet', 'Kaydet');
  params.set('pageMode', 'boş');
  touchedHdn.forEach((name) => params.set(name, '1'));
  return { ok: true, body: params.toString() };
}

async function uzaOkl08001KaydetHtml(profile, kurumKey, html, namesToCheck, namesToUncheck, selectSets) {
  const built = uzaBuild08001KaydetBody(html, namesToCheck, namesToUncheck, kurumKey, selectSets);
  if (!built.ok) return { ok: false, error: built.error || 'kaydet' };
  const res = await uzaHtmlSessionFetch(profile.okl08001, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built.body,
    refUrl: profile.okl08001,
  });
  if (!res.ok) return { ok: false, error: String(res.status) };
  const outHtml = await res.text();
  if (uzaLooksLikeLoginPage(outHtml)) return { ok: false, error: 'login' };
  return { ok: true, html: outHtml };
}

async function uzaOkl08001FetchClassStudentRows(profile, kurumKey, meta, opt, listeleTarih) {
  if (meta.donemKodu && meta.kurumKodu) {
    const lr = await uzaOkl08001PostListeleJson(profile, {
      donemKodu: meta.donemKodu,
      subeKodu: opt.value,
      tarih: meta.gununTarihi || listeleTarih || '',
      kurumKoduFrontend: meta.kurumKodu,
    });
    if (lr.ok && lr.liste?.length) {
      return { ok: true, rows: uzaOkl08001ListeleJsonToStudentRows(lr.liste), mode: 'json' };
    }
    if (uzaKurumUsesIok08001(kurumKey)) return { ok: false, error: lr.error || lr.mesaj || 'listele' };
  }
  const h = await uzaOkl08001PostListeleHtml(
    profile,
    kurumKey,
    meta._baseHtml || null,
    opt.value,
    listeleTarih,
  );
  if (!h.ok) return h;
  return { ok: true, rows: h.rows, mode: 'html' };
}
