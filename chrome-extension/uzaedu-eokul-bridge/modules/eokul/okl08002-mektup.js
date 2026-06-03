function uzaDm08002AppendForm(form) {
  const params = new URLSearchParams();
  for (const el of form.elements) {
    if (!el.name) continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'image' || type === 'reset') continue;
    if (type === 'file') continue;
    if (tag === 'select') params.append(el.name, el.value);
    else if (tag === 'textarea') params.append(el.name, el.value);
    else if (type === 'checkbox') {
      if (el.checked) params.append(el.name, el.value || 'on');
    } else if (type === 'radio') {
      if (el.checked) params.append(el.name, el.value);
    } else params.append(el.name, el.value);
  }
  return params;
}

function uzaBuildMektup08002ListeleBody(html, uyariDilimi, tarihDdMmYyyy) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const form = doc.querySelector('form#aspnetForm') || doc.querySelector('form');
  if (!form) return { ok: false, error: 'form' };
  const params = uzaDm08002AppendForm(form);
  params.set('ddlUyariDilimi', String(uyariDilimi || '1'));
  const tarih = String(tarihDdMmYyyy || '').trim();
  if (tarih) {
    params.set('txtTarih', tarih);
    if (params.has('hdnTarihKontrol')) params.set('hdnTarihKontrol', tarih);
  }
  params.set('btnListele', 'Listele');
  return { ok: true, body: params.toString() };
}

function uzaScrapeMektup08002Grid(html, includeSent) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = doc.querySelector('#dgListe');
  if (!table) return { ok: false, error: 'table', rows: [] };
  const rows = [];
  for (const tr of table.querySelectorAll('tbody tr')) {
    if (tr.querySelector('td.frmListBaslik')) continue;
    const tds = tr.querySelectorAll('td');
    if (tds.length < 8) continue;
    const chkG = tr.querySelector('input[type="checkbox"][name*="chkGonderildi"]:not([name*="Tumu"])');
    const gonderildi = chkG ? !!chkG.checked : false;
    if (!includeSent && gonderildi) continue;
    const ogrenciNo = String(tds[2]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const ogrenciAdiSoyadi = String(tds[4]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const ogrenciSinifi = String(tds[1]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const toplamDevamsizlik = String(tds[5]?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!ogrenciNo && !ogrenciAdiSoyadi) continue;
    rows.push({ ogrenciNo, ogrenciAdiSoyadi, ogrenciSinifi, toplamDevamsizlik });
  }
  return { ok: true, rows };
}

function uzaTodayDdMmYyyy() {
  const x = new Date();
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}

async function uzaWarmOkl08002(profile) {
  const url = String(profile?.okl08002 || '').trim();
  if (!url) throw new Error('okl08002');
  const res = await uzaHtmlSessionFetch(url, { method: 'GET', refUrl: url });
  const text = await res.text();
  if (uzaLooksLikeLoginPage(text)) throw new Error('login');
  if (!res.ok) throw new Error(String(res.status));
  return text;
}
