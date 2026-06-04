var uzaIzinExportLock = false;

async function uzaScrapeIzinTablesFromTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function norm(s) {
        return String(s || '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      const out = [];
      const seen = new Set();
      for (const table of document.querySelectorAll('table')) {
        const trs = [...table.querySelectorAll('tr')];
        if (trs.length < 2) continue;
        let headerIdx = 0;
        let headers = [...trs[0].querySelectorAll('th,td')].map((c) => norm(c.textContent));
        if (!headers.some((h) => /izin|çıkış|evci|çarşı|dönüş/i.test(h))) {
          if (trs.length < 3) continue;
          headerIdx = 1;
          headers = [...trs[1].querySelectorAll('th,td')].map((c) => norm(c.textContent));
        }
        if (!headers.some((h) => /izin|çıkış|evci|çarşı|dönüş/i.test(h))) continue;
        const col = (re) => headers.findIndex((h) => re.test(h));
        const iName = col(/öğrenci.*ad|ad.*soyad|^ad$/i);
        const iNo = col(/okul.*no|öğrenci.*no|^no$/i);
        const iCls = col(/sınıf|şube|sinif/i);
        const iTur = col(/izin.*tür|tür|tur/i);
        const iCikis = col(/çıkış|pansiyon.*çıkış|cikis/i);
        const iDonus = col(/dönüş|pansiyon.*giriş|donus/i);
        if (iName < 0 && iNo < 0) continue;
        for (let ri = headerIdx + 1; ri < trs.length; ri++) {
          const cells = [...trs[ri].querySelectorAll('td')];
          if (!cells.length) continue;
          const g = (i) => (i >= 0 ? norm(cells[i]?.textContent) : '');
          const name = g(iName) || g(0);
          const no = g(iNo);
          if (!name && !no) continue;
          const key = `${no}|${name}|${g(iCikis)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            ogrenci_no: no,
            ad_soyad: name,
            sinif_adi: g(iCls),
            izin_turu: g(iTur) || 'Evci İzni',
            cikis: g(iCikis),
            donus: g(iDonus),
          });
        }
      }
      return out;
    },
  });
  return Array.isArray(result) ? result : [];
}

async function uzaRunIzinExport(opts) {
  if (uzaIzinExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  uzaIzinExportLock = true;
  try {
    const eokul = await uzaEokulTabReady();
    if (!eokul.ok || !eokul.tabs?.length) {
      return { ok: false, error: 'e-Okul sekmesi gerekli.' };
    }
    const tabId = eokul.tabs[0].id;
    const rows = await uzaScrapeIzinTablesFromTab(tabId);
    const filtered = rows.filter((r) => String(r.ad_soyad || '').trim());
    if (!filtered.length) {
      return {
        ok: false,
        error:
          'Tabloda izin satırı bulunamadı. e-Pansiyon → Evci ve Çarşı İzin Listesi raporunu açın.',
      };
    }
    const path =
      globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.evciCarsiIzin?.importPath ||
      '/eokul-bridge/v1/import/izin';
    const body = {
      rows: filtered,
      tarih_iso: opts.tarihIso || new Date().toISOString().slice(0, 10),
    };
    if (opts.schoolId) body.school_id = opts.schoolId;
    const data = await uzaFetchJson(path, { method: 'POST', token: opts.token, body });
    return { ok: true, data, rowCount: filtered.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaIzinExportLock = false;
  }
}
