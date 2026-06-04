var UZA_ORTA_OKUL_TUR_PACK_KEY = 'uzaOrtaOkulAltTur';
var UZA_OKUL_ALT_TUR_SECIM_KEY = 'uzaOkulAltTurSecim';

function uzaNormalizeOkulTurLabel(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function uzaPickOkulAltTurValue(options, preferLabel, selectedFromPage) {
  if (!options?.length) return '';
  const valid = new Set(options.map((o) => o.value));
  const sel = String(selectedFromPage || '').trim();
  if (sel && valid.has(sel)) return sel;
  const p = uzaNormalizeOkulTurLabel(preferLabel);
  if (p) {
    const exact = options.find((o) => uzaNormalizeOkulTurLabel(o.text) === p);
    if (exact) return exact.value;
    const part = options.find((o) => {
      const t = uzaNormalizeOkulTurLabel(o.text);
      return p.includes(t) || t.includes(p);
    });
    if (part) return part.value;
  }
  return options[0].value;
}

function uzaFindOkulAltTurSelect(doc) {
  return uzaDomQueryFirst(doc, 'okulAltTur.oklSelectSelectors');
}

function uzaExtractOkulAltTurPostTarget(rawHtml, selectEl) {
  const patterns = uzaDomPick('postback.eventTargetPatterns');
  if (Array.isArray(patterns)) {
    const s = String(rawHtml || '').replace(/\r?\n/g, ' ');
    for (const reStr of patterns) {
      if (!reStr) continue;
      try {
        const m = s.match(new RegExp(reStr, 'i'));
        if (m?.[1]) {
          return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }
      } catch {
        /* ignore */
      }
    }
  }
  const needleRe = uzaDomPick('postback.okulAltTurNeedle');
  const chunkMax = Number(uzaDomPick('postback.okulAltTurChunk')) || 14000;
  if (rawHtml && needleRe) {
    try {
      const idx = rawHtml.search(new RegExp(needleRe, 'i'));
      if (idx !== -1) {
        const chunk = rawHtml.slice(idx, Math.min(rawHtml.length, idx + chunkMax));
        const m = chunk.match(/__doPostBack\s*\(\s*['"]([^'"]+)['"]/i);
        if (m?.[1]) return m[1].replace(/&amp;/g, '&');
      }
    } catch {
      /* ignore */
    }
  }
  const id = selectEl?.id && String(selectEl.id).trim();
  if (id && id.includes('_')) return id.replace(/_/g, '$');
  return selectEl?.name ? String(selectEl.name).trim() : null;
}

function uzaScrapeOkulAltTurFromHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const sel = uzaFindOkulAltTurSelect(doc);
  if (!sel) return { ok: false, error: 'okulTurSelect' };
  const raw = Array.from(sel.options).map((o) => ({
    value: String(o.value || '').trim(),
    text: String(o.textContent || o.text || '')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
  const isSafe = (v) => /^\d{1,12}$/.test(v);
  const options = raw.filter((o) => o.value && o.value !== '-1' && isSafe(o.value));
  if (!options.length) return { ok: false, error: 'okulTurOptions' };
  const selectedRaw = String(sel.value || '').trim();
  const selectedFromPage =
    isSafe(selectedRaw) && options.some((o) => o.value === selectedRaw) ? selectedRaw : '';
  return { ok: true, options, selectedFromPage };
}

function uzaBuildOkulAltTurChangeBody(html, newValue, profile) {
  const kurumKey = 'ortaOgretim';
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const ddl = uzaFindOkulAltTurSelect(doc);
  if (!ddl?.name) return { ok: false, error: 'ddl' };
  const stem =
    String(uzaDomPick('okulAltTur.defaultOklMenuPageStem') || '').trim() ||
    `${profile?.oklPrefix || 'OOK'}01001`;
  const form =
    ddl.form ||
    uzaGetMainForm08001(doc, kurumKey) ||
    uzaDomQueryFirst(doc, 'exportPage.mainFormSelectors');
  if (!form) return { ok: false, error: 'form' };
  const params = new URLSearchParams();
  uzaAppendFormFields(params, form, ddl.name, String(newValue));
  const target = uzaExtractOkulAltTurPostTarget(html, ddl);
  if (!target) return { ok: false, error: 'postTarget' };
  params.set('__EVENTTARGET', target);
  params.set('__EVENTARGUMENT', '');
  return { ok: true, body: params.toString() };
}

async function uzaFetchOrtaOkulTurPage(profile) {
  const url = String(profile?.okl01001 || '').trim();
  if (!url) return { ok: false, error: 'okl01001' };
  const res = await uzaHtmlSessionFetch(url, { method: 'GET', refUrl: url });
  if (!res.ok) return { ok: false, error: String(res.status) };
  const html = await res.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  const scraped = await uzaScrapeOkulAltTurFromHtml(html);
  return { ok: true, html, ...scraped };
}

async function uzaFetchAndStoreOrtaOkulTurOptions(profile, preferLabel) {
  const page = await uzaFetchOrtaOkulTurPage(profile);
  if (!page.ok) return page;
  const defaultValue = uzaPickOkulAltTurValue(page.options, preferLabel, page.selectedFromPage);
  await chrome.storage.session.set({
    [UZA_ORTA_OKUL_TUR_PACK_KEY]: {
      options: page.options,
      defaultValue,
      at: Date.now(),
    },
  });
  if (defaultValue) {
    await chrome.storage.session.set({ [UZA_OKUL_ALT_TUR_SECIM_KEY]: defaultValue });
  }
  return { ok: true, options: page.options, defaultValue };
}

async function uzaPostOrtaOkulAltTurChange(profile, okulAltTurValue) {
  const url = String(profile?.okl01001 || '').trim();
  if (!url) return { ok: false, error: 'okl01001' };
  const g = await uzaHtmlSessionFetch(url, { method: 'GET', refUrl: url });
  if (!g.ok) return { ok: false, error: String(g.status) };
  let html = await g.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  const built = await uzaBuildOkulAltTurChangeBody(html, okulAltTurValue, profile);
  if (!built.ok) return { ok: false, error: built.error || 'body' };
  const post = await uzaHtmlSessionFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: built.body,
    refUrl: url,
  });
  if (!post.ok) return { ok: false, error: String(post.status) };
  html = await post.text();
  if (uzaLooksLikeLoginPage(html)) return { ok: false, error: 'login' };
  await chrome.storage.session.set({ [UZA_OKUL_ALT_TUR_SECIM_KEY]: String(okulAltTurValue) });
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true };
}

async function uzaEnsureOrtaOkulTurSync(profile, kurumKey, okulAltTurValue) {
  if (kurumKey !== 'ortaOgretim') return { ok: true };
  if (!profile?.okl01001) return { ok: true };
  const st = await chrome.storage.session.get([UZA_OKUL_ALT_TUR_SECIM_KEY, UZA_ORTA_OKUL_TUR_PACK_KEY]);
  let target = String(okulAltTurValue || st[UZA_OKUL_ALT_TUR_SECIM_KEY] || '').trim();
  if (!target) {
    target = String(st[UZA_ORTA_OKUL_TUR_PACK_KEY]?.defaultValue || '').trim();
  }
  if (!target) return { ok: true };

  const page = await uzaFetchOrtaOkulTurPage(profile);
  if (!page.ok) return page;
  const pageVal = String(page.selectedFromPage || '').trim();
  const first = String(page.options?.[0]?.value || '').trim();
  if (target === pageVal || (!pageVal && target === first)) return { ok: true };
  return uzaPostOrtaOkulAltTurChange(profile, target);
}
