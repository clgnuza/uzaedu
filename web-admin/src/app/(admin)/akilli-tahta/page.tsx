'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { DisplayModuleShell, DisplayModuleTeacherLane } from '@/components/display-modules/display-module-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Monitor,
  Plus,
  UserPlus,
  UserMinus,
  Users,
  LayoutDashboard,
  Activity,
  Settings,
  Tv,
  MapPin,
  Search,
  PowerOff,
  Filter,
  Table2,
  BarChart3,
  KeyRound,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Device, AuthorizedTeacher, Session, Status, SmartBoardAuditLog } from './types';
import { TeacherDeviceCard } from './components/TeacherDeviceCard';
import { DeviceTable } from './components/DeviceTable';
import { SessionTable } from './components/SessionTable';
import { EditDeviceDialog } from './components/EditDeviceDialog';
import { AddDeviceDialog } from './components/AddDeviceDialog';
import { DeviceScheduleDialog } from './components/DeviceScheduleDialog';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { SmartBoardUsagePanel } from './components/SmartBoardUsagePanel';
import { SmartBoardSettings } from './components/SmartBoardSettings';
import { TeacherSmartBoardHero } from './components/TeacherSmartBoardHero';
import { SmartBoardInstallGuide } from './components/SmartBoardInstallGuide';
import { SmartBoardSetupWizard } from './components/SmartBoardSetupWizard';
import { SMART_BOARD_SCHOOL_SETUP_NOTE, SMART_BOARD_SCHOOL_SETUP_STEPS } from '@/lib/smart-board-school-setup-steps';
import { SetupProgressCard } from './components/SetupProgressCard';
import { TeacherQrClaimPanel } from './components/TeacherQrClaimPanel';
import { TeacherActiveSessionBar } from './components/TeacherActiveSessionBar';
import { TeacherQrStatusBanner } from './components/TeacherQrStatusBanner';
import { TeacherSmartBoardStickyBar } from './components/TeacherSmartBoardStickyBar';
import { PwaInstallHint } from './components/PwaInstallHint';
import { TeacherPendingQrBanner } from './components/TeacherPendingQrBanner';
import { TeacherSmartBoardUsageCard } from './components/TeacherSmartBoardUsageCard';
import { SmartBoardPwaRegister } from '@/components/smart-board-pwa-register';
import type { SmartBoardQrClaimParams } from '@/lib/smart-board-qr-parse';
import { postClassroomBoardSync } from '@/lib/smart-board-classroom-sync';
import { smartBoardConnectErrorMessage } from '@/lib/smart-board-connect-messages';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { cn } from '@/lib/utils';
import { compareSmartBoardDevices, sortSmartBoardDevices } from '@/lib/smart-board-device-sort';
import {
  getSmartBoardAuditActionLabel,
  getSmartBoardAuditMetaText,
} from '@/lib/smart-board-audit-labels';

function buildSchoolsQuery(params: { limit: number; city?: string; district?: string }): string {
  const u = new URLSearchParams();
  u.set('page', '1');
  u.set('limit', String(params.limit));
  if (params.city?.trim()) u.set('city', params.city.trim());
  if (params.district?.trim()) u.set('district', params.district.trim());
  return u.toString();
}

/** Sekme accent renkleri – kullanım kolaylığı ve görsel hiyerarşi */
const ADMIN_TABS = [
  { id: 'genel-bakis', label: 'Genel Bakış', shortLabel: 'Genel', icon: LayoutDashboard, accent: 'primary' },
  { id: 'cihazlar', label: 'Cihazlar', shortLabel: 'Cihaz', icon: Monitor, accent: 'teal' },
  { id: 'yerlesim', label: 'Yerleşim', shortLabel: 'Yer', icon: MapPin, accent: 'amber' },
  { id: 'yetkiler', label: 'Yetkili Öğretmenler', shortLabel: 'Yetki', icon: Users, accent: 'violet' },
  { id: 'oturumlar', label: 'Oturumlar', shortLabel: 'Oturum', icon: Activity, accent: 'emerald' },
  { id: 'istatistikler', label: 'İstatistikler', shortLabel: 'İstat.', icon: BarChart3, accent: 'rose' },
  { id: 'kurulum', label: 'Kurulum', shortLabel: 'Kurulum', icon: Wrench, accent: 'teal' },
  { id: 'denetim', label: 'Denetim', shortLabel: 'Log', icon: ClipboardList, accent: 'slate' },
  { id: 'ayarlar', label: 'Ayarlar', shortLabel: 'Ayar', icon: Settings, accent: 'slate' },
] as const;

function getTabActiveStyles(accent: string): string {
  const map: Record<string, string> = {
    primary:
      'bg-primary/14 text-primary border-primary/35 shadow-sm ring-2 ring-primary/25 dark:bg-primary/20',
    teal: 'bg-teal-500/14 text-teal-800 border-teal-500/35 shadow-sm ring-2 ring-teal-500/20 dark:bg-teal-400/15 dark:text-teal-200',
    amber:
      'bg-amber-500/14 text-amber-900 border-amber-500/35 shadow-sm ring-2 ring-amber-500/20 dark:bg-amber-400/15 dark:text-amber-100',
    violet:
      'bg-violet-500/14 text-violet-900 border-violet-500/35 shadow-sm ring-2 ring-violet-500/20 dark:bg-violet-400/15 dark:text-violet-100',
    emerald:
      'bg-emerald-500/14 text-emerald-900 border-emerald-500/35 shadow-sm ring-2 ring-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-100',
    slate:
      'bg-slate-500/14 text-slate-800 border-slate-500/35 shadow-sm ring-2 ring-slate-400/25 dark:bg-slate-400/15 dark:text-slate-100',
    rose: 'bg-rose-500/14 text-rose-900 border-rose-500/35 shadow-sm ring-2 ring-rose-500/20 dark:bg-rose-400/15 dark:text-rose-100',
  };
  return map[accent] ?? map.primary;
}

const DEFAULT_ADMIN_TAB = 'genel-bakis';

export default function AkilliTahtaPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { token, me } = useAuth();
  const isTeacher = me?.role === 'teacher';
  const isSuperadmin = me?.role === 'superadmin';
  const adminTab = (searchParams.get('tab') as (typeof ADMIN_TABS)[number]['id']) || DEFAULT_ADMIN_TAB;
  const qrSchoolId = searchParams.get('qr_school')?.trim() ?? '';
  const qrDeviceId = searchParams.get('qr_device')?.trim() ?? '';
  const qrSessionId = searchParams.get('qr_session')?.trim() ?? '';
  const qrCode = searchParams.get('qr_code')?.trim() ?? '';
  const openQrFocus = searchParams.get('open_qr') === '1';

  const [schoolId, setSchoolId] = useState<string | null>(me?.school_id ?? null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const qrDeviceHint = useMemo(() => {
    if (!qrDeviceId) return null;
    const d = devices.find((x) => x.id === qrDeviceId);
    return d ? (d.classSection ?? d.name) : null;
  }, [qrDeviceId, devices]);
  const [authorizedTeachers, setAuthorizedTeachers] = useState<AuthorizedTeacher[]>([]);
  const [sessionsToday, setSessionsToday] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [scheduleDevice, setScheduleDevice] = useState<Device | null>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [classSections, setClassSections] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<{ label: string; url: string }[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherFilterToday, setTeacherFilterToday] = useState(false);
  const [yetkilerSearch, setYetkilerSearch] = useState('');
  const [usbPinFor, setUsbPinFor] = useState<AuthorizedTeacher | null>(null);
  const [usbPinInput, setUsbPinInput] = useState('');
  const [usbPinSaving, setUsbPinSaving] = useState(false);
  const [otpCodesFor, setOtpCodesFor] = useState<AuthorizedTeacher | null>(null);
  const [otpCodes, setOtpCodes] = useState<string[]>([]);
  const [otpSaving, setOtpSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SmartBoardAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [teacherDeviceSort, setTeacherDeviceSort] = useState<'name' | 'online'>('name');
  const [schoolFilters, setSchoolFilters] = useState({ city: '', district: '' });
  const schoolFiltersRef = useRef(schoolFilters);
  schoolFiltersRef.current = schoolFilters;
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterDistricts, setFilterDistricts] = useState<string[]>([]);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const qrClaimAttemptedRef = useRef(false);
  const [qrClaimStatus, setQrClaimStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [qrClaimMessage, setQrClaimMessage] = useState<string>('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrClaimBusy, setQrClaimBusy] = useState(false);
  const [bulkActionReport, setBulkActionReport] = useState<{
    action: 'open' | 'lock' | 'close';
    results: Array<{ device_id: string; device_name: string | null; status: 'ok' | 'skipped'; message: string }>;
  } | null>(null);

  const effectiveSchoolId = schoolId || me?.school_id;
  const isSchoolAdmin = me?.role === 'school_admin';
  const canView = !isTeacher && effectiveSchoolId; // school_admin + superadmin
  const canManage = isSchoolAdmin && !!effectiveSchoolId; // sadece okul yöneticisi tahta ekler, yetki verir, sonlandırır
  const floorPlacedCount = useMemo(
    () => devices.filter((d) => d.planPositionX != null || d.planPositionY != null).length,
    [devices],
  );

  const deviceNameById = useMemo(
    () =>
      new Map(
        devices.map((d) => [d.id, `${d.name}${d.classSection ? ` (${d.classSection})` : ''}`]),
      ),
    [devices],
  );
  const teacherNameById = useMemo(
    () =>
      new Map(
        authorizedTeachers.map((t) => [t.user_id, t.display_name?.trim() || t.email || t.user_id]),
      ),
    [authorizedTeachers],
  );

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<Status>('/smart-board/status', { token });
      setStatus(res);
    } catch {
      setStatus({ enabled: false, authorized: false });
    }
  }, [token]);

  const fetchSchools = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    const f = schoolFiltersRef.current;
    setSchoolsError(null);
    try {
      const q = buildSchoolsQuery({
        limit: 100,
        city: f.city || undefined,
        district: f.district || undefined,
      });
      const res = await apiFetch<{ items?: { id: string; name: string }[] }>(
        `/schools?${q}`,
        { token }
      );
      const items = Array.isArray(res?.items) ? res.items : [];
      setSchools(items);
      setSchoolId((prev) => {
        if (items.length === 0) return prev;
        if (!prev || !items.some((s) => s.id === prev))
          return me?.school_id && items.some((s) => s.id === me.school_id) ? me.school_id : items[0].id;
        return prev;
      });
    } catch (e) {
      setSchoolsError(e instanceof Error ? e.message : 'Okul listesi alınamadı');
      setSchools([]);
      console.warn('Schools fetch:', e);
    }
  }, [token, isSuperadmin, me?.school_id]);

  const fetchDevices = useCallback(async () => {
    if (!token || !effectiveSchoolId) return;
    try {
      const path = isSuperadmin
        ? `/smart-board/devices?school_id=${effectiveSchoolId}`
        : '/smart-board/devices';
      const res = await apiFetch<Device[]>(path, { token });
      setDevices(Array.isArray(res) ? sortSmartBoardDevices(res) : []);
    } catch {
      if (isTeacher) setDevices([]);
    }
  }, [token, effectiveSchoolId, isSuperadmin, isTeacher]);

  const fetchAuthorizedTeachers = useCallback(async () => {
    if (!token || !effectiveSchoolId || isTeacher) return;
    try {
      const res = await apiFetch<AuthorizedTeacher[]>(
        `/smart-board/schools/${effectiveSchoolId}/authorized-teachers`,
        { token }
      );
      setAuthorizedTeachers(Array.isArray(res) ? res : []);
    } catch {
      setAuthorizedTeachers([]);
    }
  }, [token, effectiveSchoolId, isTeacher]);

  const fetchSessionsToday = useCallback(async () => {
    if (!token || !effectiveSchoolId || isTeacher) return;
    try {
      const res = await apiFetch<Session[]>(
        `/smart-board/schools/${effectiveSchoolId}/sessions/today`,
        { token }
      );
      setSessionsToday(Array.isArray(res) ? res : []);
    } catch {
      setSessionsToday([]);
    }
  }, [token, effectiveSchoolId, isTeacher]);

  const fetchAuditLogs = useCallback(async () => {
    if (!token || !effectiveSchoolId || isTeacher) return;
    setAuditLoading(true);
    try {
      const res = await apiFetch<{ items?: SmartBoardAuditLog[] }>(
        `/smart-board/schools/${effectiveSchoolId}/audit-logs?page=1&limit=40`,
        { token }
      );
      setAuditLogs(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [token, effectiveSchoolId, isTeacher]);

  const fetchSchoolForFloorPlan = useCallback(async () => {
    if (!token || !effectiveSchoolId || isTeacher) return;
    try {
      const school = await apiFetch<{ smartBoardFloorPlans?: { label: string; url: string }[] | null; smartBoardFloorPlanUrl?: string | null }>(
        `/schools/${effectiveSchoolId}`,
        { token }
      );
      const plans = school?.smartBoardFloorPlans;
      if (Array.isArray(plans) && plans.length > 0) {
        setFloorPlans(plans);
      } else if (school?.smartBoardFloorPlanUrl?.trim()) {
        setFloorPlans([{ label: 'Kat Planı', url: school.smartBoardFloorPlanUrl!.trim() }]);
      } else {
        setFloorPlans([]);
      }
    } catch {
      setFloorPlans([]);
    }
  }, [token, effectiveSchoolId, isTeacher]);

  const fetchClassSections = useCallback(async () => {
    if (!token || !effectiveSchoolId || isTeacher) return;
    try {
      const classesPath = isSuperadmin
        ? `/classes-subjects/classes?school_id=${encodeURIComponent(effectiveSchoolId)}`
        : '/classes-subjects/classes';
      const classes = await apiFetch<Array<{ name?: string | null }>>(classesPath, { token });
      const names = Array.isArray(classes)
        ? classes.map((c) => String(c?.name ?? '').trim()).filter((s) => !!s)
        : [];
      setClassSections(
        [...new Set(names)].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true })),
      );
    } catch {
      setClassSections([]);
    }
  }, [token, effectiveSchoolId, isTeacher, isSuperadmin]);

  useEffect(() => {
    setSchoolId(me?.school_id ?? null);
  }, [me?.school_id]);

  useEffect(() => {
    if (!isSuperadmin) return;
    apiFetch<string[]>('school-reviews-public/cities', { token: token ?? undefined })
      .then(setFilterCities)
      .catch(() => setFilterCities(TURKEY_CITIES));
  }, [isSuperadmin, token]);

  useEffect(() => {
    if (!isSuperadmin || !schoolFilters.city?.trim()) {
      setFilterDistricts([]);
      return;
    }
    apiFetch<string[]>(
      `school-reviews-public/districts?city=${encodeURIComponent(schoolFilters.city)}`,
      { token: token ?? undefined }
    )
      .then(setFilterDistricts)
      .catch(() => setFilterDistricts(getDistrictsForCity(schoolFilters.city, [])));
  }, [isSuperadmin, schoolFilters.city, token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetchStatus(),
      fetchSchools(),
    ]).then(() => setLoading(false));
  }, [token, fetchStatus, fetchSchools, me?.role]);

  useEffect(() => {
    if (!token || !effectiveSchoolId) return;
    fetchDevices();
    fetchAuthorizedTeachers();
    fetchSessionsToday();
    fetchAuditLogs();
    fetchClassSections();
    fetchSchoolForFloorPlan();
  }, [token, effectiveSchoolId, fetchDevices, fetchAuthorizedTeachers, fetchSessionsToday, fetchAuditLogs, fetchClassSections, fetchSchoolForFloorPlan]);

  const runQrClaim = useCallback(
    async (p: SmartBoardQrClaimParams) => {
      if (!token) return;
      setQrClaimBusy(true);
      setQrClaimStatus('pending');
      setQrClaimMessage('QR doğrulaması gönderiliyor...');
      try {
        const claimRes = await apiFetch<{
          ok?: boolean;
          session_id?: string;
          pending_takeover_seconds?: number;
        }>('/smart-board/qr/claim', {
          method: 'POST',
          body: JSON.stringify(p),
          token,
        });
        if (claimRes?.pending_takeover_seconds && claimRes.pending_takeover_seconds > 0) {
          setQrClaimStatus('success');
          setQrClaimMessage(
            `${claimRes.pending_takeover_seconds} sn içinde ders oturumu devralınacak. Tahta duyuru modunda kalır.`,
          );
          toast.success(`Onay alındı. Tahta ${claimRes.pending_takeover_seconds} sn içinde devralınacak.`);
          postClassroomBoardSync(p.school_id, p.device_id, {
            type: 'takeover_pending',
            seconds_left: claimRes.pending_takeover_seconds,
            teacher_name: me?.display_name ?? me?.email ?? null,
          });
        } else {
          if (!claimRes?.session_id) {
            throw new Error('Ders oturumu oluşturulamadı. Tekrar deneyin.');
          }
          setQrClaimStatus('success');
          setQrClaimMessage('Ders oturumu açıldı. Tahta kullanım moduna geçiyor…');
          toast.success('Ders oturumuna bağlandınız.');
          postClassroomBoardSync(p.school_id, p.device_id, {
            type: 'session_started',
            teacher_name: me?.display_name ?? me?.email ?? null,
          });
          postClassroomBoardSync(p.school_id, p.device_id, { type: 'qr_unlocked' });
        }
        window.dispatchEvent(new Event('smart-board:qr-claimed'));
        if (effectiveSchoolId) {
          try {
            localStorage.setItem(`smartboard-last-${effectiveSchoolId}`, p.device_id);
          } catch {
            /* ignore */
          }
        }
        await fetchStatus();
        void fetchDevices();
      } catch (e: unknown) {
        const msg = smartBoardConnectErrorMessage(e);
        setQrClaimStatus('error');
        setQrClaimMessage(msg);
        toast.error(msg);
        throw e;
      } finally {
        setQrClaimBusy(false);
      }
    },
    [token, fetchStatus, fetchDevices, effectiveSchoolId, me?.display_name, me?.email],
  );

  useEffect(() => {
    if (!isTeacher || !openQrFocus) return;
    if (status?.enabled && status?.authorized) setQrScannerOpen(true);
  }, [isTeacher, openQrFocus, status?.enabled, status?.authorized]);

  useEffect(() => {
    if (!isTeacher || !openQrFocus || loading) return;
    const t = window.setTimeout(() => {
      document.getElementById('smart-board-qr-claim')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(t);
  }, [isTeacher, openQrFocus, loading]);

  useEffect(() => {
    if (!isTeacher || !token) return;
    if (!qrSchoolId || !qrDeviceId || !qrSessionId || !qrCode) return;
    if (qrClaimAttemptedRef.current) return;
    qrClaimAttemptedRef.current = true;
    void runQrClaim({
      school_id: qrSchoolId,
      device_id: qrDeviceId,
      session_id: qrSessionId,
      code: qrCode,
    }).then(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('qr_school');
      params.delete('qr_device');
      params.delete('qr_session');
      params.delete('qr_code');
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    }).catch(() => undefined);
  }, [isTeacher, token, qrSchoolId, qrDeviceId, qrSessionId, qrCode, searchParams, router, pathname, runQrClaim]);

  useEffect(() => {
    if (isTeacher || !canView || !effectiveSchoolId || loading) return;
    if (searchParams.get('tab')) return;
    if (devices.length > 0) return;
    router.replace('/akilli-tahta?tab=kurulum');
  }, [isTeacher, canView, effectiveSchoolId, loading, devices.length, searchParams, router]);

  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isTeacher || !token || !status?.mySession) return;
    const sessionId = status.mySession.session_id;
    const timeoutMin = status.session_timeout_minutes ?? 2;
    const intervalMs = Math.max(30_000, Math.min(45_000, Math.floor((timeoutMin * 60 * 1000) / 2)));
    const tick = () => {
      apiFetch('/smart-board/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      }).catch(() => {});
    };
    tick();
    heartbeatIntervalRef.current = setInterval(tick, intervalMs);
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isTeacher, token, status?.mySession, status?.session_timeout_minutes]);

  const handleAddDevice = async (data: {
    name: string;
    class_section: string;
    room_or_location: string;
  }): Promise<Device | null> => {
    if (!token || !effectiveSchoolId) return null;
    try {
      const body: Record<string, unknown> = {
        name: data.name || undefined,
        class_section: data.class_section || undefined,
        room_or_location: data.room_or_location || undefined,
      };
      if (isSuperadmin) body.school_id = effectiveSchoolId;
      const device = await apiFetch<Device>('/smart-board/devices', {
        method: 'POST',
        body: JSON.stringify(body),
        token,
      });
      return device;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'İşlem başarısız.';
      toast.error(msg);
      return null;
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (
      !token ||
      !confirm(
        'Bu tahtayı silmek istediğinize emin misiniz? Aktif bağlantı varsa otomatik sonlandırılacaktır.'
      )
    )
      return;
    try {
      await apiFetch(`/smart-board/devices/${id}`, { method: 'DELETE', token });
      setDevices((d) => d.filter((x) => x.id !== id));
      toast.success('Tahta silindi.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    }
  };

  const handleBulkDeleteDevices = async (toDelete: Device[]) => {
    if (
      !token ||
      toDelete.length === 0 ||
      !confirm(`${toDelete.length} tahtayı silmek istediğinize emin misiniz? Aktif bağlantılar otomatik sonlandırılacaktır.`)
    )
      return;
    let success = 0;
    let failed = 0;
    for (const d of toDelete) {
      try {
        await apiFetch(`/smart-board/devices/${d.id}`, { method: 'DELETE', token });
        success++;
      } catch {
        failed++;
      }
    }
    setDevices((prev) => prev.filter((x) => !toDelete.some((d) => d.id === x.id)));
    if (success > 0) toast.success(`${success} tahta silindi.`);
    if (failed > 0) toast.error(`${failed} tahta silinemedi.`);
  };

  const handleAddTeacher = async (userId: string) => {
    if (!token || !effectiveSchoolId) return;
    try {
      await apiFetch(`/smart-board/schools/${effectiveSchoolId}/authorized-teachers`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
        token,
      });
      fetchAuthorizedTeachers();
      toast.success('Yetki verildi.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    }
  };

  const handleRemoveTeacher = async (userId: string) => {
    if (!token || !effectiveSchoolId || !confirm('Yetkiyi kaldırmak istediğinize emin misiniz?')) return;
    try {
      await apiFetch(
        `/smart-board/schools/${effectiveSchoolId}/authorized-teachers/${userId}`,
        { method: 'DELETE', token }
      );
      fetchAuthorizedTeachers();
      toast.success('Yetki kaldırıldı.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    }
  };

  const handleSaveUsbPin = async () => {
    if (!token || !effectiveSchoolId || !usbPinFor) return;
    const trimmed = usbPinInput.trim();
    if (trimmed.length > 0 && (trimmed.length < 4 || trimmed.length > 8)) {
      toast.error('PIN 4–8 haneli olmalıdır.');
      return;
    }
    setUsbPinSaving(true);
    try {
      await apiFetch(`/smart-board/schools/${effectiveSchoolId}/teachers/${usbPinFor.user_id}/usb-pin`, {
        method: 'PATCH',
        body: JSON.stringify({ pin: trimmed === '' ? null : trimmed }),
        token,
      });
      toast.success(trimmed === '' ? 'PIN kaldırıldı.' : 'PIN kaydedildi.');
      setUsbPinFor(null);
      setUsbPinInput('');
      fetchAuthorizedTeachers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setUsbPinSaving(false);
    }
  };

  const handleRegenerateOtpCodes = async (teacher: AuthorizedTeacher) => {
    if (!token || !effectiveSchoolId) return;
    if (!confirm(`${teacher.display_name || teacher.email} için OTP kodları yenilensin mi?`)) return;
    setOtpSaving(true);
    try {
      const res = await apiFetch<{ ok: true; codes: string[] }>(
        `/smart-board/schools/${effectiveSchoolId}/teachers/${teacher.user_id}/otp-codes/regenerate`,
        {
          method: 'POST',
          body: JSON.stringify({ count: 8 }),
          token,
        }
      );
      setOtpCodesFor(teacher);
      setOtpCodes(Array.isArray(res?.codes) ? res.codes : []);
      fetchAuthorizedTeachers();
      toast.success('OTP kodları üretildi.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'OTP üretilemedi.');
    } finally {
      setOtpSaving(false);
    }
  };

  const copyPairingCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success('Eşleme kodu kopyalandı: ' + code);
  };

  const handleAssignDeviceToFloor = async (deviceId: string, floorIndex: number) => {
    if (!token) return;
    try {
      const updated = await apiFetch<Device>(`/smart-board/devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ plan_floor_index: floorIndex }),
        token,
      });
      setDevices((d) =>
        d.map((dev) =>
          dev.id === deviceId ? { ...dev, planFloorIndex: updated.planFloorIndex ?? floorIndex } : dev
        )
      );
      toast.success('Kat atandı.');
    } catch {
      toast.error('Atanmadı.');
    }
  };

  const handleUpdateDevicePosition = async (deviceId: string, x: number, y: number, floorIndex?: number) => {
    if (!token) return;
    try {
      const body: { plan_position_x: number; plan_position_y: number; plan_floor_index?: number } = {
        plan_position_x: x,
        plan_position_y: y,
      };
      if (floorIndex !== undefined) body.plan_floor_index = floorIndex;
      const updated = await apiFetch<Device>(`/smart-board/devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        token,
      });
      const nx = typeof updated.planPositionX === 'number' ? updated.planPositionX : Number(updated.planPositionX) || x;
      const ny = typeof updated.planPositionY === 'number' ? updated.planPositionY : Number(updated.planPositionY) || y;
      const nf = updated.planFloorIndex ?? floorIndex ?? 0;
      setDevices((d) =>
        d.map((dev) =>
          dev.id === deviceId ? { ...dev, planPositionX: nx, planPositionY: ny, planFloorIndex: nf } : dev
        )
      );
      toast.success('Konum kaydedildi.');
    } catch {
      toast.error('Konum kaydedilemedi.');
    }
  };

  const handleUpdateDevice = async (id: string, name: string, roomOrLocation: string, classSection: string) => {
    if (!token) return;
    try {
      const updated = await apiFetch<Device>(`/smart-board/devices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name || undefined,
          room_or_location: roomOrLocation || undefined,
          class_section: classSection || undefined,
        }),
        token,
      });
      setDevices((d) =>
        d.map((x) =>
          x.id === id
            ? {
                ...x,
                ...updated,
                roomOrLocation: updated.roomOrLocation ?? null,
                classSection: updated.classSection ?? null,
              }
            : x
        )
      );
      setEditDevice(null);
      toast.success('Tahta güncellendi.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    }
  };

  const handleConnect = async (deviceId: string) => {
    if (!token) return;
    setConnectingDeviceId(deviceId);
    try {
      await apiFetch<{ session_id: string }>('/smart-board/connect', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId }),
        token,
      });
      if (effectiveSchoolId) {
        try {
          localStorage.setItem(`smartboard-last-${effectiveSchoolId}`, deviceId);
        } catch {
          /* localStorage kullanılamayabilir */
        }
      }
      await fetchStatus();
      fetchDevices();
      const sid = effectiveSchoolId ?? me?.school?.id;
      if (sid) {
        postClassroomBoardSync(sid, deviceId, {
          type: 'session_started',
          teacher_name: me?.display_name ?? me?.email ?? null,
        });
      }
      toast.success('Tahtaya bağlandınız.');
    } catch (e: unknown) {
      toast.error(smartBoardConnectErrorMessage(e));
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    if (!token) return;
    const deviceId = status?.mySession?.device_id;
    const sid = effectiveSchoolId ?? me?.school?.id;
    try {
      await apiFetch('/smart-board/disconnect', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      });
      if (sid && deviceId) postClassroomBoardSync(sid, deviceId, { type: 'session_ended' });
      await fetchStatus();
      fetchDevices();
      toast.success('Bağlantı kesildi. Tahta duyuru moduna döner.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bağlantı kesilemedi.');
    }
  };

  const handleAdminDisconnect = async (sessionId: string) => {
    if (!token || !confirm('Bu bağlantıyı sonlandırmak istediğinize emin misiniz?')) return;
    const row = sessionsToday.find((s) => s.id === sessionId);
    try {
      await apiFetch('/smart-board/disconnect', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      });
      if (effectiveSchoolId && row?.device_id) {
        postClassroomBoardSync(effectiveSchoolId, row.device_id, { type: 'session_ended' });
      }
      fetchSessionsToday();
      toast.success('Bağlantı sonlandırıldı. Tahta duyuru moduna döner.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Sonlandırılamadı.');
    }
  };

  const handleCloseDevice = async (device: Device | Device[]) => {
    if (!token) return;
    const list = Array.isArray(device) ? device : [device];
    if (list.length === 0) return;
    const msg = list.length === 1 ? 'Tahtayı kapatmak istediğinize emin misiniz?' : `${list.length} tahtayı kapatmak istediğinize emin misiniz?`;
    if (!confirm(msg)) return;
    try {
      for (const d of list) {
        await apiFetch(`/smart-board/devices/${d.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'offline' }),
          token,
        });
      }
      fetchDevices();
      fetchSessionsToday();
      toast.success(list.length === 1 ? 'Tahta kapatıldı.' : `${list.length} tahta kapatıldı.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Kapatılamadı.');
    }
  };

  const handleBulkDeviceAction = async (
    deviceIds: string[],
    action: 'open' | 'lock' | 'close',
  ) => {
    if (!token || deviceIds.length === 0) return;
    const msgMap = {
      open: `${deviceIds.length} tahta için aç işlemi uygulansın mı?`,
      lock: `${deviceIds.length} tahta için kilitle işlemi uygulansın mı?`,
      close: `${deviceIds.length} tahta için kapat işlemi uygulansın mı?`,
    } as const;
    if (!confirm(msgMap[action])) return;
    try {
      const res = await apiFetch<{ updated?: number; results?: Array<{ device_id: string; device_name: string | null; status: 'ok' | 'skipped'; message: string }> }>('/smart-board/devices/bulk-action', {
        method: 'POST',
        body: JSON.stringify({ device_ids: deviceIds, action }),
        token,
      });
      setBulkActionReport({
        action,
        results: Array.isArray(res?.results) ? res.results : [],
      });
      fetchDevices();
      fetchSessionsToday();
      fetchAuditLogs();
      toast.success(`Toplu işlem tamamlandı (${res?.updated ?? 0}).`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Toplu işlem başarısız.');
    }
  };

  if (loading && !status) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const shellTitle =
    isSuperadmin && effectiveSchoolId && schools.length > 0
      ? `Akıllı Tahta – ${schools.find((s) => s.id === effectiveSchoolId)?.name ?? 'Okul'}`
      : 'Akıllı Tahta';

  const adminTabNav =
    !isTeacher && effectiveSchoolId ? (
      <nav
        className="flex w-full min-w-0 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain sm:flex-wrap sm:gap-2"
        aria-label="Akıllı Tahta sekmeleri"
      >
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = adminTab === t.id;
          const idleTint =
            t.accent === 'primary'
              ? 'border-primary/15 bg-primary/5'
              : t.accent === 'teal'
                ? 'border-teal-500/20 bg-teal-500/8'
                : t.accent === 'amber'
                  ? 'border-amber-500/20 bg-amber-500/8'
                  : t.accent === 'violet'
                    ? 'border-violet-500/20 bg-violet-500/8'
                    : t.accent === 'emerald'
                      ? 'border-emerald-500/20 bg-emerald-500/8'
                      : t.accent === 'rose'
                        ? 'border-rose-500/20 bg-rose-500/8'
                        : 'border-slate-400/20 bg-slate-500/8';
          return (
            <Link
              key={t.id}
              href={`/akilli-tahta?tab=${t.id}`}
              title={t.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center text-[10px] font-semibold transition-all sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm',
                isActive
                  ? cn(getTabActiveStyles(t.accent), 'shadow-sm')
                  : cn('border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground', idleTint),
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    ) : null;

  return (
    <>
      <DisplayModuleShell
        variant="smart_board"
        title={shellTitle}
        subtitle={
          isTeacher
            ? 'Tahta varsayılan Duyuru TV gösterir. Ders için QR onayı verin; tahta kullanım moduna geçer.'
            : 'Tahtalar kurulumdan sonra Duyuru TV ile açılır. Öğretmen QR onayı ile kullanım modu; koridor duyurusu ayrı modülde.'
        }
        schoolBadge={!isTeacher && isSchoolAdmin ? me?.school?.name : undefined}
        highlights={
          isTeacher
            ? [
                { label: 'Tahta: Duyuru TV', icon: Tv },
                { label: 'QR → kullanım', icon: KeyRound },
                { label: 'Oturum', icon: Activity },
              ]
            : [
                { label: 'Kurulum → Duyuru TV', icon: Wrench },
                { label: 'QR & yetki', icon: KeyRound },
                { label: 'Oturumlar', icon: Activity },
                { label: 'İçerik: Duyuru TV', icon: Tv },
              ]
        }
        headerActions={
          <>
            {isSchoolAdmin && effectiveSchoolId && !isTeacher ? (
              <Link href="/tv" className="inline-flex min-w-0">
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl border-cyan-500/30 bg-cyan-500/8">
                  <Tv className="size-4" />
                  Duyuru TV
                </Button>
              </Link>
            ) : null}
            {isSuperadmin && schools.length === 0 && !loading ? (
              <span className="text-xs text-muted-foreground">{schoolsError ?? 'Okul seçin'}</span>
            ) : null}
          </>
        }
        filterBar={
          isSuperadmin ? (
            <form onSubmit={(e) => { e.preventDefault(); fetchSchools(); }} className="flex flex-wrap items-center gap-2">
              <select
                value={schoolFilters.city}
                onChange={(e) => setSchoolFilters((f) => ({ ...f, city: e.target.value, district: '' }))}
                className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-sm"
                aria-label="İl"
              >
                <option value="">İl</option>
                {(filterCities.length > 0 ? filterCities : TURKEY_CITIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={schoolFilters.district}
                onChange={(e) => setSchoolFilters((f) => ({ ...f, district: e.target.value }))}
                className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-sm"
                aria-label="İlçe"
                disabled={!schoolFilters.city}
              >
                <option value="">İlçe</option>
                {(filterDistricts.length > 0 ? filterDistricts : getDistrictsForCity(schoolFilters.city, [])).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                Filtrele
              </Button>
              {(schoolFilters.city || schoolFilters.district) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    schoolFiltersRef.current = { city: '', district: '' };
                    setSchoolFilters({ city: '', district: '' });
                    fetchSchools();
                  }}
                >
                  Filtreleri temizle
                </Button>
              )}
              {schools.length > 0 && (
                <Select value={effectiveSchoolId ?? ''} onValueChange={(v) => setSchoolId(v || null)}>
                  <SelectTrigger className="h-9 w-full sm:w-[220px]" aria-label="Okul seçin">
                    <SelectValue placeholder="Okul seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </form>
          ) : undefined
        }
        tabNav={adminTabNav}
      >
      {isSuperadmin && !effectiveSchoolId && !loading && (
        <Card className="mb-6">
          <CardContent className="py-8">
            <EmptyState
              icon={<Monitor className="size-10 text-muted-foreground" />}
              title={
                schoolsError
                  ? 'Okul listesi alınamadı'
                  : schools.length === 0
                    ? 'Okul bulunamadı'
                    : 'Okul seçin'
              }
              description={
                schoolsError
                  ? `${schoolsError} Okullar sayfasını kontrol edin veya sayfayı yenileyin.`
                  : schools.length === 0
                    ? schoolFilters.city || schoolFilters.district
                      ? 'Seçtiğiniz il/ilçede kayıtlı okul yok. Filtreleri temizleyip tüm okulları görebilir veya Okullar sayfasından yeni okul ekleyebilirsiniz.'
                      : 'Henüz okul eklenmemiş. Okullar sayfasından okul ekleyerek başlayın.'
                    : 'Yukarıdaki menüden bir okul seçerek tahta yönetimine devam edin.'
              }
              action={
                (schoolsError || (schools.length === 0 && (schoolFilters.city || schoolFilters.district))) ? (
                  <button
                    type="button"
                    onClick={() => {
                      schoolFiltersRef.current = { city: '', district: '' };
                      setSchoolFilters({ city: '', district: '' });
                      setSchoolsError(null);
                      fetchSchools();
                    }}
                    className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                  >
                    Filtreleri temizle ve tekrar dene
                  </button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {isTeacher ? (
        <DisplayModuleTeacherLane>
      <div className={cn(status?.enabled && status?.authorized && 'max-sm:pb-24')}>
      {isTeacher && status && !status.enabled ? (
        <Alert variant="warning">
          <p className="text-sm font-medium">Akıllı Tahta modülü kapalı</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Okulunuzda modül etkin değil. QR onayı ve tahta kullanımı için idareye başvurun.
          </p>
        </Alert>
      ) : null}

      {isTeacher && (
        <TeacherSmartBoardHero
          status={status}
          deviceCount={devices.length}
          schoolName={me?.school?.name}
        />
      )}

      <SmartBoardPwaRegister />

      {isTeacher && status?.enabled && status?.authorized && (
        <>
          <TeacherPendingQrBanner token={token} />
          {qrClaimStatus !== 'idle' ? (
            <TeacherQrStatusBanner
              status={qrClaimStatus === 'error' ? 'error' : qrClaimStatus === 'pending' ? 'pending' : 'success'}
              message={
                qrClaimStatus === 'pending'
                  ? 'QR doğrulaması işleniyor…'
                  : qrClaimMessage || 'İşlem tamamlandı.'
              }
            />
          ) : null}
          <TeacherQrClaimPanel
            busy={qrClaimBusy}
            onClaim={runQrClaim}
            deviceHint={qrDeviceHint}
            highlight={openQrFocus}
            scannerOpen={qrScannerOpen}
            onScannerOpenChange={setQrScannerOpen}
          />
        </>
      )}

      {isTeacher && status?.mySession && (
        <TeacherActiveSessionBar
          deviceName={status.mySession.device_name}
          onDisconnect={() => handleDisconnect(status.mySession!.session_id)}
        />
      )}

      {isTeacher && status?.enabled && status?.authorized && (
        <Card className="mb-2 overflow-hidden border-teal-200/40 shadow-sm dark:border-teal-900/35 sm:mb-4">
          <CardHeader className="space-y-2 border-b border-teal-200/35 bg-teal-500/5 px-3 py-2.5 sm:px-5 sm:py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Monitor className="size-4 text-teal-700 dark:text-teal-400" />
              Bugünkü tahtalarım
            </CardTitle>
            <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
              Ders programınıza göre sıralı; derse girmek için QR okutun.
            </p>
            {devices.length > 0 && (
              <div className="flex flex-col gap-2 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <div className="relative w-full flex-1 sm:min-w-[200px] sm:max-w-sm">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-4" />
                  <input
                    type="search"
                    placeholder="Sınıf, lokasyon veya kod ara…"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:pl-9 sm:pr-3 sm:text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'name' as const, label: 'Sınıf / ad (A→Z)' },
                      { id: 'online' as const, label: 'Önce açık' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTeacherDeviceSort(opt.id)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors sm:text-xs',
                        teacherDeviceSort === opt.id
                          ? 'border-teal-600 bg-teal-500/20 text-teal-900 dark:border-teal-500 dark:text-teal-100'
                          : 'border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setTeacherFilterToday((v) => !v)}
                  className={`flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-[10px] font-medium transition-colors sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm ${
                    teacherFilterToday
                      ? 'border-teal-600 bg-teal-500/15 text-teal-900 dark:border-teal-500 dark:text-teal-100'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Filter className="size-3 sm:size-4" />
                  Bugünüm
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="px-3 py-2 sm:px-5 sm:py-4">
            {devices.length === 0 ? (
              <EmptyState
                icon={<Monitor className="size-10 text-muted-foreground" />}
                title="Tahta bulunamadı"
                description="Okul idaresi Kurulum sekmesinden tahta eklemeli. Siz QR onayı yapamazsınız."
              />
            ) : (() => {
              const q = teacherSearch.trim().toLowerCase();
              let filtered = devices.filter((d) => {
                if (teacherFilterToday && d.lesson_context?.my_lesson_today === false) return false;
                if (!q) return true;
                const name = (d.name ?? '').toLowerCase();
                const room = (d.roomOrLocation ?? '').toLowerCase();
                const cs = (d.classSection ?? '').toLowerCase();
                const code = (d.pairing_code ?? '').toLowerCase();
                return name.includes(q) || room.includes(q) || cs.includes(q) || code.includes(q);
              });
              filtered = filtered.sort((a, b) => {
                const aNow = a.lesson_context?.my_lesson_now ? 0 : 1;
                const bNow = b.lesson_context?.my_lesson_now ? 0 : 1;
                if (aNow !== bNow) return aNow - bNow;
                if (teacherDeviceSort === 'online') {
                  const ao = a.status === 'online' ? 0 : 1;
                  const bo = b.status === 'online' ? 0 : 1;
                  if (ao !== bo) return ao - bo;
                }
                return compareSmartBoardDevices(a, b);
              });
              return filtered.length === 0 ? (
                <EmptyState
                  icon={<Search className="size-10 text-muted-foreground" />}
                  title="Sonuç yok"
                  description="Arama veya filtreye uyan tahta bulunamadı. Filtreleri değiştirmeyi deneyin."
                />
              ) : (
                <div className="space-y-2">
                  {filtered.map((d) => (
                    <TeacherDeviceCard
                      key={d.id}
                      device={d}
                      isConnected={status?.mySession?.device_id === d.id}
                      isConnecting={connectingDeviceId === d.id}
                      onConnect={() => handleConnect(d.id)}
                      onDisconnect={() => handleDisconnect(status!.mySession!.session_id)}
                      sessionId={status?.mySession?.session_id}
                    />
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {isTeacher && status?.enabled ? (
        <TeacherSmartBoardUsageCard authorized={!!status?.authorized} />
      ) : null}

      {isTeacher && status?.enabled && status?.authorized ? <PwaInstallHint /> : null}
      </div>

      <TeacherSmartBoardStickyBar
        visible={!!(status?.enabled && status?.authorized)}
        hasActiveSession={!!status?.mySession}
        busy={qrClaimBusy}
        onScan={() => setQrScannerOpen(true)}
        onDisconnect={
          status?.mySession
            ? () => handleDisconnect(status.mySession!.session_id)
            : undefined
        }
      />
        </DisplayModuleTeacherLane>
      ) : null}

      {canView && (
        <div className="akilli-tahta-admin-scope min-w-0 space-y-4 p-3 sm:space-y-6 sm:p-6">
          {isSuperadmin && (
            <Alert variant="info" className="text-sm">
              Tahta ekleme, yetki ve oturum sonlandırma okul yöneticisindedir. Modül aç/kapa: Okullar.
            </Alert>
          )}

          {adminTab === 'genel-bakis' && effectiveSchoolId && !isTeacher && (
            <SetupProgressCard schoolId={effectiveSchoolId} token={token} />
          )}

          {adminTab === 'genel-bakis' && (
            <div className="space-y-1.5 sm:space-y-6">
              <div className="grid grid-cols-2 gap-1 lg:grid-cols-4 sm:gap-4">
                <Card className="overflow-hidden border-teal-200/50 bg-teal-500/6 shadow-sm transition-all dark:border-teal-900/40 sm:border-border/80 sm:bg-card sm:dark:border-border/80">
                  <CardHeader className="flex flex-row items-center justify-between gap-1 px-2 py-1.5 pb-0 sm:px-3 sm:py-2 sm:pb-1">
                    <CardTitle className="text-[10px] font-semibold leading-tight text-muted-foreground sm:text-sm sm:font-medium">
                      Kayıtlı tahta
                    </CardTitle>
                    <div className="rounded-md bg-teal-500/15 p-1 sm:rounded-xl sm:p-2.5">
                      <Monitor className="size-3.5 text-teal-600 dark:text-teal-400 sm:size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <p className="text-lg font-bold tabular-nums tracking-tight sm:text-3xl">{devices.length}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:mt-1 sm:text-xs">Toplam cihaz</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-emerald-200/50 bg-emerald-500/6 shadow-sm transition-all dark:border-emerald-900/40 sm:border-border/80 sm:bg-card sm:dark:border-border/80">
                  <CardHeader className="flex flex-row items-center justify-between gap-1 px-2 py-1.5 pb-0 sm:px-3 sm:py-2 sm:pb-1">
                    <CardTitle className="text-[10px] font-semibold leading-tight text-muted-foreground sm:text-sm sm:font-medium">
                      Çevrimiçi
                    </CardTitle>
                    <div className="rounded-md bg-emerald-500/15 p-1 sm:rounded-xl sm:p-2.5">
                      <Monitor className="size-3.5 text-emerald-600 dark:text-emerald-400 sm:size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <p className="text-lg font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                      {devices.filter((d) => d.status === 'online').length}
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:mt-1 sm:text-xs">Şu an aktif</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-violet-200/50 bg-violet-500/6 shadow-sm transition-all dark:border-violet-900/40 sm:border-border/80 sm:bg-card sm:dark:border-border/80">
                  <CardHeader className="flex flex-row items-center justify-between gap-1 px-2 py-1.5 pb-0 sm:px-3 sm:py-2 sm:pb-1">
                    <CardTitle className="text-[10px] font-semibold leading-tight text-muted-foreground sm:text-sm sm:font-medium">
                      Yetkili öğretmen
                    </CardTitle>
                    <div className="rounded-md bg-violet-500/15 p-1 sm:rounded-xl sm:p-2.5">
                      <Users className="size-3.5 text-violet-600 dark:text-violet-400 sm:size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <p className="text-lg font-bold tabular-nums tracking-tight sm:text-3xl">{authorizedTeachers.length}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:mt-1 sm:text-xs">Bağlanabilir</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-amber-200/50 bg-amber-500/6 shadow-sm transition-all dark:border-amber-900/40 sm:border-border/80 sm:bg-card sm:dark:border-border/80">
                  <CardHeader className="flex flex-row items-center justify-between gap-1 px-2 py-1.5 pb-0 sm:px-3 sm:py-2 sm:pb-1">
                    <CardTitle className="text-[10px] font-semibold leading-tight text-muted-foreground sm:text-sm sm:font-medium">
                      Bugün bağlanan
                    </CardTitle>
                    <div className="rounded-md bg-amber-500/15 p-1 sm:rounded-xl sm:p-2.5">
                      <Activity className="size-3.5 text-amber-600 dark:text-amber-400 sm:size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
                    <p className="text-lg font-bold tabular-nums tracking-tight sm:text-3xl">{sessionsToday.length}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground sm:mt-1 sm:text-xs">Oturum</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="border-border/80">
                <CardHeader className="space-y-1 px-2.5 py-2 sm:px-6 sm:py-6">
                  <CardTitle className="text-xs sm:text-base">Hızlı erişim</CardTitle>
                  <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-sm">
                    Yeni okul: önce <strong className="text-foreground">Kurulum</strong> sihirbazı. Ders bandı: Ders Programı.
                  </p>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
                  <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-3">
                    <Link href="/akilli-tahta?tab=kurulum" className="min-w-0 sm:order-first">
                      <Button variant="default" size="sm" className="h-9 w-full justify-center gap-1 px-2 text-[11px] sm:h-10 sm:w-auto sm:text-sm">
                        <Wrench className="size-3.5 shrink-0 sm:mr-1 sm:size-4" />
                        Kurulum
                      </Button>
                    </Link>
                    <Link href="/ders-programi" className="min-w-0">
                      <Button variant="secondary" size="sm" className="h-9 w-full justify-center gap-1 px-2 text-[11px] sm:h-10 sm:w-auto sm:text-sm">
                        Ders prog.
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=cihazlar" className="min-w-0">
                      <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1 border-teal-200 px-2 text-[11px] hover:bg-teal-50 hover:border-teal-300 dark:border-teal-800 dark:hover:bg-teal-950/50 sm:h-10 sm:w-auto sm:text-sm">
                        <Monitor className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400 sm:mr-1 sm:size-4" />
                        Cihazlar
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=yerlesim" className="min-w-0">
                      <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1 border-amber-200 px-2 text-[11px] hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/50 sm:h-10 sm:w-auto sm:text-sm">
                        <MapPin className="size-3.5 shrink-0 text-amber-600 sm:mr-1 sm:size-4" />
                        Yerleşim
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=yetkiler" className="min-w-0">
                      <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1 border-violet-200 px-2 text-[11px] hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-950/50 sm:h-10 sm:w-auto sm:text-sm">
                        <Users className="size-3.5 shrink-0 text-violet-600 sm:mr-1 sm:size-4" />
                        <span className="truncate">Yetkiler</span>
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=oturumlar" className="min-w-0 sm:col-span-1">
                      <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1 border-emerald-200 px-2 text-[11px] hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/50 sm:h-10 sm:w-auto sm:text-sm">
                        <Activity className="size-3.5 shrink-0 text-emerald-600 sm:mr-1 sm:size-4" />
                        Oturum
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=istatistikler" className="min-w-0">
                      <Button variant="outline" size="sm" className="h-9 w-full justify-center gap-1 border-rose-200 px-2 text-[11px] hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/50 sm:h-10 sm:w-auto sm:text-sm">
                        <BarChart3 className="size-3.5 shrink-0 text-rose-600 sm:mr-1 sm:size-4" />
                        İstatistik
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {adminTab === 'cihazlar' && (
            <Card className="mb-3 overflow-hidden border-teal-200/40 dark:border-teal-900/35 sm:mb-6">
              <CardHeader className="flex flex-col gap-2 border-b border-teal-200/40 bg-teal-500/6 px-2.5 py-2 dark:border-teal-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                <CardTitle className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 sm:size-8">
                    <Monitor className="size-3.5 text-teal-700 dark:text-teal-400 sm:size-4" />
                  </span>
                  Tahta cihazları
                </CardTitle>
                {canManage && (
                  <AddDeviceDialog
                    open={addDeviceOpen}
                    onOpenChange={setAddDeviceOpen}
                    onAdd={handleAddDevice}
                    classSections={classSections}
                    onDeviceCreated={(device) => {
                      setDevices((d) => [...d, device]);
                      toast.success('Tahta eklendi. Eşleme kodu: ' + device.pairing_code);
                    }}
                    trigger={
                      <Button size="sm" className="h-9 w-full gap-1.5 sm:h-10 sm:w-auto">
                        <Plus className="size-4 shrink-0 sm:mr-0" />
                        Tahta ekle
                      </Button>
                    }
                  />
                )}
              </CardHeader>
              <CardContent className="space-y-3 px-2.5 sm:space-y-4 sm:px-6">
                {bulkActionReport && (
                  <Alert variant="info" className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold sm:text-sm">
                        Toplu işlem sonucu: {bulkActionReport.action === 'open' ? 'Aç' : bulkActionReport.action === 'lock' ? 'Kilitle' : 'Kapat'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBulkActionReport(null)}
                        className="h-7 px-2 text-[10px] sm:text-xs"
                      >
                        Kapat
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border bg-background/70">
                      <table className="w-full text-[11px] sm:text-xs">
                        <tbody>
                          {bulkActionReport.results.map((r) => (
                            <tr key={r.device_id} className="border-b last:border-0">
                              <td className="px-2 py-1.5 font-medium">{r.device_name || r.device_id}</td>
                              <td className={cn('px-2 py-1.5', r.status === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
                                {r.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Alert>
                )}
                <div className="flex gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50/70 px-2 py-1.5 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/35 dark:text-sky-100 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
                  <Tv className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400 sm:size-5" aria-hidden />
                  <div className="max-h-38 min-w-0 space-y-0.5 overflow-y-auto pr-0.5 sm:max-h-none sm:space-y-1 sm:overflow-visible">
                    <p className="text-[11px] font-semibold leading-tight text-foreground sm:text-sm">Saha kurulumu</p>
                    <ol className="list-decimal space-y-0.5 pl-3 text-[10px] leading-snug text-muted-foreground sm:space-y-1 sm:pl-4 sm:text-xs sm:leading-relaxed">
                      {SMART_BOARD_SCHOOL_SETUP_STEPS.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">{SMART_BOARD_SCHOOL_SETUP_NOTE}</p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">
                      Bu listeden tahta ekleyebilir veya{' '}
                      <Link href="/akilli-tahta?tab=kurulum" className="font-medium text-primary underline">
                        Kurulum
                      </Link>{' '}
                      sihirbazını kullanın. Satırda{' '}
                      <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[11px]">/tv/classroom</code> URL’si ve QR etiketleri vardır.
                    </p>
                  </div>
                </div>
                {devices.length === 0 ? (
                  <EmptyState
                    icon={<Monitor className="size-10 text-muted-foreground" />}
                    title="Tahta yok"
                    description={canManage ? 'Yeni tahta eklemek için yukarıdaki butonu kullanın.' : 'Bu okulda henüz tahta kaydı yok.'}
                    action={canManage ? (
                      <Button onClick={() => setAddDeviceOpen(true)}>
                        <Plus className="mr-2 size-4" />
                        Tahta Ekle
                      </Button>
                    ) : undefined}
                  />
                ) : (
                  <DeviceTable
                    devices={devices}
                    sessions={sessionsToday}
                    schoolId={effectiveSchoolId}
                    readOnly={!canManage}
                    canManage={canManage}
                    onEdit={(d) => setEditDevice(d)}
                    onDelete={(d) => handleDeleteDevice(d.id)}
                    onBulkDelete={handleBulkDeleteDevices}
                    onCopyPairingCode={copyPairingCode}
                    onSchedule={canManage ? (d) => setScheduleDevice(d) : undefined}
                    onDisconnect={canManage ? handleAdminDisconnect : undefined}
                    onClose={canManage ? handleCloseDevice : undefined}
                    onBulkAction={canManage ? handleBulkDeviceAction : undefined}
                    onRefresh={() => {
                      fetchDevices();
                      fetchSessionsToday();
                      fetchAuditLogs();
                    }}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {adminTab === 'yerlesim' && (
            <FloorPlanEditor
              devices={devices}
              sessions={sessionsToday}
              floorPlans={floorPlans}
              schoolId={effectiveSchoolId!}
              canManage={canManage}
              token={token}
              onUpdateDevicePosition={handleUpdateDevicePosition}
              onUpdateFloorPlans={setFloorPlans}
              onAssignDeviceToFloor={handleAssignDeviceToFloor}
            />
          )}

          {adminTab === 'yetkiler' && (
            <div className="space-y-2.5 sm:space-y-4">
              <Card className="overflow-hidden border-violet-200/45 dark:border-violet-900/40">
                <CardHeader className="flex flex-col gap-2 border-b border-violet-200/40 bg-violet-500/6 px-2.5 py-2 dark:border-violet-900/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2 sm:text-base">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/15 sm:size-8">
                        <Users className="size-3.5 text-violet-700 dark:text-violet-400 sm:size-4" />
                      </span>
                      Yetkili öğretmenler
                      <span className="text-xs font-normal text-muted-foreground sm:text-sm">({authorizedTeachers.length})</span>
                    </CardTitle>
                    <p className="line-clamp-3 text-[10px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-xs">
                      Listedekiler bağlanabilir. <strong className="text-foreground">Otomatik yetki</strong> açıksa (Ayarlar) tüm öğretmenler bağlanır; liste bilgi amaçlıdır. USB ile tahta açılışında öğretmene özel PIN buradan tanımlanır.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    {authorizedTeachers.length > 3 && (
                      <div className="relative min-w-0 flex-1 sm:max-w-xs">
                        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-4" />
                        <input
                          type="search"
                          placeholder="Ara…"
                          value={yetkilerSearch}
                          onChange={(e) => setYetkilerSearch(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background py-1 pl-7 pr-2 text-xs sm:pl-8 sm:pr-3 sm:text-sm"
                        />
                      </div>
                    )}
                    {canManage && (
                      <TeacherSelectForAuth
                        token={token}
                        schoolId={effectiveSchoolId!}
                        excludedIds={authorizedTeachers.map((t) => t.user_id)}
                        onSelect={handleAddTeacher}
                        trigger={
                          <Button size="sm" className="h-9 w-full bg-violet-600 text-xs hover:bg-violet-700 sm:w-auto sm:text-sm">
                            <UserPlus className="mr-1 size-3.5 sm:mr-2 sm:size-4" />
                            Yetki ver
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-3 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
                  {authorizedTeachers.length === 0 ? (
                    <EmptyState
                      icon={<Users className="size-10 text-violet-400/60" />}
                      title="Yetkili öğretmen yok"
                      description="Tahtaya bağlanabilmesi için öğretmenlere yetki verin. Yukarıdaki Yetki Ver butonunu kullanın."
                    />
                  ) : (() => {
                    const q = yetkilerSearch.trim().toLowerCase();
                    const filtered = q
                      ? authorizedTeachers.filter(
                          (t) =>
                            (t.display_name ?? '').toLowerCase().includes(q) ||
                            (t.email ?? '').toLowerCase().includes(q)
                        )
                      : authorizedTeachers;
                    const activeUserIds = new Set(
                      sessionsToday.filter((s) => s.is_active).map((s) => s.user_id)
                    );
                    return filtered.length === 0 ? (
                      <EmptyState
                        icon={<Search className="size-10 text-muted-foreground" />}
                        title="Sonuç yok"
                        description="Arama kriterine uyan öğretmen bulunamadı."
                      />
                    ) : (
                      <div className="table-x-scroll rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left font-medium">Öğretmen</th>
                              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">E-posta</th>
                              <th className="px-4 py-3 text-left font-medium">Durum</th>
                              {canManage && (
                                <th className="w-28 px-4 py-3 text-right font-medium">USB PIN</th>
                              )}
                              {canManage && (
                                <th className="w-24 px-4 py-3 text-right font-medium">OTP</th>
                              )}
                              {canManage && (
                                <th className="w-24 px-4 py-3 text-right font-medium">İşlem</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((t) => (
                              <tr
                                key={t.id}
                                className="border-b last:border-0 transition-colors hover:bg-muted/30"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-medium text-violet-700 dark:text-violet-300">
                                      {(t.display_name || t.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium">{t.display_name || t.email}</p>
                                      <p className="text-xs text-muted-foreground md:hidden">{t.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                                  {t.email}
                                </td>
                                <td className="px-4 py-3">
                                  {activeUserIds.has(t.user_id) ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                      <span className="size-1.5 rounded-full bg-emerald-500" />
                                      Şu an bağlı
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </td>
                                {canManage && (
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 text-xs"
                                      onClick={() => {
                                        setUsbPinFor(t);
                                        setUsbPinInput('');
                                      }}
                                    >
                                      <KeyRound className="size-3.5" />
                                      {t.has_usb_pin ? 'PIN’i değiştir' : 'PIN ata'}
                                    </Button>
                                  </td>
                                )}
                                {canManage && (
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-[11px] text-muted-foreground">
                                        {t.otp_code_count ?? 0}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 text-xs"
                                        disabled={otpSaving}
                                        onClick={() => handleRegenerateOtpCodes(t)}
                                      >
                                        {t.has_otp_codes ? 'Yenile' : 'Üret'}
                                      </Button>
                                    </div>
                                  </td>
                                )}
                                {canManage && (
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => handleRemoveTeacher(t.user_id)}
                                    >
                                      <UserMinus className="mr-1 size-4" />
                                      Kaldır
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}

          {adminTab === 'oturumlar' && (
            <SessionTable
              sessions={sessionsToday}
              onDisconnect={handleAdminDisconnect}
              onRefresh={fetchSessionsToday}
              canDisconnect={canManage}
            />
          )}

          {adminTab === 'denetim' && (
            <Card className="mb-3 overflow-hidden border-slate-300/45 dark:border-slate-700/40 sm:mb-6">
              <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-slate-500/6 px-2.5 py-2 sm:px-6 sm:py-4">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-500/15 sm:size-8">
                    <ClipboardList className="size-3.5 text-slate-700 dark:text-slate-300 sm:size-4" />
                  </span>
                  Son denetim kayıtları
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchAuditLogs}>
                  Yenile
                </Button>
              </CardHeader>
              <CardContent className="px-2.5 py-3 sm:px-6 sm:py-4">
                {auditLoading ? (
                  <div className="flex min-h-[120px] items-center justify-center">
                    <LoadingSpinner />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="size-10 text-muted-foreground" />}
                    title="Kayıt yok"
                    description="Henüz akıllı tahta işlem kaydı yok."
                  />
                ) : (
                  <div className="table-x-scroll rounded-lg border">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-3 py-2 text-left font-semibold">Zaman</th>
                          <th className="px-3 py-2 text-left font-semibold">İşlem</th>
                          <th className="px-3 py-2 text-left font-semibold">Yapan</th>
                          <th className="px-3 py-2 text-left font-semibold">Açıklama</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((a) => {
                          const label = getSmartBoardAuditActionLabel(a.action);
                          return (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="whitespace-nowrap px-3 py-2">
                                {new Date(a.created_at).toLocaleString('tr-TR')}
                              </td>
                              <td className="px-3 py-2">
                                <p className="text-[11px] font-medium sm:text-xs">{label}</p>
                              </td>
                              <td className="px-3 py-2">{a.user?.display_name || a.user?.email || 'Otomatik'}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {getSmartBoardAuditMetaText(a, deviceNameById, teacherNameById)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {adminTab === 'istatistikler' && effectiveSchoolId && (
            <SmartBoardUsagePanel token={token} schoolId={effectiveSchoolId} />
          )}

          {adminTab === 'kurulum' && effectiveSchoolId && !isTeacher && (
            <SmartBoardSetupWizard
              schoolId={effectiveSchoolId}
              token={token}
              classSections={classSections}
              devices={devices}
              schoolName={schools.find((s) => s.id === effectiveSchoolId)?.name}
              onAddDevice={handleAddDevice}
              onDevicesChanged={() => {
                void fetchDevices();
                void fetchStatus();
              }}
              onOpenSettings={() => router.push('/akilli-tahta?tab=ayarlar')}
            />
          )}

          {adminTab === 'ayarlar' && (
            <SmartBoardSettings
              schoolId={effectiveSchoolId!}
              token={token}
              canManage={canManage}
              devices={devices}
              authorizedCount={authorizedTeachers.length}
              floorPlanCount={floorPlans.length}
              floorPlacedCount={floorPlacedCount}
              classSections={classSections}
              onSaved={() => fetchSchoolForFloorPlan()}
              onEditDevice={(d) => {
                const full = devices.find((x) => x.id === d.id);
                if (full) setEditDevice(full);
              }}
            />
          )}
        </div>
      )}

      </DisplayModuleShell>

      <Dialog
        open={!!usbPinFor}
        onOpenChange={(open) => {
          if (!open) {
            setUsbPinFor(null);
            setUsbPinInput('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>USB sınıf tahtası PIN’i</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {usbPinFor?.display_name || usbPinFor?.email}. 4–8 rakam. Boş bırakıp kaydederseniz PIN kaldırılır.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="smart-board-usb-pin">PIN</Label>
            <Input
              id="smart-board-usb-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={usbPinInput}
              onChange={(e) => setUsbPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="••••"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={usbPinSaving}
              onClick={() => {
                setUsbPinFor(null);
                setUsbPinInput('');
              }}
            >
              İptal
            </Button>
            <Button type="button" disabled={usbPinSaving} onClick={() => void handleSaveUsbPin()}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!otpCodesFor}
        onOpenChange={(open) => {
          if (!open) {
            setOtpCodesFor(null);
            setOtpCodes([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tek kullanımlık OTP kodları</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {otpCodesFor?.display_name || otpCodesFor?.email} için üretildi. Bir kez gösterilir, güvenli paylaşın.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Kodlar</Label>
            <div className="rounded-md border bg-muted/20 p-3 font-mono text-sm leading-7">
              {otpCodes.length > 0 ? otpCodes.join('\n') : 'Kod yok'}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (otpCodes.length > 0) {
                  void navigator.clipboard.writeText(otpCodes.join('\n')).then(() => {
                    toast.success('OTP kodları kopyalandı.');
                  });
                }
              }}
            >
              Kopyala
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOtpCodesFor(null);
                setOtpCodes([]);
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editDevice && (
        <EditDeviceDialog
          device={editDevice}
          classSections={classSections}
          onClose={() => setEditDevice(null)}
          onSave={(name, roomOrLocation, classSection) => {
            handleUpdateDevice(editDevice.id, name, roomOrLocation, classSection);
          }}
        />
      )}

      {scheduleDevice && (
        <DeviceScheduleDialog
          device={scheduleDevice}
          open={!!scheduleDevice}
          onOpenChange={(v) => !v && setScheduleDevice(null)}
          token={token}
          schoolId={effectiveSchoolId ?? null}
          onSaved={() => {
            fetchDevices();
          }}
        />
      )}
    </>
  );
}

function TeacherSelectForAuth({
  token,
  schoolId,
  excludedIds,
  onSelect,
  trigger,
}: {
  token: string | null;
  schoolId: string;
  excludedIds: string[];
  onSelect: (userId: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; display_name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token || !schoolId) return;
    setLoading(true);
    apiFetch<{ items: { id: string; display_name: string | null; email: string }[] }>(
      `/users?school_id=${schoolId}&role=teacher&limit=100`,
      { token }
    )
      .then((r) => setTeachers((r.items || []).filter((t) => !excludedIds.includes(t.id))))
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false));
  }, [open, token, schoolId, excludedIds]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <p className="mb-4 text-sm text-muted-foreground">
          Tahtaya bağlanma yetkisi verilecek öğretmeni seçin.
        </p>
        {loading ? (
          <LoadingSpinner />
        ) : teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Eklenecek öğretmen kalmadı.</p>
        ) : (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {teachers.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
              >
                <span>{t.display_name || t.email}</span>
                <UserPlus className="size-4" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
