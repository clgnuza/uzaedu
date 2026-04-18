import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import OpenAI from 'openai';
import { School } from './entities/school.entity';
import { PlacementGptExtractDto } from './dto/placement-gpt-extract.dto';
import {
  SOURCE_MAX_PLACEMENT_GPT,
  chunkArray,
  mergeGptPlacementRows,
  runGptPlacementBatch,
  type GptPlacementSchoolLine,
} from './placement-gpt-extract-core';
import { normalizeRawRowToPlacement, type PlacementFeedRow } from './school-placement-scores-sync.service';

@Injectable()
export class PlacementGptExtractService {
  private readonly logger = new Logger(PlacementGptExtractService.name);

  constructor(@InjectRepository(School) private readonly schoolRepo: Repository<School>) {}

  private model(): string {
    return process.env.PLACEMENT_GPT_MODEL?.trim() || 'gpt-4o-mini';
  }

  async loadSchoolLines(dto: PlacementGptExtractDto): Promise<GptPlacementSchoolLine[]> {
    const cap = Math.min(dto.limit ?? 400, 2000);
    const cityTrim = (dto.city ?? '').trim();
    if (dto.school_ids?.length) {
      const qb = this.schoolRepo
        .createQueryBuilder('s')
        .select(['s.id', 's.institutionCode', 's.name'])
        .where('s.id IN (:...ids)', { ids: dto.school_ids })
        .andWhere('s.institution_code IS NOT NULL')
        .andWhere("trim(s.institution_code::text) <> ''")
        .orderBy('s.name', 'ASC')
        .take(cap);
      if (cityTrim) {
        qb.andWhere('trim(s.city) ilike trim(:city)', { city: cityTrim });
      }
      const list = await qb.getMany();
      return list.map((s) => ({
        id: s.id,
        institution_code: (s.institutionCode ?? '').trim(),
        name: s.name ?? '',
      }));
    }
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.institutionCode', 's.name'])
      .where('s.institution_code IS NOT NULL')
      .andWhere("trim(s.institution_code::text) <> ''")
      .orderBy('s.name', 'ASC')
      .take(cap);
    if (cityTrim) {
      qb.andWhere('trim(s.city) ilike trim(:city)', { city: cityTrim });
    }
    const list = await qb.getMany();
    return list.map((s) => ({
      id: s.id,
      institution_code: (s.institutionCode ?? '').trim(),
      name: s.name ?? '',
    }));
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
  }> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException({
        code: 'OPENAI_MISSING',
        message: 'OPENAI_API_KEY tanımlı değil. backend/.env içine ekleyin.',
      });
    }
    const source = (dto.source_text ?? '').trim();
    if (!source) {
      throw new BadRequestException({ code: 'SOURCE_EMPTY', message: 'Kaynak metin boş olamaz.' });
    }
    const sourceText = source.length > SOURCE_MAX_PLACEMENT_GPT ? source.slice(0, SOURCE_MAX_PLACEMENT_GPT) : source;

    const schools = await this.loadSchoolLines(dto);
    if (!schools.length) {
      throw new BadRequestException({
        code: 'NO_SCHOOLS',
        message: 'Kurum kodu olan okul bulunamadı veya school_ids filtresi eşleşmedi.',
      });
    }

    const batchSize = Math.min(Math.max(dto.batch_size ?? 12, 4), 30);
    const model = this.model();
    const openai = new OpenAI({ apiKey });
    const batches = chunkArray(schools, batchSize);
    const rawMerged: ReturnType<typeof mergeGptPlacementRows> = [];
    const warnings: string[] = [];
    const byCodeCount = new Map<string, number>();
    for (const s of schools) {
      const c = s.institution_code;
      byCodeCount.set(c, (byCodeCount.get(c) ?? 0) + 1);
    }
    for (const [c, n] of byCodeCount) {
      if (n > 1) {
        warnings.push(
          `Aynı kurum kodu (${c}) seçilen ${n} okulda; uygulama yalnızca school_ids ile tek eşleşme bulursa yazar, aksi halde satırı atlar.`,
        );
      }
    }

    for (let bi = 0; bi < batches.length; bi++) {
      try {
        const { rows, warnings: w } = await runGptPlacementBatch(openai, model, sourceText, batches[bi]);
        rawMerged.push(...rows);
        warnings.push(...w.map((x) => `[parti ${bi + 1}] ${x}`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`GPT parti ${bi + 1} hata: ${msg}`);
        warnings.push(`[parti ${bi + 1}] ${msg}`);
      }
    }

    const merged = mergeGptPlacementRows(rawMerged);
    const rows: PlacementFeedRow[] = [];
    for (let i = 0; i < merged.length; i++) {
      const r = merged[i];
      try {
        rows.push(
          normalizeRawRowToPlacement(
            {
              institution_code: r.institution_code,
              year: r.year,
              with_exam: r.with_exam,
              without_exam: r.without_exam,
            },
            i,
          ),
        );
      } catch (e) {
        warnings.push(`[normalize ${i}] ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      rows,
      warnings,
      schools_considered: schools.length,
      batches: batches.length,
      model,
      context_school_ids: schools.map((s) => s.id),
    };
  }
}
