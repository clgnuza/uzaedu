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
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetable } from '../teacher-timetable/entities/teacher-timetable.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { UserRole } from '../types/enums';
import { CreateSorumlulukGroupDto } from './dto/create-group.dto';
import { CreateSorumlulukStudentDto } from './dto/create-student.dto';
import { CreateSorumlulukSessionDto } from './dto/create-session.dto';
import { SorumlulukExamPdfService } from './sorumluluk-exam-pdf.service';
import { NotificationsService } from '../notifications/notifications.service';

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

  async updateGroup(schoolId: string, id: string, dto: Partial<CreateSorumlulukGroupDto> & { status?: string }) {
    const g = await this.groupRepo.findOne({ where: { id, schoolId } });
    if (!g) throw new NotFoundException();
    Object.assign(g, dto);
    return this.groupRepo.save(g);
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
    const s = this.studentRepo.create({ schoolId, groupId, ...dto, subjects: dto.subjects ?? [] });
    return this.studentRepo.save(s);
  }

  async updateStudent(schoolId: string, id: string, dto: Partial<CreateSorumlulukStudentDto>) {
    const s = await this.studentRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    Object.assign(s, dto);
    return this.studentRepo.save(s);
  }

  async deleteStudent(schoolId: string, id: string) {
    const s = await this.studentRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    await this.ssRepo.delete({ studentId: id });
    await this.studentRepo.remove(s);
  }

  /** Excel import: rows = [{studentName, studentNumber?, className?, subjects?[]}] */
  async importStudents(schoolId: string, groupId: string, rows: Array<{ studentName: string; studentNumber?: string; className?: string; subjects?: string[] }>) {
    await this._requireGroup(schoolId, groupId);
    const created: SorumlulukStudent[] = [];
    for (const row of rows) {
      if (!row.studentName?.trim()) continue;
      const subjects: SubjectEntry[] = (row.subjects ?? []).map((s) => ({ subjectName: s.trim() }));
      const s = this.studentRepo.create({ schoolId, groupId, studentName: row.studentName.trim(), studentNumber: row.studentNumber?.trim() ?? null, className: row.className?.trim() ?? null, subjects });
      created.push(await this.studentRepo.save(s));
    }
    return { imported: created.length };
  }

  // ── Oturumlar ─────────────────────────────────────────────────────────────

  async listSessions(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    return Promise.all(sessions.map(async (s) => {
      const studentCount = await this.ssRepo.count({ where: { sessionId: s.id } });
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { sortOrder: 'ASC' } });
      const userIds = proctors.map((p) => p.userId);
      const users = userIds.length ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return { ...s, studentCount, proctors: proctors.map((p) => ({ ...p, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })) };
    }));
  }

  async createSession(schoolId: string, groupId: string, dto: CreateSorumlulukSessionDto) {
    await this._requireGroup(schoolId, groupId);
    const s = this.sessionRepo.create({ schoolId, groupId, ...dto });
    return this.sessionRepo.save(s);
  }

  async updateSession(schoolId: string, id: string, dto: Partial<CreateSorumlulukSessionDto> & { status?: string }) {
    const s = await this.sessionRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    Object.assign(s, dto);
    return this.sessionRepo.save(s);
  }

  async deleteSession(schoolId: string, id: string) {
    const s = await this.sessionRepo.findOne({ where: { id, schoolId } });
    if (!s) throw new NotFoundException();
    await this.ssRepo.delete({ sessionId: id });
    await this.proctorRepo.delete({ sessionId: id });
    await this.sessionRepo.remove(s);
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
    const subj = student.subjects.find((s) => s.subjectName === session.subjectName);
    if (subj) { subj.sessionId = sessionId; await this.studentRepo.save(student); }

    const row = this.ssRepo.create({ sessionId, studentId });
    return this.ssRepo.save(row);
  }

  async removeStudentFromSession(schoolId: string, sessionId: string, studentId: string) {
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

  async autoSchedule(schoolId: string, groupId: string) {
    await this._requireGroup(schoolId, groupId);
    const students = await this.studentRepo.find({ where: { groupId } });
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });

    // sessionId'ları sıfırla
    for (const st of students) {
      st.subjects = st.subjects.map((s) => ({ ...s, sessionId: null }));
    }
    await this.ssRepo.delete({ sessionId: In(sessions.map((s) => s.id)) });

    // Konu → oturumlar haritası
    const subjectSessionMap = new Map<string, SorumlulukSession[]>();
    for (const ses of sessions) {
      const arr = subjectSessionMap.get(ses.subjectName) ?? [];
      arr.push(ses);
      subjectSessionMap.set(ses.subjectName, arr);
    }

    let assigned = 0;
    let conflicts = 0;

    for (const student of students) {
      const scheduledSlots: Array<{ date: string; start: string; end: string }> = [];

      for (const subj of student.subjects) {
        const candidateSessions = subjectSessionMap.get(subj.subjectName) ?? [];

        // Kapasite dolmamış ve çakışmayan ilk oturumu bul
        let found: SorumlulukSession | null = null;
        for (const ses of candidateSessions) {
          const count = await this.ssRepo.count({ where: { sessionId: ses.id } });
          if (count >= ses.capacity) continue;
          const clash = scheduledSlots.some((slot) => slot.date === ses.sessionDate && this._timesOverlap(slot.start, slot.end, ses.startTime, ses.endTime));
          if (!clash) { found = ses; break; }
        }

        if (found) {
          await this.ssRepo.save(this.ssRepo.create({ sessionId: found.id, studentId: student.id }));
          subj.sessionId = found.id;
          scheduledSlots.push({ date: found.sessionDate, start: found.startTime, end: found.endTime });
          assigned++;
        } else {
          conflicts++;
        }
      }
      await this.studentRepo.save(student);
    }

    return { assigned, conflicts, total: students.reduce((acc, s) => acc + s.subjects.length, 0) };
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
    },
  ) {
    await this._requireGroup(schoolId, groupId);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const teachers = await this.userRepo.find({ where: { school_id: schoolId, role: UserRole.teacher }, order: { display_name: 'ASC' } });
    if (!teachers.length) return { assigned: 0, sessions: 0 };

    // Active timetable plan ids per date (cache)
    const activePlanCache = new Map<string, string | null>();
    const getActivePlan = async (date: string): Promise<string | null> => {
      if (activePlanCache.has(date)) return activePlanCache.get(date)!;
      const plan = await this.timetablePlanRepo
        .createQueryBuilder('p')
        .where('p.school_id = :sid', { sid: schoolId })
        .andWhere('p.start_date <= :d', { d: date })
        .andWhere('(p.end_date IS NULL OR p.end_date >= :d)', { d: date })
        .andWhere("p.status != 'archived'")
        .orderBy('p.start_date', 'DESC')
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

    const groupMeta = await this.groupRepo.findOne({ where: { id: groupId } });
    const groupTitle = groupMeta?.title?.trim() || 'Sorumluluk / beceri sınavı';

    for (const session of sessions) {
      // Skip if already has proctors and overwrite is off
      const existingCount = await this.proctorRepo.count({ where: { sessionId: session.id } });
      if (existingCount > 0 && !opts.overwrite) continue;

      const prevRows = await this.proctorRepo.find({ where: { sessionId: session.id } });
      const prevUserIds = new Set(prevRows.map((r) => r.userId));

      const timetable = await getTimetableForDate(session.sessionDate);

      // Normalize subject for branch matching
      const subjNorm = session.subjectName.toLowerCase().replace(/[^a-züğışöçı]/gi, '');

      const scored = teachers.map((t) => {
        let score = 0;
        const busy = (timetable.get(t.id) ?? []).length > 0;

        if (opts.excludeBusy && busy) return { t, score: -9999 };

        if (opts.preferBranchMatch && t.teacherBranch) {
          const branchNorm = t.teacherBranch.toLowerCase().replace(/[^a-züğışöçı]/gi, '');
          if (branchNorm.includes(subjNorm) || subjNorm.includes(branchNorm)) score += 30;
        }

        if (!busy) score += 10;
        else score -= 5; // has lessons but not excluded

        if (opts.balanceLoad) score -= (loadCount.get(t.id) ?? 0) * 5;

        return { t, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const eligible = scored.filter((s) => s.score > -9999);

      const komisyon = eligible.slice(0, opts.komisyonPerSession).map((s) => s.t);
      const gozcu    = eligible.slice(opts.komisyonPerSession, opts.komisyonPerSession + opts.gozcuPerSession).map((s) => s.t);

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

      assignedSessions++;
    }

    return { assigned: assignedSessions, total: sessions.length };
  }

  private _dayOfWeek(dateStr: string): number {
    const d = new Date(dateStr);
    const dow = d.getDay(); // 0=Sun,1=Mon..6=Sat
    return dow === 0 ? 7 : dow; // map to 1=Mon..7=Sun
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  async buildYoklamaPdf(schoolId: string, sessionId: string): Promise<Uint8Array> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, schoolId } });
    if (!session) throw new NotFoundException();
    const group = await this.groupRepo.findOne({ where: { id: session.groupId } });
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const rows = await this.listSessionStudents(schoolId, sessionId);
    return this.pdf.buildYoklamaPdf({
      groupTitle: group?.title ?? '',
      schoolName: school?.name ?? undefined,
      subjectName: session.subjectName,
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
        studentCount: count,
        proctors: proctors.map((p) => ({ role: p.role, name: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })),
      };
    }));
    return this.pdf.buildProgramPdf({ group, schoolName: school?.name ?? undefined, sessions: sessionData });
  }

  async buildOgrenciProgramPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    const students = await this.studentRepo.find({ where: { groupId }, order: { className: 'ASC', studentName: 'ASC' } });
    const sessions = await this.sessionRepo.find({ where: { groupId } });
    const sMap = new Map(sessions.map((s) => [s.id, s]));
    return this.pdf.buildOgrenciProgramPdf({
      group,
      schoolName: school?.name ?? undefined,
      students: students.map((st) => ({
        studentName: st.studentName,
        studentNumber: st.studentNumber,
        className: st.className,
        subjects: st.subjects.map((s) => ({
          subjectName: s.subjectName,
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
      return { ...s, proctors: proctors.map((p) => ({ role: p.role, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })) };
    }));
    return this.pdf.buildGorevlendirmePdf({ group, schoolName: school?.name ?? undefined, sessions: data });
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
    opts: { createSessions: boolean; autoSchedule: boolean },
  ) {
    await this._requireGroup(schoolId, groupId);

    // 1. Öğrencileri kaydet
    const importResult = await this.importStudents(schoolId, groupId, rows);

    // 2. Benzersiz dersler → oturum oluştur (tarih/saat placeholder)
    let sessionsCreated = 0;
    if (opts.createSessions) {
      const uniqueSubjects = [...new Set(rows.flatMap((r) => r.subjects ?? []).filter(Boolean))];
      const existing = await this.sessionRepo.find({ where: { groupId } });
      const existingSubjectNames = new Set(existing.map((s) => s.subjectName.trim().toLowerCase()));

      // İlk oturum tarihi olarak 7 gün sonrası
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 7);
      // Pazar günü değilse başla, hafta içi bul
      while (baseDate.getDay() === 0) baseDate.setDate(baseDate.getDate() + 1);
      const dateStr = baseDate.toISOString().split('T')[0];

      for (const subj of uniqueSubjects) {
        if (existingSubjectNames.has(subj.trim().toLowerCase())) continue;
        await this.sessionRepo.save(
          this.sessionRepo.create({
            schoolId, groupId,
            subjectName: subj.trim(),
            sessionDate: dateStr,
            startTime: '09:00:00',
            endTime: '11:00:00',
            capacity: 30,
          }),
        );
        sessionsCreated++;
      }
    }

    // 3. Otomatik dağıt
    let schedResult = { assigned: 0, conflicts: 0, total: 0 };
    if (opts.autoSchedule) {
      schedResult = await this.autoSchedule(schoolId, groupId);
    }

    return { imported: importResult.imported, sessionsCreated, ...schedResult };
  }

  private async _getSchoolName(schoolId: string) {
    return (await this.schoolRepo.findOne({ where: { id: schoolId } }))?.name ?? undefined;
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
        entry.sessions.push({ subjectName: s.subjectName, sessionDate: s.sessionDate, startTime: s.startTime, endTime: s.endTime, roomName: s.roomName, role: p.role });
        teacherMap.set(p.userId, entry);
      }
    }
    const teachers = [...teacherMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    return this.pdf.buildImzaSirkuluPdf({ group, schoolName, teachers });
  }

  async buildGorevDagilimPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const teachers = await this._getTeacherDuties(groupId);
    return this.pdf.buildGorevDagilimPdf({ group, schoolName, teachers });
  }

  async buildEkUcretOnayPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const teachers = await this._getTeacherDuties(groupId);
    return this.pdf.buildEkUcretOnayPdf({ group, schoolName, teachers });
  }

  async buildTutanakPdf(schoolId: string, groupId: string): Promise<Uint8Array> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, schoolId } });
    if (!group) throw new NotFoundException();
    const schoolName = await this._getSchoolName(schoolId);
    const sessions = await this.sessionRepo.find({ where: { groupId }, order: { sessionDate: 'ASC', startTime: 'ASC' } });
    const data = await Promise.all(sessions.map(async (s) => {
      const count = await this.ssRepo.count({ where: { sessionId: s.id } });
      const proctors = await this.proctorRepo.find({ where: { sessionId: s.id }, order: { role: 'ASC', sortOrder: 'ASC' } });
      const users = proctors.length ? await this.userRepo.find({ where: { id: In(proctors.map((p) => p.userId)) } }) : [];
      const uMap = new Map(users.map((u) => [u.id, u]));
      return { ...s, studentCount: count, proctors: proctors.map((p) => ({ role: p.role, displayName: uMap.get(p.userId)?.display_name ?? uMap.get(p.userId)?.email ?? '' })) };
    }));
    return this.pdf.buildTutanakPdf({ group, schoolName, sessions: data });
  }

  buildStudentExcelTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Adı Soyadı', 'No', 'Sınıf', 'Ders1', 'Ders2', 'Ders3'],
      ['Ahmet Yılmaz', '101', '10-A', 'Matematik', 'Fizik', ''],
      ['Ayşe Demir', '102', '10-B', 'Kimya', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
