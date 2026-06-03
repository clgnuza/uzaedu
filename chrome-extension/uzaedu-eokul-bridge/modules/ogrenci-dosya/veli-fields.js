function uzaVeliJoinNameFromDetay(detay, meta) {
  const d = detay && typeof detay === 'object' ? detay : {};
  const m = meta && typeof meta === 'object' ? meta : {};
  const fromDet = [String(d.VELIADI || '').trim(), String(d.VELISOYADI || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fromDet || String(m.YAKIN_ADI_SOYADI || '').trim();
}

function uzaVeliFlatFromDetay(anneDetay, babaDetay, anneMeta, babaMeta) {
  const a = anneDetay || {};
  const b = babaDetay || {};
  const join = (x, m) => uzaVeliJoinNameFromDetay(x, m);
  const t = (v) => String(v == null ? '' : v).trim();
  return {
    anneAdiSoyadi: join(a, anneMeta),
    anneCepTelefonu: t(a.CEP_TEL),
    anneEvTelefonu: t(a.EV_TEL),
    anneIsTelefonu: t(a.IS_TEL),
    anneEposta: t(a.EPOSTA),
    anneMeslek: t(a.MESLEK),
    babaAdiSoyadi: join(b, babaMeta),
    babaCepTelefonu: t(b.CEP_TEL),
    babaEvTelefonu: t(b.EV_TEL),
    babaIsTelefonu: t(b.IS_TEL),
    babaEposta: t(b.EPOSTA),
    babaMeslek: t(b.MESLEK),
  };
}

function uzaOgrDosyaGroups() {
  const meta = globalThis.UZA_BOOTSTRAP_CACHE?.menusMeta?.ogrenciDosyaBilgileriAl;
  return Array.isArray(meta?.groups) ? meta.groups : [];
}

function uzaOgrDosyaGroupById(groupId) {
  return uzaOgrDosyaGroups().find((g) => String(g?.id || '') === String(groupId || '')) || null;
}

function uzaOgrDosyaFieldsForGroup(groupId, kurumKey) {
  const g = uzaOgrDosyaGroupById(groupId);
  const list = g?.fieldsByKurum?.[kurumKey] || g?.fieldsByKurum?.ilkOgretim;
  return Array.isArray(list) ? list : [];
}

function uzaOgrDosyaResolveFieldIds(groupId, kurumKey, fieldIds) {
  const all = uzaOgrDosyaFieldsForGroup(groupId, kurumKey);
  const allowed = new Set(all.map((f) => String(f.id)));
  const picked = (Array.isArray(fieldIds) ? fieldIds : []).map(String).filter((id) => allowed.has(id));
  if (picked.length) return picked;
  return all.map((f) => String(f.id));
}

function uzaOgrDosyaCsvHeaders(groupId, kurumKey, fieldIds) {
  const ids = uzaOgrDosyaResolveFieldIds(groupId, kurumKey, fieldIds);
  const defs = uzaOgrDosyaFieldsForGroup(groupId, kurumKey);
  const byId = new Map(defs.map((f) => [String(f.id), String(f.label || f.id)]));
  return ids.map((id) => byId.get(id) || id);
}

async function uzaFetchVeliFlatForStudent(profile, ogrNo, state) {
  const nav = await uzaNavigateStudentDetail(profile, ogrNo, state);
  if (!nav.ok) return nav;
  const page = String(profile?.ogr02019 || '').trim();
  const warm = await uzaHtmlSessionFetch(page, { method: 'GET', refUrl: nav.detailUrl });
  if (uzaLooksLikeLoginPage(await warm.text())) return { ok: false, error: 'login' };
  const yk = await uzaFetchVeliYakinlar(profile, page);
  if (!yk.ok) return yk;
  const anne = yk.yakinlar.find((x) => String(x?.YAKINLIK || '') === '2');
  const baba = yk.yakinlar.find((x) => String(x?.YAKINLIK || '') === '1');
  let anneDetay = null;
  let babaDetay = null;
  if (anne?.YAKIN_ID) {
    const d = await uzaFetchVeliDetay(profile, page, anne.YAKIN_ID);
    if (d.ok) anneDetay = d.detay;
  }
  if (baba?.YAKIN_ID) {
    const d = await uzaFetchVeliDetay(profile, page, baba.YAKIN_ID);
    if (d.ok) babaDetay = d.detay;
  }
  return { ok: true, flat: uzaVeliFlatFromDetay(anneDetay, babaDetay, anne, baba) };
}
