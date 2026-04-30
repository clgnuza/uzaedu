'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
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
  Puzzle,
  Tv,
  MapPin,
  Search,
  PowerOff,
  Filter,
  Table2,
  BarChart3,
  KeyRound,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Device, AuthorizedTeacher, Session, Status } from './types';
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
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { cn } from '@/lib/utils';

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
  const { token, me } = useAuth();
  const isTeacher = me?.role === 'teacher';
  const isSuperadmin = me?.role === 'superadmin';
  const adminTab = (searchParams.get('tab') as (typeof ADMIN_TABS)[number]['id']) || DEFAULT_ADMIN_TAB;

  const [schoolId, setSchoolId] = useState<string | null>(me?.school_id ?? null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
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
  const [teacherFilterMyClasses, setTeacherFilterMyClasses] = useState(false);
  const [yetkilerSearch, setYetkilerSearch] = useState('');
  const [usbPinFor, setUsbPinFor] = useState<AuthorizedTeacher | null>(null);
  const [usbPinInput, setUsbPinInput] = useState('');
  const [usbPinSaving, setUsbPinSaving] = useState(false);
  const [teacherDeviceSort, setTeacherDeviceSort] = useState<'recent' | 'name' | 'online'>('recent');
  const [schoolFilters, setSchoolFilters] = useState({ city: '', district: '' });
  const schoolFiltersRef = useRef(schoolFilters);
  schoolFiltersRef.current = schoolFilters;
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterDistricts, setFilterDistricts] = useState<string[]>([]);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);

  const effectiveSchoolId = schoolId || me?.school_id;
  const isSchoolAdmin = me?.role === 'school_admin';
  const canView = !isTeacher && effectiveSchoolId; // school_admin + superadmin
  const canManage = isSchoolAdmin && !!effectiveSchoolId; // sadece okul yöneticisi tahta ekler, yetki verir, sonlandırır

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
      setDevices(Array.isArray(res) ? res : []);
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
      const path = isSuperadmin
        ? `/teacher-timetable/distinct-class-sections?school_id=${effectiveSchoolId}`
        : '/teacher-timetable/distinct-class-sections';
      const res = await apiFetch<string[]>(path, { token });
      setClassSections(Array.isArray(res) ? res : []);
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
    fetchClassSections();
    fetchSchoolForFloorPlan();
  }, [token, effectiveSchoolId, fetchDevices, fetchAuthorizedTeachers, fetchSessionsToday, fetchClassSections, fetchSchoolForFloorPlan]);

  // Teacher: heartbeat ile bağlı kalma (2 dk timeout için ~45 sn aralık)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isTeacher || !token || !status?.mySession) return;
    const sessionId = status.mySession.session_id;
    const tick = () => {
      apiFetch('/smart-board/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      }).catch(() => {});
    };
    tick();
    heartbeatIntervalRef.current = setInterval(tick, 45_000);
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isTeacher, token, status?.mySession]);

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
      toast.success('Tahtaya bağlandınız.');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const msg =
        err?.code === 'DEVICE_BUSY'
          ? 'Bu tahta şu an başka bir öğretmen tarafından kullanılıyor. Lütfen ders bitimini bekleyin veya başka bir sınıf seçin.'
          : err?.message ?? 'Bağlanılamadı.';
      toast.error(msg);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    if (!token) return;
    try {
      await apiFetch('/smart-board/disconnect', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      });
      await fetchStatus();
      fetchDevices();
      toast.success('Bağlantı kesildi.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bağlantı kesilemedi.');
    }
  };

  const handleAdminDisconnect = async (sessionId: string) => {
    if (!token || !confirm('Bu bağlantıyı sonlandırmak istediğinize emin misiniz?')) return;
    try {
      await apiFetch('/smart-board/disconnect', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
        token,
      });
      fetchSessionsToday();
      toast.success('Bağlantı sonlandırıldı.');
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

  if (loading && !status) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>
            {isSuperadmin && effectiveSchoolId && schools.length > 0
              ? `Akıllı Tahta – ${schools.find((s) => s.id === effectiveSchoolId)?.name ?? 'Okul'}`
              : 'Akıllı Tahta'}
          </ToolbarPageTitle>
          {isSchoolAdmin && me?.school?.name && (
            <p className="max-w-[min(100%,22rem)] truncate text-[11px] font-semibold text-teal-700 dark:text-teal-300/95 lg:hidden">
              {me.school.name}
            </p>
          )}
          {!isTeacher ? (
            <div className="hidden min-w-0 lg:block">
              <ToolbarIconHints
                items={[
                  { label: 'Tahta cihazları', icon: Monitor },
                  { label: 'Yetkili öğretmenler', icon: Users },
                  { label: 'Bağlantı oturumları', icon: Activity },
                  { label: 'Ders programı verisi', icon: Table2 },
                  { label: 'Modül ayarı', icon: Puzzle },
                ]}
                summary="Tahta cihazları, yetkili öğretmenler ve bağlantı oturumları. Ders ve öğretmen bilgisi Ders Programı ayarlarından otomatik alınır. Modül aç/kapa Modüller sayfasından yapılır."
              />
            </div>
          ) : null}
        </ToolbarHeading>
        <ToolbarActions>
          {isSuperadmin && (
            <form
              onSubmit={(e) => { e.preventDefault(); fetchSchools(); }}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                value={schoolFilters.city}
                onChange={(e) => setSchoolFilters((f) => ({ ...f, city: e.target.value, district: '' }))}
                className="w-28 rounded border border-input bg-background px-2 py-1.5 text-sm"
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
                className="w-28 rounded border border-input bg-background px-2 py-1.5 text-sm"
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
                  <SelectTrigger className="w-full sm:w-[200px]" aria-label="Okul seçin">
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
          )}
          {isSuperadmin && schools.length === 0 && !loading && (
            <span className="text-sm text-muted-foreground">
              {schoolsError
                ? schoolsError
                : schoolFilters.city || schoolFilters.district
                  ? 'Bu il/ilçede okul bulunamadı. Filtreleri temizleyip tekrar deneyin.'
                  : 'Henüz okul yok. Okullar sayfasından okul ekleyin.'}
            </span>
          )}
          {isSchoolAdmin && effectiveSchoolId && (
            <Link href="/tv" className="inline-flex min-w-0">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 shrink-0 gap-1 px-2 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm',
                  'max-sm:border-teal-500/45 max-sm:bg-teal-500/8 max-sm:text-teal-900 hover:max-sm:bg-teal-500/14 dark:max-sm:border-teal-600/40 dark:max-sm:bg-teal-950/35 dark:max-sm:text-teal-100',
                )}
              >
                <Tv className="size-3.5 shrink-0 sm:mr-0 sm:size-4" />
                <span className="max-sm:hidden">Duyuru TV</span>
                <span className="sm:hidden">TV</span>
              </Button>
            </Link>
          )}
        </ToolbarActions>
      </Toolbar>

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

      {isTeacher && (
        <TeacherSmartBoardHero
          status={status}
          deviceCount={devices.length}
          schoolName={me?.school?.name}
        />
      )}

      {isTeacher && status?.mySession && (
        <div className="mb-3 sticky top-0 z-10 flex flex-col gap-2 rounded-xl border-2 border-emerald-500/45 bg-emerald-500/10 px-2.5 py-2 shadow-md sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 sm:size-10">
              <Monitor className="size-4 text-emerald-700 sm:size-5 dark:text-emerald-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-emerald-900 dark:text-emerald-100">
                {status.mySession.device_name}
              </p>
              <p className="text-xs text-muted-foreground">Bağlantı aktif</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40 sm:w-auto"
            onClick={() => handleDisconnect(status.mySession!.session_id)}
          >
            <PowerOff className="mr-1 size-4" />
            Bağlantıyı kes
          </Button>
        </div>
      )}

      {isTeacher && status?.authorized && (
        <Card className="mb-2 overflow-hidden border-teal-200/45 shadow-sm dark:border-teal-900/35 sm:mb-6">
          <CardHeader className="space-y-2 border-b border-teal-200/40 bg-teal-500/6 px-2.5 py-2 dark:border-teal-900/40 sm:space-y-0 sm:px-6 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 sm:size-8">
                <Monitor className="size-3.5 text-teal-700 dark:text-teal-400 sm:size-4" />
              </span>
              Tahtalar
            </CardTitle>
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
                      { id: 'recent' as const, label: 'Son kullanılan' },
                      { id: 'name' as const, label: 'Ada göre' },
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
                {status.myClassSections && status.myClassSections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTeacherFilterMyClasses((v) => !v)}
                    className={`flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-[10px] font-medium transition-colors sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm ${
                      teacherFilterMyClasses
                        ? 'border-teal-600 bg-teal-500/15 text-teal-900 dark:border-teal-500 dark:text-teal-100'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Filter className="size-3 sm:size-4" />
                    Sınıflarım
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="px-2.5 py-2 sm:px-6 sm:py-6">
            {devices.length === 0 ? (
              <EmptyState
                icon={<Monitor className="size-10 text-muted-foreground" />}
                title="Tahta bulunamadı"
                description="Okulunuzda henüz kayıtlı tahta yok. İdareyle iletişime geçin."
              />
            ) : (() => {
              const lastConnected =
                effectiveSchoolId && typeof window !== 'undefined'
                  ? (() => {
                      try {
                        return localStorage.getItem(`smartboard-last-${effectiveSchoolId}`);
                      } catch {
                        return null;
                      }
                    })()
                  : null;
              const myClassesSet =
                teacherFilterMyClasses && status.myClassSections?.length
                  ? new Set(status.myClassSections.map((c) => c.toUpperCase()))
                  : null;
              const q = teacherSearch.trim().toLowerCase();
              let filtered = devices.filter((d) => {
                if (myClassesSet && d.classSection) {
                  if (!myClassesSet.has(d.classSection.trim().toUpperCase())) return false;
                }
                if (!q) return true;
                const name = (d.name ?? '').toLowerCase();
                const room = (d.roomOrLocation ?? '').toLowerCase();
                const cs = (d.classSection ?? '').toLowerCase();
                const code = (d.pairing_code ?? '').toLowerCase();
                return name.includes(q) || room.includes(q) || cs.includes(q) || code.includes(q);
              });
              filtered = filtered.sort((a, b) => {
                if (teacherDeviceSort === 'online') {
                  const ao = a.status === 'online' ? 0 : 1;
                  const bo = b.status === 'online' ? 0 : 1;
                  if (ao !== bo) return ao - bo;
                }
                if (teacherDeviceSort === 'recent' && lastConnected) {
                  if (a.id === lastConnected) return -1;
                  if (b.id === lastConnected) return 1;
                }
                return (a.name ?? '').localeCompare(b.name ?? '', 'tr');
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

      {canView && (
        <>
          {isSuperadmin && (
            <Alert variant="info" className="mb-3 text-[11px] leading-snug sm:mb-6 sm:text-sm">
              Tahta ekleme, yetki ve oturum sonlandırma okul yöneticisindedir. Modül aç/kapa: Okullar.
            </Alert>
          )}

          <div
            className={cn(
              'akilli-tahta-admin-scope min-w-0 max-w-full overflow-x-hidden',
              isSchoolAdmin && 'akilli-tahta-school-admin',
            )}
          >
            <div className="mobile-tab-scroll akilli-tahta-tabnav -mx-0.5 mb-1.5 min-w-0 px-0.5 pb-0.5 sm:mx-0 sm:mb-6 sm:px-0 sm:pb-0">
              <nav
                className={cn(
                  'flex w-full min-w-0 snap-x snap-mandatory gap-0.5 overflow-x-auto overscroll-x-contain p-0.5 [scrollbar-width:none] sm:flex-wrap sm:gap-1 sm:overflow-visible sm:rounded-2xl sm:border sm:border-border/70 sm:bg-muted/40 sm:p-1.5 sm:shadow-sm sm:snap-none [&::-webkit-scrollbar]:hidden',
                  isSchoolAdmin
                    ? 'max-sm:rounded-xl max-sm:border max-sm:border-teal-500/45 max-sm:bg-linear-to-br max-sm:from-teal-500/15 max-sm:via-sky-500/8 max-sm:to-muted/40 max-sm:shadow-md max-sm:ring-1 max-sm:ring-teal-500/20 dark:max-sm:border-teal-500/30 dark:max-sm:from-teal-950/40 dark:max-sm:via-sky-950/20 dark:max-sm:to-background/90 dark:max-sm:ring-teal-900/30'
                    : 'max-sm:rounded-xl max-sm:border max-sm:border-border/70 max-sm:bg-linear-to-b max-sm:from-muted/50 max-sm:to-muted/30 max-sm:shadow-sm dark:max-sm:border-border/80',
                )}
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
                        'flex min-h-0 shrink-0 snap-start flex-col items-center justify-center gap-0 rounded-md border px-1.5 py-1 text-center text-[8px] font-semibold leading-none transition-all duration-200 max-sm:min-w-14 sm:min-h-0 sm:flex-initial sm:flex-row sm:gap-2 sm:rounded-xl sm:border-2 sm:px-3 sm:py-2.5 sm:text-left sm:text-sm sm:leading-tight',
                        isActive
                          ? cn(getTabActiveStyles(t.accent), 'max-sm:ring-1 max-sm:ring-offset-0 max-sm:shadow-sm')
                          : cn('text-muted-foreground active:opacity-90', idleTint, 'sm:border-transparent sm:bg-transparent sm:hover:bg-background/90'),
                      )}
                    >
                      <Icon className="size-3 shrink-0 sm:size-4" />
                      <span className="line-clamp-2 max-sm:leading-[1.1] sm:hidden">{t.shortLabel}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

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
                    Sekmeler veya aşağıdaki kısayollar. Ders bilgisi: Ders Programı.
                  </p>
                </CardHeader>
                <CardContent className="px-2.5 pb-2.5 pt-0 sm:px-6 sm:pb-6">
                  <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-3">
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
                <div className="flex gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50/70 px-2 py-1.5 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/35 dark:text-sky-100 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
                  <Tv className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400 sm:size-5" aria-hidden />
                  <div className="max-h-38 min-w-0 space-y-0.5 overflow-y-auto pr-0.5 sm:max-h-none sm:space-y-1 sm:overflow-visible">
                    <p className="text-[11px] font-semibold leading-tight text-foreground sm:text-sm">Duyuru TV · sınıf ekranı</p>
                    <ol className="list-decimal space-y-0.5 pl-3 text-[10px] leading-snug text-muted-foreground sm:space-y-1 sm:pl-4 sm:text-xs sm:leading-relaxed">
                      <li>
                        Bu listede <strong className="text-foreground">Tahta Ekle</strong> ile cihaz oluşturun;{' '}
                        <strong className="text-foreground">eşleme kodunu</strong> sınıftaki tahta uygulamasında girin (tahta ↔ panel kaydı).
                      </li>
                      <li>
                        Aynı satırda <strong className="text-foreground">Duyuru TV</strong> ile o sınıfa özel{' '}
                        <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[11px]">/tv/classroom</code> adresini kopyalayın; tahtanın{' '}
                        <strong className="text-foreground">tarayıcısında</strong> yapıştırıp açın — koridor/öğretmenler ekranlarından farklıdır; her tahta kendi{' '}
                        <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[11px]">device_id</code> ile gelir.
                      </li>
                      <li>
                        Duyurularda hedef <strong className="text-foreground">Akıllı Tahta</strong> seçilirse içerik bu ekranda döner. İsteğe bağlı: URL sonuna{' '}
                        <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[11px]">?kiosk=1</code>.
                      </li>
                    </ol>
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
                    onRefresh={() => {
                      fetchDevices();
                      fetchSessionsToday();
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

          {adminTab === 'istatistikler' && effectiveSchoolId && (
            <SmartBoardUsagePanel token={token} schoolId={effectiveSchoolId} />
          )}

          {adminTab === 'ayarlar' && (
            <SmartBoardSettings
              schoolId={effectiveSchoolId!}
              token={token}
              canManage={canManage}
              devices={devices}
              authorizedCount={authorizedTeachers.length}
              classSections={classSections}
              onSaved={() => fetchSchoolForFloorPlan()}
              onEditDevice={(d) => {
                const full = devices.find((x) => x.id === d.id);
                if (full) setEditDevice(full);
              }}
            />
          )}
          </div>
        </>
      )}

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
