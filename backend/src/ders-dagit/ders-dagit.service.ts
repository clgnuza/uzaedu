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
  augmentStrictKeysWithActiveRules,
  buildStrictRuleKeys,
  mergePlanningRelationsIntoRules,
  normalizePlanningRelations,
  validatePlanningRelationsForGenerate,
} from './ders-dagit.rules-merge';
import { filterGenerateBlockingValidationIssues } from './ders-dagit.generate-gate';
import { internshipDaysBySectionFromProfiles, normalizeInternshipDays } from './ders-dagit.internship';
import {
  ADVANCED_PLANNING_RULES,
  SIMPLE_PLANNING_RULES,
  importanceWeight,
  relationDefinition,
  type PlanningRelationRow,
} from './ders-dagit.planning-relations';
import {
  buildSectionAliasMap,
  dedupeSectionAliases,
  formatClassroomDisplayName,
  isVerboseSectionName,
  buildWeeklyHoursFromAssignments,
  mergeClassHoursBySectionAlias,
  normalizeClassSectionNamesFromPool,
  roomCoversSection,
  sectionFromClassroomDisplayName,
  sectionKeyFromRoomFields,
  sectionsEquivalent,
} from './class-section-canonical';
import { compareClassSections, sortClassSections, sortValidationIssues } from './class-section-sort';
import {
  isSectionShareEnabled,
  parseProgramShareSettings,
  resolveShareEnabledSections,
  type ProgramShareSettings,
} from './ders-dagit-program-share';
import {
  countClassSectionsFromProfiles,
  validateStudioData,
  type ValidationIssue,
} from './ders-dagit.validation';
import {
  checkAssignmentCapacity,
  type AssignmentCapacityWarning,
} from './ders-dagit.assignment-capacity';
import { enrichValidationIssues } from './ders-dagit.validation-fix-hints';
import {
  buildMaxLessonByDay,
  computeFeasibilityWarnings,
} from './ders-dagit.validation-feasibility';
import {
  assignmentBlockPlacementOk,
  assignmentPlacementSpec,
} from './ders-dagit.assignment-blocks';
import { defaultMinDaysFromWeeklyHours } from './ders-dagit.min-days';
import { runCspSolver, stripInvalidPatternPlacements } from './ders-dagit.solver-csp';
import {
  runConstraintSolver,
  type SolverAssignment,
  type SolverContext,
  type SolverSlot,
} from './ders-dagit.solver';
import { runAscLikeSearch } from './ders-dagit.search';
import { expandAssignmentsForSolver } from './ders-dagit.solver-input';
import { linkGenerationViolations } from './ders-dagit.generation-hints';
import { buildProgramScoreBreakdown, type ProgramScoreBreakdown } from './ders-dagit.score-breakdown';
import {
  buildUnplacedPlacementReport,
  type UnplacedPlacementReport,
} from './ders-dagit.unplaced-report';
import {
  buildGeneratedProgramName,
  clipProgramEntryFields,
  formatProgramEntrySubject,
  resolveAssignmentSubjectLabel,
  subjectCatalogMap,
} from './ders-dagit.program-labels';
import { DutySlot } from '../duty/entities/duty-slot.entity';
import { randomBytes } from 'crypto';
import { applySoftRulePenalties } from './ders-dagit.solver-rules';
import {
  groupModeCatalogForSchool,
  normalizeGroupMode,
  type DersDagitGroupMode,
} from './ders-dagit.groups';
import { defaultGroupModeForSchool, groupPresetsForSchool, schoolTypeGroupHint } from './ders-dagit.group-presets';
import { suggestGroupsFromData, suggestionExists } from './ders-dagit.group-suggest';
import {
  aggregatePlanImportRows,
  mergePlanImportRows,
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
  excludedClassSectionsToJson,
  isClassSectionExcluded,
  parseExcludedClassSections,
  parseSectionSchedules,
  sectionSchedulesToJson,
  type SectionScheduleConfig,
} from './ders-dagit.section-schedule';
import { syncSectionSchedulesOpenSlots } from './ders-dagit.section-schedule-sync';
import {
  parseDualEducation,
  pmFirstLessonNum,
  normalizeEducationShift,
  type DualEducationConfig,
  type EducationShift,
} from './ders-dagit.dual-education';
import {
  parseDistributionPolicy,
  shouldEnforceDistributionPattern,
  type DistributionPolicy,
} from './ders-dagit.distribution-policy';
import {
  estimateGenerationSearchCap,
  generationBudgetFor,
  parsePlacementSearchPolicy,
  type PlacementSearchPolicy,
} from './ders-dagit.placement-search';
import {
  inferDayDistribution,
  isValidDayDistribution,
  remainingPatternChunks,
  distributionToPlacementHints,
} from './ders-dagit.day-distribution';
import { applyGenerateRelaxToContext } from './ders-dagit.generate-relax';
import { placementPatternForAssignment } from './ders-dagit.solver-distribution';
import { parseSchoolProfile, type MebSchoolType, type StudioSchoolProfile } from './ders-dagit.school-profile';
import {
  classProfilePresetsForSchool,
  defaultMaxLessonsPerDay,
  expectedWeeklyHoursForSections,
} from './ders-dagit.class-profile-presets';
import {
  buildReportHeaderLine,
  mergeReportSettings,
  parseStudioReportSettings,
  reportSettingsToJson,
  type StudioReportSettings,
} from './ders-dagit.report-settings';
import {
  clusterElectiveImportRows,
  checkAihlWeeklyNorm,
  isElectiveSubjectName,
} from './ders-dagit.elective';
import { buildElectivePoolDraftsFromCatalog } from './ders-dagit.elective-pools';
import { dutySlotsToUnavailable, findDutyPlacementConflicts } from './ders-dagit.duty-sync';
import { teacherHourNormFromSchool } from './ders-dagit.extra-lesson-sync';
import {
  computeProgramClashes,
  type ProgramClashContext,
  wouldClash,
  wouldClashAt,
} from './ders-dagit.program-clash';
import archiver = require('archiver');
import { ExtraLessonParams } from '../extra-lesson-params/entities/extra-lesson-params.entity';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { AppConfigService } from '../app-config/app-config.service';
import {
  buildTtkbCatalogBySchoolType,
  buildTtkbElectiveCatalogBySchoolType,
  buildTtkbSeedCells,
  catalogRowsToPreviewCells,
  gradesForSchoolType,
  groupPreviewCellsByGrade,
  mergeCellsToSubjects,
  mergeGradeCatalogToSubjects,
  summarizeSubjectsAcrossGrades,
  gradeFromClassSection,
  type TtkbPreviewCellDto,
} from './ders-dagit.ttkb-seed';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { SchoolSubject } from '../classes-subjects/entities/school-subject.entity';
import { parseEokulImport, buildEokulImportTemplateXlsx, type EokulAssignmentDraft } from './ders-dagit.eokul-import';
import { parseAscTimetablesXml, type AscImportExtras, type AscRoomDraft } from './ders-dagit.asc-import';
import { findTeacherByImportedName, resolveImportedTeacherIds, resolveImportedTeacherIdsWithAsc } from './ders-dagit.teacher-name-match';
import { normalizeAvailabilityPeriods } from './ders-dagit-teacher-availability.settings';
import {
  STUDIO_TRANSFER_VERSION,
  TRANSFER_FORMAT_CATALOG,
  resolveTransferImportFormat,
  sniffTransferImportFormat,
  type StudioTransferPackageV1,
} from './ders-dagit.studio-transfer';
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
import { DersDagitAvailabilityService } from './ders-dagit-availability.service';
import { mergeTeacherAvailabilityPolicy } from './ders-dagit-teacher-availability.settings';
import type { PdfHeaderInfo } from './ders-dagit-pdf-layout';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from '../teacher-timetable/entities/school-timetable-plan-entry.entity';
import { UserRole, UserStatus, TeacherSchoolMembershipStatus } from '../types/enums';
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
    @InjectRepository(SchoolClass) private readonly schoolClassRepo: Repository<SchoolClass>,
    @InjectRepository(SchoolSubject) private readonly schoolSubjectRepo: Repository<SchoolSubject>,
    private readonly availabilityService: DersDagitAvailabilityService,
  ) {}

  private readonly validationResultCache = new Map<
    string,
    { at: number; issues: ValidationIssue[] }
  >();
  private readonly sectionPoolCache = new Map<string, { at: number; data: string[] }>();
  private readonly fairnessCache = new Map<string, { at: number; data: Awaited<ReturnType<DersDagitService['getFairnessForProgram']>> }>();
  private readonly capacityInputCache = new Map<
    string,
    { at: number; data: Awaited<ReturnType<DersDagitService['loadCapacityCheckInputs']>> }
  >();
  private static readonly VALIDATION_CACHE_MS = 180_000;
  private static readonly SECTION_POOL_CACHE_MS = 45_000;
  private static readonly FAIRNESS_CACHE_MS = 120_000;
  private static readonly CAPACITY_INPUT_CACHE_MS = 12_000;

  /** Atama CRUD: doğrulama/kapasite; şube havuzu atama satırlarında zaten var. */
  private invalidateValidationResultCache(studioId: string, opts?: { sectionPool?: boolean }) {
    this.validationResultCache.delete(studioId);
    this.capacityInputCache.delete(studioId);
    if (opts?.sectionPool === false) return;
    for (const key of [...this.sectionPoolCache.keys()]) {
      if (key.startsWith(`${studioId}:`)) this.sectionPoolCache.delete(key);
    }
  }

  private async loadCapacityCheckInputs(studioId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['school_id'] });
    const [profiles, teacherRows, subjects, assignments] = await Promise.all([
      this.classProfileRepo.find({ where: { studio_id: studioId } }),
      this.listTeacherConfigs(studioId),
      this.subjectRepo.find({ where: { studio_id: studioId } }),
      this.assignmentRepo.find({ where: { studio_id: studioId } }),
    ]);
    const sectionPool = studio
      ? await this.getStudioSectionPoolCached(studioId, studio.school_id)
      : [];
    const sectionPoolWide = [
      ...sectionPool,
      ...profiles.flatMap((p) => p.class_sections ?? []),
      ...subjects.flatMap((s) => Object.keys(s.class_hours ?? {})),
      ...assignments.flatMap((a) => a.class_sections ?? []),
    ];
    const links = await this.findAssignmentTeacherLinks(assignments.map((a) => a.id));
    const byAssign = new Map<string, string[]>();
    for (const l of links) {
      const arr = byAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      byAssign.set(l.assignment_id, arr);
    }
    return { profiles, teacherRows, subjects, assignments, sectionPoolWide, byAssign };
  }

  private async getCapacityCheckInputsCached(studioId: string) {
    const hit = this.capacityInputCache.get(studioId);
    if (hit && Date.now() - hit.at < DersDagitService.CAPACITY_INPUT_CACHE_MS) return hit.data;
    const data = await this.loadCapacityCheckInputs(studioId);
    this.capacityInputCache.set(studioId, { at: Date.now(), data });
    return data;
  }

  private async getStudioSectionPoolCached(studioId: string, schoolId: string): Promise<string[]> {
    const key = `${studioId}:${schoolId}`;
    const hit = this.sectionPoolCache.get(key);
    if (hit && Date.now() - hit.at < DersDagitService.SECTION_POOL_CACHE_MS) return hit.data;
    const data = await this.collectStudioSectionPoolRaw(studioId, schoolId);
    this.sectionPoolCache.set(key, { at: Date.now(), data });
    return data;
  }

  async runValidationCached(studioId: string): Promise<ValidationIssue[]> {
    const hit = this.validationResultCache.get(studioId);
    if (hit && Date.now() - hit.at < DersDagitService.VALIDATION_CACHE_MS) {
      return hit.issues;
    }
    const issues = await this.runValidation(studioId);
    this.validationResultCache.set(studioId, { at: Date.now(), issues });
    return issues;
  }

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

  async getStudioOverview(studioId: string, schoolId: string, opts?: { light?: boolean }) {
    const light = opts?.light === true;
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
      primaryProgram,
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
      light
        ? Promise.resolve(null)
        : this.programRepo.findOne({
            where: { studio_id: studioId, archived_at: IsNull() },
            order: { is_favorite: 'DESC', updated_at: 'DESC' },
            select: ['id'],
          }),
    ]);
    let validation: ValidationIssue[] = [];
    if (light) {
      const hit = this.validationResultCache.get(studioId);
      validation = hit?.issues ?? [];
    } else {
      validation = await this.runValidationCached(studioId);
    }
    const health = this.computeHealthScore({
      classCount,
      teacherCount,
      assignmentCount,
      errors: validation.filter((v) => v.severity === 'error').length,
    });
    const placement =
      light || !primaryProgram
        ? null
        : await this.computeProgramPlacementSummary(studioId, primaryProgram.id);
    let healthOut = health;
    if (placement && placement.required_hours > 0 && !placement.is_fully_placed) {
      healthOut = Math.min(healthOut, placement.placement_percent);
    }
    if (studio.health_score !== healthOut) {
      studio.health_score = healthOut;
      // Yan etki — cevabı bekletme.
      void this.studioRepo.update(studioId, { health_score: healthOut }).catch(() => {});
    }
    return {
      studio,
      counts: { classCount, teacherCount, subjectCount, groupCount, assignmentCount, programCount },
      ruleSet,
      rule_catalog: DERS_DAGIT_RULE_CATALOG,
      validation,
      health_score: healthOut,
      placement,
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
    const [profiles, teacherRows, subjects, assignments, groups, studioRow] = await Promise.all([
      this.classProfileRepo.find({ where: { studio_id: studioId } }),
      this.listTeacherConfigs(studioId),
      this.subjectRepo.find({ where: { studio_id: studioId } }),
      this.assignmentRepo.find({
        where: { studio_id: studioId },
        select: [
          'id',
          'subject_name',
          'class_sections',
          'weekly_hours',
          'biweekly',
          'group_id',
          'room_ids',
          'unavailable_periods',
        ],
      }),
      this.groupRepo.find({ where: { studio_id: studioId }, select: ['id', 'abbreviation'] }),
      this.studioRepo.findOne({ where: { id: studioId }, select: ['id', 'school_id', 'settings'] }),
    ]);
    const sectionPool = studioRow
      ? await this.getStudioSectionPoolCached(studioId, studioRow.school_id)
      : [];
    const sectionPoolWide = [
      ...sectionPool,
      ...profiles.flatMap((p) => p.class_sections ?? []),
      ...subjects.flatMap((s) => Object.keys(s.class_hours ?? {})),
      ...assignments.flatMap((a) => a.class_sections ?? []),
    ];

    const catalog_hours_by_section: Record<string, number> = {};
    for (const sub of subjects) {
      const hours = mergeClassHoursBySectionAlias((sub.class_hours ?? {}) as Record<string, number>);
      for (const [sec, hrs] of Object.entries(hours)) {
        catalog_hours_by_section[sec] = (catalog_hours_by_section[sec] ?? 0) + hrs;
      }
    }
    const assigned_hours_by_section = buildWeeklyHoursFromAssignments(
      assignments.map((a) => ({
        subject_name: a.subject_name,
        class_sections: normalizeClassSectionNamesFromPool(a.class_sections ?? [], sectionPoolWide),
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
      })),
    );

    const teacher_hours: Record<string, { assigned: number; max?: number | null; min?: number | null }> = {};
    for (const t of teacherRows) {
      teacher_hours[t.user_id] = {
        assigned: 0,
        max: (t.mandatory_weekly_hours ?? 0) + (t.max_extra_weekly_hours ?? 0) || null,
        min: t.mandatory_weekly_hours,
      };
    }
    const links = await this.findAssignmentTeacherLinks(assignments.map((a) => a.id));
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
        class_sections: normalizeClassSectionNamesFromPool(p.class_sections ?? [], sectionPoolWide),
        max_lessons_per_day: p.max_lessons_per_day,
        min_weekly_lessons: p.min_weekly_lessons,
        max_weekly_lessons: p.max_weekly_lessons,
      })),
      teachers: teacherRows.map((t) => ({
        id: t.user_id,
        name: (t as { display_name?: string }).display_name ?? t.user_id,
      })),
      catalog_hours_by_section,
      assigned_hours_by_section,
      assignments: assignments.map((a) => ({
        id: a.id,
        subject_name: a.subject_name,
        class_sections: normalizeClassSectionNamesFromPool(a.class_sections ?? [], sectionPoolWide),
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
        group_id: a.group_id,
        room_ids: a.room_ids,
      })),
      groups: groups.map((g) => ({ id: g.id, abbreviation: g.abbreviation })),
      teacher_hours,
    });
    const teacherNameById = new Map(
      teacherRows.map((t) => [t.user_id, (t as { display_name?: string }).display_name ?? t.user_id.slice(0, 8)]),
    );
    for (const a of assignments) {
      if (!(byAssign.get(a.id)?.length)) {
        const secs = normalizeClassSectionNamesFromPool(a.class_sections ?? [], sectionPoolWide).join(
          ', ',
        );
        issues.push({
          code: 'ASSIGN_NO_TEACHER',
          severity: 'error',
          message: `${a.subject_name?.trim() || 'Ders ataması'}: öğretmen seçilmemiş${secs ? ` (${secs})` : ''}.`,
          entity_type: 'assignment',
          entity_id: a.id,
        });
      }
    }
    for (let i = issues.length - 1; i >= 0; i--) {
      const iss = issues[i]!;
      if (iss.code === 'TEACHER_OVER_MAX' || iss.code === 'TEACHER_UNDER_MIN') {
        const m = iss.message.match(/Öğretmen ([^:]+):/);
        if (m?.[1]) {
          const label = teacherNameById.get(m[1]) ?? m[1].slice(0, 8);
          issues[i] = { ...iss, message: iss.message.replace(m[1], label) };
        }
      }
    }
    if (assignments.length === 0) {
      issues.push({
        code: 'MIN_ASSIGNMENTS',
        severity: 'error',
        message: 'Henüz ders ataması yok. Öğretmen, ders ve şube eşlemesi ekleyin.',
      });
    }
    const subjectsCount = subjects.length;
    if (subjectsCount === 0 && assignments.length === 0) {
      issues.push({
        code: 'MIN_SUBJECTS',
        severity: 'error',
        message: 'Ders kataloğu veya atama ile şubelere saat tanımlayın.',
      });
    }
    const tIds = teacherRows.map((t) => t.user_id);
    if (studioRow) {
      const studioSettings = (studioRow.settings ?? {}) as Record<string, unknown>;
      const settings = studioSettings as {
        period?: { work_days?: number[] };
        work_days?: number[];
      };
      const workDays = settings.period?.work_days ?? settings.work_days;
      if (!workDays?.length) {
        issues.push({
          code: 'PERIOD_NO_DAYS',
          severity: 'error',
          message: 'Dönemde en az bir çalışma günü seçin.',
        });
      }
      const [ruleSet, dutyCount] = await Promise.all([
        this.ruleSetRepo.findOne({ where: { studio_id: studioId } }),
        studioRow.school_id && tIds.length
          ? this.dutySlotRepo
              .createQueryBuilder('s')
              .innerJoin('s.duty_plan', 'p')
              .where('p.school_id = :schoolId', { schoolId: studioRow.school_id })
              .andWhere('s.user_id IN (:...ids)', { ids: tIds })
              .andWhere('s.deleted_at IS NULL')
              .andWhere('p.deleted_at IS NULL')
              .andWhere('p.archived_at IS NULL')
              .andWhere('p.status = :published', { published: 'published' })
              .getCount()
          : Promise.resolve(0),
      ]);
      issues.push(
        ...validatePlanningRelationsForGenerate((ruleSet?.planning_relations ?? []) as PlanningRelationRow[]),
      );
      const profile = parseSchoolProfile(
        (studioRow.settings as Record<string, unknown> | undefined)?.school_profile,
      );
      for (const n of checkAihlWeeklyNorm(profile, assignments)) {
        issues.push({
          code: 'AIHL_NORM_EXCEEDED',
          severity: n.severity,
          message: `${n.subject_name}: ${n.assigned} saat (üst sınır ${n.max})`,
        });
      }
      if (dutyCount > 0) {
        issues.push({
          code: 'DUTY_SLOTS_ACTIVE',
          severity: 'warning',
          message: `${dutyCount} yayınlı nöbet slotu — bu saatlere ders konmaz; çakışma skoru düşer.`,
        });
      }

      const workDaysList = workDays ?? [];
      if (workDaysList.length && assignments.length > 0) {
        const [school, prefs] = await Promise.all([
          studioRow.school_id
            ? this.schoolRepo.findOne({
                where: { id: studioRow.school_id },
                select: ['duty_max_lessons'],
              })
            : Promise.resolve(null),
          this.preferenceRepo.find({ where: { studio_id: studioId } }),
        ]);
        let maxLesson = school?.duty_max_lessons ?? 8;
        if (profiles.length) {
          maxLesson = Math.max(maxLesson, ...profiles.map((p) => p.max_lessons_per_day));
        }
        const period = parseStudioPeriod(settings.period);
        const max_lesson_by_day = buildMaxLessonByDay(workDaysList, period, maxLesson);
        const unavailable: Array<{
          day_of_week: number;
          lesson_num?: number | null;
          user_id?: string | null;
        }> = [];
        if (this.availabilityService.shouldUseLegacyPreferences(studioRow)) {
          for (const p of prefs) {
            if (p.is_hard || p.status === 'unavailable') {
              unavailable.push({
                day_of_week: p.day_of_week,
                lesson_num: p.lesson_num ?? null,
                user_id: p.user_id,
              });
            }
          }
        }
        for (const t of teacherRows) {
          for (const block of (t.unavailable_periods ?? []) as Array<{
            day_of_week: number;
            lesson_num?: number;
          }>) {
            unavailable.push({
              day_of_week: block.day_of_week,
              lesson_num: block.lesson_num ?? null,
              user_id: t.user_id,
            });
          }
        }
        if (studioRow.school_id && tIds.length) {
          unavailable.push(...(await this.loadDutyUnavailableSlots(studioId, studioRow.school_id, tIds)));
        }
        const schoolProfile = parseSchoolProfile(studioSettings.school_profile);
        issues.push(
          ...computeFeasibilityWarnings({
            work_days: workDaysList,
            max_lesson_per_day: maxLesson,
            max_lesson_by_day,
            period,
            school_profile: schoolProfile,
            section_schedules: parseSectionSchedules(studioSettings.section_schedules),
            section_internship_from_profiles: internshipDaysBySectionFromProfiles(profiles),
            unavailable,
            teachers: teacherRows
              .filter((t) => (teacher_hours[t.user_id]?.assigned ?? 0) > 0)
              .map((t) => ({
                user_id: t.user_id,
                name: (t as { display_name?: string }).display_name ?? t.user_id.slice(0, 8),
                assigned_hours: teacher_hours[t.user_id]?.assigned ?? 0,
                max_per_day: t.max_lessons_per_day,
                max_work_days: t.max_work_days,
              })),
            assignments: assignments.map((a) => ({
              id: a.id,
              subject_name: a.subject_name,
              weekly_hours: a.weekly_hours,
              biweekly: a.biweekly,
              class_sections: normalizeClassSectionNamesFromPool(a.class_sections ?? [], sectionPoolWide),
              unavailable_periods: (a.unavailable_periods ?? []) as Array<{
                day_of_week: number;
                lesson_num?: number;
              }>,
            })),
          }),
        );
      }
    }
    return enrichValidationIssues(sortValidationIssues(issues));
  }

  // --- Class profiles (Faz 3) ---
  async listClassProfiles(studioId: string) {
    const rows = await this.classProfileRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    const pool = studio
      ? [
          ...(await this.collectStudioSectionNamesRaw(studioId, studio.school_id)),
          ...rows.flatMap((p) => p.class_sections ?? []),
        ]
      : rows.flatMap((p) => p.class_sections ?? []);
    return rows.map((p) => ({
      ...p,
      class_sections: normalizeClassSectionNamesFromPool(p.class_sections ?? [], pool),
    }));
  }

  async getClassProfilePresets(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_max_lessons'],
    });
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const schoolType = parseSchoolProfile(settings.school_profile).type;
    const dutyMax = school?.duty_max_lessons ?? null;
    return {
      school_type: schoolType,
      duty_max_lessons: dutyMax,
      default_max_lessons_per_day: defaultMaxLessonsPerDay(schoolType, dutyMax),
      presets: classProfilePresetsForSchool(schoolType, dutyMax),
    };
  }

  /** Günlük ders sayısı dönem ayarlarından; şube kaydında lessons_per_day_by_dow tutulmaz */
  private async applyProfileToSectionSchedules(studio: DersDagitStudio, sections: string[]) {
    if (!sections.length) return;
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const map = parseSectionSchedules(settings.section_schedules);
    for (const sec of sections) {
      const existing = map.get(sec) ?? { lessons_per_day_by_dow: {}, cells: {} };
      map.set(sec, { ...existing, lessons_per_day_by_dow: {} });
    }
    settings.section_schedules = sectionSchedulesToJson(map);
    studio.settings = settings;
    await this.studioRepo.save(studio);
  }

  private clearSectionLessonCountsForPeriod(studio: DersDagitStudio) {
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const map = parseSectionSchedules(settings.section_schedules);
    for (const [sec, sched] of map) {
      map.set(sec, { ...sched, lessons_per_day_by_dow: {} });
    }
    settings.section_schedules = sectionSchedulesToJson(map);
    studio.settings = settings;
  }

  async upsertClassProfile(studioId: string, schoolId: string, dto: Partial<DersDagitClassProfile>) {
    const name = typeof dto.name === 'string' ? dto.name.trim() : '';
    if (!name) throw new BadRequestException('Profil adı gerekli');
    const poolRaw = await this.getStudioSectionPoolCached(studioId, schoolId);
    const incoming = Array.isArray(dto.class_sections)
      ? dto.class_sections.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const sections = normalizeClassSectionNamesFromPool(incoming, poolRaw);
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
        const canon = normalizeClassSectionNamesFromPool([s], poolRaw)[0] ?? s;
        if (sections.some((x) => sectionsEquivalent(x, canon))) {
          sectionConflicts.push(`${canon} → ${p.name}`);
        }
      }
    }
    if (sectionConflicts.length) {
      throw new BadRequestException(
        `Şubeler başka profilde: ${sectionConflicts.slice(0, 5).join(', ')}${sectionConflicts.length > 5 ? '…' : ''}`,
      );
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const schoolType = parseSchoolProfile((studio.settings ?? {}).school_profile).type as MebSchoolType;
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['duty_max_lessons'] });
    const dutyMax = school?.duty_max_lessons ?? null;
    const maxDayDefault = defaultMaxLessonsPerDay(schoolType, dutyMax);
    let maxDay =
      dto.max_lessons_per_day != null && dto.max_lessons_per_day >= 1
        ? Math.min(dto.max_lessons_per_day, maxDayDefault)
        : maxDayDefault;
    const weeklyExpected = expectedWeeklyHoursForSections(sections, schoolType);
    const maxWeekly =
      dto.max_weekly_lessons != null && dto.max_weekly_lessons >= 1
        ? dto.max_weekly_lessons
        : weeklyExpected;
    const minWeekly =
      dto.min_weekly_lessons != null && dto.min_weekly_lessons >= 1
        ? Math.min(dto.min_weekly_lessons, maxWeekly)
        : Math.max(1, maxWeekly - 4);

    const payload = {
      ...dto,
      name,
      class_sections: sections,
      studio_id: studioId,
      max_lessons_per_day: maxDay,
      max_weekly_lessons: maxWeekly,
      min_weekly_lessons: minWeekly,
      internship_days: normalizeInternshipDays(dto.internship_days),
    };
    let saved: DersDagitClassProfile;
    if (dto.id) {
      const row = await this.classProfileRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      saved = await this.classProfileRepo.save({ ...row, ...payload });
    } else {
      saved = await this.classProfileRepo.save(payload as DersDagitClassProfile);
    }
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const excluded = parseExcludedClassSections(settings.excluded_class_sections);
    for (const ex of [...excluded]) {
      if (sections.some((s) => sectionsEquivalent(s, ex))) excluded.delete(ex);
    }
    settings.excluded_class_sections = excludedClassSectionsToJson(excluded);
    studio.settings = settings;
    await this.applyProfileToSectionSchedules(studio, sections);
    return saved;
  }

  async deleteClassProfile(id: string, studioId: string) {
    const res = await this.classProfileRepo.delete({ id, studio_id: studioId });
    if (!res.affected) throw new NotFoundException('Profil bulunamadı');
    return { ok: true as const };
  }

  // --- Teachers (Faz 4) ---
  /** Okul kadrosu + görevlendirme + ders veren yönetici */
  private schoolPersonnelQb(schoolId: string) {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.status != :deleted', { deleted: UserStatus.deleted })
      .andWhere('u.role IN (:...roles)', { roles: [UserRole.teacher, UserRole.school_admin] })
      .andWhere('(u.school_id = :schoolId OR u.teacher_assignment_school_id = :schoolId)', { schoolId });
  }

  private async ensureStudioSchool(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException('Stüdyo bulunamadı');
    return studio;
  }

  async syncTeachersFromSchool(studioId: string, schoolId: string) {
    await this.ensureStudioSchool(studioId, schoolId);
    const users = await this.schoolPersonnelQb(schoolId)
      .select(['u.id', 'u.display_name', 'u.email'])
      .getMany();
    let added = 0;
    for (const u of users) {
      const exists = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: u.id } });
      if (!exists) {
        await this.teacherConfigRepo.save({ studio_id: studioId, user_id: u.id, constraints: {} });
        added++;
      }
    }
    const list = await this.listTeacherConfigs(studioId);
    return { added, total: list.length, teachers: list };
  }

  async listTeacherCandidates(studioId: string, schoolId: string, q?: string) {
    await this.ensureStudioSchool(studioId, schoolId);
    const inStudio = await this.teacherConfigRepo.find({
      where: { studio_id: studioId },
      select: ['user_id'],
    });
    const exclude = new Set(inStudio.map((r) => r.user_id));
    let qb = this.schoolPersonnelQb(schoolId).select([
      'u.id',
      'u.display_name',
      'u.email',
      'u.role',
      'u.teacher_branch',
      'u.school_id',
      'u.teacher_assignment_school_id',
    ]);
    const term = q?.trim();
    if (term) {
      const like = `%${term.toLocaleLowerCase('tr')}%`;
      qb = qb.andWhere(
        '(LOWER(u.display_name) LIKE :like OR LOWER(u.email) LIKE :like OR LOWER(COALESCE(u.teacher_branch, \'\')) LIKE :like)',
        { like },
      );
    }
    const users = await qb.orderBy('u.display_name', 'ASC').addOrderBy('u.email', 'ASC').getMany();
    return users
      .filter((u) => !exclude.has(u.id))
      .map((u) => ({
        id: u.id,
        display_name: u.display_name?.trim() || u.email,
        email: u.email,
        teacher_branch: u.teacherBranch ?? null,
        source:
          u.teacherAssignmentSchoolId === schoolId && u.school_id !== schoolId
            ? 'assignment'
            : u.role === UserRole.school_admin
              ? 'admin'
              : 'school',
      }));
  }

  async addTeacherToStudio(studioId: string, schoolId: string, userId: string, actorUserId: string) {
    await this.ensureStudioSchool(studioId, schoolId);
    const uid = userId?.trim();
    if (!uid) throw new BadRequestException({ code: 'USER_REQUIRED', message: 'Öğretmen seçin.' });
    const user = await this.schoolPersonnelQb(schoolId).andWhere('u.id = :uid', { uid }).getOne();
    if (!user) {
      throw new BadRequestException({
        code: 'NOT_SCHOOL_PERSONNEL',
        message: 'Seçilen kişi bu okulun öğretmen/görevlendirme listesinde değil.',
      });
    }
    const exists = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: uid } });
    if (exists) return this.listTeacherConfigs(studioId);
    await this.teacherConfigRepo.save({
      studio_id: studioId,
      user_id: uid,
      branch: user.teacherBranch ?? null,
      constraints: {},
    });
    await this.audit(studioId, actorUserId, 'teachers.added', { user_id: uid });
    return this.listTeacherConfigs(studioId);
  }

  async addExternalTeacherToStudio(
    studioId: string,
    schoolId: string,
    body: { display_name: string; branch?: string | null },
    actorUserId: string,
  ) {
    await this.ensureStudioSchool(studioId, schoolId);
    const name = body.display_name?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException({ code: 'NAME_REQUIRED', message: 'Ad soyad en az 2 karakter olmalı.' });
    }
    const branch = body.branch?.trim() || null;
    const email = `dd.${randomBytes(12).toString('hex')}@dersdagit.local`;
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        display_name: name,
        role: UserRole.teacher,
        school_id: schoolId,
        status: UserStatus.active,
        firebaseUid: null,
        passwordHash: null,
        teacherBranch: branch,
        teacherSchoolMembership: TeacherSchoolMembershipStatus.approved,
        teacherPublicNameMasked: false,
      }),
    );
    await this.teacherConfigRepo.save({
      studio_id: studioId,
      user_id: user.id,
      branch,
      constraints: { program_only: true },
    });
    await this.audit(studioId, actorUserId, 'teachers.added_external', { user_id: user.id, display_name: name });
    return this.listTeacherConfigs(studioId);
  }

  async removeTeacherFromStudio(studioId: string, schoolId: string, configId: string, actorUserId: string) {
    await this.ensureStudioSchool(studioId, schoolId);
    const row = await this.teacherConfigRepo.findOne({ where: { id: configId, studio_id: studioId } });
    if (!row) throw new NotFoundException('Öğretmen kaydı bulunamadı');
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
    if (assignments.length) {
      const assignIds = assignments.map((a) => a.id);
      const linked = await this.assignmentTeacherRepo.findOne({
        where: { assignment_id: In(assignIds), user_id: row.user_id },
      });
      if (linked) {
        throw new BadRequestException({
          code: 'HAS_ASSIGNMENTS',
          message: 'Bu öğretmene bağlı ders ataması var; önce atamaları kaldırın.',
        });
      }
    }
    await this.teacherConfigRepo.delete({ id: configId, studio_id: studioId });
    await this.audit(studioId, actorUserId, 'teachers.removed', { user_id: row.user_id, config_id: configId });
    return { ok: true as const };
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

  async listElectiveCatalogSubjects(studioId: string) {
    const rows = await this.subjectRepo.find({
      where: { studio_id: studioId, is_elective: true },
      order: { name: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      short_code: r.short_code,
    }));
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
  private studioSchoolType(studio: DersDagitStudio): string {
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    return parseSchoolProfile(settings.school_profile).type;
  }

  async listGroups(studioId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    const schoolType = this.studioSchoolType(studio);
    const rows = await this.groupRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
    return {
      groups: rows,
      catalog: groupModeCatalogForSchool(schoolType),
      school_type: schoolType,
      default_mode: defaultGroupModeForSchool(schoolType),
      presets: groupPresetsForSchool(schoolType),
      school_hint: schoolTypeGroupHint(schoolType),
    };
  }

  async suggestGroups(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const schoolType = this.studioSchoolType(studio);
    const [sections, assignments, existing] = await Promise.all([
      this.collectStudioSections(studioId, schoolId),
      this.assignmentRepo.find({ where: { studio_id: studioId } }),
      this.groupRepo.find({ where: { studio_id: studioId } }),
    ]);
    const teacherLinks = assignments.length
      ? await this.assignmentTeacherRepo.find({
          where: { assignment_id: In(assignments.map((a) => a.id)) },
        })
      : [];
    const teachersByAssign = new Map<string, string[]>();
    for (const l of teacherLinks) {
      const arr = teachersByAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      teachersByAssign.set(l.assignment_id, arr);
    }
    const suggestions = suggestGroupsFromData({
      sections,
      school_type: schoolType,
      assignments: assignments.map((a) => ({
        subject_name: a.subject_name,
        class_sections: a.class_sections ?? [],
        teacher_ids: teachersByAssign.get(a.id) ?? [],
        options: (a.options ?? null) as Record<string, unknown> | null,
      })),
      existing: existing.map((g) => ({
        member_sections: g.member_sections ?? [],
        parallel_mode: g.parallel_mode,
      })),
    });
    return {
      catalog: groupModeCatalogForSchool(schoolType),
      school_type: schoolType,
      suggestions: suggestions.map((s) => ({
        ...s,
        already_exists: suggestionExists(s, existing),
      })),
    };
  }

  async applyGroupSuggestions(
    studioId: string,
    userId: string,
    body: { keys?: string[]; apply_all?: boolean; mode_overrides?: Record<string, DersDagitGroupMode> },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    const schoolId = studio.school_id;
    const schoolType = this.studioSchoolType(studio);
    const { suggestions: raw } = await this.suggestGroups(studioId, schoolId);
    const pick = body.apply_all
      ? raw.filter((s) => !s.already_exists)
      : raw.filter((s) => !s.already_exists && body.keys?.includes(s.key));
    let created = 0;
    for (const s of pick) {
      const mode =
        body.mode_overrides?.[s.key] ??
        normalizeGroupMode(s.parallel_mode, schoolType);
      await this.upsertGroup(studioId, {
        name: s.name,
        abbreviation: s.abbreviation.slice(0, 8),
        parallel_mode: mode,
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
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    const schoolType = studio ? this.studioSchoolType(studio) : 'anadolu_lise';
    const mode = normalizeGroupMode(dto.parallel_mode ?? undefined, schoolType);
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
    const electiveLinks = existing.length
      ? await this.assignmentTeacherRepo.find({
          where: { assignment_id: In(existing.map((a) => a.id)) },
        })
      : [];
    const teachersByAssign = new Map<string, string[]>();
    for (const l of electiveLinks) {
      const arr = teachersByAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      teachersByAssign.set(l.assignment_id, arr);
    }
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
          teacher_ids: prev ? (teachersByAssign.get(prev.id) ?? []) : ([] as string[]),
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
    await this.roomRepo.update({ school_id: schoolId, building_id: id }, { building_id: null });
    await this.buildingRepo.delete({ id, school_id: schoolId });
    return { deleted: true };
  }

  /** Yinelenen binaları tek kayıtta birleştirir; derslikler `keep_id` binasına taşınır. */
  async mergeBuildings(schoolId: string, keepId: string, mergeIds: string[]) {
    const keeper = await this.buildingRepo.findOne({ where: { id: keepId, school_id: schoolId } });
    if (!keeper) throw new NotFoundException();
    const toMerge = [...new Set(mergeIds.filter((id) => id && id !== keepId))];
    if (!toMerge.length) return { keep_id: keepId, merged: 0, rooms_moved: 0 };

    let roomsMoved = 0;
    for (const id of toMerge) {
      const dup = await this.buildingRepo.findOne({ where: { id, school_id: schoolId } });
      if (!dup) continue;
      const res = await this.roomRepo.update(
        { school_id: schoolId, building_id: id },
        { building_id: keepId },
      );
      roomsMoved += res.affected ?? 0;
      await this.buildingRepo.delete({ id, school_id: schoolId });
    }

    await this.remapBuildingTravelIds(schoolId, keepId, toMerge);
    return { keep_id: keepId, merged: toMerge.length, rooms_moved: roomsMoved };
  }

  private async remapBuildingTravelIds(schoolId: string, keepId: string, mergeIds: string[]) {
    const idMap = new Map(mergeIds.map((id) => [id, keepId]));
    const studios = await this.studioRepo.find({ where: { school_id: schoolId } });
    for (const st of studios) {
      const rs = await this.ruleSetRepo.findOne({ where: { studio_id: st.id } });
      if (!rs?.building_travel || !Array.isArray(rs.building_travel)) continue;
      let changed = false;
      const travel = (
        rs.building_travel as Array<{ from?: string; to?: string; minutes?: number }>
      ).map((row) => {
        const from = row.from && idMap.has(row.from) ? keepId : row.from;
        const to = row.to && idMap.has(row.to) ? keepId : row.to;
        if (from !== row.from || to !== row.to) changed = true;
        return { ...row, from, to };
      });
      if (changed) await this.ruleSetRepo.save({ ...rs, building_travel: travel });
    }
  }

  async deleteRoom(id: string, schoolId: string) {
    await this.roomRepo.delete({ id, school_id: schoolId });
  }

  async deleteAllRooms(schoolId: string): Promise<{ deleted: number }> {
    const rooms = await this.roomRepo.find({ where: { school_id: schoolId } });
    if (!rooms.length) return { deleted: 0 };
    const ids = new Set(rooms.map((r) => r.id));
    const studios = await this.studioRepo.find({ where: { school_id: schoolId } });
    for (const st of studios) {
      const assigns = await this.assignmentRepo.find({ where: { studio_id: st.id } });
      for (const a of assigns) {
        const prev = a.room_ids ?? [];
        const next = prev.filter((id) => !ids.has(id));
        if (next.length !== prev.length) {
          await this.assignmentRepo.save({ ...a, room_ids: next });
        }
      }
    }
    await this.roomRepo.delete({ school_id: schoolId });
    return { deleted: rooms.length };
  }

  /** Aynı şube için iki derslik (9-A + AMP-9/A) birleştir. */
  private async consolidateDuplicateClassRooms(schoolId: string): Promise<number> {
    const rooms = await this.roomRepo.find({
      where: { school_id: schoolId },
      order: { sort_order: 'ASC' },
    });
    const groups = new Map<string, DersDagitRoom[]>();
    for (const r of rooms) {
      const key = sectionKeyFromRoomFields(r.name, r.allowed_class_sections);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    const studios = await this.studioRepo.find({ where: { school_id: schoolId } });
    let removed = 0;

    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const canon = dedupeSectionAliases(
        list.flatMap((r) => {
          const from = sectionFromClassroomDisplayName(r.name);
          return [from ?? r.name, ...(r.allowed_class_sections ?? [])];
        }),
      )[0]!;
      const displayName = formatClassroomDisplayName(canon);
      const keeper =
        list.find((r) => r.name === displayName || roomCoversSection(r.name, r.allowed_class_sections, canon)) ??
        [...list].sort(
          (a, b) =>
            (isVerboseSectionName(b.name) ? 1 : 0) - (isVerboseSectionName(a.name) ? 1 : 0) ||
            b.name.length - a.name.length,
        )[0]!;
      const dupes = list.filter((r) => r.id !== keeper.id);

      if (keeper.name !== displayName || !(keeper.allowed_class_sections ?? []).includes(canon)) {
        await this.roomRepo.save({
          ...keeper,
          name: displayName,
          allowed_class_sections: [canon],
        });
        keeper.name = displayName;
        keeper.allowed_class_sections = [canon];
      }

      for (const d of dupes) {
        for (const st of studios) {
          const assigns = await this.assignmentRepo.find({ where: { studio_id: st.id } });
          for (const a of assigns) {
            const ids = a.room_ids ?? [];
            if (!ids.includes(d.id)) continue;
            const next = [...new Set(ids.map((id) => (id === d.id ? keeper.id : id)))];
            await this.assignmentRepo.save({ ...a, room_ids: next });
          }
        }
        await this.roomRepo.delete({ id: d.id, school_id: schoolId });
        removed++;
        const i = rooms.findIndex((r) => r.id === d.id);
        if (i >= 0) rooms.splice(i, 1);
      }
    }
    return removed;
  }

  /** Şube listesinden sınıf dersliği oluştur (mevcut eşleşenleri atlar). */
  async autoCreateRoomsFromClassSections(
    schoolId: string,
    studioId: string,
  ): Promise<{ created: number; skipped: number; consolidated: number; sections: string[] }> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();

    const consolidated = await this.consolidateDuplicateClassRooms(schoolId);
    const sections = await this.collectStudioSections(studioId, schoolId);
    if (!sections.length) return { created: 0, skipped: 0, consolidated, sections: [] };

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

    let created = 0;
    let skipped = 0;
    let sortOrder =
      existing.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0) + 1;

    for (const sec of sections) {
      const displayName = formatClassroomDisplayName(sec);
      const hit = existing.find((r) => roomCoversSection(r.name, r.allowed_class_sections, sec));
      if (hit) {
        if (hit.name !== displayName || !(hit.allowed_class_sections ?? []).includes(sec)) {
          await this.roomRepo.save({
            ...hit,
            name: displayName,
            allowed_class_sections: [sec],
          });
          hit.name = displayName;
          hit.allowed_class_sections = [sec];
        }
        skipped++;
        continue;
      }
      const row = await this.roomRepo.save(
        this.roomRepo.create({
          school_id: schoolId,
          building_id: building.id,
          name: displayName,
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

    return { created, skipped, consolidated, sections };
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
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['school_id'] });
    const pool = studio
      ? [
          ...(await this.getStudioSectionPoolCached(studioId, studio.school_id)),
          ...rows.flatMap((r) => r.class_sections ?? []),
        ]
      : rows.flatMap((r) => r.class_sections ?? []);
    return rows.map((r) => ({
      ...r,
      class_sections: normalizeClassSectionNamesFromPool(r.class_sections ?? [], pool),
      teacher_ids: map.get(r.id) ?? [],
    }));
  }

  async checkAssignmentCapacityForUpsert(
    studioId: string,
    dto: {
      id?: string;
      subject_name?: string | null;
      class_sections?: string[];
      weekly_hours?: number;
      biweekly?: boolean;
      teacher_ids?: string[];
    },
  ): Promise<AssignmentCapacityWarning[]> {
    const { profiles, teacherRows, assignments, sectionPoolWide, byAssign } =
      await this.getCapacityCheckInputsCached(studioId);
    const proposedSections = dto.class_sections?.length
      ? normalizeClassSectionNamesFromPool(dto.class_sections, sectionPoolWide)
      : (dto.class_sections ?? []);
    return checkAssignmentCapacity({
      class_profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        class_sections: normalizeClassSectionNamesFromPool(p.class_sections ?? [], sectionPoolWide),
        max_lessons_per_day: p.max_lessons_per_day,
        min_weekly_lessons: p.min_weekly_lessons,
        max_weekly_lessons: p.max_weekly_lessons,
      })),
      teachers: teacherRows.map((t) => ({
        id: t.user_id,
        name: (t as { display_name?: string }).display_name ?? t.user_id.slice(0, 8),
        mandatory_weekly_hours: t.mandatory_weekly_hours,
        max_extra_weekly_hours: t.max_extra_weekly_hours,
      })),
      existing_assignments: assignments.map((a) => ({
        id: a.id,
        subject_name: a.subject_name,
        class_sections: normalizeClassSectionNamesFromPool(a.class_sections ?? [], sectionPoolWide),
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
        teacher_ids: byAssign.get(a.id) ?? [],
      })),
      proposed: {
        exclude_assignment_id: dto.id ?? null,
        subject_name: dto.subject_name ?? null,
        class_sections: proposedSections,
        weekly_hours: dto.weekly_hours ?? 4,
        biweekly: !!dto.biweekly,
        teacher_ids: dto.teacher_ids ?? [],
      },
    });
  }

  async upsertAssignment(
    studioId: string,
    dto: Partial<DersDagitAssignment> & { teacher_ids?: string[] },
    importOpts?: { skip_capacity_check?: boolean },
  ) {
    const { teacher_ids, ...rest } = dto;
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (rest.class_sections?.length && studio) {
      const pool = await this.getStudioSectionPoolCached(studioId, studio.school_id);
      rest.class_sections = normalizeClassSectionNamesFromPool(rest.class_sections, pool);
    }
    if (rest.subject_id) {
      const sub = await this.subjectRepo.findOne({ where: { id: rest.subject_id, studio_id: studioId } });
      if (sub) rest.subject_name = sub.name;
    }
    if (studio && (!rest.room_ids || rest.room_ids.length === 0)) {
      const assignmentOptions = (rest.options ?? {}) as Record<string, unknown>;
      const mode = String(assignmentOptions.room_mode ?? 'class');
      if (mode !== 'shared') {
        const rooms = await this.roomRepo.find({ where: { school_id: studio.school_id } });
        const ids = this.resolveAssignmentRoomIds(
          {
            class_sections: rest.class_sections,
            subject_name: rest.subject_name,
          },
          mode,
          rooms,
          teacher_ids ?? [],
        );
        if (ids.length) rest.room_ids = ids;
      }
    }
    if (!importOpts?.skip_capacity_check) {
      const capacityWarnings = await this.checkAssignmentCapacityForUpsert(studioId, {
        id: rest.id,
        subject_name: rest.subject_name,
        class_sections: rest.class_sections,
        weekly_hours: rest.weekly_hours,
        biweekly: rest.biweekly,
        teacher_ids,
      });
      const capacityErrors = capacityWarnings.filter((w) => w.severity === 'error');
      if (capacityErrors.length) {
        throw new BadRequestException({
          code: 'ASSIGNMENT_CAPACITY',
          message: capacityErrors.map((w) => w.message).join(' '),
          details: capacityWarnings,
        });
      }
    }
    let row: DersDagitAssignment;
    if (rest.id) {
      const prev = await this.assignmentRepo.findOne({ where: { id: rest.id, studio_id: studioId } });
      if (!prev) throw new NotFoundException();
      if (rest.options && typeof rest.options === 'object') {
        rest.options = { ...(prev.options ?? {}), ...rest.options };
      }
      row = await this.assignmentRepo.save({ ...prev, ...rest });
    } else {
      row = await this.assignmentRepo.save({ ...rest, studio_id: studioId } as DersDagitAssignment);
    }
    this.invalidateValidationResultCache(studioId, { sectionPool: false });
    if (teacher_ids !== undefined) {
      await this.assignmentTeacherRepo.delete({ assignment_id: row.id });
      if (teacher_ids.length) {
        await this.assignmentTeacherRepo.insert(
          teacher_ids.map((user_id) => ({ assignment_id: row.id, user_id })),
        );
      }
    }
    if (row.subject_id && (row.class_sections?.length ?? 0) > 0) {
      await this.mirrorAssignmentHoursToCatalog(studioId, row);
    }
    return row;
  }

  private resolveAssignmentRoomIds(
    a: { class_sections?: string[]; subject_name?: string },
    mode: string,
    rooms: DersDagitRoom[],
    teacherIds: string[],
  ): string[] {
    const section = a.class_sections?.[0]?.trim() ?? '';
    const subjectName = a.subject_name?.trim() ?? '';
    if (mode === 'class' && section) {
      const hit = rooms.find((r) => roomCoversSection(r.name, r.allowed_class_sections, section));
      return hit ? [hit.id] : [];
    }
    if (mode === 'teacher' && teacherIds.length) {
      const hit = rooms.find((r) => teacherIds.some((tid) => r.allowed_teacher_ids?.includes(tid)));
      return hit ? [hit.id] : [];
    }
    if (mode === 'subject' && subjectName) {
      const sn = subjectName.toLocaleLowerCase('tr');
      const hit = rooms.find((r) =>
        r.allowed_subjects?.some((s) => {
          const x = s.toLocaleLowerCase('tr');
          return x.includes(sn) || sn.includes(x);
        }),
      );
      return hit ? [hit.id] : [];
    }
    return [];
  }

  /** Atama haftalık saatini ders kataloğundaki şube satırına yansıt. */
  private async mirrorAssignmentHoursToCatalog(studioId: string, row: DersDagitAssignment) {
    const sub = await this.subjectRepo.findOne({ where: { id: row.subject_id!, studio_id: studioId } });
    if (!sub) return;
    const h = row.weekly_hours;
    const ch = mergeClassHoursBySectionAlias(sub.class_hours ?? {});
    for (const sec of row.class_sections ?? []) {
      const t = sec?.trim();
      if (t) ch[t] = h;
    }
    await this.subjectRepo.save({ ...sub, class_hours: ch });
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

  /** Yayınlanmamış üretim taslaklarını temizle (favori ve arşiv hariç). */
  private async purgeUnsavedGeneratedPrograms(studioId: string) {
    const rows = await this.programRepo.find({
      where: { studio_id: studioId, status: 'generated', archived_at: IsNull() },
    });
    for (const p of rows) {
      if (p.is_favorite) continue;
      await this.programEntryRepo.delete({ program_id: p.id });
      await this.programRepo.delete({ id: p.id });
    }
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
    const subjectId = row.subject_id;
    const classSections = [...(row.class_sections ?? [])];
    await this.assignmentTeacherRepo.delete({ assignment_id: id });
    await this.assignmentRepo.delete({ id });
    if (subjectId && classSections.length) {
      await this.refreshSubjectCatalogHoursFromAssignments(studioId, subjectId, classSections);
    }
    this.invalidateValidationResultCache(studioId, { sectionPool: false });
  }

  /** Katalog şube saatlerini kalan atamalara göre güncelle (mirror ile uyumlu) */
  private async refreshSubjectCatalogHoursFromAssignments(
    studioId: string,
    subjectId: string,
    affectedSections: string[],
  ) {
    const sub = await this.subjectRepo.findOne({ where: { id: subjectId, studio_id: studioId } });
    if (!sub) return;
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['school_id'] });
    const pool = studio
      ? await this.getStudioSectionPoolCached(studioId, studio.school_id)
      : [];
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId, subject_id: subjectId } });
    const ch = mergeClassHoursBySectionAlias({ ...(sub.class_hours ?? {}) } as Record<string, number>);
    for (const secRaw of affectedSections) {
      const canon = normalizeClassSectionNamesFromPool([secRaw], pool)[0] ?? secRaw.trim();
      if (!canon) continue;
      let weekly: number | null = null;
      for (const a of assignments) {
        const secs = normalizeClassSectionNamesFromPool(a.class_sections ?? [], pool);
        if (secs.some((s) => sectionsEquivalent(s, canon))) weekly = a.weekly_hours;
      }
      if (weekly == null) {
        for (const key of Object.keys(ch)) {
          if (sectionsEquivalent(key, canon)) delete ch[key];
        }
      } else {
        ch[canon] = weekly;
      }
    }
    await this.subjectRepo.save({ ...sub, class_hours: ch });
  }

  async deleteAllAssignments(studioId: string, actorUserId: string) {
    const rows = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
    for (const r of rows) await this.deleteAssignment(r.id, studioId);
    await this.audit(studioId, actorUserId, 'assignments.purged', { deleted: rows.length });
    return { deleted: rows.length };
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
    const normalized = normalizePlanningRelations(relations);
    rs.planning_relations = normalized;
    await this.ruleSetRepo.save(rs);
    await this.syncPlanningRelationsToRules(studioId, normalized, rs.rules);
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
      let key = def.catalog_key;
      const maxN = Number(row.params?.max);
      if (key === 'max_two_per_day' && maxN === 1) key = 'max_one_per_day';
      const params: Record<string, unknown> = { ...(row.params ?? {}) };
      if (row.subject_ids.length) params.planning_subject_ids = row.subject_ids;
      const state = {
        active: true,
        weight: importanceWeight(row.importance),
        params: Object.keys(params).length ? params : undefined,
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
    if (!this.availabilityService.shouldUseLegacyPreferences(studio)) {
      throw new BadRequestException({
        code: 'USE_SUBMISSION_FLOW',
        message: 'Onaylı müsaitlik akışı aktif. Tercihler sayfasından gönderin.',
      });
    }
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
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    studio.preference_window_open = open;
    if (open) studio.workflow_status = 'collecting_prefs';
    else if (studio.workflow_status === 'collecting_prefs') studio.workflow_status = 'ready';
    studio.settings = mergeTeacherAvailabilityPolicy(studio.settings ?? {}, { collection_enabled: open });
    await this.studioRepo.save(studio);
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

  private async expandSolverAssignments(studioId: string): Promise<SolverAssignment[]> {
    const assignments = await this.listAssignments(studioId);
    const subjectById = subjectCatalogMap(await this.listSubjects(studioId));
    return expandAssignmentsForSolver(
      assignments.map((a) => ({
        id: a.id,
        class_sections: a.class_sections,
        subject_id: a.subject_id ?? null,
        subject_name: resolveAssignmentSubjectLabel(a, subjectById),
        weekly_hours: a.weekly_hours,
        teacher_ids: (a as { teacher_ids?: string[] }).teacher_ids ?? [],
        group_id: a.group_id,
        room_ids: a.room_ids ?? [],
        max_per_day: a.max_per_day,
        min_days_per_week: a.min_days_per_week,
        fixed_slots: (a.fixed_slots ?? []) as Array<{
          day_of_week: number;
          lesson_num: number;
          class_section?: string;
        }>,
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
  }

  private async computeLiveProgramScoreBreakdown(
    studioId: string,
    schoolId: string,
    entries: Array<{
      assignment_id?: string | null;
      day_of_week: number;
      lesson_num: number;
      class_section: string;
      subject: string;
      user_id?: string | null;
      room_id?: string | null;
    }>,
  ): Promise<ProgramScoreBreakdown> {
    const [solverCtx, solverInput] = await Promise.all([
      this.buildSolverContext(studioId, schoolId),
      this.expandSolverAssignments(studioId),
    ]);
    const slots: SolverSlot[] = [];
    for (const e of entries) {
      if (!e.assignment_id) continue;
      slots.push({
        day_of_week: Number(e.day_of_week),
        lesson_num: Number(e.lesson_num),
        class_section: e.class_section,
        subject: e.subject,
        user_id: e.user_id ?? null,
        assignment_id: e.assignment_id,
        room_id: e.room_id ?? null,
        group_id: null,
      });
    }
    return buildProgramScoreBreakdown(slots, solverInput, solverCtx, []);
  }

  async comparePrograms(studioId: string, ids: string[]) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    const programs = await this.programRepo.find({
      where: { studio_id: studioId, id: In(ids.slice(0, 5)) },
    });
    const summaries = await Promise.all(
      programs.map(async (p) => {
        const raw = await this.programEntryRepo.find({ where: { program_id: p.id } });
        const entries = await this.enrichProgramEntries(raw);
        const byClass = new Map<string, number>();
        for (const e of entries) {
          byClass.set(e.class_section, (byClass.get(e.class_section) ?? 0) + 1);
        }
        const score_breakdown = await this.computeLiveProgramScoreBreakdown(
          studioId,
          studio.school_id,
          entries,
        );
        const placement = await this.computeProgramPlacementSummary(studioId, p.id);
        return {
          id: p.id,
          name: p.name,
          score: score_breakdown.score,
          status: p.status,
          is_favorite: p.is_favorite,
          entry_count: entries.length,
          class_sections: Object.fromEntries(byClass),
          score_breakdown,
          placement_percent: placement.placement_percent,
          unplaced_hours: placement.unplaced_hours,
          is_fully_placed: placement.is_fully_placed,
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
    if (settings.demo_relax_strict_rules !== true) {
      augmentStrictKeysWithActiveRules(strictKeys, studio_rules, section_rules);
    }
    const period = parseStudioPeriod(settings.period);
    const dual = parseDualEducation(settings.dual_education);
    let maxLesson = school?.duty_max_lessons ?? 8;
    if (profiles.length) {
      maxLesson = Math.max(...profiles.map((p) => p.max_lessons_per_day));
    }
    const unavailable: SolverContext['unavailable'] = [];
    if (studio && this.availabilityService.shouldUseLegacyPreferences(studio)) {
      for (const p of prefs) {
        if (p.is_hard || p.status === 'unavailable') {
          unavailable.push({
            day_of_week: p.day_of_week,
            lesson_num: p.lesson_num,
            user_id: p.user_id,
          });
        }
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
      planning_relations: planningRelations,
      distribution_policy: parseDistributionPolicy(settings.distribution_policy),
    };
  }

  async getDistributionPolicy(studioId: string, schoolId: string): Promise<DistributionPolicy> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    return parseDistributionPolicy(settings.distribution_policy);
  }

  async updateDistributionPolicy(
    studioId: string,
    schoolId: string,
    body: Partial<DistributionPolicy>,
  ): Promise<DistributionPolicy> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const prev = parseDistributionPolicy(settings.distribution_policy);
    settings.distribution_policy = parseDistributionPolicy({ ...prev, ...body });
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return parseDistributionPolicy(settings.distribution_policy);
  }

  async getPlacementSearchPolicy(studioId: string, schoolId: string): Promise<PlacementSearchPolicy> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    return parsePlacementSearchPolicy(settings.placement_search);
  }

  async updatePlacementSearchPolicy(
    studioId: string,
    schoolId: string,
    body: Partial<PlacementSearchPolicy>,
  ): Promise<PlacementSearchPolicy> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const prev = parsePlacementSearchPolicy(settings.placement_search);
    settings.placement_search = parsePlacementSearchPolicy({ ...prev, ...body });
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return parsePlacementSearchPolicy(settings.placement_search);
  }

  /** Atanan saat kadar açık slot yoksa kapalı hücreleri otomatik açar. */
  async syncSectionScheduleOpenSlots(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_max_lessons'],
    });
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const period = parseStudioPeriod(settings.period);
    const workDays = period.work_days?.length ? period.work_days : [1, 2, 3, 4, 5];
    const profiles = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    let maxLesson = school?.duty_max_lessons ?? 8;
    if (profiles.length) {
      maxLesson = Math.max(maxLesson, ...profiles.map((p) => p.max_lessons_per_day));
    }
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const r = syncSectionSchedulesOpenSlots({
      section_schedules: parseSectionSchedules(settings.section_schedules),
      assignments: assignments.map((a) => ({
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
        class_sections: a.class_sections ?? [],
      })),
      work_days: workDays,
      max_lesson_per_day: maxLesson,
      period,
      school_profile: parseSchoolProfile(settings.school_profile),
      class_profiles: profiles,
    });
    if (r.opened_cells > 0 || r.pruned_cells > 0) {
      settings.section_schedules = sectionSchedulesToJson(r.map);
      studio.settings = settings;
      await this.studioRepo.save(studio);
    }
    return {
      opened_cells: r.opened_cells,
      pruned_cells: r.pruned_cells,
      sections_adjusted: r.sections_adjusted,
    };
  }

  async getSectionSchedules(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const raw = await this.collectStudioActiveSectionNamesRaw(studioId, schoolId);
    const aliasMap = buildSectionAliasMap(raw);
    const sections = dedupeSectionAliases(raw);
    const map = parseSectionSchedules(settings.section_schedules);
    const schedules: Record<string, SectionScheduleConfig> = {};
    const empty: SectionScheduleConfig = { lessons_per_day_by_dow: {}, cells: {} };
    for (const sec of sections) {
      let sched = map.get(sec);
      if (!sched) {
        for (const [alias, canon] of aliasMap) {
          if (canon === sec && map.has(alias)) {
            sched = map.get(alias);
            break;
          }
        }
      }
      schedules[sec] = sched ?? empty;
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
    const period = parseStudioPeriod(settings.period);
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: ['duty_max_lessons'],
    });
    const schoolDefault = school?.duty_max_lessons ?? 8;
    const workDays = period.work_days?.length ? period.work_days : [1, 2, 3, 4, 5];
    const byDow = { ...(schedule.lessons_per_day_by_dow ?? {}) };
    for (const d of workDays) {
      const key = String(d);
      const periodVal = maxLessonsForDay(period, d, schoolDefault);
      if (byDow[key] === periodVal) delete byDow[key];
    }
    for (const key of Object.keys(byDow)) {
      if (!workDays.includes(Number(key))) delete byDow[key];
    }
    map.set(sec, {
      ...(Object.keys(byDow).length ? { lessons_per_day_by_dow: byDow } : {}),
      cells: schedule.cells ?? {},
      ...(internship_days.length ? { internship_days } : {}),
    });
    settings.section_schedules = sectionSchedulesToJson(map);
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return this.getSectionSchedules(studioId, schoolId);
  }

  async removeStudioClassSection(studioId: string, schoolId: string, section: string, actorUserId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const sec = section.trim();
    if (!sec) throw new BadRequestException({ code: 'SECTION_REQUIRED', message: 'Şube adı gerekli.' });

    const assignments = await this.assignmentRepo.find({
      where: { studio_id: studioId },
      select: ['id', 'class_sections'],
    });
    for (const a of assignments) {
      if ((a.class_sections ?? []).some((s) => sectionsEquivalent(s, sec))) {
        throw new BadRequestException({
          code: 'SECTION_HAS_ASSIGNMENTS',
          message: 'Bu şubeye ders ataması var; önce atamalardan kaldırın.',
        });
      }
    }

    const profiles = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    for (const p of profiles) {
      const prev = p.class_sections ?? [];
      const next = prev.filter((s) => !sectionsEquivalent(s, sec));
      if (next.length !== prev.length) {
        p.class_sections = next;
        await this.classProfileRepo.save(p);
      }
    }

    const subjects = await this.subjectRepo.find({ where: { studio_id: studioId } });
    for (const sub of subjects) {
      const ch = { ...(sub.class_hours ?? {}) };
      let changed = false;
      for (const key of Object.keys(ch)) {
        if (sectionsEquivalent(key, sec)) {
          delete ch[key];
          changed = true;
        }
      }
      if (changed) {
        sub.class_hours = ch;
        await this.subjectRepo.save(sub);
      }
    }

    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const map = parseSectionSchedules(settings.section_schedules);
    for (const key of [...map.keys()]) {
      if (sectionsEquivalent(key, sec)) map.delete(key);
    }
    settings.section_schedules = sectionSchedulesToJson(map);
    const excluded = parseExcludedClassSections(settings.excluded_class_sections);
    const canon = dedupeSectionAliases([sec])[0] ?? sec;
    excluded.add(canon);
    settings.excluded_class_sections = excludedClassSectionsToJson(excluded);
    studio.settings = settings;
    await this.studioRepo.save(studio);
    await this.audit(studioId, actorUserId, 'class_section.removed', { section: sec });
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

  async getReportSettings(studioId: string, schoolId: string): Promise<StudioReportSettings> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const [school] = await Promise.all([
      this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] }),
    ]);
    const parsed = parseStudioReportSettings((studio.settings ?? {}) as Record<string, unknown>);
    return {
      meta: {
        ...parsed.meta,
        school_name: parsed.meta.school_name ?? school?.name ?? undefined,
        academic_year: parsed.meta.academic_year ?? studio.academic_year ?? undefined,
      },
      texts: parsed.texts,
    };
  }

  async updateReportSettings(
    studioId: string,
    schoolId: string,
    body: { meta?: Record<string, unknown>; texts?: Record<string, unknown> },
  ): Promise<StudioReportSettings> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
    const prev = parseStudioReportSettings(settings);
    const next = mergeReportSettings(prev, {
      meta: body.meta as never,
      texts: body.texts as never,
    });
    const json = reportSettingsToJson(next);
    settings.report_meta = json.report_meta;
    settings.report_texts = json.report_texts;
    studio.settings = settings;
    await this.studioRepo.save(studio);
    return this.getReportSettings(studioId, schoolId);
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
    const teacherConfigs = await this.listTeacherConfigs(studioId);
    const configByUser = new Map(teacherConfigs.map((c) => [c.user_id, c]));
    const counts = teacherHours.map((t) => t.lesson_count);
    const minLessons = counts.length ? Math.min(...counts) : 0;
    const maxLessons = counts.length ? Math.max(...counts) : 0;
    const spread = maxLessons - minLessons;
    let fairness_index = 100;
    let distribution_label = 'Dağılım dengeli';
    if (spread > 6) {
      fairness_index = 28;
      distribution_label = 'Dağılım dengesiz';
    } else if (spread > 4) {
      fairness_index = 48;
      distribution_label = 'Dağılım dengesiz';
    } else if (spread > 2) {
      fairness_index = 68;
      distribution_label = 'Dağılım kısmen dengeli';
    } else if (spread > 0) {
      fairness_index = 88;
      distribution_label = 'Dağılım kısmen dengeli';
    }

    const teacher_stats = teacherHours.map((t) => {
      const cfg = configByUser.get(t.teacher_id);
      const deviation = Math.round((t.lesson_count - avg) * 10) / 10;
      let load_status: 'low' | 'balanced' | 'high' = 'balanced';
      if (deviation <= -2) load_status = 'low';
      else if (deviation >= 2) load_status = 'high';
      return {
        ...t,
        label: cfg?.display_name ?? t.teacher_id.slice(0, 8),
        branch: cfg?.branch ?? null,
        mandatory_weekly_hours: cfg?.mandatory_weekly_hours ?? null,
        deviation_from_avg: deviation,
        load_status,
        gap_heavy: t.gap_count >= 3,
      };
    });

    return {
      ready: true,
      program_id: program.id,
      program_name: program.name,
      program_status: program.status,
      teacher_stats,
      teacher_count: teacher_stats.length,
      avg_lessons_per_teacher: Math.round(avg * 10) / 10,
      min_lessons_per_teacher: minLessons,
      max_lessons_per_teacher: maxLessons,
      lesson_spread: spread,
      fairness_index,
      distribution_label,
      total_gaps: teacher_stats.reduce((s, t) => s + t.gap_count, 0),
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
    opts: {
      duration_sec?: number;
      versions?: number;
      use_csp?: boolean;
      priority?: 'coverage' | 'balanced' | 'fast';
      /** Bu üretimde desen zorunluluğu ve stüdyo kurallarını gevşetir. */
      relax_constraints?: boolean;
    },
  ) {
    // Okul hedefine göre çözücü ayarları (UI'daki teknik seçenekleri soyutlar).
    const priority = opts.priority ?? 'balanced';
    if (priority === 'coverage') {
      // Tüm dersleri yerleştirmeye öncelik: gelişmiş çözücü + uzun süre; taslak sayısı UI'dan gelir.
      opts = {
        ...opts,
        use_csp: opts.use_csp ?? true,
        duration_sec: Math.max(opts.duration_sec ?? 0, 180),
        versions: opts.versions != null ? Math.min(3, Math.max(1, opts.versions)) : 3,
      };
    } else if (priority === 'fast') {
      opts = {
        ...opts,
        use_csp: false,
        duration_sec: Math.min(opts.duration_sec ?? 60, 60),
        versions: opts.versions != null ? Math.min(3, Math.max(1, opts.versions)) : 1,
      };
    }
    await this.syncSectionScheduleOpenSlots(studioId, schoolId);
    const validationIssues = await this.runValidation(studioId);
    const errors = filterGenerateBlockingValidationIssues(validationIssues);
    const ruleSet = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    const planningIssues = validatePlanningRelationsForGenerate(
      (ruleSet?.planning_relations ?? []) as PlanningRelationRow[],
    );
    if (errors.length || planningIssues.length) {
      const allIssues = [...errors, ...planningIssues];
      const summary = allIssues
        .slice(0, 4)
        .map((i) => i.message)
        .filter(Boolean)
        .join(' · ');
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: summary || 'Doğrulama hatası — program üretilemedi.',
        details: { issues: allIssues },
      });
    }
    const job = await this.jobRepo.save({
      studio_id: studioId,
      status: 'running',
      duration_sec: opts.duration_sec ?? 120,
      versions_requested: Math.min(3, opts.versions ?? 1),
      started_at: new Date(),
    });
    await this.purgeUnsavedGeneratedPrograms(studioId);
    const studioRow = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    const genSettings = (studioRow?.settings ?? {}) as Record<string, unknown>;
    const placementSearch = parsePlacementSearchPolicy(genSettings.placement_search);
    const searchBudget = generationBudgetFor(placementSearch.search_complexity);
    const relaxGenerate = opts.relax_constraints === true;
    const demoRelax = genSettings.demo_relax_strict_rules === true || relaxGenerate;
    let solverCtx = await this.buildSolverContext(studioId, schoolId);
    if (relaxGenerate) {
      solverCtx = applyGenerateRelaxToContext(solverCtx);
    }
    const assignments = await this.listAssignments(studioId);
    solverCtx.assignment_subjects = new Map(
      assignments.map((a) => [a.id, a.subject_id ?? null]),
    );
    const subjectById = subjectCatalogMap(await this.listSubjects(studioId));
    const assignmentById = new Map(assignments.map((a) => [a.id, a]));
    const solverInput = expandAssignmentsForSolver(
      assignments.map((a) => ({
        id: a.id,
        class_sections: a.class_sections,
        subject_id: a.subject_id ?? null,
        subject_name: resolveAssignmentSubjectLabel(a, subjectById),
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
    const versionCount = Math.min(3, Math.max(1, Math.floor(opts.versions ?? 1)));
    const baseDays = solverCtx.work_days;
    const targetSlots = solverInput.reduce(
      (s, a) => s + (a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours),
      0,
    );
    const enforcePattern = shouldEnforceDistributionPattern(solverCtx.distribution_policy);
    const durationSec = Math.max(
      enforcePattern ? 180 : 60,
      opts.duration_sec ?? 120,
      searchBudget.minDurationSec,
    );
    const totalBudgetMs = Math.max(30_000, durationSec * 1000);
    const genEndsAt = Date.now() + totalBudgetMs;
    const msLeft = () => Math.max(0, genEndsAt - Date.now());
    const patternRetryMax = enforcePattern ? searchBudget.patternRetryMax : 0;
    const searchCapEstimate = estimateGenerationSearchCap(
      placementSearch.search_complexity,
      targetSlots,
      durationSec,
    );
    const dutyRetryMax = 2;
    let passesLeft =
      1 + patternRetryMax + dutyRetryMax + Math.max(0, versionCount - 1);
    const allocSolveBudget = (): number => {
      const left = msLeft();
      if (left < 8_000 || passesLeft < 1) return 0;
      return Math.max(8_000, Math.floor(left / passesLeft));
    };
    const solvePriority =
      enforcePattern && priority === 'balanced' ? 'coverage' : priority;
    const cspMaxNodes = Math.min(
      searchBudget.cspMaxNodesCap,
      Math.max(
        30_000,
        Math.round(targetSlots * searchBudget.cspPerSlot * (enforcePattern ? 1.25 : 1)),
      ),
    );
    const solveOnce = (ctx: SolverContext, budgetMs: number) => {
      const useCsp =
        opts.use_csp === true ||
        (opts.use_csp !== false && shouldEnforceDistributionPattern(ctx.distribution_policy));
      const seedRaw = useCsp
        ? runCspSolver(solverInput, ctx, cspMaxNodes)
        : runConstraintSolver(solverInput, ctx);
      const seedEntries = stripInvalidPatternPlacements(seedRaw.entries, solverInput, ctx);
      const seed = { ...seedRaw, entries: seedEntries };
      return runAscLikeSearch(solverInput, ctx, {
        deadline_ms: budgetMs,
        priority: solvePriority,
        seed,
        search_complexity: placementSearch.search_complexity,
      });
    };
    type SolveRun = ReturnType<typeof runAscLikeSearch>;
    const solveTimed = (ctx: SolverContext): SolveRun | null => {
      const budgetMs = allocSolveBudget();
      passesLeft = Math.max(0, passesLeft - 1);
      if (!budgetMs) return null;
      return solveOnce(ctx, budgetMs);
    };
    const firstRun = solveTimed(solverCtx);
    if (!firstRun) {
      await this.jobRepo.update(job.id, { status: 'failed', finished_at: new Date() });
      throw new BadRequestException({
        code: 'GENERATION_TIMEOUT',
        message: 'Üretim süresi yetersiz — süreyi artırın veya önceliği Hızlı seçin.',
      });
    }
    let bestRun: SolveRun = firstRun;
    let bestResult = bestRun.result;
    if (enforcePattern) {
      const orders: Array<NonNullable<SolverContext['assignment_order']>> = [
        'hardest_first',
        'most_hours',
        'fewest_slots',
        'default',
      ];
      for (let att = 0; att < patternRetryMax && bestResult.failed > 0 && msLeft() >= 8_000; att++) {
        const run = solveTimed({
          ...solverCtx,
          day_order: [...baseDays].sort(() => Math.random() - 0.5),
          assignment_order: orders[att % orders.length],
        });
        if (!run) break;
        if (run.result.failed < bestResult.failed || run.result.score > bestResult.score) {
          bestRun = run;
          bestResult = run.result;
        }
      }
    }
    const dutySlots = solverCtx.unavailable
      .filter((u): u is { day_of_week: number; lesson_num: number | null; user_id: string } => !!u.user_id)
      .map((u) => ({
        day_of_week: u.day_of_week,
        lesson_num: u.lesson_num,
        user_id: u.user_id!,
      }));
    let dutyConflicts = findDutyPlacementConflicts(bestResult.entries, dutySlots);
    for (let retry = 0; retry < dutyRetryMax && dutyConflicts.length && msLeft() >= 8_000; retry++) {
      const run = solveTimed({
        ...solverCtx,
        day_order: [...baseDays].sort(() => Math.random() - 0.5),
      });
      if (!run) break;
      bestRun = run;
      bestResult = run.result;
      dutyConflicts = findDutyPlacementConflicts(bestResult.entries, dutySlots);
    }
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
    if (strictViolations.length && !demoRelax && bestResult.entries.length === 0) {
      await this.jobRepo.update(job.id, { status: 'failed', finished_at: new Date() });
      throw new BadRequestException({
        code: 'STRICT_RULES_VIOLATED',
        message: 'Zorunlu kurallar nedeniyle hiç ders yerleştirilemedi.',
        details: { violations: strictViolations.slice(0, 20) },
      });
    }
    const versionStrategies: Array<NonNullable<SolverContext['assignment_order']>> = [
      'hardest_first',
      'most_hours',
      'fewest_slots',
    ];
    for (let v = 0; v < versionCount; v++) {
      let run: SolveRun = bestRun;
      if (versionCount > 1) {
        const extra = solveTimed({
          ...solverCtx,
          day_order: [...baseDays].sort(() => Math.random() - 0.5),
          assignment_order: versionStrategies[v % versionStrategies.length],
        });
        if (extra) run = extra;
      }
      const result = run.result;
      const versionCheck = applySoftRulePenalties(result.entries, solverInput, solverCtx);
      if (versionCheck.strict_violations.length && !demoRelax && result.entries.length === 0) continue;
      if (result.score > bestResult.score || result.failed < bestResult.failed) bestResult = result;
      if (result.score > bestRun.result.score || result.failed < bestRun.result.failed) bestRun = run;
      const score = Math.round(result.score);
      const labeledEntries = result.entries.map((e) => {
        const a = assignmentById.get(e.assignment_id);
        const subject = a ? formatProgramEntrySubject(a, subjectById) : e.subject;
        return { ...e, subject };
      });
      const dutyConflictsV = findDutyPlacementConflicts(
        labeledEntries,
        solverCtx.unavailable
          .filter((u): u is { day_of_week: number; lesson_num: number | null; user_id: string } => !!u.user_id)
          .map((u) => ({
            day_of_week: u.day_of_week,
            lesson_num: u.lesson_num,
            user_id: u.user_id!,
          })),
      );
      if (dutyConflictsV.length) continue;
      if (this.placementHasClashes(labeledEntries, solverCtx.group_modes)) continue;
      const versionBreakdown = buildProgramScoreBreakdown(
        labeledEntries,
        solverInput,
        solverCtx,
        result.violations,
      );
      const classSections = labeledEntries.map((e) => e.class_section);
      let prog: DersDagitProgram | null = null;
      try {
        prog = await this.programRepo.save({
          studio_id: studioId,
          name: buildGeneratedProgramName({ score, version: v + 1, classSections }),
          status: 'generated',
          version: v + 1,
          score,
          generation_meta: {
            job_id: job.id,
            placed: result.placed,
            failed: result.failed,
            violations: result.violations.slice(0, 30),
            score_breakdown: versionBreakdown,
            search_meta: run.meta,
          },
        });
        if (!labeledEntries.length) {
          await this.programEntryRepo.delete({ program_id: prog.id });
          await this.programRepo.delete({ id: prog.id });
          continue;
        }
        const rows = labeledEntries.map((e) => {
          const assign = assignmentById.get(e.assignment_id);
          return {
          program_id: prog!.id,
          assignment_id: e.assignment_id,
          user_id: e.user_id ?? assign?.teacher_ids?.[0] ?? null,
          day_of_week: e.day_of_week,
          lesson_num: e.lesson_num,
          ...clipProgramEntryFields({
            class_section: e.class_section ?? '',
            subject: e.subject ?? '',
          }),
          room_id: e.room_id,
          group_id: e.group_id,
          is_locked: false,
        };
        });
        await this.programEntryRepo.save(rows);
        programs.push(prog);
      } catch {
        if (prog?.id) {
          await this.programEntryRepo.delete({ program_id: prog.id });
          await this.programRepo.delete({ id: prog.id });
        }
      }
    }
    if (
      !programs.length &&
      bestResult.entries.length &&
      !this.placementHasClashes(bestResult.entries, solverCtx.group_modes)
    ) {
      const labeledEntries = bestResult.entries.map((e) => {
        const a = assignmentById.get(e.assignment_id);
        const subject = a ? formatProgramEntrySubject(a, subjectById) : e.subject;
        return { ...e, subject };
      });
      const score = Math.round(bestResult.score);
      const classSections = labeledEntries.map((e) => e.class_section);
      const prog = await this.programRepo.save({
        studio_id: studioId,
        name: buildGeneratedProgramName({ score, version: 1, classSections }),
        status: 'generated',
        version: 1,
        score,
        generation_meta: {
          job_id: job.id,
          placed: bestResult.placed,
          failed: bestResult.failed,
          demo_partial: true,
          violations: bestResult.violations.slice(0, 30),
        },
      });
      await this.programEntryRepo.save(
        labeledEntries.map((e) => {
          const assign = assignmentById.get(e.assignment_id);
          return {
            program_id: prog.id,
            assignment_id: e.assignment_id,
            user_id: e.user_id ?? assign?.teacher_ids?.[0] ?? null,
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
            ...clipProgramEntryFields({
              class_section: e.class_section ?? '',
              subject: e.subject ?? '',
            }),
            room_id: e.room_id,
            group_id: e.group_id,
            is_locked: false,
          };
        }),
      );
      programs.push(prog);
    }
    if (!programs.length) {
      const retryViolations = applySoftRulePenalties(bestResult.entries, solverInput, solverCtx)
        .strict_violations;
      await this.jobRepo.update(job.id, { status: 'failed', finished_at: new Date() });
      const viol = (retryViolations.length ? retryViolations : strictViolations).slice(0, 20);
      const hasClashes = this.placementHasClashes(bestResult.entries, solverCtx.group_modes);
      throw new BadRequestException({
        code: hasClashes ? 'SCHEDULE_CLASH' : 'STRICT_RULES_VIOLATED',
        message: hasClashes
          ? 'Üretilen yerleşimde sınıf veya öğretmen çakışması var; program kaydedilmedi.'
          : viol[0] ??
            'Hiç program taslağı kaydedilemedi. Kurallar sayfasında zorunlu (sert) kuralları azaltın veya süreyi artırın.',
        details: { violations: viol },
      });
    }
    const finalScore = Math.round(bestResult.score);
    const bestLabeled = bestResult.entries.map((e) => {
      const a = assignmentById.get(e.assignment_id);
      return { ...e, subject: a ? formatProgramEntrySubject(a, subjectById) : e.subject };
    });
    const teacherRows = await this.listTeacherConfigs(studioId);
    const teacherNameById = new Map(
      teacherRows.map((t) => [t.user_id, t.display_name || t.user_id]),
    );
    const unplaced_report: UnplacedPlacementReport | null =
      bestResult.failed > 0
        ? buildUnplacedPlacementReport(bestLabeled, solverInput, solverCtx, teacherNameById)
        : null;
    const scoreBreakdown = buildProgramScoreBreakdown(
      bestLabeled,
      solverInput,
      solverCtx,
      bestResult.violations,
    );
    await this.jobRepo.update(job.id, {
      status: 'done',
      finished_at: new Date(),
      report: {
        placed: bestResult.placed,
        failed: bestResult.failed,
        violations: bestResult.violations,
        score: finalScore,
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
      score: finalScore,
      violations: bestResult.violations,
      violation_links: linkGenerationViolations(bestResult.violations.slice(0, 30)),
      score_breakdown: scoreBreakdown,
      unplaced_report,
      search_complexity: placementSearch.search_complexity,
      search_iterations: bestRun.meta.iterations,
      search_cap_estimate: searchCapEstimate,
    };
  }

  async getProgram(programId: string, studioId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    return { program, entries: await this.enrichProgramEntries(entries) };
  }

  private async enrichProgramEntries(entries: DersDagitProgramEntry[]) {
    if (!entries.length) return [];

    const assignmentIds = [...new Set(entries.map((e) => e.assignment_id).filter(Boolean))] as string[];
    const primaryTeacher = new Map<string, string>();
    if (assignmentIds.length) {
      const links = await this.assignmentTeacherRepo.find({ where: { assignment_id: In(assignmentIds) } });
      for (const l of links) {
        if (!primaryTeacher.has(l.assignment_id)) primaryTeacher.set(l.assignment_id, l.user_id);
      }
    }

    const userIds = new Set<string>();
    for (const e of entries) {
      const uid = e.user_id ?? (e.assignment_id ? primaryTeacher.get(e.assignment_id) : undefined);
      if (uid) userIds.add(uid);
    }

    const roomIds = [...new Set(entries.map((e) => e.room_id).filter(Boolean))] as string[];
    const users =
      userIds.size > 0
        ? await this.userRepo.find({ where: { id: In([...userIds]) }, select: ['id', 'display_name', 'email'] })
        : [];
    const rooms = roomIds.length > 0 ? await this.roomRepo.find({ where: { id: In(roomIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
    return entries.map((e) => {
      const user_id = e.user_id ?? (e.assignment_id ? primaryTeacher.get(e.assignment_id) ?? null : null);
      return {
        ...e,
        user_id,
        teacher_label: user_id ? userMap.get(user_id) ?? user_id.slice(0, 8) : null,
        room_name: e.room_id ? roomMap.get(e.room_id) ?? null : null,
      };
    });
  }

  private async studioGroupModes(studioId: string): Promise<Map<string, DersDagitGroupMode>> {
    const groups = await this.groupRepo.find({ where: { studio_id: studioId } });
    const out = new Map<string, DersDagitGroupMode>();
    for (const g of groups) out.set(g.id, normalizeGroupMode(g.parallel_mode));
    return out;
  }

  private clashCtxFromModes(group_modes: Map<string, DersDagitGroupMode>): ProgramClashContext {
    return { group_modes };
  }

  private placementHasClashes(
    entries: Array<{
      day_of_week: number;
      lesson_num: number;
      class_section: string;
      user_id: string | null;
      assignment_id: string;
      group_id?: string | null;
    }>,
    group_modes: Map<string, DersDagitGroupMode>,
  ): boolean {
    if (!entries.length) return false;
    const probe = entries.map((e, i) => ({
      id: `gen-${i}`,
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      user_id: e.user_id,
      assignment_id: e.assignment_id,
      group_id: e.group_id ?? null,
    }));
    return computeProgramClashes(probe, { group_modes }).length > 0;
  }

  private assertEntrySlot(
    entry: DersDagitProgramEntry,
    day: number,
    lesson: number,
    excludeIds: string[],
    all: DersDagitProgramEntry[],
    clashCtx?: ProgramClashContext,
  ) {
    const clash = entry.id
      ? wouldClash(all, entry.id, day, lesson, excludeIds[0], clashCtx)
      : wouldClashAt(all, entry, day, lesson, excludeIds, clashCtx);
    if (clash) {
      throw new BadRequestException({ code: clash.code, message: clash.message });
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

  async getProgramEditorExtras(programId: string, studioId: string, schoolId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const raw = await this.programEntryRepo.find({ where: { program_id: programId } });
    const entries = await this.enrichProgramEntries(raw);
    const fairnessKey = `${studioId}:${programId}`;
    let fairness = this.fairnessCache.get(fairnessKey)?.data;
    if (!fairness || Date.now() - (this.fairnessCache.get(fairnessKey)?.at ?? 0) > DersDagitService.FAIRNESS_CACHE_MS) {
      fairness = await this.getFairnessForProgram(studioId, programId);
      this.fairnessCache.set(fairnessKey, { at: Date.now(), data: fairness });
    }
    const score_breakdown = await this.computeLiveProgramScoreBreakdown(studioId, schoolId, entries);
    return {
      program_score: score_breakdown.score,
      score_breakdown,
      fairness,
    };
  }

  async getProgramEditorContext(
    programId: string,
    studioId: string,
    schoolId: string,
    opts?: { light?: boolean },
  ) {
    const light = opts?.light !== false;
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
    const studioAssignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    const assignment_hints: Record<
      string,
      { block_size: number; max_per_day: number; day_distribution: number[] | null }
    > = {};
    for (const a of studioAssignments) {
      const spec = assignmentPlacementSpec(
        a.options as Record<string, unknown> | undefined,
        a.weekly_hours,
        a.biweekly,
      );
      assignment_hints[a.id] = {
        block_size: spec.block_size,
        max_per_day: spec.max_per_day,
        day_distribution: spec.day_distribution,
      };
    }
    const group_modes = await this.studioGroupModes(studioId);
    const clashes = computeProgramClashes(entries, { group_modes });
    const schoolDefaultMax = Math.max(
      8,
      ...(period.lesson_schedule ?? []).map((s) => s.lesson_num),
      ...(period.lesson_schedule_weekend ?? []).map((s) => s.lesson_num),
    );
    const maxLesson = Math.max(schoolDefaultMax, ...entries.map((e) => e.lesson_num));
    const fairnessKey = `${studioId}:${programId}`;
    let fairness: Awaited<ReturnType<DersDagitService['getFairnessForProgram']>> = {
      ready: false,
      message: 'Yükleniyor…',
    };
    let score_breakdown: ProgramScoreBreakdown | null = null;
    if (light) {
      const hit = this.fairnessCache.get(fairnessKey);
      if (hit && Date.now() - hit.at < DersDagitService.FAIRNESS_CACHE_MS) fairness = hit.data;
    } else {
      let cachedFairness = this.fairnessCache.get(fairnessKey)?.data;
      if (!cachedFairness || Date.now() - (this.fairnessCache.get(fairnessKey)?.at ?? 0) > DersDagitService.FAIRNESS_CACHE_MS) {
        cachedFairness = await this.getFairnessForProgram(studioId, programId);
        this.fairnessCache.set(fairnessKey, { at: Date.now(), data: cachedFairness });
      }
      fairness = cachedFairness;
      score_breakdown = await this.computeLiveProgramScoreBreakdown(studioId, schoolId, entries);
    }
    return {
      program: { ...program, score: score_breakdown?.score ?? program.score },
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
      assignment_hints,
      clashes,
      group_modes: Object.fromEntries(group_modes),
      max_lesson: maxLesson,
      fairness,
      score_breakdown,
    };
  }

  async listUnplacedAssignments(studioId: string, programId: string) {
    const [assignments, entries, studio] = await Promise.all([
      this.assignmentRepo.find({ where: { studio_id: studioId } }),
      this.programEntryRepo.find({ where: { program_id: programId } }),
      this.studioRepo.findOne({ where: { id: studioId } }),
    ]);
    const distribution_policy = parseDistributionPolicy(studio?.settings?.distribution_policy);
    const placementCtx = { distribution_policy } as SolverContext;

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

    const out: Array<{
      pool_id: string;
      assignment_id: string;
      subject_name: string;
      class_section: string;
      weekly_hours: number;
      placed_hours: number;
      remaining_hours: number;
      chunk_hours: number;
      pattern_label: string | null;
      user_id: string | null;
      teacher_label: string | null;
    }> = [];

    for (const a of assignments) {
      const need = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      const secs = a.class_sections?.length ? a.class_sections : ['—'];
      const uid = primaryTeacher.get(a.id) ?? null;
      const solverA: SolverAssignment = {
        id: a.id,
        subject_name: a.subject_name,
        class_sections: a.class_sections ?? [],
        weekly_hours: a.weekly_hours,
        teacher_ids: uid ? [uid] : [],
        room_ids: a.room_ids ?? [],
        group_id: a.group_id,
        max_per_day: a.max_per_day,
        min_days_per_week: a.min_days_per_week,
        fixed_slots: (a.fixed_slots ?? []) as SolverAssignment['fixed_slots'],
        place_first: a.place_first,
        biweekly: a.biweekly,
        unavailable_periods: [],
        options: (a.options ?? {}) as Record<string, unknown>,
      };
      const pattern = placementPatternForAssignment(solverA, need, placementCtx);
      const patternLabel = pattern?.length ? pattern.join('+') : null;

      for (const section of secs) {
        const slotKeys = new Set<string>();
        for (const e of entries) {
          if (e.assignment_id !== a.id || e.class_section !== section) continue;
          slotKeys.add(`${e.day_of_week}:${e.lesson_num}`);
        }
        const placed = slotKeys.size;
        const remaining = need - placed;
        if (remaining <= 0) continue;

        const secEntries = entries
          .filter((e) => e.assignment_id === a.id && e.class_section === section)
          .map((e) => ({
            assignment_id: e.assignment_id,
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
          }));

        let chunks: number[] = [];
        if (pattern && isValidDayDistribution(pattern, need)) {
          chunks = remainingPatternChunks(a.id, secEntries, pattern);
        }
        if (!chunks.length) {
          const inferred = inferDayDistribution(
            a.weekly_hours,
            (a.options ?? {}) as Record<string, unknown>,
            a.biweekly,
            distribution_policy.mode,
          );
          if (isValidDayDistribution(inferred, need)) {
            chunks = remainingPatternChunks(a.id, secEntries, inferred);
          }
        }
        if (!chunks.length) {
          chunks = [remaining];
        }

        chunks.forEach((chunk, chunkIndex) => {
          const pool_id = `pool:${a.id}|${encodeURIComponent(section)}|${chunk}|${chunkIndex}`;
          out.push({
            pool_id,
            assignment_id: a.id,
            subject_name: a.subject_name,
            class_section: section,
            weekly_hours: a.weekly_hours,
            placed_hours: placed,
            remaining_hours: chunk,
            chunk_hours: chunk,
            pattern_label: patternLabel,
            user_id: uid,
            teacher_label: uid ? userMap.get(uid) ?? null : null,
          });
        });
      }
    }
    return out.sort(
      (x, y) =>
        y.remaining_hours - x.remaining_hours ||
        x.class_section.localeCompare(y.class_section, 'tr') ||
        x.assignment_id.localeCompare(y.assignment_id),
    );
  }

  /** Atama kotasına göre yerleşme özeti (yayın / hazırlık yüzdesi). Hafif: sadece saat sayıları. */
  async computeProgramPlacementSummary(studioId: string, programId: string) {
    const [assignments, entries] = await Promise.all([
      this.assignmentRepo.find({
        where: { studio_id: studioId },
        select: ['id', 'weekly_hours', 'biweekly', 'class_sections'],
      }),
      this.programEntryRepo.find({
        where: { program_id: programId },
        select: ['assignment_id'],
      }),
    ]);
    const placedBy = new Map<string, number>();
    for (const e of entries) {
      if (!e.assignment_id) continue;
      placedBy.set(e.assignment_id, (placedBy.get(e.assignment_id) ?? 0) + 1);
    }
    let requiredHours = 0;
    let unplacedHours = 0;
    let unplacedCount = 0;
    for (const a of assignments) {
      const need = a.biweekly ? Math.ceil(a.weekly_hours / 2) : a.weekly_hours;
      requiredHours += need;
      const remaining = need - (placedBy.get(a.id) ?? 0);
      if (remaining > 0) {
        unplacedHours += remaining;
        unplacedCount++;
      }
    }
    const placedHours = Math.max(0, requiredHours - unplacedHours);
    const placement_percent =
      requiredHours > 0 ? Math.min(100, Math.round((placedHours / requiredHours) * 100)) : 0;
    return {
      required_hours: requiredHours,
      placed_hours: placedHours,
      unplaced_count: unplacedCount,
      unplaced_hours: unplacedHours,
      placement_percent,
      is_fully_placed: requiredHours > 0 && unplacedHours === 0,
    };
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
    const clashCtx = this.clashCtxFromModes(await this.studioGroupModes(studioId));
    this.assertEntrySlot(a, bDay, bLesson, [b.id], all, clashCtx);
    this.assertEntrySlot(b, aDay, aLesson, [a.id], all, clashCtx);
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
    body: {
      assignment_id: string;
      day_of_week: number;
      lesson_num: number;
      class_section?: string;
    },
  ) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const a = await this.assignmentRepo.findOne({ where: { id: body.assignment_id, studio_id: studioId } });
    if (!a) throw new NotFoundException('Atama bulunamadı');
    const links = await this.assignmentTeacherRepo.find({ where: { assignment_id: a.id }, take: 1 });
    const teacherId = links[0]?.user_id ?? null;
    const requested = body.class_section?.trim();
    const classSection =
      requested && a.class_sections?.some((s) => s === requested)
        ? requested
        : a.class_sections[0];
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
      subject: formatProgramEntrySubject(a, subjectCatalogMap(await this.listSubjects(studioId))),
      room_id: a.room_ids?.[0] ?? null,
      is_locked: false,
      group_id: a.group_id,
    });
    const clashCtx = this.clashCtxFromModes(await this.studioGroupModes(studioId));
    this.assertEntrySlot(draft, body.day_of_week, body.lesson_num, [], all, clashCtx);
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
    this.clearSectionLessonCountsForPeriod(studio);
    await this.studioRepo.save(studio);
    this.invalidateValidationResultCache(studioId);
    return this.getPeriodConfig(schoolId, studioId);
  }

  // --- Faz 27: Yayın → teacher-timetable ---
  async getPublishPreview(programId: string, studioId: string, schoolId: string) {
    const ctx = await this.getProgramEditorContext(programId, studioId, schoolId);
    const validation = await this.runValidation(studioId);
    const valErrors = validation.filter((v) => v.severity === 'error');
    const valWarns = validation.filter((v) => v.severity !== 'error');
    const published = await this.programRepo.find({
      where: { studio_id: studioId, status: 'published' },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    const currentPublished = published[0];
    let diffEntryCount = 0;
    if (currentPublished && currentPublished.id !== programId) {
      const prevEntries = await this.programEntryRepo.find({ where: { program_id: currentPublished.id } });
      const key = (e: { class_section: string; subject: string; day_of_week: number; lesson_num: number; user_id?: string | null }) =>
        `${e.class_section}|${e.subject}|${e.day_of_week}|${e.lesson_num}|${e.user_id ?? ''}`;
      const prevKeys = new Set(prevEntries.map(key));
      diffEntryCount = ctx.entries.filter((e) => !prevKeys.has(key(e))).length;
    }
    const placement = await this.computeProgramPlacementSummary(studioId, programId);
    const unplacedHours = placement.unplaced_hours;
    const clashCount = ctx.clashes.length;
    const blockers: string[] = [];
    if (!ctx.entries.length) blockers.push('Programda yerleşmiş ders saati yok');
    if (unplacedHours > 0) {
      blockers.push(
        `${placement.unplaced_count} yerleşmemiş atama (${unplacedHours} saat eksik · yerleşme %${placement.placement_percent})`,
      );
    }
    if (clashCount > 0) blockers.push(`${clashCount} çakışma`);
    if (valErrors.length > 0) blockers.push(`${valErrors.length} doğrulama hatası`);
    const softWarnings: string[] = [];
    if (valWarns.length > 0) softWarnings.push(`${valWarns.length} doğrulama uyarısı`);
    if (diffEntryCount > 0 && currentPublished) {
      softWarnings.push(`Yayındaki programa göre ~${diffEntryCount} saat farklı`);
    }
    return {
      program: {
        id: ctx.program.id,
        name: ctx.program.name,
        status: ctx.program.status,
        score: ctx.program.score,
      },
      entry_count: ctx.entries.length,
      clash_count: clashCount,
      unplaced_count: placement.unplaced_count,
      unplaced_hours: unplacedHours,
      placement_percent: placement.placement_percent,
      required_hours: placement.required_hours,
      placed_hours: placement.placed_hours,
      validation_error_count: valErrors.length,
      validation_warn_count: valWarns.length,
      published_program: currentPublished
        ? { id: currentPublished.id, name: currentPublished.name, published_plan_id: currentPublished.published_plan_id }
        : null,
      diff_entry_count: diffEntryCount,
      blockers,
      soft_warnings: softWarnings,
      can_publish: blockers.length === 0,
      requires_risk_ack: softWarnings.length > 0,
    };
  }

  async publishProgramToSchool(
    studioId: string,
    schoolId: string,
    userId: string,
    programId: string,
    opts: {
      valid_from?: string;
      valid_until?: string | null;
      name?: string;
      risk_acknowledged?: boolean;
    },
  ) {
    const preview = await this.getPublishPreview(programId, studioId, schoolId);
    if (!preview.can_publish) {
      throw new BadRequestException({
        code: 'PUBLISH_BLOCKED',
        message: preview.blockers.join(' · ') || 'Yayın engellendi',
        blockers: preview.blockers,
      });
    }
    if (preview.requires_risk_ack && !opts.risk_acknowledged) {
      throw new BadRequestException({
        code: 'PUBLISH_ACK_REQUIRED',
        message: 'Yerleşmemiş atama veya uyarılar var; onay kutusunu işaretleyin.',
        warnings: preview.soft_warnings,
      });
    }
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
      room_id: e.room_id ?? null,
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

  async exportProgramPdf(
    programId: string,
    studioId: string,
    schoolId?: string,
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const rows = await this.buildExportRows(programId, studioId);
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildProgramPdf(header, rows, parsePdfTheme(theme));
  }

  async exportScheduleViewPdf(
    programId: string,
    studioId: string,
    schoolId: string | undefined,
    view: 'class' | 'teacher' | 'room',
    filter: string,
    entityLabel: string,
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const rows = await this.buildExportRows(programId, studioId);
    const filtered = rows.filter((r) => {
      if (view === 'class') return r.class_section === filter;
      if (view === 'teacher') return r.user_id === filter;
      if (filter === '__none__') return !r.room_id;
      return r.room_id === filter;
    });
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    const label = entityLabel.trim() || filter;
    return this.pdfService.buildScheduleViewPdf(header, filtered, view, label, parsePdfTheme(theme));
  }

  async exportMasterSheetPdf(
    programId: string,
    studioId: string,
    schoolId: string | undefined,
    axis: 'teacher' | 'class' | 'room',
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const rows = await this.buildExportRows(programId, studioId);
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildMasterSheetPdf(header, rows, axis, parsePdfTheme(theme));
  }

  private async loadDutySlotsForPdf(schoolId: string, studioId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['settings'] });
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const period = parseStudioPeriod(settings.period);
    const workDays = Array.isArray(settings.work_days)
      ? (settings.work_days as number[])
      : period.work_days ?? [1, 2, 3, 4, 5];
    const dutyRange = (settings.duty_sync ?? {}) as { from?: string; to?: string };
    const teachers = await this.listTeacherConfigs(studioId);
    const nameMap = new Map(teachers.map((t) => [t.user_id, t.display_name]));

    const qb = this.dutySlotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .where('p.school_id = :schoolId', { schoolId })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.archived_at IS NULL')
      .andWhere('p.status = :published', { published: 'published' });
    if (dutyRange.from) qb.andWhere('s.date >= :from', { from: dutyRange.from });
    if (dutyRange.to) qb.andWhere('s.date <= :to', { to: dutyRange.to });
    const slots = await qb.getMany();

    const parseDow = (date: string) => {
      const d = new Date(`${date}T12:00:00`);
      const js = d.getDay();
      return js === 0 ? 7 : js;
    };

    return {
      workDays,
      slots: slots.map((s) => ({
        user_id: s.user_id,
        teacher_label: nameMap.get(s.user_id) ?? s.user_id.slice(0, 8),
        date: s.date,
        day_of_week: parseDow(s.date),
        lesson_num: s.lesson_num,
        shift: s.shift,
        area_name: s.area_name,
        slot_name: s.slot_name,
      })),
    };
  }

  async exportDutyReportPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { slots, workDays } = await this.loadDutySlotsForPdf(schoolId, studioId);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildDutyPdf(header, slots, workDays, parsePdfTheme(theme));
  }

  async exportDualEducationPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['settings'] });
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const dual = parseDualEducation(settings.dual_education);
    const period = parseStudioPeriod(settings.period);
    const pmFirst = pmFirstLessonNum(period, dual);
    const profiles = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    const sectionShift = new Map<string, EducationShift | null>();
    for (const p of profiles) {
      for (const sec of p.class_sections ?? []) {
        sectionShift.set(sec, normalizeEducationShift(p.education_shift));
      }
    }
    const bySection = new Map<string, { am: number; pm: number }>();
    for (const e of entries) {
      const b = bySection.get(e.class_section) ?? { am: 0, pm: 0 };
      if (e.lesson_num < pmFirst) b.am++;
      else b.pm++;
      bySection.set(e.class_section, b);
    }
    const rows = [...bySection.entries()]
      .map(([class_section, c]) => {
        const shift = sectionShift.get(class_section);
        const shift_label =
          shift === 'morning' ? 'Sabah vardiyası' : shift === 'afternoon' ? 'Öğle vardiyası' : 'Karma';
        return {
          class_section,
          shift_label,
          placed_hours: c.am + c.pm,
          morning_hours: c.am,
          afternoon_hours: c.pm,
        };
      })
      .sort((a, b) => compareClassSections(a.class_section, b.class_section));
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildDualPdf(header, rows, dual.enabled, pmFirst, parsePdfTheme(theme));
  }

  async exportExtraLessonPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    theme?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const fair = await this.getFairnessMetrics(studioId);
    if (!fair.ready) {
      throw new BadRequestException({
        code: 'NO_PROGRAM',
        message: 'Ek ders özeti için üretilmiş program gerekir.',
      });
    }
    const configs = await this.listTeacherConfigs(studioId);
    const cfgMap = new Map(configs.map((c) => [c.user_id, c]));
    const rows = (fair.teacher_stats ?? []).map((t) => {
      const c = cfgMap.get(t.teacher_id);
      const mandatory = c?.mandatory_weekly_hours ?? t.mandatory_weekly_hours ?? null;
      const maxExtra = c?.max_extra_weekly_hours ?? null;
      const actual = t.lesson_count;
      const diff = mandatory != null ? actual - mandatory : 0;
      return {
        label: t.label,
        branch: t.branch,
        mandatory,
        max_extra: maxExtra,
        actual,
        diff,
        extra_available: maxExtra,
      };
    });
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildExtraLessonSummaryPdf(
      header,
      rows,
      program.name ?? 'Program',
      parsePdfTheme(theme),
    );
  }

  private async buildPdfHeader(
    programId: string,
    studioId: string,
    schoolId: string | undefined,
    programName?: string | null,
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['settings', 'academic_year'] });
    const school = schoolId
      ? await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['name'] })
      : null;
    const rs = parseStudioReportSettings((studio?.settings ?? {}) as Record<string, unknown>);
    const schoolLabel =
      rs.meta.school_name?.trim() || rs.texts.title?.trim() || school?.name?.trim() || 'Okul';
    const year = rs.meta.academic_year?.trim() || studio?.academic_year || null;
    const customSub = rs.texts.subtitle?.trim() || null;
    const progLabel = programName?.trim() || null;
    return {
      school_name: schoolLabel,
      document_title: rs.texts.title?.trim() || 'HAFTALIK DERS PROGRAMI ÇİZELGESİ',
      subtitle: customSub || progLabel,
      academic_year: year,
      program_name: customSub && progLabel && customSub !== progLabel ? progLabel : null,
      footer_note: rs.texts.footer_note?.trim() || null,
    };
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
    const all = await this.programEntryRepo.find({ where: { program_id: programId } });
    const clashCtx = this.clashCtxFromModes(await this.studioGroupModes(studioId));
    const clash = wouldClash(all, entryId, day, lesson, undefined, clashCtx);
    if (clash) {
      throw new BadRequestException({ code: clash.code, message: clash.message });
    }
    if (entry.assignment_id && (dto.day_of_week != null || dto.lesson_num != null)) {
      const a = await this.assignmentRepo.findOne({
        where: { id: entry.assignment_id, studio_id: studioId },
      });
      if (a) {
        const all = await this.programEntryRepo.find({ where: { program_id: programId } });
        const spec = assignmentPlacementSpec(a.options as Record<string, unknown>, a.weekly_hours, a.biweekly);
        if (
          spec.block_size >= 2 &&
          !assignmentBlockPlacementOk(all, a.id, entryId, day, lesson, spec)
        ) {
          throw new BadRequestException({
            code: 'BLOCK_NOT_CONSECUTIVE',
            message: 'Blok ders aynı günde ardışık saatlere yerleştirilmeli.',
          });
        }
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

  private async planImportRowsForStudio(
    studioId: string,
    schoolId: string,
    entries: Array<{
      class_section?: string | null;
      subject?: string | null;
      user_id?: string | null;
      day_of_week?: number;
      lesson_num?: number;
    }>,
  ): Promise<PlanImportRow[]> {
    const { rows } = aggregatePlanImportRows(entries);
    const pool = await this.collectStudioSectionNamesRaw(studioId, schoolId);
    const canon = rows.map((r) => ({
      ...r,
      section: normalizeClassSectionNamesFromPool([r.section], pool)[0] ?? r.section,
    }));
    return mergePlanImportRows(canon);
  }

  /** Okul programı → önizleme (aktarma yok). */
  async previewImportFromSchoolPlan(studioId: string, schoolId: string, planId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const { plan, entries } = await this.loadSchoolPlanEntries(schoolId, planId);
    const { skipped, names_fixed } = aggregatePlanImportRows(entries);
    const rows = await this.planImportRowsForStudio(studioId, schoolId, entries);
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
        min_days_per_week: defaultMinDaysFromWeeklyHours(r.weekly_hours),
        room_ids: [] as string[],
        teacher_ids: r.teacher_ids,
      };
      const prev = byKey.get(catalogKey(subject_id, r.subject, r.section));
      if (prev) {
        await this.upsertAssignment(
          studioId,
          {
            id: prev.id,
            ...payload,
            room_ids: prev.room_ids ?? [],
          },
          { skip_capacity_check: true },
        );
        updated++;
      } else {
        await this.upsertAssignment(studioId, payload, { skip_capacity_check: true });
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
    const rows = await this.planImportRowsForStudio(studioId, schoolId, entries);
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
    this.invalidateValidationResultCache(studioId);
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

  private async findAssignmentTeacherLinks(assignmentIds: string[]) {
    if (!assignmentIds.length) return [];
    return this.assignmentTeacherRepo.find({
      where: { assignment_id: In(assignmentIds) },
    });
  }

  /** Okul şube önerileri dahil — ad eşleştirme havuzu (kurulum kaydı, atama normalizasyonu). */
  private async collectStudioSectionPoolRaw(studioId: string, schoolId: string): Promise<string[]> {
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
    return sortClassSections([...set]);
  }

  /** Sınıf listesi: kurulum profilleri + atama + katalog + kayıtlı saatler; okul önerisi otomatik eklenmez. */
  private async collectStudioActiveSectionNamesRaw(studioId: string, schoolId: string): Promise<string[]> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId }, select: ['settings'] });
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const excluded = parseExcludedClassSections(settings.excluded_class_sections);
    const scheduleKeys = [...parseSectionSchedules(settings.section_schedules).keys()];

    const [profiles, assignments, subjectRows] = await Promise.all([
      this.classProfileRepo.find({ where: { studio_id: studioId }, select: ['class_sections'] }),
      this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['class_sections'] }),
      this.subjectRepo.find({ where: { studio_id: studioId }, select: ['class_hours'] }),
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
    for (const sec of scheduleKeys) if (sec?.trim()) set.add(sec.trim());

    const filtered = [...set].filter((s) => !isClassSectionExcluded(s, excluded));
    return sortClassSections(filtered);
  }

  /** @deprecated use collectStudioSectionPoolRaw or collectStudioActiveSectionNamesRaw */
  private async collectStudioSectionNamesRaw(studioId: string, schoolId: string): Promise<string[]> {
    return this.collectStudioSectionPoolRaw(studioId, schoolId);
  }

  private async collectStudioSections(studioId: string, schoolId: string): Promise<string[]> {
    const raw = await this.collectStudioActiveSectionNamesRaw(studioId, schoolId);
    return dedupeSectionAliases(raw);
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

  private async buildTtkbCellsForStudio(
    studioId: string,
    schoolId: string,
    studio: DersDagitStudio,
    profile: StudioSchoolProfile,
    gradeFilter?: number[],
  ): Promise<{
    cells: TtkbPreviewCellDto[];
    sections: string[];
    sections_without_grade: string[];
    yillik_size: number;
    mode: 'sections' | 'grade_catalog';
  }> {
    const grades = gradesForSchoolType(profile.type);
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    const sections = await this.collectStudioSections(studioId, schoolId);
    const withoutGrade = sections.filter((s) => !gradeFromClassSection(s));

    let cells: TtkbPreviewCellDto[] = [];
    let mode: 'sections' | 'grade_catalog' = 'grade_catalog';

    if (sections.length) {
      mode = 'sections';
      const seedCells = buildTtkbSeedCells(sections, profile.type, yillik);
      for (const c of seedCells) {
        if (c.source === 'ttkb') {
          const h = await this.appConfig.getDersSaati(c.subject_code, c.grade);
          if (h >= 1) c.weekly_hours = h;
        }
      }
      cells = seedCells.map((c) => ({
        subject_code: c.subject_code,
        subject_name: c.subject_name,
        class_section: c.class_section,
        grade: c.grade,
        weekly_hours: c.weekly_hours,
        source: c.source,
      }));
    } else {
      const rows = buildTtkbCatalogBySchoolType(profile.type, yillik);
      for (const r of rows) {
        if (r.source === 'ttkb') {
          const h = await this.appConfig.getDersSaati(r.subject_code, r.grade);
          if (h >= 1) r.weekly_hours = h;
        }
      }
      cells = catalogRowsToPreviewCells(rows);
    }

    if (gradeFilter?.length) {
      const set = new Set(gradeFilter);
      cells = cells.filter((c) => set.has(c.grade));
    }

    return {
      cells,
      sections,
      sections_without_grade: withoutGrade,
      yillik_size: yillik.size,
      mode,
    };
  }

  async previewTtkbSeed(studioId: string, schoolId: string, gradeFilter?: number[]) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const grades = gradesForSchoolType(profile.type);
    const built = await this.buildTtkbCellsForStudio(studioId, schoolId, studio, profile, gradeFilter);
    const { cells, sections, sections_without_grade, yillik_size, mode } = built;
    const subjectMap =
      mode === 'sections' ? mergeCellsToSubjects(cells as never) : mergeGradeCatalogToSubjects(
          cells.map((c) => ({
            subject_code: c.subject_code,
            subject_name: c.subject_name,
            grade: c.grade,
            weekly_hours: c.weekly_hours,
            source: c.source,
            is_elective: false,
          })),
        );
    const activeGrades = [...new Set(cells.map((c) => c.grade).filter((g) => g >= 1))].sort((a, b) => a - b);
    const empty_message =
      cells.length === 0
        ? sections.length === 0
          ? 'Kurulumda sınıf profili/şube yok; önce Kurulum veya Sınıf–Ders modülünden şube tanımlayın.'
          : 'TTKB listesi üretilemedi. Kurulumda okul türünü kaydedin.'
        : undefined;
    return {
      sections,
      sections_without_grade,
      grades: activeGrades.length ? activeGrades : grades,
      empty_message,
      school_type: profile.type,
      cell_count: cells.length,
      subject_count: subjectMap.size,
      yillik_plan_keys: yillik_size,
      mode,
      sample: cells.slice(0, 30),
      cells,
      by_grade: groupPreviewCellsByGrade(cells),
      subject_summary: summarizeSubjectsAcrossGrades(cells),
      totals_by_grade: Object.fromEntries(
        activeGrades.map((g) => [g, cells.filter((c) => c.grade === g).reduce((s, c) => s + c.weekly_hours, 0)]),
      ),
    };
  }

  async seedFromTtkb(
    studioId: string,
    schoolId: string,
    userId: string,
    opts?: { replace?: boolean; sync_assignments?: boolean; grades?: number[] },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const built = await this.buildTtkbCellsForStudio(studioId, schoolId, studio, profile, opts?.grades);
    const { cells, mode } = built;
    if (!cells.length) {
      throw new BadRequestException({
        code: 'TTKB_EMPTY',
        message: 'TTKB listesi üretilemedi. Kurulumda okul türünü ve şubeleri kaydedin.',
      });
    }
    const subjectMap =
      mode === 'sections'
        ? mergeCellsToSubjects(cells as never)
        : mergeGradeCatalogToSubjects(
            cells.map((c) => ({
              subject_code: c.subject_code,
              subject_name: c.subject_name,
              grade: c.grade,
              weekly_hours: c.weekly_hours,
              source: c.source,
              is_elective: false,
            })),
          );
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
    const names = [...subjectMap.values()]
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b, 'tr'));
    settings.ttkb_seed_at = new Date().toISOString();
    settings.ttkb_catalog_names = names;
    studio.settings = settings;
    await this.studioRepo.save(studio);
    let assignments_created = 0;
    if (opts?.sync_assignments) {
      const r = await this.syncSubjectsToAssignments(studioId, userId, { replace: !!opts.replace });
      assignments_created = r.created;
    }
    const gradeCount = new Set(cells.map((c) => c.grade)).size;
    await this.audit(studioId, userId, 'subjects.seeded_ttkb', {
      created,
      updated,
      grades: gradeCount,
      assignments_created,
      mode,
    });
    return {
      created,
      updated,
      grades: gradeCount,
      assignments_created,
      subject_count: subjectMap.size,
      names,
      mode,
    };
  }

  async previewSchoolCatalogImport(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);

    const classes = await this.schoolClassRepo.find({
      where: { schoolId },
      order: { grade: 'ASC', name: 'ASC' },
    });
    const schoolSubjects = await this.schoolSubjectRepo.find({
      where: { schoolId },
      order: { name: 'ASC' },
    });
    const classSections = sortClassSections(
      classes.map((c) => c.name.trim()).filter(Boolean),
    );

    let ttkbCells: TtkbPreviewCellDto[] = [];
    let ttkbMode: 'sections' | 'grade_catalog' | 'none' = 'none';
    if (classSections.length) {
      const built = await this.buildTtkbCellsForStudio(studioId, schoolId, studio, profile);
      ttkbCells = built.cells.filter((c) => classSections.includes(c.class_section));
      ttkbMode = built.mode;
    }

    return {
      school_type: profile.type,
      class_count: classes.length,
      school_subject_count: schoolSubjects.length,
      class_sections: classSections,
      classes: classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade })),
      school_subjects: schoolSubjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      ttkb_mode: ttkbMode,
      ttkb_cell_count: ttkbCells.length,
      ttkb_subject_count: mergeCellsToSubjects(ttkbCells as never).size,
      by_grade: groupPreviewCellsByGrade(ttkbCells),
      subject_summary: summarizeSubjectsAcrossGrades(ttkbCells),
      cells: ttkbCells,
    };
  }

  async seedFromSchoolCatalog(
    studioId: string,
    schoolId: string,
    userId: string,
    opts?: {
      replace?: boolean;
      sync_assignments?: boolean;
      mode?: 'subjects_only' | 'subjects_with_ttkb_hours';
    },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const mode = opts?.mode ?? 'subjects_with_ttkb_hours';

    const classes = await this.schoolClassRepo.find({ where: { schoolId } });
    const schoolSubjects = await this.schoolSubjectRepo.find({ where: { schoolId } });
    const classSections = sortClassSections(classes.map((c) => c.name.trim()).filter(Boolean));

    let subjectMap: Map<
      string,
      { name: string; short_code: string; class_hours: Record<string, number>; is_elective: boolean }
    >;

    if (mode === 'subjects_with_ttkb_hours') {
      if (!classSections.length) {
        throw new BadRequestException({
          code: 'NO_SCHOOL_CLASSES',
          message: 'Okul sınıf/grup listesi boş. Önce Sınıf–Ders modülünden şube ekleyin.',
        });
      }
      const built = await this.buildTtkbCellsForStudio(studioId, schoolId, studio, profile);
      const cells = built.cells.filter((c) => classSections.includes(c.class_section));
      if (!cells.length) {
        throw new BadRequestException({
          code: 'TTKB_SCHOOL_EMPTY',
          message: 'Şubeler için TTKB saatleri üretilemedi. Okul türünü ve sınıf adlarını kontrol edin.',
        });
      }
      subjectMap = mergeCellsToSubjects(cells as never);
    } else {
      subjectMap = new Map();
      for (const s of schoolSubjects) {
        const code = (s.code ?? s.name).toLowerCase().replace(/\s+/g, '_').slice(0, 16);
        if (!code) continue;
        subjectMap.set(code, {
          name: s.name.trim(),
          short_code: code,
          class_hours: {},
          is_elective: false,
        });
      }
      if (!subjectMap.size) {
        throw new BadRequestException({
          code: 'NO_SCHOOL_SUBJECTS',
          message: 'Okul ders listesi boş. Sınıf–Ders modülünden ders ekleyin.',
        });
      }
    }

    if (opts?.replace) {
      await this.assignmentRepo.delete({ studio_id: studioId });
      await this.subjectRepo.delete({ studio_id: studioId });
    }

    const existing = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const byCode = new Map(existing.map((s) => [(s.short_code ?? s.name).toLowerCase(), s]));
    let created = 0;
    let updated = 0;
    for (const [, row] of subjectMap) {
      const prev = byCode.get(row.short_code);
      if (prev) {
        await this.subjectRepo.save({
          ...prev,
          class_hours: { ...(prev.class_hours ?? {}), ...row.class_hours },
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

    settings.school_catalog_seed_at = new Date().toISOString();
    studio.settings = settings;
    await this.studioRepo.save(studio);

    let assignments_created = 0;
    if (opts?.sync_assignments) {
      const r = await this.syncSubjectsToAssignments(studioId, userId, { replace: !!opts.replace });
      assignments_created = r.created;
    }
    await this.audit(studioId, userId, 'subjects.seeded_school_catalog', {
      mode,
      created,
      updated,
      class_sections: classSections.length,
      assignments_created,
    });
    return {
      created,
      updated,
      assignments_created,
      subject_count: subjectMap.size,
      mode,
    };
  }

  async previewTtkbElectiveSeed(studioId: string, schoolId: string) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const grades = gradesForSchoolType(profile.type);
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    const rows = buildTtkbElectiveCatalogBySchoolType(profile.type, yillik);
    const subjects = mergeGradeCatalogToSubjects(rows);
    const cells = catalogRowsToPreviewCells(rows);
    const empty_message =
      rows.length === 0
        ? profile.type === 'ilkokul'
          ? 'İlkokulda TTKB seçmeli listesi yok. Kurulumda ortaokul veya lise türü seçin.'
          : 'Seçmeli TTKB listesi üretilemedi. Kurulumda okul türünü kaydedin.'
        : undefined;
    return {
      sections: [],
      sections_without_grade: [],
      grades,
      empty_message,
      school_type: profile.type,
      cell_count: cells.length,
      subject_count: subjects.size,
      yillik_plan_keys: yillik.size,
      sample: cells.slice(0, 30),
      cells,
      totals_by_grade: Object.fromEntries(
        grades.map((g) => [
          g,
          rows.filter((r) => r.grade === g).reduce((s, r) => s + r.weekly_hours, 0),
        ]),
      ),
    };
  }

  async syncElectivePoolsFromCatalog(
    studioId: string,
    schoolId: string,
    userId: string,
    opts?: { replace_pools?: boolean; catalog_rows?: import('./ders-dagit.ttkb-seed').TtkbCatalogRow[] },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const grades = gradesForSchoolType(profile.type);
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    const rows =
      opts?.catalog_rows ?? buildTtkbElectiveCatalogBySchoolType(profile.type, yillik);
    const sections = await this.collectStudioSections(studioId, schoolId);
    const drafts = buildElectivePoolDraftsFromCatalog(rows, sections);
    if (!drafts.length) {
      return {
        pools_created: 0,
        pools_updated: 0,
        pool_names: [] as string[],
        message: 'Havuz oluşturulacak seçmeli ders bulunamadı.',
      };
    }
    if (opts?.replace_pools) {
      const gradeKeys = new Set(drafts.map((d) => d.name));
      const existing = await this.electivePoolRepo.find({ where: { studio_id: studioId } });
      for (const p of existing) {
        if (gradeKeys.has(p.name)) {
          await this.electivePoolRepo.delete({ id: p.id });
        }
      }
    }
    const existing = await this.electivePoolRepo.find({ where: { studio_id: studioId } });
    let pools_created = 0;
    let pools_updated = 0;
    for (const d of drafts) {
      const prev = existing.find((p) => p.name === d.name || p.base_section === d.base_section);
      const pool = await this.upsertElectivePool(studioId, {
        id: prev?.id,
        name: d.name,
        base_section: d.base_section,
        member_sections: d.member_sections,
        subject_names: d.subject_names,
        weekly_hours_per_track: prev?.weekly_hours_per_track ?? 2,
      });
      if (prev) pools_updated++;
      else pools_created++;
      try {
        await this.syncElectivePoolGroup(studioId, pool.id);
      } catch {
        /* grup bağlama isteğe bağlı */
      }
    }
    await this.audit(studioId, userId, 'elective_pools.synced_from_catalog', {
      pools_created,
      pools_updated,
      grades: drafts.map((d) => d.grade),
    });
    return {
      pools_created,
      pools_updated,
      pool_names: drafts.map((d) => d.name),
    };
  }

  async seedElectiveFromTtkb(
    studioId: string,
    schoolId: string,
    userId: string,
    opts?: { replace_elective?: boolean; create_pools?: boolean },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const profile = parseSchoolProfile(settings.school_profile);
    const grades = gradesForSchoolType(profile.type);
    const yillik = await this.loadYillikWeeklyHours(grades, studio.academic_year);
    let rows = buildTtkbElectiveCatalogBySchoolType(profile.type, yillik);
    if (!rows.length) {
      throw new BadRequestException({
        code: 'TTKB_ELECTIVE_EMPTY',
        message:
          profile.type === 'ilkokul'
            ? 'İlkokulda seçmeli TTKB listesi yok.'
            : 'Seçmeli TTKB listesi üretilemedi. Kurulumda okul türünü kaydedin.',
      });
    }
    for (const r of rows) {
      if (r.source === 'ttkb') {
        const h = await this.appConfig.getDersSaati(r.subject_code, r.grade);
        if (h >= 1) r.weekly_hours = h;
      }
    }
    const subjectMap = mergeGradeCatalogToSubjects(rows);
    if (opts?.replace_elective) {
      await this.subjectRepo.delete({ studio_id: studioId, is_elective: true });
    }
    const existing = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const byCode = new Map(
      existing.map((s) => [(s.short_code ?? s.name).toLowerCase(), s]),
    );
    let created = 0;
    let updated = 0;
    for (const [, row] of subjectMap) {
      const prev = byCode.get(row.short_code.toLowerCase());
      if (prev) {
        await this.subjectRepo.save({
          ...prev,
          name: row.name,
          is_elective: true,
        });
        updated++;
      } else {
        await this.subjectRepo.save({
          studio_id: studioId,
          name: row.name,
          short_code: row.short_code,
          class_hours: row.class_hours,
          is_elective: true,
        });
        created++;
      }
    }
    const names = [...subjectMap.values()]
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b, 'tr'));
    settings.ttkb_elective_seed_at = new Date().toISOString();
    settings.elective_ttkb_names = names;
    studio.settings = settings;
    await this.studioRepo.save(studio);

    let pools_created = 0;
    let pools_updated = 0;
    let pool_names: string[] = [];
    if (opts?.create_pools !== false) {
      const pr = await this.syncElectivePoolsFromCatalog(studioId, schoolId, userId, {
        replace_pools: !!opts?.replace_elective,
        catalog_rows: rows,
      });
      pools_created = pr.pools_created;
      pools_updated = pr.pools_updated;
      pool_names = pr.pool_names;
    }

    await this.audit(studioId, userId, 'subjects.seeded_ttkb_elective', {
      created,
      updated,
      grades: grades.length,
      pools_created,
    });
    return {
      created,
      updated,
      grades: grades.length,
      subject_count: subjectMap.size,
      names,
      pools_created,
      pools_updated,
      pool_names,
    };
  }

  private catalogAssignmentKey(subjectId: string, sec: string) {
    return `${subjectId}\0${sec}`;
  }

  private async assignmentCatalogIndex(studioId: string) {
    const existing = await this.assignmentRepo.find({ where: { studio_id: studioId } });
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
    const byCatalog = new Map<string, DersDagitAssignment>();
    for (const a of existing) {
      if (!a.subject_id || (a.class_sections?.length ?? 0) !== 1) continue;
      const sec = a.class_sections[0]!;
      byCatalog.set(this.catalogAssignmentKey(a.subject_id, sec), a);
    }
    return { byCatalog, teachersByAssign };
  }

  private async syncSubjectCatalogRowsToAssignments(
    studioId: string,
    sub: DersDagitSubject,
    byCatalog: Map<string, DersDagitAssignment>,
    teachersByAssign: Map<string, string[]>,
  ) {
    let created = 0;
    let updated = 0;
    for (const [sec, hrs] of Object.entries(sub.class_hours ?? {})) {
      const h = Number(hrs);
      if (!sec || !h || h < 1) continue;
      const prev = byCatalog.get(this.catalogAssignmentKey(sub.id, sec));
      const payload = {
        subject_id: sub.id,
        subject_name: sub.name,
        class_sections: [sec],
        weekly_hours: h,
        min_days_per_week: defaultMinDaysFromWeeklyHours(h),
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
        const row = await this.upsertAssignment(studioId, {
          ...payload,
          room_ids: [],
          teacher_ids: [],
        });
        byCatalog.set(this.catalogAssignmentKey(sub.id, sec), row);
        created++;
      }
    }
    return { created, updated };
  }

  async syncOneSubjectToAssignments(studioId: string, subjectId: string, userId: string) {
    const sub = await this.subjectRepo.findOne({ where: { id: subjectId, studio_id: studioId } });
    if (!sub) throw new NotFoundException();
    const { byCatalog, teachersByAssign } = await this.assignmentCatalogIndex(studioId);
    const { created, updated } = await this.syncSubjectCatalogRowsToAssignments(
      studioId,
      sub,
      byCatalog,
      teachersByAssign,
    );
    await this.audit(studioId, userId, 'assignments.synced_from_catalog', { subject_id: subjectId, created, updated });
    return { created, updated };
  }

  async syncSubjectsToAssignments(studioId: string, userId: string, opts?: { replace?: boolean }) {
    const subjects = await this.subjectRepo.find({ where: { studio_id: studioId } });
    if (opts?.replace) {
      await this.assignmentRepo.delete({ studio_id: studioId });
    }
    const { byCatalog, teachersByAssign } = opts?.replace
      ? { byCatalog: new Map<string, DersDagitAssignment>(), teachersByAssign: new Map<string, string[]>() }
      : await this.assignmentCatalogIndex(studioId);

    let created = 0;
    let updated = 0;
    for (const sub of subjects) {
      const r = await this.syncSubjectCatalogRowsToAssignments(studioId, sub, byCatalog, teachersByAssign);
      created += r.created;
      updated += r.updated;
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

  private sharePath(token: string, section?: string | null) {
    const q = section?.trim() ? `?section=${encodeURIComponent(section.trim())}` : '';
    return `/ders-dagit-paylasim/${token}${q}`;
  }

  private async programShareSections(programId: string) {
    const rows = await this.programEntryRepo.find({
      where: { program_id: programId },
      select: ['class_section'],
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const s = r.class_section?.trim();
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return sortClassSections([...counts.keys()]).map((class_section) => ({
      class_section,
      lesson_count: counts.get(class_section) ?? 0,
    }));
  }

  async getProgramShareStatus(studioId: string, programId: string) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    const settings = parseProgramShareSettings(prog.share_settings);
    const sectionRows = await this.programShareSections(programId);
    const allSections = sectionRows.map((r) => r.class_section);
    const enabledSet = new Set(resolveShareEnabledSections(allSections, settings));
    const token = prog.share_token;
    return {
      share_active: !!token,
      share_token: token,
      base_path: token ? this.sharePath(token) : null,
      settings,
      sections: sectionRows.map((r) => ({
        ...r,
        enabled: enabledSet.has(r.class_section),
        path: token && enabledSet.has(r.class_section) ? this.sharePath(token, r.class_section) : null,
      })),
    };
  }

  async updateProgramShareSettings(
    studioId: string,
    programId: string,
    patch: { enabled_sections?: string[] | null },
  ) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    const sectionRows = await this.programShareSections(programId);
    const allSections = new Set(sectionRows.map((r) => r.class_section));
    let enabled_sections: string[] | null | undefined = patch.enabled_sections;
    if (enabled_sections != null) {
      const cleaned = sortClassSections(
        [...new Set(enabled_sections.map((s) => String(s).trim()).filter(Boolean))],
      );
      const unknown = cleaned.filter((s) => !allSections.has(s));
      if (unknown.length) {
        throw new BadRequestException({
          code: 'UNKNOWN_SECTION',
          message: `Programda olmayan şube: ${unknown.join(', ')}`,
        });
      }
      enabled_sections = cleaned.length === allSections.size ? null : cleaned;
    }
    const prev = parseProgramShareSettings(prog.share_settings);
    const next: ProgramShareSettings = {
      ...prev,
      ...(patch.enabled_sections !== undefined ? { enabled_sections } : {}),
    };
    await this.programRepo.update(programId, { share_settings: next });
    return this.getProgramShareStatus(studioId, programId);
  }

  async createProgramShareLink(studioId: string, programId: string, opts?: { class_section?: string | null }) {
    const prog = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!prog) throw new NotFoundException();
    const token = prog.share_token ?? randomBytes(24).toString('hex');
    const section = opts?.class_section?.trim();
    const settings = parseProgramShareSettings(prog.share_settings);
    const sectionRows = await this.programShareSections(programId);
    const allSections = sectionRows.map((r) => r.class_section);
    if (section && !allSections.includes(section)) {
      throw new BadRequestException({ code: 'NO_SECTION', message: 'Bu şubede program satırı yok.' });
    }
    let nextSettings = settings;
    if (section && !isSectionShareEnabled(section, allSections, settings)) {
      const enabled = resolveShareEnabledSections(allSections, settings);
      nextSettings = {
        enabled_sections: sortClassSections([...new Set([...enabled, section])]),
      };
      if (nextSettings.enabled_sections!.length === allSections.length) {
        nextSettings = { enabled_sections: null };
      }
    }
    await this.programRepo.update(programId, {
      share_token: token,
      share_settings: nextSettings,
    });
    return {
      share_token: token,
      path: this.sharePath(token, section),
      class_section: section ?? null,
    };
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
      select: ['id', 'name', 'academic_year', 'school_id', 'settings'],
    });
    const school = studio?.school_id
      ? await this.schoolRepo.findOne({
          where: { id: studio.school_id },
          select: ['id', 'name'],
        })
      : null;
    const rs = parseStudioReportSettings((studio?.settings ?? {}) as Record<string, unknown>);
    const schoolName =
      rs.meta.school_name?.trim() || school?.name?.trim() || studio?.name?.trim() || 'Okul';
    const allSections = sortClassSections([...new Set(entries.map((e) => e.class_section))]);
    const settings = parseProgramShareSettings(program.share_settings);
    const visibleSections = resolveShareEnabledSections(allSections, settings);
    if (!visibleSections.length) return null;
    const sec = classSection?.trim();
    if (sec && !visibleSections.includes(sec)) return null;
    const filtered = sec
      ? entries.filter((e) => e.class_section === sec)
      : entries.filter((e) => visibleSections.includes(e.class_section));
    const activeSection = sec ?? visibleSections[0] ?? null;

    const userIds = [...new Set(filtered.map((e) => e.user_id).filter(Boolean))] as string[];
    const roomIds = [...new Set(filtered.map((e) => e.room_id).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({
            where: { id: In(userIds) },
            select: ['id', 'display_name', 'email'],
          })
        : [];
    const rooms = roomIds.length > 0 ? await this.roomRepo.find({ where: { id: In(roomIds) } }) : [];
    const userMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || u.id.slice(0, 8)]));
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));

    const teacherCount = new Set(filtered.map((e) => e.user_id).filter(Boolean)).size;
    const subjectCount = new Set(filtered.map((e) => e.subject)).size;

    return {
      program: {
        id: program.id,
        name: program.name,
        score: program.score,
        academic_year: rs.meta.academic_year?.trim() || studio?.academic_year || null,
        studio_name: studio?.name ?? null,
        updated_at: program.updated_at.toISOString(),
        version: program.version,
      },
      meta: {
        school_name: schoolName,
        document_title: rs.texts.title?.trim() || 'Haftalık Ders Programı',
        academic_year: rs.meta.academic_year?.trim() || studio?.academic_year || null,
        published_label: program.updated_at.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      },
      class_sections: visibleSections,
      class_section: activeSection,
      stats: {
        lesson_count: filtered.length,
        teacher_count: teacherCount,
        subject_count: subjectCount,
        section_count: visibleSections.length,
      },
      entries: filtered.map((e) => ({
        day_of_week: e.day_of_week,
        lesson_num: e.lesson_num,
        class_section: e.class_section,
        subject: e.subject,
        teacher_label: e.user_id ? userMap.get(e.user_id) ?? null : null,
        room_name: e.room_id ? roomMap.get(e.room_id) ?? null : null,
      })),
    };
  }

  async exportTeacherNotificationPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    theme?: string | null,
    teacherFilter?: string | null,
  ): Promise<Uint8Array> {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const [school, studio, rows, configs] = await Promise.all([
      this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name'] }),
      this.studioRepo.findOne({ where: { id: studioId }, select: ['academic_year', 'settings'] }),
      this.buildExportRows(programId, studioId),
      this.listTeacherConfigs(studioId),
    ]);
    const rs = parseStudioReportSettings((studio?.settings ?? {}) as Record<string, unknown>);
    const schoolLabel =
      rs.meta.school_name?.trim() || rs.texts.title?.trim() || school?.name?.trim() || 'Okul';
    const year = rs.meta.academic_year?.trim() || studio?.academic_year || null;
    const settings = (studio?.settings ?? {}) as Record<string, unknown>;
    const workDays = Array.isArray(settings.work_days)
      ? (settings.work_days as number[])
      : [1, 2, 3, 4, 5];
    const branchByKey = new Map<string, string | null>();
    const displayByKey = new Map<string, string>();
    for (const c of configs) {
      const br = c.branch?.trim() || null;
      const name = c.display_name?.trim();
      branchByKey.set(c.user_id, br);
      if (name) {
        displayByKey.set(c.user_id, name);
        branchByKey.set(name, br);
      }
    }
    const { humanizeProgramLabel } = await import('./ders-dagit-notification-texts');
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    header.academic_year = year;
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildTeacherNotificationPdf(
      header,
      rows,
      {
        notification_title: rs.texts.notification_title,
        notification_subject: rs.texts.notification_subject,
        notification_ref: rs.texts.notification_ref,
        notification_body: rs.texts.notification_body,
        notification_acknowledgement: rs.texts.notification_acknowledgement,
        teacher_signature_label: rs.texts.teacher_signature_label,
        principal_signature_label: rs.texts.principal_signature_label,
        principal_name: rs.meta.principal_name,
        footer_note: rs.texts.footer_note,
      },
      {
        school_name: schoolLabel,
        academic_year: year,
        program_name: humanizeProgramLabel(program.name, year),
        principal_name: rs.meta.principal_name,
        teacher_filter: teacherFilter,
        branch_by_key: branchByKey,
        display_by_key: displayByKey,
      },
      parsePdfTheme(theme),
      workDays,
    );
  }

  private councilReportOpts(
    programId: string,
    studioId: string,
    schoolId: string,
  ): Promise<{
    program: { name: string | null; score: number | null; generation_meta: unknown };
    rs: ReturnType<typeof parseStudioReportSettings>;
    schoolLabel: string;
    year: string | null;
    rows: EokulExportRow[];
  }> {
    return (async () => {
      const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
      if (!program) throw new NotFoundException();
      const [school, studio, rows] = await Promise.all([
        this.schoolRepo.findOne({ where: { id: schoolId }, select: ['id', 'name'] }),
        this.studioRepo.findOne({ where: { id: studioId }, select: ['academic_year', 'settings'] }),
        this.buildExportRows(programId, studioId),
      ]);
      const rs = parseStudioReportSettings((studio?.settings ?? {}) as Record<string, unknown>);
      const schoolLabel =
        rs.meta.school_name?.trim() || rs.texts.title?.trim() || school?.name?.trim() || 'Okul';
      const year = rs.meta.academic_year?.trim() || studio?.academic_year || null;
      return { program, rs, schoolLabel, year, rows };
    })();
  }

  async exportCoverPdf(programId: string, studioId: string, schoolId: string, theme?: string | null) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const studio = await this.studioRepo.findOne({ where: { id: studioId }, select: ['settings'] });
    const rs = parseStudioReportSettings((studio?.settings ?? {}) as Record<string, unknown>);
    const coverHeader: PdfHeaderInfo = {
      ...header,
      document_title: rs.texts.title?.trim() || 'HAFTALIK DERS PROGRAMI',
      subtitle: rs.texts.subtitle?.trim() || program.name || header.subtitle,
    };
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildCoverPdf(
      coverHeader,
      {
        address: rs.meta.address,
        phone: rs.meta.phone,
        principal_name: rs.meta.principal_name,
      },
      parsePdfTheme(theme),
    );
  }

  async exportApprovalPdf(programId: string, studioId: string, schoolId: string, theme?: string | null) {
    const { program, rs, schoolLabel, year } = await this.councilReportOpts(programId, studioId, schoolId);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildApprovalPdf(
      {
        school_name: schoolLabel,
        program_name: program.name ?? 'Ders Dağıtım Programı',
        academic_year: year,
        approval_text: rs.texts.approval_text,
        principal_name: rs.meta.principal_name,
        principal_signature_label: rs.texts.principal_signature_label,
        footer_note: rs.texts.footer_note,
      },
      parsePdfTheme(theme),
    );
  }

  async exportCouncilPdf(programId: string, studioId: string, schoolId: string, theme?: string | null) {
    const { program, rs, schoolLabel, year, rows } = await this.councilReportOpts(
      programId,
      studioId,
      schoolId,
    );
    const byClass = new Map<string, number>();
    const participantSet = new Set<string>();
    for (const r of rows) {
      byClass.set(r.class_section, (byClass.get(r.class_section) ?? 0) + 1);
      const tl = r.teacher_label?.trim();
      if (tl) participantSet.add(tl);
    }
    const teachers = new Set(rows.map((r) => r.user_id).filter(Boolean));
    const participants = [...participantSet].sort((a, b) => a.localeCompare(b, 'tr'));
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildCouncilPdf(
      {
        school_name: schoolLabel,
        program_name: program.name ?? 'Ders Dağıtım Programı',
        academic_year: year,
        entry_count: rows.length,
        class_count: byClass.size,
        teacher_count: teachers.size,
        participants,
        by_class: [...byClass.entries()]
          .map(([section, weekly_slots]) => ({ section, weekly_slots }))
          .sort((a, b) => compareClassSections(a.section, b.section)),
        meeting_place: rs.texts.council_meeting_place,
        meeting_topic: rs.texts.council_meeting_topic,
        agenda_text: rs.texts.council_agenda,
        approval_text: rs.texts.approval_text,
        principal_name: rs.meta.principal_name,
        principal_signature_label: rs.texts.principal_signature_label,
        footer_note: rs.texts.footer_note,
        address: rs.meta.address,
        phone: rs.meta.phone,
      },
      parsePdfTheme(theme),
    );
  }

  async exportParentClassPdf(
    programId: string,
    studioId: string,
    schoolId: string,
    classSection: string,
    theme?: string | null,
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
    const header = await this.buildPdfHeader(programId, studioId, schoolId, program.name);
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildParentClassPdf(header, sec, rows, parsePdfTheme(theme));
  }

  async exportPublicParentPdf(token: string, classSection?: string, theme?: string | null) {
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
    const header = {
      school_name: data.program.studio_name ?? 'Okul',
      document_title: 'HAFTALIK DERS PROGRAMI',
      subtitle: null as string | null,
      academic_year: data.program.academic_year ?? null,
      program_name: data.program.name ?? null,
      footer_note: null as string | null,
    };
    const { parsePdfTheme } = await import('./ders-dagit-pdf-layout');
    return this.pdfService.buildParentClassPdf(header, sec, rows, parsePdfTheme(theme));
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
    const names = name?.trim() ? [name.trim()] : [];
    const { user_ids, warnings } = resolveImportedTeacherIds(teachers, tc, names);
    return {
      user_id: user_ids[0] ?? null,
      warning: warnings[0],
    };
  }

  private async findOrCreateBuildingByName(schoolId: string, name: string) {
    const trimmed = name.trim();
    const existing = await this.buildingRepo.find({ where: { school_id: schoolId } });
    const hit = existing.find((b) => b.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'));
    if (hit) return hit;
    return this.upsertBuilding(schoolId, { name: trimmed });
  }

  private async findOrCreateRoomFromAsc(schoolId: string, draft: AscRoomDraft, buildingId: string | null) {
    const existing = await this.roomRepo.find({ where: { school_id: schoolId } });
    const hit = existing.find((r) => r.name.toLocaleLowerCase('tr-TR') === draft.name.toLocaleLowerCase('tr-TR'));
    if (hit) {
      const patch: Partial<DersDagitRoom> = {};
      if (buildingId && !hit.building_id) patch.building_id = buildingId;
      if (draft.capacity != null && hit.capacity == null) patch.capacity = draft.capacity;
      if (Object.keys(patch).length) return this.roomRepo.save({ ...hit, ...patch });
      return hit;
    }
    return this.upsertRoom(schoolId, {
      name: draft.name,
      building_id: buildingId,
      capacity: draft.capacity ?? null,
      features: [],
    });
  }

  private findSectionScheduleKey(map: Map<string, SectionScheduleConfig>, sectionName: string): string {
    if (map.has(sectionName)) return sectionName;
    for (const k of map.keys()) {
      if (sectionsEquivalent(k, sectionName)) return k;
    }
    return sectionName;
  }

  private async ensureTeacherConfig(studioId: string, userId: string) {
    let cfg = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: userId } });
    if (!cfg) {
      cfg = await this.teacherConfigRepo.save({ studio_id: studioId, user_id: userId, constraints: {} });
    }
    return cfg;
  }

  private async applyAscImportInfrastructure(
    studioId: string,
    schoolId: string,
    asc: AscImportExtras,
    teachers: User[],
    replace: boolean,
    usedGroupAscIds: Set<string>,
    assignmentSections: string[] = [],
  ): Promise<{ roomIdByAsc: Map<string, string>; groupIdByAsc: Map<string, string>; profiles_created: number }> {
    const roomIdByAsc = new Map<string, string>();
    const groupIdByAsc = new Map<string, string>();
    const buildingIdByAsc = new Map<string, string>();

    for (const b of asc.buildings) {
      const row = await this.findOrCreateBuildingByName(schoolId, b.name);
      buildingIdByAsc.set(b.asc_id, row.id);
    }

    for (const r of asc.rooms) {
      const buildingId =
        (r.building_asc_id && buildingIdByAsc.get(r.building_asc_id)) ||
        (r.building_name ? (await this.findOrCreateBuildingByName(schoolId, r.building_name)).id : null);
      const row = await this.findOrCreateRoomFromAsc(schoolId, r, buildingId ?? null);
      roomIdByAsc.set(r.asc_id, row.id);
    }

    for (const c of asc.classes) {
      for (const rid of c.classroom_asc_ids) {
        const roomUuid = roomIdByAsc.get(rid);
        if (!roomUuid) continue;
        const room = await this.roomRepo.findOne({ where: { id: roomUuid, school_id: schoolId } });
        if (!room) continue;
        const allowed = [...new Set([...(room.allowed_class_sections ?? []), c.name])];
        await this.roomRepo.save({ ...room, allowed_class_sections: allowed });
      }
    }

    for (const tName of Object.values(asc.teacher_by_id)) {
      const user = findTeacherByImportedName(teachers, tName);
      if (user) await this.ensureTeacherConfig(studioId, user.id);
    }
    for (const ascId of Object.keys(asc.teacher_match_names ?? {})) {
      const user = this.findTeacherByAscMeta(teachers, ascId, asc);
      if (user) await this.ensureTeacherConfig(studioId, user.id);
    }

    const existingGroups = await this.groupRepo.find({ where: { studio_id: studioId } });
    const groupByAsc = new Map(existingGroups.map((g) => [g.name, g]));
    for (const g of asc.groups) {
      if (!usedGroupAscIds.has(g.asc_id)) continue;
      const memberSection = asc.class_by_id[g.class_asc_id];
      if (!memberSection) continue;
      const displayName =
        g.entire_class && /bütün|butun|tüm|tum/i.test(g.name) ? memberSection : `${memberSection} · ${g.name}`;
      const saved = await this.upsertGroup(studioId, {
        name: displayName,
        abbreviation: displayName.replace(/\s+/g, '').slice(0, 8),
        member_sections: [memberSection],
        // aSc grupları tek şube içinde (Group 1/2, Kız/Erkek); subgroups en az 2 şube ister
        parallel_mode: 'teacher_multi_class',
      });
      groupIdByAsc.set(g.asc_id, saved.id);
      groupByAsc.set(displayName, saved);
    }

    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (studio) {
      const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
      const schedMap = new Map<string, SectionScheduleConfig>();
      for (const c of asc.classes) {
        schedMap.set(c.name, { lessons_per_day_by_dow: {}, cells: {} });
      }

      if (asc.timeoffs.length) {
        const teacherPeriods = new Map<string, Array<{ day_of_week: number; lesson_num?: number }>>();
        for (const to of asc.timeoffs) {
          if (to.entity === 'teacher') {
            const tName = asc.teacher_by_id[to.asc_id];
            if (!tName) continue;
            const user = this.findTeacherByAscMeta(teachers, to.asc_id, asc) ?? findTeacherByImportedName(teachers, tName);
            if (!user) continue;
            await this.ensureTeacherConfig(studioId, user.id);
            const arr = teacherPeriods.get(user.id) ?? [];
            if (to.lesson_num) {
              arr.push({ day_of_week: to.day_of_week, lesson_num: to.lesson_num });
            } else {
              for (let l = 1; l <= 14; l++) arr.push({ day_of_week: to.day_of_week, lesson_num: l });
            }
            teacherPeriods.set(user.id, arr);
          } else if (to.entity === 'class') {
            const secRaw = asc.class_by_id[to.asc_id];
            if (!secRaw) continue;
            const secKey = this.findSectionScheduleKey(schedMap, secRaw);
            const sched = schedMap.get(secKey) ?? { lessons_per_day_by_dow: {}, cells: {} };
            const cells = { ...(sched.cells ?? {}) };
            if (to.lesson_num) {
              cells[`${to.day_of_week}:${to.lesson_num}`] = 'closed';
            } else {
              for (let l = 1; l <= 14; l++) cells[`${to.day_of_week}:${l}`] = 'closed';
            }
            schedMap.set(secKey, { ...sched, cells });
          }
        }
        for (const [userId, periods] of teacherPeriods) {
          const cfg = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: userId } });
          if (!cfg) continue;
          const merged = normalizeAvailabilityPeriods([...(cfg.unavailable_periods ?? []), ...periods]);
          await this.teacherConfigRepo.save({ ...cfg, unavailable_periods: merged });
        }
      }

      const period = parseStudioPeriod(settings.period);
      const workDays = period.work_days?.length ? period.work_days : [1, 2, 3, 4, 5];
      this.applyAscSectionScheduleCaps(schedMap, asc, workDays);

      settings.section_schedules = sectionSchedulesToJson(schedMap);
      studio.settings = settings;
      await this.studioRepo.save(studio);
    }

    const profiles_created = await this.ensureClassProfilesFromAscImport(
      studioId,
      schoolId,
      asc,
      assignmentSections ?? [],
    );
    if (profiles_created) {
      this.sectionPoolCache.delete(`${studioId}:${schoolId}`);
      this.invalidateValidationResultCache(studioId);
    }

    return { roomIdByAsc, groupIdByAsc, profiles_created };
  }

  /** aSc `<class>` ve atama şubelerinden kurulum profili (1 şube = 1 profil). */
  private async ensureClassProfilesFromAscImport(
    studioId: string,
    schoolId: string,
    asc: AscImportExtras,
    assignmentSections: string[],
  ): Promise<number> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) return 0;

    const schoolType = parseSchoolProfile((studio.settings ?? {}).school_profile).type as MebSchoolType;
    const school = await this.schoolRepo.findOne({ where: { id: schoolId }, select: ['duty_max_lessons'] });
    const dutyMax = school?.duty_max_lessons ?? null;
    const maxDayDefault = defaultMaxLessonsPerDay(schoolType, dutyMax);

    const sectionNames = sortClassSections(
      [...new Set([
        ...asc.classes.map((c) => c.name.trim()).filter(Boolean),
        ...assignmentSections.map((s) => s.trim()).filter(Boolean),
      ])].filter((s) => s && s !== 'Genel'),
    );
    if (!sectionNames.length) return 0;

    const existing = await this.classProfileRepo.find({ where: { studio_id: studioId } });
    const covered = new Set<string>();
    for (const p of existing) {
      for (const s of p.class_sections ?? []) {
        if (s?.trim()) covered.add(s.trim());
      }
    }

    let created = 0;
    let sortOrder =
      existing.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1) + 1;
    const newSections: string[] = [];

    for (const sec of sectionNames) {
      if ([...covered].some((x) => sectionsEquivalent(x, sec))) continue;
      const fromAsc = asc.section_weekly_hours?.[sec];
      const weeklyExpected =
        fromAsc && fromAsc > 0 ? fromAsc : expectedWeeklyHoursForSections([sec], schoolType);
      const maxDayFromHours = Math.min(
        maxDayDefault,
        Math.max(1, Math.ceil(weeklyExpected / 5)),
      );
      await this.classProfileRepo.save({
        studio_id: studioId,
        name: sec,
        class_sections: [sec],
        max_lessons_per_day: maxDayFromHours,
        max_weekly_lessons: weeklyExpected,
        min_weekly_lessons: Math.max(1, weeklyExpected - 4),
        internship_days: [],
        sort_order: sortOrder++,
      });
      covered.add(sec);
      newSections.push(sec);
      created++;
    }

    if (newSections.length) {
      await this.applyProfileToSectionSchedules(studio, newSections);
    }
    return created;
  }

  private resolveAscTeacherNames(a: { teacher_name?: string | null; teacher_names?: string[] }): string[] {
    if (a.teacher_names?.length) return a.teacher_names.map((n) => n.trim()).filter(Boolean);
    return a.teacher_name?.trim() ? [a.teacher_name.trim()] : [];
  }

  private resolveAscTeacherIds(
    teachers: User[],
    a: {
      teacher_tc?: string | null;
      teacher_name?: string | null;
      teacher_names?: string[];
      teacher_asc_ids?: string[];
    },
    asc: AscImportExtras,
  ) {
    return resolveImportedTeacherIdsWithAsc(
      teachers,
      a.teacher_tc ?? null,
      this.resolveAscTeacherNames(a),
      a.teacher_asc_ids ?? [],
      asc.teacher_match_names ?? {},
      asc.teacher_meta_by_id ?? {},
    );
  }

  private findTeacherByAscMeta(
    teachers: User[],
    ascId: string,
    asc: AscImportExtras,
  ): User | null {
    for (const name of asc.teacher_match_names?.[ascId] ?? []) {
      const hit = findTeacherByImportedName(teachers, name);
      if (hit) return hit;
    }
    const fallback = asc.teacher_by_id[ascId];
    return fallback ? findTeacherByImportedName(teachers, fallback) : null;
  }

  private async clearStudioProgramsForImport(studioId: string) {
    const progs = await this.programRepo.find({ where: { studio_id: studioId }, select: ['id'] });
    if (!progs.length) return;
    await this.programEntryRepo.delete({ program_id: In(progs.map((p) => p.id)) });
    await this.programRepo.delete({ studio_id: studioId });
  }

  private async clearStudioForTransferImport(
    studioId: string,
    schoolId: string,
    opts?: { deleteRooms?: boolean },
  ) {
    await this.clearStudioProgramsForImport(studioId);
    await this.clearStudioAssignmentsForImport(studioId, { subjects: true });
    await this.groupRepo.delete({ studio_id: studioId });
    await this.electivePoolRepo.delete({ studio_id: studioId });
    await this.classProfileRepo.delete({ studio_id: studioId });
    await this.preferenceRepo.delete({ studio_id: studioId });
    await this.requestRepo.delete({ studio_id: studioId });
    await this.jobRepo.delete({ studio_id: studioId });
    const configs = await this.teacherConfigRepo.find({ where: { studio_id: studioId } });
    for (const cfg of configs) {
      await this.teacherConfigRepo.save({ ...cfg, unavailable_periods: [] });
    }
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (studio) {
      const settings = { ...(studio.settings ?? {}) } as Record<string, unknown>;
      settings.section_schedules = {};
      settings.excluded_class_sections = [];
      studio.settings = settings;
      await this.studioRepo.save(studio);
    }
    if (opts?.deleteRooms) {
      await this.deleteAllRooms(schoolId);
    }
    this.sectionPoolCache.delete(`${studioId}:${schoolId}`);
    this.invalidateValidationResultCache(studioId);
  }

  /** @deprecated use clearStudioForTransferImport */
  private async clearStudioForAscImport(studioId: string, schoolId: string) {
    await this.clearStudioForTransferImport(studioId, schoolId, { deleteRooms: true });
  }

  /** aSc şube slotları: timeoff sonrası ders sırası üst sınırı + günlük tavan */
  private applyAscSectionScheduleCaps(
    schedMap: Map<string, SectionScheduleConfig>,
    asc: AscImportExtras,
    workDays: number[] = [1, 2, 3, 4, 5],
  ) {
    const maxPeriod = Math.max(1, Math.min(14, asc.max_period_count || 8));
    const allSections = sortClassSections([
      ...asc.classes.map((c) => c.name),
      ...Object.keys(asc.section_weekly_hours ?? {}),
    ]);
    for (const secRaw of allSections) {
      const secKey = this.findSectionScheduleKey(schedMap, secRaw);
      const sched = schedMap.get(secKey) ?? { lessons_per_day_by_dow: {}, cells: {} };
      const cells = { ...(sched.cells ?? {}) };
      for (const d of [1, 2, 3, 4, 5, 6, 7]) {
        for (let l = maxPeriod + 1; l <= 14; l++) {
          cells[`${d}:${l}`] = 'closed';
        }
      }
      const weekly = asc.section_weekly_hours?.[secRaw] ?? asc.section_weekly_hours?.[secKey] ?? 0;
      const lessons_per_day_by_dow = { ...(sched.lessons_per_day_by_dow ?? {}) };
      if (weekly > 0) {
        const perDay = Math.min(maxPeriod, Math.max(1, Math.ceil(weekly / Math.max(1, workDays.length))));
        for (const d of workDays) {
          lessons_per_day_by_dow[String(d)] = perDay;
        }
      }
      schedMap.set(secKey, {
        ...sched,
        lessons_per_day_by_dow,
        cells: Object.keys(cells).length ? cells : undefined,
      });
    }
  }

  private async ensureSubjectsFromAscCatalog(studioId: string, subjectById: Record<string, string>) {
    for (const name of Object.values(subjectById)) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      await this.upsertSubject(studioId, { name: trimmed, is_elective: false, class_hours: {} });
    }
  }

  private async clearStudioAssignmentsForImport(studioId: string, opts?: { subjects?: boolean }) {
    const existing = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
    if (existing.length) {
      await this.assignmentTeacherRepo.delete({ assignment_id: In(existing.map((a) => a.id)) });
      await this.assignmentRepo.delete({ studio_id: studioId });
    }
    if (opts?.subjects) {
      await this.subjectRepo.delete({ studio_id: studioId });
    }
    this.invalidateValidationResultCache(studioId);
  }

  private async ensureSubjectsForImportedNames(
    studioId: string,
    rows: Array<{ subject_name: string; class_sections: string[]; weekly_hours: number }>,
  ) {
    const existing = await this.subjectRepo.find({ where: { studio_id: studioId } });
    const byName = new Map(existing.map((s) => [s.name.toLocaleLowerCase('tr-TR'), s]));
    for (const row of rows) {
      const name = row.subject_name.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase('tr-TR');
      if (byName.has(key)) continue;
      const class_hours: Record<string, number> = {};
      for (const sec of row.class_sections ?? []) {
        const t = sec.trim();
        if (t) class_hours[t] = row.weekly_hours;
      }
      const sub = await this.upsertSubject(studioId, {
        name,
        is_elective: false,
        class_hours,
      });
      byName.set(key, sub);
    }
    const assignments = await this.assignmentRepo.find({ where: { studio_id: studioId } });
    for (const a of assignments) {
      if (a.subject_id) continue;
      const key = (a.subject_name ?? '').toLocaleLowerCase('tr-TR');
      const sub = byName.get(key);
      if (sub) await this.assignmentRepo.save({ ...a, subject_id: sub.id });
    }
  }

  private async persistImportedAssignmentRows(
    studioId: string,
    rows: Array<
      EokulAssignmentDraft & {
        resolved_teacher_ids?: string[];
        resolved_teacher_id?: string | null;
        room_asc_ids?: string[];
        group_asc_id?: string | null;
        day_distribution?: number[];
        periods_per_card?: number;
      }
    >,
    roomIdByAsc?: Map<string, string>,
    groupIdByAsc?: Map<string, string>,
  ): Promise<number> {
    const merge = new Map<
      string,
      {
        subject_name: string;
        class_sections: string[];
        weekly_hours: number;
        teacher_ids: string[];
        teacher_names: string[];
        room_ids: string[];
        group_id?: string | null;
        day_distribution?: number[];
        periods_per_card?: number;
      }
    >();
    for (const r of rows) {
      const secs = sortClassSections(r.class_sections).join(',');
      const teacherIds =
        r.resolved_teacher_ids ??
        (r.resolved_teacher_id ? [r.resolved_teacher_id] : []);
      const teacherNames = [
        ...new Set(
          (r.teacher_name?.trim() ? [r.teacher_name.trim()] : []).filter(Boolean),
        ),
      ];
      const roomIds = [...new Set((r.room_asc_ids ?? []).map((id) => roomIdByAsc?.get(id)).filter(Boolean))] as string[];
      const groupId = r.group_asc_id ? (groupIdByAsc?.get(r.group_asc_id) ?? null) : null;
      const tid = teacherIds.join('|');
      const rid = roomIds.join('|');
      const gid = groupId ?? '';
      const k = `${r.subject_name}\0${secs}\0${tid}\0${rid}\0${gid}`;
      const prev = merge.get(k);
      if (prev) {
        prev.weekly_hours = Math.max(prev.weekly_hours, r.weekly_hours);
        if (r.day_distribution?.length) {
          prev.day_distribution = [...(prev.day_distribution ?? []), ...r.day_distribution];
          prev.weekly_hours = prev.day_distribution.reduce((s, n) => s + n, 0);
        }
        prev.periods_per_card = Math.max(prev.periods_per_card ?? 1, r.periods_per_card ?? 1);
        prev.teacher_names = [...new Set([...prev.teacher_names, ...teacherNames])];
      } else {
        merge.set(k, {
          subject_name: r.subject_name,
          class_sections: r.class_sections,
          weekly_hours: r.weekly_hours,
          teacher_ids: teacherIds,
          teacher_names: teacherNames,
          room_ids: roomIds,
          group_id: groupId,
          day_distribution: r.day_distribution,
          periods_per_card: r.periods_per_card,
        });
      }
    }
    let imported = 0;
    for (const row of merge.values()) {
      const dist =
        row.day_distribution?.length &&
        isValidDayDistribution(row.day_distribution, row.weekly_hours)
          ? row.day_distribution
          : null;
      const hints = dist ? distributionToPlacementHints(dist) : null;
      const blockLessons = hints?.block_lessons ?? (row.periods_per_card && row.periods_per_card >= 2 ? row.periods_per_card : 0);
      const importOpts =
        row.teacher_ids.length === 0 && row.teacher_names.length
          ? { asc_import_teachers: row.teacher_names }
          : {};
      await this.upsertAssignment(
        studioId,
        {
          subject_name: row.subject_name,
          class_sections: row.class_sections,
          weekly_hours: row.weekly_hours,
          teacher_ids: row.teacher_ids,
          max_per_day: hints?.max_per_day ?? Math.min(6, row.weekly_hours),
          min_days_per_week: hints?.min_days_per_week ?? defaultMinDaysFromWeeklyHours(row.weekly_hours),
          room_ids: row.room_ids,
          group_id: row.group_id ?? undefined,
          options:
            dist || blockLessons >= 2 || Object.keys(importOpts).length
              ? {
                  ...(dist ? { day_distribution: dist } : {}),
                  ...(blockLessons >= 2 ? { block_lessons: blockLessons } : {}),
                  ...importOpts,
                }
              : undefined,
        },
        { skip_capacity_check: true },
      );
      imported++;
    }
    await this.ensureSubjectsForImportedNames(studioId, [...merge.values()]);
    return imported;
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
      const names = a.teacher_name?.trim() ? [a.teacher_name.trim()] : [];
      const resolved = resolveImportedTeacherIds(teachers, a.teacher_tc, names);
      return {
        ...a,
        resolved_teacher_id: resolved.user_ids[0] ?? null,
        resolved_teacher_ids: resolved.user_ids,
        match_warning: resolved.warnings[0] ?? null,
      };
    });
    const unmatched = rows.filter(
      (r) => (r.teacher_tc || r.teacher_name) && !(r.resolved_teacher_ids?.length || r.resolved_teacher_id),
    ).length;
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
      await this.clearStudioAssignmentsForImport(studioId, { subjects: true });
    }
    const imported = await this.persistImportedAssignmentRows(studioId, preview.rows);
    let elective_pools_created = 0;
    if (body.auto_elective_groups) {
      const pools = await this.ensureElectivePoolsFromImport(studioId, preview.rows);
      elective_pools_created = pools.length;
      await this.linkElectiveAssignmentsToPools(studioId, pools);
    }
    await this.audit(studioId, userId, 'assignments.imported_eokul', {
      format: preview.format,
      count: imported,
      replace: !!body.replace,
      elective_pools: elective_pools_created,
    });
    return {
      imported,
      format: preview.format,
      warnings: preview.warnings,
      rows_previewed: preview.rows.length,
      elective_pools_created,
    };
  }

  eokulImportTemplateXlsx(): Buffer {
    return buildEokulImportTemplateXlsx();
  }

  getTransferFormats() {
    return { formats: TRANSFER_FORMAT_CATALOG, package_version: STUDIO_TRANSFER_VERSION };
  }

  async exportStudioTransferPackage(studioId: string, schoolId: string): Promise<StudioTransferPackageV1> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const settings = (studio.settings ?? {}) as Record<string, unknown>;
    const [
      subjects,
      assignments,
      groups,
      pools,
      profiles,
      programCount,
      roomRows,
      buildings,
    ] = await Promise.all([
      this.subjectRepo.find({ where: { studio_id: studioId } }),
      this.assignmentRepo.find({ where: { studio_id: studioId } }),
      this.groupRepo.find({ where: { studio_id: studioId } }),
      this.electivePoolRepo.find({ where: { studio_id: studioId } }),
      this.classProfileRepo.find({ where: { studio_id: studioId } }),
      this.programRepo.count({ where: { studio_id: studioId } }),
      this.listRooms(schoolId),
      this.listBuildings(schoolId),
    ]);
    const assignIds = assignments.map((a) => a.id);
    const teacherLinks = assignIds.length
      ? await this.assignmentTeacherRepo.find({ where: { assignment_id: In(assignIds) } })
      : [];
    const teachersByAssign = new Map<string, string[]>();
    for (const l of teacherLinks) {
      const arr = teachersByAssign.get(l.assignment_id) ?? [];
      arr.push(l.user_id);
      teachersByAssign.set(l.assignment_id, arr);
    }
    const buildingName = new Map(buildings.map((b) => [b.id, b.name]));
    const rooms: StudioTransferPackageV1['rooms'] = roomRows.map((r) => ({
      building_name: r.building_id ? (buildingName.get(r.building_id) ?? '') : '',
      name: r.name,
    }));
    return {
      format: 'ogretmenpro_studio_v1',
      version: STUDIO_TRANSFER_VERSION,
      exported_at: new Date().toISOString(),
      studio: { title: studio.name ?? undefined, academic_year: studio.academic_year },
      school_profile: settings.school_profile ?? null,
      periods: settings.period_config ?? null,
      section_schedules: settings.section_schedules ?? null,
      dual_education: settings.dual_education ?? null,
      report_settings: settings.report_settings ?? null,
      subjects: subjects.map((s) => ({
        name: s.name,
        short_code: s.short_code,
        is_elective: s.is_elective,
        class_hours: s.class_hours ?? {},
      })),
      assignments: assignments.map((a) => ({
        subject_name: a.subject_name,
        class_sections: a.class_sections ?? [],
        weekly_hours: a.weekly_hours,
        teacher_ids: teachersByAssign.get(a.id) ?? [],
        room_ids: a.room_ids ?? [],
        group_id: a.group_id,
      })),
      groups: groups.map((g) => ({
        name: g.name,
        abbreviation: g.abbreviation,
        parallel_mode: g.parallel_mode,
        member_sections: g.member_sections ?? [],
      })),
      elective_pools: pools.map((p) => ({
        name: p.name,
        base_section: p.base_section,
        member_sections: p.member_sections ?? [],
        subject_names: p.subject_names ?? [],
        weekly_hours_per_track: p.weekly_hours_per_track,
      })),
      class_profiles: profiles,
      rooms,
      counts: {
        programs: programCount,
        assignments: assignments.length,
        subjects: subjects.length,
      },
    };
  }

  async previewStudioTransferImport(
    studioId: string,
    schoolId: string,
    body: {
      format: string;
      file_base64?: string;
      eokul_format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
    },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    if (!body.file_base64?.trim()) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Dosya gerekli.' });
    }
    const buffer = Buffer.from(body.file_base64, 'base64');
    const sniffed = sniffTransferImportFormat(buffer);
    const format = resolveTransferImportFormat(body.format, sniffed);
    const formatAutoCorrected = sniffed != null && format !== body.format;
    if (format === 'asc_xml') {
      const parsed = parseAscTimetablesXml(buffer);
      const teachers = await this.listSchoolTeachers(schoolId);
      const rows = parsed.assignments.map((a) => {
        const resolved = this.resolveAscTeacherIds(teachers, a, parsed.asc);
        return {
          ...a,
          resolved_teacher_id: resolved.user_ids[0] ?? null,
          resolved_teacher_ids: resolved.user_ids,
          match_warning: resolved.warnings[0] ?? null,
        };
      });
      const unmatched = rows.filter((r) => {
        const a = r as typeof parsed.assignments[number] & typeof r;
        return (
          (a.teacher_tc ||
            this.resolveAscTeacherNames(a).length ||
            (a.teacher_asc_ids?.length ?? 0) > 0) &&
          !(r.resolved_teacher_ids?.length || r.resolved_teacher_id)
        );
      }).length;
      if (unmatched > 0) {
        parsed.warnings.push({
          code: 'TEACHER_UNMATCHED',
          message: `${unmatched} satırda öğretmen okul listesiyle eşleşmedi.`,
        });
      }
      return {
        kind: 'assignments',
        ...parsed,
        rows,
        teacher_pool_size: teachers.length,
        asc_meta: {
          buildings: parsed.asc.buildings.length,
          rooms: parsed.asc.rooms.length,
          classes: parsed.asc.classes.length,
          groups: parsed.asc.groups.length,
          timeoffs: parsed.asc.timeoffs.length,
        },
        detected_format: sniffed,
        format_auto_corrected: formatAutoCorrected,
      };
    }
    if (format === 'eokul_excel') {
      const preview = await this.previewEokulImport(schoolId, {
        file_base64: body.file_base64,
        format: body.eokul_format ?? 'auto',
      });
      return {
        kind: 'assignments',
        ...preview,
        detected_format: sniffed,
        format_auto_corrected: formatAutoCorrected,
      };
    }
    if (format === 'ogretmenpro_json') {
      let pkg: StudioTransferPackageV1;
      try {
        pkg = JSON.parse(buffer.toString('utf8')) as StudioTransferPackageV1;
      } catch {
        throw new BadRequestException({ code: 'JSON_INVALID', message: 'Geçersiz JSON dosyası.' });
      }
      if (pkg.format !== 'ogretmenpro_studio_v1') {
        throw new BadRequestException({
          code: 'PACKAGE_FORMAT',
          message: 'Bu dosya ÖğretmenPro stüdyo yedeği değil.',
        });
      }
      return {
        kind: 'studio_package',
        format: pkg.format,
        exported_at: pkg.exported_at,
        counts: pkg.counts,
        subjects: pkg.subjects?.length ?? 0,
        assignments: pkg.assignments?.length ?? 0,
        groups: pkg.groups?.length ?? 0,
        elective_pools: pkg.elective_pools?.length ?? 0,
        warnings: [] as { code: string; message: string }[],
        detected_format: sniffed,
        format_auto_corrected: formatAutoCorrected,
      };
    }
    throw new BadRequestException({ code: 'FORMAT_UNSUPPORTED', message: 'Bu içe aktarma türü desteklenmiyor.' });
  }

  async applyStudioTransferImport(
    studioId: string,
    schoolId: string,
    userId: string,
    body: {
      format: string;
      file_base64?: string;
      eokul_format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
      replace?: boolean;
      auto_elective_groups?: boolean;
      merge_settings?: boolean;
    },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    if (!body.file_base64?.trim()) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Dosya gerekli.' });
    }
    const buffer = Buffer.from(body.file_base64, 'base64');
    const sniffed = sniffTransferImportFormat(buffer);
    const format = resolveTransferImportFormat(body.format, sniffed);
    const formatAutoCorrected = sniffed != null && format !== body.format;

    if (format === 'eokul_excel') {
      await this.clearStudioForTransferImport(studioId, schoolId, { deleteRooms: false });
      const r = await this.importEokulAssignments(studioId, schoolId, userId, {
        file_base64: body.file_base64,
        format: body.eokul_format ?? 'auto',
        replace: false,
        auto_elective_groups: body.auto_elective_groups,
      });
      await this.syncSectionScheduleOpenSlots(studioId, schoolId);
      return { kind: 'assignments', ...r, replace: true, format_auto_corrected: formatAutoCorrected };
    }
    if (format === 'ogretmenpro_json') {
      let pkg: StudioTransferPackageV1;
      try {
        pkg = JSON.parse(buffer.toString('utf8')) as StudioTransferPackageV1;
      } catch {
        throw new BadRequestException({ code: 'JSON_INVALID', message: 'Geçersiz JSON.' });
      }
      if (pkg.format !== 'ogretmenpro_studio_v1') {
        throw new BadRequestException({ code: 'PACKAGE_FORMAT', message: 'Geçersiz paket.' });
      }
      await this.clearStudioForTransferImport(studioId, schoolId, { deleteRooms: false });
      let subjects_saved = 0;
      for (const s of pkg.subjects ?? []) {
        await this.upsertSubject(studioId, {
          name: s.name,
          short_code: s.short_code ?? undefined,
          is_elective: s.is_elective,
          class_hours: s.class_hours ?? {},
        });
        subjects_saved++;
      }
      let assignments_saved = 0;
      for (const a of pkg.assignments ?? []) {
        await this.upsertAssignment(studioId, {
          subject_name: a.subject_name,
          class_sections: a.class_sections,
          weekly_hours: a.weekly_hours,
          teacher_ids: a.teacher_ids ?? [],
          room_ids: a.room_ids ?? [],
          group_id: a.group_id,
        });
        assignments_saved++;
      }
      for (const g of pkg.groups ?? []) {
        await this.upsertGroup(studioId, {
          name: g.name,
          abbreviation: g.abbreviation,
          parallel_mode: g.parallel_mode ?? undefined,
          member_sections: g.member_sections,
        });
      }
      for (const p of pkg.elective_pools ?? []) {
        await this.upsertElectivePool(studioId, {
          name: p.name,
          base_section: p.base_section,
          member_sections: p.member_sections,
          subject_names: p.subject_names,
          weekly_hours_per_track: p.weekly_hours_per_track,
        });
      }
      for (const cp of pkg.class_profiles ?? []) {
        const row = cp as Partial<DersDagitClassProfile>;
        if (!row.name?.trim()) continue;
        await this.upsertClassProfile(studioId, schoolId, row);
      }
      if (body.merge_settings !== false) {
        const settings = (studio.settings ?? {}) as Record<string, unknown>;
        if (pkg.school_profile != null) settings.school_profile = pkg.school_profile;
        if (pkg.periods != null) settings.period_config = pkg.periods;
        if (pkg.section_schedules != null) settings.section_schedules = pkg.section_schedules;
        if (pkg.dual_education != null) settings.dual_education = pkg.dual_education;
        if (pkg.report_settings != null) settings.report_settings = pkg.report_settings;
        studio.settings = settings;
        await this.studioRepo.save(studio);
      }
      await this.audit(studioId, userId, 'studio.imported_package', {
        subjects_saved,
        assignments_saved,
        replace: true,
      });
      await this.syncSectionScheduleOpenSlots(studioId, schoolId);
      return {
        kind: 'studio_package',
        subjects_saved,
        assignments_saved,
        groups: pkg.groups?.length ?? 0,
        elective_pools: pkg.elective_pools?.length ?? 0,
        replace: true,
      };
    }
    if (format === 'asc_xml') {
      const parsed = parseAscTimetablesXml(buffer);
      if (!parsed.assignments.length) {
        throw new BadRequestException({
          code: 'ASC_EMPTY',
          message: 'İçe aktarılacak atama yok.',
          warnings: parsed.warnings,
        });
      }
      await this.clearStudioForTransferImport(studioId, schoolId, { deleteRooms: true });
      const replace = true;
      const teachers = await this.listSchoolTeachers(schoolId);
      const rows = parsed.assignments.map((a) => {
        const resolved = this.resolveAscTeacherIds(teachers, a, parsed.asc);
        return {
          ...a,
          resolved_teacher_id: resolved.user_ids[0] ?? null,
          resolved_teacher_ids: resolved.user_ids,
        };
      }) as Array<
        (typeof parsed.assignments)[number] & {
          resolved_teacher_id: string | null;
          resolved_teacher_ids: string[];
        }
      >;
      const usedGroupAscIds = new Set(
        rows.map((r) => r.group_asc_id).filter((id): id is string => !!id),
      );
      const assignmentSections = [
        ...new Set(rows.flatMap((r) => r.class_sections ?? []).map((s) => s.trim()).filter(Boolean)),
      ];
      const { roomIdByAsc, groupIdByAsc, profiles_created } = await this.applyAscImportInfrastructure(
        studioId,
        schoolId,
        parsed.asc,
        teachers,
        replace,
        usedGroupAscIds,
        assignmentSections,
      );
      await this.ensureSubjectsFromAscCatalog(studioId, parsed.asc.subject_by_id);
      const imported = await this.persistImportedAssignmentRows(studioId, rows, roomIdByAsc, groupIdByAsc);
      const slotSync = await this.syncSectionScheduleOpenSlots(studioId, schoolId);
      const withTeacher = rows.filter((r) => r.resolved_teacher_ids?.length).length;
      const withRoom = rows.filter((r) => (r.room_asc_ids ?? []).length).length;
      const withoutTeacher = rows.length - withTeacher;
      if (withoutTeacher > 0) {
        parsed.warnings.push({
          code: 'TEACHER_UNMATCHED',
          message: `${withoutTeacher} atamada öğretmen okul listesiyle eşleşmedi. aSc'te öğretmen partner_id alanına TC yazın veya okul öğretmen adlarını aSc ile aynı tutun; dosyayı yeniden içe aktarın.`,
        });
      }
      await this.audit(studioId, userId, 'assignments.imported_asc', {
        count: imported,
        replace,
        rooms: parsed.asc.rooms.length,
        classes: parsed.asc.classes.length,
        groups: groupIdByAsc.size,
        class_profiles: profiles_created,
        subjects: Object.keys(parsed.asc.subject_by_id).length,
        teachers_matched: withTeacher,
      });
      return {
        kind: 'assignments',
        imported,
        format: 'asc_xml',
        warnings: parsed.warnings,
        rooms_saved: parsed.asc.rooms.length,
        classes_saved: parsed.asc.classes.length,
        class_profiles_saved: profiles_created,
        groups_saved: groupIdByAsc.size,
        subjects_saved: Object.keys(parsed.asc.subject_by_id).length,
        teachers_matched: withTeacher,
        rooms_linked: withRoom,
        timeoffs_applied: parsed.asc.timeoffs.length,
        section_slots_opened: slotSync.opened_cells,
        replace: true,
        format_auto_corrected: formatAutoCorrected,
      };
    }
    throw new BadRequestException({
      code: 'FORMAT_UNSUPPORTED',
      message: 'Desteklenmeyen format. aSc XML, e-Okul Excel veya ÖğretmenPro yedeği seçin.',
    });
  }
}
