/**
 * CLI: kaynak dosya + DB → placement JSON. Arayüz: Okul değerlendirme → Modül ayarları (GPT kartı).
 * Çalıştır: npm run placement-feed:gpt -- --source=kaynak.txt --out=out.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import OpenAI from 'openai';
import {
  SOURCE_MAX_PLACEMENT_GPT,
  chunkArray,
  mergeGptPlacementRows,
  runGptPlacementBatch,
  type GptPlacementRawRow,
  type GptPlacementSchoolLine,
} from '../schools/placement-gpt-extract-core';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const MODEL = process.env.PLACEMENT_GPT_MODEL?.trim() || 'gpt-4o-mini';

function parseArgs() {
  const a = process.argv.slice(2);
  let sourcePath = '';
  let outPath = path.join(process.cwd(), 'placement-feed-gpt-out.json');
  let schoolsJson: string | null = null;
  let batchSize = 12;
  let limit: number | null = null;
  let dryRun = false;
  for (const raw of a) {
    if (raw.startsWith('--source=')) sourcePath = raw.slice(9);
    else if (raw.startsWith('--out=')) outPath = raw.slice(6);
    else if (raw.startsWith('--schools-json=')) schoolsJson = raw.slice(15);
    else if (raw.startsWith('--batch-size=')) batchSize = Math.max(1, parseInt(raw.slice(13), 10) || 12);
    else if (raw.startsWith('--limit=')) {
      const n = parseInt(raw.slice(8), 10);
      limit = Number.isFinite(n) && n > 0 ? n : null;
    } else if (raw === '--dry-run') dryRun = true;
  }
  if (!sourcePath) {
    console.error('Gerekli: --source=dosya.txt');
    process.exit(1);
  }
  return { sourcePath, outPath, schoolsJson, batchSize, limit, dryRun };
}

async function loadSchoolsFromDb(lim: number | null): Promise<GptPlacementSchoolLine[]> {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE || 'ogretmenpro',
    options: '-c client_encoding=UTF8',
  });
  await client.connect();
  try {
    const limSql = lim != null ? ` LIMIT ${lim}` : '';
    const q =
      `SELECT id::text AS id, TRIM(institution_code) AS institution_code, name FROM schools
       WHERE institution_code IS NOT NULL AND length(trim(institution_code::text)) > 0
       ORDER BY name${limSql}`;
    const r = await client.query<{ id: string; institution_code: string; name: string }>(q);
    return r.rows.map((x) => ({ id: x.id, institution_code: x.institution_code, name: x.name || '' }));
  } finally {
    await client.end();
  }
}

function loadSchoolsFromJson(p: string): GptPlacementSchoolLine[] {
  const arr = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
  if (!Array.isArray(arr)) throw new Error('schools-json: dizi olmalı');
  const out: GptPlacementSchoolLine[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const code = String(o.institution_code ?? o.kurum_kodu ?? '').trim();
    if (!code) continue;
    const id = String(o.id ?? '').trim() || `cli:${code}:${out.length}`;
    out.push({ id, institution_code: code, name: String(o.name ?? '') });
  }
  return out;
}

async function main() {
  const { sourcePath, outPath, schoolsJson, batchSize, limit, dryRun } = parseArgs();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.error('OPENAI_API_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(sourcePath)) {
    console.error('Kaynak yok:', sourcePath);
    process.exit(1);
  }
  let sourceText = fs.readFileSync(sourcePath, 'utf8');
  if (sourceText.length > SOURCE_MAX_PLACEMENT_GPT) sourceText = sourceText.slice(0, SOURCE_MAX_PLACEMENT_GPT);

  const schools = schoolsJson ? loadSchoolsFromJson(schoolsJson) : await loadSchoolsFromDb(limit);
  if (!schools.length) {
    console.error('Okul listesi boş');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: key });
  const batches = chunkArray(schools, batchSize);
  const raw: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  console.log('Okul', schools.length, 'parti', batches.length, MODEL);
  for (let bi = 0; bi < batches.length; bi++) {
    process.stdout.write(`Parti ${bi + 1}/${batches.length} `);
    const { rows, warnings: w } = await runGptPlacementBatch(openai, MODEL, sourceText, batches[bi]);
    raw.push(...rows);
    warnings.push(...w.map((x) => `[${bi + 1}] ${x}`));
    console.log('→', rows.length);
  }

  const { rows: merged, merge_warnings } = mergeGptPlacementRows(raw);
  warnings.push(...merge_warnings.map((w) => `[merge] ${w}`));
  const payload = {
    auto_enable_dual_track: true,
    rows: merged.map((r) => ({
      institution_code: r.institution_code,
      year: r.year,
      ...(r.track_id ? { track_id: r.track_id } : {}),
      ...(r.track_title ? { track_title: r.track_title } : {}),
      ...(r.program ? { program: r.program } : {}),
      ...(r.language ? { language: r.language } : {}),
      with_exam: r.with_exam,
      without_exam: r.without_exam,
      ...(r.contingent != null ? { contingent: r.contingent } : {}),
      ...(r.tbs != null ? { tbs: r.tbs } : {}),
      ...(r.min_taban != null ? { min_taban: r.min_taban } : {}),
    })),
  };
  if (warnings.length) console.warn(warnings.slice(0, 25).join('\n'));
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Yazıldı:', outPath, payload.rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
