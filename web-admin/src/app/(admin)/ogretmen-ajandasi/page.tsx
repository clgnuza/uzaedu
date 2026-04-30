'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import {
  Calendar,
  ListTodo,
  StickyNote,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  UserPlus,
  Search,
  Download,
  Printer,
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { AgendaCalendarGrid, type CalendarEvent } from './components/agenda-calendar-grid';
import { AGENDA_SOURCE_KEYS, AGENDA_SOURCE_THEME } from './components/agenda-source-theme';
import { EventDetailModal } from './components/event-detail-modal';
import { NoteFormModal } from './components/note-form-modal';
import { NoteDetailModal } from './components/note-detail-modal';
import { TaskFormModal } from './components/task-form-modal';
import { StudentNoteFormModal } from './components/student-note-form-modal';
import { ParentMeetingFormModal } from './components/parent-meeting-form-modal';
import { SchoolEventFormModal } from './components/school-event-form-modal';
import { TemplatePickerModal } from './components/template-picker-modal';
import { StudentNoteDetailModal, type StudentNoteDetail } from './components/student-note-detail-modal';
import { AgendaHeroSchool, AgendaHeroTeacher } from './components/AgendaHero';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type AgendaNote = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[] | null;
  color?: string | null;
  pinned?: boolean;
  subjectId?: string | null;
  classId?: string | null;
  attachments?: { id: string; fileUrl: string; fileName?: string | null; fileType?: string | null }[];
};
type AgendaTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  status: string;
  priority: string;
  repeat?: string;
  studentId?: string | null;
  reminders?: { id: string; remindAt: string; pushSent?: boolean }[];
};

function agendaTaskRemindAtLocal(task: AgendaTask): string | undefined {
  const r = task.reminders?.find((x) => !x.pushSent);
  if (!r?.remindAt) return undefined;
  const d = new Date(r.remindAt);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
type Student = { id: string; name: string };
type Subject = { id: string; label: string };
type Class = { id: string; label: string };

type ViewTab = 'calendar' | 'notes' | 'tasks' | 'student_notes' | 'parent_meetings';

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** API yyyy-MM-dd → mobilde 11/04/2026 */
function formatYmdSlash(ymd: string | null | undefined): string {
  if (!ymd || ymd.length < 10) return String(ymd ?? '');
  const p = ymd.slice(0, 10).split('-');
  if (p.length !== 3) return ymd;
  const [y, m, d] = p;
  return `${d}/${m}/${y}`;
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toStartEnd(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toYMD(start), end: toYMD(end) };
}

const PANEL_CARD_SHELL =
  'shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(15,23,42,0.1)] ring-1 ring-black/3 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] dark:ring-white/6';

/** Sekme kartları — üst şerit + çerçeve (Kişisel/Okul/Platform takvim renkleriyle çakışmaması için not=indigo, öğr.notu=teal) */
const AGENDA_PANEL = {
  calendar: {
    card: cn('border-blue-200/45 dark:border-blue-900/40', PANEL_CARD_SHELL),
    head: 'border-b border-blue-200/40 bg-blue-500/6 px-3 py-3 dark:border-blue-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-blue-500/15 ring-1 ring-blue-500/20',
    iconClass: 'text-blue-700 dark:text-blue-400',
  },
  notes: {
    card: cn('border-indigo-200/50 dark:border-indigo-900/45', PANEL_CARD_SHELL),
    head: 'border-b border-indigo-200/45 bg-indigo-500/6 px-3 py-3 dark:border-indigo-900/45 sm:px-6 sm:py-4',
    iconWrap: 'bg-indigo-500/15 ring-1 ring-indigo-500/20',
    iconClass: 'text-indigo-800 dark:text-indigo-300',
    rowHover: 'hover:border-indigo-400/35 hover:shadow-md hover:ring-1 hover:ring-indigo-500/15',
    accentBar: 'border-l-indigo-500',
  },
  tasks: {
    card: cn('border-emerald-200/45 dark:border-emerald-900/40', PANEL_CARD_SHELL),
    head: 'border-b border-emerald-200/40 bg-emerald-500/6 px-3 py-3 dark:border-emerald-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/20',
    iconClass: 'text-emerald-800 dark:text-emerald-300',
    rowHover: 'hover:border-emerald-400/40 hover:shadow-md hover:ring-1 hover:ring-emerald-500/15',
    filterActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 dark:bg-emerald-600',
    filterIdle: 'bg-muted/50 hover:bg-muted ring-1 ring-border/40',
  },
  student_notes: {
    card: cn('border-teal-200/50 dark:border-teal-900/45', PANEL_CARD_SHELL),
    head: 'border-b border-teal-200/45 bg-teal-500/6 px-3 py-3 dark:border-teal-900/45 sm:px-6 sm:py-4',
    iconWrap: 'bg-teal-500/15 ring-1 ring-teal-500/20',
    iconClass: 'text-teal-800 dark:text-teal-300',
    rowHover: 'hover:border-teal-400/40 hover:shadow-md hover:ring-1 hover:ring-teal-500/15',
  },
  parent_meetings: {
    card: cn('border-rose-200/45 dark:border-rose-900/40', PANEL_CARD_SHELL),
    head: 'border-b border-rose-200/40 bg-rose-500/6 px-3 py-3 dark:border-rose-900/40 sm:px-6 sm:py-4',
    iconWrap: 'bg-rose-500/15 ring-1 ring-rose-500/20',
    iconClass: 'text-rose-800 dark:text-rose-300',
    rowHover: 'hover:border-rose-400/40 hover:shadow-md hover:ring-1 hover:ring-rose-500/15',
  },
} as const;

function AgendaSkeleton() {
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 animate-in fade-in duration-300">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

function OgretmenAjandasiPageContent() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<{ items: AgendaNote[]; total: number }>({ items: [], total: 0 });
  const [tasks, setTasks] = useState<{ items: AgendaTask[]; total: number }>({ items: [], total: 0 });
  const [studentNotes, setStudentNotes] = useState<{ items: unknown[]; total: number }>({ items: [], total: 0 });
  const [parentMeetings, setParentMeetings] = useState<{ items: unknown[]; total: number }>({ items: [], total: 0 });
  const [summary, setSummary] = useState<{ pendingTasks: number; overdueTasks: number; todayEventCount: number } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedNote, setSelectedNote] = useState<AgendaNote | null>(null);
  const [noteFromTemplate, setNoteFromTemplate] = useState<{ title: string; body?: string; tags?: string } | null>(null);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteDetailOpen, setNoteDetailOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState<string | undefined>();
  const [studentNoteModalOpen, setStudentNoteModalOpen] = useState(false);
  const [parentMeetingModalOpen, setParentMeetingModalOpen] = useState(false);
  const [schoolEventModalOpen, setSchoolEventModalOpen] = useState(false);
  const [editingSchoolEventId, setEditingSchoolEventId] = useState<string | null>(null);
  const [editingSchoolEventData, setEditingSchoolEventData] = useState<{
    id: string;
    title: string;
    description?: string | null;
    eventAt: string;
    eventType?: string | null;
    important?: boolean;
    assignments?: { userId: string }[];
  } | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; title: string; bodyTemplate?: string | null }[]>([]);
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [taskViewFilter, setTaskViewFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [noteSearch, setNoteSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [mobileTab, setMobileTab] = useState<ViewTab>('calendar');
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ notes: AgendaNote[]; tasks: AgendaTask[]; studentNotes: unknown[]; parentMeetings: unknown[] } | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [weeklyStats, setWeeklyStats] = useState<{ total: number; completed: number; completionRate: number } | null>(null);
  const [taskSortBy, setTaskSortBy] = useState<'date' | 'priority'>('date');
  const [studentNoteDetailId, setStudentNoteDetailId] = useState<string | null>(null);
  const [studentNoteDetail, setStudentNoteDetail] = useState<StudentNoteDetail | null>(null);
  const [studentNoteDetailLoading, setStudentNoteDetailLoading] = useState(false);

  const getCalendarRange = useCallback(() => {
    if (calendarViewMode === 'day') {
      const d = new Date(month);
      const ymd = toYMD(d);
      return { start: ymd, end: ymd };
    }
    if (calendarViewMode === 'week') {
      const d = new Date(month);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return { start: toYMD(weekStart), end: toYMD(weekEnd) };
    }
    return toStartEnd(month);
  }, [month, calendarViewMode]);

  const fetchCalendar = useCallback(async () => {
    if (!token) return;
    const { start, end } = getCalendarRange();
    try {
      const res = await apiFetch<{ events: CalendarEvent[] }>(
        `/teacher-agenda/calendar?start=${start}&end=${end}`,
        { token },
      );
      setEvents(res.events ?? []);
    } catch {
      setEvents([]);
    }
  }, [token, getCalendarRange]);

  const fetchNotes = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (noteSearch) params.set('search', noteSearch);
      if (includeArchived) params.set('includeArchived', 'true');
      const res = await apiFetch<{ items: AgendaNote[]; total: number }>(
        `/teacher-agenda/notes?${params}`,
        { token },
      );
      setNotes({ items: res.items ?? [], total: res.total ?? 0 });
    } catch {
      setNotes({ items: [], total: 0 });
    }
  }, [token, noteSearch, includeArchived]);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ limit: '20', status: filterStatus });
      if (taskSearch) params.set('search', taskSearch);
      if (filterPriority) params.set('priority', filterPriority);
      const today = toYMD(new Date());
      if (taskViewFilter === 'today') {
        params.set('dueDateFrom', today);
        params.set('dueDateTo', today);
      } else if (taskViewFilter === 'week') {
        const d = new Date();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        params.set('dueDateFrom', toYMD(weekStart));
        params.set('dueDateTo', toYMD(weekEnd));
      } else if (taskViewFilter === 'overdue') {
        params.set('status', 'overdue');
      }
      const res = await apiFetch<{ items: AgendaTask[]; total: number }>(
        `/teacher-agenda/tasks?${params}`,
        { token },
      );
      setTasks({ items: res.items ?? [], total: res.total ?? 0 });
    } catch {
      setTasks({ items: [], total: 0 });
    }
  }, [token, filterStatus, taskSearch, filterPriority, taskViewFilter]);

  const fetchStudentNotes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ items: unknown[]; total: number }>(
        '/teacher-agenda/student-notes?limit=20',
        { token },
      );
      setStudentNotes({ items: res.items ?? [], total: res.total ?? 0 });
    } catch {
      setStudentNotes({ items: [], total: 0 });
    }
  }, [token]);

  const fetchParentMeetings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ items: unknown[]; total: number }>(
        '/teacher-agenda/parent-meetings?limit=20',
        { token },
      );
      setParentMeetings({ items: res.items ?? [], total: res.total ?? 0 });
    } catch {
      setParentMeetings({ items: [], total: 0 });
    }
  }, [token]);

  const fetchStudents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<Student[]>('/teacher-agenda/students', { token });
      setStudents(Array.isArray(res) ? res : []);
    } catch {
      setStudents([]);
    }
  }, [token]);

  const fetchSubjectsClasses = useCallback(async () => {
    if (!token) return;
    try {
      const [subjRes, classRes] = await Promise.all([
        apiFetch<{ id: string; label?: string; name?: string }[]>('/classes-subjects/subjects', { token }),
        apiFetch<{ id: string; label?: string; name?: string }[]>('/classes-subjects/classes', { token }),
      ]);
      setSubjects((Array.isArray(subjRes) ? subjRes : []).map((s) => ({ id: s.id, label: s.label ?? s.name ?? s.id })));
      setClasses((Array.isArray(classRes) ? classRes : []).map((c) => ({ id: c.id, label: c.label ?? c.name ?? c.id })));
    } catch {
      setSubjects([]);
      setClasses([]);
    }
  }, [token]);

  const fetchTemplates = useCallback(async () => {
    if (!token || me?.role === 'school_admin') return;
    try {
      const res = await apiFetch<{ id: string; title: string; bodyTemplate?: string | null }[]>(
        '/teacher-agenda/templates',
        { token },
      );
      setTemplates(Array.isArray(res) ? res : []);
    } catch {
      setTemplates([]);
    }
  }, [token, me?.role]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ pendingTasks: number; overdueTasks: number; todayEventCount: number }>(
        '/teacher-agenda/summary',
        { token },
      );
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }, [token]);

  const fetchWeeklyStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ total: number; completed: number; completionRate: number }>('/teacher-agenda/stats/weekly', { token });
      setWeeklyStats(res);
    } catch {
      setWeeklyStats(null);
    }
  }, [token]);

  const refresh = useCallback(() => {
    fetchCalendar();
    fetchNotes();
    fetchTasks();
    fetchStudentNotes();
    fetchParentMeetings();
    fetchSummary();
    fetchTemplates();
    fetchWeeklyStats();
  }, [fetchCalendar, fetchNotes, fetchTasks, fetchStudentNotes, fetchParentMeetings, fetchSummary, fetchTemplates, fetchWeeklyStats]);

  const openTaskEdit = useCallback(
    async (t: AgendaTask) => {
      if (!token) {
        setEditingTask(t);
        setTaskModalOpen(true);
        return;
      }
      try {
        const full = await apiFetch<AgendaTask>(`/teacher-agenda/tasks/${t.id}`, { token });
        setEditingTask(full);
        setTaskModalOpen(true);
      } catch {
        setEditingTask(t);
        setTaskModalOpen(true);
      }
    },
    [token],
  );

  useEffect(() => {
    const announcementId = searchParams.get('announcementId');
    const fromTv = searchParams.get('fromTv') === '1';
    if (!token || !me || !announcementId || !fromTv) return;
    if (me.role !== 'teacher' && me.role !== 'school_admin') return;

    const key = `tv_agenda_${announcementId}`;
    const last = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
    const now = Date.now();
    if (last && now - parseInt(last, 10) < 2500) return;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, String(now));

    router.replace('/ogretmen-ajandasi', { scroll: false });

    let cancelled = false;
    (async () => {
      try {
        if (me.role === 'teacher') setMobileTab('notes');
        const listRes = await apiFetch<{ items: AgendaNote[] }>(
          `/teacher-agenda/notes?announcementId=${encodeURIComponent(announcementId)}&limit=5`,
          { token },
        );
        if (cancelled) return;
        if (listRes.items?.length) {
          const n = listRes.items[0];
          const full = await apiFetch<AgendaNote>(`/teacher-agenda/notes/${n.id}`, { token });
          if (cancelled) return;
          setSelectedNote(full);
          setNoteDetailOpen(true);
          toast.info('Duyuru ajandada kayıtlı; düzenleyebilir veya silebilirsiniz.');
        } else {
          const ann = await apiFetch<{ title: string; summary?: string | null; body?: string | null }>(
            `/announcements/${announcementId}`,
            { token },
          );
          if (cancelled) return;
          setNoteFromTemplate({
            title: ann.title,
            body: (ann.summary || ann.body) ?? undefined,
            tags: `duyuru, duyuru_ann:${announcementId}`,
          });
          setNoteModalOpen(true);
          toast.info('İçeriği düzenleyip Kaydet ile ajandaya ekleyin.');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ajanda açılamadı');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, me, searchParams, router]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCalendar(),
      fetchNotes(),
      fetchTasks(),
      fetchStudents(),
      fetchSubjectsClasses(),
      fetchSummary(),
      ...(me?.role === 'school_admin' ? [] : [fetchTemplates()]),
      fetchWeeklyStats(),
    ])
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setLoading(false);
      });
  }, [token, me?.role, fetchCalendar, fetchNotes, fetchTasks, fetchStudents, fetchSubjectsClasses, fetchSummary, fetchTemplates, fetchWeeklyStats]);

  useEffect(() => {
    if (token && (mobileTab === 'student_notes' || mobileTab === 'parent_meetings')) {
      fetchStudentNotes();
      fetchParentMeetings();
    }
  }, [token, mobileTab, fetchStudentNotes, fetchParentMeetings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'n' || e.key === 'N') { setNoteFromTemplate(null); setNoteModalOpen(true); e.preventDefault(); }
      if (e.key === 'g' || e.key === 'G') { setTaskModalDate(undefined); setTaskModalOpen(true); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!studentNoteDetailId || !token) {
      setStudentNoteDetail(null);
      return;
    }
    setStudentNoteDetailLoading(true);
    apiFetch<StudentNoteDetail>(`/teacher-agenda/student-notes/${studentNoteDetailId}`, { token })
      .then(setStudentNoteDetail)
      .catch(() => setStudentNoteDetail(null))
      .finally(() => setStudentNoteDetailLoading(false));
  }, [studentNoteDetailId, token]);

  const handleEventClick = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setEventModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setTaskModalDate(toYMD(date));
    setTaskModalOpen(true);
  };

  const handleNoteClick = async (note: AgendaNote) => {
    if (!token) return;
    try {
      const full = await apiFetch<AgendaNote>(`/teacher-agenda/notes/${note.id}`, { token });
      setSelectedNote(full);
    } catch {
      setSelectedNote(note);
    }
    setNoteDetailOpen(true);
  };

  const uploadFileForNote = async (file: File): Promise<{ publicUrl: string; fileType?: string; fileName?: string }> => {
    if (!token) throw new Error('Oturum gerekli');
    const { uploadUrl, publicUrl } = await apiFetch<{ uploadUrl: string; publicUrl: string; key: string }>('/upload/presign', {
      method: 'POST',
      token,
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        purpose: 'agenda_note',
      }),
    });
    const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    if (!res.ok) throw new Error('Yükleme başarısız');
    return { publicUrl, fileType: file.type, fileName: file.name };
  };

  const handleCreateNote = async (data: {
    title: string;
    body?: string;
    tags?: string;
    subjectId?: string;
    classId?: string;
    color?: string;
    pinned?: boolean;
    remindAt?: string;
    attachments?: { url: string; fileType?: string; fileName?: string }[];
  }) => {
    if (!token) return;
    const note = await apiFetch<{ id: string }>('/teacher-agenda/notes', {
      method: 'POST',
      token,
      body: JSON.stringify({
        title: data.title,
        body: data.body || undefined,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        subjectId: data.subjectId || undefined,
        classId: data.classId || undefined,
        color: data.color || undefined,
        pinned: data.pinned,
      }),
    });
    if (data.remindAt && note?.id) {
      await apiFetch('/teacher-agenda/reminders', {
        method: 'POST',
        token,
        body: JSON.stringify({ noteId: note.id, remindAt: data.remindAt }),
      });
    }
    if (note?.id && data.attachments?.length) {
      for (const att of data.attachments) {
        await apiFetch(`/teacher-agenda/notes/${note.id}/attachments`, {
          method: 'POST',
          token,
          body: JSON.stringify({ fileUrl: att.url, fileType: att.fileType, fileName: att.fileName }),
        });
      }
    }
    toast.success('Not eklendi');
    refresh();
  };

  const handleUpdateNote = async (
    id: string,
    data: { title: string; body?: string; tags?: string[] }
  ) => {
    if (!token) return;
    await apiFetch(`/teacher-agenda/notes/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    });
    toast.success('Not güncellendi');
    refresh();
    setSelectedNote((n) => (n?.id === id ? { ...n, ...data } : n));
  };

  const handleArchiveNote = async (id: string) => {
    if (!token) return;
    await apiFetch(`/teacher-agenda/notes/${id}/archive`, { method: 'POST', token });
    toast.success('Not arşivlendi');
    refresh();
  };

  const handleDeleteNote = async (id: string) => {
    if (!token) return;
    await apiFetch(`/teacher-agenda/notes/${id}`, { method: 'DELETE', token });
    toast.success('Not silindi');
    refresh();
  };

  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    priority: string;
    repeat?: string;
    studentId?: string;
    remindAt?: string;
  }) => {
    if (!token) return;
    await apiFetch<{ id: string }>('/teacher-agenda/tasks', {
      method: 'POST',
      token,
      body: JSON.stringify({
        title: data.title,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        dueTime: data.dueTime || undefined,
        priority: data.priority,
        repeat: data.repeat || 'none',
        studentId: data.studentId || undefined,
        ...(data.remindAt?.trim() ? { remindAt: data.remindAt.trim() } : {}),
      }),
    });
    toast.success('Görev eklendi');
    refresh();
  };

  const handleUpdateTask = async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      dueDate: string;
      dueTime: string;
      priority: string;
      repeat: string;
      studentId?: string;
      remindAt: string;
    }>,
  ) => {
    if (!token) return;
    await apiFetch(`/teacher-agenda/tasks/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        title: data.title,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        dueTime: data.dueTime || undefined,
        priority: data.priority,
        repeat: data.repeat || 'none',
        studentId: data.studentId || undefined,
        remindAt: data.remindAt ?? '',
      }),
    });
    toast.success('Görev güncellendi');
    refresh();
    setEditingTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    if (!token || !confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    await apiFetch(`/teacher-agenda/tasks/${id}`, { method: 'DELETE', token });
    toast.success('Görev silindi');
    refresh();
  };

  const handleTaskDateChange = async (taskId: string, newDate: string) => {
    if (!token) return;
    try {
      await apiFetch(`/teacher-agenda/tasks/${taskId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ dueDate: newDate }),
      });
      toast.success('Tarih güncellendi');
      refresh();
    } catch {
      toast.error('Güncellenemedi');
    }
  };

  const handlePrint = () => {
    const schoolName = me?.school?.name ?? 'Okul';
    const teacherName = me?.display_name || me?.email?.split('@')[0] || 'Öğretmen';
    const printDate = format(new Date(), "d MMMM yyyy 'tarihinde'", { locale: tr });
    const notesHtml = displayNotes.map((n) => `<tr><td>${escapeHtml((n as AgendaNote).title)}</td><td>${escapeHtml((n as AgendaNote).body?.slice(0, 120) ?? '')}</td></tr>`).join('');
    const tasksHtml = displayTasks.map((t) => `<tr><td>${escapeHtml(t.title)}</td><td>${t.dueDate ?? '-'}</td><td>${t.status === 'completed' ? 'Tamamlandı' : t.status === 'pending' ? 'Bekliyor' : t.status}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Öğretmen Ajandası - ${escapeHtml(schoolName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;line-height:1.4;color:#222;padding:0 24px 48px}
.print-header{border-bottom:2px solid #333;padding:16px 0;margin-bottom:20px;text-align:center}
.print-header h1{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.print-header .school{font-size:14px;font-weight:600;margin-bottom:4px}
.print-header .meta{font-size:11px;color:#555;margin-top:8px}
.print-footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#666;text-align:center}
section{margin-bottom:24px;page-break-inside:avoid}
section h2{font-size:13px;font-weight:600;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #ccc}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #333;padding:8px 10px;text-align:left}
th{background:#f0f0f0;font-weight:600;font-size:11px}
@media print{body{padding:0 16px 24px}.print-header,.print-footer{position:relative}@page{margin:18mm}}
</style></head><body>
<div class="print-header">
  <div class="school">${escapeHtml(schoolName)}</div>
  <h1>Öğretmen Ajandası</h1>
  <div class="meta">${escapeHtml(teacherName)} · ${printDate}</div>
</div>
<section><h2>Notlar</h2><table><thead><tr><th>Başlık</th><th>İçerik</th></tr></thead><tbody>${notesHtml || '<tr><td colspan="2">Kayıt yok</td></tr>'}</tbody></table></section>
<section><h2>Görevler</h2><table><thead><tr><th>Başlık</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>${tasksHtml || '<tr><td colspan="3">Kayıt yok</td></tr>'}</tbody></table></section>
<div class="print-footer">${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr })} · Öğretmen Ajandası - ${escapeHtml(schoolName)}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Pop-up engellendi'); return; }
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    if (!token) return;
    setTogglingTaskId(taskId);
    const prevStatus = tasks.items.find((t) => t.id === taskId)?.status;
    setTasks((prev) => ({
      ...prev,
      items: prev.items.map((t) => (t.id === taskId ? { ...t, status } : t)),
    }));
    try {
      await apiFetch(`/teacher-agenda/tasks/${taskId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      refresh();
    } catch {
      setTasks((prev) => ({
        ...prev,
        items: prev.items.map((t) =>
          t.id === taskId ? { ...t, status: prevStatus ?? 'pending' } : t
        ),
      }));
      toast.error('Güncellenemedi');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleCreateStudentNote = async (data: {
    studentId: string;
    noteType: string;
    description?: string;
    subjectId?: string;
    noteDate: string;
    tags?: string[];
  }) => {
    if (!token) return;
    await apiFetch('/teacher-agenda/student-notes', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
    toast.success('Öğrenci notu eklendi');
    refresh();
  };

  const handleCreateParentMeeting = async (data: {
    studentId: string;
    meetingDate: string;
    meetingType?: string;
    subject?: string;
    description?: string;
    followUpDate?: string;
  }) => {
    if (!token) return;
    await apiFetch('/teacher-agenda/parent-meetings', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
    toast.success('Veli toplantısı eklendi');
    refresh();
  };

  const handleExport = async (type: 'notes' | 'tasks') => {
    if (!token) return;
    try {
      const url = getApiUrl(`/teacher-agenda/export/${type}`);
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ajanda-${type}-${toYMD(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(type === 'notes' ? 'Notlar indirildi' : 'Görevler indirildi');
    } catch {
      toast.error('İndirme başarısız');
    }
  };

  const handleIcalDownload = async () => {
    if (!token) return;
    try {
      const start = new Date();
      const end = new Date(Date.now() + 365 * 86400000);
      const url = getApiUrl(`/teacher-agenda/calendar/ical?start=${toYMD(start)}&end=${toYMD(end)}`);
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ajanda-${toYMD(new Date())}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Takvim indirildi (.ics)');
    } catch {
      toast.error('Takvim indirilemedi');
    }
  };

  const handleSearch = useCallback(async () => {
    if (!token || globalSearch.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await apiFetch<{ notes: AgendaNote[]; tasks: AgendaTask[]; studentNotes: unknown[]; parentMeetings: unknown[] }>(
        `/teacher-agenda/search?q=${encodeURIComponent(globalSearch.trim())}&limit=10`,
        { token },
      );
      setSearchResults(res);
    } catch {
      setSearchResults(null);
    }
  }, [token, globalSearch]);

  useEffect(() => {
    const t = setTimeout(() => { if (globalSearch.trim().length >= 2) handleSearch(); else setSearchResults(null); }, 300);
    return () => clearTimeout(t);
  }, [globalSearch, handleSearch]);

  const handleBulkArchiveNotes = async () => {
    if (!token || selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    await apiFetch('/teacher-agenda/notes/bulk-archive', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} not arşivlendi`);
    setSelectedNoteIds(new Set());
    refresh();
  };

  const handleBulkDeleteNotes = async () => {
    if (!token || selectedNoteIds.size === 0 || !confirm('Seçili notları silmek istediğinize emin misiniz?')) return;
    const ids = Array.from(selectedNoteIds);
    await apiFetch('/teacher-agenda/notes/bulk-delete', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} not silindi`);
    setSelectedNoteIds(new Set());
    refresh();
  };

  const handleBulkDeleteTasks = async () => {
    if (!token || selectedTaskIds.size === 0 || !confirm('Seçili görevleri silmek istediğinize emin misiniz?')) return;
    const ids = Array.from(selectedTaskIds);
    await apiFetch('/teacher-agenda/tasks/bulk-delete', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} görev silindi`);
    setSelectedTaskIds(new Set());
    refresh();
  };

  const handleBulkCompleteTasks = async () => {
    if (!token || selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    await apiFetch('/teacher-agenda/tasks/bulk-status', { method: 'POST', token, body: JSON.stringify({ ids, status: 'completed' }) });
    toast.success(`${ids.length} görev tamamlandı`);
    setSelectedTaskIds(new Set());
    refresh();
  };

  const handleCreateSchoolEvent = async (data: {
    title: string;
    description?: string;
    eventAt: string;
    eventType?: string;
    targetTeacherIds?: string[];
    important?: boolean;
    id?: string;
  }) => {
    if (!token) return;
    if (data.id) {
      await apiFetch(`/teacher-agenda/school-events/${data.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          eventAt: data.eventAt,
          eventType: data.eventType,
          targetTeacherIds: data.targetTeacherIds,
          important: data.important,
        }),
      });
      toast.success('Okul etkinliği güncellendi');
    } else {
      await apiFetch('/teacher-agenda/school-events', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
      toast.success('Okul etkinliği eklendi');
    }
    setEditingSchoolEventId(null);
    setEditingSchoolEventData(null);
    refresh();
  };

  const handleEditSchoolEvent = async (eventId: string) => {
    if (!token) return;
    try {
      const ev = await apiFetch<{
        id: string;
        title: string;
        description?: string | null;
        eventAt: string;
        eventType?: string | null;
        important?: boolean;
        assignments?: { userId: string }[];
      }>(`/teacher-agenda/school-events/${eventId}`, { token });
      setEditingSchoolEventData({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        eventAt: typeof ev.eventAt === 'string' ? ev.eventAt : new Date(ev.eventAt).toISOString(),
        eventType: ev.eventType,
        important: ev.important,
        assignments: ev.assignments?.map((a) => ({ userId: a.userId ?? (a as { user_id?: string }).user_id ?? '' })).filter((a) => a.userId),
      });
      setEditingSchoolEventId(eventId);
      setSchoolEventModalOpen(true);
    } catch {
      toast.error('Etkinlik yüklenemedi');
    }
  };

  const handleDeleteSchoolEvent = async (eventId: string) => {
    if (!token) return;
    await apiFetch(`/teacher-agenda/school-events/${eventId}`, {
      method: 'DELETE',
      token,
    });
    toast.success('Etkinlik silindi');
    refresh();
  };

  const prevMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1));
  const nextMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1));
  const goToday = () => setMonth(new Date());
  const monthLabel = month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const displayNotes = notes.items;
  const displayTasks = [...tasks.items].sort((a, b) => {
    if (taskSortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
    }
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  });
  const displayEvents = events;
  const displayStudentNotes = studentNotes.items;
  const displayParentMeetings = parentMeetings.items;

  const filteredEvents =
    filterSource && filterSource !== 'all'
      ? displayEvents.filter((e: CalendarEvent) => e.source === filterSource)
      : displayEvents;

  const isOverdue = (t: AgendaTask) =>
    t.status === 'pending' && t.dueDate && t.dueDate < toYMD(new Date());

  const openAddMenu = () => {
    if (mobileTab === 'notes') setNoteModalOpen(true);
    else if (mobileTab === 'tasks') {
      setTaskModalDate(undefined);
      setTaskModalOpen(true);
    } else if (mobileTab === 'student_notes') setStudentNoteModalOpen(true);
    else if (mobileTab === 'parent_meetings') setParentMeetingModalOpen(true);
    else {
      setTaskModalDate(toYMD(new Date()));
      setTaskModalOpen(true);
    }
  };

  const isSchoolAdmin = me?.role === 'school_admin';

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) {
    return <ForbiddenView />;
  }

  const isTeacher = me.role === 'teacher';
  type TabDef = {
    id: ViewTab;
    label: string;
    shortLabel: string;
    icon: typeof Calendar;
    count?: number;
    base: string;
    active: string;
  };
  const tabs: TabDef[] = isTeacher
    ? [
        {
          id: 'calendar',
          label: 'Takvim',
          shortLabel: 'Takvim',
          icon: Calendar,
          base: 'border-blue-500/35 bg-blue-500/12 text-blue-800 dark:text-blue-200',
          active: 'ring-2 ring-blue-500/35 shadow-sm',
        },
        {
          id: 'notes',
          label: 'Notlar',
          shortLabel: 'Not',
          icon: StickyNote,
          count: notes.total,
          base: 'border-indigo-500/35 bg-indigo-500/12 text-indigo-950 dark:text-indigo-100',
          active: 'ring-2 ring-indigo-500/35 shadow-sm',
        },
        {
          id: 'tasks',
          label: 'Görevler',
          shortLabel: 'Görev',
          icon: ListTodo,
          count: tasks.total,
          base: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100',
          active: 'ring-2 ring-emerald-500/35 shadow-sm',
        },
        {
          id: 'student_notes',
          label: 'Öğrenci notları',
          shortLabel: 'Öğr.',
          icon: Users,
          count: studentNotes.total,
          base: 'border-teal-500/35 bg-teal-500/12 text-teal-950 dark:text-teal-100',
          active: 'ring-2 ring-teal-500/35 shadow-sm',
        },
        {
          id: 'parent_meetings',
          label: 'Veli toplantıları',
          shortLabel: 'Veli',
          icon: UserPlus,
          count: parentMeetings.total,
          base: 'border-rose-500/35 bg-rose-500/12 text-rose-900 dark:text-rose-100',
          active: 'ring-2 ring-rose-500/35 shadow-sm',
        },
      ]
    : [
        {
          id: 'calendar',
          label: 'Okul takvimi',
          shortLabel: 'Takvim',
          icon: Calendar,
          base: 'border-blue-500/35 bg-blue-500/12 text-blue-800 dark:text-blue-200',
          active: 'ring-2 ring-blue-500/35 shadow-sm',
        },
      ];

  return (
    <div className="min-w-0 space-y-2 pb-24 sm:space-y-5 sm:pb-0">
      {error && <Alert message={error} className="mb-4" />}
      {isSchoolAdmin && <AgendaHeroSchool />}
      {isTeacher && (
        <AgendaHeroTeacher
          summary={summary}
          weeklyStats={weeklyStats}
          onPendingTasks={() => {
            setMobileTab('tasks');
            setFilterStatus('pending');
            setTaskViewFilter('all');
          }}
          onOverdueTasks={() => {
            setMobileTab('tasks');
            setFilterStatus('overdue');
            setTaskViewFilter('overdue');
          }}
          onTodayEvents={() => {
            setMobileTab('calendar');
            setMonth(new Date());
            setCalendarViewMode('day');
          }}
        />
      )}
      {isTeacher && (
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:size-4" />
        <input
          type="text"
          placeholder="Ajandada ara… (2+ harf)"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2.5 text-sm sm:rounded-xl sm:py-2.5 sm:pl-10 sm:pr-4"
        />
        {searchResults && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border bg-card shadow-lg z-50 max-h-[320px] overflow-y-auto">
            {searchResults.notes.length === 0 && searchResults.tasks.length === 0 && searchResults.studentNotes.length === 0 && searchResults.parentMeetings.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sonuç bulunamadı</p>
            ) : (
              <div className="p-2 space-y-1">
                {searchResults.notes.map((n) => (
                  <button key={n.id} type="button" onClick={() => { handleNoteClick(n); setSearchResults(null); setGlobalSearch(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center gap-2">
                    <StickyNote className="size-4 shrink-0" /> {n.title}
                  </button>
                ))}
                {searchResults.tasks.map((t) => (
                  <button key={t.id} type="button" onClick={() => { void openTaskEdit(t); setSearchResults(null); setGlobalSearch(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center gap-2">
                    <ListTodo className="size-4 shrink-0" /> {t.title}
                  </button>
                ))}
                {(searchResults.studentNotes as { id: string; student?: { name: string }; noteType: string }[]).map((sn) => (
                  <button key={sn.id} type="button" onClick={() => { setStudentNoteDetailId(sn.id); setMobileTab('student_notes'); setSearchResults(null); setGlobalSearch(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center gap-2">
                    <Users className="size-4 shrink-0" /> {sn.student?.name ?? 'Öğrenci'} – {sn.noteType}
                  </button>
                ))}
                {(searchResults.parentMeetings as { id: string; student?: { name: string }; subject?: string }[]).map((pm) => (
                  <div key={pm.id} className="px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <UserPlus className="size-4 shrink-0" /> {pm.student?.name ?? 'Öğrenci'} – {pm.subject ?? 'Toplantı'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <div
        className={cn(
          'akilli-tahta-tabnav -mx-0.5 px-0.5 pb-0.5 sm:mx-0 sm:px-0',
          'max-sm:overflow-x-visible',
          'sm:snap-x sm:snap-mandatory sm:overflow-x-auto sm:pb-0.5 sm:[-webkit-overflow-scrolling:touch] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden',
        )}
      >
        <div
          role="tablist"
          aria-label="Ajanda görünümü"
          className={cn(
            'w-full gap-1 rounded-xl border-2 border-border/90 bg-linear-to-b from-muted/70 to-muted/45 p-1 shadow-md dark:border-border dark:from-muted/50 dark:to-muted/30',
            'max-sm:grid max-sm:gap-1',
            isTeacher ? 'max-sm:grid-cols-5' : 'max-sm:grid-cols-1',
            'sm:flex sm:w-max sm:flex-wrap sm:justify-start sm:gap-1.5 sm:rounded-2xl sm:border sm:border-border/70 sm:bg-muted/40 sm:p-1.5 sm:shadow-sm',
          )}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            const c = tab.count !== undefined ? (tab.count > 99 ? '99+' : String(tab.count)) : null;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.label}
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  'flex items-center justify-center font-semibold transition-all',
                  'max-sm:flex max-sm:flex-col max-sm:gap-0.5 max-sm:rounded-lg max-sm:border max-sm:px-0.5 max-sm:py-1.5 max-sm:text-[9px] max-sm:leading-tight',
                  'sm:snap-start sm:shrink-0 sm:flex-row sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs sm:min-h-[44px] md:text-sm',
                  active
                    ? cn('z-1 border', tab.base, tab.active, 'max-sm:shadow-sm max-sm:ring-2 max-sm:ring-offset-1 max-sm:ring-offset-background')
                    : cn(
                        'border-border/50 bg-background/85 text-muted-foreground hover:bg-background hover:text-foreground dark:bg-background/50',
                        'max-sm:border max-sm:bg-muted/50',
                        'sm:border-transparent sm:bg-muted/30 sm:hover:bg-background/90',
                      ),
                )}
              >
                <Icon className={cn('size-3.5 shrink-0 sm:size-4', active && 'sm:size-[1.15rem]')} aria-hidden />
                <span className="hidden items-center sm:inline-flex">
                  {tab.label}
                  {c !== null && <span className="ml-1 tabular-nums opacity-80">({c})</span>}
                </span>
                <span className="flex flex-col items-center gap-0 text-center sm:hidden">
                  <span className="max-w-full truncate font-bold leading-none">{tab.shortLabel}</span>
                  {c !== null && <span className="tabular-nums text-[8px] font-semibold leading-none opacity-90">{c}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pb-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:overflow-visible sm:pb-0">
        {isTeacher && (
          <div
            role="group"
            aria-label="Takvim kaynağı"
            className="grid w-full min-w-0 grid-cols-4 gap-1 sm:max-w-2xl"
          >
            <button
              type="button"
              onClick={() => setFilterSource('')}
              className={cn(
                'min-h-9 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold leading-tight transition-all sm:min-h-10 sm:px-2 sm:text-xs',
                filterSource === ''
                  ? 'border border-slate-700 bg-slate-800 text-white shadow-md dark:border-slate-600 dark:bg-slate-200 dark:text-slate-900'
                  : 'border border-border/60 bg-muted/45 text-muted-foreground hover:bg-muted',
              )}
            >
              Tümü
            </button>
            {AGENDA_SOURCE_KEYS.map((key) => {
              const st = AGENDA_SOURCE_THEME[key];
              const on = filterSource === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterSource(key)}
                  className={cn(
                    'min-h-9 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold transition-all sm:min-h-10 sm:px-2 sm:text-xs',
                    on ? st.filterActive : st.filterIdle,
                  )}
                >
                  <span className="sm:hidden">{st.shortLabel}</span>
                  <span className="hidden sm:inline">{st.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {isSchoolAdmin && (
          <Button size="sm" onClick={() => setSchoolEventModalOpen(true)} className="rounded-xl" title="Tüm okul için takvimde görünecek etkinlik ekleyin (toplantı, tören vb.)">
            <Plus className="size-4 mr-1" />
            Okul Etkinliği
          </Button>
        )}
        {isTeacher && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMobileTab('student_notes');
                setStudentNoteModalOpen(true);
              }}
              className="h-8 shrink-0 rounded-lg px-2 sm:h-9 sm:rounded-xl sm:px-3"
              title="Öğrenci hakkında +/− not veya gözlem ekleyin"
            >
              <Users className="size-3.5 sm:mr-1 sm:size-4" />
              <span className="max-sm:sr-only sm:inline">Öğrenci Notu</span>
            </Button>
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="sm" onClick={handleIcalDownload} className="h-8 rounded-lg px-2 sm:h-9 sm:rounded-xl sm:px-3" title="Takvimi .ics formatında indir">
                <Calendar className="size-3.5 sm:mr-1 sm:size-4" />
                <span className="max-sm:sr-only sm:inline">iCal</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('notes')} className="h-8 rounded-lg px-2 sm:h-9 sm:rounded-xl sm:px-3" title="Notları CSV olarak indir">
                <Download className="size-3.5 sm:mr-1 sm:size-4" />
                <span className="max-sm:sr-only sm:inline">Notlar CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('tasks')} className="h-8 rounded-lg px-2 sm:h-9 sm:rounded-xl sm:px-3" title="Görevleri CSV olarak indir">
                <Download className="size-3.5 sm:mr-1 sm:size-4" />
                <span className="max-sm:sr-only sm:inline">Görevler CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 rounded-lg px-2 sm:h-9 sm:rounded-xl sm:px-3" title="Yazdır">
                <Printer className="size-3.5 sm:mr-1 sm:size-4" />
                <span className="max-sm:sr-only sm:inline">Yazdır</span>
              </Button>
            </div>
          </>
        )}
        {isSchoolAdmin && (
          <Button variant="outline" size="sm" onClick={handleIcalDownload} className="rounded-xl" title="Okul takvimini .ics formatında indir">
            <Calendar className="size-4 mr-1" />
            iCal
          </Button>
        )}
      </div>

      {isTeacher && selectedNoteIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 border border-primary/20">
          <span className="text-sm font-medium">{selectedNoteIds.size} not seçili</span>
          <Button size="sm" variant="outline" onClick={handleBulkArchiveNotes} className="rounded-lg">Arşivle</Button>
          <Button size="sm" variant="outline" onClick={handleBulkDeleteNotes} className="rounded-lg text-destructive">Sil</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedNoteIds(new Set())}>İptal</Button>
        </div>
      )}

      {isTeacher && selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 border border-primary/20">
          <span className="text-sm font-medium">{selectedTaskIds.size} görev seçili</span>
          <Button size="sm" variant="outline" onClick={handleBulkCompleteTasks} className="rounded-lg">Tamamla</Button>
          <Button size="sm" variant="outline" onClick={handleBulkDeleteTasks} className="rounded-lg text-destructive">Sil</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedTaskIds(new Set())}>İptal</Button>
        </div>
      )}

      {loading ? (
        <AgendaSkeleton />
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div
            className={cn(
              'lg:col-span-2 min-w-0',
              mobileTab !== 'calendar' && 'hidden sm:block',
            )}
          >
            <Card className={cn('overflow-hidden rounded-2xl border bg-card', AGENDA_PANEL.calendar.card)}>
              <CardHeader className={cn('flex flex-col gap-3', AGENDA_PANEL.calendar.head)}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', AGENDA_PANEL.calendar.iconWrap)}>
                      <Calendar className={cn('size-4 shrink-0', AGENDA_PANEL.calendar.iconClass)} />
                    </span>
                    Takvim
                  </CardTitle>
                  <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 shadow-inner sm:w-auto sm:inline-grid sm:min-w-[220px]">
                    {(['month', 'week', 'day'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCalendarViewMode(v)}
                        className={cn(
                          'rounded-lg py-2 text-center text-[11px] font-bold transition-all sm:px-3 sm:text-xs',
                          calendarViewMode === v
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:bg-blue-600'
                            : 'bg-background/80 text-muted-foreground ring-1 ring-border/40 hover:bg-background hover:text-foreground',
                        )}
                      >
                        {v === 'month' && 'Ay'}
                        {v === 'week' && 'Hafta'}
                        {v === 'day' && 'Gün'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-end">
                  <Button variant="outline" size="sm" onClick={prevMonth} className="h-9 shrink-0 rounded-lg px-2.5 sm:h-10 sm:rounded-xl sm:px-3" aria-label="Önceki">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={goToday} className="h-9 shrink-0 gap-1 rounded-lg px-2.5 text-xs font-semibold sm:h-10 sm:rounded-xl sm:px-3">
                    <CalendarDays className="size-3.5 sm:size-4" />
                    Bugün
                  </Button>
                  <span className="min-w-0 flex-1 basis-32 truncate text-center text-xs font-semibold capitalize tabular-nums text-foreground sm:basis-auto sm:text-sm">
                    {monthLabel}
                  </span>
                  <Button variant="outline" size="sm" onClick={nextMonth} className="h-9 shrink-0 rounded-lg px-2.5 sm:h-10 sm:rounded-xl sm:px-3" aria-label="Sonraki">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                <AgendaCalendarGrid
                  month={month}
                  events={filteredEvents}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                  onEventDrop={handleTaskDateChange}
                  viewMode={calendarViewMode}
                />
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-[10px] font-medium sm:text-xs">
                  {AGENDA_SOURCE_KEYS.map((k) => (
                    <span key={k} className="flex items-center gap-1.5 text-foreground">
                      <span className={cn('size-2.5 shrink-0 rounded-full', AGENDA_SOURCE_THEME[k].legendDot)} aria-hidden />
                      {AGENDA_SOURCE_THEME[k].label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={cn(
              'space-y-4 sm:space-y-6 min-w-0',
              mobileTab === 'calendar' && 'hidden sm:block',
            )}
          >
            {mobileTab === 'notes' && (
              <Card className={cn('overflow-hidden rounded-2xl border bg-card', AGENDA_PANEL.notes.card)}>
                <CardHeader className={cn('flex flex-col gap-3', AGENDA_PANEL.notes.head)}>
                  <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', AGENDA_PANEL.notes.iconWrap)}>
                        <StickyNote className={cn('size-4 shrink-0', AGENDA_PANEL.notes.iconClass)} />
                      </span>
                      Notlar
                    </CardTitle>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground sm:text-sm">
                      {notes.total} not
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative w-full min-w-0 sm:max-w-md sm:flex-1">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
                      <input
                        type="text"
                        placeholder="Notlarda ara…"
                        value={noteSearch}
                        onChange={(e) => setNoteSearch(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm sm:pl-10"
                      />
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      <Button size="sm" onClick={() => { setNoteFromTemplate(null); setNoteModalOpen(true); }} className="h-9 shrink-0 rounded-xl px-3 sm:h-10 sm:px-4">
                        <Plus className="size-4 sm:mr-1" />
                        <span className="max-sm:sr-only">Ekle</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setTemplatePickerOpen(true); }} className="h-9 shrink-0 rounded-xl px-3 sm:h-10 sm:px-4">
                        <span className="text-xs font-semibold sm:text-sm">Şablondan</span>
                      </Button>
                      <label className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 text-xs font-medium sm:h-10 sm:px-3 sm:text-sm">
                        <input
                          type="checkbox"
                          checked={includeArchived}
                          onChange={(e) => setIncludeArchived(e.target.checked)}
                          className="rounded"
                        />
                        Arşiv
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                  {displayNotes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-linear-to-b from-indigo-500/5 to-transparent py-12 text-center sm:py-16">
                      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/20 sm:size-16">
                        <StickyNote className="size-7 text-indigo-800 dark:text-indigo-300 sm:size-8" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Henüz not yok</p>
                      <p className="text-sm text-muted-foreground mb-4">İlk notunuzu ekleyerek başlayın</p>
                      <Button size="sm" onClick={() => setNoteModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Not Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {displayNotes.map((n) => (
                        <li
                          key={n.id}
                          className={cn(
                            'flex min-h-[52px] touch-manipulation items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 text-sm font-semibold shadow-sm transition-all sm:px-4 sm:py-3.5',
                            !n.color && cn('border-l-4', AGENDA_PANEL.notes.accentBar),
                            AGENDA_PANEL.notes.rowHover,
                          )}
                          style={n.color ? { borderLeftWidth: 4, borderLeftColor: n.color } : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={selectedNoteIds.has(n.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedNoteIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(n.id)) next.delete(n.id);
                                else next.add(n.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded shrink-0"
                          />
                          <span
                            className="flex-1 cursor-pointer"
                            onClick={() => handleNoteClick(n)}
                          >
                            <StickyNote className="size-4 text-muted-foreground mr-2 inline shrink-0 align-middle" />
                            {n.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {mobileTab === 'tasks' && (
              <Card className={cn('overflow-hidden rounded-2xl border bg-card', AGENDA_PANEL.tasks.card)}>
                <CardHeader className={cn('flex flex-col gap-3', AGENDA_PANEL.tasks.head)}>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', AGENDA_PANEL.tasks.iconWrap)}>
                        <ListTodo className={cn('size-4 shrink-0', AGENDA_PANEL.tasks.iconClass)} />
                      </span>
                      Görevler
                    </CardTitle>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground sm:text-sm">
                      {tasks.total} görev
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Görevde ara…"
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        className="min-h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm sm:min-w-40 sm:max-w-xs"
                      />
                      <Button size="sm" onClick={() => { setTaskModalDate(undefined); setTaskModalOpen(true); }} className="h-9 shrink-0 rounded-xl px-3 sm:h-10 sm:px-4">
                        <Plus className="size-4 sm:mr-1" />
                        <span className="max-sm:sr-only">Ekle</span>
                      </Button>
                    </div>
                    <div className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
                      {(['all', 'today', 'week', 'overdue'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setTaskViewFilter(v)}
                          className={cn(
                            'shrink-0 rounded-lg px-2.5 py-2 text-center text-[11px] font-bold transition-all sm:py-1.5 sm:text-xs',
                            taskViewFilter === v ? AGENDA_PANEL.tasks.filterActive : AGENDA_PANEL.tasks.filterIdle,
                          )}
                        >
                          {v === 'all' && 'Tümü'}
                          {v === 'today' && 'Bugün'}
                          {v === 'week' && 'Bu hafta'}
                          {v === 'overdue' && 'Geciken'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="min-h-9 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs font-medium sm:min-h-10 sm:w-auto sm:min-w-34 sm:text-sm"
                      >
                        <option value="pending">Bekleyen</option>
                        <option value="completed">Tamamlanan</option>
                        <option value="overdue">Geciken</option>
                      </select>
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="min-h-9 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs font-medium sm:min-h-10 sm:w-auto sm:min-w-34 sm:text-sm"
                      >
                        <option value="">Tüm öncelikler</option>
                        <option value="low">Düşük</option>
                        <option value="medium">Orta</option>
                        <option value="high">Yüksek</option>
                      </select>
                      <select
                        value={taskSortBy}
                        onChange={(e) => setTaskSortBy(e.target.value as 'date' | 'priority')}
                        className="min-h-9 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs font-medium sm:min-h-10 sm:w-auto sm:min-w-36 sm:text-sm"
                      >
                        <option value="date">Tarihe göre</option>
                        <option value="priority">Önceliğe göre</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                  {displayTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-linear-to-b from-emerald-500/5 to-transparent py-12 text-center sm:py-16">
                      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 sm:size-16">
                        <ListTodo className="size-7 text-emerald-800 dark:text-emerald-300 sm:size-8" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Görev yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Yapılacaklar listenize görev ekleyin</p>
                      <Button size="sm" onClick={() => setTaskModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Görev Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {displayTasks.map((t) => (
                        <li
                          key={t.id}
                          className={cn(
                            'group flex min-h-[56px] touch-manipulation items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 text-sm shadow-sm transition-all sm:px-4 sm:py-3.5',
                            AGENDA_PANEL.tasks.rowHover,
                            isOverdue(t) && 'border-destructive/45 bg-destructive/5 ring-1 ring-destructive/15',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(t.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedTaskIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded shrink-0"
                          />
                          <input
                            type="checkbox"
                            checked={t.status === 'completed'}
                            disabled={togglingTaskId === t.id}
                            onChange={() =>
                              handleTaskStatus(t.id, t.status === 'completed' ? 'pending' : 'completed')
                            }
                            className="rounded border-input size-5 shrink-0 cursor-pointer"
                          />
                          <span
                            className={cn(
                              'min-w-0 flex-1 cursor-pointer truncate font-semibold leading-snug',
                              t.status === 'completed' && 'text-muted-foreground line-through',
                            )}
                            onClick={() => void openTaskEdit(t)}
                          >
                            {t.title}
                          </span>
                          {t.dueDate && (
                            <span
                              className={cn(
                                'text-xs shrink-0 tabular-nums',
                                isOverdue(t) ? 'text-destructive font-semibold' : 'text-muted-foreground',
                              )}
                            >
                              <span className="sm:hidden">{formatYmdSlash(t.dueDate)}</span>
                              <span className="hidden sm:inline">{format(new Date(`${t.dueDate}T12:00:00`), 'd MMM', { locale: tr })}</span>
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 shrink-0 h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(t.id);
                            }}
                          >
                            ×
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {mobileTab === 'student_notes' && (
              <Card className={cn('overflow-hidden rounded-2xl border bg-card', AGENDA_PANEL.student_notes.card)}>
                <CardHeader className={cn('flex flex-col gap-3', AGENDA_PANEL.student_notes.head)}>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', AGENDA_PANEL.student_notes.iconWrap)}>
                        <Users className={cn('size-4 shrink-0', AGENDA_PANEL.student_notes.iconClass)} />
                      </span>
                      Öğrenci notları
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => setStudentNoteModalOpen(true)} className="h-9 rounded-xl px-3 sm:h-10 sm:px-4">
                        <Plus className="size-4 sm:mr-1" />
                        Ekle
                      </Button>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground sm:text-sm">
                        {studentNotes.total} not
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                  {displayStudentNotes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-linear-to-b from-teal-500/5 to-transparent py-12 text-center sm:py-16">
                      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-teal-500/15 ring-1 ring-teal-500/20 sm:size-16">
                        <Users className="size-7 text-teal-800 dark:text-teal-300 sm:size-8" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Öğrenci notu yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Öğrenciler hakkında not ekleyin</p>
                      <Button size="sm" onClick={() => setStudentNoteModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Not Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {(displayStudentNotes as { id: string; noteType: string; noteDate: string; student?: { name: string } }[]).map((sn) => {
                        const typeLabel =
                          sn.noteType === 'positive' ? 'Olumlu' : sn.noteType === 'negative' ? 'Olumsuz' : 'Gözlem';
                        const badge =
                          sn.noteType === 'positive'
                            ? 'bg-emerald-500/15 text-emerald-900 ring-emerald-500/25 dark:text-emerald-100'
                            : sn.noteType === 'negative'
                              ? 'bg-rose-500/15 text-rose-900 ring-rose-500/25 dark:text-rose-100'
                              : 'bg-slate-500/12 text-slate-800 ring-slate-500/20 dark:text-slate-200';
                        return (
                          <li
                            key={sn.id}
                            onClick={() => setStudentNoteDetailId(sn.id)}
                            className={cn(
                              'cursor-pointer rounded-xl border border-border/80 border-l-4 border-l-teal-500 bg-card px-3 py-3 text-sm shadow-sm transition-all sm:px-4 sm:py-3.5',
                              AGENDA_PANEL.student_notes.rowHover,
                            )}
                          >
                            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <span className="min-w-0 truncate font-bold text-foreground">{sn.student?.name ?? 'Öğrenci'}</span>
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className={cn('inline-flex shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1', badge)}>
                                  {typeLabel}
                                </span>
                                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                  <span className="sm:hidden">{formatYmdSlash(sn.noteDate)}</span>
                                  <span className="hidden sm:inline">{sn.noteDate}</span>
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {mobileTab === 'parent_meetings' && (
              <Card className={cn('overflow-hidden rounded-2xl border bg-card', AGENDA_PANEL.parent_meetings.card)}>
                <CardHeader className={cn('flex flex-col gap-3', AGENDA_PANEL.parent_meetings.head)}>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
                      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', AGENDA_PANEL.parent_meetings.iconWrap)}>
                        <UserPlus className={cn('size-4 shrink-0', AGENDA_PANEL.parent_meetings.iconClass)} />
                      </span>
                      Veli toplantıları
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => setParentMeetingModalOpen(true)} className="h-9 rounded-xl px-3 sm:h-10 sm:px-4">
                        <Plus className="size-4 sm:mr-1" />
                        Ekle
                      </Button>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground sm:text-sm">
                        {parentMeetings.total} toplantı
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                  {displayParentMeetings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-linear-to-b from-rose-500/5 to-transparent py-12 text-center sm:py-16">
                      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-rose-500/15 sm:size-16">
                        <UserPlus className="size-7 text-rose-800 dark:text-rose-300 sm:size-8" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Veli toplantısı yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Planlanan veli görüşmelerini ekleyin</p>
                      <Button size="sm" onClick={() => setParentMeetingModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Toplantı Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {(displayParentMeetings as { id: string; meetingDate: string; subject?: string; student?: { name: string } }[]).map((pm) => (
                        <li
                          key={pm.id}
                          className={cn(
                            'rounded-xl border border-border/80 border-l-4 border-l-rose-500 bg-card px-3 py-3 text-sm shadow-sm transition-all sm:px-4 sm:py-3.5',
                            AGENDA_PANEL.parent_meetings.rowHover,
                          )}
                        >
                          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-foreground">{pm.student?.name ?? 'Öğrenci'}</p>
                              <p className="mt-0.5 text-sm font-medium leading-snug text-foreground/90">{pm.subject ?? 'Veli toplantısı'}</p>
                            </div>
                            <span className="shrink-0 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-bold tabular-nums text-rose-900 ring-1 ring-rose-500/20 dark:text-rose-100">
                              <span className="sm:hidden">{formatYmdSlash(pm.meetingDate)}</span>
                              <span className="hidden sm:inline">{pm.meetingDate}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={openAddMenu}
        className="sm:hidden fixed right-5 bottom-28 z-40 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/40 hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Ekle"
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>

      <EventDetailModal
        event={selectedEvent}
        open={eventModalOpen}
        onOpenChange={setEventModalOpen}
        onTaskStatusChange={handleTaskStatus}
        isSchoolAdmin={isSchoolAdmin}
        onEditSchoolEvent={handleEditSchoolEvent}
        onDeleteSchoolEvent={handleDeleteSchoolEvent}
      />
      <StudentNoteDetailModal
        note={studentNoteDetail}
        loading={studentNoteDetailLoading}
        open={!!studentNoteDetailId}
        onOpenChange={(o) => { if (!o) setStudentNoteDetailId(null); }}
      />
      <NoteFormModal
        open={noteModalOpen}
        onOpenChange={(open) => { if (!open) setNoteFromTemplate(null); setNoteModalOpen(open); }}
        onSubmit={handleCreateNote}
        subjects={subjects}
        classes={classes}
        initial={noteFromTemplate ?? undefined}
        onUploadFile={uploadFileForNote}
      />
      <TemplatePickerModal
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        templates={templates}
        onSelect={(t) => {
          setNoteFromTemplate({ title: t.title, body: t.bodyTemplate ?? undefined });
          setNoteModalOpen(true);
          setTemplatePickerOpen(false);
        }}
        onCreateTemplate={async (data) => {
          if (!token) return;
          await apiFetch('/teacher-agenda/templates', {
            method: 'POST',
            token,
            body: JSON.stringify(data),
          });
          toast.success('Şablon oluşturuldu');
          fetchTemplates();
        }}
      />
      <NoteDetailModal
        note={selectedNote}
        open={noteDetailOpen}
        onOpenChange={setNoteDetailOpen}
        onArchive={handleArchiveNote}
        onDelete={handleDeleteNote}
        onUpdate={handleUpdateNote}
        subjects={subjects}
        classes={classes}
      />
      <TaskFormModal
        open={taskModalOpen || !!editingTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
            setTaskModalDate(undefined);
          }
          setTaskModalOpen(open);
        }}
        onSubmit={editingTask
          ? (data) => handleUpdateTask(editingTask.id, data)
          : handleCreateTask
        }
        initialDate={taskModalDate}
        editTaskId={editingTask?.id ?? null}
        initial={editingTask ? {
          title: editingTask.title,
          description: editingTask.description ?? undefined,
          dueDate: editingTask.dueDate ?? undefined,
          dueTime: editingTask.dueTime ?? undefined,
          priority: editingTask.priority as 'low' | 'medium' | 'high',
          repeat: (editingTask.repeat as 'none' | 'daily' | 'weekly' | 'monthly') ?? 'none',
          studentId: editingTask.studentId ?? undefined,
          remindAt: agendaTaskRemindAtLocal(editingTask),
        } : undefined}
        students={students}
      />
      <StudentNoteFormModal
        open={studentNoteModalOpen}
        onOpenChange={setStudentNoteModalOpen}
        onSubmit={handleCreateStudentNote}
        students={students}
        subjects={subjects}
      />
      <ParentMeetingFormModal
        open={parentMeetingModalOpen}
        onOpenChange={setParentMeetingModalOpen}
        onSubmit={handleCreateParentMeeting}
        students={students}
      />
      <SchoolEventFormModal
        open={schoolEventModalOpen || !!editingSchoolEventId}
        onOpenChange={(open) => {
          if (!open) {
            setSchoolEventModalOpen(false);
            setEditingSchoolEventId(null);
            setEditingSchoolEventData(null);
          }
        }}
        onSubmit={handleCreateSchoolEvent}
        token={token}
        eventId={editingSchoolEventId}
        initialData={editingSchoolEventData}
      />
    </div>
  );
}

export default function OgretmenAjandasiPage() {
  return (
    <Suspense fallback={<AgendaSkeleton />}>
      <OgretmenAjandasiPageContent />
    </Suspense>
  );
}
