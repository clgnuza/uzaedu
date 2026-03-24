'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { ArrowLeft, FileText, Send, Upload, Download, FileDown, Zap, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type DutyPlan = {
  id: string;
  version: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  period_start: string | null;
  period_end: string | null;
  academic_year: string | null;
  created_at: string;
};

type UserItem = { id: string; display_name: string | null; email: string; role?: string; status?: string };
type ParsedRow = {
  date: string;
  shift: 'morning' | 'afternoon';
  teacherInput: string;
  area: string;
  slot_start_time: string | null;
  slot_end_time: string | null;
  user_id: string | null;
  matchedName: string | null;
  error?: string;
};

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('tr-TR');
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function excelSerialToDate(serial: number): string {
  if (serial < 1) return '';
  const utc = (serial - 25569) * 86400 * 1000;
  return toYMD(new Date(utc));
}

/** Excel'den gelen saati HH:mm formatına çevir (08:00, 15:30). Boş/geçersiz → null */
function normalizeTime(val: string | number | Date | null | undefined): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    if (val < 0 || val >= 1) return null;
    const h = Math.floor(val * 24);
    const m = Math.round(((val * 24) - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

function matchTeacher(
  input: string,
  teachers: UserItem[],
): { user_id: string; matchedName: string } | { error: string } {
  const raw = String(input ?? '').trim();
  if (!raw) return { error: 'Boş' };
  const lower = raw.toLowerCase();
  for (const t of teachers) {
    const email = (t.email ?? '').toLowerCase();
    const name = (t.display_name ?? '').toLowerCase();
    if (email && email === lower) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (name && name === lower) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (name && name.includes(lower)) return { user_id: t.id, matchedName: t.display_name || t.email };
    if (raw && name && name.includes(raw)) return { user_id: t.id, matchedName: t.display_name || t.email };
  }
  return { error: 'Eşleşmedi' };
}

export default function DutyPlanlarPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [plans, setPlans] = useState<DutyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [dutyEducationMode, setDutyEducationMode] = useState<'single' | 'double'>('single');
  const [autoShifts, setAutoShifts] = useState<('morning' | 'afternoon')[]>(['morning']);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoForm, setAutoForm] = useState({ period_start: '', period_end: '', slots_per_day: 3, version: '', max_per_week: 0 });
  const [dutyDaysPerWeek, setDutyDaysPerWeek] = useState<1 | 2>(1);
  const [lastCreatedPlanId, setLastCreatedPlanId] = useState<string | null>(null);
  const [autoGenWarning, setAutoGenWarning] = useState<string | null>(null);
  const [priorityAreaExtendedMsg, setPriorityAreaExtendedMsg] = useState<string | null>(null);
  const [advancedRulesOpen, setAdvancedRulesOpen] = useState(false);
  const [rotateAreaByWeek, setRotateAreaByWeek] = useState(false);
  const [ruleToggles, setRuleToggles] = useState({
    prevent_consecutive_days: true,
    respect_preferences: true,
    enable_weekday_balance: true,
    prefer_fewer_lessons_day: true,
    same_day_each_week: false,
    max_per_month: 0,
    min_days_between: 0,
  });
  const [distributionReport, setDistributionReport] = useState<{
    user_id: string; display_name: string | null; email: string; weekday_labels: Record<string, number>; total: number;
  }[] | null>(null);
  const [distributionReportOpen, setDistributionReportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [prefsInRange, setPrefsInRange] = useState<{ preferConfirmed: number; unavailable: number } | null>(null);
  const [areasTotalSlots, setAreasTotalSlots] = useState<number | null>(null);
  const PERIOD_PRESETS = [
    { label: 'Bu ay', get: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { period_start: toYMD(first), period_end: toYMD(last) };
    }},
    { label: 'Gelecek ay', get: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      return { period_start: toYMD(first), period_end: toYMD(last) };
    }},
    { label: 'Sonraki 4 hafta', get: () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 27);
      return { period_start: toYMD(start), period_end: toYMD(end) };
    }},
    { label: 'Sonraki 8 hafta', get: () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 55);
      return { period_start: toYMD(start), period_end: toYMD(end) };
    }},
  ];

  const applyPreset = (preset: { get: () => { period_start: string; period_end: string } }) => {
    const { period_start, period_end } = preset.get();
    setAutoForm((f) => ({ ...f, period_start, period_end }));
  };

  const { estimatedSlots, estimatedWorkDays } = (() => {
    const s = autoForm.period_start;
    const e = autoForm.period_end;
    if (!s || !e || s > e) return { estimatedSlots: null as number | null, estimatedWorkDays: 0 };
    const start = new Date(s + 'T12:00:00');
    const end = new Date(e + 'T12:00:00');
    let days = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() >= 1 && d.getDay() <= 5) days++;
    }
    const shiftMul = Math.max(1, autoShifts.length);
    const slots = days * (autoForm.slots_per_day || 3) * shiftMul;
    return { estimatedSlots: slots, estimatedWorkDays: days };
  })();

  const autoGenerateError = (() => {
    if (!isAdmin) return null;
    if (!autoForm.period_start || !autoForm.period_end) return 'Başlangıç ve bitiş tarihi zorunludur.';
    if (autoForm.period_start > autoForm.period_end) return 'Başlangıç tarihi bitiş tarihinden büyük olamaz.';
    if (teachersLoading) return 'Öğretmen listesi yükleniyor…';
    if (teachers.length === 0) return 'Okulda aktif öğretmen bulunamadı. Önce kullanıcı ekleyin veya aktif edin.';
    if (estimatedSlots === 0) return 'Seçilen aralıkta (Pazartesi–Cuma) iş günü yok.';
    if (estimatedSlots != null && estimatedSlots > 3000) return 'Seçilen aralık çok büyük. Lütfen tarih aralığını daraltın.';
    return null;
  })();

  const fetchPlans = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<DutyPlan[]>('/duty/plans', { token });
      setPlans(Array.isArray(list) ? list : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchTeachers = useCallback(async () => {
    if (!token || !isAdmin) return;
    setTeachersLoading(true);
    try {
      const list = await apiFetch<UserItem[]>('/duty/teachers', { token });
      setTeachers(Array.isArray(list) ? list : []);
    } catch {
      setTeachers([]);
    } finally {
      setTeachersLoading(false);
    }
  }, [token, isAdmin]);

  const fetchDutySettings = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const data = await apiFetch<{ duty_education_mode?: 'single' | 'double' | null }>('/duty/school-default-times', { token });
      const mode = data?.duty_education_mode === 'double' ? 'double' : 'single';
      setDutyEducationMode(mode);
      setAutoShifts((prev) => {
        if (mode === 'double') {
          // İlk kurulumda iki vardiyayı seçili getir, kullanıcı isterse azaltabilir
          if (prev.length === 2) return prev;
          return ['morning', 'afternoon'];
        }
        return ['morning'];
      });
    } catch {
      setDutyEducationMode('single');
      setAutoShifts(['morning']);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (isAdmin) fetchTeachers();
  }, [isAdmin, fetchTeachers]);

  useEffect(() => {
    if (isAdmin) fetchDutySettings();
  }, [isAdmin, fetchDutySettings]);

  const fetchAreasTotal = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const list = await apiFetch<Array<{ slots_required?: number; slotsRequired?: number }>>('/duty/areas', { token });
      const total = Array.isArray(list)
        ? list.reduce((s, a) => s + Math.max(1, a.slots_required ?? a.slotsRequired ?? 1), 0)
        : 0;
      setAreasTotalSlots(total > 0 ? total : null);
    } catch {
      setAreasTotalSlots(null);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchAreasTotal();
  }, [isAdmin, fetchAreasTotal]);

  useEffect(() => {
    const minSlots = areasTotalSlots ?? 1;
    if (autoForm.slots_per_day < minSlots) {
      setAutoForm((f) => ({ ...f, slots_per_day: minSlots }));
    }
  }, [areasTotalSlots, autoForm.slots_per_day]);

  const fetchPrefsInRange = useCallback(async () => {
    if (!token || !isAdmin || !autoForm.period_start || !autoForm.period_end || autoForm.period_start > autoForm.period_end) {
      setPrefsInRange(null);
      return;
    }
    try {
      const list = await apiFetch<Array<{ status: string; admin_confirmed_at?: string | null }>>(
        `/duty/preferences?from=${autoForm.period_start}&to=${autoForm.period_end}`,
        { token }
      );
      const confirmed = list.filter((p) => p.status === 'prefer' && p.admin_confirmed_at).length;
      const unavail = list.filter((p) => p.status === 'unavailable').length;
      setPrefsInRange({ preferConfirmed: confirmed, unavailable: unavail });
    } catch {
      setPrefsInRange(null);
    }
  }, [token, isAdmin, autoForm.period_start, autoForm.period_end]);

  useEffect(() => {
    fetchPrefsInRange();
  }, [fetchPrefsInRange]);

  const handlePublish = async (id: string) => {
    if (!token) return;
    setPublishing(id);
    try {
      await apiFetch(`/duty/plans/${id}/publish`, { token, method: 'POST' });
      toast.success('Plan yayınlandı.');
      fetchPlans();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlama başarısız.');
    } finally {
      setPublishing(null);
    }
  };

  const downloadTemplate = () => {
    const today = new Date();
    const d1 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nextDay = new Date(today); nextDay.setDate(today.getDate() + 1);
    const d2 = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

    // ── Kılavuz Sayfası ──────────────────────────────────────────────────────
    const guideRows: string[][] = [
      ['NÖBET PLANI – EXCEL YÜKLEME KILAVUZU'],
      [''],
      ['SÜTUN AÇIKLAMALARI'],
      ['Tarih      → YYYY-AA-GG formatında (örn: 2025-09-15)'],
      ['Vardiya    → morning (sabah) veya afternoon (öğle)  ·  Tekli eğitimde: morning'],
      ['Öğretmen   → Sistemdeki tam ad soyad veya e-posta adresi'],
      ['Alan       → Nöbet yeri adı (Koridor, Bahçe, Giriş Kapısı vb.)  ·  OPSİYONEL'],
      ['Giriş Saati→ SS:DD formatında (örn: 08:00)  ·  OPSİYONEL'],
      ['Çıkış Saati→ SS:DD formatında (örn: 15:30)  ·  OPSİYONEL'],
      [''],
      ['ÖNEMLİ NOTLAR'],
      ['• Tarih sütununu METİN olarak girin (önüne tırnak koyun ya da hücre biçimini Metin yapın).'],
      ['• Öğretmen adı sistemdeki kullanıcı adı veya e-posta ile tam eşleşmeli.'],
      ['• Muaf ve müdür kadrosundaki öğretmenler sisteme eklenirse uyarı verilir.'],
      ['• "Nöbet Planı" sayfasındaki verileri doldurun; bu sayfayı silmeyin.'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 80 }];

    // ── Nöbet Planı Sayfası ──────────────────────────────────────────────────
    const COL_WIDTHS = [
      { wch: 14 }, // Tarih
      { wch: 12 }, // Vardiya
      { wch: 26 }, // Öğretmen
      { wch: 18 }, // Alan
      { wch: 13 }, // Giriş Saati
      { wch: 13 }, // Çıkış Saati
    ];
    const planRows: string[][] = [
      // # ile başlayan satırlar yükleme sırasında otomatik atlanır
      ['# NÖBET PLANI ŞABLONU – Aşağıdaki ÖRNEK satırları SİLİP kendi verilerinizi girin', '', '', '', '', ''],
      ['# Tarih: YYYY-AA-GG  |  Vardiya: morning veya afternoon  |  Öğretmen: sistemdeki ad veya e-posta', '', '', '', '', ''],
      ['# Örnek: 2025-09-15  morning  Ahmet Yılmaz  Koridor A  08:00  15:30', '', '', '', '', ''],
      // Başlık satırı (parser bu satırı okur – silmeyin)
      ['Tarih', 'Vardiya', 'Öğretmen', 'Alan', 'Giriş Saati', 'Çıkış Saati'],
      // Örnek veri satırları – bu satırları SİLİP kendi öğretmen adlarınızı yazın
      [d1, 'morning', 'Örnek Ad Soyad 1', 'Koridor A', '08:00', '15:30'],
      [d1, 'morning', 'Örnek Ad Soyad 2', 'Bahçe', '08:00', '15:30'],
      [d1, 'morning', 'Örnek Ad Soyad 3', 'Giriş Kapısı', '08:00', '15:30'],
      [d2, 'morning', 'Örnek Ad Soyad 4', 'Koridor B', '08:00', '15:30'],
      [d2, 'morning', 'Örnek Ad Soyad 5', 'Spor Salonu', '08:00', '15:30'],
    ];
    // Tüm hücreleri string olarak işaretleyerek tarih otomatik dönüşümünü önle
    const ws = XLSX.utils.aoa_to_sheet(planRows, { cellDates: false });
    ws['!cols'] = COL_WIDTHS;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Kılavuz');
    XLSX.utils.book_append_sheet(wb, ws, 'Nöbet Planı');
    XLSX.writeFile(wb, 'nobet-plani-sablon.xlsx');
    toast.success('Şablon indirildi.');
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let teacherList = teachers;
    if (teacherList.length === 0 && token) {
      try {
        const res = await apiFetch<UserItem[]>('/duty/teachers', { token });
        teacherList = Array.isArray(res) ? res : [];
        setTeachers(teacherList);
      } catch {
        toast.error('Öğretmen listesi yüklenemedi.');
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data || typeof data !== 'object') return;
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        // Şablonda "Kılavuz" sayfası varsa "Nöbet Planı" sayfasını seç, yoksa ilk sayfayı kullan
        const sheetName = wb.SheetNames.find((s) =>
          s.toLowerCase().includes('nöbet') || s.toLowerCase().includes('nobet') || s.toLowerCase().includes('plan')
        ) ?? wb.SheetNames[0];
        const firstSheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
        }) as (string | number | Date)[][];
        if (rows.length < 2) {
          toast.error('Excel dosyasında en az 1 veri satırı olmalı.');
          return;
        }
        // Şablon açıklama satırlarını (# ile başlayanları) geç; ilk gerçek başlık satırını bul
        let headerRowIdx = 0;
        for (let i = 0; i < rows.length; i++) {
          const fc = String((rows[i] ?? [])[0] ?? '').trim();
          if (!fc.startsWith('#') && fc !== '') { headerRowIdx = i; break; }
        }
        const headers = (rows[headerRowIdx] ?? []).map((h) => String(h ?? '').toLowerCase());
        const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
        const teacherIdx = headers.findIndex((h) =>
          h.includes('öğretmen') || h.includes('ogretmen') || h.includes('ögretmen') || h === 'teacher',
        );
        const areaIdx = headers.findIndex((h) => h.includes('alan') || h === 'area');
        const startIdx = headers.findIndex((h) =>
          h.includes('giriş') || h.includes('giris') || h.includes('başlangıç') || h === 'start',
        );
        const endIdx = headers.findIndex((h) =>
          h.includes('çıkış') || h.includes('cikis') || h.includes('bitiş') || h === 'end',
        );
        const shiftIdx = headers.findIndex((h) => h.includes('vardiya') || h.includes('shift') || h.includes('oturum'));
        const getCol = (row: (string | number | Date)[], i: number) => {
          if (i >= 0 && i < row.length) {
            const v = row[i];
            if (v instanceof Date) return toYMD(v);
            if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
            return String(v ?? '').trim();
          }
          return '';
        };
        const parseShift = (v: unknown): 'morning' | 'afternoon' => {
          const s = String(v ?? '').trim().toLowerCase();
          if (!s) return 'morning';
          if (s === '2' || s.includes('öğle') || s.includes('ogle') || s.includes('ikindi') || s.includes('afternoon')) return 'afternoon';
          return 'morning';
        };
        const parsed: ParsedRow[] = [];
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] ?? [];
          // Şablon açıklama satırlarını atla (# ile başlayanlar veya tamamen boş)
          const firstCell = String(row[0] ?? '').trim();
          if (firstCell.startsWith('#') || row.every((c) => String(c ?? '').trim() === '')) continue;
          const dateRaw = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
          const shiftRaw = shiftIdx >= 0 ? getCol(row, shiftIdx) : '';
          const shift = parseShift(shiftRaw);
          const teacherInput = teacherIdx >= 0 ? getCol(row, teacherIdx) : getCol(row, 2);
          const area = areaIdx >= 0 ? getCol(row, areaIdx) : getCol(row, 3);
          const startVal = startIdx >= 0 ? row[startIdx] : row[4];
          const endVal = endIdx >= 0 ? row[endIdx] : row[5];
          const slot_start_time = normalizeTime(startVal);
          const slot_end_time = normalizeTime(endVal);
          const date = dateRaw.includes('-') && dateRaw.length >= 10 ? dateRaw.slice(0, 10) : dateRaw;
          if (!date) continue;
          const match = matchTeacher(teacherInput, teacherList);
          if ('user_id' in match) {
            parsed.push({
              date,
              shift,
              teacherInput,
              area,
              slot_start_time,
              slot_end_time,
              user_id: match.user_id,
              matchedName: match.matchedName,
            });
          } else {
            parsed.push({
              date,
              shift,
              teacherInput,
              area,
              slot_start_time,
              slot_end_time,
              user_id: null,
              matchedName: null,
              error: match.error,
            });
          }
        }
        setParsedRows(parsed);
        const ok = parsed.filter((p) => p.user_id).length;
        const err = parsed.filter((p) => !p.user_id).length;
        const valid = parsed.filter((p) => p.user_id);
        const countByUser = new Map<string, number>();
        for (const p of valid) {
          if (p.user_id) countByUser.set(p.user_id, (countByUser.get(p.user_id) ?? 0) + 1);
        }
        const counts = [...countByUser.values()];
        const minCount = counts.length ? Math.min(...counts) : 0;
        const maxCount = counts.length ? Math.max(...counts) : 0;
        const diff = maxCount - minCount;
        toast.success(`${ok} satır eşleşti${err > 0 ? `, ${err} satır hatalı` : ''}.`);
        if (diff > 3 && counts.length > 1) {
          toast.warning(`Dağılım dengesiz: en az ${minCount}, en çok ${maxCount} nöbet. Adil dağılım için planları gözden geçirin.`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Excel okunamadı.');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const PLAN_EXPORT_COL_WIDTHS = [
    { wch: 14 }, // Tarih
    { wch: 12 }, // Vardiya
    { wch: 26 }, // Öğretmen
    { wch: 18 }, // Alan
    { wch: 13 }, // Giriş Saati
    { wch: 13 }, // Çıkış Saati
  ];

  const SHIFT_LABELS: Record<string, string> = { morning: 'Sabah', afternoon: 'Öğle', '': '' };

  const handleExportPlan = async (planId: string) => {
    if (!token) return;
    setExportingId(planId);
    try {
      const plan = await apiFetch<{
        id: string;
        version: string | null;
        slots: Array<{
          date: string;
          shift?: string | null;
          area_name: string | null;
          slot_start_time?: string | null;
          slot_end_time?: string | null;
          user?: { display_name: string | null; email: string };
        }>;
      }>(`/duty/plans/${planId}`, { token });
      const slots = plan?.slots ?? [];
      if (slots.length === 0) {
        toast.error('Bu planda nöbet kaydı yok.');
        return;
      }
      const rows: string[][] = [
        ['Tarih', 'Vardiya', 'Öğretmen', 'Alan', 'Giriş Saati', 'Çıkış Saati'],
        ...slots.map((s) => [
          s.date,
          SHIFT_LABELS[s.shift ?? ''] ?? (s.shift ?? ''),
          s.user?.display_name || s.user?.email || '—',
          s.area_name || '',
          s.slot_start_time || '',
          s.slot_end_time || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });
      ws['!cols'] = PLAN_EXPORT_COL_WIDTHS;
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      const wb = XLSX.utils.book_new();
      const safeVersion = (plan.version ?? 'plan').replace(/[^\w\-]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, safeVersion.slice(0, 31));
      XLSX.writeFile(wb, `nobet-plani-${safeVersion}.xlsx`);
      toast.success('Excel indirildi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi.');
    } finally {
      setExportingId(null);
    }
  };

  const handleCreateFromExcel = async () => {
    if (!token || !parsedRows) return;
    const valid = parsedRows.filter((p) => p.user_id);
    if (valid.length === 0) {
      setCreateError('Oluşturulacak geçerli satır yok. Öğretmen eşleşmesini kontrol edin.');
      toast.error('Öğretmen eşleşmesi yapılamayan satırlar var.');
      return;
    }
    setCreateError(null);
    setUploading(true);
    try {
      const slots = valid.map((p) => ({
        date: p.date,
        shift: p.shift,
        user_id: p.user_id!,
        area_name: p.area || null,
        slot_start_time: p.slot_start_time || null,
        slot_end_time: p.slot_end_time || null,
      }));
      const periodStart = valid.reduce((a, p) => (p.date < a ? p.date : a), valid[0]!.date);
      const periodEnd = valid.reduce((a, p) => (p.date > a ? p.date : a), valid[0]!.date);
      await apiFetch('/duty/plans', {
        token,
        method: 'POST',
        body: JSON.stringify({
          version: `Excel ${new Date().toLocaleDateString('tr-TR')}`,
          period_start: periodStart,
          period_end: periodEnd,
          slots,
        }),
      });
      toast.success(`${valid.length} nöbet kaydı ile taslak plan oluşturuldu. Planlar listesinden yayınlayabilirsiniz.`);
      setParsedRows(null);
      fetchPlans();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Plan oluşturulamadı.';
      const details = (e as { details?: Record<string, unknown> })?.details;
      const invalidIds = details?.invalid_user_ids as string[] | undefined;
      const extra = invalidIds?.length
        ? ` (${invalidIds.length} öğretmen okulda kayıtlı değil veya atanamaz)`
        : '';
      setCreateError(msg + extra);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSoftDelete = async (planId: string) => {
    if (!token) return;
    setDeletingId(planId);
    try {
      await apiFetch(`/duty/plans/${planId}/soft-delete`, { token, method: 'POST' });
      toast.success('Plan silindi. İstatistikler korunur.');
      fetchPlans();
    } catch {
      toast.error('Plan silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!token || selectedPlanIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await apiFetch<{ deleted_count: number }>('/duty/plans/bulk-delete', {
        token,
        method: 'POST',
        body: JSON.stringify({ plan_ids: [...selectedPlanIds] }),
      });
      toast.success(`${res?.deleted_count ?? selectedPlanIds.size} plan silindi. İstatistikler korunur.`);
      setSelectedPlanIds(new Set());
      setBulkDeleteOpen(false);
      fetchPlans();
    } catch {
      toast.error('Planlar silinemedi.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const togglePlanSelection = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAutoGenerate = async () => {
    if (!token) return;
    if (autoGenerateError) {
      toast.error(autoGenerateError);
      return;
    }
    setAutoGenerating(true);
    setAutoGenWarning(null);
    setLastCreatedPlanId(null);
    try {
      type AutoGenResult = {
        id?: string;
        distribution?: { user_id: string; display_name: string | null; email: string; weekday_labels: Record<string, number>; total: number }[];
        warning?: string | null;
        priority_area_extended?: string | null;
      };
      const result = await apiFetch<AutoGenResult>('/duty/plans/auto-generate', {
        token,
        method: 'POST',
        body: JSON.stringify({
          period_start: autoForm.period_start,
          period_end: autoForm.period_end,
          slots_per_day: autoForm.slots_per_day || 3,
          version: autoForm.version?.trim() || undefined,
          shifts: dutyEducationMode === 'double' ? autoShifts : ['morning'],
          duty_days_per_week: dutyDaysPerWeek,
          max_per_week: autoForm.max_per_week > 0 ? autoForm.max_per_week : undefined,
          prevent_consecutive_days: ruleToggles.prevent_consecutive_days,
          respect_preferences: ruleToggles.respect_preferences,
          enable_weekday_balance: ruleToggles.enable_weekday_balance,
          prefer_fewer_lessons_day: ruleToggles.prefer_fewer_lessons_day,
          same_day_each_week: true,
          max_per_month: ruleToggles.max_per_month > 0 ? ruleToggles.max_per_month : undefined,
          min_days_between: ruleToggles.min_days_between > 0 ? ruleToggles.min_days_between : undefined,
          rotate_area_by_week: rotateAreaByWeek || undefined,
        }),
      });
      if (result?.id) setLastCreatedPlanId(result.id);
      if (result?.warning) setAutoGenWarning(result.warning);
      setPriorityAreaExtendedMsg(result?.priority_area_extended ?? null);
      toast.success('Taslak plan oluşturuldu. Dağıtım raporunu inceleyip planı el ile düzenleyebilirsiniz.');
      setAutoForm((f) => ({ ...f, period_start: '', period_end: '', version: '' }));
      fetchPlans();
      if (result?.distribution && result.distribution.length > 0) {
        setDistributionReport(result.distribution);
        setDistributionReportOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Plan oluşturulamadı.');
    } finally {
      setAutoGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/duty"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Planlama
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Nöbet Planları</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Oluşturulan nöbet planlarının listesi. Taslak planları yayınlayarak okulda görünür hale getirebilirsiniz.
      </p>

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Tek Tuşla Otomatik Görevlendirme</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Öğretmen istekleri (Tercih ediyorum / Dikkate alındı) planlamada öncelik alır. Her güne nöbet yerleri toplamı kadar nöbetçi atanır; oluşan planı takvimden sürükleyerek düzenleyebilirsiniz.
            </p>
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span className="text-sm font-semibold">Seçim – Tarih ve haftalık gün</span>
              </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-sm font-semibold">Öğretmene haftada kaç gün nöbet verilsin?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duty_days_per_week"
                    checked={dutyDaysPerWeek === 1}
                    onChange={() => setDutyDaysPerWeek(1)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">1 gün</span>
                  <span className="text-xs text-muted-foreground">Her hafta hep aynı 1 güne nöbet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duty_days_per_week"
                    checked={dutyDaysPerWeek === 2}
                    onChange={() => setDutyDaysPerWeek(2)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">2 gün</span>
                  <span className="text-xs text-muted-foreground">Her hafta hep aynı 2 güne nöbet</span>
                </label>
              </div>
            </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Başlangıç tarihi</Label>
                  <Input type="date" value={autoForm.period_start} onChange={(e) => setAutoForm((f) => ({ ...f, period_start: e.target.value }))} className="w-full" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bitiş tarihi</Label>
                  <Input type="date" value={autoForm.period_end} onChange={(e) => setAutoForm((f) => ({ ...f, period_end: e.target.value }))} className="w-full" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)}>
                  {preset.label}
                </Button>
              ))}
              </div>
              {dutyEducationMode === 'double' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vardiya</Label>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={autoShifts.includes('morning')} onChange={(e) => { const next = new Set(autoShifts); if (e.target.checked) next.add('morning'); else next.delete('morning'); if (next.size === 0) return; setAutoShifts([...next] as ('morning' | 'afternoon')[]); }} className="accent-primary" />
                      Sabah
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={autoShifts.includes('afternoon')} onChange={(e) => { const next = new Set(autoShifts); if (e.target.checked) next.add('afternoon'); else next.delete('afternoon'); if (next.size === 0) return; setAutoShifts([...next] as ('morning' | 'afternoon')[]); }} className="accent-primary" />
                      Öğle
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span className="text-sm font-semibold">Veri girişi</span>
              </div>
              {areasTotalSlots != null && areasTotalSlots > 0 && (
                <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                  <strong>Nöbet yerleri toplamı</strong> (Yerler sayfasındaki nöbetçi sayıları): <strong>{areasTotalSlots} nöbetçi/gün</strong>. Sistem günlük slot sayısını en az bu kadar kullanır; aşağıdan artırabilirsiniz.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Günlük atanacak slot sayısı</Label>
                  <Input
                    type="number"
                    min={areasTotalSlots ?? 1}
                    max={10}
                    value={autoForm.slots_per_day}
                    onChange={(e) => setAutoForm((f) => ({ ...f, slots_per_day: parseInt(e.target.value, 10) || (areasTotalSlots ?? 1) }))}
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">En az {areasTotalSlots ?? 1} (nöbet yerleri toplamı); daha fazla yazarsanız o kullanılır.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Öğretmen başına haftalık nöbet</Label>
                  <p className="text-sm font-medium text-foreground">
                    {dutyDaysPerWeek === 1 ? '1 nöbet/hafta' : '2 nöbet/hafta'} — yukarıdaki &quot;{dutyDaysPerWeek} gün&quot; seçimine göre otomatik.
                  </p>
                  <p className="text-xs text-muted-foreground">Ayrıca bir üst sınır yok; tek kaynak &quot;1 gün&quot; / &quot;2 gün&quot; seçimidir.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Plan adı (opsiyonel)</Label>
                  <Input value={autoForm.version} onChange={(e) => setAutoForm((f) => ({ ...f, version: e.target.value }))} className="w-56" placeholder="Örn: Mart 2026" />
                </div>
              </div>
            </div>

            {estimatedSlots != null && (
              <div className="space-y-2">
                <div className="rounded-lg border border-muted bg-muted/30 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                    <span><strong>İş günü:</strong> {estimatedWorkDays} gün</span>
                    <span><strong>Hedef slot:</strong> ~{estimatedSlots}</span>
                    <span><strong>Öğretmen:</strong> {teachers.length}</span>
                    <span><strong>Haftada gün:</strong> {dutyDaysPerWeek} (aynı gün(ler))</span>
                    {dutyEducationMode === 'double' && (
                      <span className="text-muted-foreground">
                        Vardiya: {autoShifts.includes('morning') ? 'Sabah' : ''}
                        {autoShifts.includes('morning') && autoShifts.includes('afternoon') ? ' + ' : ''}
                        {autoShifts.includes('afternoon') ? 'Öğle' : ''}
                      </span>
                    )}
                  </div>
                  {prefsInRange != null && (prefsInRange.preferConfirmed > 0 || prefsInRange.unavailable > 0) && (
                    <p className="mt-2 pt-2 border-t border-muted text-muted-foreground">
                      Bu aralıkta: <strong className="text-emerald-600 dark:text-emerald-400">{prefsInRange.preferConfirmed}</strong> onaylı tercih
                      {prefsInRange.unavailable > 0 && (
                        <> · <strong className="text-amber-600 dark:text-amber-400">{prefsInRange.unavailable}</strong> müsait değil</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
            {autoGenerateError && (autoForm.period_start || autoForm.period_end) && (
              <Alert variant="warning" message={autoGenerateError} />
            )}
            {autoGenWarning && (
              <Alert variant="warning" message={autoGenWarning} />
            )}
            {estimatedSlots != null && estimatedWorkDays > 0 && teachers.length > 0 && (() => {
              const numWeeks = Math.ceil(estimatedWorkDays / 5) || 1;
              const capacity = teachers.length * dutyDaysPerWeek * numWeeks;
              const required = estimatedSlots;
              const ok = capacity >= required;
              return (
                <p className={cn('text-sm', ok ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>
                  Kapasite: {teachers.length} öğretmen × {dutyDaysPerWeek} gün/hafta × ~{numWeeks} hafta = ~{capacity} nöbet-gün.
                  Gerekli: ~{required} slot. {!ok && 'Öğretmen veya gün sayısı yetersiz olabilir; plan oluşturulduktan sonra el ile düzenleyebilirsiniz.'}
                </p>
              );
            })()}

            <p className="text-xs text-muted-foreground">
              Pazartesi–Cuma; tatil atlanır. Müsait değil tercihleri engellenir. <Link href="/duty/tercihler" className="underline">Tercihler</Link> · <Link href="/work-calendar" className="underline">Çalışma Takvimi</Link> · <Link href="/duty/yerler" className="underline">Nöbet Yerleri</Link>
            </p>

            {/* Kurallar – Tercihler vurgulu */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-primary" checked={ruleToggles.respect_preferences} onChange={(e) => setRuleToggles((r) => ({ ...r, respect_preferences: e.target.checked }))} />
                <div>
                  <p className="text-sm font-semibold text-primary">Öğretmen isteklerini (tercihleri) dikkate al</p>
                  <p className="text-xs text-muted-foreground">&quot;Tercih ediyorum&quot; günleri öncelik alır; &quot;Dikkate alındı&quot; en yüksek önceliğe sahiptir.</p>
                </div>
              </label>
            </div>

            {/* Gelişmiş Kurallar akordiyon paneli */}
            <div className="border rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
                onClick={() => setAdvancedRulesOpen((o) => !o)}
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="size-4 text-muted-foreground" />
                  Gelişmiş Kurallar
                  <span className="text-xs text-muted-foreground font-normal">(opsiyonel)</span>
                </span>
                {advancedRulesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {advancedRulesOpen && (
                <div className="px-4 py-4 space-y-4 bg-background">
                  <p className="text-xs text-muted-foreground">
                    İlk nöbet dağıtımında uygulanacak kuralları özelleştirin. Devre dışı bırakılan kurallar görmezden gelinir.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: 'prevent_consecutive_days' as const, label: 'Ardışık gün önleme', desc: 'Aynı öğretmene iki üst üste gün nöbet vermez.' },
                      { key: 'enable_weekday_balance' as const, label: 'Haftaiçi gün dengesi', desc: 'Her öğretmen farklı haftaiçi günlerine dağıtılır. same_day_each_week etkinse devre dışıdır.' },
                      { key: 'prefer_fewer_lessons_day' as const, label: 'MEB 91/a: Az dersli gün', desc: 'Dersi az olan güne nöbet tercih edilir.' },
                      { key: 'same_day_each_week' as const, label: 'Her hafta aynı güne nöbet ver', desc: 'Yukarıda "1 gün" veya "2 gün" seçildiğinde otomatik uygulanır. Öğretmen atandığı gün(ler)de her hafta nöbet tutar.' },
                    ].map(({ key, label, desc }) => (
                      <label
                        key={key}
                        className={cn(
                          'flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors',
                          key === 'same_day_each_week' && 'border-primary/40 bg-primary/5',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={ruleToggles[key]}
                          onChange={(e) => setRuleToggles((r) => ({ ...r, [key]: e.target.checked }))}
                        />
                        <div>
                          <p className={cn('text-sm font-medium', key === 'same_day_each_week' && 'text-primary')}>{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-6 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs" title="0 = sınırsız">
                        Aylık maks. nöbet <span className="text-muted-foreground">(0=∞)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={ruleToggles.max_per_month}
                        onChange={(e) => setRuleToggles((r) => ({ ...r, max_per_month: parseInt(e.target.value) || 0 }))}
                        className="w-24"
                        placeholder="0=∞"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" title="0 = devre dışı">
                        Nöbetler arası min. gün <span className="text-muted-foreground">(0=kapalı)</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={ruleToggles.min_days_between}
                        onChange={(e) => setRuleToggles((r) => ({ ...r, min_days_between: parseInt(e.target.value) || 0 }))}
                        className="w-24"
                        placeholder="0=kapalı"
                      />
                    </div>
                  </div>
                  <label
                    className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors border-dashed border-primary/30"
                    title="İlk hafta şablon, sonraki haftalarda nöbet yerleri haftalık kaydırılır"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={rotateAreaByWeek}
                      onChange={(e) => setRotateAreaByWeek(e.target.checked)}
                    />
                    <div>
                      <p className="text-sm font-medium">Dönerli liste (Excel benzeri)</p>
                      <p className="text-xs text-muted-foreground">
                        İlk hafta şablon; sonraki haftalarda nöbet yerleri bir kaydırılır. Günler aynı kalır, yerler haftalık rotasyon yapar.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleAutoGenerate} disabled={autoGenerating || !!autoGenerateError}>
                {autoGenerating ? 'Oluşturuluyor…' : 'Otomatik Plan Oluştur'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium text-foreground">Excel ile Plan Yükle</h3>
            <p className="text-sm text-muted-foreground">
              Tarih, Vardiya (Sabah/Öğle), Öğretmen (e-posta veya ad soyad), Alan, Giriş Saati, Çıkış Saati (HH:mm) sütunlarına
              sahip Excel dosyası yükleyin. Öğretmenler okul kullanıcı listesiyle eşleştirilir. Vardiya ve saat sütunları opsiyoneldir.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" />
                Şablon İndir
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="size-4" />
                Excel Yükle
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={handleExcelUpload}
                />
              </label>
            </div>
            {parsedRows && (
              <div className="space-y-3">
                {createError && (
                  <Alert variant="error" message={createError} />
                )}
                {(() => {
                  const valid = parsedRows.filter((p) => p.user_id);
                  const countByUser = new Map<string, number>();
                  for (const p of valid) {
                    if (p.user_id) countByUser.set(p.user_id, (countByUser.get(p.user_id) ?? 0) + 1);
                  }
                  const counts = [...countByUser.values()];
                  const minC = counts.length ? Math.min(...counts) : 0;
                  const maxC = counts.length ? Math.max(...counts) : 0;
                  const unbalanced = counts.length > 1 && maxC - minC > 3;
                  return unbalanced ? (
                    <Alert
                      variant="warning"
                      message={`Dağılım dengesiz: en az ${minC}, en çok ${maxC} nöbet. Taslak oluşturabilirsiniz; adil dağılım için Toplam Görevlendirme sayfasından kontrol edin.`}
                    />
                  ) : null;
                })()}
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Tarih</th>
                        <th className="px-3 py-2 text-left">Vardiya</th>
                        <th className="px-3 py-2 text-left">Girilen Öğretmen</th>
                        <th className="px-3 py-2 text-left">Eşleşen</th>
                        <th className="px-3 py-2 text-left">Alan</th>
                        <th className="px-3 py-2 text-left">Giriş</th>
                        <th className="px-3 py-2 text-left">Çıkış</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={cn('border-t', !row.user_id && 'bg-rose-50/50 dark:bg-rose-950/20')}>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.shift === 'afternoon' ? 'Öğle' : 'Sabah'}</td>
                          <td className="px-3 py-2">{row.teacherInput || '—'}</td>
                          <td className="px-3 py-2">{row.matchedName || '—'}</td>
                          <td className="px-3 py-2">{row.area || '—'}</td>
                          <td className="px-3 py-2">{row.slot_start_time || '—'}</td>
                          <td className="px-3 py-2">{row.slot_end_time || '—'}</td>
                          <td className="px-3 py-2">
                            {row.user_id ? (
                              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">{row.error ?? 'Hata'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreateFromExcel}
                    disabled={uploading || parsedRows.filter((p) => p.user_id).length === 0}
                  >
                    {uploading ? 'Oluşturuluyor…' : 'Taslak Plan Oluştur'}
                  </Button>
                  <Button variant="outline" onClick={() => { setParsedRows(null); setCreateError(null); }}>
                    İptal
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {parsedRows.filter((p) => p.user_id).length} geçerli / {parsedRows.length} satır
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !plans.length ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-10 text-muted-foreground" />}
            title="Henüz plan yok"
            description="Nöbet sayfasından yeni plan oluşturabilir veya Excel ile yükleyebilirsiniz."
            action={
              <Link href="/duty">
                <Button>Planlama Sayfasına Git</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-0">
            {isAdmin && selectedPlanIds.size > 0 && (
              <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">
                  {selectedPlanIds.size} plan seçildi
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Seçilenleri sil
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanIds(new Set())}>
                  Seçimi temizle
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60">
                    {isAdmin && <th className="w-10 px-4 py-3.5">Seç</th>}
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Versiyon / Açıklama</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Dönem</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Durum</th>
                    <th className="px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide">Oluşturulma</th>
                    <th className="px-4 py-3.5 text-right text-sm font-semibold uppercase tracking-wide">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.has(plan.id)}
                            onChange={() => togglePlanSelection(plan.id)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/duty/planlar/${plan.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {plan.version || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.period_start || plan.period_end
                          ? `${formatDate(plan.period_start)} – ${formatDate(plan.period_end)}`
                          : plan.academic_year || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            plan.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                          )}
                        >
                          {plan.status === 'published' ? 'Yayınlandı' : 'Taslak'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(plan.created_at?.slice(0, 10))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportPlan(plan.id)}
                            disabled={!!exportingId}
                            title="Excel indir"
                          >
                            <FileDown className="size-4" />
                          </Button>
                          {isAdmin && plan.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePublish(plan.id)}
                              disabled={!!publishing}
                            >
                              <Send className="size-4" />
                              Yayınla
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => handleSoftDelete(plan.id)}
                              disabled={!!deletingId}
                              title="Planı sil (istatistikler korunur)"
                            >
                              {deletingId === plan.id ? (
                                <LoadingSpinner className="size-4" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toplu silme onay modal */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planları sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedPlanIds.size} plan silinecek. Planlar listeden kaldırılır ancak görevlendirme istatistikleri korunur.
            Devam etmek istiyor musunuz?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <LoadingSpinner className="size-4" /> : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dağıtım Raporu Modal */}
      <Dialog open={distributionReportOpen} onOpenChange={(open) => { setDistributionReportOpen(open); if (!open) { setAutoGenWarning(null); setPriorityAreaExtendedMsg(null); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              Nöbet Dağıtım Raporu
            </DialogTitle>
          </DialogHeader>
          {priorityAreaExtendedMsg && (
            <Alert variant="info" message={priorityAreaExtendedMsg} className="mb-4" />
          )}
          {autoGenWarning && (
            <Alert variant="warning" message={autoGenWarning} className="mb-4" />
          )}
          {lastCreatedPlanId && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link href={`/duty/planlar/${lastCreatedPlanId}`}>
                <Button size="sm">Planı düzenle (el ile değiştir)</Button>
              </Link>
              <span className="text-xs text-muted-foreground">Slotları değiştirip, öğretmen atayıp kaldırabilirsiniz.</span>
            </div>
          )}
          {distributionReport && distributionReport.length > 0 && (() => {
            const allDays = [...new Set(distributionReport.flatMap((r) => Object.keys(r.weekday_labels)))];
            const DAY_ORDER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
            const days = DAY_ORDER.filter((d) => allDays.includes(d));
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Plan oluşturulduktan sonra öğretmen bazlı haftalık nöbet dağılımı aşağıdadır.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50">Öğretmen</th>
                        {days.map((d) => (
                          <th key={d} className="px-3 py-2 text-center font-medium min-w-[60px]">{d}</th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold bg-primary/10 text-primary">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distributionReport.map((r) => (
                        <tr key={r.user_id} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-medium sticky left-0 bg-background">
                            {r.display_name || r.email}
                          </td>
                          {days.map((d) => (
                            <td key={d} className="px-3 py-2 text-center">
                              {r.weekday_labels[d] ? (
                                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                                  {r.weekday_labels[d]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-bold text-primary">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/30">
                      <tr>
                        <td className="px-3 py-2 font-semibold">Toplam</td>
                        {days.map((d) => {
                          const total = distributionReport.reduce((sum, r) => sum + (r.weekday_labels[d] ?? 0), 0);
                          return (
                            <td key={d} className="px-3 py-2 text-center font-semibold">{total}</td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-primary">
                          {distributionReport.reduce((s, r) => s + r.total, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            {lastCreatedPlanId && (
              <Link href={`/duty/planlar/${lastCreatedPlanId}`}>
                <Button>Planı düzenle</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => setDistributionReportOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
