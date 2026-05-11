/**
 * DB'deki eski kelebek sınav şablon metinlerini (Erzurum / Ali Bak / Ebubekir vb.) anonim demo ile değiştirir.
 * Kullanım: node tools/anonymize-butterfly-plan-rules.js
 *
 * Okul: name = 'Demo Okulu' → 'Ankara Çankaya Demo Lisesi'
 * Plan rules: cityLine, duzenleyen*, onaylayan*, reportFooterLines — bilinen legacy kalıplar
 */
require('dotenv').config();
const { Client } = require('pg');

const DEMO_SCHOOL_NAME = 'Ankara Çankaya Demo Lisesi';
const LEGACY_SCHOOL_NAME = 'Demo Okulu';

const DEFAULT_CITY_LINE = 'Ankara Valiliği\nÇankaya Demo Lisesi Müdürlüğü';
const DEFAULT_DUZENLEYEN = { name: 'Demo Düzenleyen', title: 'Müdür Yardımcısı' };
const DEFAULT_ONAYLAYAN = { name: 'Demo Onaylayan', title: 'Müdür' };

/** cityLine veya diğer alanlarda bu kalıplar varsa anonimleştirilir */
function shouldAnonymizeCityLine(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  if (/Erzurum ValiliğiErzurum/i.test(s)) return true;
  if (/Erzurum\s*Valiliği/i.test(s) && /Çok Programlı/i.test(s)) return true;
  if (/Erzurum/i.test(s) && /Müdürlüğü/i.test(s) && /(Anadolu Lisesi|Çok Programlı)/i.test(s)) return true;
  return false;
}

function shouldAnonymizeDuzenleyen(name) {
  if (typeof name !== 'string') return false;
  const t = name.trim().toLowerCase();
  return t === 'ali bak';
}

function shouldAnonymizeOnaylayan(name) {
  if (typeof name !== 'string') return false;
  const t = name.trim().toLowerCase();
  return t === 'ebubekir coşkun' || /^ebubekir\s+coşkun$/i.test(name.trim());
}

function anonymizeFooterLines(lines) {
  if (!Array.isArray(lines)) return { lines, changed: false };
  let changed = false;
  const next = lines.map((line) => {
    const s = String(line ?? '');
    if (shouldAnonymizeCityLine(s) || /Erzurum ValiliğiErzurum/i.test(s)) {
      changed = true;
      return s.replace(/Erzurum ValiliğiErzurum[^\n]*/gi, 'İl / okul bilgisi (demo)').replace(/\s+/g, ' ').trim() || '—';
    }
    return line;
  });
  return { lines: next, changed };
}

function patchRules(rules) {
  if (!rules || typeof rules !== 'object') return { rules, changed: false };
  const r = { ...rules };
  let changed = false;

  if (shouldAnonymizeCityLine(r.cityLine)) {
    r.cityLine = DEFAULT_CITY_LINE;
    changed = true;
  }
  if (shouldAnonymizeDuzenleyen(r.duzenleyenName)) {
    r.duzenleyenName = DEFAULT_DUZENLEYEN.name;
    r.duzenleyenTitle = DEFAULT_DUZENLEYEN.title;
    changed = true;
  }
  if (shouldAnonymizeOnaylayan(r.onaylayanName)) {
    r.onaylayanName = DEFAULT_ONAYLAYAN.name;
    r.onaylayanTitle = DEFAULT_ONAYLAYAN.title;
    changed = true;
  }

  const foot = anonymizeFooterLines(r.reportFooterLines);
  if (foot.changed) {
    r.reportFooterLines = foot.lines;
    changed = true;
  }

  return { rules: r, changed };
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
  });
  await client.connect();

  const schoolRes = await client.query(
    `UPDATE schools SET name = $1 WHERE name = $2 RETURNING id, name`,
    [DEMO_SCHOOL_NAME, LEGACY_SCHOOL_NAME],
  );
  if (schoolRes.rowCount) {
    console.log('Okul adı güncellendi:', schoolRes.rows.length, 'satır →', DEMO_SCHOOL_NAME);
  }

  const plans = await client.query(
    `SELECT id, school_id, rules FROM butterfly_exam_plans`,
  );
  let n = 0;
  for (const row of plans.rows) {
    const { rules, changed } = patchRules(row.rules);
    if (!changed) continue;
    await client.query(`UPDATE butterfly_exam_plans SET rules = $1::jsonb, updated_at = NOW() WHERE id = $2`, [
      JSON.stringify(rules),
      row.id,
    ]);
    n += 1;
    console.log('Plan rules güncellendi:', row.id);
  }

  console.log(n ? `Tamamlandı. ${n} plan güncellendi.` : 'Plan rules değişmedi (eşleşen legacy yok).');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
