import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { AgendaNote } from './entities/agenda-note.entity';
import { AgendaNoteAttachment } from './entities/agenda-note-attachment.entity';
import { AgendaTask } from './entities/agenda-task.entity';
import { AgendaReminder } from './entities/agenda-reminder.entity';
import { AgendaSchoolEvent } from './entities/agenda-school-event.entity';
import { AgendaSchoolEventAssignment } from './entities/agenda-school-event-assignment.entity';
import { AgendaPlatformEvent } from './entities/agenda-platform-event.entity';
import { AgendaNoteTemplate } from './entities/agenda-note-template.entity';
import { AgendaStudentNote, type AgendaStudentNotePrivacy } from './entities/agenda-student-note.entity';
import { AgendaParentMeeting } from './entities/agenda-parent-meeting.entity';
import { TeacherEvaluationCriterion } from './entities/teacher-evaluation-criterion.entity';
import { TeacherStudentList } from './entities/teacher-student-list.entity';
import { TeacherEvaluationScore } from './entities/teacher-evaluation-score.entity';

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map((x) => asObj(x)) : [];
}

function parseDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseDateReq(v: unknown, fallback: Date): Date {
  return parseDate(v) ?? fallback;
}

@Injectable()
export class TeacherAgendaImportService {
  constructor(
    @InjectRepository(AgendaNote)
    private readonly noteRepo: Repository<AgendaNote>,
  ) {}

  async importFromSnapshot(userId: string, userSchoolId: string | null, snapshot: Record<string, unknown>): Promise<void> {
    await this.noteRepo.manager.transaction(async (m) => {
      await this.clearUserAgenda(m, userId);
      await this.insertFromSnapshot(m, userId, userSchoolId, snapshot);
    });
  }

  /** Hesap kapatma (KVKK): ajanda ve bağlı kişisel verileri kalıcı siler. */
  async deleteAllUserAgendaData(userId: string): Promise<void> {
    await this.noteRepo.manager.transaction(async (m) => {
      await this.clearUserAgenda(m, userId);
    });
  }

  private async clearUserAgenda(m: EntityManager, userId: string): Promise<void> {
    await m.delete(TeacherEvaluationScore, { teacherId: userId });
    await m.delete(AgendaStudentNote, { teacherId: userId });
    await m.delete(AgendaParentMeeting, { teacherId: userId });
    await m.delete(TeacherEvaluationCriterion, { teacherId: userId });
    await m.delete(TeacherStudentList, { teacherId: userId });

    const noteIds = (await m.find(AgendaNote, { where: { userId }, select: ['id'] })).map((n) => n.id);
    const taskIds = (await m.find(AgendaTask, { where: { userId }, select: ['id'] })).map((t) => t.id);
    if (noteIds.length) await m.delete(AgendaReminder, { noteId: In(noteIds) });
    if (taskIds.length) await m.delete(AgendaReminder, { taskId: In(taskIds) });

    if (noteIds.length) await m.delete(AgendaNoteAttachment, { noteId: In(noteIds) });
    await m.delete(AgendaTask, { userId });
    await m.delete(AgendaNote, { userId });

    await m.delete(AgendaSchoolEventAssignment, { userId });
    await m.delete(AgendaPlatformEvent, { createdBy: userId });
    await m.delete(AgendaSchoolEvent, { createdBy: userId });
    await m.delete(AgendaNoteTemplate, { userId });
  }

  private async insertFromSnapshot(
    m: EntityManager,
    userId: string,
    userSchoolId: string | null,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    const notes = asArr(snapshot.notes);
    const attachments = asArr(snapshot.note_attachments);
    const tasksRaw = asArr(snapshot.tasks);
    const noteReminders = asArr(snapshot.note_reminders);
    const schoolEvents = asArr(snapshot.school_events);
    const assignments = asArr(snapshot.school_event_assignments);
    const platformEvents = asArr(snapshot.platform_events);
    const templates = asArr(snapshot.templates);
    const studentNotes = asArr(snapshot.student_notes);
    const parentMeetings = asArr(snapshot.parent_meetings);
    const criteria = asArr(snapshot.evaluation_criteria);
    const studentLists = asArr(snapshot.student_lists);
    const scores = asArr(snapshot.evaluation_scores);

    const now = new Date();

    for (const row of schoolEvents) {
      const sid = (row.schoolId as string) ?? null;
      if (sid && userSchoolId && sid !== userSchoolId) continue;
      if (sid && !userSchoolId) continue;
      const schoolIdVal = String(row.schoolId ?? userSchoolId ?? '');
      if (!schoolIdVal) continue;
      const evId = String(row.id);
      const repo = m.getRepository(AgendaSchoolEvent);
      const existing = await repo.findOne({ where: { id: evId } });
      if (existing && existing.createdBy !== userId) continue;
      const payload = repo.create({
        id: evId,
        schoolId: schoolIdVal,
        title: String(row.title ?? ''),
        description: (row.description as string | null) ?? null,
        eventAt: parseDateReq(row.eventAt, now),
        eventType: (row.eventType as string | null) ?? null,
        targetAudience: (row.targetAudience as string | null) ?? null,
        attachmentUrl: (row.attachmentUrl as string | null) ?? null,
        important: Boolean(row.important),
        createdBy: userId,
        archivedAt: parseDate(row.archivedAt as unknown),
      });
      await repo.save(payload);
    }

    for (const row of notes) {
      if (!row.id) continue;
      const n = m.getRepository(AgendaNote).create({
        id: String(row.id),
        title: String(row.title ?? ''),
        body: (row.body as string | null) ?? null,
        tags: (row.tags as string[] | null) ?? null,
        subjectId: (row.subjectId as string | null) ?? null,
        classId: (row.classId as string | null) ?? null,
        pinned: Boolean(row.pinned),
        color: (row.color as string | null) ?? null,
        source: (row.source as 'PERSONAL' | 'SCHOOL' | 'PLATFORM') ?? 'PERSONAL',
        userId,
        schoolId: (row.schoolId as string | null) ?? userSchoolId,
        createdBy: (row.createdBy as string | null) ?? userId,
        archivedAt: parseDate(row.archivedAt as unknown),
        createdAt: parseDate(row.createdAt as unknown) ?? now,
        updatedAt: parseDate(row.updatedAt as unknown) ?? now,
      });
      await m.getRepository(AgendaNote).save(n);
    }

    for (const row of attachments) {
      if (!row.id || !row.noteId) continue;
      const a = m.getRepository(AgendaNoteAttachment).create({
        id: String(row.id),
        noteId: String(row.noteId),
        fileUrl: String(row.fileUrl ?? ''),
        fileType: (row.fileType as string | null) ?? null,
        fileName: (row.fileName as string | null) ?? null,
        createdAt: parseDate(row.createdAt as unknown) ?? now,
      });
      await m.getRepository(AgendaNoteAttachment).save(a);
    }

    for (const row of tasksRaw) {
      if (!row.id) continue;
      const reminders = asArr((row as Record<string, unknown>).reminders);
      const t = m.getRepository(AgendaTask).create({
        id: String(row.id),
        title: String(row.title ?? ''),
        description: (row.description as string | null) ?? null,
        dueDate: (row.dueDate as string | null) ?? null,
        dueTime: (row.dueTime as string | null) ?? null,
        priority: (row.priority as 'low' | 'medium' | 'high') ?? 'medium',
        repeat: (row.repeat as 'none' | 'daily' | 'weekly' | 'monthly') ?? 'none',
        status: (row.status as 'pending' | 'completed' | 'overdue' | 'postponed') ?? 'pending',
        source: (row.source as 'PERSONAL' | 'SCHOOL' | 'PLATFORM') ?? 'PERSONAL',
        userId,
        schoolId: (row.schoolId as string | null) ?? userSchoolId,
        assignedBy: (row.assignedBy as string | null) ?? null,
        linkedModule: (row.linkedModule as string | null) ?? null,
        linkedEntityId: (row.linkedEntityId as string | null) ?? null,
        studentId: (row.studentId as string | null) ?? null,
        completedAt: parseDate(row.completedAt as unknown),
        createdAt: parseDate(row.createdAt as unknown) ?? now,
        updatedAt: parseDate(row.updatedAt as unknown) ?? now,
      });
      await m.getRepository(AgendaTask).save(t);
      for (const r of reminders) {
        if (!r.id) continue;
        const tid = (r.task_id as string | null) ?? (r.taskId as string | null) ?? String(row.id);
        const rem = m.getRepository(AgendaReminder).create({
          id: String(r.id),
          noteId: (r.note_id as string | null) ?? (r.noteId as string | null) ?? null,
          taskId: tid,
          remindAt: parseDateReq(r.remind_at ?? r.remindAt, now),
          repeatRule: (r.repeat_rule as string | null) ?? (r.repeatRule as string | null) ?? null,
          pushSent: Boolean(r.push_sent ?? r.pushSent),
          silentUntil: parseDate(r.silent_until ?? r.silentUntil),
          snoozeCount: Number(r.snooze_count ?? r.snoozeCount ?? 0),
          createdAt: parseDate(r.created_at ?? r.createdAt) ?? now,
        });
        await m.getRepository(AgendaReminder).save(rem);
      }
    }

    for (const r of noteReminders) {
      if (!r.id) continue;
      const exists = await m.getRepository(AgendaReminder).findOne({ where: { id: String(r.id) } });
      if (exists) continue;
      const rem = m.getRepository(AgendaReminder).create({
        id: String(r.id),
        noteId: (r.note_id as string | null) ?? (r.noteId as string | null) ?? null,
        taskId: (r.task_id as string | null) ?? (r.taskId as string | null) ?? null,
        remindAt: parseDateReq(r.remind_at ?? r.remindAt, now),
        repeatRule: (r.repeat_rule as string | null) ?? (r.repeatRule as string | null) ?? null,
        pushSent: Boolean(r.push_sent ?? r.pushSent),
        silentUntil: parseDate(r.silent_until ?? r.silentUntil),
        snoozeCount: Number(r.snooze_count ?? r.snoozeCount ?? 0),
        createdAt: parseDate(r.created_at ?? r.createdAt) ?? now,
      });
      await m.getRepository(AgendaReminder).save(rem);
    }

    for (const row of assignments) {
      if (!row.id) continue;
      const a = m.getRepository(AgendaSchoolEventAssignment).create({
        id: String(row.id),
        eventId: String(row.eventId ?? row.event_id),
        userId,
        dueAt: parseDate(row.dueAt ?? row.due_at),
        readAt: parseDate(row.readAt ?? row.read_at),
        completedAt: parseDate(row.completedAt ?? row.completed_at),
        createdAt: parseDate(row.createdAt ?? row.created_at) ?? now,
      });
      await m.getRepository(AgendaSchoolEventAssignment).save(a);
    }

    for (const row of platformEvents) {
      if (!row.id) continue;
      const p = m.getRepository(AgendaPlatformEvent).create({
        id: String(row.id),
        title: String(row.title ?? ''),
        body: (row.body as string | null) ?? null,
        eventAt: parseDateReq(row.eventAt, now),
        segment: (row.segment as string | null) ?? null,
        notificationSent: Boolean(row.notificationSent),
        createdBy: userId,
        createdAt: parseDate(row.createdAt) ?? now,
      });
      await m.getRepository(AgendaPlatformEvent).save(p);
    }

    for (const row of templates) {
      if (!row.id) continue;
      const t = m.getRepository(AgendaNoteTemplate).create({
        id: String(row.id),
        userId,
        schoolId: (row.schoolId as string | null) ?? userSchoolId,
        title: String(row.title ?? ''),
        bodyTemplate: (row.bodyTemplate as string | null) ?? (row.body as string | null) ?? null,
        isSystem: Boolean(row.isSystem ?? row.is_system),
        createdAt: parseDate(row.createdAt) ?? now,
        updatedAt: parseDate(row.updatedAt) ?? now,
      });
      await m.getRepository(AgendaNoteTemplate).save(t);
    }

    for (const row of criteria) {
      if (!row.id) continue;
      const sch = String(row.schoolId ?? userSchoolId ?? '');
      if (!sch) continue;
      const c = m.getRepository(TeacherEvaluationCriterion).create({
        id: String(row.id),
        teacherId: userId,
        schoolId: sch,
        name: String(row.name ?? ''),
        description: (row.description as string | null) ?? null,
        maxScore: Number(row.maxScore ?? 5),
        scoreType: (row.scoreType as 'numeric' | 'sign') ?? 'numeric',
        subjectId: (row.subjectId as string | null) ?? null,
        sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
        createdAt: parseDate(row.createdAt) ?? now,
      });
      await m.getRepository(TeacherEvaluationCriterion).save(c);
    }

    for (const row of studentLists) {
      if (!row.id) continue;
      const l = m.getRepository(TeacherStudentList).create({
        id: String(row.id),
        teacherId: userId,
        schoolId: String(row.schoolId ?? userSchoolId ?? ''),
        name: String(row.name ?? ''),
        studentIds: Array.isArray(row.studentIds) ? (row.studentIds as string[]) : [],
        createdAt: parseDate(row.createdAt) ?? now,
      });
      if (!l.schoolId) continue;
      await m.getRepository(TeacherStudentList).save(l);
    }

    const stRepo = m.getRepository(Student);

    for (const row of studentNotes) {
      if (!row.id) continue;
      const stId = String(row.studentId ?? row.student_id ?? '');
      if (!stId || !userSchoolId) continue;
      const ok = await stRepo.count({ where: { id: stId, schoolId: userSchoolId } });
      if (ok === 0) continue;
      const sn = m.getRepository(AgendaStudentNote).create({
        id: String(row.id),
        studentId: stId,
        teacherId: userId,
        noteType: (row.noteType as 'positive' | 'negative' | 'observation') ?? 'observation',
        description: (row.description as string | null) ?? null,
        subjectId: (row.subjectId as string | null) ?? null,
        noteDate: String(row.noteDate ?? row.note_date ?? '').slice(0, 10),
        tags: (row.tags as string[] | null) ?? null,
        privacyLevel:
          (row.privacyLevel as AgendaStudentNotePrivacy) ??
          (row.privacy_level as AgendaStudentNotePrivacy) ??
          'private',
        createdAt: parseDate(row.createdAt) ?? now,
      });
      await m.getRepository(AgendaStudentNote).save(sn);
    }

    for (const row of parentMeetings) {
      if (!row.id) continue;
      const stId = String(row.studentId ?? row.student_id ?? '');
      if (!stId || !userSchoolId) continue;
      const ok = await stRepo.count({ where: { id: stId, schoolId: userSchoolId } });
      if (ok === 0) continue;
      const fu = row.followUpDate ?? row.follow_up_date;
      const pm = m.getRepository(AgendaParentMeeting).create({
        id: String(row.id),
        studentId: stId,
        teacherId: userId,
        meetingDate: String(row.meetingDate ?? row.meeting_date ?? '').slice(0, 10),
        meetingType: (row.meetingType as string | null) ?? null,
        subject: (row.subject as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        followUpDate: fu != null && fu !== '' ? String(fu).slice(0, 10) : null,
        reminderCreated: Boolean(row.reminderCreated ?? row.reminder_created),
        createdAt: parseDate(row.createdAt) ?? now,
      });
      await m.getRepository(AgendaParentMeeting).save(pm);
    }

    for (const row of scores) {
      if (!row.id) continue;
      const stId = String(row.studentId ?? row.student_id ?? '');
      if (!stId || !userSchoolId) continue;
      const ok = await stRepo.count({ where: { id: stId, schoolId: userSchoolId } });
      if (ok === 0) continue;
      const sc = m.getRepository(TeacherEvaluationScore).create({
        id: String(row.id),
        criterionId: String(row.criterionId ?? row.criterion_id ?? ''),
        studentId: stId,
        teacherId: userId,
        score: Number(row.score ?? 0),
        noteDate: String(row.noteDate ?? row.note_date ?? '').slice(0, 10),
        note: (row.note as string | null) ?? null,
        createdAt: parseDate(row.createdAt) ?? now,
      });
      await m.getRepository(TeacherEvaluationScore).save(sc);
    }
  }
}
