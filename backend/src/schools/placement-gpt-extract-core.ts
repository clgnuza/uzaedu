import OpenAI from 'openai';

export const SOURCE_MAX_PLACEMENT_GPT = 100_000;

export type GptPlacementSchoolLine = { id: string; institution_code: string; name: string };

export type GptSourceTableScope = 'both' | 'central_only' | 'local_only';

export type GptPlacementRawRow = {
  institution_code: string;
  year: number;
  with_exam: number | null;
  without_exam: number | null;
};

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  if (with_exam == null && without_exam == null) throw new Error(`satır ${index}: puan`);
  return { institution_code: code, year, with_exam, without_exam };
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
        ? 'TABLO_KISIT: Metinde yalnızca yerel / OBP vb. gösterge var. without_exam doldur; with_exam yalnızca metinde açık LGS puanı varsa (çoğunlukla yok).'
        : '';
  const user = [
    'KAYNAK: yalnızca açık yazılı sayılar; tahmin yok.',
    'Çıktı: {"rows":[],"warnings":[]} JSON.',
    'rows: institution_code, year, with_exam (LGS taban), without_exam (yerel/OBP göstergesi).',
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

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Katı veri çıkarıcısı: kurum kodu ve puan kaynakta net değilse satır ekleme. Sadece JSON.',
      },
      { role: 'user', content: user },
    ],
  });
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

export function mergeGptPlacementRows(allRows: GptPlacementRawRow[]): GptPlacementRawRow[] {
  const byKey = new Map<string, GptPlacementRawRow>();
  for (const r of allRows) byKey.set(`${r.institution_code}:${r.year}`, r);
  return [...byKey.values()].sort((a, b) => {
    const c = a.institution_code.localeCompare(b.institution_code, 'tr');
    return c !== 0 ? c : a.year - b.year;
  });
}
