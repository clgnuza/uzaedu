import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OptikFormTemplate } from './entities/optik-form-template.entity';
import { OptikRubricTemplate } from './entities/optik-rubric-template.entity';
import { OptikUsageLog } from './entities/optik-usage-log.entity';
import { UserRole } from '../types/enums';

@Injectable()
export class OptikAdminService {
  constructor(
    @InjectRepository(OptikFormTemplate)
    private readonly formRepo: Repository<OptikFormTemplate>,
    @InjectRepository(OptikRubricTemplate)
    private readonly rubricRepo: Repository<OptikRubricTemplate>,
    @InjectRepository(OptikUsageLog)
    private readonly usageRepo: Repository<OptikUsageLog>,
  ) {}

  async listFormTemplates(): Promise<OptikFormTemplate[]> {
    return this.formRepo.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Superadmin: ID ile sablon getir (PDF uretimi icin) */
  async getFormTemplateById(id: string): Promise<OptikFormTemplate> {
    const t = await this.formRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Form şablonu bulunamadı.');
    return t;
  }

  /** Öğretmen/school_admin için: system + okul + kendi şablonları (sadece aktif) */
  async listFormTemplatesForUser(
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikFormTemplate[]> {
    const ors: string[] = ["f.scope = 'system'"];
    if (schoolId && (role === UserRole.school_admin || role === UserRole.teacher)) {
      ors.push("(f.scope = 'school' AND f.school_id = :schoolId)");
    }
    if (schoolId && role === UserRole.teacher) {
      ors.push("(f.scope = 'teacher' AND f.school_id = :schoolId2 AND f.created_by_user_id = :userId)");
    }
    const qb = this.formRepo
      .createQueryBuilder('f')
      .where('f.is_active = :active', { active: true })
      .andWhere(`(${ors.join(' OR ')})`)
      .orderBy('f.sort_order', 'ASC')
      .addOrderBy('f.name', 'ASC');
    if (schoolId) {
      qb.setParameter('schoolId', schoolId).setParameter('schoolId2', schoolId);
    }
    if (role === UserRole.teacher && schoolId) {
      qb.setParameter('userId', userId);
    }
    return qb.getMany();
  }

  async createFormTemplate(dto: {
    name: string;
    slug: string;
    formType?: string;
    questionCount?: number;
    choiceCount?: number;
    pageSize?: string;
    roiConfig?: Record<string, unknown>;
    examType?: string;
    gradeLevel?: string | null;
    subjectHint?: string | null;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    scope?: string;
    schoolId?: string | null;
    createdByUserId?: string | null;
  }): Promise<OptikFormTemplate> {
    const ent = this.formRepo.create({
      name: dto.name,
      slug: dto.slug,
      formType: dto.formType ?? 'multiple_choice',
      questionCount: dto.questionCount ?? 20,
      choiceCount: dto.choiceCount ?? 5,
      pageSize: dto.pageSize ?? 'A4',
      roiConfig: dto.roiConfig ?? null,
      examType: dto.examType ?? 'genel',
      gradeLevel: dto.gradeLevel ?? null,
      subjectHint: dto.subjectHint ?? null,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      scope: dto.scope ?? 'system',
      schoolId: dto.schoolId ?? null,
      createdByUserId: dto.createdByUserId ?? null,
    });
    return this.formRepo.save(ent);
  }

  /** Okul/öğretmen özel şablon oluştur */
  async createCustomFormTemplate(
    dto: {
      name: string;
      slug: string;
      formType?: string;
      questionCount?: number;
      choiceCount?: number;
      pageSize?: string;
      examType?: string;
      gradeLevel?: string | null;
      subjectHint?: string | null;
      description?: string;
    },
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikFormTemplate> {
    if (!schoolId) {
      throw new ForbiddenException('Okul bilgisi gerekli. Özel form şablonu ekleyebilmek için okula atanmış olmalısınız.');
    }
    const scope = role === UserRole.school_admin ? 'school' : 'teacher';
    const createdBy = role === UserRole.teacher ? userId : null;
    return this.createFormTemplate({
      ...dto,
      scope,
      schoolId,
      createdByUserId: createdBy,
      isActive: true,
    });
  }

  /** Kullanıcı bu şablonu görebilir/düzenleyebilir mi? */
  async canUserAccessFormTemplate(
    templateId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<{ template: OptikFormTemplate; canModify: boolean }> {
    const template = await this.formRepo.findOne({ where: { id: templateId } });
    if (!template) throw new ForbiddenException('Form şablonu bulunamadı.');
    if (template.scope === 'system') return { template, canModify: false };
    if (!schoolId || template.schoolId !== schoolId) throw new ForbiddenException('Bu form şablonuna erişim yetkiniz yok.');
    if (template.scope === 'school') return { template, canModify: role === UserRole.school_admin };
    if (template.scope === 'teacher') return {
      template,
      canModify: role === UserRole.teacher && template.createdByUserId === userId,
    };
    throw new ForbiddenException('Bu form şablonuna erişim yetkiniz yok.');
  }

  /** PDF indirme için: kullanıcı bu şablonu görebiliyor mu? */
  async findFormTemplateForUser(
    templateId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikFormTemplate> {
    if (role === UserRole.superadmin) {
      const t = await this.formRepo.findOne({ where: { id: templateId } });
      if (!t) throw new ForbiddenException('Form şablonu bulunamadı.');
      return t;
    }
    const templates = await this.listFormTemplatesForUser(userId, schoolId, role);
    const t = templates.find((x) => x.id === templateId);
    if (!t) throw new ForbiddenException('Form şablonu bulunamadı veya erişim yetkiniz yok.');
    return t;
  }

  async updateFormTemplate(
    id: string,
    dto: Partial<{
      name: string;
      slug: string;
      formType: string;
      questionCount: number;
      choiceCount: number;
      pageSize: string;
      roiConfig: Record<string, unknown>;
      examType: string;
      gradeLevel: string | null;
      subjectHint: string | null;
      description: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ): Promise<OptikFormTemplate> {
    const ent = await this.formRepo.findOneOrFail({ where: { id } });
    if (dto.name !== undefined) ent.name = dto.name;
    if (dto.slug !== undefined) ent.slug = dto.slug;
    if (dto.formType !== undefined) ent.formType = dto.formType;
    if (dto.questionCount !== undefined) ent.questionCount = dto.questionCount;
    if (dto.choiceCount !== undefined) ent.choiceCount = dto.choiceCount;
    if (dto.pageSize !== undefined) ent.pageSize = dto.pageSize;
    if (dto.roiConfig !== undefined) ent.roiConfig = dto.roiConfig;
    if (dto.examType !== undefined) ent.examType = dto.examType;
    if (dto.gradeLevel !== undefined) ent.gradeLevel = dto.gradeLevel;
    if (dto.subjectHint !== undefined) ent.subjectHint = dto.subjectHint;
    if (dto.description !== undefined) ent.description = dto.description;
    if (dto.sortOrder !== undefined) ent.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) ent.isActive = dto.isActive;
    return this.formRepo.save(ent);
  }

  /** Okul/öğretmen kendi şablonunu günceller (canModify kontrolü sonrası) */
  async updateCustomFormTemplate(
    id: string,
    dto: Partial<{
      name: string;
      slug: string;
      formType: string;
      questionCount: number;
      choiceCount: number;
      pageSize: string;
      examType: string;
      gradeLevel: string | null;
      subjectHint: string | null;
      description: string;
      isActive: boolean;
    }>,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikFormTemplate> {
    const { canModify } = await this.canUserAccessFormTemplate(id, userId, schoolId, role);
    if (!canModify) throw new ForbiddenException('Bu form şablonunu düzenleme yetkiniz yok.');
    return this.updateFormTemplate(id, dto);
  }

  async deleteFormTemplate(id: string): Promise<void> {
    await this.formRepo.delete(id);
  }

  /** Okul/öğretmen kendi şablonunu siler */
  async deleteCustomFormTemplate(
    id: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<void> {
    const { canModify } = await this.canUserAccessFormTemplate(id, userId, schoolId, role);
    if (!canModify) throw new ForbiddenException('Bu form şablonunu silme yetkiniz yok.');
    await this.formRepo.delete(id);
  }

  async listRubricTemplates(): Promise<OptikRubricTemplate[]> {
    return this.rubricRepo.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createRubricTemplate(dto: {
    slug: string;
    name: string;
    mode: string;
    subject?: string;
    criteria?: Array<{ criterion: string; max_points: number; weight?: number }>;
    sortOrder?: number;
    isActive?: boolean;
  }): Promise<OptikRubricTemplate> {
    const existing = await this.rubricRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException({ code: 'RUBRIC_SLUG_EXISTS', message: 'Bu slug zaten başka bir rubrik şablonunda kullanılıyor. Farklı bir slug deneyin.' });
    }
    const ent = this.rubricRepo.create({
      slug: dto.slug,
      name: dto.name,
      mode: dto.mode,
      subject: dto.subject ?? null,
      criteria: dto.criteria ?? [],
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.rubricRepo.save(ent);
  }

  async updateRubricTemplate(
    id: string,
    dto: Partial<{
      slug: string;
      name: string;
      mode: string;
      subject: string;
      criteria: Array<{ criterion: string; max_points: number; weight?: number }>;
      sortOrder: number;
      isActive: boolean;
    }>,
  ): Promise<OptikRubricTemplate> {
    const ent = await this.rubricRepo.findOneOrFail({ where: { id } });
    if (dto.slug !== undefined) {
      const existing = await this.rubricRepo.findOne({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException({ code: 'RUBRIC_SLUG_EXISTS', message: 'Bu slug zaten başka bir rubrik şablonunda kullanılıyor. Farklı bir slug deneyin.' });
      }
      ent.slug = dto.slug;
    }
    if (dto.name !== undefined) ent.name = dto.name;
    if (dto.mode !== undefined) ent.mode = dto.mode;
    if (dto.subject !== undefined) ent.subject = dto.subject;
    if (dto.criteria !== undefined) ent.criteria = dto.criteria;
    if (dto.sortOrder !== undefined) ent.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) ent.isActive = dto.isActive;
    return this.rubricRepo.save(ent);
  }

  async deleteRubricTemplate(id: string): Promise<void> {
    await this.rubricRepo.delete(id);
  }

  async getUsageStats(from?: string, to?: string): Promise<{
    totalOcr: number;
    totalGrade: number;
    byDay: Array<{ date: string; ocr: number; grade: number }>;
    bySchool: Array<{ school_id: string; school_name: string; ocr: number; grade: number }>;
  }> {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const logs = await this.usageRepo.find({
      where: {
        createdAt: Between(fromDate, toDate),
      },
      relations: ['school'],
    });

    const totalOcr = logs.filter((l) => l.usageType === 'ocr').length;
    const totalGrade = logs.filter((l) => l.usageType === 'grade').length;

    const byDayMap = new Map<string, { ocr: number; grade: number }>();
    for (const log of logs) {
      const d = log.createdAt.toISOString().slice(0, 10);
      if (!byDayMap.has(d)) byDayMap.set(d, { ocr: 0, grade: 0 });
      const v = byDayMap.get(d)!;
      if (log.usageType === 'ocr') v.ocr++;
      else v.grade++;
    }
    const byDay = Array.from(byDayMap.entries())
      .map(([date, v]) => ({ date, ocr: v.ocr, grade: v.grade }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const bySchoolMap = new Map<string, { school_name: string; ocr: number; grade: number }>();
    for (const log of logs) {
      const sid = log.schoolId ?? 'unknown';
      const sname = (log as { school?: { name?: string } }).school?.name ?? 'Belirsiz';
      if (!bySchoolMap.has(sid)) bySchoolMap.set(sid, { school_name: sname, ocr: 0, grade: 0 });
      const v = bySchoolMap.get(sid)!;
      if (log.usageType === 'ocr') v.ocr++;
      else v.grade++;
    }
    const bySchool = Array.from(bySchoolMap.entries()).map(([school_id, v]) => ({
      school_id,
      school_name: v.school_name,
      ocr: v.ocr,
      grade: v.grade,
    }));

    return { totalOcr, totalGrade, byDay, bySchool };
  }

  logUsage(userId: string, schoolId: string | null, usageType: 'ocr' | 'grade'): Promise<void> {
    const ent = this.usageRepo.create({
      userId,
      schoolId,
      usageType,
    });
    return this.usageRepo.save(ent).then(() => {});
  }
}
