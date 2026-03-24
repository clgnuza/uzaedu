import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutcomeSet } from './entities/outcome-set.entity';
import { OutcomeItem } from './entities/outcome-item.entity';
import { CreateOutcomeSetDto } from './dto/create-outcome-set.dto';
import { UpdateOutcomeSetDto } from './dto/update-outcome-set.dto';
import { ImportFromPlanDto } from './dto/import-from-plan.dto';
import { YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';

/** Kazanım kodu regex: COĞ.9.1.1, MAT.9.2.1, T.3.1.2 vb. */
const KAZANIM_CODE_REGEX = /\b([A-ZÖÇĞÜŞİa-zçğıöşü]{2,}\.\d+\.\d+\.\d+(?:\.\d+)?)\b/;

function parseKazanimlarToItems(
  kazanimlar: string | null,
  weekOrder: number,
  unite: string | null,
): Array<{ week_order: number; unite: string | null; code: string | null; description: string }> {
  const text = String(kazanimlar ?? '').trim();
  if (!text || text === '—') return [];

  const items: Array<{ week_order: number; unite: string | null; code: string | null; description: string }> = [];

  const chunks = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    const single = text.split('\n').map((s) => s.trim()).filter(Boolean).join(' ');
    if (single) items.push({ week_order: weekOrder, unite, code: null, description: single });
    return items;
  }

  for (const chunk of chunks) {
    const match = chunk.match(KAZANIM_CODE_REGEX);
    if (match) {
      const code = match[1];
      const rest = chunk.replace(KAZANIM_CODE_REGEX, '').replace(/^\.\s*/, '').trim();
      const description = rest || code;
      items.push({ week_order: weekOrder, unite, code, description });
    } else {
      const lines = chunk.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(KAZANIM_CODE_REGEX);
        if (m) {
          const code = m[1];
          const rest = line.replace(KAZANIM_CODE_REGEX, '').replace(/^\.\s*/, '').trim();
          items.push({ week_order: weekOrder, unite, code, description: rest || code });
        } else if (line) {
          items.push({ week_order: weekOrder, unite, code: null, description: line });
        }
      }
      if (lines.length === 0 && chunk) {
        items.push({ week_order: weekOrder, unite, code: null, description: chunk });
      }
    }
  }

  if (items.length === 0 && text) {
    items.push({ week_order: weekOrder, unite, code: null, description: text });
  }

  return items;
}

@Injectable()
export class OutcomeSetsService {
  constructor(
    @InjectRepository(OutcomeSet)
    private readonly setRepo: Repository<OutcomeSet>,
    @InjectRepository(OutcomeItem)
    private readonly itemRepo: Repository<OutcomeItem>,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
  ) {}

  async findAll(filters: {
    subject_code?: string;
    grade?: number;
    academic_year?: string;
  }): Promise<OutcomeSet[]> {
    const qb = this.setRepo
      .createQueryBuilder('os')
      .leftJoinAndSelect('os.items', 'items')
      .orderBy('os.subject_label', 'ASC')
      .addOrderBy('os.grade', 'ASC')
      .addOrderBy('os.academic_year', 'DESC')
      .addOrderBy('items.week_order', 'ASC', 'NULLS LAST')
      .addOrderBy('items.sort_order', 'ASC');

    if (filters.subject_code?.trim()) {
      qb.andWhere('os.subject_code = :subjectCode', { subjectCode: filters.subject_code.trim() });
    }
    if (filters.grade != null) {
      qb.andWhere('os.grade = :grade', { grade: filters.grade });
    }
    if (filters.academic_year?.trim()) {
      qb.andWhere('os.academic_year = :academicYear', { academicYear: filters.academic_year.trim() });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<OutcomeSet> {
    const set = await this.setRepo.findOne({
      where: { id },
      relations: ['items'],
      order: { items: { weekOrder: 'ASC', sortOrder: 'ASC' } },
    });
    if (!set) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kazanım seti bulunamadı.' });
    }
    return set;
  }

  async create(dto: CreateOutcomeSetDto): Promise<OutcomeSet> {
    const set = this.setRepo.create({
      subjectCode: dto.subject_code.trim(),
      subjectLabel: dto.subject_label.trim(),
      grade: dto.grade,
      section: dto.section ?? null,
      academicYear: dto.academic_year ?? null,
      sourceType: dto.source_type ?? 'manual',
    });
    const saved = await this.setRepo.save(set);

    if (Array.isArray(dto.items) && dto.items.length > 0) {
      const itemEntities = dto.items.map((it, idx) =>
        this.itemRepo.create({
          outcomeSetId: saved.id,
          weekOrder: it.week_order ?? null,
          unite: it.unite ?? null,
          code: it.code ?? null,
          description: String(it.description ?? '').trim() || '—',
          sortOrder: it.sort_order ?? idx,
        }),
      );
      await this.itemRepo.save(itemEntities);
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateOutcomeSetDto): Promise<OutcomeSet> {
    const set = await this.findOne(id);

    if (dto.subject_code !== undefined) set.subjectCode = dto.subject_code.trim();
    if (dto.subject_label !== undefined) set.subjectLabel = dto.subject_label.trim();
    if (dto.grade !== undefined) set.grade = dto.grade;
    if (dto.section !== undefined) set.section = dto.section;
    if (dto.academic_year !== undefined) set.academicYear = dto.academic_year;

    await this.setRepo.save(set);

    if (Array.isArray(dto.items)) {
      await this.itemRepo.delete({ outcomeSetId: id });

      if (dto.items.length > 0) {
        const itemEntities = dto.items.map((it, idx) =>
          this.itemRepo.create({
            outcomeSetId: id,
            weekOrder: it.week_order ?? null,
            unite: it.unite ?? null,
            code: it.code ?? null,
            description: String(it.description ?? '').trim() || '—',
            sortOrder: it.sort_order ?? idx,
          }),
        );
        await this.itemRepo.save(itemEntities);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.setRepo.delete(id);
  }

  /** Yıllık planda verisi olan ders/sınıf/yıl listesi – "Yıllık plandan içe aktar" için dropdown */
  async getPlanSummary(): Promise<
    Array<{
      subject_code: string;
      subject_label: string;
      grade: number | null;
      academic_year: string;
      week_count: number;
    }>
  > {
    return this.yillikPlanIcerikService.findSummary();
  }

  async importFromPlan(dto: ImportFromPlanDto): Promise<OutcomeSet> {
    const planRows = await this.yillikPlanIcerikService.findAll({
      subject_code: dto.subject_code,
      grade: dto.grade,
      academic_year: dto.academic_year,
    });

    if (planRows.length === 0) {
      throw new BadRequestException({
        code: 'NO_PLAN_DATA',
        message: 'Bu ders, sınıf ve öğretim yılı için yıllık plan verisi bulunamadı. Önce Yıllık Plan İçerikleri sayfasında plan oluşturun.',
      });
    }

    const allItems: Array<{ week_order: number; unite: string | null; code: string | null; description: string }> = [];

    for (const row of planRows) {
      const weekOrder = row.weekOrder ?? 0;
      const unite = row.unite ?? null;
      const parsed = parseKazanimlarToItems(row.kazanimlar, weekOrder, unite);
      allItems.push(...parsed);
    }

    if (allItems.length === 0) {
      throw new BadRequestException({
        code: 'NO_KAZANIM_FOUND',
        message: 'Plan verisinde kazanım metni bulunamadı.',
      });
    }

    const existing = await this.setRepo.findOne({
      where: {
        subjectCode: dto.subject_code,
        grade: dto.grade,
        academicYear: dto.academic_year,
      },
    });

    if (existing) {
      return this.update(existing.id, {
        items: allItems.map((it, idx) => ({
          week_order: it.week_order,
          unite: it.unite,
          code: it.code,
          description: it.description,
          sort_order: idx,
        })),
      });
    }

    return this.create({
      subject_code: dto.subject_code,
      subject_label: dto.subject_label,
      grade: dto.grade,
      academic_year: dto.academic_year,
      source_type: 'yillik_plan',
      items: allItems.map((it, idx) => ({
        week_order: it.week_order,
        unite: it.unite,
        code: it.code,
        description: it.description,
        sort_order: idx,
      })),
    });
  }
}
