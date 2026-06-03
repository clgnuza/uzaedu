function uzaText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function uzaScrapeOgr02012OzursuzList(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const tblSel = uzaDomPick('ozur02012.tableId') || '#tblOzursuzDevamsizlik';
  const table =
    doc.querySelector(tblSel) ||
    doc.querySelector('table[id*="Ozursuz" i]') ||
    doc.querySelector('#tblOzursuzDevamsizlikToplam');
  const minTd = Number(uzaDomPick('ozur02012.minTdOzursuz')) || 5;
  const cS = Number(uzaDomPick('ozur02012.colSira')) || 2;
  const cT = Number(uzaDomPick('ozur02012.colTarih')) || 3;
  const cU = Number(uzaDomPick('ozur02012.colTur')) || 4;
  const rows = [];
  if (!table) {
    return { ok: true, okulNo: '', sinif: '', ad: '', soyad: '', rows };
  }
  const trs = table.querySelector('tbody') ? table.querySelectorAll('tbody > tr') : table.querySelectorAll('tr');
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < Math.min(minTd, 4)) continue;
    let sira = '';
    let tarih = '';
    let tur = '';
    if (tds.length === 4) {
      sira = uzaText(tds[1]);
      tarih = uzaText(tds[2]);
      tur = uzaText(tds[3]);
    } else {
      sira = uzaText(tds[cS]);
      tarih = uzaText(tds[cT]);
      tur = uzaText(tds[cU]);
    }
    if (!tarih) continue;
    rows.push({ sira, tarih, tur });
  }
  const okulNo =
    uzaText(doc.querySelector('[id$="lblNumara"]')) ||
    uzaText(doc.querySelector('[id*="OkulNo" i]'));
  const ad =
    uzaText(doc.querySelector('[id$="lblOgrenciAdi"]')) ||
    uzaText(doc.querySelector('[id*="OgrenciAdi" i]'));
  const soyad =
    uzaText(doc.querySelector('[id$="lblSoyadi"]')) ||
    uzaText(doc.querySelector('[id*="Soyadi" i]'));
  const sinif = uzaText(doc.querySelector('[id$="lblSinif"]')) || '';
  return { ok: true, okulNo, sinif, ad, soyad, rows };
}
