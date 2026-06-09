// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { SorumlulukGroup } from './entities/sorumluluk-group.entity';
import { SorumlulukStudent, SubjectEntry } from './entities/sorumluluk-student.entity';
import { SorumlulukSession } from './entities/sorumluluk-session.entity';
import { SorumlulukSessionStudent } from './entities/sorumluluk-session-student.entity';
import { SorumlulukSessionProctor } from './entities/sorumluluk-session-proctor.entity';
import { SorumlulukExamSlot } from './entities/sorumluluk-exam-slot.entity';
import { ExamSlotItemDto } from './dto/exam-slot.dto';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetable } from '../teacher-timetable/entities/teacher-timetable.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { UserRole } from '../types/enums';
import { CreateSorumlulukGroupDto } from './dto/create-group.dto';
import { CreateSorumlulukStudentDto } from './dto/create-student.dto';
import { CreateSorumlulukSessionDto } from './dto/create-session.dto';
import { SorumlulukExamPdfService } from './sorumluluk-exam-pdf.service';
import { loadSchoolAdminsForBelge, resolveSorumlulukPdfBelge } from './sorumluluk-pdf-belge.util';
import {
  sessionMatchesTutanakFilter,
  type TutanakPdfOptions,
} from './sorumluluk-tutanak-options';
import { NotificationsService } from '../notifications/notifications.service';
import {
  formatSubjectLabel,
  normalizeSorumluSubject,
  subjectMatchKey,
  uniqueSubjectDisplayNames,
} from './sorumluluk-subject.util';
import {
  computeSessionProctorNeeds,
  mergeProctorRules,
  sessionsOverlapForProctorConflict,
  type SorumlulukProctorRules,
} from './sorumluluk-proctor-rules';

@Injectable()
export class SorumlulukExamService {
  constructor(
    @InjectRepository(SorumlulukGroup)
    private readonly groupRepo: Repository<SorumlulukGroup>,
    @InjectRepository(SorumlulukStudent)
    private readonly studentRepo: Repository<SorumlulukStudent>,
    @InjectRepository(SorumlulukSession)
    private readonly sessionRepo: Repository<SorumlulukSession>,
    @InjectRepository(SorumlulukSessionStudent)
    private readonly ssRepo: Repository<SorumlulukSessionStudent>,
    @InjectRepository(SorumlulukSessionProctor)
    private readonly proctorRepo: Repository<SorumlulukSessionProctor>,
    @InjectRepository(SorumlulukExamSlot)
    private readonly slotRepo: Repository<SorumlulukExamSlot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(TeacherTimetable)
    private readonly timetableRepo: Repository<TeacherTimetable>,
    @InjectRepository(SchoolTimetablePlan)
    private readonly timetablePlanRepo: Repository<SchoolTimetablePlan>,
    private readonly pdf: SorumlulukExamPdfService,
    private readonly notificationsService: NotificationsService,
  ) {}

  assertAccess(role: string, userSchoolId: string | null, targetSchoolId: string) {
    if (role === UserRole.superadmin || role === UserRole.moderator) return;
    if (userSchoolId !== targetSchoolId) throw new ForbiddenException();
  }

  /** Oturum görevlisi olarak atanan oturumlar (yalnızca bu okul). */
  async listMyProctorAssignments(schoolId: string, userId: string) {
    const proctorRows = await this.proctorRepo.find({ where: { userId } });
    if (!proctorRows.length) return [];
    const sessionIds = [...new Set(proctorRows.map((r) => r.sessionId))];
    const sessions = await this.sessionRepo.find({
      where: { id: In(sessionIds), schoolId },
    });
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const groupIds = [...new Set(sessions.map((s) => s.groupId))];
    if (!groupIds.length) return [];
    const groups = await this.groupRepo.find({ where: { id: In(groupIds), schoolId } });
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const roleLabel = (r: 'komisyon_uye' | 'gozcu') => (r === 'gozcu' ? 'Gözcü' : 'Komisyon üyesi');

    const seen = new Set<string>();
    const out: Array<{
      sessionId: string;
      groupId: string;
      groupTitle: string;
      examType: string;
      academicYear: string | null;
      groupStatus: string;
      proctorRole: 'komisyon_uye' | 'gozcu';
      proctorRoleLabel: string;
      subjectName: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      roomName: string | null;
      sessionStatus: string;
    }> = [];

    for (const pr of proctorRows) {
      const s = sessionMap.get(pr.sessionId);
      if (!s) continue;
      const g = groupMap.get(s.groupId);
      if (!g) continue;
      const key = `${pr.sessionId}:${pr.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        sessionId: s.id,
        groupId: g.id,
        groupTitle: g.title,
        examType: g.examType,
        academicYear: g.academicYear,
        groupStatus: g.status,
        proctorRole: pr.role,
        proctorRoleLabel: roleLabel(pr.role),
        subjectName: s.subjectName,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        roomName: s.roomName,
        sessionStatus: s.status,
      });
    }

    out.sort((a, b) => {
      const c = a.sessionDate.localeCompare(b.sessionDate);
      if (c !== 0) return c;
      return a.startTime.localeCompare(b.startTime);
    });
    return out;
  }

  async isUserProctorOnSession(schoolId: string, sessionId: string, userId: string): Promise<boolean> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) return false;
    const n = await this.proctorRepo.count({ where: { sessionId, userId } });
    return n > 0;
  }

  // ── Gruplar ──────────────────────────────────────────────────────────────

  async listGroups(schoolId: string) {
    const groups = await this.groupRepo.find({ where: { schoolId }, order: { createdAt: 'DESC' } });
    const counts = await Promise.all(
      groups.map(async (g) => ({
        id: g.id,
        studentCount: await this.studentRepo.count({ where: { groupId: g.id } }),
        sessionCount: await this.sessionRepo.count({ where: { groupId: g.id } }),
      })),
    );
    const cMap = new Map(counts.map((c) => [c.id, c]));
    return groups.map((g) => ({ ...g, studentCount: cMap.get(g.id)?.studentCount ?? 0, sessionCount: cMap.get(g.id)?.sessionCount ?? 0 }));
  }

  async createGroup(schoolId: string, dto: CreateSorumlulukGroupDto) {
    const g = this.groupRepo.create({ schoolId, ...dto });
    return this.groupRepo.save(g);
  }

  async getGroup(schoolId: string, id: string) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    return { ...g, proctorRules: mergeProctorRules(g.proctorRules) };
  }

  async updateGroup(
    schoolId: string,
    id: string,
    dto: Partial<CreateSorumlulukGroupDto> & { status?: string; proctorRules?: Partial<SorumlulukProctorRules> },
  ) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    const { proctorRules, ...rest } = dto;
    Object.assign(g, rest);
    if (proctorRules !== undefined) {
      g.proctorRules = mergeProctorRules({ ...mergeProctorRules(g.proctorRules), ...proctorRules });
    }
    const saved = await this.groupRepo.save(g);
    return { ...saved, proctorRules: mergeProctorRules(saved.proctorRules) };
  }

  private _proctorRules(group: SorumlulukGroup | null | undefined): SorumlulukProctorRules {
    return mergeProctorRules(group?.proctorRules);
  }

  async deleteGroup(schoolId: string, id: string) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    await this.groupRepo.remove(g);
  }

  // ── Öğrenciler ────────────────────────────────────────────────────────────

  async listStudents(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    return this.studentRepo.find({ where: { groupId }, order: { className: 'ASC', studentName: 'ASC' } });
  }

  async createStudent(schoolId: string, groupId: string, dto: CreateSorumlulukStudentDto) {
    await this._requireGroup(schoolId, groupId);
    const subjects = this._normalizeSubjectDtoList(dto.subjects ?? []);
    const s = this.studentRepo.create({ schoolId, groupId, ...dto, subjects });
    return this.studentRepo.save(s);
  }

  async updateStudent(schoolId: string, id: string, dto: Partial<CreateSorumlulukStudentDto>) {
    const s = await this.studentRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    if (dto.subjects) dto.subjects = this._normalizeSubjectDtoList(dto.subjects);
    Object.assign(s, dto);
    return this.studentRepo.save(s);
  }

  private _normalizeSubjectDtoList(
    subjects: Array<{ subjectName: string; sessionId?: string | null; gradeLevel?: number | null }>,
  ): SubjectEntry[] {
    const map = new Map<string, SubjectEntry>();
    for (const s of subjects) {
      const merged = this._mergeSubjectEntries([], [s.subjectName])[0];
      if (!merged) continue;
      map.set(subjectMatchKey(merged), { ...merged, sessionId: s.sessionId ?? null });
    }
    return [...map.values()];
  }

  async deleteStudent(schoolId: string, id: string) {
    const s = await this.studentRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    await this.ssRepo.delete({ studentId: id });
    await this.studentRepo.remove(s);
  }

  async deleteAllStudentsInGroup(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    const students = await this.studentRepo.find({ where: { groupId, schoolId } });
    if (!students.length) return { deleted: 0 };
    const ids = students.map((s) => s.id);
    await this.ssRepo.delete({ studentId: In(ids) });
    await this.studentRepo.delete({ groupId, schoolId });
    return { deleted: ids.length };
  }

  private _importStudentKey(row: { studentName: string; studentNumber?: string | null }): string {
    const no = row.studentNumber?.trim();
    if (no) return `no:${no}`;
    return `name:${row.studentName.trim().toLocaleLowerCase('tr-TR')}`;
  }

  private _mergeSubjectEntries(existing: SubjectEntry[], incoming: string[]): SubjectEntry[] {
    const map = new Map<string, SubjectEntry>();
    for (const e of existing) {
      const k = subjectMatchKey(e);
      if (!k) continue;
      map.set(k, { ...e, sessionId: e.sessionId ?? null });
    }
    for (const raw of incoming) {
      const n = normalizeSorumluSubject(raw);
      if (!n.matchKey) continue;
      const prev = map.get(n.matchKey);
      if (!prev) {
        map.set(n.matchKey, { subjectName: n.subjectName, gradeLevel: n.gradeLevel, sessionId: null });
      } else if (n.gradeLevel != null && prev.gradeLevel == null) {
        prev.gradeLevel = n.gradeLevel;
      }
    }
    return [...map.values()];
  }

  /** Excel/MEB import: öğrenci no (yoksa ad) ile birleştirir; ikinci yüklemede çoğaltmaz. */
  async importStudents(
    schoolId: string,
    groupId: string,
    rows: Array<{ studentName: string; studentNumber?: string; className?: string; subjects?: string[] }>,
  ) {
    await this._requireGroup(schoolId, groupId);

    const merged = new Map<
      string,
      { studentName: string; studentNumber?: string; className?: string; subjects: string[] }
    >();
    for (const row of rows) {
      if (!row.studentName?.trim()) continue;
      const key = this._importStudentKey({ studentName: row.studentName, studentNumber: row.studentNumber });
      const prev = merged.get(key);
      const subjects = uniqueSubjectDisplayNames((row.subjects ?? []).map((s) => s.trim()).filter(Boolean));
      if (prev) {
        prev.subjects = uniqueSubjectDisplayNames([...prev.subjects, ...subjects]);
        if (row.className?.trim()) prev.className = row.className.trim();
        if (row.studentNumber?.trim()) prev.studentNumber = row.studentNumber.trim();
        if (row.studentName.trim()) prev.studentName = row.studentName.trim();
      } else {
        merged.set(key, {
          studentName: row.studentName.trim(),
          studentNumber: row.studentNumber?.trim(),
          className: row.className?.trim(),
          subjects,
        });
      }
    }

    const existingList = await this.studentRepo.find({ where: { groupId, schoolId } });
    const byKey = new Map(existingList.map((s) => [this._importStudentKey(s), s]));

    let created = 0;
    let updated = 0;
    for (const row of merged.values()) {
      const key = this._importStudentKey(row);
      const found = byKey.get(key);
      const subjects = this._mergeSubjectEntries([], row.subjects);

      if (found) {
        found.studentName = row.studentName;
        found.studentNumber = row.studentNumber?.trim() ?? found.studentNumber;
        found.className = row.className?.trim() ?? found.className;
        found.subjects = this._mergeSubjectEntries(found.subjects, row.subjects);
        await this.studentRepo.save(found);
        updated++;
      } else {
        const s = this.studentRepo.create({
          schoolId,
          groupId,
          studentName: row.studentName,
          studentNumber: row.studentNumber?.trim() ?? null,
          className: row.className?.trim() ?? null,
          subjects,
        });
        await this.studentRepo.save(s);
        created++;
      }
    }

    return { imported: created + updated, created, updated };
  }

  // ── Sınav takvimi (slotlar) ───────────────────────────────────────────────

  async listExamSlots(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    return this.slotRepo.find({
      where: { groupId },
      order: { sessionDate: 'ASC', sortOrder: 'ASC', startTime: 'ASC' },
    });
  }

  async replaceExamSlots(schoolId: string, groupId: string, items: ExamSlotItemDto[]) {
    await this._requireGroup(schoolId, groupId);
    await this.slotRepo.delete({ groupId });
    if (!items.length) return [];
    const rows = items.map((item, idx) =>
      this.slotRepo.create({
        schoolId,
        groupId,
        sessionDate: item.sessionDate,
        startTime: this._normalizeTime(item.startTime),
        endTime: this._normalizeTime(item.endTime),
        roomName: item.roomName?.trim() || null,
        capacity: item.capacity ?? 30,
        sortOrder: item.sortOrder ?? idx,
        label: item.label?.trim() || null,
      }),
    );
    return this.slotRepo.save(rows);
  }

  /**
   * Tanımlı slotlara göre eksik ders oturumlarını oluşturur (her ders → sıradaki boş slot).
   */
  private _resolveSessionType(
    subjectName: string,
    mixedSubjectKeys: Set<string> | undefined,
    existingSessions: SorumlulukSession[],
  ): 'yazili' | 'mixed' {
    const key = this._subjectKey(subjectName);
    if (mixedSubjectKeys?.has(key)) return 'mixed';
    const ex = existingSessions.find((s) => this._subjectKey(s.subjectName) === key);
    if (ex?.sessionType === 'mixed') return 'mixed';
    return 'yazili';
  }

  async createSessionsFromSlots(
    schoolId: string,
    groupId: string,
    subjectNames?: string[],
    mixedSubjectKeys?: Set<string>,
  ): Promise<{ created: number; skipped: string[]; slotsTotal: number }> {
    await this._requireGroup(schoolId, groupId);
    const slots = await this.listExamSlots(schoolId, groupId);
    if (!slots.length) {
      throw new BadRequestException({
        code: 'NO_SLOTS',
        message: 'Önce Sınav Takvimi sekmesinden müsait gün ve saat dilimleri tanımlayın.',
      });
    }

    const demand = await this._collectSubjectDemand(groupId);
    if (!demand.size) {
      return { created: 0, skipped: [], slotsTotal: slots.length };
    }

    let subjects = uniqueSubjectDisplayNames(subjectNames?.map((s) => s.trim()).filter(Boolean) ?? []);
    if (!subjects.length) {
      subjects = [...demand.values()].map((d) => d.displayName);
    } else {
      subjects = subjects.filter((s) => demand.has(this._subjectKey(s)));
    }

    const existing = await this.sessionRepo.find({ where: { groupId } });
    const existingNames = new Set(existing.map((s) => this._subjectKey(s.subjectName)));

    const toCreate = subjects.filter((s) => !existingNames.has(this._subjectKey(s)));
    const usedSlotIds = new Set<string>();
    this._markUsedSlotsFromSessions(slots, existing, usedSlotIds);
    let created = 0;
    const skipped: string[] = [];

    const mixedSubs = toCreate.filter((s) => mixedSubjectKeys?.has(this._subjectKey(s)));
    const plainSubs = toCreate.filter((s) => !mixedSubjectKeys?.has(this._subjectKey(s)));

    for (const subj of [...mixedSubs, ...plainSubs]) {
      const isMixed = mixedSubjectKeys?.has(this._subjectKey(subj)) ?? false;
      const slot = this._pickExamSlotForSession(slots, usedSlotIds, existing, isMixed);
      if (!slot) {
        skipped.push(subj);
        continue;
      }
      this._reserveSlotsForSession(usedSlotIds, slot, slots, isMixed);
      const sessionType = this._resolveSessionType(subj, mixedSubjectKeys, existing);
      let saved = await this.sessionRepo.save(
        this.sessionRepo.create({
          schoolId,
          groupId,
          subjectName: subj,
          sessionDate: slot.sessionDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomName: slot.roomName,
          capacity: slot.capacity,
          sessionType,
        }),
      );
      if (sessionType === 'mixed') {
        saved = (await this._syncUygulamaCompanion(schoolId, saved)) ?? saved;
      }
      existing.push(saved);
      created++;
    }

    return { created, skipped, slotsTotal: slots.length };
  }

  /** MEB import: seçilen derslerin mevcut oturumlarını yazılı+uygulama yapar */
  private async _applyMixedSessionTypes(
    schoolId: string,
    groupId: string,
    mixedSubjectKeys: Set<string>,
  ): Promise<number> {
    if (!mixedSubjectKeys.size) return 0;
    const demand = await this._collectSubjectDemand(groupId);
    const slots = await this.listExamSlots(schoolId, groupId);
    const companionChildIds = new Set(
      (await this.sessionRepo.find({ where: { groupId }, select: ['pairedSessionId'] }))
        .map((s) => s.pairedSessionId)
        .filter((id): id is string => !!id),
    );
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const usedSlotIds = new Set<string>();
    this._markUsedSlotsFromSessions(
      slots,
      sessions.filter((s) => !mixedSubjectKeys.has(this._subjectKey(s.subjectName)) || s.sessionType === 'uygulama'),
      usedSlotIds,
    );
    let updated = 0;
    for (const ses of sessions) {
      if (companionChildIds.has(ses.id) || ses.sessionType === 'uygulama') continue;
      const subjKey = this._subjectKey(ses.subjectName);
      if (!mixedSubjectKeys.has(subjKey)) continue;
      if (!demand.has(subjKey)) continue;
      if (ses.sessionType !== 'mixed') {
        ses.sessionType = 'mixed';
        updated++;
      }
      const nextOk =
        slots.length > 0 &&
        !!this._findExamSlotOnDate(slots, this._addCalendarDay(ses.sessionDate), ses.startTime, ses.endTime);
      if (!nextOk && slots.length) {
        const others = sessions.filter((s) => s.id !== ses.id);
        const newSlot = this._pickExamSlotForSession(slots, usedSlotIds, others, true);
        if (newSlot) {
          ses.sessionDate = newSlot.sessionDate;
          ses.startTime = this._normalizeTime(newSlot.startTime);
          ses.endTime = this._normalizeTime(newSlot.endTime);
          ses.roomName = newSlot.roomName;
          ses.capacity = newSlot.capacity;
          updated++;
        }
      }
      const saved = await this.sessionRepo.save(ses);
      const match = this._findExamSlotOnDate(slots, saved.sessionDate, saved.startTime, saved.endTime);
      if (match) this._reserveSlotsForSession(usedSlotIds, match, slots, true);
      await this._syncUygulamaCompanion(schoolId, saved);
    }
    return updated;
  }

  // ── Oturumlar ─────────────────────────────────────────────────────────────

  async listSessions(schoolId: string, groupId: string) {
    const group = await this._requireGroup(schoolId, groupId);
    const proctorRules = this._proctorRules(group);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const pairedIds = sessions.map((s) => s.pairedSessionId).filter((id): id is string => !!id);
    const pairedRows =
      pairedIds.length > 0
        ? await this.sessionRepo.find({ where: { id: In(pairedIds) } })
        : [];
    const pairedMap = new Map(pairedRows.map((p) => [p.id, p]));
    const companionIds = await this._companionSessionIds(groupId);
    return Promise.all(sessions.map(async (s) => {
      const studentCount = await this.ssRepo.count({ where: { sessionId: s.id } });
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { sortOrder: 'ASC' } });
      const userIds = proctors.map((p) => p.userId);
      const users = userIds.length ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      const companion = s.pairedSessionId ? pairedMap.get(s.pairedSessionId) : undefined;
      const needs = computeSessionProctorNeeds(s, sessions, studentCount, companionIds, proctorRules);
      return {
        ...s,
        studentCount,
        recommendedKomisyon: needs.komisyon,
        recommendedGozcu: needs.gozcu,
        proctorNeedReason: needs.reason,
        proctors: proctors.map((p) => ({ ...p, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })),
        uygulamaCompanion: companion
          ? {
              id: companion.id,
              sessionDate: companion.sessionDate,
              startTime: companion.startTime,
              endTime: companion.endTime,
              roomName: companion.roomName,
            }
          : null,
      };
    }));
  }

  private _addCalendarDay(ymd: string): string {
    const d = new Date(`${ymd}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  private _findExamSlotOnDate(
    slots: SorumlulukExamSlot[],
    date: string,
    startTime: string,
    endTime: string,
  ): SorumlulukExamSlot | null {
    const d = date.slice(0, 10);
    const st = this._normalizeTime(startTime);
    const et = this._normalizeTime(endTime);
    return (
      slots.find(
        (s) =>
          s.sessionDate.slice(0, 10) === d &&
          this._normalizeTime(s.startTime) === st &&
          this._normalizeTime(s.endTime) === et,
      ) ?? null
    );
  }

  /** Y+U yazılı: ertesi gün takvimde aynı saat dilimi olan slotlar (erken günler önce). */
  private _mixedYaziliSlotCandidates(slots: SorumlulukExamSlot[]): SorumlulukExamSlot[] {
    return this._sortExamSlots(slots).filter((s) =>
      !!this._findExamSlotOnDate(slots, this._addCalendarDay(s.sessionDate), s.startTime, s.endTime),
    );
  }

  private _sortExamSlots(slots: SorumlulukExamSlot[]): SorumlulukExamSlot[] {
    return [...slots].sort(
      (a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        this._normalizeTime(a.startTime).localeCompare(this._normalizeTime(b.startTime)),
    );
  }

  private _isSlotTimeOccupied(
    sessions: SorumlulukSession[],
    date: string,
    start: string,
    end: string,
    excludeSessionId?: string,
  ): boolean {
    const d = date.slice(0, 10);
    return sessions.some(
      (s) =>
        s.id !== excludeSessionId &&
        s.sessionDate.slice(0, 10) === d &&
        this._timesOverlap(s.startTime, s.endTime, start, end),
    );
  }

  private _reserveSlotsForSession(
    usedSlotIds: Set<string>,
    yaziliSlot: SorumlulukExamSlot,
    slots: SorumlulukExamSlot[],
    isMixed: boolean,
  ) {
    usedSlotIds.add(yaziliSlot.id);
    if (!isMixed) return;
    const companion = this._findExamSlotOnDate(
      slots,
      this._addCalendarDay(yaziliSlot.sessionDate),
      yaziliSlot.startTime,
      yaziliSlot.endTime,
    );
    if (companion) usedSlotIds.add(companion.id);
  }

  private _markUsedSlotsFromSessions(
    slots: SorumlulukExamSlot[],
    sessions: SorumlulukSession[],
    usedSlotIds: Set<string>,
  ) {
    for (const s of sessions) {
      const match = this._findExamSlotOnDate(slots, s.sessionDate, s.startTime, s.endTime);
      if (match) this._reserveSlotsForSession(usedSlotIds, match, slots, s.sessionType === 'mixed');
    }
  }

  /** Y+U: yazılı takvim içinde; uygulama günü için eş slot takvimde olmalı. */
  private _pickExamSlotForSession(
    slots: SorumlulukExamSlot[],
    usedSlotIds: Set<string>,
    allSessions: SorumlulukSession[],
    requireMixedPair: boolean,
  ): SorumlulukExamSlot | null {
    const pool = requireMixedPair ? this._mixedYaziliSlotCandidates(slots) : this._sortExamSlots(slots);
    for (const slot of pool) {
      if (usedSlotIds.has(slot.id)) continue;
      if (this._isSlotTimeOccupied(allSessions, slot.sessionDate, slot.startTime, slot.endTime)) continue;
      if (!requireMixedPair) return slot;
      const next = this._addCalendarDay(slot.sessionDate);
      const companion = this._findExamSlotOnDate(slots, next, slot.startTime, slot.endTime);
      if (!companion || usedSlotIds.has(companion.id)) continue;
      if (this._isSlotTimeOccupied(allSessions, next, slot.startTime, slot.endTime)) continue;
      return slot;
    }
    return null;
  }

  /** Y+U: yazılı (mixed parent) → ertesi gün uygulama (paired child) */
  private async _collectMixedPairIssues(
    groupId: string,
    examSlots?: SorumlulukExamSlot[],
  ): Promise<{ ok: boolean; issues: string[] }> {
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const issues: string[] = [];
    for (const parent of sessions) {
      if (parent.sessionType !== 'mixed') continue;
      if (!parent.pairedSessionId) {
        issues.push(`${parent.subjectName} (${parent.sessionDate}): uygulama eşi yok`);
        continue;
      }
      const child = byId.get(parent.pairedSessionId);
      if (!child) {
        issues.push(`${parent.subjectName}: eş oturum kaydı yok`);
        continue;
      }
      const expected = this._addCalendarDay(parent.sessionDate);
      if (child.sessionType !== 'uygulama') {
        issues.push(`${parent.subjectName}: eş tipi uygulama değil`);
      }
      if (child.sessionDate !== expected) {
        issues.push(
          `${parent.subjectName}: yazılı ${parent.sessionDate} → uygulama ${child.sessionDate} (beklenen ${expected})`,
        );
      }
      if (child.subjectName !== parent.subjectName) {
        issues.push(`${parent.subjectName}: uygulama ders adı uyuşmuyor`);
      }
      if (examSlots?.length) {
        const uySlot = this._findExamSlotOnDate(examSlots, child.sessionDate, child.startTime, child.endTime);
        if (!uySlot) {
          issues.push(`${parent.subjectName}: uygulama (${child.sessionDate}) sınav takvimi dışında`);
        }
      }
    }
    return { ok: issues.length === 0, issues };
  }

  async verifyMixedSessionPairs(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    const slots = await this.listExamSlots(schoolId, groupId);
    return this._collectMixedPairIssues(groupId, slots);
  }

  /** Uygulama eş oturumu (paired_session_id) — otomatik görevlendirmede atlanır */
  private async _companionSessionIds(groupId: string): Promise<Set<string>> {
    const rows = await this.sessionRepo.find({
      where: { groupId },
      select: ['pairedSessionId'],
    });
    return new Set(rows.map((r) => r.pairedSessionId).filter((id): id is string => !!id));
  }

  private async _copyProctorsToSession(
    fromSessionId: string,
    toSessionId: string,
    opts?: { notify: boolean },
  ) {
    const rows = await this.proctorRepo.find({ where: { sessionId: fromSessionId }, order: { sortOrder: 'ASC' } });
    await this.proctorRepo.delete({ sessionId: toSessionId });
    for (const r of rows) {
      await this.proctorRepo.save(
        this.proctorRepo.create({
          sessionId: toSessionId,
          userId: r.userId,
          role: r.role,
          sortOrder: r.sortOrder,
        }),
      );
    }
    if (opts?.notify !== false) return;
  }

  /** mixed seçildiğinde ertesi gün uygulama oturumu + aynı komisyon */
  private async _syncUygulamaCompanion(schoolId: string, parent: SorumlulukSession): Promise<SorumlulukSession | null> {
    if (parent.sessionType !== 'mixed') {
      if (parent.pairedSessionId) {
        await this._deleteSessionInternal(schoolId, parent.pairedSessionId);
        parent.pairedSessionId = null;
        await this.sessionRepo.save(parent);
      }
      return null;
    }

    const nextDate = this._addCalendarDay(parent.sessionDate);
    let child: SorumlulukSession | null = null;
    if (parent.pairedSessionId) {
      child = await this.sessionRepo.findOne({ where: { id: parent.pairedSessionId, schoolId } });
    }

    if (child) {
      child.subjectName = parent.subjectName;
      child.sessionDate = nextDate;
      child.startTime = this._normalizeTime(parent.startTime);
      child.endTime = this._normalizeTime(parent.endTime);
      child.roomName = parent.roomName;
      child.capacity = parent.capacity;
      child.sessionType = 'uygulama';
      child.status = parent.status;
      await this.sessionRepo.save(child);
    } else {
      child = await this.sessionRepo.save(
        this.sessionRepo.create({
          schoolId,
          groupId: parent.groupId,
          subjectName: parent.subjectName,
          sessionDate: nextDate,
          startTime: this._normalizeTime(parent.startTime),
          endTime: this._normalizeTime(parent.endTime),
          roomName: parent.roomName,
          capacity: parent.capacity,
          sessionType: 'uygulama',
          status: parent.status,
          notes: parent.notes,
        }),
      );
      parent.pairedSessionId = child.id;
      await this.sessionRepo.save(parent);
      const parentStudents = await this.ssRepo.find({ where: { sessionId: parent.id } });
      for (const row of parentStudents) {
        const exists = await this.ssRepo.findOne({ where: { sessionId: child.id, studentId: row.studentId } });
        if (!exists) {
          await this.ssRepo.save(this.ssRepo.create({ sessionId: child.id, studentId: row.studentId }));
        }
      }
    }

    await this._copyProctorsToSession(parent.id, child.id, { notify: false });
    return child;
  }

  private async _deleteSessionInternal(schoolId: string, id: string) {
    const s = await this.sessionRepo.findOne({ where: { id, schoolId } });
    if (!s) return;
    await this.ssRepo.delete({ sessionId: id });
    await this.proctorRepo.delete({ sessionId: id });
    await this.sessionRepo.remove(s);
  }

  private async _mirrorStudentToCompanion(parentSessionId: string, studentId: string, add: boolean) {
    const parent = await this.sessionRepo.findOne({ where: { id: parentSessionId } });
    if (!parent?.pairedSessionId) return;
    const childId = parent.pairedSessionId;
    if (add) {
      const exists = await this.ssRepo.findOne({ where: { sessionId: childId, studentId } });
      if (!exists) await this.ssRepo.save(this.ssRepo.create({ sessionId: childId, studentId }));
    } else {
      await this.ssRepo.delete({ sessionId: childId, studentId });
    }
  }

  async createSession(schoolId: string, groupId: string, dto: CreateSorumlulukSessionDto) {
    await this._requireGroup(schoolId, groupId);
    const subj = normalizeSorumluSubject(dto.subjectName);
    const s = await this.sessionRepo.save(
      this.sessionRepo.create({
        schoolId,
        groupId,
        ...dto,
        subjectName: subj.subjectName,
        startTime: this._normalizeTime(dto.startTime),
        endTime: this._normalizeTime(dto.endTime),
      }),
    );
    const companion = await this._syncUygulamaCompanion(schoolId, s);
    return { ...s, uygulamaCompanion: companion };
  }

  async updateSession(schoolId: string, id: string, dto: Partial<CreateSorumlulukSessionDto> & { status?: string }) {
    const s = await this.sessionRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    const yaziliParent = await this.sessionRepo.findOne({ where: { pairedSessionId: id, schoolId } });
    if (yaziliParent) {
      if (dto.sessionType && dto.sessionType !== 'uygulama') {
        throw new BadRequestException('Uygulama oturumu yazılı eşinden yönetilir.');
      }
      const expectedDate = this._addCalendarDay(yaziliParent.sessionDate);
      if (dto.sessionDate && dto.sessionDate !== expectedDate) {
        throw new BadRequestException(
          `Uygulama sınavı yazılıdan 1 gün sonra olmalı (${expectedDate}). Tarihi yazılı oturumundan değiştirin.`,
        );
      }
      delete dto.sessionDate;
    }
    Object.assign(s, dto);
    if (dto.subjectName) s.subjectName = normalizeSorumluSubject(dto.subjectName).subjectName;
    if (dto.startTime) s.startTime = this._normalizeTime(dto.startTime);
    if (dto.endTime) s.endTime = this._normalizeTime(dto.endTime);
    await this.sessionRepo.save(s);
    const companion = await this._syncUygulamaCompanion(schoolId, s);
    return { ...s, uygulamaCompanion: companion };
  }

  async deleteSession(schoolId: string, id: string) {
    const s = await this.sessionRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    if (s.pairedSessionId) await this._deleteSessionInternal(schoolId, s.pairedSessionId);
    const parent = await this.sessionRepo.findOne({ where: { pairedSessionId: id, schoolId } });
    if (parent) {
      parent.pairedSessionId = null;
      await this.sessionRepo.save(parent);
    }
    await this._deleteSessionInternal(schoolId, id);
  }

  // ── Oturum-öğrenci atamaları ──────────────────────────────────────────────

  async listSessionStudents(schoolId: string, sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) throw new NotFoundException();
    const rows = await this.ssRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
    const studentIds = rows.map((r) => r.studentId);
    const students = studentIds.length ? await this.studentRepo.find({ where: { id: In(studentIds) } }) : [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    return rows.map((r) => ({ ...r, student: sMap.get(r.studentId) }));
  }

  async assignStudentToSession(schoolId: string, sessionId: string, studentId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) throw new NotFoundException('Oturum bulunamadı');
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (!student) throw new NotFoundException('Öğrenci bulunamadı');

    // Çakışma kontrolü: aynı tarih+saatte başka oturumda mı?
    const conflicts = await this._checkConflict(schoolId, studentId, session);
    if (conflicts.length) throw new BadRequestException({ code: 'CONFLICT', message: `Öğrenci çakışıyor: ${conflicts.map((c) => c.subjectName).join(', ')}` });

    const existing = await this.ssRepo.findOne({ where: { sessionId, studentId } });
    if (existing) return existing;

    // subjects içinde sessionId güncelle
    const subj = student.subjects.find((s) => this._subjectKey(s) === this._subjectKey(session.subjectName));
    if (subj) { subj.sessionId = sessionId; await this.studentRepo.save(student); }

    const row = this.ssRepo.create({ sessionId, studentId });
    const saved = await this.ssRepo.save(row);
    await this._mirrorStudentToCompanion(sessionId, studentId, true);
    return saved;
  }

  async removeStudentFromSession(schoolId: string, sessionId: string, studentId: string) {
    await this._mirrorStudentToCompanion(sessionId, studentId, false);
    await this.ssRepo.delete({ sessionId, studentId });
    const student = await this.studentRepo.findOne({ where: { id: studentId, schoolId } });
    if (student) {
      const subj = student.subjects.find((s) => s.sessionId === sessionId);
      if (subj) { subj.sessionId = null; await this.studentRepo.save(student); }
    }
  }

  async updateAttendance(schoolId: string, sessionId: string, studentId: string, status: string) {
    const row = await this.ssRepo.findOne({ where: { sessionId, studentId } });
    if (!row) throw new NotFoundException();
    row.attendanceStatus = status as 'present' | 'absent' | 'excused';
    return this.ssRepo.save(row);
  }

  // ── Otomatik programlama ───────────────────────────────────────────────────

  private _subjectKey(name: string | SubjectEntry): string {
    if (typeof name === 'string') return normalizeSorumluSubject(name).matchKey;
    return subjectMatchKey(name);
  }

  /** Grupta en az bir öğrencinin sorumlu olduğu dersler (matchKey → etiket, sayı). */
  private async _collectSubjectDemand(
    groupId: string,
  ): Promise<Map<string, { displayName: string; studentCount: number }>> {
    const students = await this.studentRepo.find({ where: { groupId } });
    const demand = new Map<string, { displayName: string; studentCount: number }>();
    for (const st of students) {
      for (const subj of st.subjects) {
        const key = this._subjectKey(subj);
        if (!key) continue;
        const prev = demand.get(key);
        if (prev) prev.studentCount++;
        else demand.set(key, { displayName: formatSubjectLabel(subj), studentCount: 1 });
      }
    }
    return demand;
  }

  /** Öğrencisi kalmayan ders oturumlarını kaldırır (planlama yalnızca talep olan dersler). */
  private async _pruneSessionsWithoutDemand(schoolId: string, groupId: string): Promise<number> {
    const demand = await this._collectSubjectDemand(groupId);
    const demandKeys = new Set(demand.keys());
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    let removed = 0;
    for (const ses of sessions) {
      if (demandKeys.has(this._subjectKey(ses.subjectName))) continue;
      await this.deleteSession(schoolId, ses.id);
      removed++;
    }
    return removed;
  }

  private _pdfSubjectName(name: string): string {
    return formatSubjectLabel(normalizeSorumluSubject(name));
  }

  /** Kapasite yetmeyen dersler için takvim slotlarından ek oturum açar. */
  private async _ensureSessionsForDemand(
    schoolId: string,
    groupId: string,
    mixedSubjectKeys?: Set<string>,
  ): Promise<{ created: number; capacityShortfall: string[] }> {
    const students = await this.studentRepo.find({ where: { groupId } });
    const slots = await this.listExamSlots(schoolId, groupId);
    if (!slots.length || !students.length) return { created: 0, capacityShortfall: [] };

    let sessions = await this.sessionRepo.find({
      where: { groupId },
      order: { sessionDate: 'ASC', startTime: 'ASC' },
    });

    const demand = new Map<string, { count: number; displayName: string }>();
    for (const st of students) {
      for (const subj of st.subjects) {
        const key = this._subjectKey(subj);
        if (!key) continue;
        const prev = demand.get(key);
        if (prev) prev.count++;
        else demand.set(key, { count: 1, displayName: formatSubjectLabel(subj) });
      }
    }

    let created = 0;
    const capacityShortfall: string[] = [];

    for (const [key, { count, displayName }] of demand) {
      let subjectSessions = sessions.filter((s) => this._subjectKey(s.subjectName) === key);
      let totalCap = subjectSessions.reduce((sum, s) => sum + (s.capacity || 30), 0);

      const isMixedSubject = mixedSubjectKeys?.has(key) ?? false;
      while (totalCap < count) {
        const slot = this._findSlotForExtraSession(slots, subjectSessions, sessions, isMixedSubject);
        if (!slot) {
          capacityShortfall.push(displayName);
          break;
        }
        const sessionType = this._resolveSessionType(displayName, mixedSubjectKeys, sessions);
        let row = await this.sessionRepo.save(
          this.sessionRepo.create({
            schoolId,
            groupId,
            subjectName: displayName,
            sessionDate: slot.sessionDate,
            startTime: this._normalizeTime(slot.startTime),
            endTime: this._normalizeTime(slot.endTime),
            roomName: slot.roomName,
            capacity: slot.capacity || 30,
            sessionType,
          }),
        );
        if (sessionType === 'mixed') {
          row = (await this._syncUygulamaCompanion(schoolId, row)) ?? row;
        }
        sessions.push(row);
        subjectSessions.push(row);
        totalCap += row.capacity || 30;
        created++;
      }
    }

    return { created, capacityShortfall };
  }

  private _findSlotForExtraSession(
    slots: SorumlulukExamSlot[],
    existingForSubject: SorumlulukSession[],
    allGroupSessions: SorumlulukSession[],
    requireMixedPair = false,
  ): SorumlulukExamSlot | null {
    const usedSlotIds = new Set<string>();
    this._markUsedSlotsFromSessions(slots, allGroupSessions, usedSlotIds);
    for (const s of existingForSubject) {
      const match = this._findExamSlotOnDate(slots, s.sessionDate, s.startTime, s.endTime);
      if (match) this._reserveSlotsForSession(usedSlotIds, match, slots, s.sessionType === 'mixed');
    }
    return this._pickExamSlotForSession(slots, usedSlotIds, allGroupSessions, requireMixedPair);
  }

  async autoSchedule(schoolId: string, groupId: string, mixedSubjectKeys?: Set<string>) {
    await this._requireGroup(schoolId, groupId);
    await this._pruneSessionsWithoutDemand(schoolId, groupId);
    const students = await this.studentRepo.find({ where: { groupId } });
    const total = students.reduce((acc, s) => acc + s.subjects.length, 0);

    if (!total) {
      return {
        assigned: 0,
        total: 0,
        unassigned: 0,
        conflicts: 0,
        timeConflicts: 0,
        sessionsCreated: 0,
        missingSubjects: [] as string[],
        capacityShortfall: [] as string[],
        messages: ['Grupta sorumlu ders kaydı yok.'],
      };
    }

    const ensure = await this._ensureSessionsForDemand(schoolId, groupId, mixedSubjectKeys);
    let sessions = await this.sessionRepo.find({
      where: { groupId },
      order: { sessionDate: 'ASC', startTime: 'ASC' },
    });

    if (!sessions.length) {
      const missingSubjects = [
        ...new Set(students.flatMap((st) => st.subjects.map((x) => x.subjectName.trim()).filter(Boolean))),
      ];
      return {
        assigned: 0,
        total,
        unassigned: total,
        conflicts: total,
        timeConflicts: 0,
        sessionsCreated: ensure.created,
        missingSubjects,
        capacityShortfall: ensure.capacityShortfall,
        messages: ['Önce Takvim slotları ve Oturumlar tanımlayın.'],
      };
    }

    for (const st of students) {
      st.subjects = st.subjects.map((s) => ({ ...s, sessionId: null }));
    }
    await this.ssRepo.delete({ sessionId: In(sessions.map((s) => s.id)) });

    const demand = await this._collectSubjectDemand(groupId);
    const companionIds = await this._companionSessionIds(groupId);
    const subjectSessionMap = new Map<string, SorumlulukSession[]>();
    for (const ses of sessions) {
      if (companionIds.has(ses.id)) continue;
      const key = this._subjectKey(ses.subjectName);
      if (!demand.has(key)) continue;
      const arr = subjectSessionMap.get(key) ?? [];
      arr.push(ses);
      subjectSessionMap.set(key, arr);
    }

    const enrollment = new Map<string, number>();
    for (const ses of sessions) enrollment.set(ses.id, 0);

    const missingSubjects = new Set<string>();
    let assigned = 0;
    let unassigned = 0;

    const sortedStudents = [...students].sort((a, b) => b.subjects.length - a.subjects.length);

    for (const student of sortedStudents) {
      const scheduledSlots: Array<{ date: string; start: string; end: string }> = [];

      const subjectOrder = student.subjects
        .map((subj, idx) => ({
          subj,
          idx,
          key: this._subjectKey(subj),
        }))
        .sort((a, b) => {
          const ca = (subjectSessionMap.get(a.key) ?? []).length;
          const cb = (subjectSessionMap.get(b.key) ?? []).length;
          return ca - cb;
        });

      for (const { subj, idx, key } of subjectOrder) {
        if (!key) {
          unassigned++;
          continue;
        }

        const candidates = (subjectSessionMap.get(key) ?? [])
          .filter((ses) => (enrollment.get(ses.id) ?? 0) < (ses.capacity || 30))
          .filter(
            (ses) =>
              !scheduledSlots.some(
                (slot) =>
                  slot.date === ses.sessionDate &&
                  this._timesOverlap(slot.start, slot.end, ses.startTime, ses.endTime),
              ),
          )
          .sort((a, b) => (enrollment.get(a.id) ?? 0) - (enrollment.get(b.id) ?? 0));

        if (!candidates.length) {
          if (!(subjectSessionMap.get(key)?.length)) missingSubjects.add(subj.subjectName.trim());
          unassigned++;
          continue;
        }

        const found = candidates[0];
        await this.ssRepo.save(this.ssRepo.create({ sessionId: found.id, studentId: student.id }));
        await this._mirrorStudentToCompanion(found.id, student.id, true);
        student.subjects[idx].sessionId = found.id;
        enrollment.set(found.id, (enrollment.get(found.id) ?? 0) + 1);
        scheduledSlots.push({
          date: found.sessionDate,
          start: found.startTime,
          end: found.endTime,
        });
        if (found.sessionType === 'mixed' && found.pairedSessionId) {
          const companion = sessions.find((s) => s.id === found.pairedSessionId);
          if (companion) {
            scheduledSlots.push({
              date: companion.sessionDate,
              start: companion.startTime,
              end: companion.endTime,
            });
          }
        }
        assigned++;
      }
      await this.studentRepo.save(student);
    }

    const timeConflicts = (await this.getConflicts(schoolId, groupId)).length;
    const messages: string[] = [];
    if (assigned === total && timeConflicts === 0) {
      messages.push(`Tüm sorumlu dersler atandı (${assigned}/${total}). Zaman çakışması yok.`);
    } else {
      if (unassigned > 0) messages.push(`${unassigned} ders ataması yapılamadı.`);
      if (timeConflicts > 0) messages.push(`${timeConflicts} öğrencide zaman çakışması var.`);
      if (missingSubjects.size) messages.push(`Oturumsuz ders: ${[...missingSubjects].slice(0, 5).join(', ')}${missingSubjects.size > 5 ? '…' : ''}`);
      if (ensure.capacityShortfall.length) {
        messages.push(`Kapasite/slot yetersiz: ${ensure.capacityShortfall.slice(0, 5).join(', ')}${ensure.capacityShortfall.length > 5 ? '…' : ''}`);
      }
      if (ensure.created > 0) messages.push(`${ensure.created} ek oturum oluşturuldu.`);
    }

    return {
      assigned,
      total,
      unassigned,
      conflicts: unassigned,
      timeConflicts,
      sessionsCreated: ensure.created,
      missingSubjects: [...missingSubjects],
      capacityShortfall: ensure.capacityShortfall,
      messages,
    };
  }

  async getConflicts(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    const students = await this.studentRepo.find({ where: { groupId } });
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const sMap = new Map(sessions.map((s) => [s.id, s]));

    const result: Array<{ studentName: string; studentNumber: string | null; conflictingSubjects: string[] }> = [];
    for (const st of students) {
      const assignedSessions = st.subjects.filter((s) => s.sessionId).map((s) => sMap.get(s.sessionId!)).filter(Boolean) as SorumlulukSession[];
      const conflicting = new Set<string>();
      for (let a = 0; a < assignedSessions.length; a++) {
        for (let b = a + 1; b < assignedSessions.length; b++) {
          const sa = assignedSessions[a]; const sb = assignedSessions[b];
          if (sa.sessionDate === sb.sessionDate && this._timesOverlap(sa.startTime, sa.endTime, sb.startTime, sb.endTime)) {
            conflicting.add(sa.subjectName);
            conflicting.add(sb.subjectName);
          }
        }
      }
      if (conflicting.size) result.push({ studentName: st.studentName, studentNumber: st.studentNumber, conflictingSubjects: [...conflicting] });
    }
    return result;
  }

  // ── Görevlendirme ─────────────────────────────────────────────────────────

  async setProctors(schoolId: string, sessionId: string, proctors: Array<{ userId: string; role: 'komisyon_uye' | 'gozcu'; sortOrder?: number }>) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) throw new NotFoundException();
    const oldRows = await this.proctorRepo.find({ where: { sessionId } });
    const oldUserIds = new Set(oldRows.map((r) => r.userId));
    await this.proctorRepo.delete({ sessionId });
    for (const [i, p] of proctors.entries()) {
      await this.proctorRepo.save(this.proctorRepo.create({ sessionId, userId: p.userId, role: p.role, sortOrder: p.sortOrder ?? i }));
    }
    const group = await this.groupRepo.findOne({ where: { id: session.groupId } });
    const groupTitle = group?.title?.trim() || 'Sorumluluk / beceri sınavı';
    const newUserIds = [...new Set(proctors.map((p) => p.userId))];
    for (const userId of newUserIds) {
      if (oldUserIds.has(userId)) continue;
      const roleLabel = proctors.find((p) => p.userId === userId)?.role === 'gozcu' ? 'Gözcü' : 'Komisyon üyesi';
      await this.notificationsService.createInboxEntry({
        user_id: userId,
        event_type: 'sorumluluk_exam.proctor_assigned',
        entity_id: sessionId,
        target_screen: 'sorumluluk-sinav/bilgilendirme',
        title: 'Sorumluluk sınavı görevi',
        body: `"${groupTitle}" — ${session.subjectName} (${this._formatSessionWhen(session)}): ${roleLabel}.`,
        metadata: { group_id: session.groupId, session_id: sessionId, school_id: schoolId },
      });
    }
    if (session.pairedSessionId) {
      await this._copyProctorsToSession(sessionId, session.pairedSessionId, { notify: false });
    } else {
      const parent = await this.sessionRepo.findOne({ where: { pairedSessionId: sessionId, schoolId } });
      if (parent) await this._copyProctorsToSession(parent.id, sessionId, { notify: false });
    }
    return this.proctorRepo.find({ where: { sessionId }, order: { sortOrder: 'ASC' } });
  }

  private _formatSessionWhen(session: SorumlulukSession): string {
    const d = session.sessionDate;
    const t0 = session.startTime?.slice(0, 5) ?? '';
    const t1 = session.endTime?.slice(0, 5) ?? '';
    return t0 && t1 ? `${d} ${t0}–${t1}` : d;
  }

  async listTeachers(schoolId: string) {
    return this.userRepo.find({ where: { school_id: schoolId, role: UserRole.teacher }, order: { display_name: 'ASC' } });
  }

  async autoAssignProctors(
    schoolId: string,
    groupId: string,
    opts: {
      komisyonPerSession: number;
      gozcuPerSession: number;
      preferBranchMatch: boolean;
      excludeBusy: boolean;
      balanceLoad: boolean;
      overwrite: boolean;
      useSmartRules?: boolean;
    },
  ) {
    const group = await this._requireGroup(schoolId, groupId);
    const proctorRules = mergeProctorRules({
      ...this._proctorRules(group),
      ...(opts.useSmartRules === false ? { useSmartRules: false } : {}),
    });
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const teachers = await this.userRepo.find({ where: { school_id: schoolId, role: UserRole.teacher }, order: { display_name: 'ASC' } });
    if (!teachers.length) return { assigned: 0, sessions: 0 };

    const school = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: [
        'lesson_schedule',
        'lesson_schedule_pm',
        'duty_education_mode',
        'lesson_schedule_weekend',
        'lesson_schedule_weekend_pm',
      ],
    });
    const bellScheduleCache = new Map<string, Array<{ lesson_num: number; start_time: string; end_time: string }>>();
    const getBellSchedule = (date: string) => {
      const key = date.slice(0, 10);
      if (!bellScheduleCache.has(key)) {
        bellScheduleCache.set(key, this._effectiveLessonSchedule(school, this._dayOfWeek(key)));
      }
      return bellScheduleCache.get(key)!;
    };

    // Active timetable plan ids per date (cache)
    const activePlanCache = new Map<string, string | null>();
    const getActivePlan = async (date: string): Promise<string | null> => {
      if (activePlanCache.has(date)) return activePlanCache.get(date)!;
      const plan = await this.timetablePlanRepo
        .createQueryBuilder('p')
        .select('p.id')
        .where('p.school_id = :schoolId', { schoolId })
        .andWhere('p.status IN (:...statuses)', { statuses: ['published'] })
        .andWhere('p.valid_from <= :date', { date })
        .andWhere('(p.valid_until IS NULL OR p.valid_until >= :date)', { date })
        .orderBy('p.valid_from', 'DESC')
        .getOne();
      const id = plan?.id ?? null;
      activePlanCache.set(date, id);
      return id;
    };

    // Timetable entries indexed by date => userId => lesson slots
    const timetableCache = new Map<string, Map<string, number[]>>();
    const getTimetableForDate = async (date: string): Promise<Map<string, number[]>> => {
      if (timetableCache.has(date)) return timetableCache.get(date)!;
      const dow = this._dayOfWeek(date);
      const planId = await getActivePlan(date);
      const rows = await this.timetableRepo.find({
        where: { school_id: schoolId, day_of_week: dow, ...(planId ? { plan_id: planId } : { plan_id: IsNull() }) },
        select: ['user_id', 'lesson_num'],
      });
      const map = new Map<string, number[]>();
      for (const r of rows) {
        const uid = String(r.user_id);
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid)!.push(r.lesson_num);
      }
      timetableCache.set(date, map);
      return map;
    };

    // Load counter for balancing
    const loadCount = new Map<string, number>(teachers.map((t) => [t.id, 0]));

    let assignedSessions = 0;

    const groupTitle = group.title?.trim() || 'Sorumluluk / beceri sınavı';
    const companionIds = await this._companionSessionIds(groupId);

    const studentCountBySession = new Map<string, number>();
    for (const s of sessions) {
      studentCountBySession.set(s.id, await this.ssRepo.count({ where: { sessionId: s.id } }));
    }

    /** Aynı saatte çakışan oturumlarda öğretmen tekrar atanmasın */
    const assignedBySession = new Map<string, Set<string>>();

    const teachersBusyAtSession = (session: SorumlulukSession): Set<string> => {
      const busy = new Set<string>();
      for (const other of sessions) {
        if (other.id === session.id) continue;
        if (!sessionsOverlapForProctorConflict(session, other)) continue;
        const ids = assignedBySession.get(other.id);
        if (ids) for (const id of ids) busy.add(id);
      }
      return busy;
    };

    const markTeachersAssigned = (session: SorumlulukSession, userIds: string[]) => {
      assignedBySession.set(session.id, new Set(userIds));
    };

    for (const session of sessions) {
      if (companionIds.has(session.id)) continue;
      // Skip if already has proctors and overwrite is off
      const existingCount = await this.proctorRepo.count({ where: { sessionId: session.id } });
      if (existingCount > 0 && !opts.overwrite) continue;

      const prevRows = await this.proctorRepo.find({ where: { sessionId: session.id } });
      const prevUserIds = new Set(prevRows.map((r) => r.userId));

      const timetable = await getTimetableForDate(session.sessionDate);
      const examStart = session.startTime?.slice(0, 5) ?? '08:00';
      const examEnd = session.endTime?.slice(0, 5) ?? '09:00';
      const bellSchedule = getBellSchedule(session.sessionDate);
      const overlappingLessonNums = this._lessonNumsOverlappingExam(bellSchedule, examStart, examEnd);

      const studentCount = studentCountBySession.get(session.id) ?? 0;
      const needs = computeSessionProctorNeeds(
        session,
        sessions,
        studentCount,
        companionIds,
        proctorRules,
      );
      const komisyonTarget = proctorRules.useSmartRules
        ? needs.komisyon
        : opts.komisyonPerSession;
      const gozcuTarget = proctorRules.useSmartRules
        ? needs.gozcu
        : opts.gozcuPerSession;

      const sameTimeBusy = teachersBusyAtSession(session);

      // Normalize subject for branch matching
      const subjNorm = session.subjectName.toLowerCase().replace(/[^a-züğışöçı]/gi, '');

      const scored = teachers.map((t) => {
        let score = 0;
        if (sameTimeBusy.has(t.id)) return { t, score: -9999 };

        const teacherLessons = timetable.get(t.id) ?? [];
        const busyAllDay = teacherLessons.length > 0;
        const busyAtExam =
          opts.excludeBusy &&
          (overlappingLessonNums.length > 0
            ? this._teacherBusyAtExamTime(teacherLessons, overlappingLessonNums)
            : busyAllDay);

        if (busyAtExam) return { t, score: -9999 };

        if (opts.preferBranchMatch && t.teacherBranch) {
          const branchNorm = t.teacherBranch.toLowerCase().replace(/[^a-züğışöçı]/gi, '');
          if (branchNorm.includes(subjNorm) || subjNorm.includes(branchNorm)) score += 30;
        }

        if (!busyAtExam && !busyAllDay) score += 10;
        else if (!busyAtExam && busyAllDay) score += 3;
        else score -= 5;

        if (opts.balanceLoad) score -= (loadCount.get(t.id) ?? 0) * 5;

        return { t, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const eligible = scored.filter((s) => s.score > -9999);

      const komisyon = eligible.slice(0, komisyonTarget).map((s) => s.t);
      const gozcu = eligible.slice(komisyonTarget, komisyonTarget + gozcuTarget).map((s) => s.t);

      if (komisyon.length === 0 && gozcu.length === 0) continue;

      await this.proctorRepo.delete({ sessionId: session.id });
      let order = 0;
      for (const t of komisyon) {
        await this.proctorRepo.save(this.proctorRepo.create({ sessionId: session.id, userId: t.id, role: 'komisyon_uye', sortOrder: order++ }));
        loadCount.set(t.id, (loadCount.get(t.id) ?? 0) + 1);
      }
      for (const t of gozcu) {
        await this.proctorRepo.save(this.proctorRepo.create({ sessionId: session.id, userId: t.id, role: 'gozcu', sortOrder: order++ }));
        loadCount.set(t.id, (loadCount.get(t.id) ?? 0) + 1);
      }

      for (const t of komisyon) {
        if (prevUserIds.has(t.id)) continue;
        await this.notificationsService.createInboxEntry({
          user_id: t.id,
          event_type: 'sorumluluk_exam.proctor_assigned',
          entity_id: session.id,
          target_screen: 'sorumluluk-sinav/bilgilendirme',
          title: 'Sorumluluk sınavı görevi',
          body: `"${groupTitle}" — ${session.subjectName} (${this._formatSessionWhen(session)}): Komisyon üyesi (otomatik atama).`,
          metadata: { group_id: session.groupId, session_id: session.id, school_id: schoolId },
        });
      }
      for (const t of gozcu) {
        if (prevUserIds.has(t.id)) continue;
        await this.notificationsService.createInboxEntry({
          user_id: t.id,
          event_type: 'sorumluluk_exam.proctor_assigned',
          entity_id: session.id,
          target_screen: 'sorumluluk-sinav/bilgilendirme',
          title: 'Sorumluluk sınavı görevi',
          body: `"${groupTitle}" — ${session.subjectName} (${this._formatSessionWhen(session)}): Gözcü (otomatik atama).`,
          metadata: { group_id: session.groupId, session_id: session.id, school_id: schoolId },
        });
      }

      markTeachersAssigned(
        session,
        [...komisyon, ...gozcu].map((t) => t.id),
      );

      if (session.pairedSessionId) {
        await this._copyProctorsToSession(session.id, session.pairedSessionId, { notify: false });
      }

      assignedSessions++;
    }

    return { assigned: assignedSessions, total: sessions.length };
  }

  private _dayOfWeek(dateStr: string): number {
    const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
    const dow = d.getDay(); // 0=Sun,1=Mon..6=Sat
    return dow === 0 ? 7 : dow; // map to 1=Mon..7=Sun
  }

  private static readonly DEFAULT_LESSON_SCHEDULE: Array<{ lesson_num: number; start_time: string; end_time: string }> = [
    { lesson_num: 1, start_time: '08:30', end_time: '09:10' },
    { lesson_num: 2, start_time: '09:20', end_time: '10:00' },
    { lesson_num: 3, start_time: '10:10', end_time: '10:50' },
    { lesson_num: 4, start_time: '11:00', end_time: '11:40' },
    { lesson_num: 5, start_time: '13:40', end_time: '14:20' },
    { lesson_num: 6, start_time: '14:30', end_time: '15:10' },
    { lesson_num: 7, start_time: '15:20', end_time: '16:00' },
    { lesson_num: 8, start_time: '16:10', end_time: '16:50' },
    { lesson_num: 9, start_time: '17:00', end_time: '17:40' },
    { lesson_num: 10, start_time: '17:50', end_time: '18:30' },
  ];

  private _effectiveLessonSchedule(
    school: Pick<
      School,
      'lesson_schedule' | 'lesson_schedule_pm' | 'duty_education_mode' | 'lesson_schedule_weekend' | 'lesson_schedule_weekend_pm'
    > | null,
    turkishDow: number,
  ): Array<{ lesson_num: number; start_time: string; end_time: string }> {
    const mode = school?.duty_education_mode === 'double' ? 'double' : 'single';
    const isWknd = turkishDow === 6 || turkishDow === 7;
    const wdAm =
      school?.lesson_schedule?.length
        ? [...school.lesson_schedule].sort((a, b) => a.lesson_num - b.lesson_num)
        : SorumlulukExamService.DEFAULT_LESSON_SCHEDULE;
    const am =
      isWknd && school?.lesson_schedule_weekend?.length
        ? [...school.lesson_schedule_weekend].sort((a, b) => a.lesson_num - b.lesson_num)
        : wdAm;
    if (mode !== 'double') return am;
    const wdPm = school?.lesson_schedule_pm?.length ? school.lesson_schedule_pm : [];
    const pm =
      isWknd && school?.lesson_schedule_weekend_pm?.length
        ? school.lesson_schedule_weekend_pm
        : wdPm;
    const byNum = new Map<number, { lesson_num: number; start_time: string; end_time: string }>();
    for (const s of am) byNum.set(s.lesson_num, s);
    for (const s of pm) byNum.set(s.lesson_num, s);
    return [...byNum.values()].sort((a, b) => a.lesson_num - b.lesson_num);
  }

  private _toMinutes(t: string): number {
    const s = String(t ?? '').trim().slice(0, 5);
    const [h, m] = s.split(':').map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
  }

  private _clockRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return this._toMinutes(startA) < this._toMinutes(endB) && this._toMinutes(startB) < this._toMinutes(endA);
  }

  /** Sınav aralığıyla çakışan ders numaraları (okul ders çizelgesi). */
  private _lessonNumsOverlappingExam(
    schedule: Array<{ lesson_num: number; start_time: string; end_time: string }>,
    examStart: string,
    examEnd: string,
  ): number[] {
    const out: number[] = [];
    for (const slot of schedule) {
      if (this._clockRangesOverlap(examStart, examEnd, slot.start_time, slot.end_time)) {
        out.push(slot.lesson_num);
      }
    }
    return out;
  }

  private _teacherBusyAtExamTime(teacherLessonNums: number[], overlappingLessonNums: number[]): boolean {
    if (!overlappingLessonNums.length) return false;
    const set = new Set(overlappingLessonNums);
    return teacherLessonNums.some((n) => set.has(n));
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  async buildYoklamaPdf(schoolId: string, sessionId: string): Promise<Uint8Array> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) throw new NotFoundException();
    const group = await this.groupRepo.findOne({ where: { id: session.groupId } });
    if (!group) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const belge = await this._pdfBelge(schoolId, group);
    const rows = await this.listSessionStudents(schoolId, sessionId);
    return this.pdf.buildYoklamaPdf({
      groupTitle: group.title,
      schoolName: school?.name ?? undefined,
      belge,
      subjectName: this._pdfSubjectName(session.subjectName),
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      roomName: session.roomName ?? '',
      rows: rows.map((r, i) => ({
        sira: i + 1,
        studentName: r.student?.studentName ?? '',
        studentNumber: r.student?.studentNumber ?? null,
        className: r.student?.className ?? null,
        attendanceStatus: r.attendanceStatus ?? null,
      })),
    });
  }

  async buildProgramPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const sessionData = await Promise.all(sessions.map(async (s) => {
      const count = await this.ssRepo.count({ where: { sessionId: s.id } });
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      const users = proctors.length ? await this.userRepo.find({ where: { id: In(proctors.map((p) => p.userId)) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return {
        ...s,
        subjectName: this._pdfSubjectName(s.subjectName),
        studentCount: count,
        proctors: proctors.map((p) => ({ role: p.role, name: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })),
      };
    }));
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildProgramPdf({ group, schoolName: school?.name ?? undefined, belge, sessions: sessionData });
  }

  async buildOgrenciProgramPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const students = await this.studentRepo.find({ where: { groupId }, order: { className: 'ASC', studentName: 'ASC' } });
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const sMap = new Map(sessions.map((s) => [s.id, s]));
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildOgrenciProgramPdf({
      group,
      schoolName: school?.name ?? undefined,
      belge,
      students: students.map((st) => ({
        studentName: st.studentName,
        studentNumber: st.studentNumber,
        className: st.className,
        subjects: st.subjects.map((s) => ({
          subjectName: formatSubjectLabel(s),
          session: s.sessionId ? sMap.get(s.sessionId) ?? null : null,
        })),
      })),
    });
  }

  async buildGorevlendirmePdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const data = await Promise.all(sessions.map(async (s) => {
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      const users = proctors.length ? await this.userRepo.find({ where: { id: In(proctors.map((p) => p.userId)) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return {
        ...s,
        subjectName: this._pdfSubjectName(s.subjectName),
        proctors: proctors.map((p) => ({ role: p.role, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })),
      };
    }));
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildGorevlendirmePdf({ group, schoolName: school?.name ?? undefined, belge, sessions: data });
  }

  // ── Yardımcılar ───────────────────────────────────────────────────────────

  private async _requireGroup(schoolId: string, groupId: string) {
    const g = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!g) throw new NotFoundException('Grup bulunamadı');
    return g;
  }

  private async _checkConflict(schoolId: string, studentId: string, newSession: SorumlulukSession): Promise<SorumlulukSession[]> {
    const existing = await this.ssRepo.find({ where: { studentId } });
    if (!existing.length) return [];
    const sessionIds = existing.map((r) => r.sessionId);
    const sessions = await this.sessionRepo.find({ where: { id: In(sessionIds), schoolId } });
    return sessions.filter((s) => s.id !== newSession.id && s.sessionDate === newSession.sessionDate && this._timesOverlap(s.startTime, s.endTime, newSession.startTime, newSession.endTime));
  }

  private _timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    return s1 < e2 && s2 < e1;
  }

  /** MEB e-okul öğrenci listesini içe aktarır; opsiyonel olarak oturum oluşturur ve dağıtır */
  async importMebAndPlan(
    schoolId: string,
    groupId: string,
    rows: Array<{ studentName: string; studentNumber?: string; className?: string; subjects?: string[] }>,
    opts: { createSessions: boolean; autoSchedule: boolean; mixedSubjectKeys?: Set<string> },
  ) {
    await this._requireGroup(schoolId, groupId);

    // 1. Öğrencileri kaydet
    const importResult = await this.importStudents(schoolId, groupId, rows);
    const sessionsPruned = await this._pruneSessionsWithoutDemand(schoolId, groupId);

    // 2. Yalnızca öğrencisi olan dersler → slotlara göre oturum
    let sessionsCreated = 0;
    let sessionsSkipped: string[] = [];
    let slotsMissing = false;
    const demand = await this._collectSubjectDemand(groupId);
    const subjectsWithStudents = [...demand.values()].map((d) => d.displayName);
    if (opts.createSessions) {
      try {
        const slotResult = await this.createSessionsFromSlots(
          schoolId,
          groupId,
          subjectsWithStudents,
          opts.mixedSubjectKeys,
        );
        sessionsCreated = slotResult.created;
        sessionsSkipped = slotResult.skipped;
      } catch (e) {
        if (e instanceof BadRequestException && (e.getResponse() as { code?: string })?.code === 'NO_SLOTS') {
          slotsMissing = true;
          sessionsSkipped = subjectsWithStudents;
        } else {
          throw e;
        }
      }
    }

    if (opts.mixedSubjectKeys?.size) {
      await this._applyMixedSessionTypes(schoolId, groupId, opts.mixedSubjectKeys);
    }

    // 3. Otomatik dağıt
    let schedResult = {
      assigned: 0,
      conflicts: 0,
      total: 0,
      unassigned: 0,
      timeConflicts: 0,
    };
    if (opts.autoSchedule && !slotsMissing) {
      schedResult = await this.autoSchedule(schoolId, groupId, opts.mixedSubjectKeys);
    }

    const sessionsTotal = await this.sessionRepo.count({ where: { groupId } });
    const examSlots = await this.listExamSlots(schoolId, groupId);
    const mixedPairs = await this._collectMixedPairIssues(groupId, examSlots);

    return {
      imported: importResult.imported,
      created: importResult.created,
      updated: importResult.updated,
      sessionsPruned,
      sessionsCreated,
      sessionsTotal,
      sessionsSkipped,
      slotsMissing,
      mixedPairsOk: mixedPairs.ok,
      mixedPairIssues: mixedPairs.issues,
      ...schedResult,
    };
  }

  private _normalizeTime(t: string): string {
    const s = String(t ?? '').trim();
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
    return s;
  }

  private async _getSchoolName(schoolId: string) {
    return (await this.schoolRepo.findOne({ where: { id: schoolId } }))?.name ?? undefined;
  }

  private async _pdfBelge(schoolId: string, group: SorumlulukGroup) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const admins = await loadSchoolAdminsForBelge(this.userRepo, schoolId);
    return resolveSorumlulukPdfBelge(school, group, admins);
  }

  private async _getProctorData(sessions: SorumlulukSession[]) {
    return Promise.all(sessions.map(async (s) => {
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      const users = proctors.length ? await this.userRepo.find({ where: { id: In(proctors.map((p) => p.userId)) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return { ...s, proctors: proctors.map((p) => ({ role: p.role, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })) };
    }));
  }

  /** Öğretmen listesi + komisyon/gözcü sayıları */
  private async _getTeacherDuties(groupId: string) {
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const proctorMap = new Map<string, { displayName: string; komisyon: number; gozcu: number }>();
    for (const s of sessions) {
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id } });
      for (const p of proctors) {
        const user = await this.userRepo.findOne({ where: { id: p.userId } });
        const name = user?.display_name ?? user?.email ?? p.userId;
        const entry = proctorMap.get(p.userId) ?? { displayName: name, komisyon: 0, gozcu: 0 };
        if (p.role === 'komisyon_uye') entry.komisyon++;
        else if (p.role === 'gozcu') entry.gozcu++;
        proctorMap.set(p.userId, entry);
      }
    }
    return [...proctorMap.values()];
  }

  async buildImzaSirkuluPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });

    // Her öğretmen için görev listesi
    const teacherMap = new Map<string, { displayName: string; sessions: Array<{ subjectName: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null; role: string }> }>();
    for (const s of sessions) {
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      for (const p of proctors) {
        const user = await this.userRepo.findOne({ where: { id: p.userId } });
        const name = user?.display_name ?? user?.email ?? p.userId;
        const entry = teacherMap.get(p.userId) ?? { displayName: name, sessions: [] };
        entry.sessions.push({
          subjectName: this._pdfSubjectName(s.subjectName),
          sessionDate: s.sessionDate,
          startTime: s.startTime,
          endTime: s.endTime,
          roomName: s.roomName,
          role: p.role,
        });
        teacherMap.set(p.userId, entry);
      }
    }
    const teachers = [...teacherMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildImzaSirkuluPdf({ group, schoolName, belge, teachers });
  }

  async buildGorevDagilimPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const teachers = await this._getTeacherDuties(groupId);
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildGorevDagilimPdf({ group, schoolName, belge, teachers });
  }

  async buildEkUcretOnayPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const teachers = await this._getTeacherDuties(groupId);
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildEkUcretOnayPdf({ group, schoolName, belge, teachers });
  }

  async buildTutanakPdf(schoolId: string, groupId: string, pdfOptions?: TutanakPdfOptions): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    let filtered = pdfOptions
      ? sessions.filter((s) => sessionMatchesTutanakFilter(s, group, pdfOptions.sessionFilter))
      : sessions;
    if (pdfOptions?.sessionIds?.size) {
      filtered = filtered.filter((s) => pdfOptions.sessionIds!.has(s.id));
    }
    if (!filtered.length) {
      throw new BadRequestException(
        pdfOptions?.sessionIds?.size
          ? 'Seçilen sınav oturumları bulunamadı.'
          : 'Seçilen oturum türü için oturum bulunamadı.',
      );
    }
    if (pdfOptions && !pdfOptions.evrak.size) {
      throw new BadRequestException('En az bir evrak türü seçin.');
    }
    const data = await Promise.all(filtered.map(async (s) => {
      const count = await this.ssRepo.count({ where: { sessionId: s.id } });
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      const users = proctors.length ? await this.userRepo.find({ where: { id: In(proctors.map((p) => p.userId)) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return {
        ...s,
        subjectName: this._pdfSubjectName(s.subjectName),
        studentCount: count,
        proctors: proctors.map((p) => ({ role: p.role, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })),
      };
    }));
    const belge = await this._pdfBelge(schoolId, group);
    return this.pdf.buildTutanakPdf({ group, schoolName, belge, sessions: data, pdfOptions });
  }

  buildStudentExcelTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Adı Soyadı', 'No', 'Sınıf', 'Ders1', 'Ders2', 'Ders3'],
      ['Ahmet Yılmaz', '101', '11-A', '9 MATEMATİK', '10 MATEMATİK', ''],
      ['Ayşe Demir', '102', '10-B', 'Kimya', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
