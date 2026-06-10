import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { CalendarEvent } from './agenda-calendar-grid';
import { AGENDA_SOURCE_THEME } from './agenda-source-theme';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type AgendaNote = { title: string; body?: string | null; pinned?: boolean };
type AgendaTask = { title: string; dueDate?: string | null; status: string; priority?: string };
type StudentNoteRow = { noteType: string; noteDate: string; student?: { name: string }; description?: string | null };
type ParentMeetingRow = { meetingDate: string; student?: { name: string }; subject?: string | null; meetingType?: string | null };

export type AgendaPrintSections = {
  summary: boolean;
  calendar: boolean;
  notes: boolean;
  tasks: boolean;
  studentNotes: boolean;
  parentMeetings: boolean;
};

export type AgendaPrintInput = {
  schoolName: string;
  teacherName: string;
  periodLabel: string;
  rangeStart: string;
  rangeEnd: string;
  sections: AgendaPrintSections;
  summary: { pendingTasks: number; overdueTasks: number; todayEventCount: number } | null;
  notes: AgendaNote[];
  tasks: AgendaTask[];
  events: CalendarEvent[];
  studentNotes: StudentNoteRow[];
  parentMeetings: ParentMeetingRow[];
};

const SOURCE_LABEL: Record<string, string> = {
  PERSONAL: AGENDA_SOURCE_THEME.PERSONAL.label,
  SCHOOL: AGENDA_SOURCE_THEME.SCHOOL.label,
  PLATFORM: AGENDA_SOURCE_THEME.PLATFORM.label,
};

const NOTE_TYPE_LABEL: Record<string, string> = {
  positive: 'Olumlu',
  negative: 'Olumsuz',
  observation: 'Gözlem',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  @page { margin: 14mm 12mm; size: A4 portrait; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
    font-size: 9.5px;
    line-height: 1.45;
    color: #0f172a;
    margin: 0;
    padding: 0;
  }
  .doc { max-width: 100%; }
  .hero {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #c7d2fe;
    margin-bottom: 14px;
  }
  .hero-top {
    background: linear-gradient(135deg, #1e40af 0%, #3730a3 55%, #4f46e5 100%);
    color: #fff;
    padding: 16px 18px 14px;
  }
  .hero-brand { font-size: 8px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.85; }
  .hero h1 { margin: 6px 0 0; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
  .hero-sub { margin-top: 4px; font-size: 10px; opacity: 0.92; }
  .hero-meta {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 14px;
    padding: 10px 18px 12px;
    background: #eef2ff;
    font-size: 8.5px;
  }
  .hero-meta b { display: block; color: #3730a3; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1px; }
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .kpi {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    background: #f8fafc;
  }
  .kpi .n { font-size: 16px; font-weight: 800; color: #1e3a8a; line-height: 1.1; }
  .kpi .l { font-size: 7.5px; color: #64748b; margin-top: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  section { margin-bottom: 16px; page-break-inside: avoid; }
  section h2 {
    font-size: 11px;
    font-weight: 800;
    color: #1e3a8a;
    margin: 0 0 8px;
    padding-bottom: 5px;
    border-bottom: 2px solid #c7d2fe;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  section h2 .cnt {
    font-size: 8px;
    font-weight: 700;
    background: #e0e7ff;
    color: #3730a3;
    padding: 2px 7px;
    border-radius: 999px;
  }
  table.data { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  table.data th, table.data td {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
    text-align: left;
  }
  table.data thead th {
    background: #1e40af !important;
    color: #fff !important;
    font-weight: 700;
    font-size: 8px;
  }
  table.data tbody tr:nth-child(even) td { background: #f8fafc; }
  .empty { color: #64748b; font-style: italic; text-align: center; padding: 12px !important; }
  .badge {
    display: inline-block;
    font-size: 7px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .badge.ok { background: #d1fae5 !important; color: #065f46; border: 1px solid #6ee7b7; }
  .badge.wait { background: #fef3c7 !important; color: #92400e; border: 1px solid #fcd34d; }
  .badge.src-p { background: #ede9fe !important; color: #5b21b6; border: 1px solid #c4b5fd; }
  .badge.src-s { background: #e0f2fe !important; color: #075985; border: 1px solid #7dd3fc; }
  .badge.src-f { background: #fef3c7 !important; color: #92400e; border: 1px solid #fcd34d; }
  .badge.pos { background: #d1fae5 !important; color: #065f46; }
  .badge.neg { background: #fee2e2 !important; color: #991b1b; }
  .badge.obs { background: #ccfbf1 !important; color: #115e59; }
  .muted { color: #64748b; font-size: 7.5px; }
  .footer {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 7.5px;
    color: #64748b;
    text-align: center;
  }
  .hint {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    font-size: 7.5px;
    color: #92400e;
  }
`;

function sourceBadgeClass(source: string): string {
  if (source === 'PERSONAL') return 'src-p';
  if (source === 'SCHOOL') return 'src-s';
  return 'src-f';
}

function formatYmd(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return format(d, 'd MMM yyyy', { locale: tr });
}

function buildSummaryKpis(input: AgendaPrintInput): string {
  const { notes, tasks, events, studentNotes, parentMeetings, summary } = input;
  const pending = summary?.pendingTasks ?? tasks.filter((t) => t.status === 'pending').length;
  const overdue = summary?.overdueTasks ?? 0;
  return `
    <div class="kpis">
      <div class="kpi"><div class="n">${events.length}</div><div class="l">Takvim kaydı</div></div>
      <div class="kpi"><div class="n">${notes.length}</div><div class="l">Not</div></div>
      <div class="kpi"><div class="n">${pending}</div><div class="l">Bekleyen görev</div></div>
      <div class="kpi"><div class="n">${overdue}</div><div class="l">Geciken görev</div></div>
    </div>
    <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
      <div class="kpi"><div class="n">${studentNotes.length}</div><div class="l">Öğrenci notu</div></div>
      <div class="kpi"><div class="n">${parentMeetings.length}</div><div class="l">Veli görüşmesi</div></div>
    </div>`;
}

function buildCalendarSection(events: CalendarEvent[], rangeStart: string, rangeEnd: string): string {
  const filtered = events
    .filter((e) => {
      const d = e.start.slice(0, 10);
      return d >= rangeStart && d <= rangeEnd;
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'tr'));

  const rows = filtered
    .map((e) => {
      const src = SOURCE_LABEL[e.source] ?? e.source;
      const cls = sourceBadgeClass(e.source);
      const day = formatYmd(e.start.slice(0, 10));
      return `<tr>
        <td>${escapeHtml(day)}</td>
        <td><span class="badge ${cls}">${escapeHtml(src)}</span></td>
        <td><strong>${escapeHtml(e.title)}</strong>${e.createdBy ? `<div class="muted">${escapeHtml(e.createdBy)}</div>` : ''}</td>
      </tr>`;
    })
    .join('');

  return `
    <section>
      <h2>Takvim <span class="cnt">${filtered.length}</span></h2>
      <table class="data">
        <thead><tr><th>Tarih</th><th>Kaynak</th><th>Etkinlik</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="empty">Bu dönemde kayıt yok</td></tr>'}</tbody>
      </table>
    </section>`;
}

function buildNotesSection(notes: AgendaNote[]): string {
  const rows = notes
    .map(
      (n) => `<tr>
        <td><strong>${escapeHtml(n.title)}</strong>${n.pinned ? ' <span class="badge wait">Sabit</span>' : ''}</td>
        <td>${escapeHtml((n.body ?? '').slice(0, 280))}</td>
      </tr>`,
    )
    .join('');
  return `
    <section>
      <h2>Notlar <span class="cnt">${notes.length}</span></h2>
      <table class="data">
        <thead><tr><th>Başlık</th><th>İçerik</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2" class="empty">Kayıt yok</td></tr>'}</tbody>
      </table>
    </section>`;
}

function buildTasksSection(tasks: AgendaTask[]): string {
  const rows = tasks
    .map((t) => {
      const st = TASK_STATUS_LABEL[t.status] ?? t.status;
      const cls = t.status === 'completed' ? 'ok' : 'wait';
      return `<tr>
        <td><strong>${escapeHtml(t.title)}</strong></td>
        <td>${t.dueDate ? escapeHtml(formatYmd(t.dueDate)) : '—'}</td>
        <td><span class="badge ${cls}">${escapeHtml(st)}</span></td>
        <td>${escapeHtml(t.priority ?? '—')}</td>
      </tr>`;
    })
    .join('');
  return `
    <section>
      <h2>Görevler <span class="cnt">${tasks.length}</span></h2>
      <table class="data">
        <thead><tr><th>Başlık</th><th>Son tarih</th><th>Durum</th><th>Öncelik</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">Kayıt yok</td></tr>'}</tbody>
      </table>
    </section>`;
}

function buildStudentNotesSection(items: StudentNoteRow[]): string {
  const rows = items
    .map((sn) => {
      const tl = NOTE_TYPE_LABEL[sn.noteType] ?? sn.noteType;
      const cls = sn.noteType === 'positive' ? 'pos' : sn.noteType === 'negative' ? 'neg' : 'obs';
      return `<tr>
        <td>${escapeHtml(sn.student?.name ?? '—')}</td>
        <td><span class="badge ${cls}">${escapeHtml(tl)}</span></td>
        <td>${escapeHtml(formatYmd(sn.noteDate))}</td>
        <td>${escapeHtml((sn.description ?? '').slice(0, 200))}</td>
      </tr>`;
    })
    .join('');
  return `
    <section>
      <h2>Öğrenci notları <span class="cnt">${items.length}</span></h2>
      <table class="data">
        <thead><tr><th>Öğrenci</th><th>Tür</th><th>Tarih</th><th>Açıklama</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">Kayıt yok</td></tr>'}</tbody>
      </table>
    </section>`;
}

function buildParentMeetingsSection(items: ParentMeetingRow[]): string {
  const rows = items
    .map(
      (pm) => `<tr>
        <td>${escapeHtml(pm.student?.name ?? '—')}</td>
        <td>${escapeHtml(formatYmd(pm.meetingDate))}</td>
        <td>${escapeHtml(pm.meetingType ?? '—')}</td>
        <td>${escapeHtml(pm.subject ?? '—')}</td>
      </tr>`,
    )
    .join('');
  return `
    <section>
      <h2>Veli görüşmeleri <span class="cnt">${items.length}</span></h2>
      <table class="data">
        <thead><tr><th>Öğrenci</th><th>Tarih</th><th>Tür</th><th>Konu</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">Kayıt yok</td></tr>'}</tbody>
      </table>
    </section>`;
}

export function buildAgendaPrintHtml(input: AgendaPrintInput): string {
  const printedAt = format(new Date(), "d MMMM yyyy HH:mm", { locale: tr });
  const { sections } = input;

  const bodyParts: string[] = [];

  if (sections.summary) bodyParts.push(buildSummaryKpis(input));
  if (sections.calendar) bodyParts.push(buildCalendarSection(input.events, input.rangeStart, input.rangeEnd));
  if (sections.notes) bodyParts.push(buildNotesSection(input.notes));
  if (sections.tasks) bodyParts.push(buildTasksSection(input.tasks));
  if (sections.studentNotes) bodyParts.push(buildStudentNotesSection(input.studentNotes));
  if (sections.parentMeetings) bodyParts.push(buildParentMeetingsSection(input.parentMeetings));

  if (bodyParts.length === 0) {
    bodyParts.push('<p class="empty">Yazdırılacak bölüm seçilmedi.</p>');
  }

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/>
<title>Öğretmen Ajandası — ${escapeHtml(input.schoolName)}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="doc">
  <div class="hero">
    <div class="hero-top">
      <div class="hero-brand">Uzaedu Öğretmen</div>
      <h1>Öğretmen Ajandası</h1>
      <div class="hero-sub">${escapeHtml(input.schoolName)}</div>
    </div>
    <div class="hero-meta">
      <div><b>Öğretmen</b>${escapeHtml(input.teacherName)}</div>
      <div><b>Dönem</b>${escapeHtml(input.periodLabel)}</div>
      <div><b>Tarih aralığı</b>${escapeHtml(formatYmd(input.rangeStart))} – ${escapeHtml(formatYmd(input.rangeEnd))}</div>
      <div><b>Yazdırma</b>${escapeHtml(printedAt)}</div>
    </div>
  </div>
  ${bodyParts.join('\n')}
  <div class="hint">PDF kaydetmek için yazdır penceresinde «PDF olarak kaydet» / «Microsoft Print to PDF» hedefini seçin. Renkli çıktı için «Arka plan grafikleri» seçeneğini açın.</div>
  <div class="footer">Uzaedu Öğretmen · Öğretmen Ajandası · ${escapeHtml(input.schoolName)} · ${escapeHtml(printedAt)}</div>
</div>
</body></html>`;
}

export function openAgendaPrintWindow(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
