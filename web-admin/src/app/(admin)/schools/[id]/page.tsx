'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  School,
  Save,
  ScrollText,
  Globe,
  Phone,
  FileText,
  Pencil,
  MapPin,
  Mail,
  Printer,
  Map,
  Wallet,
  Coins,
  Search,
  CalendarRange,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Input } from '@/components/ui/input';
import { SCHOOL_MODULE_OPTIONS as MODULE_OPTIONS } from '@/config/school-modules';
import {
  formatSchoolTypeLabel,
  MEB_INSTITUTION_CODE_HINT,
  INSTITUTIONAL_EMAIL_HINT,
  SCHOOL_TYPE_LABELS,
  SCHOOL_TYPE_ORDER,
} from '@/lib/school-labels';
const SCHOOL_SEGMENT_LABELS: Record<string, string> = { ozel: 'Özel', devlet: 'Devlet' };
const SCHOOL_STATUS_LABELS: Record<string, string> = { deneme: 'Deneme', aktif: 'Aktif', askida: 'Askıda' };
const ACTION_LABELS: Record<string, string> = {
  login: 'Giriş',
  failed_login: 'Başarısız giriş',
  register: 'Kayıt',
  school_created: 'Okul oluşturuldu',
  school_updated: 'Okul güncellendi',
  password_changed: 'Şifre değişti',
  data_export: 'Veri dışa aktarma',
  data_import: 'Veri içe aktarma',
  account_deleted: 'Hesap silindi',
  SMARTBOARD_DEVICE_CREATED: 'Akıllı tahta: cihaz eklendi',
  SMARTBOARD_DEVICE_REMOVED: 'Akıllı tahta: cihaz kaldırıldı',
  SMARTBOARD_TEACHER_AUTHORIZED: 'Akıllı tahta: öğretmen yetkisi verildi',
  SMARTBOARD_TEACHER_UNAUTHORIZED: 'Akıllı tahta: öğretmen yetkisi kaldırıldı',
};

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'failed_login', label: 'Hatalar' },
  { value: 'login', label: 'Girişler' },
  { value: 'register', label: 'Kayıtlar' },
  { value: 'school_updated', label: 'Okul güncellemeleri' },
  { value: 'school_created', label: 'Okul oluşturma' },
  { value: 'data_import', label: 'Veri içe aktarma' },
  { value: 'data_export', label: 'Veri dışa aktarma' },
  { value: 'password_changed', label: 'Şifre değişimi' },
  { value: 'account_deleted', label: 'Hesap silindi' },
];

const FIELD_LABELS: Record<string, string> = {
  name: 'Okul adı',
  type: 'Kurum türü',
  segment: 'Segment',
  city: 'İl',
  district: 'İlçe',
  website_url: 'Web sitesi',
  phone: 'Telefon',
  fax: 'Belgegeçer',
  institution_code: 'Kurum kodu',
  institutional_email: 'Kurumsal e-posta',
  address: 'Adres',
  map_url: 'Harita',
  school_image_url: 'Okul görseli',
  about_description: 'Detaylı bilgi',
  status: 'Durum',
  teacher_limit: 'Öğretmen limiti',
  enabled_modules: 'Modüller',
  tv_weather_city: 'TV hava durumu',
  tv_welcome_image_url: 'TV hoş geldin görseli',
  tv_logo_url: 'TV logo',
};

function formatLogActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function logCategoryClass(action: string): string {
  if (action === 'failed_login') return 'bg-destructive/15 text-destructive border-destructive/25';
  if (action === 'login' || action === 'register') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20';
  if (action === 'school_updated' || action === 'school_created') return 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20';
  if (action.startsWith('SMARTBOARD_')) return 'bg-violet-500/10 text-violet-800 dark:text-violet-200 border-violet-500/20';
  if (action === 'data_export' || action === 'data_import') return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function formatLogDetail(log: AuditLogItem): string {
  const meta = (log.meta ?? {}) as Record<string, unknown>;
  const keys = Object.keys(meta);

  if (log.action === 'login' && keys.length === 0) return 'E-posta ile giriş';

  if (log.action === 'register') {
    if (meta.with_school === true) return 'Bu okulla kayıt';
    if (meta.with_school === false) return 'Okul seçilmeden kayıt';
    return '';
  }

  if (keys.length === 0) return '';

  if (log.action === 'school_updated' && Array.isArray(meta.fields)) {
    const labels = (meta.fields as string[]).map((f) => FIELD_LABELS[f] ?? f).join(', ');
    return labels ? `Alanlar: ${labels}` : '';
  }
  if (log.action === 'school_created' && meta.name) {
    return `Ad: "${meta.name}"`;
  }
  if (log.action === 'school_created' && meta.bulk) {
    return 'Toplu içe aktarma';
  }
  if (log.action === 'login' && meta.provider === 'firebase') {
    return 'Google / Apple / telefon ile giriş';
  }
  if (log.action === 'failed_login') {
    if (meta.reason === 'wrong_password') return 'Yanlış şifre';
    if (meta.reason) return `Neden: ${String(meta.reason)}`;
  }
  if (log.action === 'data_import') {
    const scope = meta.scope != null ? String(meta.scope) : '';
    return scope ? `İçe aktarma (${scope})` : 'Kişisel veri içe aktarıldı';
  }
  if (log.action === 'data_export') {
    return 'Kişisel veri dışa aktarıldı';
  }
  if (log.action === 'SMARTBOARD_DEVICE_CREATED') {
    const code = meta.pairingCode ?? meta.pairing_code;
    return code ? `Eşleştirme kodu: ${code}` : 'Yeni cihaz';
  }
  if (log.action === 'SMARTBOARD_DEVICE_REMOVED') {
    return meta.deviceId ? `Cihaz: ${String(meta.deviceId).slice(0, 8)}…` : 'Cihaz kaldırıldı';
  }
  if (log.action === 'SMARTBOARD_TEACHER_AUTHORIZED' && meta.addedUserId) {
    return `Öğretmen ID: ${String(meta.addedUserId).slice(0, 8)}…`;
  }
  if (log.action === 'SMARTBOARD_TEACHER_UNAUTHORIZED' && meta.removedUserId) {
    return `Öğretmen ID: ${String(meta.removedUserId).slice(0, 8)}…`;
  }

  const parts = Object.entries(meta)
    .filter(([k, v]) => k !== 'bulk' && v != null && v !== '')
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${String(v)}`)
    .filter(Boolean);
  return parts.join(' · ') || '';
}

function formatLogUser(log: AuditLogItem): string {
  const u = log.user as { display_name?: string | null; email?: string } | undefined;
  if (!u) return '—';
  if (u.display_name) return u.display_name;
  if (u.email) return u.email;
  return '—';
}

function formatRelativeTr(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 45) return 'az önce';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa. önce`;
  if (diffSec < 86400 * 14) return `${Math.floor(diffSec / 86400)} gün önce`;
  return '';
}

function downloadAuditCsv(items: AuditLogItem[], filenameBase: string) {
  const headers = ['Tarih (ISO)', 'İşlem', 'Kullanıcı', 'Açıklama', 'IP'];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(';'),
    ...items.map((log) =>
      [
        new Date(log.created_at).toISOString(),
        formatLogActionLabel(log.action),
        formatLogUser(log),
        formatLogDetail(log),
        log.ip ?? '',
      ]
        .map((c) => esc(String(c)))
        .join(';'),
    ),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filenameBase}-aktivite.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

type SchoolDetail = {
  id: string;
  name: string;
  type: string;
  segment: string;
  city: string | null;
  district: string | null;
  website_url?: string | null;
  phone?: string | null;
  fax?: string | null;
  institutionCode?: string | null;
  institutionalEmail?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  schoolImageUrl?: string | null;
  about_description?: string | null;
  status: string;
  teacher_limit: number;
  enabled_modules: string[] | null;
  marketJetonBalance?: string | number | null;
  marketEkdersBalance?: string | number | null;
  created_at: string;
  updated_at: string;
};

type SchoolCreditRow = {
  id: string;
  jeton_credit: number;
  ekders_credit: number;
  note: string | null;
  created_at: string;
  created_by_user_id: string;
  creator_email: string | null;
  creator_display_name: string | null;
};

function fmtNum(n: unknown): string {
  const x = typeof n === 'number' ? n : parseFloat(String(n ?? '0'));
  if (!Number.isFinite(x)) return '0';
  return Number.isInteger(x) ? String(x) : x.toFixed(4).replace(/\.?0+$/, '');
}

function parsePositiveAmount(s: string): number {
  const x = parseFloat(String(s).replace(',', '.').trim());
  if (!Number.isFinite(x) || x < 0) return 0;
  return x;
}

function parseBalanceNum(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n ?? '0').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}

type AuditLogItem = {
  id: string;
  action: string;
  user_id: string | null;
  school_id: string | null;
  user?: { display_name: string | null; email: string } | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [logs, setLogs] = useState<{ total: number; page: number; limit: number; items: AuditLogItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logActionFilter, setLogActionFilter] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logLimit, setLogLimit] = useState(20);
  const [logSearch, setLogSearch] = useState('');
  const [logsFetching, setLogsFetching] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    status: 'aktif' as string,
    type: 'ilkokul' as string,
    website_url: '',
    phone: '',
    fax: '',
    institution_code: '',
    institutional_email: '',
    address: '',
    map_url: '',
    school_image_url: '',
    about_description: '',
    city: '',
    district: '',
  });
  const [logsError, setLogsError] = useState<string | null>(null);
  const [creditRows, setCreditRows] = useState<SchoolCreditRow[]>([]);
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditPage, setCreditPage] = useState(1);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditFrom, setCreditFrom] = useState('');
  const [creditTo, setCreditTo] = useState('');
  const [addJeton, setAddJeton] = useState('');
  const [addEkders, setAddEkders] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addingCredit, setAddingCredit] = useState(false);
  const isSuperadmin = me?.role === 'superadmin';

  const fetchSchool = useCallback(async () => {
    if (!token || !id) return;
    try {
      const s = await apiFetch<SchoolDetail>(`/schools/${id}`, { token });
      setSchool(s);
      setInfoForm({
        status: s.status ?? 'aktif',
        type: s.type ?? 'ilkokul',
        website_url: s.website_url ?? '',
        phone: s.phone ?? '',
        fax: s.fax ?? '',
        institution_code: s.institutionCode ?? '',
        institutional_email: s.institutionalEmail ?? '',
        address: s.address ?? '',
        map_url: s.mapUrl ?? '',
        school_image_url: s.schoolImageUrl ?? '',
        about_description: s.about_description ?? '',
        city: s.city ?? '',
        district: s.district ?? '',
      });
      if (s.enabled_modules === null || s.enabled_modules === undefined) {
        setModules(MODULE_OPTIONS.map((m) => m.key));
      } else {
        setModules(s.enabled_modules);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okul yüklenemedi');
    }
  }, [token, id]);

  const fetchLogs = useCallback(async () => {
    if (!token || !id) return;
    setLogsError(null);
    setLogsFetching(true);
    try {
      const params = new URLSearchParams({
        school_id: id,
        page: String(logPage),
        limit: String(logLimit),
      });
      if (logActionFilter) params.set('action', logActionFilter);
      if (logDateFrom.trim()) {
        params.set('from', new Date(`${logDateFrom.trim()}T00:00:00`).toISOString());
      }
      if (logDateTo.trim()) {
        params.set('to', new Date(`${logDateTo.trim()}T23:59:59.999`).toISOString());
      }
      const res = await apiFetch<{ total: number; page: number; limit: number; items: AuditLogItem[] }>(
        `/audit-logs?${params}`,
        { token }
      );
      setLogs(res);
    } catch (e) {
      setLogs({ total: 0, page: 1, limit: logLimit, items: [] });
      setLogsError(e instanceof Error ? e.message : 'Loglar yüklenemedi');
    } finally {
      setLogsFetching(false);
    }
  }, [token, id, logPage, logActionFilter, logDateFrom, logDateTo, logLimit]);

  const filteredLogItems = useMemo(() => {
    if (!logs?.items?.length) return [];
    const q = logSearch.trim().toLowerCase();
    if (!q) return logs.items;
    return logs.items.filter((log) => {
      const blob = [
        formatLogActionLabel(log.action),
        formatLogUser(log),
        formatLogDetail(log),
        log.ip ?? '',
        new Date(log.created_at).toLocaleString('tr-TR'),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [logs, logSearch]);

  const logTotalPages = logs ? Math.max(1, Math.ceil(logs.total / (logs.limit || 1))) : 1;

  const fetchCredits = useCallback(async () => {
    if (!token || !id) return;
    setCreditLoading(true);
    try {
      const q = new URLSearchParams({ page: String(creditPage), limit: '20' });
      if (creditFrom.trim()) q.set('from', creditFrom.trim());
      if (creditTo.trim()) q.set('to', creditTo.trim());
      const res = await apiFetch<{ total: number; items: SchoolCreditRow[] }>(
        `/market/admin/schools/${id}/credits?${q}`,
        { token }
      );
      setCreditRows(res.items);
      setCreditTotal(res.total);
    } catch {
      setCreditRows([]);
      setCreditTotal(0);
    } finally {
      setCreditLoading(false);
    }
  }, [token, id, creditPage, creditFrom, creditTo]);

  useEffect(() => {
    if (!token || !id) {
      if (!token) return;
      if (!id) setError('Geçersiz okul');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchSchool().finally(() => setLoading(false));
  }, [token, id, fetchSchool]);

  useEffect(() => {
    if (token && id) fetchLogs();
  }, [token, id, logPage, logActionFilter, fetchLogs]);

  useEffect(() => {
    if (token && id && school && isSuperadmin) fetchCredits();
  }, [token, id, school, isSuperadmin, fetchCredits]);

  const handleAddSchoolCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;
    const j = parsePositiveAmount(addJeton);
    const ek = parsePositiveAmount(addEkders);
    if (j <= 0 && ek <= 0) {
      toast.error('Jeton veya ek ders için 0’dan büyük bir değer girin');
      return;
    }
    setAddingCredit(true);
    try {
      await apiFetch(`/market/admin/schools/${id}/credits`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          jeton: j,
          ekders: ek,
          note: addNote.trim() || undefined,
        }),
      });
      toast.success('Bakiye eklendi');
      setAddJeton('');
      setAddEkders('');
      setAddNote('');
      await fetchSchool();
      await fetchCredits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eklenemedi');
    } finally {
      setAddingCredit(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!token || !id) return;
    setSaving(true);
    try {
      await apiFetch(`/schools/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          ...(isSuperadmin && { status: infoForm.status, type: infoForm.type }),
          website_url: infoForm.website_url.trim() || null,
          phone: infoForm.phone.trim() || null,
          fax: infoForm.fax.trim() || null,
          institution_code: infoForm.institution_code.trim() || null,
          institutional_email: infoForm.institutional_email.trim() || null,
          address: infoForm.address.trim() || null,
          map_url: infoForm.map_url.trim() || null,
          school_image_url: infoForm.school_image_url.trim() || null,
          about_description: infoForm.about_description.trim() || null,
          city: infoForm.city.trim() || null,
          district: infoForm.district.trim() || null,
        }),
      });
      toast.success('Okul bilgileri kaydedildi');
      setEditInfo(false);
      fetchSchool();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModules = async () => {
    if (!token || !id) return;
    setSaving(true);
    try {
      const payload = modules.length === MODULE_OPTIONS.length ? { enabled_modules: null } : { enabled_modules: modules };
      await apiFetch(`/schools/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
      toast.success('Modül ayarları kaydedildi');
      fetchSchool();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="space-y-6">
        <Alert message="Geçersiz okul kimliği" />
        <Link href="/schools" className="text-sm text-primary hover:underline">
          ← Okullara dön
        </Link>
      </div>
    );
  }

  if (!isSuperadmin) {
    router.replace('/403');
    return null;
  }

  if (loading && !school) {
    return <LoadingSpinner label="Okul yükleniyor…" className="py-12" />;
  }

  if (error || !school) {
    return (
      <div className="space-y-6">
        {error && <Alert message={error} />}
        <Link href="/schools" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" /> Okullara dön
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>{school.name}</ToolbarPageTitle>
          <ToolbarIconHints
            compact
            items={[
              { label: 'Okul tipi', icon: School },
              { label: 'Konum', icon: MapPin },
            ]}
            summary={`${formatSchoolTypeLabel(school.type)} • ${SCHOOL_SEGMENT_LABELS[school.segment] ?? school.segment}${school.city ? ` • ${[school.city, school.district].filter(Boolean).join(' / ')}` : ''}`}
          />
        </ToolbarHeading>
        <ToolbarActions>
          <Link
            href="/schools"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Okullara dön
          </Link>
        </ToolbarActions>
      </Toolbar>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🏫</span>
              Okul Bilgileri
            </CardTitle>
            {!editInfo ? (
              <button
                type="button"
                onClick={() => setEditInfo(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <Pencil className="size-4" />
                Düzenle
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditInfo(false);
                    setInfoForm({
                      status: school.status ?? 'aktif',
                      type: school.type ?? 'ilkokul',
                      website_url: school.website_url ?? '',
                      phone: school.phone ?? '',
                      fax: school.fax ?? '',
                      institution_code: school.institutionCode ?? '',
                      institutional_email: school.institutionalEmail ?? '',
                      address: school.address ?? '',
                      map_url: school.mapUrl ?? '',
                      school_image_url: school.schoolImageUrl ?? '',
                      about_description: school.about_description ?? '',
                      city: school.city ?? '',
                      district: school.district ?? '',
                    });
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="size-4" />
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editInfo ? (
              <>
                {isSuperadmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Durum</label>
                      <select
                        value={infoForm.status}
                        onChange={(e) => setInfoForm((f) => ({ ...f, status: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="aktif">Aktif</option>
                        <option value="deneme">Deneme</option>
                        <option value="askida">Askıda</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Askıda = okul pasif, öğretmen/kullanıcı girişi kısıtlı.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Kurum türü</label>
                      <select
                        value={infoForm.type}
                        onChange={(e) => setInfoForm((f) => ({ ...f, type: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      >
                        {SCHOOL_TYPE_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {SCHOOL_TYPE_LABELS[k] ?? k}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Akademik takvim şablonu ve kuruma özel içerikler bu türe göre seçilir.
                      </p>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground">İl</label>
                    <select
                      value={infoForm.city}
                      onChange={(e) => setInfoForm((f) => ({ ...f, city: e.target.value, district: '' }))}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Seçin</option>
                      {TURKEY_CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">İlçe</label>
                    {getDistrictsForCity(infoForm.city, []).length > 0 ? (
                      <select
                        value={infoForm.district}
                        onChange={(e) => setInfoForm((f) => ({ ...f, district: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seçin</option>
                        {getDistrictsForCity(infoForm.city, []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={infoForm.district}
                        onChange={(e) => setInfoForm((f) => ({ ...f, district: e.target.value }))}
                        placeholder="İlçe adı"
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Globe className="size-4" />
                    Web sitesi
                  </label>
                  <input
                    type="url"
                    value={infoForm.website_url}
                    onChange={(e) => setInfoForm((f) => ({ ...f, website_url: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Phone className="size-4" />
                      Telefon
                    </label>
                    <input
                      type="text"
                      value={infoForm.phone}
                      onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="0312 555 00 00"
                      maxLength={32}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Printer className="size-4" />
                      Belgegeçer (Fax)
                    </label>
                    <input
                      type="text"
                      value={infoForm.fax}
                      onChange={(e) => setInfoForm((f) => ({ ...f, fax: e.target.value }))}
                      placeholder="0312 555 11 22"
                      maxLength={32}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className={`grid grid-cols-2 gap-4 ${school.segment === 'devlet' ? 'rounded-lg bg-muted/30 p-3' : ''}`}>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Kurum kodu {school.segment === 'devlet' && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={infoForm.institution_code}
                      onChange={(e) => setInfoForm((f) => ({ ...f, institution_code: e.target.value }))}
                      placeholder={school.segment === 'devlet' ? 'MEB / e-Okul kurum kodu' : 'Opsiyonel'}
                      maxLength={16}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">{MEB_INSTITUTION_CODE_HINT}</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Mail className="size-4" />
                      Kurumsal e-posta {school.segment === 'devlet' && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      type="email"
                      list="school-edit-inst-email-suggestions"
                      value={infoForm.institutional_email}
                      onChange={(e) => setInfoForm((f) => ({ ...f, institutional_email: e.target.value }))}
                      placeholder="info@okuladi.meb.k12.tr"
                      maxLength={256}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                    <datalist id="school-edit-inst-email-suggestions">
                      <option value="bilgi@okul.meb.k12.tr" />
                      <option value="mudur@okuladi.ankara.meb.k12.tr" />
                      <option value="kurumsal@okul.meb.k12.tr" />
                    </datalist>
                    <p className="mt-1 text-[11px] text-muted-foreground">{INSTITUTIONAL_EMAIL_HINT}</p>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MapPin className="size-4" />
                    Tam adres
                  </label>
                  <input
                    type="text"
                    value={infoForm.address}
                    onChange={(e) => setInfoForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Mahalle, cadde, no – İlçe/İl"
                    maxLength={512}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Map className="size-4" />
                    Google Haritalar linki
                  </label>
                  <input
                    type="url"
                    value={infoForm.map_url}
                    onChange={(e) => setInfoForm((f) => ({ ...f, map_url: e.target.value }))}
                    placeholder="https://www.google.com/maps/place/..."
                    maxLength={1024}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    Okul görseli (logo/fotoğraf)
                  </label>
                  <input
                    type="url"
                    value={infoForm.school_image_url}
                    onChange={(e) => setInfoForm((f) => ({ ...f, school_image_url: e.target.value }))}
                    placeholder="https://... (okul logosu veya tanıtım fotoğrafı)"
                    maxLength={512}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="size-4" />
                    Detaylı Bilgi (Okulumuz Hakkında)
                  </label>
                  <textarea
                    value={infoForm.about_description}
                    onChange={(e) => setInfoForm((f) => ({ ...f, about_description: e.target.value }))}
                    placeholder="Okul hakkında detaylı bilgi..."
                    rows={5}
                    className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                {(school.schoolImageUrl ?? (school as { school_image_url?: string }).school_image_url) && (
                  <div className="mb-4 flex justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={school.schoolImageUrl ?? (school as { school_image_url?: string }).school_image_url ?? ''}
                      alt={`${school.name} görseli`}
                      className="max-h-48 w-full max-w-md object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {(school.city || school.district) && (
                  <div className="flex items-center gap-2 text-sm pb-4 border-b border-border">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Konum: </span>
                      <span className="font-medium">{[school.city, school.district].filter(Boolean).join(' / ')}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm">
                  <Globe className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Web sitesi: </span>
                    {school.website_url ? (
                      <a
                        href={school.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {school.website_url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Telefon: </span>
                    <span className="font-medium">{school.phone ?? '—'}</span>
                  </div>
                </div>
                {school.fax && (
                  <div className="flex items-center gap-2 text-sm">
                    <Printer className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Belgegeçer: </span>
                      <span className="font-medium">{school.fax}</span>
                    </div>
                  </div>
                )}
                {school.institutionCode || school.institutionalEmail ? (
                  <div className={`rounded-lg space-y-2 ${school.segment === 'devlet' ? 'bg-muted/30 p-3' : ''}`}>
                    {school.institutionCode && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Kurum kodu:</span>
                        <span className="font-medium font-mono">{school.institutionCode}</span>
                      </div>
                    )}
                    {school.institutionalEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <a
                          href={`mailto:${school.institutionalEmail}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {school.institutionalEmail}
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
                {school.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Adres: </span>
                      <span className="font-medium">{school.address}</span>
                    </div>
                  </div>
                )}
                {school.mapUrl && (
                  <div className="flex items-start gap-2 text-sm">
                    <Map className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                    <a
                      href={school.mapUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      Haritada göster
                    </a>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Detaylı Bilgi: </span>
                  {school.about_description ? (
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-foreground">
                      {school.about_description}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">Okulumuz Hakkında metni eklenmemiş.</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durum</span>
                    <span className="font-medium">{SCHOOL_STATUS_LABELS[school.status] ?? school.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kurum türü</span>
                    <span className="font-medium">{formatSchoolTypeLabel(school.type)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Öğretmen limiti</span>
                    <span className="font-medium">{school.teacher_limit}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Oluşturulma</span>
                    <span className="font-medium">{new Date(school.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <School className="size-5" />
              Modül yetkilendirme
            </CardTitle>
            <button
              type="button"
              onClick={handleSaveModules}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Bu okulun kullanabileceği modülleri seçin. Boş bırakırsanız tüm modüller açık olur.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MODULE_OPTIONS.map((m) => (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={modules.includes(m.key)}
                    onChange={(e) => {
                      if (e.target.checked) setModules((prev) => [...prev, m.key]);
                      else setModules((prev) => prev.filter((x) => x !== m.key));
                    }}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">{m.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            Market cüzdanı (okul)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Okulun market jeton / ek ders bakiyesi, manuel yükleme ve bu yüklemelerin kayıt geçmişi.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Şu anki bakiye</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100/90">
                  <Coins className="size-4 shrink-0" />
                  <span className="font-medium">Jeton</span>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
                  {fmtNum(school.marketJetonBalance)}
                </p>
                <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">Market modül kullanımı için</p>
              </div>
              <div className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
                <div className="flex items-center gap-2 text-sm text-sky-900 dark:text-sky-100/90">
                  <Coins className="size-4 shrink-0" />
                  <span className="font-medium">Ek ders</span>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-sky-950 dark:text-sky-50">
                  {fmtNum(school.marketEkdersBalance)}
                </p>
                <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-200/70">Ek ders birimi (kurumsal cüzdan)</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddSchoolCredit} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-foreground">Okula tutar yükle</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Girdiğiniz miktarlar <strong className="font-medium text-foreground">mevcut bakiyeye eklenir</strong> (çıkarma yok). En az
                jeton veya ek dersden biri 0’dan büyük olmalıdır.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="add-jeton" className="block text-sm font-medium text-foreground">
                  Eklenecek jeton
                </label>
                <p className="mb-1.5 text-xs text-muted-foreground">Bu okulun jeton bakiyesine eklenecek miktar</p>
                <input
                  id="add-jeton"
                  type="text"
                  inputMode="decimal"
                  value={addJeton}
                  onChange={(e) => setAddJeton(e.target.value)}
                  placeholder="Örn. 100"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tabular-nums"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="add-ekders" className="block text-sm font-medium text-foreground">
                  Eklenecek ek ders
                </label>
                <p className="mb-1.5 text-xs text-muted-foreground">Bu okulun ek ders bakiyesine eklenecek miktar</p>
                <input
                  id="add-ekders"
                  type="text"
                  inputMode="decimal"
                  value={addEkders}
                  onChange={(e) => setAddEkders(e.target.value)}
                  placeholder="Örn. 10"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tabular-nums"
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label htmlFor="add-note" className="block text-sm font-medium text-foreground">
                Not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </label>
              <p className="mb-1.5 text-xs text-muted-foreground">Fatura, kampanya veya iç not — geçmiş tablosunda görünür</p>
              <input
                id="add-note"
                type="text"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="Örn. 2025 Q1 kampanya yükleme"
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              />
            </div>
            {(() => {
              const jAdd = parsePositiveAmount(addJeton);
              const eAdd = parsePositiveAmount(addEkders);
              const curJ = parseBalanceNum(school.marketJetonBalance);
              const curE = parseBalanceNum(school.marketEkdersBalance);
              const hasInput = jAdd > 0 || eAdd > 0;
              if (!hasInput) {
                return (
                  <div className="rounded-md border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Tutar girince, yükleme sonrası bakiyeyi burada önizleyeceksiniz.
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Kayıt sonrası bakiye (önizleme)</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-muted-foreground">Jeton:</span>
                      <span className="tabular-nums text-foreground">
                        {fmtNum(curJ)} + <strong>{fmtNum(jAdd)}</strong> ={' '}
                        <strong className="text-base text-amber-900 dark:text-amber-100">{fmtNum(curJ + jAdd)}</strong>
                      </span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-muted-foreground">Ek ders:</span>
                      <span className="tabular-nums text-foreground">
                        {fmtNum(curE)} + <strong>{fmtNum(eAdd)}</strong> ={' '}
                        <strong className="text-base text-sky-900 dark:text-sky-100">{fmtNum(curE + eAdd)}</strong>
                      </span>
                    </li>
                  </ul>
                </div>
              );
            })()}
            <button
              type="submit"
              disabled={addingCredit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              <Wallet className="size-4" />
              {addingCredit ? 'Yükleniyor…' : 'Tutarı okul cüzdanına ekle'}
            </button>
          </form>

          <div>
            <p className="mb-1 text-sm font-semibold text-foreground">Yükleme geçmişi</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Sadece bu ekrandan yapılan superadmin yüklemeleri listelenir. Tarih ile süzebilirsiniz.
            </p>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Başlangıç (tarih)</label>
                <input
                  type="date"
                  value={creditFrom}
                  onChange={(e) => {
                    setCreditFrom(e.target.value);
                    setCreditPage(1);
                  }}
                  className="mt-0.5 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Bitiş (tarih)</label>
                <input
                  type="date"
                  value={creditTo}
                  onChange={(e) => {
                    setCreditTo(e.target.value);
                    setCreditPage(1);
                  }}
                  className="mt-0.5 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void fetchCredits()}
                className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Filtrele
              </button>
            </div>
            {creditLoading ? (
              <LoadingSpinner label="Geçmiş yükleniyor…" className="py-6" />
            ) : creditRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Henüz yükleme kaydı yok.</p>
            ) : (
              <>
                <div className="table-x-scroll rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Superadmin yükleme kayıtları: tarih, eklenen tutarlar, işlemi yapan ve not
                    </caption>
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Tarih / saat</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Eklenen jeton</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Eklenen ek ders</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">İşlemi yapan</th>
                        <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {creditRows.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">+{fmtNum(r.jeton_credit)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">+{fmtNum(r.ekders_credit)}</td>
                          <td className="px-3 py-2 text-foreground">
                            {r.creator_display_name || r.creator_email || r.created_by_user_id.slice(0, 8) + '…'}
                          </td>
                          <td className="max-w-[200px] px-3 py-2 text-muted-foreground truncate" title={r.note ?? ''}>
                            {r.note || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {creditTotal > 20 && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Toplam {creditTotal} kayıt</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={creditPage <= 1}
                        onClick={() => setCreditPage((p) => p - 1)}
                        className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Önceki
                      </button>
                      <button
                        type="button"
                        disabled={creditPage * 20 >= creditTotal}
                        onClick={() => setCreditPage((p) => p + 1)}
                        className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ScrollText className="size-5 shrink-0" />
                Okul aktivite günlüğü
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Bu okula bağlı audit kayıtları. Tarih ve işlem tipi sunucuda filtrelenir; arama yalnızca geçerli sayfadaki satırlarda çalışır.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchLogs()}
                disabled={logsFetching}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                <RefreshCw className={cn('size-4', logsFetching && 'animate-spin')} />
                Yenile
              </button>
              <button
                type="button"
                disabled={!logs?.items.length}
                onClick={() => {
                  const rows = logSearch.trim() ? filteredLogItems : logs?.items ?? [];
                  if (!rows.length) return;
                  const safe = (school?.name ?? 'okul').replace(/[^\w\u00C0-\u024f\-]+/gi, '_').slice(0, 48);
                  downloadAuditCsv(rows, safe);
                  toast.success('CSV indirildi');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Download className="size-4" />
                CSV
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Bu sayfada ara (kullanıcı, işlem, IP…)"
                className="h-10 pl-9"
                aria-label="Aktivite günlüğünde ara"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">İşlem</label>
              <select
                value={logActionFilter}
                onChange={(e) => {
                  setLogActionFilter(e.target.value);
                  setLogPage(1);
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {ACTION_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sayfa boyutu</label>
              <select
                value={logLimit}
                onChange={(e) => {
                  setLogLimit(Number(e.target.value));
                  setLogPage(1);
                }}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarRange className="size-3.5" />
                  Başlangıç
                </label>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => {
                    setLogDateFrom(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Bitiş</label>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => {
                    setLogDateTo(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                onClick={() => {
                  const t = new Date().toISOString().slice(0, 10);
                  setLogDateFrom(t);
                  setLogDateTo(t);
                  setLogPage(1);
                }}
              >
                Bugün
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                onClick={() => {
                  const to = new Date();
                  const from = new Date();
                  from.setDate(from.getDate() - 6);
                  setLogDateFrom(from.toISOString().slice(0, 10));
                  setLogDateTo(to.toISOString().slice(0, 10));
                  setLogPage(1);
                }}
              >
                Son 7 gün
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                onClick={() => {
                  setLogDateFrom('');
                  setLogDateTo('');
                  setLogPage(1);
                }}
              >
                Tüm tarihler
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {logsError && <Alert message={logsError} className="mb-4" />}
          {logs ? (
            logs.items.length > 0 ? (
              <>
                <div
                  className={cn(
                    'relative max-h-[min(70vh,560px)] overflow-auto rounded-xl border border-border/80',
                    logsFetching && 'opacity-60',
                  )}
                >
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <caption className="sr-only">
                      Okul aktivite günlüğü: tarih, işlem türü, kullanıcı, açıklama ve IP
                    </caption>
                    <thead className="sticky top-0 z-1 border-b border-border bg-muted/95 backdrop-blur-sm">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tarih</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">İşlem</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Kullanıcı</th>
                        <th className="min-w-48 px-3 py-2.5 text-xs font-semibold text-muted-foreground">Açıklama</th>
                        <th className="hidden whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted-foreground md:table-cell">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {filteredLogItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                            Bu sayfada arama kriterine uygun satır yok.
                          </td>
                        </tr>
                      ) : (
                        filteredLogItems.map((log) => {
                          const detail = formatLogDetail(log);
                          const isError = log.action === 'failed_login';
                          const label = formatLogActionLabel(log.action);
                          const rel = formatRelativeTr(log.created_at);
                          return (
                            <tr
                              key={log.id}
                              className={cn(
                                'transition-colors',
                                isError ? 'bg-destructive/6 hover:bg-destructive/10' : 'hover:bg-muted/40',
                              )}
                            >
                              <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs tabular-nums text-muted-foreground">
                                <div>{new Date(log.created_at).toLocaleString('tr-TR')}</div>
                                {rel ? <div className="text-[11px] text-muted-foreground/80">{rel}</div> : null}
                              </td>
                              <td className="px-3 py-2.5 align-top">
                                <span
                                  className={cn(
                                    'inline-flex max-w-56 items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-tight',
                                    logCategoryClass(log.action),
                                  )}
                                  title={label}
                                >
                                  {label}
                                </span>
                              </td>
                              <td className="max-w-40 px-3 py-2.5 align-top text-foreground">
                                <span className="line-clamp-2 wrap-break-word" title={formatLogUser(log)}>
                                  {formatLogUser(log)}
                                </span>
                              </td>
                              <td className="max-w-md px-3 py-2.5 align-top text-muted-foreground">
                                <span className="line-clamp-3 wrap-break-word text-xs leading-relaxed" title={detail || undefined}>
                                  {detail || '—'}
                                </span>
                              </td>
                              <td className="hidden max-w-36 px-3 py-2.5 align-top font-mono text-xs text-muted-foreground md:table-cell">
                                {log.ip ?? '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {logs.total > logLimit && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Toplam <span className="font-medium text-foreground">{logs.total}</span> kayıt · Sayfa{' '}
                      <span className="font-medium text-foreground">{logPage}</span> / {logTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={logPage <= 1}
                        onClick={() => setLogPage((p) => p - 1)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Önceki
                      </button>
                      <button
                        type="button"
                        disabled={logPage >= logTotalPages}
                        onClick={() => setLogPage((p) => p + 1)}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Seçilen filtrelere uygun kayıt yok.</p>
            )
          ) : (
            <LoadingSpinner label="Loglar yükleniyor…" className="py-8" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
