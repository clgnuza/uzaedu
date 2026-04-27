import OpenAI from 'openai';

export const SOURCE_MAX_PLACEMENT_GPT = 150_000;

/**
 * Uzun yapıştırma / tam sayfa: menü ve gürültü satırlarını atıp yalnız tablo benzeri `|` (ve kazanabilirsin TSV)
 * satırlarını GPT’ye gönderir — token ve önizleme süresi ciddi düşer. Tüm `source_scores_in_table` kapsamları.
 */
export function narrowSourceTextForPlacementGpt(sourceText: string, _sourceTableScope: GptSourceTableScope): string {
  const lines = sourceText.split(/\r?\n/);
  const kept: string[] = [];
  const sep = (ln: string) => {
    const t = ln.trim();
    return /^\|[\s\-:|]+\|$/u.test(t) || /^[\|\s\-:]+$/u.test(t.replace(/\|/g, ''));
  };
  for (const raw of lines) {
    const pipes = (raw.match(/\|/g) ?? []).length;
    if (pipes >= 2) {
      if (sep(raw) || /okul|taban|yıl|kont|obp|puan|ilçe/i.test(raw) || (pipes >= 4 && /\d/.test(raw))) {
        kept.push(raw);
      }
      continue;
    }
    /** kazanabilirsin TSV: «İl / İlçe / Okul…» + tab — | olmadan da GPT’ye gitsin */
    if (raw.includes('\t')) {
      const head = (raw.split('\t')[0] ?? '').trim();
      if (head.includes('/') && (head.match(/\//g) ?? []).length >= 2) kept.push(raw);
    }
  }
  const out = kept.join('\n').trim();
  return out.length >= 500 ? out : sourceText;
}

function stripPlacementSinavParenForEvidence(s: string): string {
  return s
    .replace(/\(\s*Sınavlı\s*\)/giu, ' ')
    .replace(/\(\s*Sınavsız\s*\)/giu, ' ')
    .replace(/\(\s*SINAVLI\s*\)/gu, ' ')
    .replace(/\(\s*SINAVSIZ\s*\)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normTrEvidence(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['’]/g, "'")
    .replace(/\u00EE|\u00CE/g, 'i')
    .replace(/\u00E2|\u00C2/g, 'a')
    .replace(/\u00FB|\u00DB/g, 'u')
    .toLocaleLowerCase('tr');
}

function trackPathTailMatchesDbName(trackTitle: string | null, dbName: string): boolean {
  const dbRaw = (dbName ?? '').trim();
  if (!dbRaw) return false;
  const tt = stripPlacementSinavParenForEvidence((trackTitle ?? '').trim());
  if (!tt.includes('/')) return true;
  const segs = tt.split('/').map((x) => x.trim()).filter(Boolean);
  if (segs.length < 3) return true;
  const pathSchool = normTrEvidence(stripPlacementSinavParenForEvidence(segs.slice(2).join(' / '))).replace(/\s+/g, ' ');
  const db = normTrEvidence(dbRaw).replace(/\s+/g, ' ');
  if (pathSchool.length < 6 || db.length < 6) return true;
  if (pathSchool.includes(db) || db.includes(pathSchool)) return true;
  const wa = pathSchool.split(' ').filter((w) => w.length >= 5);
  const wb = db.split(' ').filter((w) => w.length >= 5);
  if (!wa.length || !wb.length) return false;
  let inter = 0;
  for (const a of wa) {
    for (const b of wb) {
      if (a === b || a.includes(b) || b.includes(a)) {
        inter += 1;
        break;
      }
    }
  }
  const need = Math.min(wa.length, wb.length) <= 2 ? 1 : 2;
  return inter >= need;
}

function rowHasPlacementSourceEvidence(
  schoolName: string,
  trackTitle: string | null,
  srcNorm: string,
): boolean {
  const db = normTrEvidence(schoolName).replace(/\s+/g, ' ');
  const track = stripPlacementSinavParenForEvidence((trackTitle ?? '').trim());
  const tr = normTrEvidence(track).replace(/\s+/g, ' ');
  if (!db.length) return tr.length >= 14 && srcNorm.includes(tr);

  const dbInSrc = db.length >= 7 && srcNorm.includes(db);
  const trackInSrc = tr.length >= 14 && srcNorm.includes(tr);

  if (dbInSrc) {
    if (!track.includes('/')) return true;
    return trackPathTailMatchesDbName(track, schoolName);
  }
  if (trackInSrc && trackPathTailMatchesDbName(track, schoolName)) return true;

  if (db.length >= 6) {
    const words = db.split(' ').filter((w) => w.length >= 6);
    if (words.length >= 2) {
      const hits = words.filter((w) => srcNorm.includes(w));
      if (hits.length >= 2) return true;
    }
    if (words.length === 1 && words[0]!.length >= 8 && srcNorm.includes(words[0]!)) return true;
  }
  return false;
}

/**
 * GPT veya zayıf path eşlemesiyle kaynakta geçmeyen kurumlara puan yazılmasını engeller.
 */
export function filterGptPlacementRowsBySourceText(
  rows: GptPlacementRawRow[],
  sourceText: string,
  institutionCodeToSchoolName: ReadonlyMap<string, string>,
): { rows: GptPlacementRawRow[]; dropped: number; warnings: string[] } {
  const srcNorm = normTrEvidence(sourceText).replace(/\s+/g, ' ');
  if (!srcNorm.length) return { rows: [...rows], dropped: 0, warnings: [] };

  const kept: GptPlacementRawRow[] = [];
  const warnings: string[] = [];
  let dropped = 0;
  for (const r of rows) {
    const dbName = (institutionCodeToSchoolName.get(r.institution_code) ?? '').trim();
    if (!dbName.trim() && !(r.track_title ?? '').trim()) {
      dropped += 1;
      continue;
    }
    if (rowHasPlacementSourceEvidence(dbName, r.track_title, srcNorm)) {
      kept.push(r);
    } else {
      dropped += 1;
      if (warnings.length < 100) {
        const show = dbName || (r.track_title ?? '').slice(0, 80);
        warnings.push(`Kaynakta yok (atlandı): ${r.institution_code} · ${show.slice(0, 72)}${show.length > 72 ? '…' : ''}`);
      }
    }
  }
  if (dropped > 0) {
    warnings.unshift(
      `${dropped} satır kaynak metinde okul/track kanıtı bulunamadığı için çıkarıldı (yanlış kurum veya GPT uydurması).`,
    );
  }
  return { rows: kept, dropped, warnings };
}

export type GptPlacementSchoolLine = { id: string; institution_code: string; name: string };

export type GptSourceTableScope = 'both' | 'central_only' | 'local_only';

export type GptPlacementRawRow = {
  institution_code: string;
  year: number;
  /** Aynı kurumda birden fazla alan/program varsa ayrı satırlar; metindeki alan adı aynen */
  track_title: string | null;
  track_id: string | null;
  /** Tabloda ayrı sütunlarsa (ör. «Anadolu Meslek Programı», dil) */
  program: string | null;
  language: string | null;
  with_exam: number | null;
  without_exam: number | null;
  contingent: number | null;
  tbs: number | null;
  min_taban: number | null;
};

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableOpenAiTransportError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /429|500|502|503|504|408|timeout|ETIMEDOUT|ECONNRESET|EPIPE|ENOTFOUND|socket|fetch failed|ConnectError|connection error|network/i.test(
    msg,
  );
}

/**
 * Aynı kurum kodunun GPT isteminde iki kez geçmesi modeli şaşırtır; bağlamda tek satır bırakır.
 * Uygulama (`applyRows`) için `context_school_ids` yine tüm kayıtları içermeli.
 */
export function dedupeGptSchoolLinesByInstitutionCode(schools: GptPlacementSchoolLine[]): {
  lines: GptPlacementSchoolLine[];
  notes: string[];
} {
  const byCode = new Map<string, GptPlacementSchoolLine[]>();
  for (const s of schools) {
    const c = (s.institution_code ?? '').trim();
    if (!c) continue;
    const list = byCode.get(c) ?? [];
    list.push(s);
    byCode.set(c, list);
  }
  const lines: GptPlacementSchoolLine[] = [];
  const notes: string[] = [];
  for (const [code, list] of [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))) {
    if (list.length === 1) {
      lines.push(list[0]!);
      continue;
    }
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr') || a.id.localeCompare(b.id));
    const keep = list[0]!;
    lines.push(keep);
    const others = list
      .slice(1)
      .map((x) => (x.name || '').trim() || x.id)
      .join('; ');
    notes.push(
      `Kurum kodu ${code}: ${list.length} okul kaydı — GPT isteminde yalnız «${(keep.name || '').trim() || keep.id}» kullanıldı (aynı kod: ${others}). DB’de çift kod varsa güncelleme tek kayda düşebilir.`,
    );
  }
  return { lines, notes };
}

export function validateGptPlacementRow(o: Record<string, unknown>, index: number): GptPlacementRawRow {
  const code = String(o.institution_code ?? o.kurum_kodu ?? '').trim();
  const yRaw = o.year ?? o.yil;
  const year = typeof yRaw === 'number' ? yRaw : parseInt(String(yRaw ?? ''), 10);
  if (!code) throw new Error(`satır ${index}: institution_code`);
  if (!Number.isFinite(year) || year < 1990 || year > 2100) throw new Error(`satır ${index}: year`);
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  const with_exam = num(o.with_exam ?? o.merkezi_lgs ?? o.merkezi_taban ?? o.lgs_taban);
  const without_exam = num(o.without_exam ?? o.yerel_taban ?? o.yerel_obp ?? o.yerel);
  const contingent = num(o.contingent ?? o.kontenjan);
  const tbs = num(o.tbs);
  const min_taban = num(o.min_taban ?? o.taban);
  const trackIdRaw = String(o.track_id ?? o.iz ?? o.alan_id ?? '').trim();
  const trackTitleRaw = String(o.track_title ?? o.alan ?? o.program_line ?? o.alan_adi ?? '').trim();
  const track_id = trackIdRaw || null;
  const track_title = trackTitleRaw || null;
  const programRaw = String(o.program ?? o.program_adi ?? o.program_turu ?? '').trim();
  const languageRaw = String(
    o.language ?? o.dil ?? o.yabanci_dil ?? o.yabancı_dil ?? o.foreign_language ?? '',
  ).trim();
  const program = programRaw || null;
  const language = languageRaw || null;
  if (with_exam == null && without_exam == null && contingent == null && tbs == null && min_taban == null) {
    throw new Error(`satır ${index}: en az bir puan (LGS, yerel, TBS, kontenjan, taban)`);
  }
  return {
    institution_code: code,
    year,
    track_id,
    track_title,
    program,
    language,
    with_exam,
    without_exam,
    contingent,
    tbs,
    min_taban,
  };
}

export async function runGptPlacementBatch(
  openai: OpenAI,
  model: string,
  sourceText: string,
  schools: GptPlacementSchoolLine[],
  sourceTableScope: GptSourceTableScope = 'both',
): Promise<{ rows: GptPlacementRawRow[]; warnings: string[] }> {
  const schoolLines = schools.map((s) => `- ${s.institution_code} | ${s.name || '(ad yok)'}`).join('\n');
  const scopeLine =
    sourceTableScope === 'central_only'
      ? 'TABLO_KISIT: Metinde yalnızca LGS / merkezî yerleştirme tabanı var. with_exam doldur; without_exam yalnızca metinde açık yerel puan varsa (çoğunlukla yok).'
      : sourceTableScope === 'local_only'
        ? [
            'TABLO_KISIT: Bu metin YEREL (il/ilçe) yerleştirme veya okul bazlı gösterge tablosudur; LGS / merkezî sınav puanı sütunu YOK kabul edilir.',
            'Tüm taban veya gösterge sayıları (ör. 55,12; 61,9) yalnızca without_exam alanına yazılır.',
            'Her satırda with_exam alanını TAMAMEN atla veya null bırak (JSON’da hiç yazma veya null).',
            'Çok programlı liselerde (ör. «… / Anadolu Meslek Programı» ile «… / Anadolu Lisesi») her program ayrı track_title; puanlar yine without_exam.',
            'Başlıkta veya sütunda açıkça «LGS», «merkezî», «sınav puanı» yazmıyorsa with_exam KULLANMA.',
          ].join(' ')
        : '';
  const user = [
    'KAYNAK: yalnızca açık yazılı sayılar; tahmin yok.',
    'Çıktı: {"rows":[],"warnings":[]} JSON.',
    'rows alanları: institution_code, year, with_exam (LGS/merkezî taban), without_exam (yerel/OBP göstergesi),',
    'isteğe bağlı: track_title (kurum satırındaki tam okul+alan/program metni, aynen), track_id,',
    'isteğe bağlı: program (ör. Anadolu Meslek Programı), language (ör. İngilizce) — tabloda ayrı sütun varsa doldur.',
    'isteğe bağlı: contingent, tbs, min_taban (sınavlı/MTAL tablolarında).',
    'KURAL_AYNI_KURUM_COK_ALAN: Aynı kurum kodu için metinde ayrı satırlar (farklı bölüm/alan/program) varsa,',
    'her biri AYRI out satırı olmalı; track_title o satırdaki alan adıyla aynen doldurulur (kısaltma yok).',
    'KURAL_COK_MERKEZI_YEREL: Aynı kurum+yılda birden fazla MERKEZÎ (LGS) veya birden fazla YEREL puan varsa bunlar farklı program/alandır;',
    'her biri ayrı rows satırı; track_title (veya program) ile kesin ayrıştır. Aynı satırda hem LGS hem yerel sütunu varsa tek satırda her iki alanı doldur.',
    'Tek alan/tek program görünüyorsa track_title null veya boş bırakılabilir.',
    'KURAL_YALNIZCA_KAYNAKTA_GORUNEN_OKULLAR: OKULLAR listesindeki bir kurum KAYNAK_METİN içinde (okul adı veya il/ilçe/okul satırı) geçmiyorsa o kurum için satır üretme; tahmin veya boş doldurma yok.',
    scopeLine,
    '',
    'OKULLAR:',
    schoolLines,
    '',
    'KAYNAK_METİN:',
    sourceText,
  ]
    .filter((line) => line !== '')
    .join('\n');

  const systemContent =
    sourceTableScope === 'local_only'
      ? 'Katı veri çıkarıcı; sadece JSON. Bu istek YEREL tablodur: with_exam doldurma (her satırda null/omit). Puanlar without_exam. Kurum kodu net değilse satır ekleme. Çok program → ayrı track_title.'
      : sourceTableScope === 'central_only'
        ? 'Katı veri çıkarıcı; sadece JSON. Bu istek MERKEZÎ (LGS) tablodur: puanlar with_exam. without_exam yalnızca metinde ayrı yerel sütunu açıkça varsa; yoksa null. Kurum kodu net değilse satır ekleme.'
        : 'Katı veri çıkarıcı: kurum kodu ve puan kaynakta net değilse satır ekleme. Aynı okulda birden fazla merkezî veya birden fazla yerel satır varsa her biri ayrı rows; track_title/program ile ayrıştır. Sadece JSON.';

  const maxAttempts = 2;
  let completion: OpenAI.Chat.Completions.ChatCompletion | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          { role: 'user', content: user },
        ],
      });
      break;
    } catch (e) {
      lastErr = e;
      const retry = attempt < maxAttempts - 1 && isRetryableOpenAiTransportError(e);
      if (!retry) throw e;
      await sleep(400 * 2 ** attempt);
    }
  }
  if (!completion) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  const txt = completion.choices[0]?.message?.content?.trim();
  if (!txt) throw new Error('GPT boş yanıt');
  let parsed: { rows?: unknown[]; warnings?: string[] };
  try {
    parsed = JSON.parse(txt) as { rows?: unknown[]; warnings?: string[] };
  } catch {
    throw new Error('GPT JSON: ' + txt.slice(0, 200));
  }
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [];
  const rowsIn = Array.isArray(parsed.rows) ? parsed.rows : [];
  const rows: GptPlacementRawRow[] = [];
  for (let i = 0; i < rowsIn.length; i++) {
    const item = rowsIn[i];
    if (!item || typeof item !== 'object') continue;
    try {
      rows.push(validateGptPlacementRow(item as Record<string, unknown>, i));
    } catch (e) {
      warnings.push(String(e instanceof Error ? e.message : e));
    }
  }
  const allowed = new Set(schools.map((s) => s.institution_code));
  return { rows: rows.filter((r) => allowed.has(r.institution_code)), warnings };
}

function trackKey(r: GptPlacementRawRow): string {
  const parts = [
    (r.track_id || '').trim(),
    (r.track_title || '').trim(),
    (r.program || '').trim(),
    (r.language || '').trim(),
  ].filter(Boolean);
  const t = parts.length ? parts.join('|') : '_default';
  return t.toLowerCase();
}

function mergeNums(
  a: number | null,
  b: number | null,
  label: string,
  rowKey: string,
  warnings: string[],
): number | null {
  if (a == null) return b;
  if (b == null) return a;
  if (Math.abs(a - b) < 0.005) return a;
  warnings.push(`${rowKey}: ${label} çakışması (${a} vs ${b}), son satır kullanıldı`);
  return b;
}

function mergeStr(a: string | null, b: string | null, label: string, rowKey: string, warnings: string[]): string | null {
  const ta = (a ?? '').trim();
  const tb = (b ?? '').trim();
  if (!ta) return tb || null;
  if (!tb) return ta || null;
  if (ta === tb) return ta;
  warnings.push(`${rowKey}: ${label} farklı; son satır kullanıldı`);
  return tb;
}

function mergeTwoGptRows(
  prev: GptPlacementRawRow,
  r: GptPlacementRawRow,
  rowKey: string,
  warnings: string[],
): GptPlacementRawRow {
  return {
    institution_code: prev.institution_code,
    year: prev.year,
    track_id: mergeStr(prev.track_id, r.track_id, 'track_id', rowKey, warnings),
    track_title: mergeStr(prev.track_title, r.track_title, 'track_title', rowKey, warnings),
    program: mergeStr(prev.program, r.program, 'program', rowKey, warnings),
    language: mergeStr(prev.language, r.language, 'language', rowKey, warnings),
    with_exam: mergeNums(prev.with_exam, r.with_exam, 'with_exam', rowKey, warnings),
    without_exam: mergeNums(prev.without_exam, r.without_exam, 'without_exam', rowKey, warnings),
    contingent: mergeNums(prev.contingent, r.contingent, 'contingent', rowKey, warnings),
    tbs: mergeNums(prev.tbs, r.tbs, 'tbs', rowKey, warnings),
    min_taban: mergeNums(prev.min_taban, r.min_taban, 'min_taban', rowKey, warnings),
  };
}

export function mergeGptPlacementRows(allRows: GptPlacementRawRow[]): {
  rows: GptPlacementRawRow[];
  merge_warnings: string[];
} {
  const merge_warnings: string[] = [];
  const byKey = new Map<string, GptPlacementRawRow>();
  for (const r of allRows) {
    const k = `${r.institution_code}:${r.year}:${trackKey(r)}`;
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, { ...r });
    else byKey.set(k, mergeTwoGptRows(prev, r, k, merge_warnings));
  }
  const rows = [...byKey.values()].sort((a, b) => {
    const c = a.institution_code.localeCompare(b.institution_code, 'tr');
    if (c !== 0) return c;
    const t = (a.track_title || '').localeCompare(b.track_title || '', 'tr');
    if (t !== 0) return t;
    return a.year - b.year;
  });
  return { rows, merge_warnings };
}
