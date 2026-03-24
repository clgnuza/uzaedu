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
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  Activity,
  Settings,
  Puzzle,
  Tv,
  MapPin,
  Search,
  PowerOff,
  Filter,
  Info,
  Table2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Device, AuthorizedTeacher, Session, Status } from './types';
import { TeacherDeviceCard } from './components/TeacherDeviceCard';
import { DeviceTable } from './components/DeviceTable';
import { SessionTable } from './components/SessionTable';
import { EditDeviceDialog } from './components/EditDeviceDialog';
import { AddDeviceDialog } from './components/AddDeviceDialog';
import { DeviceScheduleDialog } from './components/DeviceScheduleDialog';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { SmartBoardSettings } from './components/SmartBoardSettings';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';

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
  { id: 'genel-bakis', label: 'Genel Bakış', icon: LayoutDashboard, accent: 'primary' },
  { id: 'cihazlar', label: 'Cihazlar', icon: Monitor, accent: 'teal' },
  { id: 'yerlesim', label: 'Yerleşim', icon: MapPin, accent: 'amber' },
  { id: 'yetkiler', label: 'Yetkili Öğretmenler', icon: Users, accent: 'violet' },
  { id: 'oturumlar', label: 'Oturumlar', icon: Activity, accent: 'emerald' },
  { id: 'ayarlar', label: 'Ayarlar', icon: Settings, accent: 'slate' },
] as const;

function getTabActiveStyles(accent: string): string {
  const map: Record<string, string> = {
    primary: 'bg-primary/12 text-primary border-primary/30 dark:bg-primary/20',
    teal: 'bg-teal-500/12 text-teal-700 border-teal-500/30 dark:bg-teal-400/20 dark:text-teal-300',
    amber: 'bg-amber-500/12 text-amber-700 border-amber-500/30 dark:bg-amber-400/20 dark:text-amber-300',
    violet: 'bg-violet-500/12 text-violet-700 border-violet-500/30 dark:bg-violet-400/20 dark:text-violet-300',
    emerald: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/20 dark:text-emerald-300',
    slate: 'bg-slate-500/12 text-slate-700 border-slate-500/30 dark:bg-slate-400/20 dark:text-slate-300',
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
                  <SelectTrigger className="w-[200px]" aria-label="Okul seçin">
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
            <Link href="/tv" className="inline-flex">
              <Button variant="outline" size="sm">
                <Tv className="mr-2 size-4" />
                Duyuru TV
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="size-5" />
              Modül Durumu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status ? (
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  {status.enabled ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <XCircle className="size-5 text-red-500" />
                  )}
                  <span>{status.enabled ? 'Modül açık' : 'Modül kapalı'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {status.authorized ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <XCircle className="size-5 text-amber-500" />
                  )}
                  <span>
                    {status.authorized
                      ? 'Tahtaya bağlanma yetkiniz var'
                      : 'Henüz yetkili değilsiniz. Okul idaresiyle iletişime geçerek tahtaya bağlanma yetkisi talep edin.'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Durum yükleniyor…</p>
            )}
          </CardContent>
        </Card>
      )}

      {isTeacher && status?.mySession && (
        <div className="mb-6 sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-3 shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/20">
              <Monitor className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                {status.mySession.device_name} sınıfına bağlısınız
              </p>
              <p className="text-sm text-muted-foreground">Bağlantı aktif. Tahtayı kullanabilirsiniz.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
            onClick={() => handleDisconnect(status.mySession!.session_id)}
          >
            <PowerOff className="mr-1 size-4" />
            Bağlantıyı Kes
          </Button>
        </div>
      )}

      {isTeacher && status?.authorized && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tahtalar</CardTitle>
            {devices.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Sınıf, lokasyon veya tahta adı ara…"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                {status.myClassSections && status.myClassSections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTeacherFilterMyClasses((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      teacherFilterMyClasses
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Filter className="size-4" />
                    Benim sınıflarım
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
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
                if (lastConnected) {
                  if (a.id === lastConnected) return -1;
                  if (b.id === lastConnected) return 1;
                }
                return (a.name ?? '').localeCompare(b.name ?? '');
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
            <Alert variant="info" className="mb-6">
              Tahta ekleme, yetki verme ve bağlantı sonlandırma işlemleri okul yöneticisi tarafından yapılır. Modül aç/kapa için Okullar sayfasını kullanın.
            </Alert>
          )}

          <div className="mb-6 overflow-x-auto">
            <nav
              className="flex min-w-max gap-0.5 rounded-xl border border-border/80 bg-muted/30 p-1.5"
              aria-label="Akıllı Tahta sekmeleri"
            >
              {ADMIN_TABS.map((t) => {
                const Icon = t.icon;
                const isActive = adminTab === t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/akilli-tahta?tab=${t.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? `${getTabActiveStyles(t.accent)} shadow-sm`
                        : 'border-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground'
                    }`}
                  >
                    <Icon className={`shrink-0 ${isActive ? 'size-5' : 'size-4'}`} />
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {adminTab === 'genel-bakis' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md hover:border-teal-200 dark:hover:border-teal-900/40">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Kayıtlı Tahta</CardTitle>
                    <div className="rounded-xl bg-teal-500/15 p-2.5">
                      <Monitor className="size-5 text-teal-600 dark:text-teal-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tracking-tight">{devices.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Toplam cihaz</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900/40">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Çevrimiçi</CardTitle>
                    <div className="rounded-xl bg-emerald-500/15 p-2.5">
                      <Monitor className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      {devices.filter((d) => d.status === 'online').length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Şu an aktif</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md hover:border-violet-200 dark:hover:border-violet-900/40">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Yetkili Öğretmen</CardTitle>
                    <div className="rounded-xl bg-violet-500/15 p-2.5">
                      <Users className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tracking-tight">{authorizedTeachers.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Bağlanabilir</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md hover:border-amber-200 dark:hover:border-amber-900/40">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Bugün Bağlanan</CardTitle>
                    <div className="rounded-xl bg-amber-500/15 p-2.5">
                      <Activity className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tracking-tight">{sessionsToday.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Oturum sayısı</p>
                  </CardContent>
                </Card>
              </div>
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Hızlı Erişim</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Tahta ekleme, yetki verme ve oturum yönetimi için ilgili sekmelere gidin. Ders/öğretmen bilgisi için Ders Programı ayarlarınızı güncelleyin.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/ders-programi">
                      <Button variant="secondary" size="sm">
                        Ders Programı
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=cihazlar">
                      <Button variant="outline" size="sm" className="border-teal-200 hover:bg-teal-50 hover:border-teal-300 dark:border-teal-800 dark:hover:bg-teal-950/50">
                        <Monitor className="mr-2 size-4 text-teal-600 dark:text-teal-400" />
                        Cihazlar
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=yerlesim">
                      <Button variant="outline" size="sm" className="border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/50">
                        <MapPin className="mr-2 size-4 text-amber-600 dark:text-amber-400" />
                        Yerleşim
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=yetkiler">
                      <Button variant="outline" size="sm" className="border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:border-violet-800 dark:hover:bg-violet-950/50">
                        <Users className="mr-2 size-4 text-violet-600 dark:text-violet-400" />
                        Yetkili Öğretmenler
                      </Button>
                    </Link>
                    <Link href="/akilli-tahta?tab=oturumlar">
                      <Button variant="outline" size="sm" className="border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/50">
                        <Activity className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                        Oturumlar
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {adminTab === 'cihazlar' && (
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="size-5" />
                  Tahta Cihazları
                </CardTitle>
                {canManage && (
                  <AddDeviceDialog
                    open={addDeviceOpen}
                    onOpenChange={setAddDeviceOpen}
                    onAdd={handleAddDevice}
                    onDeviceCreated={(device) => {
                      setDevices((d) => [...d, device]);
                      toast.success('Tahta eklendi. Eşleme kodu: ' + device.pairing_code);
                    }}
                    trigger={
                      <Button size="sm">
                        <Plus className="mr-2 size-4" />
                        Tahta Ekle
                      </Button>
                    }
                  />
                )}
              </CardHeader>
              <CardContent>
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
            <div className="space-y-4">
              <Card className="border-violet-200/80 bg-violet-50/30 dark:border-violet-900/50 dark:bg-violet-950/20">
                <CardContent className="flex gap-3 pt-4">
                  <Info className="size-5 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Bu listedeki öğretmenler Akıllı Tahta sayfasından tahtaya bağlanabilir. <strong className="text-foreground">Otomatik yetki</strong> açıksa (Ayarlar) tüm öğretmenler bağlanabilir ve bu liste görüntüleme amaçlıdır.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <div className="rounded-lg bg-violet-500/15 p-2">
                      <Users className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    Yetkili Öğretmenler
                    <span className="text-base font-normal text-muted-foreground">
                      ({authorizedTeachers.length})
                    </span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {authorizedTeachers.length > 3 && (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="search"
                          placeholder="Öğretmen ara…"
                          value={yetkilerSearch}
                          onChange={(e) => setYetkilerSearch(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm sm:w-48"
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
                          <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                            <UserPlus className="mr-2 size-4" />
                            Yetki Ver
                          </Button>
                        }
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
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
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left font-medium">Öğretmen</th>
                              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">E-posta</th>
                              <th className="px-4 py-3 text-left font-medium">Durum</th>
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
        </>
      )}

      {isTeacher && !status?.authorized && (
        <Alert variant="info">
          Tahtaya bağlanma yetkiniz yok. İdareyle iletişime geçerek yetki talep edebilirsiniz.
        </Alert>
      )}

      {editDevice && (
        <EditDeviceDialog
          device={editDevice}
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
