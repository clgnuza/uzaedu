import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AgendaReminder } from './entities/agenda-reminder.entity';
import { AgendaTask } from './entities/agenda-task.entity';
import { AgendaNote } from './entities/agenda-note.entity';
import { NotificationsService } from '../notifications/notifications.service';

function formatRemindAtTr(d: Date): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Europe/Istanbul',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function formatDueTr(ymd: string | null | undefined, dueTime: string | null | undefined): string | null {
  if (!ymd || ymd.length < 10) return null;
  const p = ymd.slice(0, 10).split('-').map((x) => parseInt(x, 10));
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = p;
  const datePart = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  const t = dueTime?.trim();
  return t ? `${datePart} · ${t}` : datePart;
}

/** Kısa / yalnızca rakam başlıkta anlamlı satır üret */
function taskReminderDisplayName(task: AgendaTask): string {
  const raw = (task.title ?? '').trim();
  const weak = raw.length === 0 || (raw.length <= 3 && /^\d+$/.test(raw));
  if (!weak) return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
  const desc = task.description?.trim();
  if (desc) return desc.length > 120 ? `${desc.slice(0, 117)}…` : desc;
  const due = formatDueTr(task.dueDate, task.dueTime);
  if (due) return `Son tarih ${due}`;
  return raw ? `“${raw}”` : 'Başlıksız görev';
}

function noteReminderDisplayName(note: AgendaNote): string {
  const t = (note.title ?? '').trim();
  if (t.length > 120) return `${t.slice(0, 117)}…`;
  return t || 'Not';
}

@Injectable()
export class TeacherAgendaReminderSchedulerService {
  private readonly log = new Logger(TeacherAgendaReminderSchedulerService.name);

  constructor(
    @InjectRepository(AgendaReminder)
    private readonly reminderRepo: Repository<AgendaReminder>,
    @InjectRepository(AgendaTask)
    private readonly taskRepo: Repository<AgendaTask>,
    @InjectRepository(AgendaNote)
    private readonly noteRepo: Repository<AgendaNote>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('*/1 * * * *')
  async dispatchDueReminders() {
    const now = new Date();
    const due = await this.reminderRepo.find({
      where: { pushSent: false, remindAt: LessThanOrEqual(now) },
      relations: ['task', 'note'],
      order: { remindAt: 'ASC' },
      take: 200,
    });
    for (const r of due) {
      let task = r.task ?? null;
      if (r.taskId && !task) {
        task = await this.taskRepo.findOne({ where: { id: r.taskId } });
      }
      let note = r.note ?? null;
      if (r.noteId && !note) {
        note = await this.noteRepo.findOne({ where: { id: r.noteId } });
      }

      const userId = task?.userId ?? note?.userId ?? null;
      if (!userId) {
        r.pushSent = true;
        await this.reminderRepo.save(r);
        continue;
      }
      try {
        const remindStr = formatRemindAtTr(new Date(r.remindAt));

        let title: string;
        let body: string;
        const meta: Record<string, unknown> = {
          taskId: r.taskId,
          noteId: r.noteId,
          remindAt: r.remindAt?.toISOString?.() ?? String(r.remindAt),
        };

        if (task) {
          const name = taskReminderDisplayName(task);
          title = `Görev: ${name}`;
          const parts = [`Hatırlatma zamanı: ${remindStr}.`];
          const due = formatDueTr(task.dueDate, task.dueTime);
          if (due) parts.push(`Son tarih: ${due}.`);
          parts.push('Öğretmen ajandası › Görevler bölümünden kontrol edebilirsiniz.');
          body = parts.join(' ');
          meta.kind = 'task';
          meta.displayTitle = name;
          if (task.dueDate) meta.dueDate = task.dueDate;
        } else if (note) {
          const name = noteReminderDisplayName(note);
          title = `Not: ${name}`;
          body = `Hatırlatma zamanı: ${remindStr}. Öğretmen ajandası › Notlar bölümünden açabilirsiniz.`;
          meta.kind = 'note';
          meta.displayTitle = name;
        } else {
          title = 'Ajanda hatırlatması';
          body = `Hatırlatma zamanı: ${remindStr}. Öğretmen ajandasını kontrol edin.`;
        }

        await this.notificationsService.createInboxEntry({
          user_id: userId,
          event_type: 'agenda.reminder',
          entity_id: r.id,
          target_screen: 'ogretmen-ajandasi',
          title,
          body,
          metadata: meta,
        });
        r.pushSent = true;
        await this.reminderRepo.save(r);
      } catch (e) {
        this.log.warn(`Reminder ${r.id} işlenemedi: ${(e as Error).message}`);
      }
    }
  }
}
