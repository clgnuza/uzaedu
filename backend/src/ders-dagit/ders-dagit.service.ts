import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  DersDagitStudio,
  DersDagitClassProfile,
  DersDagitTeacherConfig,
  DersDagitSubject,
  DersDagitGroup,
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
import { validateStudioData, type ValidationIssue } from './ders-dagit.validation';
import { runConstraintSolver, type SolverAssignment, type SolverContext } from './ders-dagit.solver';
import { improveWithLocalSearch } from './ders-dagit.local-search';
import { GROUP_MODE_CATALOG, normalizeGroupMode, type DersDagitGroupMode } from './ders-dagit.groups';
import {
  parseStudioPeriod,
  blockedLessonNums,
  maxLessonsForDay,
  lunchAfterLesson,
  type StudioPeriodConfig,
} from './ders-dagit.period';
import {
  buildProgramGridCsv,
  buildEokulScheduleCsv,
  type ExportEntry,
} from './ders-dagit.export';
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
    studio = await this.studioRepo.save({
      school_id: schoolId,
      academic_year: year,
      name: `${year} DersDağıt`,
      workflow_status: 'setup',
      settings: {},
      created_by: userId,
    });
    await this.ruleSetRepo.save({ studio_id: studio.id, rules: buildDefaultRuleState(), building_travel: [] });
    await this.audit(studio.id, userId, 'studio.created', { academic_year: year });
    return studio;
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
      this.classProfileRepo.count({ where: { studio_id: studioId } }),
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
      for (const sec of a.class_sections) {
        subjects_by_class[sec] = (subjects_by_class[sec] ?? 0) + a.weekly_hours;
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
      for (const uid of byAssign.get(a.id) ?? []) {
        if (!teacher_hours[uid]) teacher_hours[uid] = { assigned: 0 };
        teacher_hours[uid].assigned += a.weekly_hours;
      }
    }

    return validateStudioData({
      class_profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        class_sections: p.class_sections,
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
        class_sections: a.class_sections,
        weekly_hours: a.weekly_hours,
        biweekly: a.biweekly,
        group_id: a.group_id,
        room_ids: a.room_ids,
      })),
      groups: groups.map((g) => ({ id: g.id, abbreviation: g.abbreviation })),
      teacher_hours,
    });
  }

  // --- Class profiles (Faz 3) ---
  async listClassProfiles(studioId: string) {
    return this.classProfileRepo.find({ where: { studio_id: studioId }, order: { sort_order: 'ASC' } });
  }

  async upsertClassProfile(studioId: string, dto: Partial<DersDagitClassProfile>) {
    if (dto.id) {
      const row = await this.classProfileRepo.findOne({ where: { id: dto.id, studio_id: studioId } });
      if (!row) throw new NotFoundException();
      return this.classProfileRepo.save({ ...row, ...dto });
    }
    return this.classProfileRepo.save({ ...dto, studio_id: studioId } as DersDagitClassProfile);
  }

  async deleteClassProfile(id: string, studioId: string) {
    await this.classProfileRepo.delete({ id, studio_id: studioId });
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
      rs = await this.ruleSetRepo.save({ studio_id: studioId, rules: buildDefaultRuleState(), building_travel: [] });
    }
    return { ...rs, catalog: DERS_DAGIT_RULE_CATALOG };
  }

  async updateRules(studioId: string, rules: Record<string, unknown>, building_travel?: unknown[]) {
    const rs = await this.ruleSetRepo.findOne({ where: { studio_id: studioId } });
    if (!rs) throw new NotFoundException();
    rs.rules = rules as DersDagitRuleSet['rules'];
    if (building_travel !== undefined) rs.building_travel = building_travel;
    await this.ruleSetRepo.save(rs);
    return this.getRules(studioId);
  }

  async deleteSubject(id: string, studioId: string) {
    await this.subjectRepo.delete({ id, studio_id: studioId });
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
        select: ['duty_max_lessons', 'lesson_schedule'],
      }),
      this.classProfileRepo.find({ where: { studio_id: studioId } }),
      this.preferenceRepo.find({ where: { studio_id: studioId } }),
      this.teacherConfigRepo.find({ where: { studio_id: studioId } }),
      this.groupRepo.find({ where: { studio_id: studioId } }),
      this.ruleSetRepo.findOne({ where: { studio_id: studioId } }),
    ]);
    const active_rules = (ruleSet?.rules ?? buildDefaultRuleState()) as SolverContext['active_rules'];
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    const settings = (studio?.settings ?? {}) as { work_days?: number[]; period?: unknown };
    const period = parseStudioPeriod(settings.period);
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
    const group_modes = new Map<string, DersDagitGroupMode>();
    const parallel_groups = new Set<string>();
    for (const g of groups) {
      const mode = normalizeGroupMode(g.parallel_mode);
      group_modes.set(g.id, mode);
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
    const travelRows = (ruleSet?.building_travel ?? []) as Array<{ minutes?: number }>;
    let travelMinutes = 5;
    for (const row of travelRows) {
      if (row.minutes != null) travelMinutes = row.minutes;
    }
    const building_travel_gap = active_rules.building_travel_time?.active
      ? Math.max(2, Math.ceil(travelMinutes / 40))
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
    const max_lesson_by_day = new Map<number, number>();
    for (const d of work_days) {
      max_lesson_by_day.set(d, maxLessonsForDay(period, d, maxLesson));
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
    };
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
    opts: { duration_sec?: number; versions?: number },
  ) {
    const errors = (await this.runValidation(studioId)).filter((e) => e.severity === 'error');
    if (errors.length) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: errors });
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
    const solverInput: SolverAssignment[] = assignments.map((a) => ({
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
    }));
    const programs: DersDagitProgram[] = [];
    const versionCount = Math.min(3, opts.versions ?? 1);
    const baseDays = solverCtx.work_days;
    const iter = Math.min(40, Math.max(12, (opts.duration_sec ?? 60) / 2));
    let bestResult = improveWithLocalSearch(solverInput, solverCtx, iter);
    for (let v = 0; v < versionCount; v++) {
      const shuffled = [...baseDays].sort(() => Math.random() - 0.5);
      const result = improveWithLocalSearch(solverInput, { ...solverCtx, day_order: shuffled }, iter);
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
    };
  }

  async getProgram(programId: string, studioId: string) {
    const program = await this.programRepo.findOne({ where: { id: programId, studio_id: studioId } });
    if (!program) throw new NotFoundException();
    const entries = await this.programEntryRepo.find({ where: { program_id: programId } });
    return { program, entries };
  }

  async listPrograms(studioId: string) {
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
    return {
      lesson_schedule: school.lesson_schedule ?? [],
      lesson_schedule_pm: school.lesson_schedule_pm ?? [],
      lesson_schedule_weekend: school.lesson_schedule_weekend,
      lesson_schedule_weekend_pm: school.lesson_schedule_weekend_pm,
      duty_max_lessons: school.duty_max_lessons,
      duty_education_mode: school.duty_education_mode,
      studio_period: { ...period, work_days },
      work_days,
    };
  }

  async updatePeriodConfig(
    studioId: string,
    schoolId: string,
    body: { period?: StudioPeriodConfig; work_days?: number[] },
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
    return rows.map((r) => String(r.name ?? '').trim()).filter(Boolean);
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

  private async buildExportRows(programId: string, studioId: string): Promise<ExportEntry[]> {
    const { entries } = await this.getProgram(programId, studioId);
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
      day_of_week: e.day_of_week,
      lesson_num: e.lesson_num,
      class_section: e.class_section,
      subject: e.subject,
      user_id: e.user_id,
      teacher_label: e.user_id ? userMap.get(e.user_id) ?? null : null,
      room_name: e.room_id ? roomMap.get(e.room_id) ?? null : null,
    }));
  }

  async exportProgramCsv(programId: string, studioId: string): Promise<string> {
    return buildProgramGridCsv(await this.buildExportRows(programId, studioId));
  }

  async exportProgramEokul(programId: string, studioId: string): Promise<string> {
    return buildEokulScheduleCsv(await this.buildExportRows(programId, studioId));
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
    dto: { day_of_week?: number; lesson_num?: number; is_locked?: boolean },
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
    await this.programEntryRepo.save({
      ...entry,
      day_of_week: day,
      lesson_num: lesson,
      is_locked: dto.is_locked ?? entry.is_locked,
    });
    await this.audit(studioId, userId, 'program.entry.patched', { program_id: programId, entry_id: entryId });
    return this.programEntryRepo.findOne({ where: { id: entryId } });
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

  /** Okul ders programı planından atama türet (Faz 28). */
  async importAssignmentsFromSchoolPlan(
    studioId: string,
    schoolId: string,
    planId: string,
    userId: string,
    opts?: { replace?: boolean },
  ) {
    const studio = await this.studioRepo.findOne({ where: { id: studioId, school_id: schoolId } });
    if (!studio) throw new NotFoundException();
    const plan = await this.schoolPlanRepo.findOne({ where: { id: planId, school_id: schoolId } });
    if (!plan) throw new NotFoundException('Plan bulunamadı');
    const entries = await this.schoolPlanEntryRepo.find({ where: { plan_id: planId } });
    if (!entries.length) {
      throw new BadRequestException({ code: 'EMPTY_PLAN', message: 'Planda ders satırı yok.' });
    }
    if (opts?.replace) {
      const existing = await this.assignmentRepo.find({ where: { studio_id: studioId }, select: ['id'] });
      if (existing.length) {
        await this.assignmentTeacherRepo.delete({ assignment_id: In(existing.map((a) => a.id)) });
        await this.assignmentRepo.delete({ studio_id: studioId });
      }
    }
    const bucket = new Map<
      string,
      { subject: string; sections: Set<string>; hours: number; teacherIds: Set<string> }
    >();
    for (const e of entries) {
      const section = String(e.class_section ?? '').trim();
      const subject = String(e.subject ?? '').trim();
      if (!section || !subject) continue;
      const k = `${subject}\0${section}`;
      let b = bucket.get(k);
      if (!b) {
        b = { subject, sections: new Set([section]), hours: 0, teacherIds: new Set() };
        bucket.set(k, b);
      }
      b.hours += 1;
      if (e.user_id) b.teacherIds.add(e.user_id);
    }
    const created: DersDagitAssignment[] = [];
    for (const b of bucket.values()) {
      const row = await this.upsertAssignment(studioId, {
        subject_name: b.subject,
        class_sections: [...b.sections],
        weekly_hours: b.hours,
        max_per_day: Math.min(4, b.hours),
        min_days_per_week: Math.min(5, Math.max(1, Math.ceil(b.hours / 2))),
        room_ids: [],
        teacher_ids: [...b.teacherIds],
      });
      created.push(row);
    }
    await this.audit(studioId, userId, 'assignments.imported_from_plan', {
      plan_id: planId,
      count: created.length,
    });
    return { imported: created.length, plan_id: planId, assignments: created };
  }
}
