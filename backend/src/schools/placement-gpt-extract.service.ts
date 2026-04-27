import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { AppConfigService } from '../app-config/app-config.service';
import { School } from './entities/school.entity';
import { PlacementGptExtractDto } from './dto/placement-gpt-extract.dto';
import {
  SOURCE_MAX_PLACEMENT_GPT,
  chunkArray,
  dedupeGptSchoolLinesByInstitutionCode,
  filterGptPlacementRowsBySourceText,
  mergeGptPlacementRows,
  narrowSourceTextForPlacementGpt,
  runGptPlacementBatch,
  type GptPlacementRawRow,
  type GptPlacementSchoolLine,
} from './placement-gpt-extract-core';
import {
  normalizePlacementUpdateScope,
  normalizeRawRowToPlacement,
  type PlacementFeedRow,
  type PlacementUpdateScope,
} from './school-placement-scores-sync.service';
import { kazanabilirsinHtmlTableToPipeMarkdown } from './placement-kazanabilirsin-html.util';
import { tryDeterministicKazanabilirsinTable, type SchoolMatchLine } from './placement-kazanabilirsin-table.util';

@Injectable()
export class PlacementGptExtractService {
  private readonly logger = new Logger(PlacementGptExtractService.name);

  constructor(
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Hız + JSON: `gpt-4o-mini`; daha zor tablolar için env ile `gpt-4o` denenebilir (daha yavaş). */
  private model(): string {
    return process.env.PLACEMENT_GPT_MODEL?.trim() || 'gpt-4o-mini';
  }

  /** Tabloda tek puan sütunu varken GPT’nin yanlış JSON alanına yazmasını telafi eder. */
  private coerceMergedRowsForSourceTable(
    rows: GptPlacementRawRow[],
    sourceScope: PlacementUpdateScope,
    warnings: string[],
  ): GptPlacementRawRow[] {
    if (sourceScope === 'both') return rows;
    let promoted = 0;
    const out = rows.map((r) => {
      const we = r.with_exam;
      const wo = r.without_exam;
      if (sourceScope === 'central_only') {
        if (we == null && wo != null) {
          promoted += 1;
          return { ...r, with_exam: wo, without_exam: null };
        }
        return { ...r, without_exam: null };
      }
      if (sourceScope === 'local_only') {
        if (wo == null && we != null) {
          promoted += 1;
          return { ...r, without_exam: we, with_exam: null };
        }
        return { ...r, with_exam: null };
      }
      return r;
    });
    warnings.push(
      sourceScope === 'central_only'
        ? `Tablo kapsamı: yalnız merkezî (LGS) puanları — yerel alan temizlendi${promoted ? `; ${promoted} satırda tek sütun merkezîye taşındı` : ''}.`
        : `Tablo kapsamı: yalnız yerel puanlar — merkezî alan temizlendi${promoted ? `; ${promoted} satırda tek sütun yerelde taşındı` : ''}.`,
    );
    return out;
  }

  async loadSchoolMatchLines(dto: PlacementGptExtractDto): Promise<SchoolMatchLine[]> {
    const cap = Math.min(dto.limit ?? 400, 2000);
    const cityTrim = (dto.city ?? '').trim();
    if (dto.school_ids?.length) {
      const qb = this.schoolRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.institutionCode', 's.name', 's.city', 's.district', 's.type'])
        .where('s.id IN (:...ids)', { ids: dto.school_ids })
        .andWhere('s.institution_code IS NOT NULL')
        .andWhere("trim(s.institution_code::text) <> ''")
        .orderBy('s.name', 'ASC');
      if (cityTrim) {
        qb.andWhere('trim(s.city) ilike trim(:city)', { city: cityTrim });
      } else {
        qb.take(Math.max(cap, dto.school_ids.length));
      }
      const list = await qb.getMany();
      return list.map((s) => ({
        id: s.id,
        institution_code: (s.institutionCode ?? '').trim(),
        name: s.name ?? '',
        city: s.city ?? null,
        district: s.district ?? null,
        school_type: s.type ?? null,
      }));
    }
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.institutionCode', 's.name', 's.city', 's.district', 's.type'])
      .where('s.institution_code IS NOT NULL')
      .andWhere("trim(s.institution_code::text) <> ''")
      .orderBy('s.name', 'ASC');
    if (cityTrim) {
      qb.andWhere('trim(s.city) ilike trim(:city)', { city: cityTrim });
    } else {
      qb.take(cap);
    }
    const list = await qb.getMany();
    return list.map((s) => ({
      id: s.id,
      institution_code: (s.institutionCode ?? '').trim(),
      name: s.name ?? '',
      city: s.city ?? null,
      district: s.district ?? null,
      school_type: s.type ?? null,
    }));
  }

  async loadSchoolLines(dto: PlacementGptExtractDto): Promise<GptPlacementSchoolLine[]> {
    const full = await this.loadSchoolMatchLines(dto);
    return full.map((s) => ({ id: s.id, institution_code: s.institution_code, name: s.name }));
  }

  /**
   * Kaynak metinden GPT ile satır çıkarır; normalizeRawRowToPlacement ile PlacementFeedRow üretir.
   */
  async extractRows(dto: PlacementGptExtractDto): Promise<{
    rows: PlacementFeedRow[];
    warnings: string[];
    schools_considered: number;
    batches: number;
    model: string;
    context_school_ids: string[];
    institution_names: Record<string, string>;
    fetched_from_url?: string;
  }> {
    const textTrim = (dto.source_text ?? '').trim();
    const urlTrim = (dto.source_url ?? '').trim();
    if (urlTrim && textTrim) {
      throw new BadRequestException({
        code: 'SOURCE_AMBIGUOUS',
        message: 'Aynı istekte hem «kaynak metin» hem «kaynak URL» kullanılamaz; yalnız birini gönderin.',
      });
    }
    let source: string;
    let fetched_from_url: string | undefined;
    if (urlTrim) {
      source = await this.fetchKazanabilirsinPageAsMarkdown(urlTrim);
      fetched_from_url = urlTrim;
    } else if (textTrim) {
      source = textTrim;
    } else {
      throw new BadRequestException({
        code: 'SOURCE_EMPTY',
        message: 'Kaynak metin veya kazanabilirsin.com kaynak URL girin.',
      });
    }

    const schoolsRich = await this.loadSchoolMatchLines(dto);
    if (!schoolsRich.length) {
      throw new BadRequestException({
        code: 'NO_SCHOOLS',
        message: 'Kurum kodu olan okul bulunamadı veya school_ids filtresi eşleşmedi.',
      });
    }

    const schoolsRaw = schoolsRich.map((s) => ({
      id: s.id,
      institution_code: s.institution_code,
      name: s.name,
    }));
    const { lines: schools, notes: dedupeNotes } = dedupeGptSchoolLinesByInstitutionCode(schoolsRaw);
    const warnings: string[] = [...dedupeNotes];
    if (fetched_from_url) {
      warnings.push(`Kaynak sayfa (HTTP): ${fetched_from_url} — HTML tablosu markdown’a dönüştürüldü.`);
    }
    if (schoolsRaw.length > schools.length) {
      warnings.push(
        `GPT bağlamı: ${schoolsRaw.length} okul kaydı sorgulandı, ${schools.length} benzersiz kurum kodu OpenAI istemine gönderildi (yinelenen kodlar tekilleştirildi).`,
      );
    }

    const sourceTableScope = normalizePlacementUpdateScope(dto.source_scores_in_table);
    const codeToSchoolName = new Map(schoolsRich.map((s) => [s.institution_code, s.name]));

    const det = tryDeterministicKazanabilirsinTable(source, schoolsRich, sourceTableScope);
    if (det.used && det.rawRows.length > 0) {
      for (const w of det.warnings) warnings.push(w);
      const { rows: merged, merge_warnings } = mergeGptPlacementRows(det.rawRows);
      for (const mw of merge_warnings) warnings.push(`[merge] ${mw}`);
      const coerced = this.coerceMergedRowsForSourceTable(merged, sourceTableScope, warnings);
      /** Tablo satırları doğrudan kaynak metinden üretildi; DB kısa adı / Unicode farkı yüzünden kanıt süzgeci satır düşürüyordu. */
      const evidenceRows = coerced;
      const rows: PlacementFeedRow[] = [];
      for (let i = 0; i < evidenceRows.length; i++) {
        const r = evidenceRows[i];
        try {
          rows.push(
            normalizeRawRowToPlacement(
              {
                institution_code: r.institution_code,
                year: r.year,
                with_exam: r.with_exam,
                without_exam: r.without_exam,
                track_id: r.track_id,
                track_title: r.track_title,
                program: r.program,
                language: r.language,
                contingent: r.contingent,
                tbs: r.tbs,
                min_taban: r.min_taban,
              },
              i,
            ),
          );
        } catch (e) {
          warnings.push(`[normalize ${i}] ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const institution_names: Record<string, string> = {};
      for (const r of rows) {
        const c = (r.institution_code ?? '').trim();
        if (c && institution_names[c] === undefined) institution_names[c] = codeToSchoolName.get(c) ?? '';
      }
      return {
        rows,
        warnings,
        schools_considered: schoolsRich.length,
        batches: 0,
        model: 'deterministic:kazanabilirsin-table',
        context_school_ids: schoolsRich.map((s) => s.id),
        institution_names,
        fetched_from_url,
      };
    }

    const apiKey = (await this.appConfig.getExamDutyOpenAiKey())?.trim();
    if (!apiKey) {
      throw new BadRequestException({
        code: 'OPENAI_MISSING',
        message:
          'OpenAI API anahtarı yok. Süperadmin → Sınav görevi senkron ayarlarında API anahtarı girin veya sunucuda OPENAI_API_KEY tanımlayın. Kazanabilirsin tarzı OBP/LGS tablosu tanınmadıysa metni tablo olarak yapıştırdığınızdan ve İl filtresinin DB ile uyumlu olduğundan emin olun.',
      });
    }

    const narrowed = narrowSourceTextForPlacementGpt(source, sourceTableScope);
    const sourceText =
      narrowed.length > SOURCE_MAX_PLACEMENT_GPT ? narrowed.slice(0, SOURCE_MAX_PLACEMENT_GPT) : narrowed;
    if (narrowed.length < source.length) {
      warnings.push(
        `GPT kaynak metni ${source.length} → ${narrowed.length} karaktere indirgendi (tablo benzeri | ve TSV satırları); önizleme hızlanır.`,
      );
    }

    const batchSize = Math.min(Math.max(dto.batch_size ?? 32, 4), 50);
    const model = this.model();
    const openai = new OpenAI({
      apiKey,
      timeout: sourceTableScope === 'central_only' ? 240_000 : 120_000,
      maxRetries: 1,
    });
    const batches = chunkArray(schools, batchSize);
    const rawMerged: GptPlacementRawRow[] = [];
    let batchFailureCount = 0;

    /** Varsayılan 5; 429 riski için `PLACEMENT_GPT_PARALLEL=2` ile düşürülebilir. */
    const parallel = Math.min(
      8,
      Math.max(1, Number.parseInt(process.env.PLACEMENT_GPT_PARALLEL?.trim() ?? '5', 10) || 5),
    );
    if (parallel > 1 && batches.length > 1) {
      this.logger.log(`placement GPT: ${batches.length} parti, eşzamanlılık=${parallel} (PLACEMENT_GPT_PARALLEL)`);
    }

    for (let i = 0; i < batches.length; i += parallel) {
      const window = batches.slice(i, i + parallel);
      const settled = await Promise.allSettled(
        window.map((batch) => runGptPlacementBatch(openai, model, sourceText, batch, sourceTableScope)),
      );
      for (let j = 0; j < settled.length; j++) {
        const bi = i + j;
        const st = settled[j]!;
        if (st.status === 'fulfilled') {
          rawMerged.push(...st.value.rows);
          warnings.push(...st.value.warnings.map((x) => `[parti ${bi + 1}] ${x}`));
        } else {
          const msg0 = st.reason instanceof Error ? st.reason.message : String(st.reason);
          try {
            await new Promise<void>((r) => setTimeout(r, 800 + Math.floor(Math.random() * 250)));
            const retry = await runGptPlacementBatch(
              openai,
              model,
              sourceText,
              window[j]!,
              sourceTableScope,
            );
            rawMerged.push(...retry.rows);
            warnings.push(`[parti ${bi + 1}] ilk çağrı başarısız (${msg0.slice(0, 200)}); otomatik yeniden denendi.`);
            warnings.push(...retry.warnings.map((x) => `[parti ${bi + 1}] ${x}`));
          } catch (e2) {
            batchFailureCount += 1;
            const msg = e2 instanceof Error ? e2.message : String(e2);
            this.logger.warn(`GPT parti ${bi + 1} hata (retry sonrası): ${msg}`);
            warnings.push(`[parti ${bi + 1}] ${msg0}; retry: ${msg}`);
          }
        }
      }
    }
    if (rawMerged.length === 0 && batchFailureCount > 0 && batchFailureCount === batches.length) {
      warnings.push(
        'GPT: tüm partiler başarısız → 0 satır. api.openai.com erişimi, proxy/firewall, OpenAI kota/limiti veya geçici ağ kesintisini kontrol edin; birkaç saniye sonra yeniden deneyin.',
      );
    }

    const { rows: merged, merge_warnings } = mergeGptPlacementRows(rawMerged);
    for (const mw of merge_warnings) warnings.push(`[merge] ${mw}`);
    const coerced = this.coerceMergedRowsForSourceTable(merged, sourceTableScope, warnings);
    const { rows: evidenceRows, warnings: evW } = filterGptPlacementRowsBySourceText(coerced, source, codeToSchoolName);
    for (const w of evW) warnings.push(w);
    const rows: PlacementFeedRow[] = [];
    for (let i = 0; i < evidenceRows.length; i++) {
      const r = evidenceRows[i];
      try {
        rows.push(
          normalizeRawRowToPlacement(
            {
              institution_code: r.institution_code,
              year: r.year,
              with_exam: r.with_exam,
              without_exam: r.without_exam,
              track_id: r.track_id,
              track_title: r.track_title,
              program: r.program,
              language: r.language,
              contingent: r.contingent,
              tbs: r.tbs,
              min_taban: r.min_taban,
            },
            i,
          ),
        );
      } catch (e) {
        warnings.push(`[normalize ${i}] ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const institution_names: Record<string, string> = {};
    for (const r of rows) {
      const c = (r.institution_code ?? '').trim();
      if (c && institution_names[c] === undefined) institution_names[c] = codeToSchoolName.get(c) ?? '';
    }

    return {
      rows,
      warnings,
      schools_considered: schoolsRaw.length,
      batches: batches.length,
      model,
      context_school_ids: schoolsRaw.map((s) => s.id),
      institution_names,
      fetched_from_url,
    };
  }

  /** kazanabilirsin.com — yalnızca bu host (güvenlik). */
  private async fetchKazanabilirsinPageAsMarkdown(urlRaw: string): Promise<string> {
    let u: URL;
    try {
      u = new URL(urlRaw);
    } catch {
      throw new BadRequestException({ code: 'INVALID_URL', message: 'Geçersiz URL.' });
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException({ code: 'INVALID_URL', message: 'Yalnızca http(s) kabul edilir.' });
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'kazanabilirsin.com') {
      throw new BadRequestException({
        code: 'PLACEMENT_URL_HOST',
        message: 'Şimdilik yalnızca kazanabilirsin.com adresleri desteklenir.',
      });
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 45_000);
    let res: Response;
    try {
      res = await fetch(urlRaw, {
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'OgretmenProPlacementImport/1.0',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException({
        code: 'FETCH_FAILED',
        message: `Sayfa indirilemedi: ${msg.slice(0, 200)}`,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new BadRequestException({
        code: 'FETCH_HTTP',
        message: `Sayfa yanıtı HTTP ${res.status}.`,
      });
    }
    const html = await res.text();
    if (!html || html.length < 400) {
      throw new BadRequestException({ code: 'FETCH_EMPTY', message: 'Sayfa gövdesi boş veya çok kısa.' });
    }
    const md = kazanabilirsinHtmlTableToPipeMarkdown(html);
    if (!md) {
      throw new BadRequestException({
        code: 'NO_PLACEMENT_TABLE',
        message:
          'Sayfada «Okul Adı» + «Taban Puanı» (LGS) veya «OBP» sütunlu tablo bulunamadı (sayfa yapısı değişmiş veya giriş engeli olabilir). Metni elle yapıştırmayı deneyin.',
      });
    }
    return `<!-- placement-url:${urlRaw} -->\n${md}`;
  }
}
