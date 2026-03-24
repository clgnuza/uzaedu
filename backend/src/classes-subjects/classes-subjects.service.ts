import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSubject } from './entities/school-subject.entity';
import { DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '../config/default-classes-subjects';

@Injectable()
export class ClassesSubjectsService {
  constructor(
    @InjectRepository(SchoolClass)
    private readonly classRepo: Repository<SchoolClass>,
    @InjectRepository(SchoolSubject)
    private readonly subjectRepo: Repository<SchoolSubject>,
  ) {}

  private async ensureSchoolScope(schoolId: string | null, targetSchoolId: string) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    if (schoolId !== targetSchoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
  }

  async listClasses(schoolId: string | null) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    return this.classRepo.find({
      where: { schoolId: schoolId! },
      order: { grade: 'ASC', section: 'ASC', name: 'ASC' },
    });
  }

  async createClass(schoolId: string | null, dto: { name: string; grade?: number; section?: string }) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const c = this.classRepo.create({
      schoolId: schoolId!,
      name: dto.name.trim(),
      grade: dto.grade ?? null,
      section: dto.section?.trim() || null,
    });
    return this.classRepo.save(c);
  }

  async updateClass(schoolId: string | null, id: string, dto: { name?: string; grade?: number; section?: string }) {
    const c = await this.classRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sınıf bulunamadı.' });
    await this.ensureSchoolScope(schoolId!, c.schoolId);
    if (dto.name != null) c.name = dto.name.trim();
    if (dto.grade !== undefined) c.grade = dto.grade ?? null;
    if (dto.section !== undefined) c.section = dto.section?.trim() || null;
    return this.classRepo.save(c);
  }

  async deleteClass(schoolId: string | null, id: string) {
    const c = await this.classRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sınıf bulunamadı.' });
    await this.ensureSchoolScope(schoolId!, c.schoolId);
    await this.classRepo.remove(c);
    return { ok: true };
  }

  async listSubjects(schoolId: string | null) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    return this.subjectRepo.find({
      where: { schoolId: schoolId! },
      order: { name: 'ASC' },
    });
  }

  async createSubject(schoolId: string | null, dto: { name: string; code?: string }) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const s = this.subjectRepo.create({
      schoolId: schoolId!,
      name: dto.name.trim(),
      code: dto.code?.trim() || null,
    });
    return this.subjectRepo.save(s);
  }

  async updateSubject(schoolId: string | null, id: string, dto: { name?: string; code?: string }) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ders bulunamadı.' });
    await this.ensureSchoolScope(schoolId!, s.schoolId);
    if (dto.name != null) s.name = dto.name.trim();
    if (dto.code !== undefined) s.code = dto.code?.trim() || null;
    return this.subjectRepo.save(s);
  }

  async deleteSubject(schoolId: string | null, id: string) {
    const s = await this.subjectRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ders bulunamadı.' });
    await this.ensureSchoolScope(schoolId!, s.schoolId);
    await this.subjectRepo.remove(s);
    return { ok: true };
  }

  /** Varsayılan MEB sınıfları ve derslerini ekler (mevcut olanları atlar). */
  async seedDefaults(schoolId: string | null) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const existingClasses = await this.classRepo.find({ where: { schoolId: schoolId! }, select: ['name'] });
    const existingSubjects = await this.subjectRepo.find({ where: { schoolId: schoolId! }, select: ['code', 'name'] });
    const existingClassNames = new Set(existingClasses.map((c) => c.name));
    const existingSubjectCodes = new Set(existingSubjects.filter((s) => s.code).map((s) => s.code!));
    const existingSubjectNames = new Set(existingSubjects.map((s) => s.name));

    let classesAdded = 0;
    let subjectsAdded = 0;

    for (const d of DEFAULT_CLASSES) {
      if (existingClassNames.has(d.name)) continue;
      const c = this.classRepo.create({
        schoolId: schoolId!,
        name: d.name,
        grade: d.grade,
        section: d.section,
      });
      await this.classRepo.save(c);
      existingClassNames.add(d.name);
      classesAdded++;
    }

    for (const d of DEFAULT_SUBJECTS) {
      const byCode = d.code && existingSubjectCodes.has(d.code);
      const byName = existingSubjectNames.has(d.name);
      if (byCode || byName) continue;
      const s = this.subjectRepo.create({
        schoolId: schoolId!,
        name: d.name,
        code: d.code,
      });
      await this.subjectRepo.save(s);
      existingSubjectCodes.add(d.code);
      existingSubjectNames.add(d.name);
      subjectsAdded++;
    }

    return { ok: true, classes_added: classesAdded, subjects_added: subjectsAdded };
  }
}
