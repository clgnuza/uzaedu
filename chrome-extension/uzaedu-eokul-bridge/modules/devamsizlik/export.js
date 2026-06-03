var uzaDevamsizlikExportLock = false;

function uzaFormatListeleDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function uzaDevamsizlikMenuMeta(kind) {
  const id = kind === 'ders' ? 'eyoklamaDersDevamsizlikAktar' : 'gunlukDevamsizlikAktar';
  return globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.[id] || {};
}

function uzaRowToApiOgrenci(r) {
  return {
    ogrenci_no: String(r.ogrenciNo || '').trim(),
    ad_soyad: String(r.adSoyad || '').trim(),
    sinif_sube: String(r.sinifSube || '').trim(),
    tc_kimlik: String(r.tcKimlik || '').trim(),
    tam_gun: !!r.tamGun,
    yarim_sabah: !!r.yarimSabah,
    yarim_oglen: !!r.yarimOglen,
    nobet: !!r.nobet,
    gec: !!r.gec,
    ders_yoklama: String(r.dersYoklama || '').trim(),
  };
}

async function uzaPostDevamsizlikImport(token, kind, body, schoolId) {
  const meta = uzaDevamsizlikMenuMeta(kind);
  const path =
    meta.importPath ||
    (kind === 'ders'
      ? '/eokul-bridge/v1/import/ders-devamsizlik'
      : '/eokul-bridge/v1/import/gunluk-devamsizlik');
  const payload = { ...body };
  if (schoolId) payload.school_id = schoolId;
  return uzaFetchJson(path, { method: 'POST', token, body: payload });
}

/**
 * @param {{ kind: 'gunluk'|'ders', tarihIso: string, sinifValues?: string[]|null, token: string, schoolId?: string }} opts
 */
async function uzaRunDevamsizlikExport(opts) {
  if (uzaDevamsizlikExportLock) return { ok: false, error: 'İşlem sürüyor.' };
  const kurumKey = uzaGetKurumKey();
  const listeleTarih = uzaFormatListeleDate(opts.tarihIso);
  if (!listeleTarih) return { ok: false, error: 'Geçersiz tarih.' };

  const profile = uzaProfileFromBootstrap(kurumKey);
  if (!profile?.okl08001) return { ok: false, error: 'Kurum profili yok.' };

  const scrapeMode = opts.kind === 'ders' ? 'ders_yoklama' : 'gunluk';
  uzaDevamsizlikExportLock = true;
  try {
    await uzaWarmOkl08001(profile);
    const turSync = await uzaEnsureOrtaOkulTurSync(profile, kurumKey, opts.okulAltTurValue);
    if (!turSync.ok) return turSync;
    const jd = await uzaOkl08001ResolveInitialData(profile, kurumKey);
    if (!jd.ok || !jd.options?.length) {
      if (jd.error === 'login') return { ok: false, error: 'OkulNet oturumu gerekli.' };
      return { ok: false, error: 'Sınıf listesi alınamadı.' };
    }
    const meta = {
      donemKodu: String(jd.donemKodu || '').trim(),
      kurumKodu: String(jd.kurumKodu || '').trim(),
      gununTarihi: String(jd.gununTarihi || '').trim(),
      _baseHtml: jd._baseHtml || null,
    };

    let options = jd.options;
    if (opts.sinifValues != null) {
      const allowed = new Set((opts.sinifValues || []).map((v) => String(v)));
      options = options.filter((o) => allowed.has(String(o.value)));
      if (!options.length) return { ok: false, error: 'Seçili sınıf bulunamadı.' };
    }

    const siniflar = [];
    for (const opt of options) {
      let rows = [];
      if (meta.donemKodu && meta.kurumKodu) {
        const lr = await uzaOkl08001PostListeleJson(profile, {
          donemKodu: meta.donemKodu,
          subeKodu: opt.value,
          tarih: listeleTarih,
          kurumKoduFrontend: meta.kurumKodu,
        });
        if (lr.ok) rows = uzaOkl08001ListeleJsonToDevamsizlikRows(lr.liste, scrapeMode);
        else if (lr.error === 'login') return { ok: false, error: 'OkulNet oturumu sona erdi.' };
      }
      if (!rows.length) {
        const h = await uzaOkl08001PostListeleHtml(
          profile,
          kurumKey,
          meta._baseHtml,
          opt.value,
          listeleTarih,
        );
        if (h.ok) {
          const scraped = uzaScrapeGunlukDevamsizlikFromHtml(h.html, scrapeMode, kurumKey);
          rows = uzaGunlukScrapeToApiRows(scraped, scrapeMode);
        } else if (h.error === 'login') {
          return { ok: false, error: 'OkulNet oturumu sona erdi.' };
        }
      }
      if (rows.length) {
        const ogrenciler = rows[0]?.ogrenci_no != null ? rows : rows.map(uzaRowToApiOgrenci);
        siniflar.push({ sinif_adi: opt.text, ogrenciler });
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!siniflar.length) return { ok: false, error: 'Devamsızlık kaydı bulunamadı.' };

    const data = await uzaPostDevamsizlikImport(
      opts.token,
      opts.kind,
      { tarih_iso: opts.tarihIso, siniflar },
      opts.schoolId || null,
    );
    return { ok: true, data, sinifCount: siniflar.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  } finally {
    uzaDevamsizlikExportLock = false;
  }
}
