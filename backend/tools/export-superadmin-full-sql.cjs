/**
 * Yerel PostgreSQL → tek SQL (UPSERT / ON CONFLICT). Tüm public tablolar (FK sırası),
 * okullar, kullanıcılar, sınav görevi tercihleri/atamaları, duyurular, nöbet vb. dahil.
 *
 *   node tools/export-superadmin-full-sql.cjs ../full-mirror.sql
 *   node tools/export-superadmin-full-sql.cjs ../data.sql --skip-app-config
 *
 * UYARI: app_config sırlar içerir; --skip-app-config veya canlıda seçici import kullanın.
 * Tam ayna prod kullanıcılarının şifre/hash üzerine yazar — bilinçli kullanın.
 * Akış özeti: tools/DEPLOY-LOCAL-TO-PROD.txt
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

/** Sistem / dışlama */
const TABLE_BLACKLIST = new Set([
  'spatial_ref_sys',
  'geography_columns',
  'geometry_columns',
  'raster_columns',
  'raster_overviews',
  /** Yerelde TypeORM sync ile oluşmuş; canlıda migration yok — import patlamasın */
  'bilsem_plan_template',
  'bilsem_plan_template_content',
  /** Çok satır, user id güncellemesiyle FK kilitler — canlı ayna için gerekirse ayrı */
  'audit_logs',
]);

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

async function listPublicTables(client) {
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  return rows.map((r) => r.tablename).filter((t) => !TABLE_BLACKLIST.has(t));
}

/** pg_index tespiti kaçarsa elle (TypeORM unique) */
const CONFLICT_OVERRIDES = {
  extra_lesson_line_item_templates: ['key'],
  content_sources: ['key'],
  content_channels: ['key'],
  school_review_criteria: ['slug'],
  exam_duty_sync_sources: ['key'],
  extra_lesson_params: ['semester_code'],
};

/** UPSERT: PK yerine iş anahtarı (key, slug, semester_code) varsa çakışmayı ona göre çöz */
async function getConflictColumnsForUpsert(client, tableName, pkCols) {
  if (CONFLICT_OVERRIDES[tableName]) return CONFLICT_OVERRIDES[tableName];
  const { rows: conRows } = await client.query(
    `
    SELECT ARRAY_AGG(att.attname ORDER BY u.ord) AS cols
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
    WHERE nsp.nspname = 'public' AND rel.relname = $1 AND con.contype = 'u'
    GROUP BY con.oid
    `,
    [tableName],
  );
  /** TypeORM bazen UNIQUE INDEX ile constraint oluşturmaz — pg_index */
  const { rows: idxRows } = await client.query(
    `
    SELECT ARRAY_AGG(a.attname ORDER BY u.ord) AS cols
    FROM pg_index ix
    JOIN pg_class tbl ON tbl.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS u(attnum, ord) ON u.attnum > 0
    JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = u.attnum
    WHERE ix.indisunique AND NOT ix.indisprimary AND n.nspname = 'public' AND tbl.relname = $1
    GROUP BY ix.indexrelid
    `,
    [tableName],
  );
  const candidates = [...conRows, ...idxRows].map((r) => r.cols).filter(Boolean);
  const one = (name) => candidates.find((c) => c.length === 1 && c[0] === name);
  if (one('key')) return ['key'];
  if (one('slug')) return ['slug'];
  if (one('semester_code')) return ['semester_code'];
  return pkCols;
}

async function getPrimaryKeyColumns(client, tableName) {
  const { rows } = await client.query(
    `
    SELECT a.attname AS col
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = $1 AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum)
    `,
    [tableName],
  );
  return rows.map((r) => r.col);
}

/** child -> parent (FK hedefi), yalnızca public ve listedeki tablolar */
async function getFkEdges(client, tableSet) {
  const { rows } = await client.query(`
    SELECT
      c.conrelid::regclass::text AS child_raw,
      c.confrelid::regclass::text AS parent_raw
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE c.contype = 'f' AND ns.nspname = 'public'
  `);
  const edges = [];
  for (const r of rows) {
    const child = stripSchema(r.child_raw);
    const parent = stripSchema(r.parent_raw);
    if (!tableSet.has(child) || !tableSet.has(parent)) continue;
    if (child === parent) continue;
    edges.push([parent, child]);
  }
  return edges;
}

function stripSchema(name) {
  const s = String(name);
  const dot = s.indexOf('.');
  return dot >= 0 ? s.slice(dot + 1).replace(/"/g, '') : s.replace(/"/g, '');
}

/** Kahn: parent önce (edge: parent -> child) */
function topologicalSort(nodes, edges) {
  const nodeList = [...nodes];
  const adj = new Map();
  const indeg = new Map();
  for (const n of nodeList) {
    adj.set(n, []);
    indeg.set(n, 0);
  }
  for (const [a, b] of edges) {
    if (!adj.has(a) || !indeg.has(b)) continue;
    adj.get(a).push(b);
    indeg.set(b, indeg.get(b) + 1);
  }
  const q = [];
  for (const n of nodeList) {
    if (indeg.get(n) === 0) q.push(n);
  }
  q.sort();
  const out = [];
  while (q.length) {
    const u = q.shift();
    out.push(u);
    for (const v of adj.get(u) || []) {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) {
        q.push(v);
        q.sort();
      }
    }
  }
  if (out.length !== nodeList.length) {
    const miss = nodeList.filter((n) => !out.includes(n));
    throw new Error('FK döngüsü veya eksik düğüm; tablolar: ' + miss.join(', '));
  }
  return out;
}

async function getColumns(client, table) {
  const r = await client.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return r.rows;
}

async function hasSelfFk(client, table) {
  const { rows } = await client.query(
    `
    SELECT 1 FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE c.contype = 'f' AND ns.nspname = 'public' AND rel.relname = $1
      AND c.conrelid = c.confrelid
    LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

/** Tek tırnak / kaçış sorunları olmadan json/jsonb SQL literal */
function dollarJsonLiteral(val, cast) {
  let s;
  if (val !== null && typeof val === 'object' && !Buffer.isBuffer(val)) s = JSON.stringify(val);
  else if (typeof val === 'string') s = val;
  else s = JSON.stringify(val);
  let tag = 'jg' + crypto.randomBytes(10).toString('hex');
  while (s.includes('$' + tag + '$')) tag = 'jg' + crypto.randomBytes(10).toString('hex');
  return '$' + tag + '$' + s + '$' + tag + '$::' + cast;
}

function litJson(val, col) {
  if (val === null || val === undefined) return 'NULL';
  const dt = col.data_type;
  const udt = col.udt_name;
  if (dt === 'ARRAY') {
    if (!Array.isArray(val)) return esc(String(val)) + '::' + udt;
    const elem = udt?.startsWith('_') ? udt.slice(1) : 'text';
    const inner = val.map((x) => {
      if (x === null) return 'NULL';
      if (elem === 'uuid') return esc(String(x)) + '::uuid';
      if (elem === 'int4' || elem === 'int8') return String(x);
      return esc(String(x));
    });
    return 'ARRAY[' + inner.join(',') + ']::' + udt;
  }
  if (dt === 'boolean') return val === true || val === 'true' ? 'true' : 'false';
  if (dt === 'jsonb' || udt === 'jsonb') return dollarJsonLiteral(val, 'jsonb');
  if (dt === 'json' || udt === 'json') return dollarJsonLiteral(val, 'json');
  if (dt === 'integer' || dt === 'bigint' || dt === 'smallint') return String(parseInt(val, 10));
  if (dt === 'double precision' || dt === 'real' || dt === 'numeric') return String(val);
  if (dt === 'uuid' || (dt === 'USER-DEFINED' && udt === 'uuid')) return esc(String(val));
  if (dt === 'character varying' || dt === 'text' || dt === 'character') return esc(String(val));
  if (dt === 'date') {
    const s = typeof val === 'string' ? val : String(val);
    return esc(s.slice(0, 10)) + '::date';
  }
  if (dt === 'timestamp with time zone' || udt === 'timestamptz') {
    const s = typeof val === 'string' ? val : new Date(val).toISOString();
    return esc(s) + '::timestamptz';
  }
  if (dt === 'timestamp without time zone') {
    const s = typeof val === 'string' ? val : null;
    if (s) {
      const norm = s.includes('T') ? s.replace('T', ' ').replace(/\.\d{3}Z?$/, '').replace(/Z$/, '') : s;
      return esc(norm) + '::timestamp';
    }
    const d = new Date(val);
    const p = (n) => String(n).padStart(2, '0');
    return (
      esc(
        `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
          d.getUTCMinutes(),
        )}:${p(d.getUTCSeconds())}`,
      ) + '::timestamp'
    );
  }
  if (Buffer.isBuffer(val)) return esc('\\x' + val.toString('hex')) + '::bytea';
  return esc(String(val));
}

/**
 * self-FK: kökten derinliğe sıra (site_map_item vb.)
 */
async function selectRowsOrdered(client, table, colMap, pkCols) {
  const selfFk = await hasSelfFk(client, table);
  if (!selfFk) {
    const ob = pkCols.length ? pkCols.map((c) => `"${c}"`).join(', ') : '1';
    return client.query(`SELECT row_to_json(t) AS j FROM "${table}" AS t ORDER BY ${ob}`);
  }
  const { rows: fkcol } = await client.query(
    `
    SELECT a.attname AS child_col, af.attname AS parent_col
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN unnest(c.conkey, c.confkey) AS u(att, confatt) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.att
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = u.confatt
    WHERE c.contype = 'f' AND ns.nspname = 'public' AND rel.relname = $1 AND c.conrelid = c.confrelid
    LIMIT 1`,
    [table],
  );
  if (!fkcol.length) {
    const ob = pkCols.length ? pkCols.map((c) => `"${c}"`).join(', ') : '1';
    return client.query(`SELECT row_to_json(t) AS j FROM "${table}" AS t ORDER BY ${ob}`);
  }
  const { child_col } = fkcol[0];
  const pk0 = pkCols[0] || 'id';
  const sql = `
    WITH RECURSIVE tree AS (
      SELECT "${pk0}" AS tid, 0 AS depth FROM "${table}" WHERE "${child_col}" IS NULL
      UNION ALL
      SELECT s."${pk0}", t.depth + 1 FROM "${table}" s
      INNER JOIN tree t ON s."${child_col}" = t.tid
    )
    SELECT row_to_json(x) AS j FROM "${table}" x
    INNER JOIN tree ON tree.tid = x."${pk0}"
    ORDER BY tree.depth, x."${pk0}"`;
  try {
    return await client.query(sql);
  } catch {
    const ob = pkCols.length ? pkCols.map((c) => `"${c}"`).join(', ') : '1';
    return client.query(`SELECT row_to_json(t) AS j FROM "${table}" AS t ORDER BY ${ob}`);
  }
}

async function appendTableJson(client, lines, table, pkCols, colMap, patchRow) {
  const cols = await getColumns(client, table);
  const colNames = cols.map((c) => c.column_name);
  const cmap = Object.fromEntries(cols.map((c) => [c.column_name, c]));
  const { rows } = await selectRowsOrdered(client, table, colMap, pkCols);
  const conflictCols = await getConflictColumnsForUpsert(client, table, pkCols);
  lines.push(`-- ${table}; rows: ${rows.length}`);
  if (!pkCols.length) {
    lines.push('-- UYARI: PK yok, atlandı');
    return;
  }
  lines.push('BEGIN;');
  for (const { j: raw } of rows) {
    const j = { ...raw };
    if (patchRow) patchRow(j, table);
    const vals = colNames.map((cn) => litJson(j[cn], cmap[cn]));
    const quotedCols = colNames.map((c) => `"${c}"`).join(', ');
    const conflict = conflictCols.map((c) => `"${c}"`).join(', ');
    let updateCols = colNames.filter((c) => !conflictCols.includes(c));
    const conflictIsPk =
      conflictCols.length === pkCols.length && conflictCols.every((c, i) => c === pkCols[i]);
    if (!conflictIsPk) updateCols = updateCols.filter((c) => !pkCols.includes(c));
    const setClause = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
    if (!setClause) {
      lines.push(
        `INSERT INTO "${table}" (${quotedCols}) VALUES (${vals.join(', ')}) ON CONFLICT (${conflict}) DO NOTHING;`,
      );
    } else {
      lines.push(
        `INSERT INTO "${table}" (${quotedCols}) VALUES (${vals.join(', ')}) ON CONFLICT (${conflict}) DO UPDATE SET ${setClause};`,
      );
    }
  }
  lines.push('COMMIT;');
}

(async () => {
  const argv = process.argv.slice(2).filter((a) => a !== '--skip-app-config');
  const skipAppConfig = process.argv.includes('--skip-app-config');
  const outPath = argv[0]?.trim();

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();

  let tables = await listPublicTables(client);
  if (skipAppConfig) tables = tables.filter((t) => t !== 'app_config');

  const tableSet = new Set(tables);
  const edges = await getFkEdges(client, tableSet);
  const order = topologicalSort(tables, edges);

  const lines = [];
  lines.push('-- full DB mirror (public), FK sırası: ' + order.length + ' tablo');
  if (skipAppConfig) lines.push('-- app_config hariç (--skip-app-config)');
  lines.push('');

  const pkCache = new Map();
  for (const t of order) {
    pkCache.set(t, await getPrimaryKeyColumns(client, t));
  }

  for (const table of order) {
    const pkCols = pkCache.get(table) || [];
    try {
      await appendTableJson(client, lines, table, pkCols, {}, null);
    } catch (e) {
      lines.push(`-- HATA ${table}: ${e.message}`);
      console.error('Tablo atlandı:', table, e.message);
    }
    lines.push('');
  }

  const text = lines.join('\n');
  if (outPath) {
    fs.writeFileSync(outPath, Buffer.from(text, 'utf8'));
    console.error('Yazıldı:', path.resolve(outPath), Buffer.byteLength(text, 'utf8'), 'byte');
  } else {
    process.stdout.write(text);
  }
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
