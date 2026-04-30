import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSubject } from './entities/school-subject.entity';
import { Student } from '../students/entities/student.entity';
import { DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '../config/default-classes-subjects';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

@Injectable()
export class ClassesSubjectsService {
  constructor(
    @InjectRepository(SchoolClass)
    private readonly classRepo: Repository<SchoolClass>,
    @InjectRepository(SchoolSubject)
    private readonly subjectRepo: Repository<SchoolSubject>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
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

  async importClassesFromEokulPdf(
    schoolId: string | null,
    fileBuffer: Buffer,
    meta?: { city?: string; district?: string; originalName?: string },
  ) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    let parsedText = '';
    const lowerName = (meta?.originalName ?? '').toLowerCase();
    let rows: Array<{ name: string; grade: number | null; section: string | null; studentCount: number | null }> = [];

    if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) {
      rows = this.parseEokulClassRowsFromExcel(fileBuffer);
    } else {
      try {
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        parsedText = parsed?.text ?? '';
        await parser.destroy();
      } catch {
        throw new BadRequestException({
          code: 'PDF_PARSE_FAILED',
          message: 'PDF okunamadı. Lütfen e-Okul OOG01001R010 raporunu yeniden indirip tekrar deneyin.',
        });
      }
      rows = this.parseEokulClassRows(parsedText);
    }
    if (!rows.length) {
      return {
        ok: false,
        classes_added: 0,
        classes_skipped: 0,
        classes_updated: 0,
        parsed_rows: 0,
        message: 'PDF içinde sınıf/şube satırı bulunamadı.',
        city: meta?.city?.trim() || null,
        district: meta?.district?.trim() || null,
      };
    }

    const existing = await this.classRepo.find({ where: { schoolId: schoolId! } });
    const byName = new Map(existing.map((x) => [this.normalizeClassName(x.name), x]));

    let classesAdded = 0;
    let classesUpdated = 0;
    let classesSkipped = 0;

    for (const row of rows) {
      const existingClass = byName.get(this.normalizeClassName(row.name));
      if (!existingClass) {
        const created = this.classRepo.create({
          schoolId: schoolId!,
          name: row.name,
          grade: row.grade,
          section: row.section,
        });
        const saved = await this.classRepo.save(created);
        byName.set(this.normalizeClassName(saved.name), saved);
        classesAdded++;
        continue;
      }

      const nextGrade = existingClass.grade ?? row.grade;
      const nextSection = existingClass.section ?? row.section;
      const needsUpdate = existingClass.grade !== nextGrade || existingClass.section !== nextSection;
      if (!needsUpdate) {
        classesSkipped++;
        continue;
      }
      existingClass.grade = nextGrade;
      existingClass.section = nextSection;
      await this.classRepo.save(existingClass);
      classesUpdated++;
    }

    return {
      ok: true,
      parsed_rows: rows.length,
      classes_added: classesAdded,
      classes_updated: classesUpdated,
      classes_skipped: classesSkipped,
      city: meta?.city?.trim() || null,
      district: meta?.district?.trim() || null,
    };
  }

  async importSubjectsFromEokulProgramXls(schoolId: string | null, fileBuffer: Buffer) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const names = this.parseSubjectsFromTeacherProgramExcel(fileBuffer);
    if (!names.length) {
      return { ok: false, parsed_rows: 0, subjects_added: 0, subjects_skipped: 0, message: 'Ders bulunamadı.' };
    }

    const existing = await this.subjectRepo.find({ where: { schoolId: schoolId! }, select: ['name'] });
    const existingNames = new Set(existing.map((s) => this.normalizeSubjectName(s.name)));

    let subjectsAdded = 0;
    let subjectsSkipped = 0;
    for (const name of names) {
      const key = this.normalizeSubjectName(name);
      if (existingNames.has(key)) {
        subjectsSkipped++;
        continue;
      }
      const created = this.subjectRepo.create({ schoolId: schoolId!, name, code: null });
      await this.subjectRepo.save(created);
      existingNames.add(key);
      subjectsAdded++;
    }

    return { ok: true, parsed_rows: names.length, subjects_added: subjectsAdded, subjects_skipped: subjectsSkipped };
  }

  async listStudentsByClass(schoolId: string | null, classId: string) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId: schoolId! } });
    if (!cls) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Sınıf bulunamadı.' });
    return this.studentRepo.find({
      where: { schoolId: schoolId!, classId },
      order: { name: 'ASC' },
    });
  }

  async createStudentForClass(
    schoolId: string | null,
    classId: string,
    body: { name?: string; studentNumber?: string; firstName?: string; lastName?: string; gender?: string; birthDate?: string | null },
  ) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId: schoolId! } });
    if (!cls) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Sınıf bulunamadı.' });
    const firstName = body.firstName?.trim() || '';
    const lastName = body.lastName?.trim() || '';
    const composed = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
    const name = (body.name?.trim() || composed).trim();
    if (!name) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Öğrenci adı gerekli.' });
    const student = this.studentRepo.create({
      schoolId: schoolId!,
      classId,
      name,
      studentNumber: body.studentNumber?.trim() || null,
      firstName: firstName || null,
      lastName: lastName || null,
      gender: body.gender?.trim() || null,
      birthDate: body.birthDate?.trim() || null,
    });
    return this.studentRepo.save(student);
  }

  async updateStudentForClass(
    schoolId: string | null,
    studentId: string,
    body: { name?: string; studentNumber?: string | null; classId?: string | null; firstName?: string; lastName?: string; gender?: string | null; birthDate?: string | null },
  ) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId: schoolId! } });
    if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Öğrenci bulunamadı.' });
    if (body.classId !== undefined) {
      if (body.classId === null) {
        student.classId = null;
      } else {
        const cls = await this.classRepo.findOne({ where: { id: body.classId, schoolId: schoolId! } });
        if (!cls) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Sınıf bulunamadı.' });
        student.classId = body.classId;
      }
    }
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Öğrenci adı gerekli.' });
      student.name = name;
    }
    if (body.firstName !== undefined) student.firstName = body.firstName.trim() || null;
    if (body.lastName !== undefined) student.lastName = body.lastName.trim() || null;
    if (body.gender !== undefined) student.gender = body.gender?.trim() || null;
    if (body.birthDate !== undefined) student.birthDate = body.birthDate?.trim() || null;
    if (body.studentNumber !== undefined) {
      student.studentNumber = body.studentNumber?.trim() || null;
    }
    if (!body.name && (body.firstName !== undefined || body.lastName !== undefined)) {
      const composed = `${student.firstName ?? ''} ${student.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
      if (composed) student.name = composed;
    }
    return this.studentRepo.save(student);
  }

  async deleteStudentForClass(schoolId: string | null, studentId: string) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId: schoolId! } });
    if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Öğrenci bulunamadı.' });
    await this.studentRepo.remove(student);
    return { ok: true };
  }

  async deleteAllStudentsForClass(schoolId: string | null, classId: string) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const cls = await this.classRepo.findOne({ where: { id: classId, schoolId: schoolId! } });
    if (!cls) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Sınıf bulunamadı.' });
    await this.studentRepo.delete({ schoolId: schoolId!, classId });
    return { ok: true };
  }

  async importStudentsFromClassListExcel(schoolId: string | null, fileBuffer: Buffer) {
    await this.ensureSchoolScope(schoolId!, schoolId!);
    const parsed = this.parseStudentsFromClassListExcel(fileBuffer);
    if (!parsed.length) {
      return { ok: false, imported_students: 0, skipped_students: 0, parsed_rows: 0, message: 'Öğrenci satırı bulunamadı.' };
    }
    const classes = await this.classRepo.find({ where: { schoolId: schoolId! } });
    const classMap = new Map(classes.map((c) => [this.normalizeClassName(c.name), c]));
    const classByGradeSection = new Map<string, SchoolClass>();
    for (const c of classes) {
      const key = this.gradeSectionKey(c.grade, c.section);
      if (key) classByGradeSection.set(key, c);
    }
    const existing = await this.studentRepo.find({ where: { schoolId: schoolId! } });
    const studentKeys = new Set(
      existing.map((s) => `${s.classId ?? ''}|${this.normalizeSubjectName(s.name)}|${(s.studentNumber ?? '').trim()}`),
    );

    let imported = 0;
    let skipped = 0;

    for (const row of parsed) {
      const classKey = this.normalizeClassName(row.className);
      let cls = classMap.get(classKey);
      if (!cls) {
        const gsKey = this.gradeSectionKey(row.grade, row.section);
        if (gsKey) cls = classByGradeSection.get(gsKey);
      }
      if (!cls) {
        cls = await this.classRepo.save(
          this.classRepo.create({
            schoolId: schoolId!,
            name: row.className,
            grade: row.grade,
            section: row.section,
          }),
        );
        classMap.set(classKey, cls);
        const gsKey = this.gradeSectionKey(cls.grade, cls.section);
        if (gsKey) classByGradeSection.set(gsKey, cls);
      }
      const key = `${cls.id}|${this.normalizeSubjectName(row.name)}|${(row.studentNumber ?? '').trim()}`;
      if (studentKeys.has(key)) {
        skipped++;
        continue;
      }
      await this.studentRepo.save(
        this.studentRepo.create({
          schoolId: schoolId!,
          classId: cls.id,
          name: row.name,
          firstName: row.firstName,
          lastName: row.lastName,
          studentNumber: row.studentNumber || null,
          gender: row.gender,
          birthDate: row.birthDate,
        }),
      );
      studentKeys.add(key);
      imported++;
    }
    return { ok: true, imported_students: imported, skipped_students: skipped, parsed_rows: parsed.length };
  }

  private normalizeClassName(value: string): string {
    return value
      .toLocaleUpperCase('tr-TR')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanSchoolType(value: string): string {
    return value
      .replace(/^\s*(\d{1,3}\s+){2,4}/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSubjectName(value: string): string {
    return value
      .toLocaleUpperCase('tr-TR')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private gradeSectionKey(grade: number | null | undefined, section: string | null | undefined): string | null {
    if (!grade || !section) return null;
    return `${grade}|${section.toLocaleUpperCase('tr-TR').trim()}`;
  }

  private parseSubjectsFromTeacherProgramExcel(fileBuffer: Buffer): string[] {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
    const seen = new Set<string>();
    const names: string[] = [];

    for (const row of data) {
      for (const cellRaw of row) {
        const cell = String(cellRaw ?? '').trim();
        if (!cell) continue;
        if (!cell.includes('<->')) continue;
        const parts = cell.split(',').map((x) => x.trim()).filter(Boolean);
        for (const part of parts) {
          const left = part.split('<->')[0]?.trim();
          if (!left) continue;
          const cleaned = left.replace(/\s+/g, ' ').trim();
          if (!cleaned || cleaned.length < 2) continue;
          const key = this.normalizeSubjectName(cleaned);
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(cleaned);
        }
      }
    }
    return names;
  }

  private parseEokulClassRows(text: string): Array<{ name: string; grade: number | null; section: string | null; studentCount: number | null }> {
    const lines = text
      .split(/\r?\n/)
      .map((x) => x.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const rows: Array<{ name: string; grade: number | null; section: string | null; studentCount: number | null }> = [];
    const seen = new Set<string>();
    let currentGrade: number | null = null;

    for (const line of lines) {
      const upper = line.toLocaleUpperCase('tr-TR');
      if (
        upper.includes('SINIF ŞUBE ÖĞRENCİ SAYILARI') ||
        upper.includes('TOPLAM') ||
        upper.includes('GENEL TOPLAM') ||
        upper.includes('RAPOR') ||
        upper.includes('E-OKUL')
      ) {
        continue;
      }

      const gradeHeader = upper.match(/^(\d{1,2})\s*\.?\s*SINIF$/);
      if (gradeHeader) {
        currentGrade = parseInt(gradeHeader[1], 10);
        continue;
      }

      const patterns: RegExp[] = [
        /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(.+?)\s*-\s*(\d{1,2})\.\s*SINIF\s*\/\s*([A-ZÇĞİÖŞÜ0-9]{1,6})\s*ŞUBESİ\s*\((.+?)\)/i,
        /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+.*?(\d{1,2})\.\s*SINIF\s*\/\s*([A-ZÇĞİÖŞÜ0-9]{1,6})\s*ŞUBESİ/i,
        /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+.*?(\d{1,2})\.\s*SINIF\s*\/\s*([A-ZCĞİÖŞÜ0-9]{1,6})\s*SUBESI/i,
        /^(\d{1,2})\s*[/.-]?\s*([A-ZÇĞİÖŞÜ0-9]{1,4})\s+(\d{1,3})$/i,
        /^(\d{1,2})\s*\.?\s*SINIF\s+([A-ZÇĞİÖŞÜ0-9]{1,4})\s+(\d{1,3})$/i,
        /^([A-ZÇĞİÖŞÜ0-9]{1,4})\s+(\d{1,3})$/i,
      ];

      for (const pattern of patterns) {
        const m = line.match(pattern);
        if (!m) continue;

        let grade: number | null = null;
        let section = '';
        let studentCount: number | null = null;

        if (pattern === patterns[0]) {
          studentCount = parseInt(m[3], 10);
          grade = parseInt(m[5], 10);
          section = (m[6] ?? '').toLocaleUpperCase('tr-TR');
          const schoolType = this.cleanSchoolType((m[4] ?? '').trim());
          const field = (m[7] ?? '').trim().replace(/\s+/g, ' ');
          if (!grade || !section) break;
          if (!Number.isFinite(studentCount) || studentCount! <= 0 || studentCount! > 200) break;
          const nameWithField = `${schoolType} - ${grade}/${section} (${field})`;
          const keyWithField = this.normalizeClassName(nameWithField);
          if (seen.has(keyWithField)) break;
          seen.add(keyWithField);
          rows.push({ name: nameWithField, grade, section, studentCount });
          break;
        } else if (pattern === patterns[1]) {
          studentCount = parseInt(m[3], 10);
          grade = parseInt(m[4], 10);
          section = (m[5] ?? '').toLocaleUpperCase('tr-TR');
        } else if (pattern === patterns[2] || pattern === patterns[3]) {
          grade = parseInt(m[1], 10);
          section = (m[2] ?? '').toLocaleUpperCase('tr-TR');
          studentCount = parseInt(m[3], 10);
        } else {
          if (!currentGrade) break;
          grade = currentGrade;
          section = (m[1] ?? '').toLocaleUpperCase('tr-TR');
          studentCount = parseInt(m[2], 10);
        }

        if (!grade || !section) break;
        if (!Number.isFinite(studentCount) || studentCount! <= 0 || studentCount! > 200) break;

        const name = `${grade}/${section}`;
        const key = this.normalizeClassName(name);
        if (seen.has(key)) break;
        seen.add(key);
        rows.push({ name, grade, section, studentCount });
        break;
      }

      // Fallback: satır yapısı dağınıksa "X. Sınıf / Y Şubesi" bilgisini çek.
      const compact = upper
        .replace(/İ/g, 'I')
        .replace(/Ş/g, 'S')
        .replace(/Ü/g, 'U')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .replace(/Ğ/g, 'G');
      const fallback = compact.match(/(.+?)\s*-\s*(\d{1,2})\.\s*SINIF\s*\/\s*([A-Z0-9]{1,6})\s*SUBESI(?:\s*\((.+?)\))?/);
      if (!fallback) continue;
      const schoolType = this.cleanSchoolType((fallback[1] ?? '').trim());
      const grade = parseInt(fallback[2], 10);
      const section = (fallback[3] ?? '').toLocaleUpperCase('tr-TR');
      const field = (fallback[4] ?? '').trim().replace(/\s+/g, ' ');
      const nums = compact.match(/\b\d{1,3}\b/g) ?? [];
      const studentCount = nums.length >= 3 ? parseInt(nums[2], 10) : null;
      if (!grade || !section) continue;
      if (studentCount != null && (!Number.isFinite(studentCount) || studentCount <= 0 || studentCount > 200)) continue;
      const name = field ? `${schoolType} - ${grade}/${section} (${field})` : `${schoolType} - ${grade}/${section}`;
      const key = this.normalizeClassName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ name, grade, section, studentCount });
    }
    return rows;
  }

  private parseEokulClassRowsFromExcel(
    fileBuffer: Buffer,
  ): Array<{ name: string; grade: number | null; section: string | null; studentCount: number | null }> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
    const rows: Array<{ name: string; grade: number | null; section: string | null; studentCount: number | null }> = [];
    const seen = new Set<string>();

    for (const row of data) {
      const text = row.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
      if (!text) continue;
      const upper = text.toLocaleUpperCase('tr-TR');
      if (!upper.includes('SINIF') || !upper.includes('ŞUBE')) continue;

      const m = text.match(/(.+?)\s*-\s*(\d{1,2})\.\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ0-9]{1,6})\s*Şubesi(?:\s*\((.+?)\))?/i);
      if (!m) continue;

      const schoolType = this.cleanSchoolType((m[1] ?? '').trim());
      const grade = parseInt(m[2], 10);
      const section = (m[3] ?? '').toLocaleUpperCase('tr-TR');
      const field = (m[4] ?? '').trim().replace(/\s+/g, ' ');
      const totals = text.match(/(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
      const studentCount = totals ? parseInt(totals[3], 10) : null;
      if (!grade || !section) continue;
      if (studentCount != null && (!Number.isFinite(studentCount) || studentCount <= 0 || studentCount > 200)) continue;

      const name = field ? `${schoolType} - ${grade}/${section} (${field})` : `${schoolType} - ${grade}/${section}`;
      const key = this.normalizeClassName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ name, grade, section, studentCount });
    }

    return rows;
  }

  private excelSerialToDate(value: number): string | null {
    if (!Number.isFinite(value) || value <= 0) return null;
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${date.y}-${mm}-${dd}`;
  }

  private parseStudentsFromClassListExcel(
    fileBuffer: Buffer,
  ): Array<{
    className: string;
    grade: number | null;
    section: string | null;
    name: string;
    firstName: string | null;
    lastName: string | null;
    studentNumber: string | null;
    gender: string | null;
    birthDate: string | null;
  }> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
    const parsed: Array<{
      className: string;
      grade: number | null;
      section: string | null;
      name: string;
      firstName: string | null;
      lastName: string | null;
      studentNumber: string | null;
      gender: string | null;
      birthDate: string | null;
    }> = [];

    let currentClassName: string | null = null;
    let currentGrade: number | null = null;
    let currentSection: string | null = null;
    let dataStarted = false;

    for (const row of rows) {
      const joined = row.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
      if (!joined) continue;

      const classMatch = joined.match(/(.+?)\s+(\d{1,2})\.\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ0-9]{1,6})\s*Şubesi(?:\s*\((.+?)\))?\s*Sınıf Listesi/i);
      if (classMatch) {
        const schoolType = this.cleanSchoolType((classMatch[1] ?? '').trim());
        const grade = parseInt(classMatch[2], 10);
        const section = (classMatch[3] ?? '').toLocaleUpperCase('tr-TR');
        const field = (classMatch[4] ?? '').trim();
        currentClassName = field ? `${schoolType} - ${grade}/${section} (${field})` : `${schoolType} - ${grade}/${section}`;
        currentGrade = grade;
        currentSection = section;
        dataStarted = false;
        continue;
      }

      if (!currentClassName) continue;
      if (/S\.?No/i.test(joined) && /Öğrenci No/i.test(joined) && /Adı/i.test(joined) && /Soyadı/i.test(joined)) {
        dataStarted = true;
        continue;
      }
      if (!dataStarted) continue;
      const sno = String(row[0] ?? '').trim();
      if (!/^\d+$/.test(sno)) continue;

      const studentNumber = String(row[1] ?? '').trim() || null;
      const firstName = String(row[3] ?? '').trim();
      const lastName = String(row[6] ?? '').trim();
      const genderRaw = String(row[10] ?? '').trim();
      const gender = genderRaw ? (genderRaw.toLocaleLowerCase('tr-TR').startsWith('k') ? 'Kız' : genderRaw.toLocaleLowerCase('tr-TR').startsWith('e') ? 'Erkek' : genderRaw) : null;
      const birthRaw = row[11];
      const birthDate =
        typeof birthRaw === 'number'
          ? this.excelSerialToDate(birthRaw)
          : String(birthRaw ?? '').trim().match(/^\d{4}-\d{2}-\d{2}$/)
            ? String(birthRaw).trim()
            : null;
      const name = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
      if (!name) continue;
      parsed.push({
        className: currentClassName,
        grade: currentGrade,
        section: currentSection,
        name,
        firstName: firstName || null,
        lastName: lastName || null,
        studentNumber,
        gender,
        birthDate,
      });
    }
    return parsed;
  }
}
