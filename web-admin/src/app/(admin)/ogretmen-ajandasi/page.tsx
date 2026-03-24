'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import {
  Calendar,
  ListTodo,
  StickyNote,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  UserPlus,
  Search,
  Download,
  Printer,
  Target,
  Building2,
  EyeOff,
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { AgendaCalendarGrid, type CalendarEvent } from './components/agenda-calendar-grid';
import { EventDetailModal } from './components/event-detail-modal';
import { NoteFormModal } from './components/note-form-modal';
import { NoteDetailModal } from './components/note-detail-modal';
import { TaskFormModal } from './components/task-form-modal';
import { StudentNoteFormModal } from './components/student-note-form-modal';
import { ParentMeetingFormModal } from './components/parent-meeting-form-modal';
import { SchoolEventFormModal } from './components/school-event-form-modal';
import { TemplatePickerModal } from './components/template-picker-modal';
import { StudentNoteDetailModal, type StudentNoteDetail } from './components/student-note-detail-modal';
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
};
type Student = { id: string; name: string };
type Subject = { id: string; label: string };
type Class = { id: string; label: string };

type ViewTab = 'calendar' | 'notes' | 'tasks' | 'student_notes' | 'parent_meetings';

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

const SAMPLE_NOTES: AgendaNote[] = [
  { id: 'demo-1', title: 'Matematik sınav hazırlığı', body: '7. sınıf denklem konusu için soru bankası hazırla. Öğrencilere dağıtılacak ek alıştırmalar.\n\n- Çoktan seçmeli 20 soru\n- Açık uçlu 5 soru', tags: ['sınav', 'matematik'], color: '#dbeafe', pinned: true, attachments: [{ id: 'a1', fileUrl: 'https://placehold.co/200x150/e2e8f0/64748b?text=PDF', fileName: 'soru_bankasi.pdf', fileType: 'application/pdf' }] },
  { id: 'demo-2', title: 'Veli toplantısı notları', body: 'Ahmet Yılmaz velisi ile görüşüldü. Ders çalışma programı üzerinde anlaşıldı.', tags: ['veli', 'takip'], color: '#d1fae5' },
  { id: 'demo-3', title: 'Proje ödevi hatırlatması', body: 'Fen bilimleri proje ödevleri 20 Mart\'a kadar teslim edilecek.', tags: ['proje', 'ödev'], color: '#fef3c7' },
];

const SAMPLE_TASKS: AgendaTask[] = [
  { id: 'demo-t1', title: 'Sınav kağıtlarını okumak', dueDate: toYMD(new Date()), dueTime: '14:00', status: 'pending', priority: 'high' },
  { id: 'demo-t2', title: 'Haftalık plan güncellemesi', dueDate: toYMD(new Date(Date.now() + 86400000)), status: 'pending', priority: 'medium' },
  { id: 'demo-t3', title: 'Öğrenci değerlendirme formları', dueDate: toYMD(new Date(Date.now() - 86400000)), status: 'pending', priority: 'high' },
];

function getSampleEvents(): CalendarEvent[] {
  const today = toYMD(new Date());
  return [
    { id: 'demo-e1', type: 'school_event', title: 'Toplantı: Zümre', start: `${today}T09:00:00`, source: 'SCHOOL', createdBy: 'Müdür Yardımcısı' },
    { id: 'demo-e2', type: 'task', title: 'Sınav okuma', start: `${today}T14:00:00`, source: 'PERSONAL', createdBy: 'Siz' },
    { id: 'demo-e3', type: 'parent_meeting', title: 'Veli görüşmesi', start: `${today}T16:00:00`, source: 'PERSONAL', createdBy: 'Siz' },
  ];
}

const SAMPLE_STUDENT_NOTES = [
  { id: 'demo-s1', noteType: 'positive', noteDate: toYMD(new Date()), student: { name: 'Elif Kaya' } },
  { id: 'demo-s2', noteType: 'observation', noteDate: toYMD(new Date(Date.now() - 86400000)), student: { name: 'Mehmet Demir' } },
];

const SAMPLE_PARENT_MEETINGS = [
  { id: 'demo-p1', meetingDate: toYMD(new Date()), subject: 'Ders başarısı', student: { name: 'Ayşe Yıldız' } },
  { id: 'demo-p2', meetingDate: toYMD(new Date(Date.now() + 86400000)), subject: 'Davranış', student: { name: 'Can Öztürk' } },
];

function escapeHtml(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toStartEnd(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toYMD(start), end: toYMD(end) };
}

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

export default function OgretmenAjandasiPage() {
  const { token, me } = useAuth();
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
  const [noteFromTemplate, setNoteFromTemplate] = useState<{ title: string; body?: string } | null>(null);
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
  const [showDemo, setShowDemo] = useState(true);
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
    if (!studentNoteDetailId || !token || studentNoteDetailId.startsWith('demo-')) {
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
    if (note.id.startsWith('demo-')) {
      setSelectedNote(note);
      setNoteDetailOpen(true);
      return;
    }
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
    if (id.startsWith('demo-')) { toast.info('Örnek veri düzenlenemez'); return; }
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
    if (id.startsWith('demo-')) { toast.info('Örnek veri arşivlenemez'); return; }
    if (!token) return;
    await apiFetch(`/teacher-agenda/notes/${id}/archive`, { method: 'POST', token });
    toast.success('Not arşivlendi');
    refresh();
  };

  const handleDeleteNote = async (id: string) => {
    if (id.startsWith('demo-')) { toast.info('Örnek veri silinemez'); return; }
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
    const task = await apiFetch<{ id: string }>('/teacher-agenda/tasks', {
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
      }),
    });
    if (data.remindAt && task?.id) {
      await apiFetch('/teacher-agenda/reminders', {
        method: 'POST',
        token,
        body: JSON.stringify({ taskId: task.id, remindAt: data.remindAt }),
      });
    }
    toast.success('Görev eklendi');
    refresh();
  };

  const handleUpdateTask = async (
    id: string,
    data: Partial<{ title: string; description: string; dueDate: string; dueTime: string; priority: string; repeat: string }>
  ) => {
    if (id.startsWith('demo-')) { toast.info('Örnek veri düzenlenemez'); setEditingTask(null); return; }
    if (!token) return;
    await apiFetch(`/teacher-agenda/tasks/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    });
    toast.success('Görev güncellendi');
    refresh();
    setEditingTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    if (id.startsWith('demo-')) { toast.info('Örnek veri silinemez'); return; }
    if (!token || !confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    await apiFetch(`/teacher-agenda/tasks/${id}`, { method: 'DELETE', token });
    toast.success('Görev silindi');
    refresh();
  };

  const handleTaskDateChange = async (taskId: string, newDate: string) => {
    if (taskId.startsWith('demo-')) { toast.info('Örnek veri'); return; }
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
    if (taskId.startsWith('demo-')) { toast.info('Örnek veri'); return; }
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
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
    const ids = Array.from(selectedNoteIds).filter((id) => !id.startsWith('demo-'));
    if (ids.length === 0) { toast.info('Örnek veri arşivlenemez'); return; }
    await apiFetch('/teacher-agenda/notes/bulk-archive', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} not arşivlendi`);
    setSelectedNoteIds(new Set());
    refresh();
  };

  const handleBulkDeleteNotes = async () => {
    if (!token || selectedNoteIds.size === 0 || !confirm('Seçili notları silmek istediğinize emin misiniz?')) return;
    const ids = Array.from(selectedNoteIds).filter((id) => !id.startsWith('demo-'));
    if (ids.length === 0) { toast.info('Örnek veri silinemez'); return; }
    await apiFetch('/teacher-agenda/notes/bulk-delete', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} not silindi`);
    setSelectedNoteIds(new Set());
    refresh();
  };

  const handleBulkDeleteTasks = async () => {
    if (!token || selectedTaskIds.size === 0 || !confirm('Seçili görevleri silmek istediğinize emin misiniz?')) return;
    const ids = Array.from(selectedTaskIds).filter((id) => !id.startsWith('demo-'));
    if (ids.length === 0) { toast.info('Örnek veri silinemez'); return; }
    await apiFetch('/teacher-agenda/tasks/bulk-delete', { method: 'POST', token, body: JSON.stringify({ ids }) });
    toast.success(`${ids.length} görev silindi`);
    setSelectedTaskIds(new Set());
    refresh();
  };

  const handleBulkCompleteTasks = async () => {
    if (!token || selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds).filter((id) => !id.startsWith('demo-'));
    if (ids.length === 0) { toast.info('Örnek veri'); return; }
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

  const useDemo = showDemo && notes.items.length === 0 && tasks.items.length === 0;
  const displayNotes = useDemo ? SAMPLE_NOTES : notes.items;
  const displayTasksRaw = useDemo ? SAMPLE_TASKS : tasks.items;
  const displayTasks = [...displayTasksRaw].sort((a, b) => {
    if (taskSortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
    }
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  });
  const displayEvents = useDemo ? getSampleEvents() : events;
  const displayStudentNotes = useDemo ? SAMPLE_STUDENT_NOTES : studentNotes.items;
  const displayParentMeetings = useDemo ? SAMPLE_PARENT_MEETINGS : parentMeetings.items;

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
    return (
      <div className="space-y-6">
        <Alert message="Bu sayfaya erişim yetkiniz yok." />
      </div>
    );
  }

  const isTeacher = me.role === 'teacher';
  const tabs: { id: ViewTab; label: string; count?: number; base: string; active: string }[] = isTeacher
    ? [
        { id: 'calendar', label: 'Takvim', base: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', active: 'bg-blue-500/25 border-blue-500/50 ring-1 ring-blue-500/40' },
        { id: 'notes', label: 'Notlar', count: useDemo ? displayNotes.length : notes.total, base: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', active: 'bg-amber-500/25 border-amber-500/50 ring-1 ring-amber-500/40' },
        { id: 'tasks', label: 'Görevler', count: useDemo ? displayTasks.length : tasks.total, base: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', active: 'bg-emerald-500/25 border-emerald-500/50 ring-1 ring-emerald-500/40' },
        { id: 'student_notes', label: 'Öğr. Notları', count: useDemo ? displayStudentNotes.length : studentNotes.total, base: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30', active: 'bg-violet-500/25 border-violet-500/50 ring-1 ring-violet-500/40' },
        { id: 'parent_meetings', label: 'Veli Topl.', count: useDemo ? displayParentMeetings.length : parentMeetings.total, base: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', active: 'bg-rose-500/25 border-rose-500/50 ring-1 ring-rose-500/40' },
      ]
    : [{ id: 'calendar', label: 'Okul Takvimi', base: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', active: 'bg-blue-500/25 border-blue-500/50 ring-1 ring-blue-500/40' }];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 pb-24 sm:pb-0">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {isSchoolAdmin ? 'Okul Takvimi' : 'Öğretmen Ajandası'}
          </ToolbarPageTitle>
          {isSchoolAdmin ? (
            <ToolbarIconHints
              compact
              items={[
                { label: 'Okul takvimi', icon: Calendar },
                { label: 'Yönetim', icon: Building2 },
                { label: 'Öğretmen verisi gizli', icon: EyeOff },
              ]}
              summary="Okul etkinliklerini görüntüleyin ve yönetin. Öğretmen notları ve görevleri görüntülenmez."
            />
          ) : (
            <ToolbarIconHints
              items={[
                { label: 'Takvim', icon: Calendar },
                { label: 'Notlar', icon: StickyNote },
                { label: 'Görevler', icon: ListTodo },
                { label: 'Veli toplantıları', icon: Users },
              ]}
              summary="Notlar, görevler, öğrenci notları, veli toplantıları ve takvim."
            />
          )}
        </ToolbarHeading>
        {isTeacher && notes.items.length === 0 && tasks.items.length === 0 && (
          <Button
            variant={showDemo ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowDemo(!showDemo)}
            className="mt-4 rounded-xl"
          >
            {showDemo ? 'Örnekleri Gizle' : 'Örnekleri Göster'}
          </Button>
        )}
        {(summary || useDemo) && (
          <div className="flex flex-wrap gap-3 mt-4">
            {isTeacher && (
              <>
                <button
                  type="button"
                  onClick={() => { setMobileTab('tasks'); setFilterStatus('pending'); setTaskViewFilter('all'); }}
                  className="flex items-center gap-2.5 rounded-2xl bg-primary/10 px-4 py-2.5 border border-primary/20 shadow-sm hover:bg-primary/20 transition-colors text-left"
                >
                  <ListTodo className="size-5 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{useDemo ? 3 : (summary?.pendingTasks ?? 0)}</span>
                  <span className="text-xs text-muted-foreground">bekleyen</span>
                </button>
                {(useDemo ? 1 : (summary?.overdueTasks ?? 0)) > 0 && (
                  <button
                    type="button"
                    onClick={() => { setMobileTab('tasks'); setFilterStatus('overdue'); setTaskViewFilter('overdue'); }}
                    className="flex items-center gap-2.5 rounded-2xl bg-destructive/10 px-4 py-2.5 border border-destructive/20 shadow-sm hover:bg-destructive/20 transition-colors text-left"
                  >
                    <span className="text-sm font-semibold text-destructive">{useDemo ? 1 : (summary?.overdueTasks ?? 0)}</span>
                    <span className="text-xs text-destructive/90">gecikmiş</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => { setMobileTab('calendar'); setMonth(new Date()); setCalendarViewMode('day'); }}
              className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-4 py-2.5 border border-border shadow-sm hover:bg-muted transition-colors text-left"
            >
              <CalendarDays className="size-5 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground">{useDemo ? 3 : (summary?.todayEventCount ?? 0)}</span>
              <span className="text-xs text-muted-foreground">bugün</span>
            </button>
            {isTeacher && (
              <Link
                href="/ogretmen-ajandasi/degerlendirme"
                className="flex items-center gap-2.5 rounded-2xl bg-violet-500/10 px-4 py-2.5 border border-violet-500/20 shadow-sm hover:bg-violet-500/20 transition-colors text-left"
              >
                <Target className="size-5 text-violet-600 dark:text-violet-400 shrink-0" />
                <span className="text-sm font-semibold text-foreground">Öğrenci Değerlendirme</span>
              </Link>
            )}
          </div>
        )}
      </Toolbar>

      {error && <Alert message={error} className="mb-4" />}
      {isTeacher && useDemo && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
          <span className="font-medium text-primary">Örnek veriler gösteriliyor.</span>
          Gerçek verilerinizi görmek için not veya görev ekleyin.
        </div>
      )}

      {isTeacher && (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Not, görev, öğrenci notu ara... (min 2 karakter)"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm"
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
                  <button key={t.id} type="button" onClick={() => { setEditingTask(t); setTaskModalOpen(true); setSearchResults(null); setGlobalSearch(''); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm flex items-center gap-2">
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

      <div className="flex rounded-2xl bg-muted/40 p-1.5 gap-1 overflow-x-auto scrollbar-none -mx-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={cn(
              'flex-1 min-w-[72px] min-h-[48px] rounded-xl text-xs font-semibold transition-all shrink-0 border',
              tab.base,
              mobileTab === tab.id && tab.active,
            )}
          >
            {tab.label}
            {tab.count !== undefined && ` (${tab.count})`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isTeacher && (
          <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 min-h-[44px]">
            <Filter className="size-4 shrink-0 text-muted-foreground" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="flex-1 min-w-0 border-0 bg-transparent text-sm focus:outline-none py-1"
            >
              <option value="">Tüm kaynaklar</option>
              <option value="PERSONAL">Kişisel</option>
              <option value="SCHOOL">Okul</option>
              <option value="PLATFORM">Platform</option>
            </select>
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
            <Button size="sm" variant="outline" onClick={() => { setMobileTab('student_notes'); setStudentNoteModalOpen(true); }} className="rounded-xl" title="Öğrenci hakkında +/− not veya gözlem ekleyin">
              <Users className="size-4 mr-1" />
              Öğrenci Notu
            </Button>
            <div className="flex gap-1 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleIcalDownload} className="rounded-xl" title="Takvimi .ics formatında indir">
                <Calendar className="size-4 mr-1" />
                iCal
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('notes')} className="rounded-xl" title="Notları CSV olarak indir">
                <Download className="size-4 mr-1" />
                Notlar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('tasks')} className="rounded-xl" title="Görevleri CSV olarak indir">
                <Download className="size-4 mr-1" />
                Görevler CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl">
                <Printer className="size-4 mr-1" />
                Yazdır
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

      {isTeacher && weeklyStats && !useDemo && (
        <div className="rounded-xl bg-muted/40 px-4 py-2.5 border border-border flex items-center gap-4 text-sm">
          <span className="font-medium">Bu hafta:</span>
          <span>{weeklyStats.completed}/{weeklyStats.total} görev tamamlandı</span>
          <span className="text-primary font-semibold">%{weeklyStats.completionRate}</span>
        </div>
      )}

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
            <Card className="overflow-hidden border shadow-sm rounded-2xl bg-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                  <Calendar className="size-5 shrink-0 text-primary" />
                  Takvim
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {(['month', 'week', 'day'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCalendarViewMode(v)}
                        className={cn(
                          'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                          calendarViewMode === v ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted',
                        )}
                      >
                        {v === 'month' && 'Ay'}
                        {v === 'week' && 'Hafta'}
                        {v === 'day' && 'Gün'}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={prevMonth} className="min-h-[40px] px-3 rounded-xl">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={goToday} className="min-h-[40px] px-3 rounded-xl">
                    <CalendarDays className="size-4 mr-1" />
                    Bugün
                  </Button>
                  <span className="min-w-[120px] sm:min-w-[160px] text-center text-sm font-medium capitalize">
                    {monthLabel}
                  </span>
                  <Button variant="outline" size="sm" onClick={nextMonth} className="min-h-[40px] px-3 rounded-xl">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <AgendaCalendarGrid
                  month={month}
                  events={filteredEvents}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                  onEventDrop={handleTaskDateChange}
                  viewMode={calendarViewMode}
                />
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/60 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/80" /> Kişisel</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-blue-500/80" /> Okul</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500/80" /> Platform</span>
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
              <Card className="overflow-hidden border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <StickyNote className="size-5 shrink-0 text-primary" />
                    Notlar
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[120px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Ara..."
                        value={noteSearch}
                        onChange={(e) => setNoteSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-sm"
                      />
                    </div>
                    <Button size="sm" onClick={() => { setNoteFromTemplate(null); setNoteModalOpen(true); }} className="min-h-[40px] px-4 rounded-xl">
                      <Plus className="size-4" />
                      Ekle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setTemplatePickerOpen(true); }}
                      className="min-h-[40px] px-4 rounded-xl"
                    >
                      Şablondan
                    </Button>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeArchived}
                        onChange={(e) => setIncludeArchived(e.target.checked)}
                      />
                      Arşiv
                    </label>
                    <span className="text-sm text-muted-foreground">{useDemo ? displayNotes.length : notes.total} not</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {displayNotes.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-gradient-to-b from-muted/30 to-transparent border border-dashed border-border">
                      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                        <StickyNote className="size-8 text-primary" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Henüz not yok</p>
                      <p className="text-sm text-muted-foreground mb-4">İlk notunuzu ekleyerek başlayın</p>
                      <Button size="sm" onClick={() => setNoteModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Not Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {displayNotes.map((n) => (
                        <li
                          key={n.id}
                          className={cn(
                            'rounded-xl border bg-card px-4 py-3.5 text-sm font-medium transition-all min-h-[52px] flex items-center touch-manipulation gap-3',
                            !n.id.startsWith('demo-') && 'hover:bg-muted/40 hover:shadow-md hover:border-primary/20',
                          )}
                          style={n.color ? { borderLeftWidth: 4, borderLeftColor: n.color } : undefined}
                        >
                          {!n.id.startsWith('demo-') && (
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
                          )}
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
              <Card className="overflow-hidden border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <ListTodo className="size-5 shrink-0 text-primary" />
                    Görevler
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ara..."
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      className="w-24 sm:w-32 rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                    />
                    <Button size="sm" onClick={() => { setTaskModalDate(undefined); setTaskModalOpen(true); }} className="min-h-[40px] px-4 rounded-xl">
                      <Plus className="size-4" />
                      Ekle
                    </Button>
                    <div className="flex gap-1 flex-wrap">
                      {(['all', 'today', 'week', 'overdue'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setTaskViewFilter(v)}
                          className={cn(
                            'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                            taskViewFilter === v
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 hover:bg-muted',
                          )}
                        >
                          {v === 'all' && 'Tümü'}
                          {v === 'today' && 'Bugün'}
                          {v === 'week' && 'Bu hafta'}
                          {v === 'overdue' && 'Geciken'}
                        </button>
                      ))}
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                    >
                      <option value="pending">Bekleyen</option>
                      <option value="completed">Tamamlanan</option>
                      <option value="overdue">Geciken</option>
                    </select>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                    >
                      <option value="">Tüm öncelikler</option>
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                    </select>
                    <select
                      value={taskSortBy}
                      onChange={(e) => setTaskSortBy(e.target.value as 'date' | 'priority')}
                      className="rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[40px]"
                    >
                      <option value="date">Tarihe göre</option>
                      <option value="priority">Önceliğe göre</option>
                    </select>
                    <span className="text-sm text-muted-foreground">{useDemo ? displayTasks.length : tasks.total} görev</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {displayTasks.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-gradient-to-b from-muted/30 to-transparent border border-dashed border-border">
                      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                        <ListTodo className="size-8 text-primary" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Görev yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Yapılacaklar listenize görev ekleyin</p>
                      <Button size="sm" onClick={() => setTaskModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Görev Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {displayTasks.map((t) => (
                        <li
                          key={t.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm min-h-[56px] touch-manipulation transition-all hover:shadow-md hover:border-primary/20 group',
                            isOverdue(t) && 'border-destructive/40 bg-destructive/5',
                          )}
                        >
                          {!t.id.startsWith('demo-') && (
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
                          )}
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
                              'flex-1 min-w-0 font-medium truncate cursor-pointer',
                              t.status === 'completed' && 'line-through text-muted-foreground',
                            )}
                            onClick={() => setEditingTask(t)}
                          >
                            {t.title}
                          </span>
                          {t.dueDate && (
                            <span
                              className={cn(
                                'text-xs shrink-0',
                                isOverdue(t) ? 'text-destructive font-semibold' : 'text-muted-foreground',
                              )}
                            >
                              {format(new Date(t.dueDate), 'd MMM')}
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
              <Card className="overflow-hidden border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <Users className="size-5 shrink-0 text-primary" />
                    Öğrenci Notları
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setStudentNoteModalOpen(true)} className="min-h-[40px] px-4 rounded-xl">
                      <Plus className="size-4" />
                      Ekle
                    </Button>
                    <span className="text-sm text-muted-foreground">{useDemo ? displayStudentNotes.length : studentNotes.total} not</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {displayStudentNotes.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-gradient-to-b from-muted/30 to-transparent border border-dashed border-border">
                      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                        <Users className="size-8 text-primary" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Öğrenci notu yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Öğrenciler hakkında not ekleyin</p>
                      <Button size="sm" onClick={() => setStudentNoteModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Not Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(displayStudentNotes as { id: string; noteType: string; noteDate: string; student?: { name: string } }[]).map((sn) => (
                        <li
                          key={sn.id}
                          onClick={() => { if (!sn.id.startsWith('demo-')) { setStudentNoteDetailId(sn.id); } }}
                          className={cn(
                            'rounded-xl border bg-card px-4 py-3.5 text-sm transition-all hover:bg-muted/40 hover:shadow-md',
                            !sn.id.startsWith('demo-') && 'cursor-pointer',
                          )}
                        >
                          <span className="font-semibold">{sn.student?.name ?? 'Öğrenci'}</span>
                          <span className="text-muted-foreground ml-2">
                            {sn.noteType === 'positive' ? 'Olumlu' : sn.noteType === 'negative' ? 'Olumsuz' : 'Gözlem'} – {sn.noteDate}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {mobileTab === 'parent_meetings' && (
              <Card className="overflow-hidden border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <UserPlus className="size-5 shrink-0 text-primary" />
                    Veli Toplantıları
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setParentMeetingModalOpen(true)} className="min-h-[40px] px-4 rounded-xl">
                      <Plus className="size-4" />
                      Ekle
                    </Button>
                    <span className="text-sm text-muted-foreground">{useDemo ? displayParentMeetings.length : parentMeetings.total} toplantı</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {displayParentMeetings.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-gradient-to-b from-muted/30 to-transparent border border-dashed border-border">
                      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                        <UserPlus className="size-8 text-primary" />
                      </div>
                      <p className="text-base font-medium text-foreground mb-1">Veli toplantısı yok</p>
                      <p className="text-sm text-muted-foreground mb-4">Planlanan veli görüşmelerini ekleyin</p>
                      <Button size="sm" onClick={() => setParentMeetingModalOpen(true)} className="rounded-xl">
                        <Plus className="size-4 mr-1" />
                        Toplantı Ekle
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(displayParentMeetings as { id: string; meetingDate: string; subject?: string; student?: { name: string } }[]).map((pm) => (
                        <li key={pm.id} className="rounded-xl border bg-card px-4 py-3.5 text-sm transition-all hover:bg-muted/40 hover:shadow-md">
                          <span className="font-semibold">{pm.student?.name ?? 'Öğrenci'}</span>
                          <span className="text-muted-foreground ml-2">
                            {pm.subject ?? 'Veli toplantısı'} – {pm.meetingDate}
                          </span>
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
          if (!open) setEditingTask(null);
          setTaskModalOpen(open);
        }}
        onSubmit={editingTask
          ? (data) => handleUpdateTask(editingTask.id, data)
          : handleCreateTask
        }
        initialDate={taskModalDate}
        initial={editingTask ? {
          title: editingTask.title,
          description: editingTask.description ?? undefined,
          dueDate: editingTask.dueDate ?? undefined,
          dueTime: editingTask.dueTime ?? undefined,
          priority: editingTask.priority as 'low' | 'medium' | 'high',
          repeat: (editingTask.repeat as 'none' | 'daily' | 'weekly' | 'monthly') ?? 'none',
          studentId: (editingTask as { studentId?: string }).studentId ?? undefined,
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
