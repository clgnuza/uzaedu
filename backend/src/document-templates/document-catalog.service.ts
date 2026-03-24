import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentCatalog } from './entities/document-catalog.entity';
import type { DocumentCatalogCategory } from './entities/document-catalog.entity';
import { getAllSeedItems } from './document-catalog.seed';

@Injectable()
export class DocumentCatalogService implements OnModuleInit {
  constructor(
    @InjectRepository(DocumentCatalog)
    private readonly repo: Repository<DocumentCatalog>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  /** Tablo boşsa seed çalıştır */
  async ensureSeeded(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;
    const items = getAllSeedItems();
    for (const item of items) {
      await this.repo.save(this.repo.create(item));
    }
  }

  async findAllByCategory(category: DocumentCatalogCategory): Promise<DocumentCatalog[]> {
    return this.repo.find({
      where: { category, isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async findSubTypesByParent(parentCode: string): Promise<DocumentCatalog[]> {
    return this.repo.find({
      where: { category: 'sub_type', parentCode, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findSubjects(grade?: number, section?: string, curriculumModel?: string): Promise<DocumentCatalog[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.category = :cat', { cat: 'subject' })
      .andWhere('c.is_active = true');
    const isBilsem = curriculumModel?.trim() === 'bilsem';
    if (isBilsem) {
      qb.andWhere('c.ana_grup IS NOT NULL').andWhere("TRIM(c.ana_grup) != ''");
      if (section) {
        qb.andWhere('(c.section_filter IS NULL OR c.section_filter = :section)', { section });
      }
    } else if (grade != null && grade >= 1 && grade <= 12) {
      qb.andWhere('(c.grade_min IS NULL OR c.grade_min <= :grade)', { grade });
      qb.andWhere('(c.grade_max IS NULL OR c.grade_max >= :grade)', { grade });
      if (section) {
        qb.andWhere('(c.section_filter IS NULL OR c.section_filter = :section)', {
          section,
        });
      }
    } else {
      qb.andWhere('c.grade_min IS NULL AND c.grade_max IS NULL');
    }
    qb.orderBy('c.sort_order', 'ASC').addOrderBy('c.label', 'ASC');
    return qb.getMany();
  }

  async list(params: {
    category?: string;
    parentCode?: string;
    grade?: number;
    section?: string;
  }): Promise<DocumentCatalog[]> {
    const cat = params.category as DocumentCatalogCategory | undefined;
    if (cat === 'subject') {
      return this.findSubjects(params.grade, params.section);
    }
    if (cat === 'sub_type' && params.parentCode) {
      return this.findSubTypesByParent(params.parentCode);
    }
    if (cat && ['evrak_type', 'school_type', 'section', 'sub_type', 'subject'].includes(cat)) {
      return this.findAllByCategory(cat);
    }
    return this.repo.find({
      where: { isActive: true },
      order: { category: 'ASC', sortOrder: 'ASC', label: 'ASC' },
    });
  }

  /** Admin: Tüm katalog liste (sayfalı). curriculumModel=bilsem → sadece ana_grup IS NOT NULL */
  async findAllAdmin(params: {
    category?: string;
    page?: number;
    limit?: number;
    curriculumModel?: string;
  }): Promise<{ total: number; page: number; limit: number; items: DocumentCatalog[] }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(500, Math.max(1, params.limit ?? 50));
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.category', 'ASC')
      .addOrderBy('c.sort_order', 'ASC')
      .addOrderBy('c.label', 'ASC');
    qb.where('c.is_active = true');
    if (params.category) {
      qb.andWhere('c.category = :cat', { cat: params.category });
    }
    if (params.curriculumModel?.trim() === 'bilsem') {
      qb.andWhere('c.ana_grup IS NOT NULL').andWhere("TRIM(c.ana_grup) != ''");
    }
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { total, page, limit, items };
  }

  /** Admin: Ders ekle */
  async createSubject(dto: {
    code: string;
    label: string;
    grade_min?: number | null;
    grade_max?: number | null;
    section_filter?: string | null;
    ana_grup?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<DocumentCatalog> {
    const existing = await this.repo.findOne({
      where: { category: 'subject', code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Ders kodu zaten mevcut: ${dto.code}`);
    }
    const entity = this.repo.create({
      category: 'subject',
      code: dto.code,
      label: dto.label,
      gradeMin: dto.grade_min ?? null,
      gradeMax: dto.grade_max ?? null,
      sectionFilter: dto.section_filter ?? null,
      anaGrup: dto.ana_grup?.trim() || null,
      sortOrder: dto.sort_order ?? 0,
      isActive: dto.is_active ?? true,
    });
    return this.repo.save(entity);
  }

  /** Admin: Ders güncelle */
  async updateSubject(
    id: string,
    dto: Partial<{
      code: string;
      label: string;
      grade_min: number | null;
      grade_max: number | null;
      section_filter: string | null;
      ana_grup: string | null;
      sort_order: number;
      is_active: boolean;
    }>,
  ): Promise<DocumentCatalog> {
    const entity = await this.repo.findOne({
      where: { id, category: 'subject' },
    });
    if (!entity) {
      throw new NotFoundException('Ders bulunamadı');
    }
    if (dto.code != null) entity.code = dto.code;
    if (dto.label != null) entity.label = dto.label;
    if (dto.grade_min !== undefined) entity.gradeMin = dto.grade_min;
    if (dto.grade_max !== undefined) entity.gradeMax = dto.grade_max;
    if (dto.section_filter !== undefined) entity.sectionFilter = dto.section_filter;
    if (dto.ana_grup !== undefined) entity.anaGrup = dto.ana_grup?.trim() || null;
    if (dto.sort_order != null) entity.sortOrder = dto.sort_order;
    if (dto.is_active !== undefined) entity.isActive = dto.is_active;
    return this.repo.save(entity);
  }

  /** Admin: Ders sil (soft delete) */
  async deleteSubject(id: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: { id, category: 'subject' },
    });
    if (!entity) {
      throw new NotFoundException('Ders bulunamadı');
    }
    entity.isActive = false;
    await this.repo.save(entity);
  }
}
