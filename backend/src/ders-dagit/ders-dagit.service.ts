import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import {
  DersDagitStudio,
  DersDagitClassProfile,
  DersDagitTeacherConfig,
  DersDagitSubject,
  DersDagitGroup,
  DersDagitElectivePool,
  DersDagitBuilding,
  DersDagitRoom,
  DersDagitAssignment,
  DersDagitAssignmentTeacher,
  DersDagitRuleSet,
  DersDagitPreference,
  DersDagitRequest,
  DersDagitProgram,
  DersDagitProgramEntry,
  DersDagitGenerationJob,
  DersDagitAuditLog,
} from './entities';
import { buildDefaultRuleState, DERS_DAGIT_RULE_CATALOG } from './ders-dagit.rules';
import {
  applySchoolPedagogyRules,
  buildStrictRuleKeys,
  mergePlanningRelationsIntoRules,
  validatePlanningRelationsForGenerate,
} from './ders-dagit.rules-merge';
import { internshipDaysBySectionFromProfiles, normalizeInternshipDays } from './ders-dagit.internship';
import {
  ADVANCED_PLANNING_RULES,
  SIMPLE_PLANNING_RULES,
  importanceWeight,
  relationDefinition,
  type PlanningRelationRow,
} from './ders-dagit.planning-relations';
import { compareClassSections, sortClassSections, sortValidationIssues } from './class-section-sort';
import {
  countClassSectionsFromProfiles,
  validateStudioData,
  type ValidationIssue,
} from './ders-dagit.validation';
import { enrichValidationIssues } from './ders-dagit.validation-fix-hints';
import { runCspSolver } from './ders-dagit.solver-csp';
import { runConstraintSolver, type SolverAssignment, type SolverContext } from './ders-dagit.solver';
import { expandAssignmentsForSolver } from './ders-dagit.solver-input';
import { linkGenerationViolations } from './ders-dagit.generation-hints';
import { DutySlot } from '../duty/entities/duty-slot.entity';
import { randomBytes } from 'crypto';
import { improveWithLocalSearch } from './ders-dagit.local-search';
import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import { GROUP_MODE_CATALOG, normalizeGroupMode, type DersDagitGroupMode } from './ders-dagit.groups';
import { suggestGroupsFromData, suggestionExists } from './ders-dagit.group-suggest';
import {
  aggregatePlanImportRows,
  subjectsFromPlanRows,
  type PlanImportRow,
} from './ders-dagit.plan-import';
import {
  parseStudioPeriod,
  blockedLessonNums,
  maxLessonsForDay,
  lunchAfterLesson,
  type StudioPeriodConfig,
} from './ders-dagit.period';
import {
  parseSectionSchedules,
  sectionSchedulesToJson,
  type SectionScheduleConfig,
} from './ders-dagit.section-schedule';
import {
  parseDualEducation,
  pmFirstLessonNum,
  normalizeEducationShift,
  type DualEducationConfig,
  type EducationShift,
} from './ders-dagit.dual-education';
import { parseSchoolProfile, type StudioSchoolProfile } from './ders-dagit.school-profile';
import {
  clusterElectiveImportRows,
  checkAihlWeeklyNorm,
  isElectiveSubjectName,
} from './ders-dagit.elective';
import { dutySlotsToUnavailable, findDutyPlacementConflicts } from './ders-dagit.duty-sync';
import { teacherHourNormFromSchool } from './ders-dagit.extra-lesson-sync';
import { computeProgramClashes } from './ders-dagit.program-clash';
import archiver = require('archiver');
import { ExtraLessonParams } from '../extra-lesson-params/entities/extra-lesson-params.entity';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { AppConfigService } from '../app-config/app-config.service';
import {
  buildTtkbSeedCells,
  mergeCellsToSubjects,
  gradeFromClassSection,
} from './ders-dagit.ttkb-seed';
import { parseEokulImport, buildEokulImportTemplateXlsx } from './ders-dagit.eokul-import';
import {
  buildProgramGridCsv,
  buildProgramGridXlsx,
  buildAssignmentImportTemplateXlsx,
  type ExportEntry,
} from './ders-dagit.export';
import {
  buildEokulScheduleCsv,
  buildEokulScheduleXlsx,
  buildEokulReportCsv,
  validateEokulExport,
  type EokulExportRow,
} from './ders-dagit.eokul-export';
import { DersDagitPdfService } from './ders-dagit-pdf.service';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from '../teacher-timetable/entities/school-timetable-plan-entry.entity';
import { UserRole } from '../types/enums';
import {
  TeacherTimetableService,
  type TimetableEntry,
} from '../teacher-timetable/teacher-timetable.service';

@Injectable()
export class DersDagitService {
  constructor(
    @InjectRepository(DersDagitStudio) private readonly studioRepo: Repository<DersDagitStudio>,
    @InjectRepository(DersDagitClassProfile) private readonly classProfileRepo: Repository<DersDagitClassProfile>,
    @InjectRepository(DersDagitTeacherConfig) private readonly teacherConfigRepo: Repository<DersDagitTeacherConfig>,
    @InjectRepository(DersDagitSubject) private readonly subjectRepo: Repository<DersDagitSubject>,
    @InjectRepository(DersDagitGroup) private readonly groupRepo: Repository<DersDagitGroup>,
    @InjectRepository(DersDagitElectivePool) private readonly electivePoolRepo: Repository<DersDagitElectivePool>,
    @InjectRepository(DersDagitBuilding) private readonly buildingRepo: Repository<DersDagitBuilding>,
    @InjectRepository(DersDagitRoom) private readonly roomRepo: Repository<DersDagitRoom>,
    @InjectRepository(DersDagitAssignment) private readonly assignmentRepo: Repository<DersDagitAssignment>,
    @InjectRepository(DersDagitAssignmentTeacher) private readonly assignmentTeacherRepo: Repository<DersDagitAssignmentTeacher>,
    @InjectRepository(DersDagitRuleSet) private readonly ruleSetRepo: Repository<DersDagitRuleSet>,
    @InjectRepository(DersDagitPreference) private readonly preferenceRepo: Repository<DersDagitPreference>,
    @InjectRepository(DersDagitRequest) private readonly requestRepo: Repository<DersDagitRequest>,
    @InjectRepository(DersDagitProgram) private readonly programRepo: Repository<DersDagitProgram>,
    @InjectRepository(DersDagitProgramEntry) private readonly programEntryRepo: Repository<DersDagitProgramEntry>,
    @InjectRepository(DersDagitGenerationJob) private readonly jobRepo: Repository<DersDagitGenerationJob>,
    @InjectRepository(DersDagitAuditLog) private readonly auditRepo: Repository<DersDagitAuditLog>,
    @InjectRepository(SchoolTimetablePlan) private readonly schoolPlanRepo: Repository<SchoolTimetablePlan>,
    @InjectRepository(SchoolTimetablePlanEntry)
    private readonly schoolPlanEntryRepo: Repository<SchoolTimetablePlanEntry>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly teacherTimetable: TeacherTimetableService,
    private readonly pdfService: DersDagitPdfService,
    @InjectRepository(DutySlot) private readonly dutySlotRepo: Repository<DutySlot>,
    @InjectRepository(ExtraLessonParams) private readonly extraLessonParamsRepo: Repository<ExtraLessonParams>,
    @InjectRepository(YillikPlanIcerik) private readonly yillikPlanRepo: Repository<YillikPlanIcerik>,
    private readonly appConfig: AppConfigService,
  ) {}

  private requireSchool(schoolId: string | null | undefined): string {
    if (!schoolId) throw new ForbiddenException({ code: 'NO_SCHOOL', message: 'Okul bağlamı gerekli.' });
    return schoolId;
  }

  async audit(studioId: string, userId: string | null, action: string, detail: Record<string, unknown> = {}) {
    await this.auditRepo.save({ studio_id: studioId, user_id: userId, action, detail });
  }

  async getOrCreateStudio(schoolId: string, userId: string, academicYear?: string): Promise<DersDagitStudio> {
    const year = academicYear?.trim() || this.defaultAcademicYear();
    let studio = await this.studioRepo.findOne({ where: { school_id: schoolId, academic_year: year } });
    if (studio) return studio;
    try {
      studio = await this.studioRepo.save({
        school_id: schoolId,
        academic_year: year,
        name: `${year} DersDağıt`,
        workflow_status: 'setup',
        settings: {},
        created_by: userId,
      });
      await this.ruleSetRepo.save({
        studio_id: studio.id,
        rules: buildDefaultRuleState(),
        building_travel: [],
        planning_relations: [],
      });
      await this.audit(studio.id, userId, 'studio.created', { academic_year: year });
      return studio;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        const existing = await this.studioRepo.findOne({ where: { school_id: schoolId, academic_year: year } });
        if (existing) return existing;
      }
      throw err;
    }
  }

  defaultAcademicYear(): string {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  async listStudios(schoolId: string) {
    return this.studioRepo.find({ where: { school_id: schoolId }, order: { updated_at: 'DESC' } });
  }

  async getStudioOverview(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const [
      classCount,
      teacherCount,
      subjectCount,
      groupCount,
      assignmentCount,
      programCount,
      ruleSet,
      validation,
    ] = await Promise.all([
      this.classProfileRepo
        .find({ where: { studio_id: studioId }, select: ['class_sections'] })
        .then((rows) => countClassSectionsFromProfiles(rows)),
      this.teacherConfigRepo.count({ where: { studio_id: studioId } }),
      this.subjectRepo.count({ where: { studio_id: studioId } }),
      this.groupRepo.count({ where: { studio_id: studioId } }),
      this.assignmentRepo.count({ where: { studio_id: studioId } }),
      this.programRepo.count({ where: { studio_id: studioId } }),
      this.ruleSetRepo.findOne({ where: { studio_id: studioId } }),
      this.runValidation(studioId),
    ]);
    const health = this.computeHealthScore({
      classCount,
      teacherCount,
      assignmentCount,
      errors: validation.filter((v) => v.severity === 'error').length,
    });
    if (studio.health_score !== health) {
      await this.studioRepo.update(studioId, { health_score: health });
      studio.health_score = health;
    }
    return {
      studio,
      counts: { classCount, teacherCount, subjectCount, groupCount, assignmentCount, programCount },
      ruleSet,
      rule_catalog: DERS_DAGIT_RULE_CATALOG,
      validation,
      health_score: health,
    };
  }

  computeHealthScore(args: {
    classCount: number;
    teacherCount: number;
    assignmentCount: number;
    errors: number;
  }): number {
    let s = 0;
    if (args.classCount >= 2) s += 25;
    if (args.teacherCount >= 2) s += 25;
    if (args.assignmentCount > 0) s += 30;
    if (args.errors === 0 && args.assignmentCount > 0) s += 20;
    return Math.min(100, Math.max(0, s - args.errors * 5));
  }

  async runValidation(studioId: string): Promise<ValidationIssue[]> {
    const profiles = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    const teacherRows = await this.listTeacherConfigs(studioId);
    const subjects = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const groups = await this.groupRepo.find({ where: { studio_id: studioId } });

    const subjects_by_class: Record<string, number> = {};
    for (const sub of subjects) {
      for (const [sec, hrs] of Object.entries(sub.class_hours ?? {})) {
        subjects_by_class[sec] = (subjects_by_class[sec] ?? 0) + (hrs as number);
      }
    }
    for (const a of assignments) {
      const hrs = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      for (const sec of a.class_sections) {
        subjects_by_class[sec] = (subjects_by_class[sec] ?? 0) + hrs;
      }
    }

    const teacher_hours: Record<string, { assigned: number; max?: number | null; min?: number | null }> = {};
    for (const t of teacherRows) {
      teacher_hours[t.user_id] = {
        assigned: 0,
        max: (t.mandatory_weekly_hours ?? 0) + (t.max_extra_weekly_hours ?? 0) || null,
        min: t.mandatory_weekly_hours,
      };
    }
    const links = await this.assignmentTeacherRepo.find({
      where: { assignment_id: In(assignments.map((a) => a.id)) },
    });
    const byAssign = new Map<string, string[]>();
    for (const l of links) {
      const arr = byAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      byAssign.set(l.assignment_id, arr);
    }
    for (const a of assignments) {
      const hrs = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      for (const uid of byAssign.get(a.id) ?? []) {
        if (!teacher_hours[uid]) teacher_hours[uid] = { assigned: 0 };
        teacher_hours[uid].assigned += hrs;
      }
    }

    const issues = validateStudioData({
      class_profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        class_sections: sortClassSections(p.class_sections ?? []),
        max_lessons_per_day: p.max_lessons_per_day,
        min_weekly_lessons: p.min_weekly_lessons,
        max_weekly_lessons: p.max_weekly_lessons,
      })),
      teachers: teacherRows.map((t) => ({
        id: t.user_id,
        name: (t as { display_name?: string }).display_name ?? t.user_id,
      })),
      subjects_by_class,
      assignments: assignments.map((a) => ({
        id: a.id,
        class_sections: sortClassSections(a.class_sections ?? []),
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
        group_id: a.group_id,
        room_ids: a.room_ids,
      })),
      groups: groups.map((g) => ({ id: g.id, abbreviation: g.abbreviation })),
      teacher_hours,
    });
    const tIds = teacherRows.map((t) => t.user_id);
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['school_id', 'settings'] });
    if (studio) {
      const settings = (studio.settings ?? {}) as Record<string, unknown>;
      const profile = parseSchoolProfile(settings.school_profile);
      for (const n of checkAihlWeeklyNorm(profile, assignments)) {
        issues.push({
          code: 'AIHL_NORM_EXCEEDED',
          severity: n.severity,
          message: `${n.subject_name}: ${n.assigned} saat (üst sınır ${n.max})`,
          fix_hint: 'Atama saatlerini MEB AİHL normuna göre düzenleyin.',
          href: '/ders-dagit/studyo/atamalar',
        });
      }
    }
    if (studio?.school_id && tIds.length) {
      const dutyCount = await this.dutySlotRepo
        .createQueryBuilder('s')
        .innerJoin('s.duty_plan', 'p')
        .where('p.school_id = :schoolId', { schoolId: studio.school_id })
        .andWhere('s.user_id IN (:...ids)', { ids: tIds })
        .andWhere('s.deleted_at IS NULL')
        .andWhere('p.deleted_at IS NULL')
        .andWhere('p.archived_at IS NULL')
        .andWhere('p.status = :published', { published: 'published' })
        .getCount();
      if (dutyCount > 0) {
        issues.push({
          code: 'DUTY_SLOTS_ACTIVE',
          severity: 'error',
          message: `${dutyCount} yayınlı nöbet slotu — üretimde bu saatlerde ders konmaz; çakışma hata sayılır.`,
          fix_hint: 'Nöbet planını kontrol edin veya DersDağıt’ta nöbet senkronunu çalıştırın.',
          href: '/nobet',
        });
      }
    }
    return enrichValidationIssues(sortValidationIssues(issues));
  }

  // --- Class profiles (Faz 3) ---
  async listClassProfiles(studioId: string) {
    const rows = await this.classProfileRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
    return rows.map((p) => ({
      ...p,
      class_sections: sortClassSections(p.class_sections ?? []),
    }));
  }

  async upsertClassProfile(studioId: string, dto: Partial<DersDagitClassProfile>) {
    const name = typeof dto.name === 'string' ? dto.name.trim() : '';
    if (!name) throw new BadRequestException('Profil adı gerekli');
    const sections = sortClassSections(
      Array.isArray(dto.class_sections)
        ? [...new Set(dto.class_sections.map((s) => String(s).trim()).filter(Boolean))]
        : [],
    );
    if (!sections.length) throw new BadRequestException('En az bir şube girin');

    const others = await this.classProfileRepo.find({
      where: { studio_id: studioId },
      select: ['id', 'name', 'class_sections'],
    });
    const normName = name.toLocaleLowerCase('tr');
    const nameDup = others.find((p) => p.id !== dto.id && p.name.trim().toLocaleLowerCase('tr') === normName);
    if (nameDup) {
      throw new BadRequestException(`"${name}" adlı profil zaten var. Düzenlemek için listeden seçin.`);
    }
    const sectionConflicts: string[] = [];
    for (const p of others) {
      if (p.id === dto.id) continue;
      for (const s of p.class_sections ?? []) {
        if (sections.includes(s)) sectionConflicts.push(`${s} → ${p.name}`);
      }
    }
    if (sectionConflicts.length) {
      throw new BadRequestException(
        `Şubeler başka profilde: ${sectionConflicts.slice(0, 5).join(', ')}${sectionConflicts.length > 5 ? '…' : ''}`,
      );
    }

    const payload = {
      ...dto,
      name,
      class_sections: sections,
      studio_id: studioId,
      internship_days: normalizeInternshipDays(dto.internship_days),
    };
    if (dto.id) {
      const row = await this.classProfileRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.classProfileRepo.save({ ...row, ...payload });
    }
    return this.classProfileRepo.save(payload as DersDagitClassProfile);
  }

  async deleteClassProfile(id: string, studioId: string) {
    const res = await this.classProfileRepo.delete({ id, studio_id: studioId });
    if (!res.affected) throw new NotFoundException('Profil bulunamadı');
    return { ok: true as const };
  }

  // --- Teachers (Faz 4) ---
  async syncTeachersFromSchool(studioId: string, schoolId: string) {
    const users = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.teacher },
      select: ['id', 'display_name', 'email'],
    });
    for (const u of users) {
      const exists = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: u.id } });
      if (!exists) {
        await this.teacherConfigRepo.save({ studio_id: studioId, user_id: u.id, constraints: {} });
      }
    }
    return this.teacherConfigRepo.find({ where: { studio_id: studioId } });
  }

  async listTeacherConfigs(studioId: string) {
    const rows = await this.teacherConfigRepo.find({ where: { studio_id: studioId } });
    const userIds = rows.map((r) => r.user_id);
    const users =
      userIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'display_name', 'email'],
          })
        : [];
    const nameMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    return rows.map((r) => ({
      ...r,
      display_name: nameMap.get(r.user_id) ?? r.user_id.slice(0, 8),
    }));
  }

  async upsertTeacherConfig(studioId: string, dto: Partial<DersDagitTeacherConfig>) {
    if (dto.id) {
      const row = await this.teacherConfigRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.teacherConfigRepo.save({ ...row, ...dto });
    }
    return this.teacherConfigRepo.save({ ...dto, studio_id: studioId } as DersDagitTeacherConfig);
  }

  // --- Subjects (Faz 5) ---
  async listSubjects(studioId: string) {
    return this.subjectRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
  }

  async upsertSubject(studioId: string, dto: Partial<DersDagitSubject>) {
    if (dto.id) {
      const row = await this.subjectRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.subjectRepo.save({ ...row, ...dto });
    }
    return this.subjectRepo.save({ ...dto, studio_id: studioId } as DersDagitSubject);
  }

  // --- Groups / Divisions (Faz 6-9) ---
  async listGroups(studioId: string) {
    const rows = await this.groupRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
    return { groups: rows, catalog: GROUP_MODE_CATALOG };
  }

  async suggestGroups(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const [sections, assignments, existing] = await Promise.all([
      this.collectStudioSections(studioId, schoolId),
      this.assignmentRepo.find({ where: { studio_id: studioId } }),
      this.groupRepo.find({ where: { studio_id: studioId } }),
    ]);
    const suggestions = suggestGroupsFromData({
      sections,
      assignments: assignments.map((a) => ({
        subject_name: a.subject_name,
        class_sections: a.class_sections ?? [],
        options: (a.options ?? null) as Record<string, unknown> | null,
      })),
      existing: existing.map((g) => ({
        member_sections: g.member_sections ?? [],
        parallel_mode: g.parallel_mode,
      })),
    });
    return {
      catalog: GROUP_MODE_CATALOG,
      suggestions: suggestions.map((s) => ({
        ...s,
        already_exists: suggestionExists(s, existing),
      })),
    };
  }

  async applyGroupSuggestions(
    studioId: string,
    userId: string,
    body: { keys?: string[]; apply_all?: boolean },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    const schoolId = studio.school_id;
    const { suggestions: raw } = await this.suggestGroups(studioId, schoolId);
    const pick = body.apply_all
      ? raw.filter((s) => !s.already_exists)
      : raw.filter((s) => !s.already_exists && body.keys?.includes(s.key));
    let created = 0;
    for (const s of pick) {
      await this.upsertGroup(studioId, {
        name: s.name,
        abbreviation: s.abbreviation.slice(0, 8),
        parallel_mode: s.parallel_mode,
        member_sections: s.member_sections,
      });
      created++;
    }
    await this.audit(studioId, userId, 'groups.applied_suggestions', { created, keys: pick.map((p) => p.key) });
    return { created, skipped: raw.length - pick.length };
  }

  async deleteGroup(id: string, studioId: string) {
    await this.groupRepo.delete({ id, studio_id: studioId });
  }

  async upsertGroup(studioId: string, dto: Partial<DersDagitGroup>) {
    const mode = normalizeGroupMode(dto.parallel_mode ?? undefined);
    const member_sections = (dto.member_sections ?? []).map((s) => String(s).trim()).filter(Boolean);
    const prev = dto.id
      ? await this.groupRepo.findOne({ where: { id: dto.id, studio_id: studioId } })
      : null;
    const ms =
      member_sections.length > 0 ? member_sections : (prev?.member_sections ?? []);
    if ((mode === 'subgroups' || mode === 'parallel_rooms') && ms.length < 2) {
      throw new BadRequestException({
        code: 'GROUP_NEEDS_MEMBERS',
        message: 'Bu mod için en az iki alt şube (örn. 5A-A, 5A-B) gerekli.',
      });
    }
    const payload = { ...dto, parallel_mode: mode, member_sections: ms, studio_id: studioId };
    if (dto.id) {
      const row = await this.groupRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.groupRepo.save({ ...row, ...payload });
    }
    return this.groupRepo.save(payload as DersDagitGroup);
  }

  // --- Elective pools (Faz 37) ---
  async listElectivePools(studioId: string) {
    return this.electivePoolRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
  }

  async upsertElectivePool(studioId: string, dto: Partial<DersDagitElectivePool>) {
    const member_sections = (dto.member_sections ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (member_sections.length < 2) {
      throw new BadRequestException({
        code: 'ELECTIVE_NEEDS_MEMBERS',
        message: 'Seçmeli havuz için en az iki alt şube gerekli.',
      });
    }
    const payload = {
      ...dto,
      studio_id: studioId,
      member_sections,
      subject_names: (dto.subject_names ?? []).map((s) => String(s).trim()).filter(Boolean),
      weekly_hours_per_track: dto.weekly_hours_per_track ?? 2,
    };
    if (dto.id) {
      const row = await this.electivePoolRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.electivePoolRepo.save({ ...row, ...payload });
    }
    return this.electivePoolRepo.save(payload as DersDagitElectivePool);
  }

  async deleteElectivePool(id: string, studioId: string) {
    await this.electivePoolRepo.delete({ id, studio_id: studioId });
  }

  async syncElectivePoolGroup(studioId: string, poolId: string) {
    const pool = await this.electivePoolRepo.findOne({ where: { id: poolId, studio_id: studioId } });
    if (!pool) throw new NotFoundException();
    const abbr = `${pool.base_section}`.replace(/\s+/g, '').slice(0, 6).toLowerCase();
    const group = await this.upsertGroup(studioId, {
      id: pool.group_id ?? undefined,
      name: pool.name,
      abbreviation: `el-${abbr}`.slice(0, 8),
      parallel_mode: 'subgroups',
      member_sections: pool.member_sections,
    });
    pool.group_id = group.id;
    await this.electivePoolRepo.save(pool);
    return { pool, group };
  }

  async previewApplyElectivePoolAssignments(studioId: string, poolId: string) {
    const pool = await this.electivePoolRepo.findOne({ where: { id: poolId, studio_id: studioId } });
    if (!pool) throw new NotFoundException();
    const subjects = pool.subject_names.length > 0 ? pool.subject_names : ['Seçmeli'];
    const existing = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const lines: Array<{ subject_name: string; class_section: string; exists: boolean }> = [];
    let would_create = 0;
    let would_update = 0;
    for (const sub of subjects) {
      for (const sec of pool.member_sections) {
        const hit = existing.find(
          (a) =>
            a.subject_name === sub &&
            a.class_sections?.length === 1 &&
            a.class_sections[0] === sec &&
            (a.group_id === pool.group_id || !pool.group_id),
        );
        lines.push({ subject_name: sub, class_section: sec, exists: !!hit });
        if (hit) would_update++;
        else would_create++;
      }
    }
    return {
      pool: { id: pool.id, name: pool.name, group_id: pool.group_id },
      would_create,
      would_update,
      total: lines.length,
      lines: lines.slice(0, 48),
      needs_group: !pool.group_id,
    };
  }

  async applyElectivePoolAssignments(studioId: string, poolId: string) {
    const pool = await this.electivePoolRepo.findOne({ where: { id: poolId, studio_id: studioId } });
    if (!pool) throw new NotFoundException();
    if (!pool.group_id) await this.syncElectivePoolGroup(studioId, poolId);
    const refreshed = await this.electivePoolRepo.findOne({ where: { id: poolId } });
    if (!refreshed?.group_id) throw new BadRequestException({ code: 'NO_GROUP', message: 'Grup oluşturulamadı.' });
    const subjects =
      refreshed.subject_names.length > 0 ? refreshed.subject_names : ['Seçmeli'];
    const existing = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    let created = 0;
    let updated = 0;
    for (const sub of subjects) {
      for (const sec of refreshed.member_sections) {
        const prev = existing.find(
          (a) =>
            a.subject_name === sub &&
            a.class_sections?.length === 1 &&
            a.class_sections[0] === sec,
        );
        const payload = {
          subject_name: sub,
          class_sections: [sec],
          weekly_hours: refreshed.weekly_hours_per_track,
          group_id: refreshed.group_id,
          max_per_day: Math.min(4, refreshed.weekly_hours_per_track),
          min_days_per_week: Math.min(3, refreshed.weekly_hours_per_track),
          room_ids: prev?.room_ids ?? [],
          teacher_ids: [] as string[],
          options: { ...(prev?.options as object), elective_pool_id: refreshed.id },
        };
        if (prev) {
          await this.upsertAssignment(studioId, { id: prev.id, ...payload });
          updated++;
        } else {
          await this.upsertAssignment(studioId, payload);
          created++;
        }
      }
    }
    return { pool: refreshed, assignments_created: created, assignments_updated: updated };
  }

  async suggestElectivePools(studioId: string) {
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const links = await this.assignmentTeacherRepo.find({
      where: { assignment_id: In(assignments.map((a) => a.id)) },
    });
    const byAssign = new Map<string, string[]>();
    for (const l of links) {
      const arr = byAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      byAssign.set(l.assignment_id, arr);
    }
    const rows = assignments.map((a) => ({
      subject_name: a.subject_name,
      class_sections: a.class_sections ?? [],
      resolved_teacher_id: byAssign.get(a.id)?.[0] ?? null,
    }));
    const clusters = clusterElectiveImportRows(rows);
    const existing = await this.electivePoolRepo.find({ where: { studio_id: studioId } });
    return {
      suggestions: clusters.map((c) => ({
        key: c.base_section,
        name: `${c.base_section} Seçmeli`,
        base_section: c.base_section,
        member_sections: c.member_sections,
        subject_names: c.subject_names,
        weekly_hours_per_track: 2,
        already_exists: existing.some((e) => e.base_section === c.base_section),
      })),
    };
  }

  async applyElectivePoolSuggestions(
    studioId: string,
    body: { keys?: string[]; apply_all?: boolean; sync_groups?: boolean; apply_assignments?: boolean },
  ) {
    const { suggestions } = await this.suggestElectivePools(studioId);
    const pick = body.apply_all
      ? suggestions.filter((s) => !s.already_exists)
      : suggestions.filter((s) => !s.already_exists && body.keys?.includes(s.key));
    let created = 0;
    let assignments_created = 0;
    for (const s of pick) {
      const pool = await this.upsertElectivePool(studioId, {
        name: s.name,
        base_section: s.base_section,
        member_sections: s.member_sections,
        subject_names: s.subject_names,
        weekly_hours_per_track: s.weekly_hours_per_track,
      });
      created++;
      if (body.sync_groups !== false) await this.syncElectivePoolGroup(studioId, pool.id);
      if (body.apply_assignments) {
        const r = await this.applyElectivePoolAssignments(studioId, pool.id);
        assignments_created += r.assignments_created + (r.assignments_updated ?? 0);
      }
    }
    return { created, assignments_created };
  }

  async getAihlNormReport(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const assignments = await this.listAssignments(studioId);
    const issues = checkAihlWeeklyNorm(profile, assignments);
    return { school_type: profile.type, issues, ok: issues.length === 0 };
  }

  private async ensureElectivePoolsFromImport(
    studioId: string,
    rows: Array<{
      subject_name: string;
      class_sections: string[];
      resolved_teacher_id?: string | null;
    }>,
  ) {
    const clusters = clusterElectiveImportRows(rows);
    const created: DersDagitElectivePool[] = [];
    for (const c of clusters) {
      const pool = await this.electivePoolRepo.save({
        studio_id: studioId,
        name: `${c.base_section} Seçmeli`,
        base_section: c.base_section,
        member_sections: c.member_sections,
        subject_names: c.subject_names,
        weekly_hours_per_track: 2,
      });
      const { group } = await this.syncElectivePoolGroup(studioId, pool.id);
      pool.group_id = group.id;
      await this.electivePoolRepo.save(pool);
      created.push(pool);
    }
    return created;
  }

  private async linkElectiveAssignmentsToPools(studioId: string, pools: DersDagitElectivePool[]) {
    if (!pools.length) return;
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    for (const pool of pools) {
      if (!pool.group_id) continue;
      const memberSet = new Set(pool.member_sections);
      for (const a of assignments) {
        const hit = a.class_sections.some((s) => memberSet.has(s));
        if (!hit || !isElectiveSubjectName(a.subject_name)) continue;
        if (a.group_id === pool.group_id) continue;
        await this.assignmentRepo.update(a.id, { group_id: pool.group_id });
      }
    }
  }

  // --- Buildings & rooms (Faz 12) ---
  async listBuildings(schoolId: string) {
    return this.buildingRepo.find({ where: { school_id: schoolId }, order: { sort_order: 'ASC' } });
  }

  async upsertBuilding(schoolId: string, dto: Partial<DersDagitBuilding>) {
    if (dto.id) {
      const row = await this.buildingRepo.findOne({ where: { id: dto.id, school_id: schoolId } });
      if (!row) throw new NotFoundException();
      return this.buildingRepo.save({ ...row, ...dto });
    }
    return this.buildingRepo.save({ ...dto, school_id: schoolId } as DersDagitBuilding);
  }

  async listRooms(schoolId: string) {
    return this.roomRepo.find({ where: { school_id: schoolId }, order: { sort_order: 'ASC' } });
  }

  async upsertRoom(schoolId: string, dto: Partial<DersDagitRoom>) {
    if (dto.id) {
      const row = await this.roomRepo.findOne({ where: { id: dto.id, school_id: schoolId } });
      if (!row) throw new NotFoundException();
      return this.roomRepo.save({ ...row, ...dto });
    }
    return this.roomRepo.save({ ...dto, school_id: schoolId } as DersDagitRoom);
  }

  async deleteBuilding(id: string, schoolId: string) {
    await this.buildingRepo.delete({ id, school_id: schoolId });
  }

  async deleteRoom(id: string, schoolId: string) {
    await this.roomRepo.delete({ id, school_id: schoolId });
  }

  /** Şube listesinden sınıf dersliği oluştur (mevcut eşleşenleri atlar). */
  async autoCreateRoomsFromClassSections(
    schoolId: string,
    studioId: string,
  ): Promise<{ created: number; skipped: number; sections: string[] }> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();

    const sections = await this.collectStudioSections(studioId, schoolId);
    if (!sections.length) return { created: 0, skipped: 0, sections: [] };

    let building = await this.buildingRepo.findOne({
      where: { school_id: schoolId },
      order: { sort_order: 'ASC' },
    });
    if (!building) {
      building = await this.buildingRepo.save({
        school_id: schoolId,
        name: 'Ana Bina',
        sort_order: 0,
      } as DersDagitBuilding);
    }

    const existing = await this.roomRepo.find({ where: { school_id: schoolId } });
    const covers = (r: DersDagitRoom, sec: string) => {
      const allowed = r.allowed_class_sections ?? [];
      if (allowed.includes(sec)) return true;
      const n = r.name.trim().toLocaleLowerCase('tr');
      const s = sec.toLocaleLowerCase('tr');
      return n === s;
    };

    let created = 0;
    let skipped = 0;
    let sortOrder =
      existing.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0) + 1;

    for (const sec of sections) {
      if (existing.some((r) => covers(r, sec))) {
        skipped++;
        continue;
      }
      const row = await this.roomRepo.save(
        this.roomRepo.create({
          school_id: schoolId,
          building_id: building.id,
          name: sec,
          capacity: 30,
          features: [],
          allowed_class_sections: [sec],
          allowed_subjects: null,
          allowed_teacher_ids: null,
          sort_order: sortOrder++,
        }),
      );
      existing.push(row);
      created++;
    }

    return { created, skipped, sections };
  }

  // --- Assignments (Faz 10-11) ---
  async listAssignments(studioId: string) {
    const rows = await this.assignmentRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
    const links = await this.assignmentTeacherRepo.find({
      where: { assignment_id: In(rows.map((r) => r.id)) },
    });
    const map = new Map<string, string[]>();
    for (const l of links) {
      const a = map.get(l.assignment_id) ?? [];
      a.push(l.user_id);
      map.set(l.assignment_id, a);
    }
    return rows.map((r) => ({ ...r, teacher_ids: map.get(r.id) ?? [] }));
  }

  async upsertAssignment(studioId: string, dto: Partial<DersDagitAssignment> & { teacher_ids?: string[] }) {
    const { teacher_ids, ...rest } = dto;
    if (rest.subject_id) {
      const sub = await this.subjectRepo.findOne({ where: { id: rest.subject_id, studio_id: studioId } });
      if (sub) rest.subject_name = sub.name;
    }
    let row: DersDagitAssignment;
    if (rest.id) {
      const prev = await this.assignmentRepo.findOne({ where: { id: rest.id, studio_id: studioId } });
      if (!prev) throw new NotFoundException();
      row = await this.assignmentRepo.save({ ...prev, ...rest });
    } else {
      row = await this.assignmentRepo.save({ ...rest, studio_id: studioId } as DersDagitAssignment);
    }
    if (teacher_ids) {
      await this.assignmentTeacherRepo.delete({ assignment_id: row.id });
      for (const uid of teacher_ids) {
        await this.assignmentTeacherRepo.save({ assignment_id: row.id, user_id: uid });
      }
    }
    return row;
  }

  async importAssignmentsCsv(studioId: string, csv: string, replace = false) {
    if (replace) {
      const rows = await this.assignmentRepo.find({ where: { studio_id: studioId } });
      for (const r of rows) await this.deleteAssignment(r.id, studioId);
    }
    const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
    let start = 0;
    if (lines[0] && /ders|subject/i.test(lines[0])) start = 1;
    let imported = 0;
    for (const line of lines.slice(start)) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;
      const [subject_name, sectionsRaw, hoursRaw, teachersRaw, roomsRaw, biw, pf, minD, maxD] = cols;
      await this.upsertAssignment(studioId, {
        subject_name,
        class_sections: sectionsRaw.split(/[|;]/).map((s) => s.trim()).filter(Boolean),
        weekly_hours: Math.max(1, Number(hoursRaw) || 1),
        teacher_ids: teachersRaw ? teachersRaw.split('|').filter(Boolean) : [],
        room_ids: roomsRaw ? roomsRaw.split('|').filter(Boolean) : [],
        biweekly: biw === '1' || /^true|evet|2hf$/i.test(biw ?? ''),
        place_first: pf === '1' || /^true|evet$/i.test(pf ?? ''),
        min_days_per_week: minD ? Number(minD) : null,
        max_per_day: maxD ? Number(maxD) : null,
      });
      imported++;
    }
    return { imported };
  }

  async importAssignmentsXlsx(studioId: string, buffer: Buffer, replace = false) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) return { imported: 0 };
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
    if (replace) {
      const existing = await this.assignmentRepo.find({ where: { studio_id: studioId } });
      for (const r of existing) await this.deleteAssignment(r.id, studioId);
    }
    let imported = 0;
    for (const row of rows) {
      const subject_name = String(row.Ders ?? row.ders ?? row.subject ?? '').trim();
      const sectionsRaw = String(row.Sinif ?? row.sinif ?? row.sections ?? '').trim();
      if (!subject_name || !sectionsRaw) continue;
      const hours = Number(row.Saat ?? row.saat ?? row.hours ?? 1) || 1;
      await this.upsertAssignment(studioId, {
        subject_name,
        class_sections: sectionsRaw.split(/[,;/|]/).map((s) => s.trim()).filter(Boolean),
        weekly_hours: Math.max(1, hours),
        teacher_ids: String(row.OgretmenId ?? row.teacher_id ?? '')
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean),
        room_ids: String(row.DerslikId ?? row.room_id ?? '')
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean),
        biweekly: /^1|true|evet|2hf$/i.test(String(row.IkiHf ?? row.biweekly ?? '')),
        place_first: /^1|true|evet$/i.test(String(row.Once ?? row.place_first ?? '')),
        min_days_per_week: row.MinGun ? Number(row.MinGun) : null,
        max_per_day: row.MaxGun ? Number(row.MaxGun) : null,
        max_days_per_week: row.MaxGunHf ? Number(row.MaxGunHf) : null,
      });
      imported++;
    }
    return { imported };
  }

  async deleteProgram(programId: string, studioId: string, userId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    if (prog.status === 'published') {
      throw new BadRequestException({ code: 'PUBLISHED', message: 'Yayınlanmış program silinemez.' });
    }
    await this.programEntryRepo.delete({ program_id: programId });
    await this.programRepo.delete({ id: programId });
    await this.audit(studioId, userId, 'program.deleted', { program_id: programId });
  }

  async deleteAssignment(id: string, studioId: string) {
    const row = await this.assignmentRepo.findOne({ where: { id, studio_id: studioId } });
    if (!row) throw new NotFoundException();
    await this.assignmentTeacherRepo.delete({ assignment_id: id });
    await this.assignmentRepo.delete({ id });
  }

  // --- Rules (Faz 14-17) ---
  async getRules(studioId: string) {
    let rs = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    if (!rs) {
      rs = await this.ruleSetRepo.save({
        studio_id: studioId,
        rules: buildDefaultRuleState(),
        building_travel: [],
        planning_relations: [],
      });
    }
    const profiles = await this.classProfileRepo.find({
      where: { studio_id: studioId },
      order: { sort_order: 'ASC' },
      select: ['id', 'name', 'class_sections', 'rules'],
    });
    return {
      rules: rs.rules,
      building_travel: rs.building_travel,
      planning_relations: (rs.planning_relations ?? []) as PlanningRelationRow[],
      simple_planning_catalog: SIMPLE_PLANNING_RULES,
      advanced_planning_catalog: ADVANCED_PLANNING_RULES,
      catalog: DERS_DAGIT_RULE_CATALOG,
      class_profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        class_sections: p.class_sections ?? [],
        rules: p.rules ?? null,
      })),
    };
  }

  async updateClassProfileRules(
    studioId: string,
    profileId: string,
    rules: Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }>,
  ) {
    const row = await this.classProfileRepo.findOne({ where: { id: profileId, studio_id: studioId } });
    if (!row) throw new NotFoundException();
    row.rules = rules;
    await this.classProfileRepo.save(row);
    return this.getRules(studioId);
  }

  async listStudioClassSections(studioId: string, schoolId: string) {
    return this.collectStudioSections(studioId, schoolId);
  }

  async updateRules(studioId: string, rules: Record<string, unknown>, building_travel?: unknown[]) {
    const rs = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    if (!rs) throw new NotFoundException();
    rs.rules = rules as DersDagitRuleSet['rules'];
    if (building_travel !== undefined) rs.building_travel = building_travel;
    await this.ruleSetRepo.save(rs);
    return this.getRules(studioId);
  }

  async updatePlanningRelations(studioId: string, relations: PlanningRelationRow[]) {
    let rs = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    if (!rs) {
      rs = await this.ruleSetRepo.save({
        studio_id: studioId,
        rules: buildDefaultRuleState(),
        building_travel: [],
        planning_relations: [],
      });
    }
    rs.planning_relations = relations;
    await this.ruleSetRepo.save(rs);
    await this.syncPlanningRelationsToRules(studioId, relations, rs.rules);
    return this.getRules(studioId);
  }

  private async syncPlanningRelationsToRules(
    studioId: string,
    relations: PlanningRelationRow[],
    studioRules: DersDagitRuleSet['rules'],
  ) {
    const profiles = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    let studioDirty = false;
    const profileDirty = new Map<string, Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }>>();

    for (const row of relations) {
      if (!row.active) continue;
      const def = relationDefinition(row);
      if (!def || !('catalog_key' in def) || !def.catalog_key) continue;
      const key = def.catalog_key;
      const state = {
        active: true,
        weight: importanceWeight(row.importance),
        params: row.params,
      };
      if (row.sections_mode === 'all') {
        studioRules[key] = { ...studioRules[key], ...state };
        studioDirty = true;
      } else {
        for (const p of profiles) {
          const secs = p.class_sections ?? [];
          if (!secs.some((s) => row.sections.includes(s))) continue;
          const cur = profileDirty.get(p.id) ?? { ...(p.rules ?? {}) };
          cur[key] = state;
          profileDirty.set(p.id, cur);
        }
      }
    }

    if (studioDirty) {
      const rs = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
      if (rs) {
        rs.rules = studioRules;
        await this.ruleSetRepo.save(rs);
      }
    }
    for (const [profileId, rules] of profileDirty) {
      await this.updateClassProfileRules(studioId, profileId, rules);
    }
  }

  async deleteSubject(id: string, studioId: string) {
    const linked = await this.assignmentRepo.find({ where: { studio_id: studioId, subject_id: id } });
    for (const a of linked) await this.deleteAssignment(a.id, studioId);
    await this.subjectRepo.delete({ id, studio_id: studioId });
    return { deleted_assignments: linked.length };
  }

  // --- Preferences (Faz 23) ---
  async listPreferences(studioId: string, userId?: string) {
    const where: { studio_id: string; user_id?: string } = { studio_id: studioId };
    if (userId) where.user_id = userId;
    return this.preferenceRepo.find({ where });
  }

  async savePreference(studioId: string, userId: string, dto: Partial<DersDagitPreference>) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    if (!studio.preference_window_open) {
      throw new BadRequestException({ code: 'PREF_WINDOW_CLOSED', message: 'Tercih penceresi kapalı.' });
    }
    const existing = await this.preferenceRepo.findOne({
      where: {
        studio_id: studioId,
        user_id: userId,
        day_of_week: dto.day_of_week!,
        lesson_num: dto.lesson_num ?? undefined,
      },
    });
    if (existing) {
      return this.preferenceRepo.save({ ...existing, ...dto, studio_id: studioId, user_id: userId });
    }
    return this.preferenceRepo.save({ ...dto, studio_id: studioId, user_id: userId } as DersDagitPreference);
  }

  async setPreferenceWindow(studioId: string, open: boolean) {
    await this.studioRepo.update(studioId, {
      preference_window_open: open,
      workflow_status: open ? 'collecting_prefs' : 'ready',
    });
  }

  // --- Requests (Faz 25) ---
  async listRequests(studioId: string) {
    const rows = await this.requestRepo.find({ where: { studio_id: studioId }, order: { created_at: 'DESC' } });
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const nameMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || '—']));
    return rows.map((r) => ({ ...r, author_name: nameMap.get(r.user_id) ?? r.user_id.slice(0, 8) }));
  }

  async createRequest(studioId: string, userId: string, body: string, type = 'change') {
    return this.requestRepo.save({ studio_id: studioId, user_id: userId, body, type });
  }

  async moderateRequest(
    studioId: string,
    requestId: string,
    dto: { status: string; admin_reply?: string },
  ) {
    const row = await this.requestRepo.findOne({ where: { id: requestId, studio_id: studioId } });
    if (!row) throw new NotFoundException();
    row.status = dto.status;
    if (dto.admin_reply !== undefined) row.admin_reply = dto.admin_reply;
    return this.requestRepo.save(row);
  }

  async comparePrograms(studioId: string, ids: string[]) {
    const programs = await this.programRepo.find({
      where: { studio_id: studioId, id: In(ids.slice(0, 5)) },
    });
    const summaries = await Promise.all(
      programs.map(async (p) => {
        const entries = await this.programEntryRepo.find({ where: { program_id: p.id } });
        const byClass = new Map<string, number>();
        for (const e of entries) {
          byClass.set(e.class_section, (byClass.get(e.class_section) ?? 0) + 1);
        }
        return {
          id: p.id,
          name: p.name,
          score: p.score,
          status: p.status,
          is_favorite: p.is_favorite,
          entry_count: entries.length,
          class_sections: Object.fromEntries(byClass),
        };
      }),
    );
    return { programs: summaries };
  }

  async buildSolverContext(studioId: string, schoolId: string): Promise<SolverContext> {
    const [school, profiles, prefs, teachers, groups, ruleSet] = await Promise.all([
      this.schoolRepo.findOne({
        where: { id: schoolId },
        select: ['duty_max_lessons', 'lesson_schedule', 'lesson_schedule_pm'],
      }),
      this.classProfileRepo.find({ where: { studio_id: studioId } }),
      this.preferenceRepo.find({ where: { studio_id: studioId } }),
      this.teacherConfigRepo.find({ where: { studio_id: studioId } }),
      this.groupRepo.find({ where: { studio_id: studioId } }),
      this.ruleSetRepo.findOne({ where: { studio_id: studioId } }),
    ]);
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const schoolProfile = parseSchoolProfile(settings.school_profile);
    const planningRelations = (ruleSet?.planning_relations ?? []) as PlanningRelationRow[];
    let studio_rules = applySchoolPedagogyRules(
      (ruleSet?.rules ?? buildDefaultRuleState()) as SolverContext['active_rules'],
      schoolProfile,
    );
    const mergedRules = mergePlanningRelationsIntoRules(
      studio_rules,
      profiles.map((p) => ({
        id: p.id,
        class_sections: p.class_sections,
        rules: p.rules as SolverContext['active_rules'] | null,
      })),
      planningRelations,
    );
    studio_rules = applySchoolPedagogyRules(mergedRules.studio_rules, schoolProfile);
    const section_rules = mergedRules.section_rules;
    for (const [sec, rules] of section_rules) {
      section_rules.set(sec, applySchoolPedagogyRules(rules, schoolProfile));
    }
    const active_rules = studio_rules;
    const strictKeys = buildStrictRuleKeys(planningRelations);
    const period = parseStudioPeriod(settings.period);
    const dual = parseDualEducation(settings.dual_education);
    let maxLesson = school?.duty_max_lessons ?? 8;
    if (profiles.length) {
      maxLesson = Math.max(...profiles.map((p) => p.max_lessons_per_day));
    }
    const unavailable: SolverContext['unavailable'] = [];
    for (const p of prefs) {
      if (p.is_hard || p.status === 'unavailable') {
        unavailable.push({
          day_of_week: p.day_of_week,
          lesson_num: p.lesson_num,
          user_id: p.user_id,
        });
      }
    }
    for (const t of teachers) {
      for (const block of t.unavailable_periods as Array<{ day_of_week: number; lesson_num?: number }>) {
        unavailable.push({
          day_of_week: block.day_of_week,
          lesson_num: block.lesson_num ?? null,
          user_id: t.user_id,
        });
      }
    }
    const dutyBlocks = await this.loadDutyUnavailableSlots(studioId, schoolId, teachers.map((t) => t.user_id));
    unavailable.push(...dutyBlocks);
    const group_modes = new Map<string, DersDagitGroupMode>();
    const group_member_sections = new Map<string, string[]>();
    const parallel_groups = new Set<string>();
    for (const g of groups) {
      const mode = normalizeGroupMode(g.parallel_mode);
      group_modes.set(g.id, mode);
      if (g.member_sections?.length) group_member_sections.set(g.id, g.member_sections);
      if (mode === 'parallel_rooms' || mode === 'subgroups') parallel_groups.add(g.id);
    }

    const schoolRooms = await this.roomRepo.find({ where: { school_id: schoolId } });
    const room_building = new Map(schoolRooms.map((r) => [r.id, r.building_id]));
    const room_constraints = new Map(
      schoolRooms.map((r) => [
        r.id,
        {
          subjects: r.allowed_subjects,
          sections: r.allowed_class_sections,
          teachers: r.allowed_teacher_ids,
        },
      ]),
    );
    const travelRows = (ruleSet?.building_travel ?? []) as Array<{
      from?: string;
      to?: string;
      minutes?: number;
    }>;
    const building_travel_matrix = new Map<string, number>();
    let travelMinutes = 5;
    for (const row of travelRows) {
      const from = row.from ?? 'default';
      const to = row.to ?? 'default';
      const mins = row.minutes ?? 5;
      if (from === 'default' && to === 'default') travelMinutes = mins;
      const gap = Math.max(1, Math.ceil(mins / 40));
      building_travel_matrix.set(`${from}:${to}`, gap);
      if (from !== to) building_travel_matrix.set(`${to}:${from}`, gap);
    }
    const building_travel_gap = active_rules.building_travel_time?.active
      ? (building_travel_matrix.get('default:default') ?? Math.max(1, Math.ceil(travelMinutes / 40)))
      : 0;

    const teacher_limits = teachers.map((t) => ({
      user_id: t.user_id,
      max_per_day: t.max_lessons_per_day,
      min_weekly: t.mandatory_weekly_hours,
      max_weekly:
        t.mandatory_weekly_hours != null || t.max_extra_weekly_hours != null
          ? (t.mandatory_weekly_hours ?? 0) + (t.max_extra_weekly_hours ?? 0)
          : null,
      min_work_days: t.min_work_days,
      max_work_days: t.max_work_days,
      allow_am_pm_gap: t.allow_am_pm_gap !== false,
    }));

    const work_days = Array.isArray(settings.work_days)
      ? (settings.work_days as number[])
      : period.work_days ?? [1, 2, 3, 4, 5];
    const pmFirst = pmFirstLessonNum(period, dual);
    const pmCount = (school?.lesson_schedule_pm ?? []).length || maxLesson;
    const max_lesson_by_day = new Map<number, number>();
    for (const d of work_days) {
      let cap = maxLessonsForDay(period, d, maxLesson);
      if (dual.enabled) cap = Math.max(cap, pmFirst + pmCount - 1);
      max_lesson_by_day.set(d, cap);
    }

    const section_shift = new Map<string, EducationShift | null>();
    for (const p of profiles) {
      const shift = normalizeEducationShift(p.education_shift);
      for (const sec of p.class_sections ?? []) {
        section_shift.set(sec, shift);
      }
    }
    const teacher_shift = new Map<string, EducationShift | null>();
    for (const t of teachers) {
      const c = (t.constraints ?? {}) as Record<string, unknown>;
      teacher_shift.set(t.user_id, normalizeEducationShift(c.education_shift));
    }

    return {
      max_lesson_per_day: maxLesson,
      work_days,
      unavailable,
      parallel_groups,
      group_modes,
      active_rules,
      teacher_limits,
      room_required: !!active_rules.room_required?.active,
      room_building,
      building_travel_gap,
      no_building_same_day: !!active_rules.no_building_same_day?.active,
      blocked_lesson_nums: blockedLessonNums(period),
      max_lesson_by_day,
      lunch_after_lesson: lunchAfterLesson(period),
      room_constraints,
      building_travel_matrix,
      school_profile: parseSchoolProfile(settings.school_profile),
      dual_education_enabled: dual.enabled,
      pm_first_lesson: pmFirst,
      section_shift,
      teacher_shift,
      group_member_sections,
      section_rules,
      section_schedules: parseSectionSchedules(settings.section_schedules),
      section_internship_from_profiles: internshipDaysBySectionFromProfiles(profiles),
      studio_period: period,
      strict_rule_keys_global: strictKeys.global,
      strict_rule_keys_by_section: strictKeys.bySection,
    };
  }

  async getSectionSchedules(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const sections = await this.collectStudioSections(studioId, schoolId);
    const map = parseSectionSchedules(settings.section_schedules);
    const schedules: Record<string, SectionScheduleConfig> = {};
    for (const sec of sections) {
      schedules[sec] = map.get(sec) ?? { lessons_per_day_by_dow: {}, cells: {} };
    }
    return { sections, schedules };
  }

  async updateSectionSchedule(
    studioId: string,
    schoolId: string,
    section: string,
    schedule: SectionScheduleConfig,
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const sec = section.trim();
    if (!sec) throw new BadRequestException({ code: 'SECTION_REQUIRED', message: 'Şube adı gerekli.' });
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const map = parseSectionSchedules(settings.section_schedules);
    const internship_days = Array.isArray(schedule.internship_days)
      ? [...new Set(schedule.internship_days.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b)
      : [];
    map.set(sec, {
      lessons_per_day_by_dow: schedule.lessons_per_day_by_dow ?? {},
      cells: schedule.cells ?? {},
      ...(internship_days.length ? { internship_days } : {}),
    });
    settings.section_schedules = sectionSchedulesToJson(map);
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return this.getSectionSchedules(studioId, schoolId);
  }

  async getSchoolProfile(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    return parseSchoolProfile(settings.school_profile);
  }

  async updateSchoolProfile(studioId: string, schoolId: string, body: Partial<StudioSchoolProfile>) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const prev = parseSchoolProfile(settings.school_profile);
    settings.school_profile = {
      ...prev,
      ...body,
      type: body.type ?? prev.type,
    };
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return parseSchoolProfile(settings.school_profile);
  }

  /** Yayınlı nöbet planı — tarih → haftanın günü (Faz 38). */
  private async loadDutyUnavailableSlots(
    studioId: string,
    schoolId: string,
    teacherIds: string[],
  ): Promise<SolverContext['unavailable']> {
    if (!teacherIds.length) return [];
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['settings'] });
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const period = parseStudioPeriod(settings.period);
    const work_days = Array.isArray(settings.work_days)
      ? (settings.work_days as number[])
      : period.work_days ?? [1, 2, 3, 4, 5];
    const dutyRange = (settings.duty_sync ?? {}) as { from?: string; to?: string };

    const qb = this.dutySlotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.user_id IN (:...ids)', { ids: teacherIds })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.archived_at IS NULL')
      .andWhere('p.status = :published', { published: 'published' });

    if (dutyRange.from) qb.andWhere('s.date >= :from', { from: dutyRange.from });
    if (dutyRange.to) qb.andWhere('s.date <= :to', { to: dutyRange.to });

    const slots = await qb.getMany();
    const mapped = dutySlotsToUnavailable(
      slots.map((s) => ({
        date: s.date,
        lesson_num: s.lesson_num,
        user_id: s.user_id,
        shift: s.shift,
      })),
      { work_days, from: dutyRange.from, to: dutyRange.to },
    );
    return mapped.map((d) => ({
      day_of_week: d.day_of_week,
      lesson_num: d.lesson_num,
      user_id: d.user_id,
    }));
  }

  async getDutySyncPreview(studioId: string, schoolId: string) {
    const teachers = await this.teacherConfigRepo.find({ where: { studio_id: studioId }, select: ['user_id'] });
    const blocks = await this.loadDutyUnavailableSlots(studioId, schoolId, teachers.map((t) => t.user_id));
    const byTeacher = new Map<string, number>();
    for (const b of blocks) {
      const k = b.user_id ?? '?';
      byTeacher.set(k, (byTeacher.get(k) ?? 0) + 1);
    }
    return {
      block_count: blocks.length,
      teacher_count: byTeacher.size,
      sample: blocks.slice(0, 20),
    };
  }

  async syncDutyToStudio(studioId: string, schoolId: string, body: { from?: string; to?: string }) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    settings.duty_sync = {
      from: body.from ?? null,
      to: body.to ?? null,
      synced_at: new Date().toISOString(),
    };
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return this.getDutySyncPreview(studioId, schoolId);
  }

  async syncExtraLessonParamsToTeachers(studioId: string, schoolId: string, userId: string) {
    const [studio, school, activeParams] = await Promise.all([
      this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } }),
      this.schoolRepo.findOne({
        where: { id: schoolId },
        select: ['id', 'duty_max_lessons'],
      }),
      this.extraLessonParamsRepo.findOne({ where: { is_active: true }, order: { valid_from: 'DESC' } }),
    ]);
    if (!studio || !school) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const norm = teacherHourNormFromSchool(profile.type, school.duty_max_lessons);
    const teachers = await this.teacherConfigRepo.find({ where: { studio_id: studioId } });
    let updated = 0;
    for (const t of teachers) {
      const patch: Partial<DersDagitTeacherConfig> = {};
      if (t.mandatory_weekly_hours == null) patch.mandatory_weekly_hours = norm.mandatory_weekly_hours;
      if (t.max_extra_weekly_hours == null) patch.max_extra_weekly_hours = norm.max_extra_weekly_hours;
      if (t.max_lessons_per_day == null) patch.max_lessons_per_day = norm.max_lessons_per_day;
      if (!Object.keys(patch).length) continue;
      const c = { ...(t.constraints ?? {}) } as Record<string, unknown>;
      c.extra_lesson_semester = activeParams?.semester_code ?? null;
      c.hour_norm_source = norm.source;
      patch.constraints = c;
      await this.teacherConfigRepo.save({ ...t, ...patch });
      updated++;
    }
    settings.teacher_hour_norm = norm;
    settings.extra_lesson_params_id = activeParams?.id ?? null;
    studio.settings = settings;
    await this.studioRepo.save(studio);
    await this.audit(studioId, userId, 'teachers.synced_extra_lesson_norm', {
      updated,
      norm,
      semester: activeParams?.semester_code ?? null,
    });
    return { updated, norm, active_semester: activeParams?.semester_code ?? null };
  }

  // --- Faz 26: Adalet metrikleri (idare içi) ---
  async getFairnessMetrics(studioId: string) {
    const programs = await this.programRepo.find({
      where: { studio_id: studioId, status: In(['generated', 'published']) },
      order: { created_at: 'DESC' },
      take: 1,
    });
    const program = programs[0];
    if (!program) return { ready: false, message: 'Üretilmiş program yok.' };

    const entries = await this.programEntryRepo.find({ where: { program_id: program.id } });
    const byTeacher = new Map<string, { days: Set<number>; gaps: number; lessons: number }>();

    for (const uid of [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[]) {
      byTeacher.set(uid, { days: new Set(), gaps: 0, lessons: 0 });
    }
    for (const e of entries) {
      if (!e.user_id) continue;
      const t = byTeacher.get(e.user_id)!;
      t.days.add(e.day_of_week);
      t.lessons++;
    }
    for (const [uid, t] of byTeacher) {
      const daySlots = new Map<number, number[]>();
      for (const e of entries.filter((x) => x.user_id === uid)) {
        const arr = daySlots.get(e.day_of_week) ?? [];
        arr.push(e.lesson_num);
        daySlots.set(e.day_of_week, arr);
      }
      for (const [, lessons] of daySlots) {
        lessons.sort((a, b) => a - b);
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i]! - lessons[i - 1]! > 1) t.gaps++;
        }
      }
      byTeacher.set(uid, t);
    }

    const teacherHours = [...byTeacher.entries()].map(([id, v]) => ({
      teacher_id: id,
      lesson_count: v.lessons,
      work_day_count: v.days.size,
      gap_count: v.gaps,
    }));
    const avg = teacherHours.length
      ? teacherHours.reduce((s, x) => s + x.lesson_count, 0) / teacherHours.length
      : 0;
    const monFriOff = entries.filter((e) => e.day_of_week === 1 || e.day_of_week === 5).length;

    return {
      ready: true,
      program_id: program.id,
      teacher_stats: teacherHours.map((t) => ({
        ...t,
        deviation_from_avg: Math.round((t.lesson_count - avg) * 10) / 10,
      })),
      avg_lessons_per_teacher: Math.round(avg * 10) / 10,
      monday_friday_slot_ratio: entries.length ? Math.round((monFriOff / entries.length) * 100) : 0,
      hint:
        monFriOff > entries.length * 0.4
          ? 'Pzt/Cum yoğunluğu yüksek — kayırma riski kontrol edin.'
          : null,
    };
  }

  // --- Generate (Faz 19-21) ---
  async generatePrograms(
    studioId: string,
    schoolId: string,
    userId: string,
    opts: { duration_sec?: number; versions?: number; use_csp?: boolean },
  ) {
    const errors = (await this.runValidation(studioId)).filter((e) => e.severity === 'error');
    const ruleSet = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    const planningIssues = validatePlanningRelationsForGenerate(
      (ruleSet?.planning_relations ?? []) as PlanningRelationRow[],
    );
    if (errors.length || planningIssues.length) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        issues: [...errors, ...planningIssues],
      });
    }
    const job = await this.jobRepo.save({
      studio_id: studioId,
      status: 'running',
      duration_sec: opts.duration_sec ?? 60,
      versions_requested: Math.min(3, opts.versions ?? 1),
      started_at: new Date(),
    });
    const solverCtx = await this.buildSolverContext(studioId, schoolId);
    const assignments = await this.listAssignments(studioId);
    const solverInput = expandAssignmentsForSolver(
      assignments.map((a) => ({
        id: a.id,
        class_sections: a.class_sections,
        subject_name: a.subject_name,
        weekly_hours: a.weekly_hours,
        teacher_ids: (a as { teacher_ids?: string[] }).teacher_ids ?? [],
        group_id: a.group_id,
        room_ids: a.room_ids ?? [],
        max_per_day: a.max_per_day,
        min_days_per_week: a.min_days_per_week,
        fixed_slots: (a.fixed_slots ?? []) as Array<{ day_of_week: number; lesson_num: number; class_section?: string }>,
        place_first: a.place_first,
        biweekly: a.biweekly,
        max_days_per_week: a.max_days_per_week,
        unavailable_periods: (a.unavailable_periods ?? []) as Array<{
          day_of_week: number;
          lesson_num?: number;
        }>,
        options: a.options,
        co_teach: !!(a.options?.co_teach),
      })),
    );
    const programs: DersDagitProgram[] = [];
    const versionCount = Math.min(3, opts.versions ?? 1);
    const baseDays = solverCtx.work_days;
    const iter = Math.min(40, Math.max(12, (opts.duration_sec ?? 60) / 2));
    const solveOnce = (ctx: SolverContext) => {
      if (opts.use_csp) {
        const csp = runCspSolver(solverInput, ctx, 120_000);
        return improveWithLocalSearch(solverInput, ctx, Math.max(8, Math.floor(iter / 3)), csp);
      }
      return improveWithLocalSearch(solverInput, ctx, iter);
    };
    let bestResult = solveOnce(solverCtx);
    const dutyConflicts = findDutyPlacementConflicts(
      bestResult.entries,
      solverCtx.unavailable
        .filter((u): u is { day_of_week: number; lesson_num: number | null; user_id: string } => !!u.user_id)
        .map((u) => ({
          day_of_week: u.day_of_week,
          lesson_num: u.lesson_num,
          user_id: u.user_id!,
        })),
    );
    if (dutyConflicts.length) {
      await this.jobRepo.update(job.id, { status: 'failed', finished_at: new Date() });
      throw new BadRequestException({
        code: 'DUTY_CONFLICT',
        message: 'Üretilen program nöbet slotlarıyla çakışıyor.',
        violations: dutyConflicts,
      });
    }
    const { strict_violations: strictViolations } = applySoftRulePenalties(
      bestResult.entries,
      solverInput,
      solverCtx,
    );
    if (strictViolations.length) {
      await this.jobRepo.update(job.id, { status: 'failed', finished_at: new Date() });
      throw new BadRequestException({
        code: 'STRICT_RULES_VIOLATED',
        message: 'Zorunlu planlama veya okul kuralları karşılanamadı.',
        violations: strictViolations.slice(0, 20),
      });
    }
    for (let v = 0; v < versionCount; v++) {
      const shuffled = [...baseDays].sort(() => Math.random() - 0.5);
      const result = solveOnce({ ...solverCtx, day_order: shuffled });
      if (result.score > bestResult.score || result.failed < bestResult.failed) bestResult = result;
      const score = result.score;
      const prog = await this.programRepo.save({
        studio_id: studioId,
        name: `Üretim ${new Date().toISOString().slice(0, 16)} v${v + 1}`,
        status: 'generated',
        version: v + 1,
        score,
        generation_meta: {
          job_id: job.id,
          placed: result.placed,
          failed: result.failed,
          violations: result.violations.slice(0, 30),
        },
      });
      const entries = result.entries.map((e) => ({
        program_id: prog.id,
        assignment_id: e.assignment_id,
        user_id: e.user_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
        room_id: e.room_id,
        group_id: e.group_id,
        is_locked: false,
      }));
      await this.programEntryRepo.save(entries);
      programs.push(prog);
    }
    await this.jobRepo.update(job.id, {
      status: 'done',
      finished_at: new Date(),
      report: {
        placed: bestResult.placed,
        failed: bestResult.failed,
        violations: bestResult.violations,
        score: bestResult.score,
        program_ids: programs.map((p) => p.id),
      },
    });
    await this.studioRepo.update(studioId, { workflow_status: 'generated' });
    await this.audit(studioId, userId, 'programs.generated', { job_id: job.id });
    return {
      job,
      programs,
      entries_count: bestResult.placed,
      placed: bestResult.placed,
      failed: bestResult.failed,
      score: bestResult.score,
      violations: bestResult.violations,
      violation_links: linkGenerationViolations(bestResult.violations.slice(0, 30)),
    };
  }

  async getProgram(programId: string, studioId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    return { program, entries: await this.enrichProgramEntries(entries) };
  }

  private async enrichProgramEntries(entries: DersDagitProgramEntry[]) {
    const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[];
    const roomIds = [...new Set(entries.map((e) => e.room_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const rooms = roomIds.length > 0 ? await this.roomRepo.find({ where: { id: In(roomIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
    return entries.map((e) => ({
      ...e,
      teacher_label: e.user_id ? userMap.get(e.user_id) ?? null : null,
      room_name: e.room_id ? roomMap.get(e.room_id) ?? null : null,
    }));
  }

  private assertEntrySlot(
    programId: string,
    entry: DersDagitProgramEntry,
    day: number,
    lesson: number,
    excludeIds: string[],
    all: DersDagitProgramEntry[],
  ) {
    for (const other of all) {
      if (excludeIds.includes(other.id) || other.id === entry.id) continue;
      if (other.day_of_week !== day || other.lesson_num !== lesson) continue;
      if (other.class_section === entry.class_section) {
        throw new BadRequestException({ code: 'CLASS_CLASH', message: 'Sınıf çakışması.' });
      }
      if (entry.user_id && other.user_id === entry.user_id) {
        throw new BadRequestException({ code: 'TEACHER_CLASH', message: 'Öğretmen çakışması.' });
      }
    }
  }

  async getFairnessForProgram(studioId: string, programId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) return { ready: false, message: 'Program yok.' };
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    const byTeacher = new Map<string, { days: Set<number>; gaps: number; lessons: number }>();
    for (const uid of [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[]) {
      byTeacher.set(uid, { days: new Set(), gaps: 0, lessons: 0 });
    }
    for (const e of entries) {
      if (!e.user_id) continue;
      const t = byTeacher.get(e.user_id)!;
      t.days.add(e.day_of_week);
      t.lessons++;
    }
    for (const [uid, t] of byTeacher) {
      const daySlots = new Map<number, number[]>();
      for (const e of entries.filter((x) => x.user_id === uid)) {
        const arr = daySlots.get(e.day_of_week) ?? [];
        arr.push(e.lesson_num);
        daySlots.set(e.day_of_week, arr);
      }
      for (const [, lessons] of daySlots) {
        lessons.sort((a, b) => a - b);
        for (let i = 1; i < lessons.length; i++) {
          if (lessons[i]! - lessons[i - 1]! > 1) t.gaps++;
        }
      }
      byTeacher.set(uid, t);
    }
    const teacherConfigs = await this.listTeacherConfigs(studioId);
    const nameMap = new Map(teacherConfigs.map((c) => [c.user_id, c.display_name]));
    const teacher_stats = [...byTeacher.entries()].map(([id, v]) => ({
      teacher_id: id,
      label: nameMap.get(id) ?? id.slice(0, 8),
      lesson_count: v.lessons,
      work_day_count: v.days.size,
      gap_count: v.gaps,
    }));
    const avg = teacher_stats.length
      ? teacher_stats.reduce((s, x) => s + x.lesson_count, 0) / teacher_stats.length
      : 0;
    return {
      ready: true,
      program_id: programId,
      avg_lessons_per_teacher: Math.round(avg * 10) / 10,
      teacher_stats: teacher_stats.map((t) => ({
        ...t,
        deviation_from_avg: Math.round((t.lesson_count - avg) * 10) / 10,
      })),
    };
  }

  async exportParentAllPdfZip(programId: string, studioId: string, schoolId: string): Promise<Buffer> {
    const { entries } = await this.getProgram(programId, studioId);
    const sections = sortClassSections([...new Set(entries.map((e) => e.class_section))]);
    if (!sections.length) {
      throw new BadRequestException({ code: 'NO_SECTIONS', message: 'Programda şube yok.' });
    }
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', (c: Buffer) => chunks.push(c));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      void (async () => {
        try {
          for (const sec of sections) {
            const pdf = await this.exportParentClassPdf(programId, studioId, schoolId, sec);
            archive.append(Buffer.from(pdf), { name: `veli-${sec.replace(/[^\w.-]+/g, '_')}.pdf` });
          }
          await archive.finalize();
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  async getProgramEditorContext(programId: string, studioId: string, schoolId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    const raw = await this.programEntryRepo.find({ where: { program_id: programId } });
    const entries = await this.enrichProgramEntries(raw);
    const period = await this.getPeriodConfig(schoolId, studioId);
    const studioPeriod = parseStudioPeriod(studio?.settings?.period);
    const rooms = await this.roomRepo.find({
      where: { school_id: schoolId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
    const class_sections = sortClassSections([...new Set(entries.map((e) => e.class_section))]);
    const teacherConfigs = await this.listTeacherConfigs(studioId);
    const teachers = teacherConfigs.map((t) => ({
      id: t.user_id,
      label: t.display_name ?? t.user_id.slice(0, 8),
    }));
    const teacher_availability = teacherConfigs.map((t) => ({
      user_id: t.user_id,
      label: t.display_name,
      unavailable_periods: (t.unavailable_periods ?? []) as Array<{
        day_of_week: number;
        lesson_num?: number;
      }>,
    }));
    const unplaced = await this.listUnplacedAssignments(studioId, programId);
    const clashes = computeProgramClashes(entries);
    const schoolDefaultMax = Math.max(
      8,
      ...(period.lesson_schedule ?? []).map((s) => s.lesson_num),
      ...(period.lesson_schedule_weekend ?? []).map((s) => s.lesson_num),
    );
    const maxLesson = Math.max(schoolDefaultMax, ...entries.map((e) => e.lesson_num));
    const fairness = await this.getFairnessForProgram(studioId, programId);
    return {
      program,
      entries,
      period,
      grid: {
        blocked_lesson_nums: [...blockedLessonNums(studioPeriod)],
        long_breaks: studioPeriod.long_breaks ?? [],
        lessons_per_day_by_dow: studioPeriod.lessons_per_day_by_dow ?? {},
      },
      rooms: rooms.map((r) => ({ id: r.id, name: r.name, building_id: r.building_id })),
      class_sections,
      teachers,
      teacher_availability,
      unplaced,
      clashes,
      max_lesson: maxLesson,
      fairness,
    };
  }

  async listUnplacedAssignments(studioId: string, programId: string) {
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    const countBy = new Map<string, number>();
    for (const e of entries) {
      if (!e.assignment_id) continue;
      countBy.set(e.assignment_id, (countBy.get(e.assignment_id) ?? 0) + 1);
    }
    const out: Array<{
      assignment_id: string;
      subject_name: string;
      class_section: string;
      weekly_hours: number;
      placed_hours: number;
      remaining_hours: number;
      user_id: string | null;
      teacher_label: string | null;
    }> = [];
    const links = await this.assignmentTeacherRepo.find({
      where: { assignment_id: In(assignments.map((a) => a.id)) },
    });
    const primaryTeacher = new Map<string, string>();
    for (const l of links) {
      if (!primaryTeacher.has(l.assignment_id)) primaryTeacher.set(l.assignment_id, l.user_id);
    }
    const userIds = [...new Set(links.map((l) => l.user_id))];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || '—']));
    for (const a of assignments) {
      const need = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      const placed = countBy.get(a.id) ?? 0;
      const remaining = need - placed;
      if (remaining <= 0) continue;
      const uid = primaryTeacher.get(a.id) ?? null;
      const section = a.class_sections[0] ?? '—';
      out.push({
        assignment_id: a.id,
        subject_name: a.subject_name,
        class_section: section,
        weekly_hours: a.weekly_hours,
        placed_hours: placed,
        remaining_hours: remaining,
        user_id: uid,
        teacher_label: uid ? userMap.get(uid) ?? null : null,
      });
    }
    return out.sort((a, b) => b.remaining_hours - a.remaining_hours);
  }

  async swapProgramEntries(
    studioId: string,
    programId: string,
    userId: string,
    entryIdA: string,
    entryIdB: string,
  ) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const all = await this.programEntryRepo.find({ where: { program_id: programId } });
    const a = all.find((e) => e.id === entryIdA);
    const b = all.find((e) => e.id === entryIdB);
    if (!a || !b) throw new NotFoundException();
    if (a.is_locked || b.is_locked) {
      throw new BadRequestException({ code: 'ENTRY_LOCKED', message: 'Kilitli slot takas edilemez.' });
    }
    const aDay = a.day_of_week;
    const aLesson = a.lesson_num;
    const bDay = b.day_of_week;
    const bLesson = b.lesson_num;
    this.assertEntrySlot(programId, a, bDay, bLesson, [b.id], all);
    this.assertEntrySlot(programId, b, aDay, aLesson, [a.id], all);
    a.day_of_week = bDay;
    a.lesson_num = bLesson;
    b.day_of_week = aDay;
    b.lesson_num = aLesson;
    await this.programEntryRepo.save([a, b]);
    await this.audit(studioId, userId, 'program.entries.swapped', {
      program_id: programId,
      entry_a: entryIdA,
      entry_b: entryIdB,
    });
    return { ok: true };
  }

  async createProgramEntry(
    studioId: string,
    programId: string,
    userId: string,
    body: { assignment_id: string; day_of_week: number; lesson_num: number },
  ) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const a = await this.assignmentRepo.findOne({ where: { id: body.assignment_id, studio_id: studioId } });
    if (!a) throw new NotFoundException('Atama bulunamadı');
    const links = await this.assignmentTeacherRepo.find({ where: { assignment_id: a.id }, take: 1 });
    const teacherId = links[0]?.user_id ?? null;
    const classSection = a.class_sections[0];
    if (!classSection) {
      throw new BadRequestException({ code: 'NO_CLASS', message: 'Atamada şube yok.' });
    }
    const all = await this.programEntryRepo.find({ where: { program_id: programId } });
    const draft = this.programEntryRepo.create({
      program_id: programId,
      assignment_id: a.id,
      user_id: teacherId,
      day_of_week: body.day_of_week,
      lesson_num: body.lesson_num,
      class_section: classSection,
      subject: a.subject_name,
      room_id: a.room_ids?.[0] ?? null,
      is_locked: false,
      group_id: a.group_id,
    });
    this.assertEntrySlot(programId, draft, body.day_of_week, body.lesson_num, [], all);
    const saved = await this.programEntryRepo.save(draft);
    await this.audit(studioId, userId, 'program.entry.created', { program_id: programId, entry_id: saved.id });
    const [enriched] = await this.enrichProgramEntries([saved]);
    return enriched;
  }

  async deleteProgramEntry(studioId: string, programId: string, entryId: string, userId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const entry = await this.programEntryRepo.findOne({ where: { id: entryId, program_id: programId } });
    if (!entry) throw new NotFoundException();
    if (entry.is_locked) {
      throw new BadRequestException({ code: 'ENTRY_LOCKED', message: 'Kilitli slot silinemez.' });
    }
    await this.programEntryRepo.delete(entryId);
    await this.audit(studioId, userId, 'program.entry.deleted', { program_id: programId, entry_id: entryId });
    return { ok: true };
  }

  async listPrograms(studioId: string, opts?: { include_archived?: boolean }) {
    if (!opts?.include_archived) {
      return this.programRepo.find({
        where: { studio_id: studioId, archived_at: IsNull() },
        order: { created_at: 'DESC' },
      });
    }
    return this.programRepo.find({ where: { studio_id: studioId }, order: { created_at: 'DESC' } });
  }

  async setCouncilReview(studioId: string) {
    await this.studioRepo.update(studioId, { workflow_status: 'council_review' });
  }

  // --- Faz 2: Dönem / zaman ---
  async getPeriodConfig(schoolId: string, studioId: string) {
    const [school, studio] = await Promise.all([
      this.schoolRepo.findOne({
        where: { id: schoolId },
        select: [
          'id',
          'lesson_schedule',
          'lesson_schedule_pm',
          'lesson_schedule_weekend',
          'lesson_schedule_weekend_pm',
          'duty_max_lessons',
          'duty_education_mode',
        ],
      }),
      this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } }),
    ]);
    if (!school || !studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const period = parseStudioPeriod(settings.period);
    const work_days = Array.isArray(settings.work_days)
      ? (settings.work_days as number[])
      : period.work_days ?? [1, 2, 3, 4, 5];
    const dual = parseDualEducation(settings.dual_education);
    const pm_first_lesson = pmFirstLessonNum(period, dual);
    return {
      lesson_schedule: school.lesson_schedule ?? [],
      lesson_schedule_pm: school.lesson_schedule_pm ?? [],
      lesson_schedule_weekend: school.lesson_schedule_weekend,
      lesson_schedule_weekend_pm: school.lesson_schedule_weekend_pm,
      duty_max_lessons: school.duty_max_lessons,
      duty_education_mode: school.duty_education_mode,
      studio_period: { ...period, work_days },
      work_days,
      dual_education: dual,
      pm_first_lesson,
    };
  }

  async updatePeriodConfig(
    studioId: string,
    schoolId: string,
    body: { period?: StudioPeriodConfig; work_days?: number[]; dual_education?: DualEducationConfig },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const prev = parseStudioPeriod(settings.period);
    const next: StudioPeriodConfig = body.period
      ? { ...prev, ...body.period }
      : prev;
    if (body.work_days) next.work_days = body.work_days;
    settings.period = next;
    settings.work_days = next.work_days;
    if (body.dual_education) {
      settings.dual_education = { ...parseDualEducation(settings.dual_education), ...body.dual_education };
    }
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return this.getPeriodConfig(schoolId, studioId);
  }

  // --- Faz 27: Yayın → teacher-timetable ---
  async publishProgramToSchool(
    studioId: string,
    schoolId: string,
    userId: string,
    programId: string,
    opts: { valid_from?: string; valid_until?: string | null; name?: string },
  ) {
    const { program, entries } = await this.getProgram(programId, studioId);
    if (!entries.length) {
      throw new BadRequestException({ code: 'NO_ENTRIES', message: 'Programda slot yok.' });
    }
    const ttEntries: TimetableEntry[] = entries.map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      user_id: e.user_id,
      class_section: e.class_section,
      subject: e.subject,
    }));
    const published = await this.teacherTimetable.importAndPublishFromDersDagit(
      schoolId,
      userId,
      ttEntries,
      {
        name: opts.name ?? program.name ?? undefined,
        valid_from: opts.valid_from ?? program.valid_from ?? undefined,
        valid_until: opts.valid_until !== undefined ? opts.valid_until : program.valid_until,
      },
    );
    await this.programRepo.update(programId, {
      status: 'published',
      published_plan_id: published.plan_id,
    });
    await this.studioRepo.update(studioId, { workflow_status: 'published' });
    await this.audit(studioId, userId, 'program.published', {
      program_id: programId,
      school_plan_id: published.plan_id,
      imported: published.imported,
    });
    return { ...published, program_id: programId };
  }

  /** Sınıf listesini classes-subjects şubelerinden öner */
  async suggestClassSections(schoolId: string): Promise<string[]> {
    const rows = await this.classProfileRepo.manager
      .createQueryBuilder()
      .select('DISTINCT sc.name', 'name')
      .from('school_classes', 'sc')
      .where('sc.school_id = :schoolId', { schoolId })
      .orderBy('sc.name', 'ASC')
      .getRawMany<{ name: string }>()
      .catch(() => [] as { name: string }[]);
    return sortClassSections(rows.map((r) => String(r.name ?? '').trim()).filter(Boolean));
  }

  /** Yayınlanmış programdan sınıf görünümü (veli/öğretmen önizleme). */
  async getPublishedClassProgram(studioId: string, schoolId: string, classSection: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const published = await this.programRepo.find({
      where: { studio_id: studioId, status: 'published' },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    const program = published[0];
    if (!program) {
      return { ready: false, message: 'Yayınlanmış program yok.', entries: [] as ExportEntry[] };
    }
    const entries = await this.programEntryRepo.find({ where: { program_id: program.id } });
    const filtered = entries.filter((e) => e.class_section === classSection);
    const rows = await this.buildExportRows(program.id, studioId);
    return {
      ready: true,
      program_id: program.id,
      program_name: program.name,
      class_section: classSection,
      entries: rows.filter((e) => e.class_section === classSection),
      slots: filtered.map((e) => ({
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        subject: e.subject,
      })),
    };
  }

  private async buildExportRows(programId: string, studioId: string): Promise<EokulExportRow[]> {
    const { entries } = await this.getProgram(programId, studioId);
    const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[];
    const roomIds = [...new Set(entries.map((e) => e.room_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'display_name', 'email', 'evrakDefaults'],
          })
        : [];
    const rooms = roomIds.length > 0 ? await this.roomRepo.find({ where: { id: In(roomIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    const tcMap = new Map(users.map((u) => [u.id, u.evrakDefaults?.yolluk_teacher?.tc_kimlik ?? null]));
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
    return entries.map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      subject: e.subject,
      user_id: e.user_id,
      teacher_id: e.user_id,
      teacher_label: e.user_id ? userMap.get(e.user_id) ?? null : null,
      teacher_tc: e.user_id ? tcMap.get(e.user_id) ?? null : null,
      room_name: e.room_id ? roomMap.get(e.room_id) ?? null : null,
    }));
  }

  async getEokulExportReport(programId: string, studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name'] });
    if (!studio) throw new NotFoundException();
    const rows = await this.buildExportRows(programId, studioId);
    const report = validateEokulExport(rows);
    return {
      report,
      school_code: school?.id?.slice(0, 8) ?? '',
      school_name: school?.name ?? null,
      program_id: programId,
    };
  }

  async exportProgramEokulPackage(programId: string, studioId: string, schoolId: string) {
    const { report, school_code } = await this.getEokulExportReport(programId, studioId, schoolId);
    const rows = await this.buildExportRows(programId, studioId);
    return {
      report,
      csv: '\uFEFF' + buildEokulScheduleCsv(rows, { school_code, report }),
      xlsx: buildEokulScheduleXlsx(rows, { school_code, report }),
      report_csv: '\uFEFF' + buildEokulReportCsv(report),
    };
  }

  async exportProgramCsv(programId: string, studioId: string): Promise<string> {
    return buildProgramGridCsv(await this.buildExportRows(programId, studioId));
  }

  async exportProgramEokul(programId: string, studioId: string, schoolId?: string): Promise<string> {
    const rows = await this.buildExportRows(programId, studioId);
    const report = validateEokulExport(rows);
    let school_code = '';
    if (schoolId) {
      const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id'] });
      school_code = school?.id?.slice(0, 8) ?? '';
    }
    return '\uFEFF' + buildEokulScheduleCsv(rows, { school_code, report });
  }

  async exportProgramEokulXlsx(programId: string, studioId: string, schoolId: string): Promise<Buffer> {
    const { report, school_code } = await this.getEokulExportReport(programId, studioId, schoolId);
    const rows = await this.buildExportRows(programId, studioId);
    return buildEokulScheduleXlsx(rows, { school_code, report });
  }

  async exportProgramXlsx(programId: string, studioId: string): Promise<Buffer> {
    return buildProgramGridXlsx(await this.buildExportRows(programId, studioId));
  }

  async exportProgramPdf(programId: string, studioId: string): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const rows = await this.buildExportRows(programId, studioId);
    return this.pdfService.buildProgramPdf(program.name ?? 'Ders Dağıt Programı', rows);
  }

  async patchProgramEntry(
    studioId: string,
    programId: string,
    entryId: string,
    userId: string,
    dto: { day_of_week?: number; lesson_num?: number; is_locked?: boolean; room_id?: string | null },
  ) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const entry = await this.programEntryRepo.findOne({ where: { id: entryId, program_id: programId } });
    if (!entry) throw new NotFoundException();
    if (entry.is_locked && dto.is_locked !== false) {
      throw new BadRequestException({ code: 'ENTRY_LOCKED', message: 'Kilitli slot düzenlenemez.' });
    }
    const day = dto.day_of_week ?? entry.day_of_week;
    const lesson = dto.lesson_num ?? entry.lesson_num;
    const classClash = await this.programEntryRepo.findOne({
      where: { program_id: programId, day_of_week: day, lesson_num: lesson, class_section: entry.class_section },
    });
    if (classClash && classClash.id !== entryId) {
      throw new BadRequestException({ code: 'CLASS_CLASH', message: 'Sınıf çakışması.' });
    }
    if (entry.user_id) {
      const teacherClash = await this.programEntryRepo
        .createQueryBuilder('e')
        .where('e.program_id = :pid', { pid: programId })
        .andWhere('e.day_of_week = :day', { day })
        .andWhere('e.lesson_num = :lesson', { lesson })
        .andWhere('e.user_id = :uid', { uid: entry.user_id })
        .andWhere('e.id != :id', { id: entryId })
        .getOne();
      if (teacherClash) {
        throw new BadRequestException({ code: 'TEACHER_CLASH', message: 'Öğretmen çakışması.' });
      }
    }
    const saved = await this.programEntryRepo.save({
      ...entry,
      day_of_week: day,
      lesson_num: lesson,
      is_locked: dto.is_locked ?? entry.is_locked,
      room_id: dto.room_id !== undefined ? dto.room_id : entry.room_id,
    });
    await this.audit(studioId, userId, 'program.entry.patched', { program_id: programId, entry_id: entryId });
    const [enriched] = await this.enrichProgramEntries([saved]);
    return enriched;
  }

  async listAuditLogs(studioId: string, limit = 50) {
    const logs = await this.auditRepo.find({
      where: { studio_id: studioId },
      order: { created_at: 'DESC' },
      take: Math.min(100, limit),
    });
    const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || '—']));
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      detail: l.detail,
      created_at: l.created_at,
      user_label: l.user_id ? userMap.get(l.user_id) ?? l.user_id.slice(0, 8) : null,
    }));
  }

  async setFavoriteProgram(studioId: string, programId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    await this.programRepo.update({ studio_id: studioId }, { is_favorite: false });
    await this.programRepo.update(programId, { is_favorite: true });
    return this.programRepo.findOne({ where: { id: programId } });
  }

  private async loadSchoolPlanEntries(schoolId: string, planId: string) {
    const plan = await this.schoolPlanRepo.findOne({ where: { id: planId, school_id: schoolId } });
    if (!plan) throw new NotFoundException('Plan bulunamadı');
    const entries = await this.schoolPlanEntryRepo.find({ where: { plan_id: planId } });
    if (!entries.length) {
      throw new BadRequestException({ code: 'EMPTY_PLAN', message: 'Planda ders satırı yok.' });
    }
    return { plan, entries };
  }

  /** Okul programı → önizleme (aktarma yok). */
  async previewImportFromSchoolPlan(studioId: string, schoolId: string, planId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const { plan, entries } = await this.loadSchoolPlanEntries(schoolId, planId);
    const { rows, skipped, names_fixed } = aggregatePlanImportRows(entries);
    const subjects = subjectsFromPlanRows(rows);
    return {
      plan: { id: plan.id, name: plan.name ?? null, status: plan.status },
      entry_count: entries.length,
      skipped,
      names_fixed,
      subject_count: subjects.length,
      assignment_count: rows.length,
      subjects: subjects.slice(0, 80),
      assignments: rows.slice(0, 40).map((r) => ({
        subject_name: r.subject,
        subject_raw: r.subject_raw !== r.subject ? r.subject_raw : undefined,
        class_section: r.section,
        weekly_hours: r.weekly_hours,
        teacher_count: r.teacher_ids.length,
      })),
    };
  }

  private async upsertSubjectsFromPlanRows(
    studioId: string,
    rows: PlanImportRow[],
    replace: boolean,
  ): Promise<{ created: number; updated: number }> {
    if (replace) {
      await this.subjectRepo.delete({ studio_id: studioId });
    }
    const catalog = subjectsFromPlanRows(rows);
    let created = 0;
    let updated = 0;
    for (const sub of catalog) {
      const existing = replace
        ? null
        : await this.subjectRepo.findOne({ where: { studio_id: studioId, name: sub.name } });
      if (existing) {
        await this.subjectRepo.save({
          ...existing,
          class_hours: { ...existing.class_hours, ...sub.class_hours },
        });
        updated++;
      } else {
        await this.subjectRepo.save({
          studio_id: studioId,
          name: sub.name,
          class_hours: sub.class_hours,
        } as DersDagitSubject);
        created++;
      }
    }
    return { created, updated };
  }

  private async upsertAssignmentsFromPlanRows(
    studioId: string,
    rows: PlanImportRow[],
    replace: boolean,
  ): Promise<{ created: number; updated: number }> {
    if (replace) {
      const existing = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
      if (existing.length) {
        await this.assignmentTeacherRepo.delete({ assignment_id: In(existing.map((a) => a.id)) });
        await this.assignmentRepo.delete({ studio_id: studioId });
      }
    }
    const existing = replace
      ? []
      : await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const links = existing.length
      ? await this.assignmentTeacherRepo.find({
          where: { assignment_id: In(existing.map((r) => r.id)) },
        })
      : [];
    const teachersByAssign = new Map<string, string[]>();
    for (const l of links) {
      const arr = teachersByAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      teachersByAssign.set(l.assignment_id, arr);
    }
    const subjectRows = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const subjectByName = new Map(subjectRows.map((s) => [s.name, s.id]));
    const catalogKey = (subjectId: string | null, subjectName: string, sec: string) =>
      `${subjectId ?? ''}\0${subjectName}\0${sec}`;
    const byKey = new Map<string, DersDagitAssignment>();
    for (const a of existing) {
      if ((a.class_sections?.length ?? 0) !== 1) continue;
      const sec = a.class_sections[0]!;
      byKey.set(catalogKey(a.subject_id, a.subject_name, sec), a);
    }

    let created = 0;
    let updated = 0;
    for (const r of rows) {
      const subject_id = subjectByName.get(r.subject) ?? null;
      const payload = {
        subject_id,
        subject_name: r.subject,
        class_sections: [r.section],
        weekly_hours: r.weekly_hours,
        max_per_day: Math.min(4, r.weekly_hours),
        min_days_per_week: Math.min(5, Math.max(1, Math.ceil(r.weekly_hours / 2))),
        room_ids: [] as string[],
        teacher_ids: r.teacher_ids,
      };
      const prev = byKey.get(catalogKey(subject_id, r.subject, r.section));
      if (prev) {
        await this.upsertAssignment(studioId, {
          id: prev.id,
          ...payload,
          room_ids: prev.room_ids ?? [],
        });
        updated++;
      } else {
        await this.upsertAssignment(studioId, payload);
        created++;
      }
    }
    return { created, updated };
  }

  /** Okul ders programı planından ders kataloğu + atama (onay sonrası). */
  async importFromSchoolPlan(
    studioId: string,
    schoolId: string,
    planId: string,
    userId: string,
    opts?: {
      replace?: boolean;
      replace_subjects?: boolean;
      replace_assignments?: boolean;
      import_subjects?: boolean;
      import_assignments?: boolean;
    },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const { plan, entries } = await this.loadSchoolPlanEntries(schoolId, planId);
    const { rows } = aggregatePlanImportRows(entries);
    const replaceAssignments = !!(opts?.replace_assignments ?? opts?.replace);
    const replaceSubjects = !!opts?.replace_subjects;
    const importSubjects = opts?.import_subjects !== false;
    const importAssignments = opts?.import_assignments !== false;

    let subjects_created = 0;
    let subjects_updated = 0;
    let assignments_created = 0;
    let assignments_updated = 0;

    if (importSubjects) {
      const s = await this.upsertSubjectsFromPlanRows(studioId, rows, replaceSubjects);
      subjects_created = s.created;
      subjects_updated = s.updated;
    }
    if (importAssignments) {
      const a = await this.upsertAssignmentsFromPlanRows(studioId, rows, replaceAssignments);
      assignments_created = a.created;
      assignments_updated = a.updated;
    }

    await this.audit(studioId, userId, 'plan.imported', {
      plan_id: planId,
      subjects_created,
      assignments_created,
    });
    return {
      plan_id: planId,
      plan_name: plan.name,
      subjects_created,
      subjects_updated,
      assignments_created,
      assignments_updated,
      imported: assignments_created + assignments_updated,
    };
  }

  /** @deprecated use importFromSchoolPlan */
  async importAssignmentsFromSchoolPlan(
    studioId: string,
    schoolId: string,
    planId: string,
    userId: string,
    opts?: { replace?: boolean },
  ) {
    return this.importFromSchoolPlan(studioId, schoolId, planId, userId, {
      replace_assignments: opts?.replace,
      import_subjects: true,
      import_assignments: true,
    });
  }

  private async collectStudioSections(studioId: string, schoolId: string): Promise<string[]> {
    const [profiles, assignments, subjectRows, suggested] = await Promise.all([
      this.classProfileRepo.find({ where: { studio_id: studioId }, select: ['class_sections'] }),
      this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['class_sections'] }),
      this.subjectRepo.find({ where: { studio_id: studioId }, select: ['class_hours'] }),
      this.suggestClassSections(schoolId).catch(() => [] as string[]),
    ]);
    const set = new Set<string>();
    for (const p of profiles) {
      for (const s of p.class_sections ?? []) if (s?.trim()) set.add(s.trim());
    }
    for (const a of assignments) {
      for (const s of a.class_sections ?? []) if (s?.trim()) set.add(s.trim());
    }
    for (const sub of subjectRows) {
      for (const sec of Object.keys(sub.class_hours ?? {})) if (sec?.trim()) set.add(sec.trim());
    }
    for (const s of suggested) if (s?.trim()) set.add(s.trim());
    if (!set.size) {
      for (let g = 5; g <= 12; g++) set.add(`${g}A`);
    }
    return sortClassSections([...set]);
  }

  private async loadYillikWeeklyHours(
    grades: number[],
    academicYear?: string | null,
  ): Promise<Map<string, { label: string; hours: number }>> {
    if (!grades.length) return new Map();
    const qb = this.yillikPlanRepo
      .createQueryBuilder('yp')
      .select('yp.subject_code', 'code')
      .addSelect('yp.subject_label', 'label')
      .addSelect('yp.grade', 'grade')
      .addSelect('SUM(yp.ders_saati)', 'hours')
      .where('yp.grade IN (:...grades)', { grades })
      .andWhere('(yp.curriculum_model IS NULL OR yp.curriculum_model = :maarif)', { maarif: 'maarif' })
      .groupBy('yp.subject_code')
      .addGroupBy('yp.subject_label')
      .addGroupBy('yp.grade');
    if (academicYear?.trim()) {
      qb.andWhere('yp.academic_year = :ay', { ay: academicYear.trim() });
    }
    const rows = await qb.getRawMany<{ code: string; label: string; grade: number; hours: string }>();
    const map = new Map<string, { label: string; hours: number }>();
    for (const r of rows) {
      const code = (r.code ?? '').toLowerCase().trim();
      const h = Math.round(Number(r.hours) || 0);
      if (!code || h < 1) continue;
      map.set(`${code}\0${r.grade}`, { label: r.label, hours: h });
    }
    return map;
  }

  async previewTtkbSeed(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const sections = await this.collectStudioSections(studioId, schoolId);
    const grades = [...new Set(sections.map((s) => gradeFromClassSection(s)).filter((g): g is number => g != null))];
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    const cells = buildTtkbSeedCells(sections, profile.type, yillik);
    const subjects = mergeCellsToSubjects(cells);
    const sections_without_grade = sections.filter((s) => gradeFromClassSection(s) == null);
    const empty_message =
      cells.length === 0
        ? sections_without_grade.length
          ? `Şube adından sınıf seviyesi okunamadı: ${sections_without_grade.slice(0, 5).join(', ')}${sections_without_grade.length > 5 ? '…' : ''}. Örn. 9/A veya 10-BT kullanın.`
          : 'TTKB listesi üretilemedi. Kurulumda sınıf profili ekleyin ve okul türünü kaydedin.'
        : undefined;
    return {
      sections,
      sections_without_grade,
      empty_message,
      school_type: profile.type,
      cell_count: cells.length,
      subject_count: subjects.size,
      yillik_plan_keys: yillik.size,
      sample: cells.slice(0, 30),
      cells: cells.map((c) => ({
        subject_code: c.subject_code,
        subject_name: c.subject_name,
        class_section: c.class_section,
        grade: c.grade,
        weekly_hours: c.weekly_hours,
        source: c.source,
      })),
      totals_by_section: Object.fromEntries(
        sections.map((sec) => [
          sec,
          cells.filter((c) => c.class_section === sec).reduce((s, c) => s + c.weekly_hours, 0),
        ]),
      ),
    };
  }

  async seedFromTtkb(
    studioId: string,
    schoolId: string,
    userId: string,
    opts?: { replace?: boolean; sync_assignments?: boolean },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const sections = await this.collectStudioSections(studioId, schoolId);
    const grades = [...new Set(sections.map((s) => gradeFromClassSection(s)).filter((g): g is number => g != null))];
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    let cells = buildTtkbSeedCells(sections, profile.type, yillik);
    if (!cells.length) {
      const bad = sections.filter((s) => gradeFromClassSection(s) == null);
      throw new BadRequestException({
        code: 'TTKB_EMPTY',
        message: bad.length
          ? `Şube adından sınıf seviyesi okunamadı: ${bad.join(', ')}. Örn. 9/A veya 10-BT.`
          : 'TTKB listesi üretilemedi. Kurulumda sınıf profili ekleyin ve okul türünü kaydedin.',
      });
    }
    for (const c of cells) {
      if (c.source === 'ttkb') {
        const h = await this.appConfig.getDersSaati(c.subject_code, c.grade);
        if (h >= 1) c.weekly_hours = h;
      }
    }
    const subjectMap = mergeCellsToSubjects(cells);
    if (opts?.replace) {
      await this.assignmentRepo.delete({ studio_id: studioId });
      await this.subjectRepo.delete({ studio_id: studioId });
    }
    const existing = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const byCode = new Map(
      existing.map((s) => [(s.short_code ?? s.name).toLowerCase(), s]),
    );
    let created = 0;
    let updated = 0;
    for (const [code, row] of subjectMap) {
      const prev = byCode.get(code);
      if (prev) {
        const mergedHours = { ...(prev.class_hours ?? {}), ...row.class_hours };
        await this.subjectRepo.save({
          ...prev,
          class_hours: mergedHours,
          is_elective: row.is_elective || prev.is_elective,
        });
        updated++;
      } else {
        await this.subjectRepo.save({
          studio_id: studioId,
          name: row.name,
          short_code: row.short_code,
          class_hours: row.class_hours,
          is_elective: row.is_elective,
        });
        created++;
      }
    }
    settings.ttkb_seed_at = new Date().toISOString();
    studio.settings = settings;
    await this.studioRepo.save(studio);
    let assignments_created = 0;
    if (opts?.sync_assignments) {
      const r = await this.syncSubjectsToAssignments(studioId, userId, { replace: !!opts.replace });
      assignments_created = r.created;
    }
    await this.audit(studioId, userId, 'subjects.seeded_ttkb', {
      created,
      updated,
      sections: sections.length,
      assignments_created,
    });
    return { created, updated, sections: sections.length, assignments_created, subject_count: subjectMap.size };
  }

  async syncSubjectsToAssignments(studioId: string, userId: string, opts?: { replace?: boolean }) {
    const subjects = await this.subjectRepo.find({ where: { studio_id: studioId } });
    if (opts?.replace) {
      await this.assignmentRepo.delete({ studio_id: studioId });
    }
    const existing = opts?.replace
      ? []
      : await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const links = existing.length
      ? await this.assignmentTeacherRepo.find({
          where: { assignment_id: In(existing.map((r) => r.id)) },
        })
      : [];
    const teachersByAssign = new Map<string, string[]>();
    for (const l of links) {
      const arr = teachersByAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      teachersByAssign.set(l.assignment_id, arr);
    }
    const catalogKey = (subjectId: string, sec: string) => `${subjectId}\0${sec}`;
    const byCatalog = new Map<string, DersDagitAssignment>();
    for (const a of existing) {
      if (!a.subject_id || (a.class_sections?.length ?? 0) !== 1) continue;
      const sec = a.class_sections[0]!;
      byCatalog.set(catalogKey(a.subject_id, sec), a);
    }

    let created = 0;
    let updated = 0;
    for (const sub of subjects) {
      for (const [sec, hrs] of Object.entries(sub.class_hours ?? {})) {
        const h = Number(hrs);
        if (!sec || !h || h < 1) continue;
        const prev = byCatalog.get(catalogKey(sub.id, sec));
        const payload = {
          subject_id: sub.id,
          subject_name: sub.name,
          class_sections: [sec],
          weekly_hours: h,
          min_days_per_week: Math.min(5, Math.max(1, Math.ceil(h / 2))),
          max_per_day: Math.min(4, h),
        };
        if (prev) {
          await this.upsertAssignment(studioId, {
            id: prev.id,
            ...payload,
            room_ids: prev.room_ids ?? [],
            teacher_ids: teachersByAssign.get(prev.id) ?? [],
          });
          updated++;
        } else {
          await this.upsertAssignment(studioId, {
            ...payload,
            room_ids: [],
            teacher_ids: [],
          });
          created++;
        }
      }
    }
    await this.audit(studioId, userId, 'assignments.synced_from_catalog', { created, updated });
    return { created, updated };
  }

  async bulkUpsertAssignments(
    studioId: string,
    rows: Array<Partial<DersDagitAssignment> & { teacher_ids?: string[]; id?: string }>,
    opts?: { delete_missing?: boolean },
  ) {
    if (opts?.delete_missing) {
      const keep = new Set(rows.map((r) => r.id).filter(Boolean));
      const existing = await this.assignmentRepo.find({ where: { studio_id: studioId } });
      for (const e of existing) {
        if (!keep.has(e.id)) await this.deleteAssignment(e.id, studioId);
      }
    }
    const out: DersDagitAssignment[] = [];
    for (const row of rows) {
      out.push(await this.upsertAssignment(studioId, row));
    }
    return { updated: out.length, assignments: out };
  }

  async cloneProgram(studioId: string, programId: string, userId: string) {
    const src = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!src) throw new NotFoundException();
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    const copy = await this.programRepo.save({
      studio_id: studioId,
      name: `${src.name ?? 'Program'} (kopya)`,
      status: 'generated',
      version: (src.version ?? 1) + 1,
      score: src.score,
      generation_meta: { ...src.generation_meta, cloned_from: programId },
    });
    await this.programEntryRepo.save(
      entries.map((e) => ({
        program_id: copy.id,
        assignment_id: e.assignment_id,
        user_id: e.user_id,
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
        room_id: e.room_id,
        group_id: e.group_id,
        is_locked: e.is_locked,
      })),
    );
    await this.audit(studioId, userId, 'program.cloned', { from: programId, to: copy.id });
    return copy;
  }

  async createProgramShareLink(studioId: string, programId: string, opts?: { class_section?: string | null }) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    const token = prog.share_token ?? randomBytes(24).toString('hex');
    await this.programRepo.update(programId, { share_token: token });
    const section = opts?.class_section?.trim();
    const q = section ? `?section=${encodeURIComponent(section)}` : '';
    return { share_token: token, path: `/ders-dagit-paylasim/${token}${q}`, class_section: section ?? null };
  }

  async revokeProgramShareLink(studioId: string, programId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    await this.programRepo.update(programId, { share_token: null });
    return { ok: true };
  }

  async getProgramByShareToken(token: string, classSection?: string | null) {
    const program = await this.programRepo.findOne({ where: { share_token: token } });
    if (!program) return null;
    const entries = await this.programEntryRepo.find({
      where: { program_id: program.id },
      order: { class_section: 'ASC', day_of_week: 'ASC', lesson_num: 'ASC' },
    });
    const studio = await this.studioRepo.findOne({
      where: { id: program.studio_id },
      select: ['id', 'name', 'academic_year'],
    });
    const sections = sortClassSections([...new Set(entries.map((e) => e.class_section))]);
    const sec = classSection?.trim();
    const filtered = sec ? entries.filter((e) => e.class_section === sec) : entries;
    return {
      program: {
        id: program.id,
        name: program.name,
        score: program.score,
        academic_year: studio?.academic_year,
        studio_name: studio?.name,
      },
      class_sections: sections,
      class_section: sec ?? null,
      entries: filtered.map((e) => ({
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
      })),
    };
  }

  async exportCouncilPdf(programId: string, studioId: string, schoolId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const [school, studio, rows] = await Promise.all([
      this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name'] }),
      this.studioRepo.findOne({ where: { id: studioId }, select: ['academic_year'] }),
      this.buildExportRows(programId, studioId),
    ]);
    const violations = (program.generation_meta as { violations?: string[] })?.violations ?? [];
    const byClass = new Map<string, number>();
    for (const r of rows) {
      byClass.set(r.class_section, (byClass.get(r.class_section) ?? 0) + 1);
    }
    const teachers = new Set(rows.map((r) => r.user_id).filter(Boolean));
    return this.pdfService.buildCouncilPdf({
      school_name: school?.name ?? 'Okul',
      program_name: program.name ?? 'Ders Dağıt Programı',
      academic_year: studio?.academic_year ?? null,
      score: program.score,
      entry_count: rows.length,
      class_count: byClass.size,
      teacher_count: teachers.size,
      violations: violations.slice(0, 15),
      by_class: [...byClass.entries()]
        .map(([section, weekly_slots]) => ({ section, weekly_slots }))
        .sort((a, b) => compareClassSections(a.section, b.section)),
    });
  }

  async exportParentClassPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    classSection: string,
  ) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const [studio, school, rows] = await Promise.all([
      this.studioRepo.findOne({ where: { id: studioId }, select: ['name', 'academic_year'] }),
      this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] }),
      this.buildExportRows(programId, studioId),
    ]);
    const sec = classSection.trim();
    if (!rows.some((r) => r.class_section === sec)) {
      throw new BadRequestException({ code: 'NO_SECTION', message: 'Bu şubede program satırı yok.' });
    }
    const title = `${school?.name ?? studio?.name ?? 'Okul'}${studio?.academic_year ? ` · ${studio.academic_year}` : ''}`;
    return this.pdfService.buildParentClassPdf(title, sec, rows);
  }

  async exportPublicParentPdf(token: string, classSection?: string) {
    const data = await this.getProgramByShareToken(token, classSection);
    if (!data) throw new NotFoundException();
    const sec = classSection?.trim() || data.class_sections[0];
    if (!sec) throw new BadRequestException({ code: 'NO_SECTION', message: 'Şube belirtilmedi.' });
    const rows: ExportEntry[] = data.entries.map((e) => ({
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      subject: e.subject,
    }));
    const title = `${data.program.studio_name ?? 'Okul'}${data.program.academic_year ? ` · ${data.program.academic_year}` : ''}`;
    return this.pdfService.buildParentClassPdf(title, sec, rows);
  }

  async archiveProgram(studioId: string, programId: string, userId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    if (prog.status === 'published') {
      throw new BadRequestException({ code: 'PUBLISHED', message: 'Yayındaki program arşivlenemez.' });
    }
    await this.programRepo.update(programId, { archived_at: new Date() });
    await this.audit(studioId, userId, 'program.archived', { program_id: programId });
    return { ok: true };
  }

  async unarchiveProgram(studioId: string, programId: string, userId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    await this.programRepo.update(programId, { archived_at: null });
    await this.audit(studioId, userId, 'program.unarchived', { program_id: programId });
    return { ok: true };
  }

  async patchProgram(
    studioId: string,
    programId: string,
    userId: string,
    body: { name?: string },
  ) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Program adı gerekli.' });
      await this.programRepo.update(programId, { name });
    }
    await this.audit(studioId, userId, 'program.updated', { program_id: programId, fields: Object.keys(body) });
    return this.programRepo.findOne({ where: { id: programId } });
  }

  async getTeacherProgramGrid(studioId: string, programId: string) {
    const { program, entries } = await this.getProgram(programId, studioId);
    const userIds = [...new Set(entries.map((e) => e.user_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const labels = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    const byTeacher = new Map<string, typeof entries>();
    for (const uid of userIds) byTeacher.set(uid, []);
    for (const e of entries) {
      if (!e.user_id) continue;
      byTeacher.get(e.user_id)!.push(e);
    }
    return {
      program,
      teachers: [...byTeacher.entries()].map(([id, slots]) => ({
        teacher_id: id,
        label: labels.get(id) ?? id.slice(0, 8),
        slots: slots.map((s) => ({
          day_of_week: s.day_of_week,
          lesson_num: s.lesson_num,
          class_section: s.class_section,
          subject: s.subject,
        })),
      })),
    };
  }

  async getGenerationJob(studioId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId, studio_id: studioId } });
    if (!job) throw new NotFoundException();
    return job;
  }

  private async listSchoolTeachers(schoolId: string) {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.teacher })
      .andWhere('(u.school_id = :sid OR u.teacher_assignment_school_id = :sid)', { sid: schoolId })
      .getMany();
  }

  private resolveEokulTeacher(
    teachers: User[],
    tc: string | null,
    name: string | null,
  ): { user_id: string | null; warning?: string } {
    if (tc) {
      const hit = teachers.find((u) => u.evrakDefaults?.yolluk_teacher?.tc_kimlik === tc);
      if (hit) return { user_id: hit.id };
      return { user_id: null, warning: `TC eşleşmedi: ${tc}` };
    }
    if (name?.trim()) {
      const norm = name.trim().toLocaleUpperCase('tr-TR');
      const hit = teachers.find((u) => (u.display_name ?? '').trim().toLocaleUpperCase('tr-TR') === norm);
      if (hit) return { user_id: hit.id };
      return { user_id: null, warning: `Öğretmen adı eşleşmedi: ${name}` };
    }
    return { user_id: null };
  }

  /** Faz 34 — e-Okul önizleme */
  async previewEokulImport(
    schoolId: string,
    body: { csv?: string; file_base64?: string; format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto' },
  ) {
    const buffer = body.file_base64 ? Buffer.from(body.file_base64, 'base64') : undefined;
    const parsed = parseEokulImport({ csv: body.csv, buffer, format: body.format ?? 'auto' });
    const teachers = await this.listSchoolTeachers(schoolId);
    const rows = parsed.assignments.map((a) => {
      const match = this.resolveEokulTeacher(teachers, a.teacher_tc, a.teacher_name);
      return {
        ...a,
        resolved_teacher_id: match.user_id,
        match_warning: match.warning ?? null,
      };
    });
    const unmatched = rows.filter((r) => (r.teacher_tc || r.teacher_name) && !r.resolved_teacher_id).length;
    if (unmatched > 0) {
      parsed.warnings.push({
        code: 'TEACHER_UNMATCHED',
        message: `${unmatched} satırda öğretmen okul listesiyle eşleşmedi.`,
      });
    }
    return {
      ...parsed,
      rows,
      teacher_pool_size: teachers.length,
    };
  }

  async importEokulAssignments(
    studioId: string,
    schoolId: string,
    userId: string,
    body: {
      csv?: string;
      file_base64?: string;
      format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
      replace?: boolean;
      auto_elective_groups?: boolean;
    },
  ) {
    const preview = await this.previewEokulImport(schoolId, body);
    if (!preview.rows.length) {
      throw new BadRequestException({ code: 'EOKUL_EMPTY', message: 'İçe aktarılacak atama yok.', warnings: preview.warnings });
    }
    if (body.replace) {
      const existing = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
      if (existing.length) {
        await this.assignmentTeacherRepo.delete({ assignment_id: In(existing.map((a) => a.id)) });
        await this.assignmentRepo.delete({ studio_id: studioId });
      }
    }
    const merge = new Map<
      string,
      { subject_name: string; class_sections: string[]; weekly_hours: number; teacher_ids: string[] }
    >();
    for (const r of preview.rows) {
      const secs = sortClassSections(r.class_sections).join(',');
      const tid = r.resolved_teacher_id ?? '';
      const k = `${r.subject_name}\0${secs}\0${tid}`;
      const prev = merge.get(k);
      if (prev) {
        prev.weekly_hours = Math.max(prev.weekly_hours, r.weekly_hours);
      } else {
        merge.set(k, {
          subject_name: r.subject_name,
          class_sections: r.class_sections,
          weekly_hours: r.weekly_hours,
          teacher_ids: r.resolved_teacher_id ? [r.resolved_teacher_id] : [],
        });
      }
    }
    const created: DersDagitAssignment[] = [];
    for (const row of merge.values()) {
      created.push(
        await this.upsertAssignment(studioId, {
          subject_name: row.subject_name,
          class_sections: row.class_sections,
          weekly_hours: row.weekly_hours,
          teacher_ids: row.teacher_ids,
          max_per_day: Math.min(6, row.weekly_hours),
          min_days_per_week: Math.min(5, Math.max(1, Math.ceil(row.weekly_hours / 2))),
          room_ids: [],
        }),
      );
    }
    let elective_pools_created = 0;
    if (body.auto_elective_groups) {
      const pools = await this.ensureElectivePoolsFromImport(studioId, preview.rows);
      elective_pools_created = pools.length;
      await this.linkElectiveAssignmentsToPools(studioId, pools);
    }
    await this.audit(studioId, userId, 'assignments.imported_eokul', {
      format: preview.format,
      count: created.length,
      replace: !!body.replace,
      elective_pools: elective_pools_created,
    });
    return {
      imported: created.length,
      format: preview.format,
      warnings: preview.warnings,
      rows_previewed: preview.rows.length,
      elective_pools_created,
    };
  }

  eokulImportTemplateXlsx(): Buffer {
    return buildEokulImportTemplateXlsx();
  }
}
