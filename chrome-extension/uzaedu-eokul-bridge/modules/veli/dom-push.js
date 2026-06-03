async function uzaWaitTabLoad(tabId, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    if (tab.status === 'complete') return true;
    await new Promise((r) => setTimeout(r, 350));
  }
  return false;
}

async function uzaTrySetVeliCepTelDom(tabId, profile, ogrNo, state, target, cepDisplay) {
  if (!tabId || !profile?.ogr02019) return { ok: false, error: 'tab' };
  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return nav;
  const page02019 = String(profile.ogr02019 || '').trim();
  const detailUrl = String(nav.detailUrl || profile.ogr02001 || page02019).trim();
  const yakinlik = String(target?.yakinlik || '').trim();
  const cep = String(cepDisplay || '').trim();
  if (!yakinlik || !cep) return { ok: false, error: 'param' };

  await chrome.tabs.update(tabId, { url: detailUrl });
  if (!(await uzaWaitTabLoad(tabId))) return { ok: false, error: 'yüklenmedi' };
  await chrome.tabs.update(tabId, { url: page02019 });
  if (!(await uzaWaitTabLoad(tabId))) return { ok: false, error: 'yüklenmedi' };

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (yk, cepVal) => {
      function norm(s) {
        return String(s || '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      function findYakinSelect() {
        for (const sel of document.querySelectorAll('select')) {
          const opts = [...sel.options];
          if (opts.some((o) => String(o.value).trim() === '1') && opts.some((o) => String(o.value).trim() === '2')) {
            return sel;
          }
        }
        return null;
      }
      function findCepInput() {
        for (const el of document.querySelectorAll('input')) {
          const t = String(el.type || 'text').toLowerCase();
          if (t === 'hidden' || t === 'checkbox' || t === 'radio') continue;
          const blob = `${el.name || ''} ${el.id || ''} ${el.getAttribute('placeholder') || ''}`.toLowerCase();
          if (/cep/.test(blob) && !/ev|iş|is|posta|mail/.test(blob)) return el;
        }
        return null;
      }
      function clickKaydet() {
        const nodes = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], a')];
        for (const n of nodes) {
          const txt = norm(n.textContent || n.value || '');
          if (/kaydet|güncelle|guncelle/i.test(txt)) {
            n.click();
            return true;
          }
        }
        return false;
      }
      const sel = findYakinSelect();
      if (!sel) return { ok: false, error: 'yakin_select' };
      sel.value = yk;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const inp = findCepInput();
      if (!inp) return { ok: false, error: 'cep_input' };
      inp.focus();
      inp.value = cepVal;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      if (!clickKaydet()) return { ok: false, error: 'kaydet_btn' };
      return { ok: true };
    },
    args: [yakinlik, cep],
  });
  if (!result?.ok) return { ok: false, error: result?.error || 'dom' };
  await new Promise((r) => setTimeout(r, 1200));
  return { ok: true, via: 'dom' };
}
