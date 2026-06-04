function uzaText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function uzaResolveOzur02012Table(doc) {
  const list = uzaDomPick('ozur02012.tableIds');
  const sels = Array.isArray(list)
    ? list
    : [uzaDomPick('ozur02012.tableId') || '#tblOzursuzDevamsizlik'];
  for (const sel of sels) {
    if (!sel) continue;
    try {
      const el = doc.querySelector(String(sel));
      if (el) return el;
    } catch {
      /* ignore */
    }
  }
  try {
    return (
      doc.querySelector('table[id*="Ozursuz" i]') ||
      doc.querySelector('#tblOzursuzDevamsizlikToplam')
    );
  } catch {
    return null;
  }
}

function uzaScrapeOgr02012OzursuzList(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = uzaResolveOzur02012Table(doc);
  const minTd = Number(uzaDomPick('ozur02012.minTdOzursuz')) || 5;
  const cS = Number(uzaDomPick('ozur02012.colSira')) || 2;
  const cT = Number(uzaDomPick('ozur02012.colTarih')) || 3;
  const cU = Number(uzaDomPick('ozur02012.colTur')) || 4;
  const headerSira = String(uzaDomPick('ozur02012.headerSiraLabel') || 'Sıra No');
  const rows = [];
  if (!table) {
    return { ok: true, okulNo: '', sinif: '', ad: '', soyad: '', rows };
  }
  const trs = table.querySelector('tbody') ? table.querySelectorAll('tbody > tr') : table.querySelectorAll('tr');
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 3) continue;
    let sira = '';
    let tarih = '';
    let tur = '';
    if (tds.length < minTd) {
      if (tds.length === 4) {
        sira = uzaText(tds[1]);
        tarih = uzaText(tds[2]);
        tur = uzaText(tds[3]);
      }
    } else {
      sira = uzaText(tds[cS]);
      tarih = uzaText(tds[cT]);
      tur = uzaText(tds[cU]);
      if (sira === headerSira) continue;
    }
    if (!tarih) continue;
    rows.push({ sira, tarih, tur });
  }
  const okulNo =
    uzaText(doc.querySelector('#IOMPageHeader1_lblNumara')) ||
    uzaText(doc.querySelector('#OOMPageHeader1_lblNumara')) ||
    uzaText(doc.querySelector('[id$="lblNumara"]')) ||
    uzaText(doc.querySelector('[id*="OkulNo" i]'));
  const ad =
    uzaText(doc.querySelector('#IOMPageHeader1_lblOgrenciAdi')) ||
    uzaText(doc.querySelector('#OOMPageHeader1_lblOgrenciAdi')) ||
    uzaText(doc.querySelector('[id$="lblOgrenciAdi"]')) ||
    uzaText(doc.querySelector('[id*="OgrenciAdi" i]'));
  const soyad =
    uzaText(doc.querySelector('#IOMPageHeader1_lblSoyadi')) ||
    uzaText(doc.querySelector('#OOMPageHeader1_lblSoyadi')) ||
    uzaText(doc.querySelector('[id$="lblSoyadi"]')) ||
    uzaText(doc.querySelector('[id*="Soyadi" i]'));
  const sinif =
    uzaText(doc.querySelector('#IOMPageHeader1_lblSinif')) ||
    uzaText(doc.querySelector('#IOMPageHeader1_lblSinifi')) ||
    uzaText(doc.querySelector('#OOMPageHeader1_lblSinif')) ||
    uzaText(doc.querySelector('[id$="lblSinif"]')) ||
    '';
  return { ok: true, okulNo, sinif, ad, soyad, rows };
}
