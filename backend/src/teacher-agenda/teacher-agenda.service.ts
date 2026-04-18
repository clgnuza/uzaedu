import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull, Brackets } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { AgendaNote } from './entities/agenda-note.entity';
import { AgendaNoteAttachment } from './entities/agenda-note-attachment.entity';
import { AgendaTask } from './entities/agenda-task.entity';
import { AgendaReminder } from './entities/agenda-reminder.entity';
import { AgendaSchoolEvent } from './entities/agenda-school-event.entity';
import { AgendaSchoolEventAssignment } from './entities/agenda-school-event-assignment.entity';
import { AgendaPlatformEvent } from './entities/agenda-platform-event.entity';
import { AgendaNoteTemplate } from './entities/agenda-note-template.entity';
import {
  AgendaStudentNote,
  type AgendaStudentNotePrivacy,
} from './entities/agenda-student-note.entity';
import { AgendaParentMeeting } from './entities/agenda-parent-meeting.entity';
import { TeacherEvaluationCriterion } from './entities/teacher-evaluation-criterion.entity';
import { TeacherStudentList } from './entities/teacher-student-list.entity';
import { TeacherEvaluationScore } from './entities/teacher-evaluation-score.entity';
import { CreateAgendaNoteDto } from './dto/create-note.dto';
import { UpdateAgendaNoteDto } from './dto/update-note.dto';
import { CreateAgendaTaskDto } from './dto/create-task.dto';
import { UpdateAgendaTaskDto } from './dto/update-task.dto';
import { CreateAgendaReminderDto } from './dto/create-reminder.dto';
import { CreateAgendaSchoolEventDto } from './dto/create-school-event.dto';
import { UpdateAgendaSchoolEventDto } from './dto/update-school-event.dto';
import { CreateAgendaPlatformEventDto } from './dto/create-platform-event.dto';
import { ListAgendaNotesDto, ListAgendaTasksDto, ListCalendarDto } from './dto/list-agenda.dto';
import { UserRole } from '../types/enums';
import { DutyService } from '../duty/duty.service';
import { ExamDutiesService } from '../exam-duties/exam-duties.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import { BilsemService } from '../bilsem/bilsem.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeacherAgendaService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(AgendaNote)
    private readonly noteRepo: Repository<AgendaNote>,
    @InjectRepository(AgendaNoteAttachment)
    private readonly attachmentRepo: Repository<AgendaNoteAttachment>,
    @InjectRepository(AgendaTask)
    private readonly taskRepo: Repository<AgendaTask>,
    @InjectRepository(AgendaReminder)
    private readonly reminderRepo: Repository<AgendaReminder>,
    @InjectRepository(AgendaSchoolEvent)
    private readonly schoolEventRepo: Repository<AgendaSchoolEvent>,
    @InjectRepository(AgendaSchoolEventAssignment)
    private readonly assignmentRepo: Repository<AgendaSchoolEventAssignment>,
    @InjectRepository(AgendaPlatformEvent)
    private readonly platformEventRepo: Repository<AgendaPlatformEvent>,
    @InjectRepository(AgendaNoteTemplate)
    private readonly templateRepo: Repository<AgendaNoteTemplate>,
    @InjectRepository(AgendaStudentNote)
    private readonly studentNoteRepo: Repository<AgendaStudentNote>,
    @InjectRepository(AgendaParentMeeting)
    private readonly parentMeetingRepo: Repository<AgendaParentMeeting>,
    @InjectRepository(TeacherEvaluationCriterion)
    private readonly criterionRepo: Repository<TeacherEvaluationCriterion>,
    @InjectRepository(TeacherStudentList)
    private readonly studentListRepo: Repository<TeacherStudentList>,
    @InjectRepository(TeacherEvaluationScore)
    private readonly evaluationScoreRepo: Repository<TeacherEvaluationScore>,
    private readonly dutyService: DutyService,
    private readonly examDutiesService: ExamDutiesService,
    private readonly academicCalendarService: AcademicCalendarService,
    private readonly bilsemService: BilsemService,
    private readonly timetableService: TeacherTimetableService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private ensureSchool(userId: string, schoolId: string | null, role: UserRole) {
    if (role !== UserRole.superadmin && role !== UserRole.moderator && !schoolId)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi gerekli.' });
  }

  private nextDueDateAfter(ymd: string, repeat: AgendaTask['repeat']): string {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (repeat === 'daily') base.setUTCDate(base.getUTCDate() + 1);
    else if (repeat === 'weekly') base.setUTCDate(base.getUTCDate() + 7);
    else if (repeat === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1);
    return base.toISOString().slice(0, 10);
  }

  /** Takvim aralığı için tekrarlı (pending) görev olasılıklarını üretir; UTC ile `nextDueDateAfter` ile uyumlu */
  private expandTaskOccurrencesInCalendarRange(
    anchorYmd: string,
    repeat: AgendaTask['repeat'],
    rangeStart: string,
    rangeEnd: string,
    maxSteps = 900,
  ): string[] {
    if (repeat === 'none' || !anchorYmd) return [];
    let cur = anchorYmd;
    let guard = 0;
    while (cur < rangeStart && guard++ < maxSteps) {
      const next = this.nextDueDateAfter(cur, repeat);
      if (next <= cur) break;
      cur = next;
    }
    const out: string[] = [];
    guard = 0;
    while (cur <= rangeEnd && guard++ < maxSteps) {
      out.push(cur);
      const next = this.nextDueDateAfter(cur, repeat);
      if (next <= cur) break;
      cur = next;
    }
    return out;
  }

  private ymdAddDaysUtc(ymd: string, deltaDays: number): string {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    if ([y, m, d].some((n) => Number.isNaN(n))) return ymd;
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    base.setUTCDate(base.getUTCDate() + deltaDays);
    return base.toISOString().slice(0, 10);
  }

  private assertRepeatRequiresDueDate(repeat: AgendaTask['repeat'] | undefined, dueDate: string | null | undefined) {
    const r = repeat ?? 'none';
    if (r === 'none') return;
    const d = (dueDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Günlük / haftalık / aylık tekrar için geçerli son tarih (yyyy-aa-gg) zorunludur.',
      });
    }
  }

  private async spawnNextRecurringIfNeeded(task: AgendaTask): Promise<void> {
    if (task.repeat === 'none' || !task.dueDate) return;
    const nextDue = this.nextDueDateAfter(task.dueDate, task.repeat);
    await this.taskRepo.save(
      this.taskRepo.create({
        title: task.title,
        description: task.description,
        dueDate: nextDue,
        dueTime: task.dueTime,
        priority: task.priority,
        repeat: task.repeat,
        status: 'pending',
        source: task.source,
        userId: task.userId,
        schoolId: task.schoolId,
        studentId: task.studentId,
      }),
    );
  }

  async createNote(
    userId: string,
    schoolId: string | null,
    dto: CreateAgendaNoteDto,
  ) {
    const note = this.noteRepo.create({
      ...dto,
      source: 'PERSONAL',
      userId,
      schoolId,
      createdBy: userId,
    });
    return this.noteRepo.save(note);
  }

  async updateNote(
    id: string,
    userId: string,
    dto: UpdateAgendaNoteDto,
  ) {
    const note = await this.noteRepo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not bulunamadı.' });
    Object.assign(note, dto);
    return this.noteRepo.save(note);
  }

  async listNotes(userId: string, dto: ListAgendaNotesDto) {
    const qb = this.noteRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.source = :source', { source: 'PERSONAL' });
    if (!dto.includeArchived) qb.andWhere('n.archived_at IS NULL');
    if (dto.subjectId) qb.andWhere('n.subject_id = :subjectId', { subjectId: dto.subjectId });
    if (dto.classId) qb.andWhere('n.class_id = :classId', { classId: dto.classId });
    if (dto.source) qb.andWhere('n.source = :source', { source: dto.source });
    if (dto.search) {
      qb.andWhere('(n.title ILIKE :search OR n.body ILIKE :search)', {
        search: `%${dto.search}%`,
      });
    }
    if (dto.announcementId) {
      const announcementTag = `duyuru_ann:${dto.announcementId}`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(n.tags, '[]'::jsonb)) AS elem WHERE elem = :announcementTag)`,
        { announcementTag },
      );
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    qb.orderBy('n.pinned', 'DESC').addOrderBy('n.updated_at', 'DESC');
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async getNoteById(id: string, userId: string) {
    const note = await this.noteRepo.findOne({
      where: { id, userId },
      relations: ['attachments'],
    });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not bulunamadı.' });
    return note;
  }

  async archiveNote(id: string, userId: string) {
    const note = await this.noteRepo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not bulunamadı.' });
    note.archivedAt = new Date();
    return this.noteRepo.save(note);
  }

  async deleteNote(id: string, userId: string) {
    const r = await this.noteRepo.delete({ id, userId });
    if (r.affected === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not bulunamadı.' });
    return { ok: true };
  }

  async createTask(
    userId: string,
    schoolId: string | null,
    dto: CreateAgendaTaskDto,
  ) {
    const raw = dto as CreateAgendaTaskDto & { remindAt?: string | null };
    const { remindAt, ...fields } = raw;
    this.assertRepeatRequiresDueDate(fields.repeat ?? 'none', fields.dueDate ?? null);
    const status = 'pending';
    return this.taskRepo.manager.transaction(async (em) => {
      const task = em.create(AgendaTask, {
        ...fields,
        source: 'PERSONAL',
        userId,
        schoolId,
        status,
        priority: fields.priority ?? 'medium',
        repeat: fields.repeat ?? 'none',
      });
      const saved = await em.save(task);
      const ra = remindAt?.trim();
      if (ra) {
        const rem = em.create(AgendaReminder, {
          taskId: saved.id,
          remindAt: new Date(ra),
        });
        await em.save(rem);
      }
      return saved;
    });
  }

  async getTaskById(id: string, userId: string) {
    const task = await this.taskRepo.findOne({
      where: { id, userId },
      relations: ['reminders'],
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görev bulunamadı.' });
    return task;
  }

  async updateTask(id: string, userId: string, dto: UpdateAgendaTaskDto) {
    const raw = dto as UpdateAgendaTaskDto & { remindAt?: string | null };
    const { remindAt, ...patch } = raw;
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görev bulunamadı.' });
    const nextRepeat = patch.repeat !== undefined ? patch.repeat : task.repeat;
    const nextDue = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
    this.assertRepeatRequiresDueDate(nextRepeat, nextDue);
    Object.assign(task, patch);
    await this.taskRepo.save(task);
    if (remindAt !== undefined) {
      await this.reminderRepo
        .createQueryBuilder()
        .delete()
        .from(AgendaReminder)
        .where('task_id = :taskId', { taskId: id })
        .andWhere('push_sent = :sent', { sent: false })
        .execute();
      const ra = remindAt?.trim();
      if (ra) await this.createReminder(userId, { taskId: id, remindAt: ra });
    }
    return this.getTaskById(id, userId);
  }

  async setTaskStatus(id: string, userId: string, status: AgendaTask['status']) {
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görev bulunamadı.' });
    task.status = status;
    task.completedAt = status === 'completed' ? new Date() : null;
    const saved = await this.taskRepo.save(task);
    if (status === 'completed') await this.spawnNextRecurringIfNeeded(task);
    return saved;
  }

  async listTasks(userId: string, dto: ListAgendaTasksDto) {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source = :source', { source: 'PERSONAL' });
    if (dto.status === 'overdue') {
      qb.andWhere('t.status = :status', { status: 'pending' });
      qb.andWhere('t.due_date < :today', { today: new Date().toISOString().slice(0, 10) });
    } else if (dto.status) {
      qb.andWhere('t.status = :status', { status: dto.status });
    }
    if (dto.priority) qb.andWhere('t.priority = :priority', { priority: dto.priority });
    if (dto.dueDateFrom) qb.andWhere('t.due_date >= :from', { from: dto.dueDateFrom });
    if (dto.dueDateTo) qb.andWhere('t.due_date <= :to', { to: dto.dueDateTo });
    if (dto.search) {
      qb.andWhere('(t.title ILIKE :search OR t.description ILIKE :search)', {
        search: `%${dto.search}%`,
      });
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    qb.orderBy('t.due_date', 'ASC').addOrderBy('t.due_time', 'ASC');
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async deleteTask(id: string, userId: string) {
    const r = await this.taskRepo.delete({ id, userId });
    if (r.affected === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Görev bulunamadı.' });
    return { ok: true };
  }

  async createReminder(userId: string, dto: CreateAgendaReminderDto) {
    if (!dto.noteId && !dto.taskId)
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'noteId veya taskId gerekli.' });
    if (dto.noteId) {
      const note = await this.noteRepo.findOne({ where: { id: dto.noteId, userId } });
      if (!note) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not bulunamadı.' });
    }
    if (dto.taskId) {
      const task = await this.taskRepo.findOne({ where: { id: dto.taskId, userId } });
      if (!task) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Görev bulunamadı.' });
    }
    const reminder = this.reminderRepo.create({
      ...dto,
      remindAt: new Date(dto.remindAt),
      silentUntil: dto.silentUntil ? new Date(dto.silentUntil) : null,
    });
    return this.reminderRepo.save(reminder);
  }

  async getCalendarFeed(
    userId: string,
    schoolId: string | null,
    role: UserRole,
    dto: ListCalendarDto,
    currentUserName = 'Siz',
  ) {
    const start = new Date(dto.start);
    const end = new Date(dto.end);
    const events: Array<{
      id: string;
      type: 'note' | 'task' | 'school_event' | 'platform_event' | 'duty' | 'exam_duty' | 'student_note' | 'parent_meeting' | 'belirli_gun_hafta' | 'bilsem_calendar' | 'timetable';
      title: string;
      start: string;
      end?: string;
      source: string;
      color?: string;
      createdBy?: string;
      metadata?: Record<string, unknown>;
    }> = [];

    const notes = await this.noteRepo.find({
      where: { userId, source: 'PERSONAL', archivedAt: null as unknown as Date },
      select: ['id', 'title', 'color', 'createdAt'],
    });
    for (const n of notes) {
      const d = new Date(n.createdAt);
      if (d >= start && d <= end)
        events.push({
          id: n.id,
          type: 'note',
          title: n.title,
          start: n.createdAt.toISOString(),
          source: 'PERSONAL',
          color: n.color ?? undefined,
          createdBy: currentUserName,
        });
    }

    const startYmd = dto.start.slice(0, 10);
    const endYmd = dto.end.slice(0, 10);
    const expandFromYmd = this.ymdAddDaysUtc(startYmd, -800);
    const tasks = await this.taskRepo
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.source = :source', { source: 'PERSONAL' })
      .andWhere(
        new Brackets((qb) => {
          qb.where('(t.due_date >= :start AND t.due_date <= :end)', { start: startYmd, end: endYmd }).orWhere(
            '(t.status = :pending AND t.repeat IS NOT NULL AND t.repeat <> :rnone AND t.due_date <= :end AND t.due_date >= :expandFrom)',
            { pending: 'pending', rnone: 'none', end: endYmd, expandFrom: expandFromYmd },
          );
        }),
      )
      .getMany();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const inRange = t.dueDate >= startYmd && t.dueDate <= endYmd;
      if (t.status === 'pending' && t.repeat && t.repeat !== 'none') {
        const occ = this.expandTaskOccurrencesInCalendarRange(t.dueDate, t.repeat, startYmd, endYmd);
        for (const ymd of occ) {
          const startStr = t.dueTime ? `${ymd}T${t.dueTime}:00` : `${ymd}T09:00:00`;
          const isAnchorDay = ymd === t.dueDate;
          events.push({
            id: isAnchorDay ? t.id : `task~${t.id}~${ymd}`,
            type: 'task',
            title: t.title,
            start: startStr,
            source: 'PERSONAL',
            createdBy: currentUserName,
            metadata: {
              status: t.status,
              priority: t.priority,
              repeat: t.repeat,
              ...(isAnchorDay ? {} : { recurringVirtual: true as const, taskId: t.id }),
            },
          });
        }
      } else if (inRange) {
        const startStr = t.dueTime ? `${t.dueDate}T${t.dueTime}:00` : `${t.dueDate}T09:00:00`;
        events.push({
          id: t.id,
          type: 'task',
          title: t.title,
          start: startStr,
          source: 'PERSONAL',
          createdBy: currentUserName,
          metadata: { status: t.status, priority: t.priority },
        });
      }
    }

    if (schoolId && (role === UserRole.teacher || role === UserRole.school_admin)) {
      const schoolEvents = await this.schoolEventRepo.find({
        where: {
          schoolId,
          eventAt: Between(start, end) as unknown as Date,
          archivedAt: null as unknown as Date,
        },
        relations: ['creator'],
      });
      for (const e of schoolEvents) {
        const creatorName = e.creator?.display_name ?? e.creator?.email ?? 'Okul';
        events.push({
          id: e.id,
          type: 'school_event',
          title: e.title,
          start: e.eventAt.toISOString(),
          source: 'SCHOOL',
          createdBy: creatorName,
          metadata: { eventType: e.eventType, important: e.important },
        });
      }
    }

    const platformEvents = await this.platformEventRepo.find({
      where: { eventAt: Between(start, end) as unknown as Date },
    });
    for (const e of platformEvents) {
      events.push({
        id: e.id,
        type: 'platform_event',
        title: e.title,
        start: e.eventAt.toISOString(),
        source: 'PLATFORM',
        createdBy: 'Platform',
      });
    }

    if (schoolId && (role === UserRole.teacher || role === UserRole.school_admin)) {
      try {
        const dutySlots = await this.dutyService.getSlotsForDateRange(
          schoolId,
          dto.start.slice(0, 10),
          dto.end.slice(0, 10),
          role,
          userId,
        );
        for (const s of dutySlots) {
          const dateStr = s.date + (s.shift === 'afternoon' ? 'T14:00:00' : 'T08:00:00');
          events.push({
            id: `duty-${s.id}`,
            type: 'duty',
            title: `Nöbet${s.area_name ? ` – ${s.area_name}` : ''}`,
            start: dateStr,
            source: 'SCHOOL',
            createdBy: 'Nöbet Planı',
            metadata: {
              area: s.area_name,
              shift: s.shift,
              slotName: s.slot_name,
              slotStartTime: s.slot_start_time,
              slotEndTime: s.slot_end_time,
              lessonNum: s.lesson_num,
              note: s.note,
            },
          });
        }
      } catch {
        // duty module disabled or no access – skip
      }
    }

    if (schoolId && (role === UserRole.teacher || role === UserRole.school_admin)) {
      const studentNotes = await this.studentNoteRepo
        .createQueryBuilder('sn')
        .leftJoin('sn.student', 's')
        .where('sn.teacher_id = :userId', { userId })
        .andWhere('s.school_id = :schoolId', { schoolId })
        .andWhere('sn.note_date >= :start', { start: dto.start.slice(0, 10) })
        .andWhere('sn.note_date <= :end', { end: dto.end.slice(0, 10) })
        .getMany();
      const noteTypeLabels: Record<string, string> = { positive: 'Olumlu', negative: 'Olumsuz', observation: 'Gözlem' };
      for (const sn of studentNotes) {
        events.push({
          id: `student_note-${sn.id}`,
          type: 'student_note',
          title: `Öğrenci notu – ${noteTypeLabels[sn.noteType] ?? sn.noteType}`,
          start: `${sn.noteDate}T09:00:00`,
          source: 'PERSONAL',
          createdBy: currentUserName,
          metadata: { studentId: sn.studentId, noteType: sn.noteType },
        });
      }
      const parentMeetings = await this.parentMeetingRepo
        .createQueryBuilder('pm')
        .leftJoin('pm.student', 's')
        .where('pm.teacher_id = :userId', { userId })
        .andWhere('s.school_id = :schoolId', { schoolId })
        .andWhere('pm.meeting_date >= :start', { start: dto.start.slice(0, 10) })
        .andWhere('pm.meeting_date <= :end', { end: dto.end.slice(0, 10) })
        .getMany();
      for (const pm of parentMeetings) {
        events.push({
          id: `parent_meeting-${pm.id}`,
          type: 'parent_meeting',
          title: pm.subject ? `Veli toplantısı – ${pm.subject}` : 'Veli toplantısı',
          start: `${pm.meetingDate}T09:00:00`,
          source: 'PERSONAL',
          createdBy: currentUserName,
          metadata: { studentId: pm.studentId, meetingType: pm.meetingType },
        });
      }
    }

    try {
      const examDuties = await this.examDutiesService.getMyExamDutiesInRange(
        userId,
        dto.start.slice(0, 10),
        dto.end.slice(0, 10),
      );
      for (const e of examDuties) {
        const d = e.examDate ?? e.examDateEnd;
        if (d)
          events.push({
            id: `exam_duty-${e.id}`,
            type: 'exam_duty',
            title: e.title,
            start: d.toISOString(),
            source: 'PLATFORM',
            createdBy: 'Sınav Görevi',
          });
      }
    } catch {
      // skip
    }

    if (schoolId && (role === UserRole.teacher || role === UserRole.school_admin)) {
      try {
        const belirliAssignments = await this.academicCalendarService.getTeacherAssignmentsForDateRange(
          schoolId,
          userId,
          dto.start.slice(0, 10),
          dto.end.slice(0, 10),
        );
        for (const a of belirliAssignments) {
          events.push({
            id: `belirli_gun_hafta-${a.id}`,
            type: 'belirli_gun_hafta',
            title: a.title,
            start: `${a.dateStart}T09:00:00`,
            source: 'SCHOOL',
            createdBy: 'Akademik Takvim',
            metadata: { gorevTipi: a.gorevTipi },
          });
        }
      } catch {
        // skip
      }

      try {
        const bilsemAssignments = await this.bilsemService.getTeacherAssignmentsForDateRange(
          schoolId,
          userId,
          dto.start.slice(0, 10),
          dto.end.slice(0, 10),
        );
        for (const a of bilsemAssignments) {
          events.push({
            id: `bilsem_calendar-${a.id}`,
            type: 'bilsem_calendar',
            title: a.title,
            start: `${a.dateStart}T09:00:00`,
            source: 'SCHOOL',
            createdBy: 'Bilsem Takvim',
            metadata: { gorevTipi: a.gorevTipi },
          });
        }
      } catch {
        // skip
      }

      try {
        const timetableSummary = await this.timetableService.getTeacherLessonSummaryForDateRange(
          schoolId,
          userId,
          dto.start.slice(0, 10),
          dto.end.slice(0, 10),
        );
        for (const t of timetableSummary) {
          events.push({
            id: `timetable-${t.date}`,
            type: 'timetable',
            title: `${t.lessonCount} ders`,
            start: `${t.date}T08:00:00`,
            source: 'SCHOOL',
            createdBy: 'Ders Programı',
            metadata: {
              lessonCount: t.lessonCount,
              lessons: t.lessons,
            },
          });
        }
      } catch {
        // skip
      }
    }

    return { events };
  }

  async createSchoolEvent(
    schoolId: string,
    createdBy: string,
    dto: CreateAgendaSchoolEventDto,
  ) {
    const event = this.schoolEventRepo.create({
      title: dto.title,
      description: dto.description,
      eventAt: new Date(dto.eventAt),
      eventType: dto.eventType,
      targetAudience: dto.targetAudience,
      attachmentUrl: dto.attachmentUrl,
      important: dto.important ?? false,
      schoolId,
      createdBy,
    });
    const saved = await this.schoolEventRepo.save(event);

    const teachers = await this.dutyService.listSchoolTeachers(schoolId, false);
    const byId = new Map(teachers.map((t) => [t.id, t]));
    const targetIds = new Set<string>(dto.targetTeacherIds ?? []);
    for (const branch of dto.targetBranches ?? []) {
      teachers.filter((t) => (t.teacher_branch ?? '').trim() === branch.trim()).forEach((t) => targetIds.add(t.id));
    }
    const validIds = [...targetIds].filter((id) => byId.has(id));

    for (const userId of validIds) {
      await this.assignmentRepo.save(
        this.assignmentRepo.create({ eventId: saved.id, userId }),
      );
      await this.notificationsService.createInboxEntry({
        user_id: userId,
        event_type: 'agenda.school_event_added',
        entity_id: saved.id,
        target_screen: 'ogretmen-ajandasi',
        title: 'Size etkinlik atandı',
        body: `"${dto.title}" etkinliği için bilgilendirildiniz. Ajandanıza giderek detayları görüntüleyebilirsiniz.`,
        metadata: { eventTitle: dto.title, eventAt: dto.eventAt },
      });
    }
    return saved;
  }

  async listSchoolEvents(schoolId: string, start: string, end: string) {
    return this.schoolEventRepo.find({
      where: {
        schoolId,
        eventAt: Between(new Date(start), new Date(end)) as unknown as Date,
        archivedAt: null as unknown as Date,
      },
      order: { eventAt: 'ASC' },
      relations: ['assignments', 'assignments.user'],
    });
  }

  async getSchoolEventById(id: string, schoolId: string) {
    const event = await this.schoolEventRepo.findOne({
      where: { id, schoolId, archivedAt: null as unknown as Date },
      relations: ['assignments'],
    });
    if (!event) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Etkinlik bulunamadı.' });
    return event;
  }

  async updateSchoolEvent(
    id: string,
    schoolId: string,
    dto: UpdateAgendaSchoolEventDto,
  ) {
    const event = await this.getSchoolEventById(id, schoolId);
    if (dto.title != null) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.eventAt != null) event.eventAt = new Date(dto.eventAt);
    if (dto.eventType !== undefined) event.eventType = dto.eventType;
    if (dto.targetAudience !== undefined) event.targetAudience = dto.targetAudience;
    if (dto.attachmentUrl !== undefined) event.attachmentUrl = dto.attachmentUrl;
    if (dto.important !== undefined) event.important = dto.important;
    await this.schoolEventRepo.save(event);

    if (dto.targetTeacherIds !== undefined) {
      await this.assignmentRepo.delete({ eventId: id });
      const teachers = await this.dutyService.listSchoolTeachers(schoolId, false);
      const byId = new Map(teachers.map((t) => [t.id, t]));
      const targetIds = new Set<string>(dto.targetTeacherIds);
      for (const branch of dto.targetBranches ?? []) {
        teachers.filter((t) => (t.teacher_branch ?? '').trim() === branch.trim()).forEach((t) => targetIds.add(t.id));
      }
      const validIds = [...targetIds].filter((i) => byId.has(i));
      for (const userId of validIds) {
        await this.assignmentRepo.save(this.assignmentRepo.create({ eventId: id, userId }));
      }
    }
    return this.getSchoolEventById(id, schoolId);
  }

  async deleteSchoolEvent(id: string, schoolId: string) {
    const event = await this.getSchoolEventById(id, schoolId);
    await this.assignmentRepo.delete({ eventId: id });
    await this.schoolEventRepo.remove(event);
    return { ok: true };
  }

  async createPlatformEvent(createdBy: string, dto: CreateAgendaPlatformEventDto) {
    const event = this.platformEventRepo.create({
      ...dto,
      eventAt: new Date(dto.eventAt),
      createdBy,
    });
    return this.platformEventRepo.save(event);
  }

  async listTemplates(userId: string, schoolId: string | null) {
    try {
      const [userTemplates, systemTemplates] = await Promise.all([
        this.templateRepo.find({ where: { userId }, order: { title: 'ASC' } }),
        this.templateRepo.find({ where: { isSystem: true }, order: { title: 'ASC' } }),
      ]);
      const schoolTemplates = schoolId
        ? await this.templateRepo.find({
            where: { schoolId, userId: IsNull() },
            order: { title: 'ASC' },
          })
        : [];
      const seen = new Set<string>();
      return [...userTemplates, ...systemTemplates, ...schoolTemplates].filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }).sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      return [];
    }
  }

  async createTemplate(
    userId: string,
    schoolId: string | null,
    dto: { title: string; bodyTemplate?: string | null },
  ) {
    const t = this.templateRepo.create({
      title: dto.title,
      bodyTemplate: dto.bodyTemplate ?? null,
      userId,
      schoolId,
      isSystem: false,
    });
    return this.templateRepo.save(t);
  }

  async addNoteAttachment(
    noteId: string,
    userId: string,
    dto: { fileUrl: string; fileType?: string; fileName?: string },
  ) {
    const note = await this.noteRepo.findOne({ where: { id: noteId, userId } });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not bulunamadı.' });
    const att = this.attachmentRepo.create({
      noteId,
      fileUrl: dto.fileUrl,
      fileType: dto.fileType ?? null,
      fileName: dto.fileName ?? null,
    });
    return this.attachmentRepo.save(att);
  }

  async deleteNoteAttachment(attachmentId: string, userId: string) {
    const att = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
      relations: ['note'],
    });
    if (!att || att.note.userId !== userId)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Ek bulunamadı.' });
    await this.attachmentRepo.remove(att);
    return { ok: true };
  }

  async createStudentNote(
    teacherId: string,
    _schoolId: string,
    dto: {
      studentId: string;
      noteType: 'positive' | 'negative' | 'observation';
      description?: string;
      subjectId?: string;
      noteDate: string;
      tags?: string[];
      privacyLevel?: AgendaStudentNotePrivacy;
    },
  ) {
    const note = this.studentNoteRepo.create({
      teacherId,
      studentId: dto.studentId,
      noteType: dto.noteType,
      description: dto.description ?? null,
      subjectId: dto.subjectId ?? null,
      noteDate: dto.noteDate,
      tags: dto.tags ?? null,
      privacyLevel: (dto.privacyLevel as AgendaStudentNotePrivacy) ?? 'private',
    });
    return this.studentNoteRepo.save(note);
  }

  async createParentMeeting(
    teacherId: string,
    dto: {
      studentId: string;
      meetingDate: string;
      meetingType?: string;
      subject?: string;
      description?: string;
      followUpDate?: string;
    },
  ) {
    const meeting = this.parentMeetingRepo.create({
      ...dto,
      teacherId,
    });
    return this.parentMeetingRepo.save(meeting);
  }

  async getStudentNoteById(id: string, teacherId: string) {
    const note = await this.studentNoteRepo.findOne({
      where: { id, teacherId },
      relations: ['student', 'subject'],
    });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğrenci notu bulunamadı.' });
    return note;
  }

  async listStudentNotes(teacherId: string, schoolId: string | null, dto: { studentId?: string; noteType?: string; page?: number; limit?: number }) {
    if (!schoolId) return { items: [], total: 0, page: 1, limit: 20 };
    const qb = this.studentNoteRepo
      .createQueryBuilder('sn')
      .leftJoinAndSelect('sn.student', 's')
      .where('sn.teacher_id = :teacherId', { teacherId })
      .andWhere('s.school_id = :schoolId', { schoolId });
    if (dto.studentId) qb.andWhere('sn.student_id = :studentId', { studentId: dto.studentId });
    if (dto.noteType) qb.andWhere('sn.note_type = :noteType', { noteType: dto.noteType });
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    qb.orderBy('sn.note_date', 'DESC').addOrderBy('sn.created_at', 'DESC');
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async listParentMeetings(teacherId: string, schoolId: string | null, dto: { studentId?: string; start?: string; end?: string; page?: number; limit?: number }) {
    if (!schoolId) return { items: [], total: 0, page: 1, limit: 20 };
    const qb = this.parentMeetingRepo
      .createQueryBuilder('pm')
      .leftJoinAndSelect('pm.student', 's')
      .where('pm.teacher_id = :teacherId', { teacherId })
      .andWhere('s.school_id = :schoolId', { schoolId });
    if (dto.studentId) qb.andWhere('pm.student_id = :studentId', { studentId: dto.studentId });
    if (dto.start) qb.andWhere('pm.meeting_date >= :start', { start: dto.start });
    if (dto.end) qb.andWhere('pm.meeting_date <= :end', { end: dto.end });
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    qb.orderBy('pm.meeting_date', 'DESC').addOrderBy('pm.created_at', 'DESC');
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async listStudents(schoolId: string | null) {
    if (!schoolId) return [];
    return this.studentRepo.find({
      where: { schoolId },
      order: { name: 'ASC' },
      select: ['id', 'name', 'studentNumber', 'classId'],
    });
  }

  async getAgendaSummary(userId: string, schoolId: string | null) {
    const today = new Date().toISOString().slice(0, 10);
    const [pendingTasks, overdueCount, todayEvents] = await Promise.all([
      this.taskRepo.count({ where: { userId, source: 'PERSONAL', status: 'pending' } }),
      this.taskRepo
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.source = :source', { source: 'PERSONAL' })
        .andWhere('t.status = :status', { status: 'pending' })
        .andWhere('t.due_date < :today', { today })
        .getCount(),
      this.getCalendarFeed(userId, schoolId, UserRole.teacher, { start: today, end: today }),
    ]);
    return {
      pendingTasks,
      overdueTasks: overdueCount,
      todayEventCount: todayEvents.events.length,
    };
  }

  async exportNotesCsv(userId: string) {
    const notes = await this.noteRepo.find({
      where: { userId, source: 'PERSONAL' },
      order: { updatedAt: 'DESC' },
    });
    const header = 'id,title,body,tags,createdAt,archivedAt\n';
    const rows = notes.map((n) =>
      [
        n.id,
        `"${(n.title || '').replace(/"/g, '""')}"`,
        `"${(n.body || '').replace(/"/g, '""')}"`,
        (n.tags || []).join(';'),
        n.createdAt?.toISOString() ?? '',
        n.archivedAt?.toISOString() ?? '',
      ].join(','),
    );
    return header + rows.join('\n');
  }

  async exportTasksCsv(userId: string) {
    const tasks = await this.taskRepo.find({
      where: { userId, source: 'PERSONAL' },
      order: { dueDate: 'ASC' },
    });
    const header = 'id,title,description,dueDate,dueTime,status,priority,createdAt\n';
    const rows = tasks.map((t) =>
      [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.dueDate ?? '',
        t.dueTime ?? '',
        t.status,
        t.priority,
        t.createdAt?.toISOString() ?? '',
      ].join(','),
    );
    return header + rows.join('\n');
  }

  async listReminders(dto: { noteId?: string; taskId?: string }) {
    const where: Record<string, unknown> = {};
    if (dto.noteId) where.noteId = dto.noteId;
    if (dto.taskId) where.taskId = dto.taskId;
    if (Object.keys(where).length === 0) return [];
    return this.reminderRepo.find({
      where: where as never,
      order: { remindAt: 'ASC' },
    });
  }

  async exportCalendarIcal(
    userId: string,
    schoolId: string | null,
    role: UserRole,
    start: string,
    end: string,
    currentUserName = 'Siz',
  ): Promise<string> {
    const { events } = await this.getCalendarFeed(
      userId,
      schoolId,
      role,
      { start, end },
      currentUserName,
    );
    const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const formatDt = (d: string) => {
      const hasTime = d.includes('T');
      const dt = new Date(d);
      return hasTime ? dt.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z' : dt.toISOString().slice(0, 10).replace(/-/g, '');
    };
    let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UzaeduOgretmen//Agenda//TR\r\nCALSCALE:GREGORIAN\r\n';
    for (const ev of events) {
      const hasTime = ev.start.includes('T');
      const startDt = hasTime ? formatDt(ev.start) : ev.start.slice(0, 10).replace(/-/g, '') + 'T090000Z';
      const endDt = ev.end ? formatDt(ev.end) : hasTime
        ? new Date(new Date(ev.start).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
        : ev.start.slice(0, 10).replace(/-/g, '') + 'T100000Z';
      ical += 'BEGIN:VEVENT\r\n';
      ical += `UID:${ev.id}@ogretmenpro\r\n`;
      ical += `DTSTART:${startDt}\r\n`;
      ical += `DTEND:${endDt}\r\n`;
      ical += `SUMMARY:${escape(ev.title)}\r\n`;
      ical += `DESCRIPTION:${escape((ev.createdBy ? ev.createdBy + ' - ' : '') + (ev.source || ''))}\r\n`;
      ical += 'END:VEVENT\r\n';
    }
    ical += 'END:VCALENDAR\r\n';
    return ical;
  }

  async bulkArchiveNotes(userId: string, ids: string[]) {
    if (!ids?.length) return { archived: 0 };
    const notes = await this.noteRepo.find({ where: { userId, id: In(ids) } });
    for (const n of notes) {
      n.archivedAt = new Date();
      await this.noteRepo.save(n);
    }
    return { archived: notes.length };
  }

  async bulkDeleteNotes(userId: string, ids: string[]) {
    if (!ids?.length) return { deleted: 0 };
    const r = await this.noteRepo.delete({ userId, id: In(ids) });
    return { deleted: r.affected ?? 0 };
  }

  async bulkDeleteTasks(userId: string, ids: string[]) {
    if (!ids?.length) return { deleted: 0 };
    const r = await this.taskRepo.delete({ userId, id: In(ids) });
    return { deleted: r.affected ?? 0 };
  }

  async bulkUpdateTaskStatus(userId: string, ids: string[], status: string) {
    if (!ids?.length) return { updated: 0 };
    const st = status as AgendaTask['status'];
    if (st !== 'completed') {
      const r = await this.taskRepo.update(
        { userId, id: In(ids) },
        { status: st, completedAt: null as unknown as Date },
      );
      return { updated: r.affected ?? 0 };
    }
    const tasks = await this.taskRepo.find({ where: { userId, id: In(ids) } });
    for (const t of tasks) {
      t.status = 'completed';
      t.completedAt = new Date();
      await this.taskRepo.save(t);
      await this.spawnNextRecurringIfNeeded(t);
    }
    return { updated: tasks.length };
  }

  async searchAll(userId: string, schoolId: string | null, q: string, limit = 10) {
    if (!q || q.trim().length < 2) return { notes: [], tasks: [], studentNotes: [], parentMeetings: [] };
    const term = `%${q.trim()}%`;
    const [notes, tasks, studentNotes, parentMeetings] = await Promise.all([
      this.noteRepo
        .createQueryBuilder('n')
        .where('n.user_id = :userId', { userId })
        .andWhere('(n.title ILIKE :term OR n.body ILIKE :term)', { term })
        .orderBy('n.updated_at', 'DESC')
        .take(limit)
        .getMany(),
      this.taskRepo
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('(t.title ILIKE :term OR t.description ILIKE :term)', { term })
        .orderBy('t.due_date', 'ASC')
        .take(limit)
        .getMany(),
      schoolId
        ? this.studentNoteRepo
            .createQueryBuilder('sn')
            .leftJoinAndSelect('sn.student', 's')
            .where('sn.teacher_id = :userId', { userId })
            .andWhere('s.school_id = :schoolId', { schoolId })
            .andWhere('(sn.description ILIKE :term)', { term })
            .orderBy('sn.note_date', 'DESC')
            .take(limit)
            .getMany()
        : Promise.resolve([]),
      schoolId
        ? this.parentMeetingRepo
            .createQueryBuilder('pm')
            .leftJoinAndSelect('pm.student', 's')
            .where('pm.teacher_id = :userId', { userId })
            .andWhere('s.school_id = :schoolId', { schoolId })
            .andWhere('(pm.subject ILIKE :term OR pm.description ILIKE :term)', { term })
            .orderBy('pm.meeting_date', 'DESC')
            .take(limit)
            .getMany()
        : Promise.resolve([]),
    ]);
    return { notes, tasks, studentNotes, parentMeetings };
  }

  async getWeeklyStats(userId: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const start = weekStart.toISOString().slice(0, 10);
    const end = weekEnd.toISOString().slice(0, 10);
    const [total, completed] = await Promise.all([
      this.taskRepo
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.source = :source', { source: 'PERSONAL' })
        .andWhere('t.due_date >= :start', { start })
        .andWhere('t.due_date <= :end', { end })
        .getCount(),
      this.taskRepo
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.source = :source', { source: 'PERSONAL' })
        .andWhere('t.status = :status', { status: 'completed' })
        .andWhere('t.due_date >= :start', { start })
        .andWhere('t.due_date <= :end', { end })
        .getCount(),
    ]);
    return { total, completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 100 };
  }

  async listCriteria(teacherId: string, schoolId: string | null) {
    if (!schoolId) return [];
    return this.criterionRepo.find({
      where: { teacherId, schoolId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createCriterion(
    teacherId: string,
    schoolId: string | null,
    dto: {
      name: string;
      description?: string;
      maxScore?: number;
      scoreType?: 'numeric' | 'sign';
      subjectId?: string;
      criterionCategory?: 'lesson' | 'behavior';
    },
  ) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul gerekli.' });
    const cat = dto.criterionCategory === 'behavior' ? 'behavior' : 'lesson';
    const c = this.criterionRepo.create({
      teacherId,
      schoolId,
      name: dto.name,
      description: dto.description ?? null,
      maxScore: dto.maxScore ?? 5,
      scoreType: dto.scoreType ?? 'numeric',
      subjectId: cat === 'behavior' ? null : dto.subjectId ?? null,
      criterionCategory: cat,
    });
    return this.criterionRepo.save(c);
  }

  async updateCriterion(
    id: string,
    teacherId: string,
    dto: {
      name?: string;
      description?: string | null;
      maxScore?: number;
      scoreType?: 'numeric' | 'sign';
      subjectId?: string | null;
      sortOrder?: number;
      criterionCategory?: 'lesson' | 'behavior';
    },
  ) {
    const c = await this.criterionRepo.findOne({ where: { id, teacherId } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kriter bulunamadı.' });
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.maxScore !== undefined) c.maxScore = dto.maxScore;
    if (dto.scoreType !== undefined) c.scoreType = dto.scoreType;
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    if (dto.subjectId !== undefined) c.subjectId = dto.subjectId;
    if (dto.criterionCategory !== undefined) {
      c.criterionCategory = dto.criterionCategory;
      if (dto.criterionCategory === 'behavior') c.subjectId = null;
    }
    return this.criterionRepo.save(c);
  }

  async deleteCriterion(id: string, teacherId: string) {
    const r = await this.criterionRepo.delete({ id, teacherId });
    if (r.affected === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kriter bulunamadı.' });
    return { ok: true };
  }

  async listStudentLists(teacherId: string, schoolId: string | null) {
    if (!schoolId) return [];
    return this.studentListRepo.find({
      where: { teacherId, schoolId },
      order: { createdAt: 'DESC' },
    });
  }

  async createStudentList(teacherId: string, schoolId: string | null, dto: { name: string; studentIds: string[] }) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul gerekli.' });
    const list = this.studentListRepo.create({ teacherId, schoolId, name: dto.name, studentIds: dto.studentIds ?? [] });
    return this.studentListRepo.save(list);
  }

  async updateStudentList(id: string, teacherId: string, dto: { name?: string; studentIds?: string[] }) {
    const list = await this.studentListRepo.findOne({ where: { id, teacherId } });
    if (!list) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Liste bulunamadı.' });
    Object.assign(list, dto);
    return this.studentListRepo.save(list);
  }

  async deleteStudentList(id: string, teacherId: string) {
    const r = await this.studentListRepo.delete({ id, teacherId });
    if (r.affected === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Liste bulunamadı.' });
    return { ok: true };
  }

  async addEvaluationScore(teacherId: string, schoolId: string | null, dto: { criterionId: string; studentId: string; score: number; noteDate: string; note?: string }) {
    if (!schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul gerekli.' });
    const criterion = await this.criterionRepo.findOne({ where: { id: dto.criterionId, teacherId } });
    if (!criterion) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kriter bulunamadı.' });
    const scoreType = criterion.scoreType ?? 'numeric';
    if (scoreType === 'sign') {
      if (![-1, 0, 1].includes(dto.score)) {
        throw new BadRequestException({ code: 'INVALID_SCORE', message: 'Bu kriter için + (1), nötr (0) veya - (-1) girin.' });
      }
    } else {
      if (dto.score < 0 || dto.score > criterion.maxScore) {
        throw new BadRequestException({ code: 'INVALID_SCORE', message: `Puan 0–${criterion.maxScore} arasında olmalı.` });
      }
    }
    const score = this.evaluationScoreRepo.create({
      criterionId: dto.criterionId,
      studentId: dto.studentId,
      teacherId,
      score: dto.score,
      noteDate: dto.noteDate,
      note: dto.note ?? null,
    });
    return this.evaluationScoreRepo.save(score);
  }

  async getEvaluationData(teacherId: string, schoolId: string | null, listId?: string, studentIds?: string[]) {
    if (!schoolId) return { criteria: [], lists: [], students: [], scores: [], studentNotes: [] };
    const [criteria, lists, list] = await Promise.all([
      this.listCriteria(teacherId, schoolId),
      this.listStudentLists(teacherId, schoolId),
      listId ? this.studentListRepo.findOne({ where: { id: listId, teacherId } }) : null,
    ]);
    const listStudentIds = list?.studentIds ?? studentIds;
    const students = listStudentIds?.length
      ? await this.studentRepo.find({ where: { id: In(listStudentIds), schoolId }, order: { name: 'ASC' } })
      : await this.studentRepo.find({ where: { schoolId }, order: { name: 'ASC' }, take: 100 });
    const studentIdsForScores = students.map((s) => s.id);
    const [scores, studentNotes] = await Promise.all([
      studentIdsForScores.length > 0
        ? this.evaluationScoreRepo.find({
            where: { teacherId, studentId: In(studentIdsForScores) },
            relations: ['criterion'],
            order: { noteDate: 'DESC' },
          })
        : [],
      studentIdsForScores.length > 0
        ? this.studentNoteRepo.find({
            where: {
              teacherId,
              studentId: In(studentIdsForScores),
              noteType: In(['positive', 'negative']),
            },
            order: { noteDate: 'DESC', createdAt: 'DESC' },
            select: ['id', 'studentId', 'noteType', 'noteDate', 'description', 'createdAt', 'tags'],
          })
        : [],
    ]);
    return { criteria, lists, students, scores, studentNotes };
  }

  /** JSON yedek / KVKK dışa aktarma: kullanıcıya ait ajanda verilerinin tamamı. */
  async exportFullDataSnapshot(userId: string): Promise<Record<string, unknown>> {
    const notes = await this.noteRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const noteIds = notes.map((n) => n.id);
    const attachments =
      noteIds.length > 0
        ? await this.attachmentRepo.find({ where: { noteId: In(noteIds) }, order: { createdAt: 'ASC' } })
        : [];
    const tasks = await this.taskRepo.find({
      where: { userId },
      relations: ['reminders'],
      order: { createdAt: 'ASC' },
    });
    const noteReminders =
      noteIds.length > 0
        ? await this.reminderRepo.find({
            where: { noteId: In(noteIds) },
            order: { createdAt: 'ASC' },
          })
        : [];
    const assignments = await this.assignmentRepo.find({ where: { userId } });
    const assignEventIds = [...new Set(assignments.map((a) => a.eventId))];
    const createdSchoolEvents = await this.schoolEventRepo.find({
      where: { createdBy: userId },
      order: { createdAt: 'ASC' },
    });
    const mergedEventIds = [...new Set([...assignEventIds, ...createdSchoolEvents.map((e) => e.id)])];
    const schoolEvents =
      mergedEventIds.length > 0
        ? await this.schoolEventRepo.find({ where: { id: In(mergedEventIds) }, order: { eventAt: 'ASC' } })
        : [];
    const platformEvents = await this.platformEventRepo.find({
      where: { createdBy: userId },
      order: { createdAt: 'ASC' },
    });
    const templates = await this.templateRepo.find({ where: { userId }, order: { title: 'ASC' } });
    const studentNotes = await this.studentNoteRepo.find({ where: { teacherId: userId }, order: { createdAt: 'ASC' } });
    const parentMeetings = await this.parentMeetingRepo.find({
      where: { teacherId: userId },
      order: { meetingDate: 'ASC' },
    });
    const criteria = await this.criterionRepo.find({ where: { teacherId: userId }, order: { name: 'ASC' } });
    const studentLists = await this.studentListRepo.find({ where: { teacherId: userId }, order: { name: 'ASC' } });
    const scores = await this.evaluationScoreRepo.find({ where: { teacherId: userId }, order: { noteDate: 'DESC' } });

    const jsonSafe = (v: unknown) => JSON.parse(JSON.stringify(v, (_, val) => (val instanceof Date ? val.toISOString() : val)));

    return {
      /** İçe aktarmada sahiplik doğrulaması için (me-data-import). */
      snapshot_user_id: userId,
      notes: jsonSafe(notes) as unknown[],
      note_attachments: jsonSafe(attachments) as unknown[],
      tasks: jsonSafe(
        tasks.map((t) => ({
          ...t,
          reminders: (t.reminders ?? []).map((r) => ({
            id: r.id,
            note_id: r.noteId,
            task_id: r.taskId,
            remind_at: r.remindAt?.toISOString?.() ?? r.remindAt,
            repeat_rule: r.repeatRule,
            push_sent: r.pushSent,
            silent_until: r.silentUntil?.toISOString?.() ?? r.silentUntil,
            snooze_count: r.snoozeCount,
            created_at: r.createdAt?.toISOString?.() ?? r.createdAt,
          })),
        })),
      ) as unknown[],
      note_reminders: jsonSafe(noteReminders) as unknown[],
      school_event_assignments: jsonSafe(assignments) as unknown[],
      school_events: jsonSafe(schoolEvents) as unknown[],
      platform_events: jsonSafe(platformEvents) as unknown[],
      templates: jsonSafe(templates) as unknown[],
      student_notes: jsonSafe(studentNotes) as unknown[],
      parent_meetings: jsonSafe(parentMeetings) as unknown[],
      evaluation_criteria: jsonSafe(criteria) as unknown[],
      student_lists: jsonSafe(studentLists) as unknown[],
      evaluation_scores: jsonSafe(scores) as unknown[],
    };
  }
}
