'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  CalendarDays,
  Quote,
  UserCircle2,
  Users,
  Cake,
  Trophy,
  Table2,
  BellRing,
  Utensils,
  Clock3,
  CloudSun,
  PlayCircle,
  Megaphone,
  Plus,
  Settings,
  HelpCircle,
  ExternalLink,
  Rss,
  Trash2,
  Pencil,
  Monitor,
  Wifi,
  WifiOff,
  CheckCircle2,
  Circle,
  Copy,
  Upload,
  Download,
  School,
  LayoutGrid,
  BookOpen,
  Sparkles,
  Link2,
  Shield,
  Moon,
  AlertTriangle,
  Film,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateAnnouncementForm } from '@/components/announcement-create-form';
import { AnnouncementListSection } from '@/components/announcement-list';
import { ImageUrlInput } from '@/components/image-url-input';

/** Okul yöneticisi Duyuru TV ana sekmeleri (?tab=) */
export type TvMainTab = 'genel' | 'ayarlar' | 'cihazlar' | 'icerik' | 'duyurular' | 'yardim';
const TV_MAIN_TAB_IDS: TvMainTab[] = ['genel', 'ayarlar', 'cihazlar', 'icerik', 'duyurular', 'yardim'];

/** Oturumda bir kez TV Ayarları açıldıysa duyuru detayından ajandaya ekle açılır */
const TV_SESSION_AGENDA_AFTER_AYARLAR = 'ogretmenpro_tv_agenda_after_ayarlar';
function parseTvMainTab(s: string | null): TvMainTab {
  if (s && (TV_MAIN_TAB_IDS as string[]).includes(s)) return s as TvMainTab;
  return 'genel';
}

function buildTvSchoolsQuery(params: {
  limit: number;
  city?: string;
  district?: string;
  segment?: string;
  search?: string;
}): string {
  const u = new URLSearchParams();
  u.set('page', '1');
  u.set('limit', String(params.limit));
  if (params.city?.trim()) u.set('city', params.city.trim());
  if (params.district?.trim()) u.set('district', params.district.trim());
  if (params.segment?.trim()) u.set('segment', params.segment.trim());
  if (params.search?.trim()) u.set('search', params.search.trim());
  return u.toString();
}

function tvSchoolOptionLabel(s: { name: string; city?: string | null; district?: string | null }): string {
  const loc = [s.city, s.district].filter(Boolean).join(' / ');
  return loc ? `${s.name} (${loc})` : s.name;
}

const TV_WEATHER_CITIES = [
  'Adana', 'Ankara', 'Antalya', 'Aydın', 'Balıkesir', 'Bursa', 'Denizli', 'Diyarbakır', 'Erzurum',
  'Gaziantep', 'Hatay', 'Istanbul', 'İzmir', 'Kayseri', 'Kocaeli', 'Konya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Samsun', 'Şanlıurfa', 'Trabzon', 'Van',
];

type TvAnnouncement = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  importance: string;
  category: string;
  show_on_tv: boolean;
  tv_slot: string | null;
  published_at: string | null;
  created_at: string;
  tv_audience?: string;
  attachment_url?: string | null;
  creator?: { display_name: string | null } | null;
};

type ListResponse = {
  total: number;
  page: number;
  limit: number;
  items: TvAnnouncement[];
};

/** Yan panel (sağ/sol) kartları */
const TV_PANEL_OPTIONS = [
  { key: 'datetime', label: 'Tarih ve saat' },
  { key: 'weather', label: 'Hava durumu' },
  { key: 'gunun_sozu', label: 'Günün sözü (yan panel)' },
  { key: 'duty', label: 'Nöbetçi öğretmen' },
  { key: 'countdown', label: 'Sayaçlar (sınav / tatil / karne)' },
  { key: 'meal', label: 'Yemek / kantin menüsü' },
] as const;

/** Ekranın en altındaki kayan şeritler */
const TV_BOTTOM_STRIP_OPTIONS = [
  { key: 'now_in_class_bar', label: 'Şu an derste (kayan bar)' },
  { key: 'ticker', label: 'Okul duyuruları (sarı bar)' },
  { key: 'rss', label: 'RSS haber bandı (kırmızı bar)' },
  { key: 'gunun_sozu_bar', label: 'Günün sözü — RSS (mor/mavi alt bar)' },
] as const;

/** Orta alan döngü slaytları (tv_visible_cards içinde slide_* anahtarları) */
const TV_CENTER_SLIDE_OPTIONS = [
  { key: 'slide_welcome', label: 'Hoş geldin' },
  { key: 'slide_special_day', label: 'Belirli gün ve haftalar' },
  { key: 'slide_principal', label: 'Okul müdürü mesajı' },
  { key: 'slide_staff', label: 'Öğretmenlerimiz' },
  { key: 'slide_birthday', label: 'Doğum günü' },
  { key: 'slide_success', label: 'Başarılarımız' },
  { key: 'slide_timetable', label: 'Ders programı' },
  { key: 'slide_news', label: 'Haber / duyuru slaytları' },
  { key: 'slide_video', label: 'Video (YouTube)' },
] as const;

const TV_VISIBILITY_OPTIONS = [
  ...TV_PANEL_OPTIONS,
  ...TV_BOTTOM_STRIP_OPTIONS,
  ...TV_CENTER_SLIDE_OPTIONS,
] as const;

/** Eski tv_visible_cards kayıtlarında slide_* yoktu; tikler kapalı görünüp filtre uygulanmıyordu. Eksikse tüm slide_* varsayılan eklenir. */
function mergeTvVisibleCardsFromServer(raw: string | null | undefined): Set<string> {
  const trimmed = raw?.trim();
  if (!trimmed) return new Set(TV_VISIBILITY_OPTIONS.map((c) => c.key));
  const parsed = new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean));
  const hasSlide = [...parsed].some((k) => k.startsWith('slide_'));
  if (!hasSlide) {
    TV_CENTER_SLIDE_OPTIONS.forEach((c) => parsed.add(c.key));
  }
  return parsed;
}

/** Kart accent renkleri – dark/light tema uyumlu pastel */
const ACCENT_CLASSES: Record<
  string,
  { card: string; iconBg: string; iconText: string; border: string }
> = {
  blue: {
    card: 'border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/25',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconText: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300/60 dark:border-blue-700/50',
  },
  violet: {
    card: 'border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/25',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconText: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-300/60 dark:border-violet-700/50',
  },
  emerald: {
    card: 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/25',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300/60 dark:border-emerald-700/50',
  },
  amber: {
    card: 'border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/25',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconText: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300/60 dark:border-amber-700/50',
  },
  rose: {
    card: 'border-rose-200 dark:border-rose-800/70 bg-rose-50/40 dark:bg-rose-950/25',
    iconBg: 'bg-rose-100 dark:bg-rose-900/50',
    iconText: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-300/60 dark:border-rose-700/50',
  },
  sky: {
    card: 'border-sky-200 dark:border-sky-800/70 bg-sky-50/40 dark:bg-sky-950/25',
    iconBg: 'bg-sky-100 dark:bg-sky-900/50',
    iconText: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-300/60 dark:border-sky-700/50',
  },
  teal: {
    card: 'border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/25',
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconText: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-300/60 dark:border-teal-700/50',
  },
  indigo: {
    card: 'border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/25',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-300/60 dark:border-indigo-700/50',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Genel',
  special_day: 'Belirli Gün ve Haftalar',
  principal_message: 'Okul Müdürü Mesajı',
  staff: 'Öğretmenlerimiz',
  info_bank: 'Bilgi Bankası',
  birthday: 'Doğum Günü',
  success: 'Başarılarımız',
  timetable: 'Ders Programı',
  duty: 'Nöbet Listesi',
  meal: 'Yemek Listesi',
  ticker: 'Okul Duyuruları (Sarı Bar)',
  weather: 'Hava Durumu',
  countdown: 'Sayaç',
  now_in_class: 'Şu An Derste',
};

type SchoolTvConfig = {
  id: string;
  name: string;
  tv_weather_city?: string | null;
  tv_welcome_image_url?: string | null;
  tv_default_slide_duration?: number | null;
  tv_rss_url?: string | null;
  tv_rss_marquee_duration?: number | null;
  tv_rss_marquee_font_size?: number | null;
  tv_ticker_marquee_duration?: number | null;
  tv_ticker_font_size?: number | null;
  tv_ticker_text_transform?: string | null;
  tv_night_mode_start?: string | null;
  tv_night_mode_end?: string | null;
  tv_logo_url?: string | null;
  tv_card_position?: string | null;
  tv_logo_position?: string | null;
  tv_logo_size?: string | null;
  tv_theme?: string | null;
  tv_primary_color?: string | null;
  tv_visible_cards?: string | null;
  tv_countdown_card_title?: string | null;
  tv_countdown_font_size?: number | null;
  tv_countdown_separator?: string | null;
  tv_countdown_targets?: string | null;
  tv_meal_card_title?: string | null;
  tv_meal_font_size?: number | null;
  tv_meal_schedule?: string | null;
  tv_duty_card_title?: string | null;
  tv_duty_font_size?: number | null;
  tv_duty_schedule?: string | null;
  tv_gunun_sozu_rss_url?: string | null;
  tv_gunun_sozu_font_size?: number | null;
  tv_gunun_sozu_marquee_duration?: number | null;
  tv_gunun_sozu_text_transform?: string | null;
  tv_special_days_calendar?: string | null;
  tv_timetable_schedule?: string | null;
  /** true: TV ders grid’i okul yayınlanmış plandan; false: sadece tv_timetable_schedule */
  tv_timetable_use_school_plan?: boolean | null;
  tv_birthday_card_title?: string | null;
  tv_birthday_font_size?: number | null;
  tv_birthday_calendar?: string | null;
  tv_now_in_class_bar_title?: string | null;
  tv_now_in_class_bar_font_size?: number | null;
  tv_now_in_class_bar_marquee_duration?: number | null;
  tv_allowed_ips?: string | null;
};

type MealEntry = { day_of_week?: number; date?: string; title: string; menu: string };
type DutyEntry = { day_of_week?: number; date?: string; title: string; info: string };
type SpecialDayEntry = { date: string; title: string; responsible: string; description?: string; image_url?: string };
type BirthdayEntry = { date: string; name: string; type: 'teacher' | 'student'; class_section?: string };
type TimetableLessonTime = { num: number; start: string; end: string };
type TimetableEntry = { day: number; lesson: number; class: string; subject: string };
const DAY_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const WEEKDAY_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

type CountdownTarget = { label: string; target_date: string };

type TvDevice = {
  id: string;
  school_id: string;
  pairing_code: string;
  name: string;
  display_group: string;
  status: string;
  last_seen_at: string | null;
};

/** Orta bölüm | Sağ panel | Alt şerit - blok tanımları */
const BLOCK_CONFIG: Array<{
  group: 'orta' | 'sag' | 'alt';
  groupLabel: string;
  icon: React.ReactNode;
  title: string;
  categoryKey: string;
  fallback: string;
  single?: boolean;
  accent?: keyof typeof ACCENT_CLASSES;
  helpTooltip?: string;
  /** Özel filtre (örn. günün sözü) */
  filter?: (items: TvAnnouncement[], all: TvAnnouncement[]) => TvAnnouncement[];
}> = [
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'teal', icon: <CalendarDays className="size-4" />, title: 'Belirli Gün ve Haftalar', categoryKey: 'special_day', fallback: 'Kayıt yok.' },
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'violet', icon: <UserCircle2 className="size-4" />, title: 'Okul Müdürü Mesajı', categoryKey: 'principal_message', fallback: 'Müdür mesajı eklenmemiş.', single: true },
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'indigo', icon: <Users className="size-4" />, title: 'Öğretmenlerimiz', categoryKey: 'staff', fallback: 'Öğretmen listesi eklenmemiş.', helpTooltip: 'Yeni duyuru oluştururken kategori "Öğretmenlerimiz" seçin. Fotoğraf ve kısa metin ile slayt olarak TV\'de gösterilir.' },
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'amber', icon: <Trophy className="size-4" />, title: 'Başarılarımız', categoryKey: 'success', fallback: 'Başarı kaydı eklenmemiş.' },
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'rose', icon: <Cake className="size-4" />, title: 'Doğum Günü', categoryKey: 'birthday', fallback: 'Doğum günü kaydı yok.', single: true },
  { group: 'orta', groupLabel: 'Orta bölüm (slaytlar)', accent: 'sky', icon: <Megaphone className="size-4" />, title: 'Genel Duyurular', categoryKey: 'general', fallback: 'Genel duyuru eklenmemiş.' },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'blue', icon: <Table2 className="size-4" />, title: 'Ders Programı', categoryKey: 'timetable', fallback: 'Ders programı eklenmemiş.', single: true },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'violet', icon: <BellRing className="size-4" />, title: 'Nöbet Listesi', categoryKey: 'duty', fallback: 'Nöbet bilgisi eklenmemiş.', single: true },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'amber', icon: <Clock3 className="size-4" />, title: 'Sayaç / Karne Gününe', categoryKey: 'countdown', fallback: 'Sayaç bilgisi eklenmemiş.', single: true },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'rose', icon: <Utensils className="size-4" />, title: 'Yemek Listesi', categoryKey: 'meal', fallback: 'Yemek listesi eklenmemiş.', single: true },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'sky', icon: <CloudSun className="size-4" />, title: 'Hava Durumu', categoryKey: 'weather', fallback: 'Hava durumu eklenmemiş.', single: true },
  { group: 'sag', groupLabel: 'Sağ panel', accent: 'indigo', icon: <Megaphone className="size-4" />, title: 'Görsel Haber (beyaz kutu)', categoryKey: 'general', fallback: 'Görsel URL girilmiş duyuru yok.', filter: (_, all) => all.filter((a) => a.attachment_url) },
  { group: 'alt', groupLabel: 'Alt şeritler', accent: 'emerald', icon: <PlayCircle className="size-4" />, title: 'Şuan Derste (kayan bar)', categoryKey: 'now_in_class', fallback: 'Duyuru kategorisi Şu An Derste ile ekleyin.', single: true },
  { group: 'alt', groupLabel: 'Alt şeritler', accent: 'amber', icon: <Megaphone className="size-4" />, title: 'Okul Duyuruları (Sarı Bar)', categoryKey: 'ticker', fallback: 'Kategori: Okul Duyuruları (Sarı Bar).', single: true },
  { group: 'alt', groupLabel: 'Alt şeritler', accent: 'rose', icon: <Rss className="size-4" />, title: 'RSS Haber Bandı', categoryKey: '_rss', fallback: 'TV ayarlarından RSS URL girin.', single: true },
  { group: 'alt', groupLabel: 'Alt şeritler', accent: 'teal', icon: <Quote className="size-4" />, title: 'Günün Sözü bar', categoryKey: '_gunun_sozu', fallback: 'TV ayarlarından Günün Sözü RSS URL girin.', single: true },
];

function groupByCategory(items: TvAnnouncement[]): Record<string, TvAnnouncement[]> {
  const map: Record<string, TvAnnouncement[]> = {};
  for (const item of items) {
    const key = item.category || 'general';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

export default function TvPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin';
  type TvSchoolRow = { id: string; name: string; city?: string | null; district?: string | null };
  const [schools, setSchools] = useState<TvSchoolRow[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolFilters, setSchoolFilters] = useState({
    city: '',
    district: '',
    segment: '' as '' | 'ozel' | 'devlet',
    search: '',
  });
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [filterDistricts, setFilterDistricts] = useState<string[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [school, setSchool] = useState<SchoolTvConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audienceTab, setAudienceTab] = useState<'corridor' | 'teachers' | 'classroom'>('corridor');
  const [refreshKey, setRefreshKey] = useState(0);
  const [agendaAfterTvAyarlar, setAgendaAfterTvAyarlar] = useState(false);
  const [tvDevices, setTvDevices] = useState<TvDevice[]>([]);
  const [smartBoardDevices, setSmartBoardDevices] = useState<Array<{ id: string; pairing_code: string }>>([]);
  const schoolId = isSuperadmin ? selectedSchoolId : (me?.school_id ?? me?.school?.id ?? null);
  const canCreateAnnouncement = me?.role === 'school_admin' || (isSuperadmin && !!schoolId);

  const mainTab = useMemo(() => parseTvMainTab(searchParams.get('tab')), [searchParams]);
  const setMainTab = useCallback(
    (t: TvMainTab) => {
      const u = new URLSearchParams();
      u.set('tab', t);
      if (isSuperadmin && schoolId) u.set('school_id', schoolId);
      router.replace(`/tv?${u.toString()}`, { scroll: false });
    },
    [router, isSuperadmin, schoolId],
  );

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
      { token: token ?? undefined },
    )
      .then(setFilterDistricts)
      .catch(() => setFilterDistricts(getDistrictsForCity(schoolFilters.city, [])));
  }, [isSuperadmin, schoolFilters.city, token]);

  const fetchTvSchools = useCallback(async () => {
    if (!isSuperadmin || !token) return;
    setSchoolsLoading(true);
    const q = buildTvSchoolsQuery({
      limit: 100,
      city: schoolFilters.city || undefined,
      district: schoolFilters.district || undefined,
      segment: schoolFilters.segment || undefined,
      search: schoolFilters.search || undefined,
    });
    try {
      const r = await apiFetch<{ items: TvSchoolRow[] }>(`/schools?${q}`, { token });
      setSchools(Array.isArray(r?.items) ? r.items : []);
    } catch {
      setSchools([]);
    } finally {
      setSchoolsLoading(false);
    }
  }, [isSuperadmin, token, schoolFilters.city, schoolFilters.district, schoolFilters.segment, schoolFilters.search]);

  useEffect(() => {
    if (!isSuperadmin || !token) return;
    fetchTvSchools();
  }, [isSuperadmin, token, fetchTvSchools]);

  useEffect(() => {
    if (!isSuperadmin || schoolsLoading) return;
    if (schools.length === 0) {
      if (selectedSchoolId) {
        setSelectedSchoolId(null);
        const u = new URLSearchParams();
        u.set('tab', mainTab);
        router.replace(`/tv?${u.toString()}`, { scroll: false });
      }
      return;
    }
    const fromUrl = searchParams.get('school_id');
    if (fromUrl && schools.some((s) => s.id === fromUrl)) {
      if (selectedSchoolId !== fromUrl) setSelectedSchoolId(fromUrl);
      return;
    }
    if (selectedSchoolId && schools.some((s) => s.id === selectedSchoolId)) {
      return;
    }
    const next = schools[0].id;
    setSelectedSchoolId(next);
    const u = new URLSearchParams();
    u.set('school_id', next);
    u.set('tab', mainTab);
    router.replace(`/tv?${u.toString()}`, { scroll: false });
  }, [isSuperadmin, schools, schoolsLoading, searchParams, selectedSchoolId, router, mainTab]);

  const refetchAnnouncements = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(TV_SESSION_AGENDA_AFTER_AYARLAR) === '1') {
        setAgendaAfterTvAyarlar(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (mainTab !== 'ayarlar') return;
    setAgendaAfterTvAyarlar(true);
    try {
      sessionStorage.setItem(TV_SESSION_AGENDA_AFTER_AYARLAR, '1');
    } catch {
      /* ignore */
    }
  }, [mainTab]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetchAnnouncements();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q =
      isSuperadmin && schoolId
        ? `/announcements?limit=100&school_id=${encodeURIComponent(schoolId)}`
        : '/announcements?limit=100';
    apiFetch<ListResponse>(q, { token })
      .then((res) => setData(res))
      .catch((e) => setError(e instanceof Error ? e.message : 'Duyuru TV içeriği yüklenemedi'))
      .finally(() => setLoading(false));
  }, [token, refreshKey, isSuperadmin, schoolId]);

  useEffect(() => {
    if (!token || !schoolId) return;
    apiFetch<SchoolTvConfig>(`/schools/${schoolId}`, { token })
      .then((s) => setSchool(s))
      .catch(() => setSchool(null));
  }, [token, schoolId, refreshKey]);

  useEffect(() => {
    if (!token) return;
    apiFetch<TvDevice[]>('/tv-devices', { token })
      .then(setTvDevices)
      .catch(() => setTvDevices([]));
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token || !schoolId) return;
    const path = isSuperadmin
      ? `/smart-board/devices?school_id=${encodeURIComponent(schoolId)}`
      : '/smart-board/devices';
    apiFetch<Array<{ id: string; pairing_code: string }>>(path, { token })
      .then((r) => setSmartBoardDevices(Array.isArray(r) ? r : []))
      .catch(() => setSmartBoardDevices([]));
  }, [token, schoolId, refreshKey, isSuperadmin]);

  const tvDevicesFiltered = useMemo(
    () => (isSuperadmin && schoolId ? tvDevices.filter((d) => d.school_id === schoolId) : tvDevices),
    [tvDevices, isSuperadmin, schoolId],
  );

  const tvItems = useMemo(
    () => (data?.items ?? []).filter((a) => a.show_on_tv),
    [data],
  );

  const tvItemsCorridor = useMemo(
    () =>
      tvItems.filter(
        (a) =>
          !a.tv_audience ||
          a.tv_audience === 'all' ||
          a.tv_audience === 'both' ||
          a.tv_audience === 'corridor',
      ),
    [tvItems],
  );

  const tvItemsTeachers = useMemo(
    () =>
      tvItems.filter(
        (a) =>
          !a.tv_audience ||
          a.tv_audience === 'all' ||
          a.tv_audience === 'both' ||
          a.tv_audience === 'teachers',
      ),
    [tvItems],
  );

  const tvItemsClassroom = useMemo(
    () =>
      tvItems.filter(
        (a) => !a.tv_audience || a.tv_audience === 'all' || a.tv_audience === 'classroom',
      ),
    [tvItems],
  );

  const byCategoryCorridor = useMemo(() => groupByCategory(tvItemsCorridor), [tvItemsCorridor]);
  const byCategoryTeachers = useMemo(() => groupByCategory(tvItemsTeachers), [tvItemsTeachers]);
  const byCategoryClassroom = useMemo(() => groupByCategory(tvItemsClassroom), [tvItemsClassroom]);

  const currentItems =
    audienceTab === 'corridor'
      ? tvItemsCorridor
      : audienceTab === 'teachers'
        ? tvItemsTeachers
        : tvItemsClassroom;
  const currentByCategory =
    audienceTab === 'corridor'
      ? byCategoryCorridor
      : audienceTab === 'teachers'
        ? byCategoryTeachers
        : byCategoryClassroom;

  const previewUrlCorridor = schoolId ? `/tv/corridor?school_id=${schoolId}` : '/tv/corridor';
  const previewUrlTeachers = schoolId ? `/tv/teachers?school_id=${schoolId}` : '/tv/teachers';
  const firstDeviceId = smartBoardDevices[0]?.id;
  const previewUrlClassroom =
    schoolId && firstDeviceId
      ? `/tv/classroom?school_id=${schoolId}&device_id=${firstDeviceId}`
      : null;

  /** TV önizleme: daha büyük görünmesi için daha küçük sanal viewport */
  const TV_W = 1024;
  const TV_H = 576;
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) {
        setPreviewWidth(w);
        setPreviewScale(w / TV_W);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasCorridorDevice = tvDevicesFiltered.some((d) => d.display_group === 'corridor');
  const hasTeachersDevice = tvDevicesFiltered.some((d) => d.display_group === 'teachers');
  const hasTvSettings = !!(school?.tv_weather_city || school?.tv_welcome_image_url);
  const hasTvContent = tvItemsCorridor.length > 0 || tvItemsTeachers.length > 0 || tvItemsClassroom.length > 0;
  const setupComplete = hasTvSettings && hasCorridorDevice && hasTeachersDevice && hasTvContent;
  const setupStepCount = [hasTvSettings, hasCorridorDevice, hasTeachersDevice, hasTvContent].filter(Boolean).length;
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [createAnnouncementCategory, setCreateAnnouncementCategory] = useState('general');
  const [createFormKey, setCreateFormKey] = useState(0);
  const openCreateAnnouncement = useCallback((category?: string) => {
    setCreateAnnouncementCategory(category ?? 'general');
    setCreateFormKey((k) => k + 1);
    setCreateAnnouncementOpen(true);
  }, []);
  const [previewTab, setPreviewTab] = useState<'corridor' | 'teachers' | 'classroom'>('corridor');

  return (
    <div className="space-y-6">
      <header className="sticky top-0 z-[1] -mt-4 rounded-xl border border-border bg-card/95 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/90">
        <div className="flex flex-col gap-4 border-b border-border/80 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Duyuru TV</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Koridor, öğretmenler odası ve akıllı tahta için görünüm ve içerik. Her sekme yalnızca o konuyla ilgili alanı gösterir.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-end">
              <Dialog open={createAnnouncementOpen} onOpenChange={setCreateAnnouncementOpen}>
                <DialogContent title="Yeni duyuru" className="max-w-2xl">
                  <CreateAnnouncementForm
                    key={createFormKey}
                    token={token}
                    schoolId={isSuperadmin ? schoolId ?? undefined : undefined}
                    initialCategory={createAnnouncementCategory}
                    defaultShowOnTv
                    defaultPublish
                    onSuccess={() => {
                      setCreateAnnouncementOpen(false);
                      refetchAnnouncements();
                    }}
                    onCancel={() => setCreateAnnouncementOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <button
                type="button"
                disabled={isSuperadmin && !schoolId}
                onClick={() => openCreateAnnouncement('general')}
                className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-shadow duration-150 hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-4" />
                Yeni duyuru
              </button>
              <button
                type="button"
                onClick={() => setMainTab('duyurular')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150',
                  mainTab === 'duyurular'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted hover:shadow-md',
                )}
              >
                <Megaphone className="size-4" />
                Duyuru listesi
              </button>
              <Link
                href={previewUrlCorridor}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-muted hover:shadow-md"
              >
                <ExternalLink className="size-4" />
                Koridor
              </Link>
              <Link
                href={previewUrlTeachers}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-muted hover:shadow-md"
              >
                <ExternalLink className="size-4" />
                Öğretmenler
              </Link>
              {previewUrlClassroom ? (
                <Link
                  href={previewUrlClassroom}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors duration-150 hover:bg-muted hover:shadow-md"
                >
                  <Monitor className="size-4" />
                  Akıllı Tahta
                </Link>
              ) : null}
            </div>
          </div>
          {isSuperadmin && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1">
                  <label htmlFor="tv-filter-city" className="text-xs font-medium text-muted-foreground">
                    İl
                  </label>
                  <select
                    id="tv-filter-city"
                    value={schoolFilters.city}
                    onChange={(e) => {
                      setSchoolFilters((f) => ({ ...f, city: e.target.value, district: '' }));
                    }}
                    disabled={schoolsLoading}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Tüm iller</option>
                    {filterCities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label htmlFor="tv-filter-district" className="text-xs font-medium text-muted-foreground">
                    İlçe
                  </label>
                  <select
                    id="tv-filter-district"
                    value={schoolFilters.district}
                    onChange={(e) => {
                      setSchoolFilters((f) => ({ ...f, district: e.target.value }));
                    }}
                    disabled={schoolsLoading || !schoolFilters.city}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Tüm ilçeler</option>
                    {filterDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label htmlFor="tv-filter-segment" className="text-xs font-medium text-muted-foreground">
                    Kurum
                  </label>
                  <select
                    id="tv-filter-segment"
                    value={schoolFilters.segment}
                    onChange={(e) => {
                      setSchoolFilters((f) => ({
                        ...f,
                        segment: e.target.value as '' | 'ozel' | 'devlet',
                      }));
                    }}
                    disabled={schoolsLoading}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Tümü</option>
                    <option value="devlet">Devlet</option>
                    <option value="ozel">Özel</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <label htmlFor="tv-filter-search" className="text-xs font-medium text-muted-foreground">
                    Okul adı
                  </label>
                  <input
                    id="tv-filter-search"
                    type="search"
                    value={schoolFilters.search}
                    onChange={(e) => {
                      setSchoolFilters((f) => ({ ...f, search: e.target.value }));
                    }}
                    placeholder="Ara…"
                    disabled={schoolsLoading}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <School className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="grid min-w-0 flex-1 gap-1 sm:min-w-[14rem]">
                  <label htmlFor="tv-school-select" className="text-sm font-medium text-foreground">
                    Okul
                  </label>
                  <select
                    id="tv-school-select"
                    value={schoolId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSchoolId(id);
                      const u = new URLSearchParams();
                      u.set('school_id', id);
                      u.set('tab', mainTab);
                      router.replace(`/tv?${u.toString()}`, { scroll: false });
                      setRefreshKey((k) => k + 1);
                    }}
                    disabled={schoolsLoading || schools.length === 0}
                    className="min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {tvSchoolOptionLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSchoolFilters({ city: '', district: '', segment: '', search: '' });
                  }}
                  disabled={schoolsLoading}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60"
                >
                  Filtreleri temizle
                </button>
                {schoolsLoading && <span className="text-xs text-muted-foreground">Yükleniyor…</span>}
                {!schoolsLoading && schools.length === 0 && (
                  <span className="text-xs text-destructive">Bu filtrelere uyan okul yok.</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Duyuru TV bölümleri"
          className="flex gap-1.5 overflow-x-auto px-2 py-3 sm:flex-wrap sm:px-4 sm:pb-4"
        >
          {(
            [
              { id: 'genel' as const, label: 'Genel', hint: 'Önizleme ve kurulum', Icon: LayoutGrid },
              { id: 'ayarlar' as const, label: 'TV ayarları', hint: 'Görsel, tema, listeler', Icon: Settings },
              { id: 'cihazlar' as const, label: 'Cihazlar', hint: 'Eşleştirme kodları', Icon: Monitor },
              { id: 'icerik' as const, label: 'İçerik özeti', hint: 'Ekrana göre bloklar', Icon: PlayCircle },
              { id: 'duyurular' as const, label: 'Duyurular', hint: 'Liste ve düzenleme', Icon: Megaphone },
              { id: 'yardim' as const, label: 'Yardım', hint: 'Nasıl çalışır', Icon: HelpCircle },
            ] as const
          ).map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mainTab === id}
              onClick={() => setMainTab(id)}
              className={cn(
                'flex min-w-[9.25rem] shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all sm:min-w-0',
                mainTab === id
                  ? 'border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20'
                  : 'border-transparent bg-muted/35 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </span>
              <span className="hidden text-[11px] leading-snug text-muted-foreground sm:block">{hint}</span>
            </button>
          ))}
        </div>
      </header>

      {error && <Alert message={error} />}

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {mainTab === 'genel' && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Genel bakış</h2>
              <p className="mt-1 text-sm text-muted-foreground">Canlı önizleme ve kurulum kontrol listesi.</p>
            </div>
            <Card className="overflow-hidden border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <PlayCircle className="size-5 text-primary" />
                  <CardTitle className="text-base">Canlı TV önizleme</CardTitle>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Hangi ekranda ne göründüğünü seçin.</p>
              </CardHeader>
              <CardContent className="border-t border-border pt-4">
                <div className="flex flex-wrap gap-2 pb-3">
              <button
                type="button"
                onClick={() => setPreviewTab('corridor')}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  previewTab === 'corridor' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                )}
              >
                Koridor
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('teachers')}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  previewTab === 'teachers' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                )}
              >
                Öğretmenler
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('classroom')}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  previewTab === 'classroom' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
                )}
              >
                Akıllı Tahta
              </button>
            </div>
            {/* Dış kap: 16/9, gerçek piksel yüksekliği = genişlik*(720/1280) */}
            <div
              ref={previewContainerRef}
              className="relative w-full overflow-hidden rounded-lg border border-border bg-muted md:mx-auto md:max-w-5xl"
              style={{ height: Math.max(220, Math.round((previewWidth || 760) * (TV_H / TV_W))) }}
            >
              {previewTab === 'classroom' && !previewUrlClassroom ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Monitor className="size-12 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Tahta önizlemesi için önce Akıllı Tahta sayfasından bir tahta ekleyin.
                  </p>
                  <Link href="/akilli-tahta" className="text-sm font-medium text-primary hover:underline">
                    Akıllı Tahta sayfasına git
                  </Link>
                </div>
              ) : (
                /* iframe sabit 1280×720 → scale ile dış kaba sığdırılır */
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: TV_W,
                    height: TV_H,
                    transformOrigin: 'top left',
                    transform: `scale(${previewScale})`,
                    pointerEvents: 'none',
                  }}
                >
                  <iframe
                    key={previewTab}
                    src={
                      previewTab === 'corridor'
                        ? previewUrlCorridor
                        : previewTab === 'teachers'
                          ? previewUrlTeachers
                          : previewUrlClassroom ?? ''
                    }
                    title={
                      previewTab === 'corridor'
                        ? 'Koridor TV önizleme'
                        : previewTab === 'teachers'
                          ? 'Öğretmenler TV önizleme'
                          : 'Akıllı Tahta TV önizleme'
                    }
                    width={TV_W}
                    height={TV_H}
                    style={{ display: 'block', border: 'none' }}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              )}
            </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'overflow-hidden shadow-sm',
                setupComplete
                  ? 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-l-4 border-l-amber-400 dark:border-l-amber-600 border-amber-200/60 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/15',
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {setupComplete ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <Circle className="size-5 text-primary" />
                  )}
                  <CardTitle className="text-base">
                    {setupComplete ? 'Kurulum tamamlandı' : `İlk kurulum adımları (${setupStepCount}/4)`}
                  </CardTitle>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Bu adımları tamamladığınızda TV ekranları hazır olur.</p>
              </CardHeader>
              <CardContent className="border-t border-border pt-4">
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    {hasTvSettings ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">1</span>}
                    <div>
                      <strong>TV ayarlarını doldur</strong> — Hava durumu şehri, hoş geldin görseli ve (isterseniz) YouTube linki.
                      {!hasTvSettings && (
                        <button type="button" onClick={() => setMainTab('ayarlar')} className="ml-1 text-primary hover:underline">
                          TV ayarları sekmesine git →
                        </button>
                      )}
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    {hasCorridorDevice && hasTeachersDevice ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">2</span>
                    )}
                    <div>
                      <strong>Her ekran için cihaz ekle ve eşleştir</strong> — Koridor ve öğretmenler odası için ayrı cihaz.
                      {(!hasCorridorDevice || !hasTeachersDevice) && (
                        <button type="button" onClick={() => setMainTab('cihazlar')} className="ml-1 text-primary hover:underline">
                          Cihazlar sekmesine git →
                        </button>
                      )}
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    {hasTvContent ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-bold text-primary">3</span>}
                    <div>
                      <strong>Duyurularda “Duyuru TV ekranında göster” işaretle</strong> — Kategori ve hedef ekran seçin.
                      {!hasTvContent && (
                        <button type="button" onClick={() => setMainTab('duyurular')} className="ml-1 text-primary hover:underline">
                          Duyurular sekmesine git →
                        </button>
                      )}
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {mainTab === 'ayarlar' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-foreground">TV ayarları</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hava durumu, hoş geldin görseli, tema, yan kartlar, yemek/nöbet listeleri, Excel içe aktarma ve yedekleme. Yalnızca bu sekmede düzenlenir.
                </p>
              </div>
              {canCreateAnnouncement ? (
                <button
                  type="button"
                  onClick={() => openCreateAnnouncement('general')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Plus className="size-4" aria-hidden />
                  Yeni duyuru
                </button>
              ) : null}
            </div>
            <Card className="border-l-4 border-l-blue-400 dark:border-l-blue-600 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm">
              <CardContent className="pt-6">
                {!schoolId ? (
                  <p className="py-4 text-sm text-muted-foreground">Okul atanmamış. Ayarlara erişmek için bir okula bağlı olmanız gerekir.</p>
                ) : school ? (
                  <TvSettingsForm token={token} school={school} onSaved={(s) => setSchool(s)} />
                ) : (
                  <div className="py-8">
                    <LoadingSpinner label="Okul bilgisi yükleniyor…" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {mainTab === 'cihazlar' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-foreground">TV cihazları</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Her ekran için <strong className="text-foreground">TV adresini kopyala</strong> → TV tarayıcısına yapıştırın → <strong className="text-foreground">Cihaz ekle</strong> ile kodu girin.
              </p>
            </div>
            <Card className="border-l-4 border-l-violet-400 dark:border-l-violet-600 bg-violet-50/30 dark:bg-violet-950/20">
              <CardContent className="pt-6">
                <TvDevicesSection
                  token={token}
                  devices={tvDevicesFiltered}
                  schoolId={schoolId ?? undefined}
                  onRefresh={() => setRefreshKey((k) => k + 1)}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {mainTab === 'icerik' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-foreground">İçerik özeti</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                TV’de hangi duyuruların hangi ekranda nasıl göründüğünü kontrol edin. Alt sekmeden ekran seçin.
              </p>
            </div>
            <Card className="border-l-4 border-l-amber-400 dark:border-l-amber-600 bg-amber-50/30 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Hedef ekran</CardTitle>
                  <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => setAudienceTab('corridor')}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        audienceTab === 'corridor'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Koridor ({tvItemsCorridor.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceTab('teachers')}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        audienceTab === 'teachers'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Öğretmenler ({tvItemsTeachers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceTab('classroom')}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        audienceTab === 'classroom'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Akıllı Tahta ({tvItemsClassroom.length})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {loading ? (
                  <div className="py-12">
                    <LoadingSpinner label="Yükleniyor…" />
                  </div>
                ) : currentItems.length === 0 && !school ? (
                  <EmptyState
                    icon={<PlayCircle />}
                    title="Bu ekran için içerik yok"
                    description="Duyurularda kategori seçip “Duyuru TV ekranında göster” işaretleyin. Hedef ekranı (koridor / öğretmenler / Akıllı Tahta) da seçebilirsiniz."
                  />
                ) : (
                  <BlockGrid
                    byCategory={currentByCategory}
                    allItems={currentItems}
                    blockConfig={BLOCK_CONFIG}
                    school={school ?? undefined}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {mainTab === 'duyurular' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-foreground">Okul duyuruları</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                TV’de görünecek duyuruları burada yönetin. Üstteki hızlı şablonlar veya &quot;Yeni duyuru&quot; ile ekleyebilirsiniz.
              </p>
            </div>
            <AnnouncementListSection
              token={token}
              isSchoolAdmin={me?.role === 'school_admin'}
              schoolId={isSuperadmin ? schoolId ?? undefined : undefined}
              refreshTrigger={refreshKey}
              onRefresh={refetchAnnouncements}
              onCreateClick={canCreateAnnouncement ? () => openCreateAnnouncement('general') : undefined}
              onCreateWithTemplate={canCreateAnnouncement ? openCreateAnnouncement : undefined}
              cardClassName="border-l-4 border-l-amber-400 dark:border-l-amber-600 bg-amber-50/25 dark:bg-amber-950/20"
              showAddToAgenda={agendaAfterTvAyarlar}
            />
          </div>
        )}

        {mainTab === 'yardim' && (
          <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-500/10 via-background to-violet-500/10 p-6 shadow-sm sm:p-8 dark:from-sky-500/10 dark:via-background dark:to-violet-500/20">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/15" aria-hidden />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner ring-1 ring-primary/20">
                    <HelpCircle className="size-7" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Duyuru TV</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      Nasıl çalışır?
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                      Bu panelden içerik yönetirsiniz; TV’ler tarayıcıda canlı yayını gösterir. Aşağıdaki sırayı izleyerek birkaç dakikada yayına alabilirsiniz.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground/90 backdrop-blur-sm">
                    <Monitor className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
                    3 ekran
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-foreground/90 backdrop-blur-sm">
                    <BookOpen className="size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                    Adım adım
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { t: 'Koridor', d: 'Genel duyuru ve slaytlar', icon: Monitor, className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
                { t: 'Öğretmenler odası', d: 'Aynı içerik, ayrı adres', icon: Users, className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
                { t: 'Akıllı tahta', d: 'Sınıf / cihaz eşlemesi', icon: LayoutGrid, className: 'bg-amber-500/10 text-amber-800 dark:text-amber-200' },
              ].map((c) => (
                <div
                  key={c.t}
                  className="flex gap-3 rounded-xl border border-border/70 bg-card/50 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30"
                >
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', c.className)}>
                    <c.icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{c.t}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kurulum</h3>
              {[
                {
                  step: '1',
                  title: 'TV ayarları',
                  subtitle: 'Zorunlu ilk adım',
                  body:
                    'Hava durumu şehri, hoş geldin görseli, tema, yan kartlar ve görünürlük seçenekleri. Yemek, nöbet, belirli gün, doğum günü ve ders programı listelerini Excel ile yükleyebilir veya elle girebilirsiniz. Yedek indir / yedekten yükle ile tüm veriyi saklayabilirsiniz.',
                  icon: Settings,
                  accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25',
                },
                {
                  step: '2',
                  title: 'Cihazları eşleştirin',
                  subtitle: 'Adres + kod',
                  body: (
                    <>
                      <strong className="text-foreground">Cihazlar</strong> sekmesinde her ekran için{' '}
                      <strong className="text-foreground">Adresi kopyala</strong> ile tam bağlantıyı TV tarayıcısına yapıştırın; ardından{' '}
                      <strong className="text-foreground">Cihaz ekle</strong> ile kod üretin. Akıllı tahta bağlantısı{' '}
                      <strong className="text-foreground">Akıllı Tahta</strong> listesindedir. İsteğe bağlı: adres sonuna{' '}
                      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">?kiosk=1</code>.
                    </>
                  ),
                  icon: Link2,
                  accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/25',
                },
                {
                  step: '3',
                  title: 'Duyuru ekleyin',
                  subtitle: 'Slayt veya şerit',
                  body: (
                    <ul className="space-y-2 list-none pl-0">
                      {[
                        'Kategori seçin (Öğretmenlerimiz, Belirli Gün, Genel vb.).',
                        '“Duyuru TV ekranında göster” kutusunu işaretleyin.',
                        'Hedef ekran: Tüm ekranlar, Koridor + Öğretmenler, yalnızca koridor / öğretmenler veya Akıllı Tahta.',
                        'Görsel URL varsa slaytta kullanılır. Metinde **kelime** turuncu vurgulanır.',
                      ].map((line) => (
                        <li key={line} className="flex gap-2 text-sm leading-relaxed">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                  icon: Megaphone,
                  accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/25',
                },
              ].map((block) => (
                <Card key={block.step} className={cn('overflow-hidden border bg-gradient-to-br to-transparent shadow-sm', block.accent)}>
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background/80 text-foreground shadow-sm ring-1 ring-border/60">
                      <block.icon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                          {block.step}
                        </span>
                        <CardTitle className="text-lg">{block.title}</CardTitle>
                      </div>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{block.subtitle}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed text-muted-foreground">{block.body}</CardContent>
                </Card>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Öne çıkanlar</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: 'Sarı bar',
                    desc: 'Kategori “Okul Duyuruları (Sarı Bar)” — altta kayan duyuru bandı.',
                    icon: Megaphone,
                    ring: 'ring-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200',
                  },
                  {
                    title: 'Acil duyuru',
                    desc: 'Yayındaki duyuruda sarı üçgen ile 5/15/30/60 dk tüm ekranları kaplayın.',
                    icon: AlertTriangle,
                    ring: 'ring-red-500/20 bg-red-500/10 text-red-800 dark:text-red-200',
                  },
                  {
                    title: 'Slayt süresi',
                    desc: 'TV ayarlarındaki varsayılan süre (sn) ile orta alan blokları döner.',
                    icon: Clock3,
                    ring: 'ring-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200',
                  },
                  {
                    title: 'IP kısıtlaması',
                    desc: 'Yalnızca okul ağından erişim için TV ayarlarında IP tanımlayın.',
                    icon: Shield,
                    ring: 'ring-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
                  },
                  {
                    title: 'YouTube',
                    desc: 'Video içeren duyurular tam ekran video slaytında; başlık ve metin videonun üzerinde okunabilir.',
                    icon: Film,
                    ring: 'ring-violet-500/20 bg-violet-500/10 text-violet-800 dark:text-violet-200',
                  },
                  {
                    title: 'Gece modu',
                    desc: 'Ekran ömrü için başlangıç/bitiş saatleri. Kapalı devre kurulum: KAPALI_DEVRE_KURULUM.md',
                    icon: Moon,
                    ring: 'ring-indigo-500/20 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200',
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="flex gap-3 rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/25"
                  >
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl ring-1', f.ring)}>
                      <f.icon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{f.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4 sm:px-5">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">İpucu:</span> Önce{' '}
                <button type="button" onClick={() => setMainTab('ayarlar')} className="font-semibold text-primary underline-offset-4 hover:underline">
                  TV Ayarları
                </button>{' '}
                sekmesini ziyaret edin; ardından duyuru detayından kişisel ajandaya eklemeniz mümkün olur.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function tvPlayerPath(group: 'corridor' | 'teachers', schoolId?: string) {
  const base = group === 'corridor' ? '/tv/corridor' : '/tv/teachers';
  if (!schoolId) return base;
  return `${base}?school_id=${encodeURIComponent(schoolId)}`;
}

function TvDevicesSection({
  token,
  devices,
  schoolId,
  onRefresh,
}: {
  token: string | null;
  devices: TvDevice[];
  schoolId: string | undefined;
  onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingDevice, setEditingDevice] = useState<TvDevice | null>(null);

  const copyTvUrl = (group: 'corridor' | 'teachers') => {
    if (!schoolId) {
      toast.error('Önce üstten okul seçin');
      return;
    }
    const path = tvPlayerPath(group, schoolId);
    const full = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    void navigator.clipboard.writeText(full).then(() =>
      toast.success(
        group === 'corridor'
          ? 'Koridor TV adresi kopyalandı — TV’de yapıştırın (Ctrl+V)'
          : 'Öğretmenler TV adresi kopyalandı — TV’de yapıştırın (Ctrl+V)',
      ),
    );
  };

  const handleRemove = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/tv-devices/${id}`, { method: 'DELETE', token });
      toast.success('Cihaz silindi');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const corridorDevices = devices.filter((d) => d.display_group === 'corridor');
  const teachersDevices = devices.filter((d) => d.display_group === 'teachers');

  const createForGroup = async (group: 'corridor' | 'teachers') => {
    if (!token) return;
    setCreating(true);
    try {
      await apiFetch('/tv-devices', {
        method: 'POST',
        token,
        body: JSON.stringify({
          display_group: group,
          ...(schoolId ? { school_id: schoolId } : {}),
        }),
      });
      toast.success(`TV cihazı oluşturuldu. Eşleştirme kodunu ${group === 'corridor' ? 'Koridor' : 'Öğretmenler'} ekranında girin.`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const DeviceCard = ({ group, groupLabel, items }: { group: 'corridor' | 'teachers'; groupLabel: string; items: TvDevice[] }) => (
    <div
      className={cn(
        'rounded-lg border p-4',
        group === 'corridor'
          ? 'border-sky-200 dark:border-sky-800/70 bg-sky-50/40 dark:bg-sky-950/25'
          : 'border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/25',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{groupLabel}</h4>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={schoolId ? tvPlayerPath(group, schoolId) : tvPlayerPath(group)}>
            {schoolId ? tvPlayerPath(group, schoolId) : `${tvPlayerPath(group)} — okul seçin`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyTvUrl(group)}
            disabled={!schoolId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            title="Tam adresi panoya kopyalar (uzun URL yazmaya gerek yok)"
          >
            <Copy className="size-3.5" />
            Adresi kopyala
          </button>
          <button
            type="button"
            onClick={() => createForGroup(group)}
            disabled={!token || creating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <LoadingSpinner /> : <Plus className="size-3.5" />}
            Cihaz ekle
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Bu ekran için henüz cihaz eklenmemiş.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded border border-border bg-background p-2">
              <div className="flex items-center gap-2">
                {d.status === 'online' ? (
                  <span title="Çevrimiçi"><Wifi className="size-4 text-emerald-600" /></span>
                ) : (
                  <span title="Çevrimdışı"><WifiOff className="size-4 text-muted-foreground" /></span>
                )}
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <code className="rounded bg-muted px-1 font-mono">{d.pairing_code}</code>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(d.pairing_code); toast.success('Kopyalandı'); }}
                        className="rounded p-0.5 hover:bg-muted"
                        title="Kopyala"
                      >
                        <Copy className="size-3" />
                      </button>
                    </span>
                    {d.last_seen_at && ` · ${new Date(d.last_seen_at).toLocaleString('tr-TR')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEditingDevice(d)} className="rounded p-1.5 hover:bg-muted" title="Düzenle">
                  <Pencil className="size-3.5" />
                </button>
                <button type="button" onClick={() => handleRemove(d.id)} className="rounded p-1.5 hover:bg-destructive/10 text-destructive" title="Sil">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Akıllı Tahta TV bağlantıları <strong className="text-foreground">Akıllı Tahta</strong> sayfasındadır.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <DeviceCard group="corridor" groupLabel="Koridor ekranı" items={corridorDevices} />
        <DeviceCard group="teachers" groupLabel="Öğretmenler odası ekranı" items={teachersDevices} />
      </div>
      {editingDevice && (
        <TvDeviceEditModal
          device={editingDevice}
          token={token}
          onClose={() => setEditingDevice(null)}
          onSuccess={() => {
            setEditingDevice(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function TvDeviceEditModal({
  device,
  token,
  onClose,
  onSuccess,
}: {
  device: TvDevice;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [displayGroup, setDisplayGroup] = useState(device.display_group);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiFetch(`/tv-devices/${device.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ name: name.trim() || 'TV Ekranı', display_group: displayGroup }),
      });
      toast.success('Cihaz güncellendi');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="TV cihazını düzenle">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="device-name" className="mb-1 block text-sm font-medium">Cihaz adı</label>
            <input
              id="device-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Koridor 1. kat"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="device-group" className="mb-1 block text-sm font-medium">Ekran grubu</label>
            <select
              id="device-group"
              value={displayGroup}
              onChange={(e) => setDisplayGroup(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="corridor">Koridor</option>
              <option value="teachers">Öğretmenler Odası</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              TV cihaz eşleştirme: Koridor veya Öğretmenler Odası. Akıllı Tahta ayrı modülden.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Eşleştirme kodu:</span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{device.pairing_code}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(device.pairing_code);
                toast.success('Eşleştirme kodu kopyalandı');
              }}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Copy className="size-3.5" />
              Kopyala
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockGrid({
  byCategory,
  allItems,
  blockConfig,
  school,
}: {
  byCategory: Record<string, TvAnnouncement[]>;
  allItems: TvAnnouncement[];
  blockConfig: typeof BLOCK_CONFIG;
  school?: SchoolTvConfig | null;
}) {
  const orta = blockConfig.filter((b) => b.group === 'orta');
  const sag = blockConfig.filter((b) => b.group === 'sag');
  const alt = blockConfig.filter((b) => b.group === 'alt');

  const getItems = (cfg: (typeof blockConfig)[0]) => {
    if (cfg.categoryKey === '_rss') {
      const hasRss = !!school?.tv_rss_url?.trim();
      return hasRss ? [{ id: '_rss', title: 'RSS ayarlandı', summary: school?.tv_rss_url ?? null, body: null } as TvAnnouncement] : [];
    }
    if (cfg.categoryKey === '_gunun_sozu') {
      const hasUrl = !!school?.tv_gunun_sozu_rss_url?.trim();
      return hasUrl ? [{ id: '_quote', title: 'Günün Sözü RSS ayarlandı', summary: school?.tv_gunun_sozu_rss_url ?? null, body: null } as TvAnnouncement] : [];
    }
    if (cfg.filter) return cfg.filter(byCategory[cfg.categoryKey] ?? [], allItems);
    return byCategory[cfg.categoryKey] ?? [];
  };

  const getScheduleCount = (key: 'meal' | 'duty' | 'special_day' | 'timetable' | 'birthday'): number => {
    if (!school) return 0;
    if (key === 'timetable' && school.tv_timetable_use_school_plan !== false) return 1;
    const raw =
      key === 'meal' ? school.tv_meal_schedule
        : key === 'duty' ? school.tv_duty_schedule
        : key === 'special_day' ? school.tv_special_days_calendar
        : key === 'birthday' ? school.tv_birthday_calendar
        : school.tv_timetable_schedule;
    if (!raw?.trim()) return 0;
    try {
      const o = JSON.parse(raw) as { entries?: unknown[] };
      return Array.isArray(o?.entries) ? o.entries.length : 0;
    } catch {
      return 0;
    }
  };

  const getScheduleEntries = (key: 'meal' | 'duty' | 'special_day' | 'timetable' | 'birthday') => {
    if (!school) return [];
    const raw =
      key === 'meal' ? school.tv_meal_schedule
        : key === 'duty' ? school.tv_duty_schedule
        : key === 'special_day' ? school.tv_special_days_calendar
        : key === 'birthday' ? school.tv_birthday_calendar
        : school.tv_timetable_schedule;
    if (!raw?.trim()) return [];
    try {
      const o = JSON.parse(raw) as { entries?: unknown[] };
      const arr = Array.isArray(o?.entries) ? o.entries : [];
      return arr;
    } catch {
      return [];
    }
  };

  const getCountdownTargets = (): Array<{ label: string; target_date: string }> => {
    if (!school?.tv_countdown_targets?.trim()) return [];
    try {
      const arr = JSON.parse(school.tv_countdown_targets) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x): x is { label?: string; target_date?: string } => x && typeof x === 'object')
        .map((x) => ({ label: String(x.label ?? '').trim() || 'Hedef', target_date: String(x.target_date ?? '').trim() }))
        .filter((x) => x.target_date);
    } catch {
      return [];
    }
  };

  const renderGroup = (label: string, configs: typeof orta) => (
    <div key={label} className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {configs.map((cfg) => {
          const items = getItems(cfg);
          const scheduleCount =
            cfg.categoryKey === 'meal'
              ? getScheduleCount('meal')
              : cfg.categoryKey === 'duty'
                ? getScheduleCount('duty')
                : cfg.categoryKey === 'special_day'
                  ? getScheduleCount('special_day')
                  : cfg.categoryKey === 'birthday'
                    ? getScheduleCount('birthday')
                    : cfg.categoryKey === 'timetable'
                      ? getScheduleCount('timetable')
                      : 0;
          const scheduleEntries =
            cfg.categoryKey === 'meal' ? getScheduleEntries('meal')
            : cfg.categoryKey === 'duty' ? getScheduleEntries('duty')
            : cfg.categoryKey === 'special_day' ? getScheduleEntries('special_day')
            : cfg.categoryKey === 'birthday' ? getScheduleEntries('birthday')
            : cfg.categoryKey === 'timetable' ? getScheduleEntries('timetable')
            : [];
          const countdownTargets = cfg.categoryKey === 'countdown' ? getCountdownTargets() : [];
          const weatherCity = cfg.categoryKey === 'weather' ? school?.tv_weather_city : undefined;
          const hasScheduleData = scheduleEntries.length > 0 || (cfg.categoryKey === 'countdown' && countdownTargets.length > 0) || (cfg.categoryKey === 'weather' && weatherCity?.trim());
          const effectiveItems = items.length > 0 ? items : (scheduleCount > 0 && !hasScheduleData)
            ? [{ id: `_schedule-${cfg.categoryKey}`, title: `${scheduleCount} kayıt (ayarlardan)`, summary: null, body: null } as TvAnnouncement]
            : [];
          return (
            <SectionBlock
              key={cfg.title}
              icon={cfg.icon}
              title={cfg.title}
              helpTooltip={cfg.helpTooltip}
              categoryKey={cfg.categoryKey}
              accent={cfg.accent}
              items={effectiveItems.length > 0 ? effectiveItems : items}
              fallback={cfg.fallback}
              single={cfg.single}
              scheduleCount={scheduleCount}
              scheduleEntries={scheduleEntries}
              countdownTargets={countdownTargets}
              weatherCity={weatherCity}
              isConfigBlock={cfg.categoryKey.startsWith('_')}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {renderGroup('Orta bölüm (slaytlar)', orta)}
      {renderGroup('Sağ panel', sag)}
      {renderGroup('Alt şeritler', alt)}
    </div>
  );
}

function formatScheduleEntry(
  key: string,
  entry: Record<string, unknown>,
): string {
  if (key === 'meal') {
    const day = entry.day_of_week ? DAY_NAMES[Number(entry.day_of_week)] : entry.date;
    const title = String(entry.title ?? '').trim() || 'Yemek';
    const menu = String(entry.menu ?? '').trim();
    return `${day ?? '—'}: ${title}${menu ? ` — ${menu.slice(0, 40)}${menu.length > 40 ? '…' : ''}` : ''}`;
  }
  if (key === 'duty') {
    const day = entry.day_of_week ? DAY_NAMES[Number(entry.day_of_week)] : entry.date;
    const title = String(entry.title ?? '').trim() || 'Nöbet';
    const info = String(entry.info ?? '').trim();
    return `${day ?? '—'}: ${title}${info ? ` — ${info}` : ''}`;
  }
  if (key === 'special_day') {
    const date = String(entry.date ?? '').slice(0, 10);
    const title = String(entry.title ?? '').trim();
    const resp = String(entry.responsible ?? '').trim();
    return `${date}: ${title}${resp ? ` (${resp})` : ''}`;
  }
  if (key === 'birthday') {
    const date = String(entry.date ?? '').slice(0, 10);
    const name = String(entry.name ?? '').trim();
    const type = entry.type === 'student' ? 'Öğrenci' : 'Öğretmen';
    const cls = entry.class_section ? ` · ${entry.class_section}` : '';
    return `${date}: ${name} (${type}${cls})`;
  }
  if (key === 'timetable') {
    const day = entry.day ? WEEKDAY_NAMES[Number(entry.day)] : '';
    const lesson = entry.lesson;
    const cls = String(entry.class ?? '').trim();
    const subj = String(entry.subject ?? '').trim();
    return `${day} ${lesson}. ders: ${cls} — ${subj}`;
  }
  return String(entry.title ?? entry.label ?? JSON.stringify(entry).slice(0, 50));
}

function SectionBlock({
  icon,
  title,
  helpTooltip,
  categoryKey,
  accent,
  items,
  fallback,
  single,
  scheduleCount = 0,
  scheduleEntries = [],
  countdownTargets = [],
  weatherCity,
  isConfigBlock = false,
}: {
  icon: React.ReactNode;
  title: string;
  helpTooltip?: string;
  categoryKey: string;
  accent?: keyof typeof ACCENT_CLASSES;
  items: TvAnnouncement[];
  fallback: string;
  single?: boolean;
  scheduleCount?: number;
  scheduleEntries?: unknown[];
  countdownTargets?: Array<{ label: string; target_date: string }>;
  weatherCity?: string | null;
  isConfigBlock?: boolean;
}) {
  const hasItems = items.length > 0;
  const hasScheduleData = scheduleEntries.length > 0 || countdownTargets.length > 0 || (weatherCity && weatherCity.trim());
  const displayItems = single ? items.slice(0, 1) : items.slice(0, 3);
  const displaySchedule = scheduleEntries.slice(0, 5);
  const categoryLabel = CATEGORY_LABELS[categoryKey] ?? (categoryKey.startsWith('_') ? 'Ayarlardan' : categoryKey);
  const accentStyles = accent ? ACCENT_CLASSES[accent] : null;
  const totalCount =
    scheduleCount > 0 ? scheduleCount
    : hasItems ? items.length
    : countdownTargets.length > 0 ? countdownTargets.length
    : (weatherCity?.trim() ? 1 : 0);

  return (
    <div
      className={cn(
        'group rounded-xl border p-4 shadow-sm transition-all hover:shadow-md',
        accentStyles ? accentStyles.card : 'border-border bg-card hover:border-primary/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
              accentStyles ? `${accentStyles.iconBg} ${accentStyles.iconText}` : 'bg-primary/10 text-primary group-hover:bg-primary/15',
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {title}
              {helpTooltip && (
                <span title={helpTooltip} className="ml-1.5 cursor-help">
                  <HelpCircle className="inline size-3.5 text-muted-foreground" />
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
            hasItems || scheduleCount > 0 || hasScheduleData
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {totalCount}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {hasScheduleData && (
          <>
            {categoryKey === 'weather' && weatherCity?.trim() && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">Şehir</p>
                <p className="mt-0.5 text-muted-foreground">{weatherCity}</p>
              </div>
            )}
            {countdownTargets.length > 0 && (
              <>
                {countdownTargets.slice(0, 4).map((t, i) => (
                  <div key={i} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                    <p className="font-medium text-foreground">{t.label}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {new Date(t.target_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                ))}
                {countdownTargets.length > 4 && (
                  <p className="text-xs text-muted-foreground">+{countdownTargets.length - 4} sayaç daha</p>
                )}
              </>
            )}
            {displaySchedule.length > 0 && ['meal', 'duty', 'special_day', 'birthday', 'timetable'].includes(categoryKey) && (
              <>
                {displaySchedule.map((entry, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-foreground">
                      {formatScheduleEntry(categoryKey, entry as Record<string, unknown>)}
                    </p>
                  </div>
                ))}
                {scheduleEntries.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{scheduleEntries.length - 5} kayıt daha</p>
                )}
              </>
            )}
          </>
        )}
        {hasItems && (
          <>
            {displayItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
              >
                <p className="font-medium text-foreground truncate">{item.title || '—'}</p>
                {!isConfigBlock && (item.summary || item.body) && (
                  <p className="mt-1 line-clamp-2 text-muted-foreground">
                    {item.summary || item.body}
                  </p>
                )}
                {!isConfigBlock && item.creator?.display_name && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Ekleyen: {item.creator.display_name}
                  </p>
                )}
                {isConfigBlock && (item.summary || item.body) && (
                  <p className="mt-1 truncate text-muted-foreground">{item.summary || item.body}</p>
                )}
              </div>
            ))}
            {(single && items.length > 1) || (!single && items.length > 3) ? (
              <p className="text-xs text-muted-foreground">+{items.length - displayItems.length} kayıt daha</p>
            ) : null}
          </>
        )}
        {!hasItems && !hasScheduleData && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{fallback}</p>
        )}
      </div>
    </div>
  );
}

function TvSettingsForm({
  token,
  school,
  onSaved,
}: {
  token: string | null;
  school: SchoolTvConfig;
  onSaved: (s: SchoolTvConfig) => void;
}) {
  const [allowedIps, setAllowedIps] = useState(school.tv_allowed_ips ?? '');
  const [weatherCity, setWeatherCity] = useState(school.tv_weather_city ?? '');
  const [welcomeImageUrl, setWelcomeImageUrl] = useState(school.tv_welcome_image_url ?? '');
  const [slideDuration, setSlideDuration] = useState(String(school.tv_default_slide_duration ?? 10));
  const [rssUrl, setRssUrl] = useState(school.tv_rss_url ?? '');
  const [rssMarqueeDuration, setRssMarqueeDuration] = useState(String(school.tv_rss_marquee_duration ?? 90));
  const [rssMarqueeFontSize, setRssMarqueeFontSize] = useState(String(school.tv_rss_marquee_font_size ?? 18));
  const [gununSozuRssUrl, setGununSozuRssUrl] = useState(school.tv_gunun_sozu_rss_url ?? '');
  const [gununSozuFontSize, setGununSozuFontSize] = useState(String(school.tv_gunun_sozu_font_size ?? 20));
  const [gununSozuMarqueeDuration, setGununSozuMarqueeDuration] = useState(String(school.tv_gunun_sozu_marquee_duration ?? 90));
  const [gununSozuTextTransform, setGununSozuTextTransform] = useState(school.tv_gunun_sozu_text_transform ?? 'none');
  const [tickerMarqueeDuration, setTickerMarqueeDuration] = useState(String(school.tv_ticker_marquee_duration ?? 45));
  const [tickerFontSize, setTickerFontSize] = useState(String(school.tv_ticker_font_size ?? 18));
  const [tickerTextTransform, setTickerTextTransform] = useState(school.tv_ticker_text_transform ?? 'none');
  const [nowInClassBarTitle, setNowInClassBarTitle] = useState(school.tv_now_in_class_bar_title ?? '');
  const [nowInClassBarFontSize, setNowInClassBarFontSize] = useState(String(school.tv_now_in_class_bar_font_size ?? 18));
  const [nowInClassBarMarqueeDuration, setNowInClassBarMarqueeDuration] = useState(String(school.tv_now_in_class_bar_marquee_duration ?? 30));
  const [nightStart, setNightStart] = useState(school.tv_night_mode_start ?? '');
  const [nightEnd, setNightEnd] = useState(school.tv_night_mode_end ?? '');
  const [logoUrl, setLogoUrl] = useState(school.tv_logo_url ?? '');
  const [cardPosition, setCardPosition] = useState(school.tv_card_position ?? 'right');
  const [logoPosition, setLogoPosition] = useState(school.tv_logo_position ?? 'left');
  const [logoSize, setLogoSize] = useState<'small' | 'medium' | 'large'>(() => {
    const s = school.tv_logo_size;
    return s === 'small' || s === 'large' ? s : 'medium';
  });
  const [theme, setTheme] = useState(school.tv_theme ?? 'dark');
  const [primaryColor, setPrimaryColor] = useState(school.tv_primary_color ?? '');
  const [visibleCards, setVisibleCards] = useState<Set<string>>(() =>
    mergeTvVisibleCardsFromServer(school.tv_visible_cards),
  );
  const [countdownCardTitle, setCountdownCardTitle] = useState(school.tv_countdown_card_title ?? '');
  const [countdownFontSize, setCountdownFontSize] = useState(String(school.tv_countdown_font_size ?? 24));
  const [countdownSeparator, setCountdownSeparator] = useState<'bullet' | 'pipe' | 'dash'>(() => {
    const s = school.tv_countdown_separator;
    return s === 'pipe' || s === 'dash' ? s : 'bullet';
  });
  const [mealCardTitle, setMealCardTitle] = useState(school.tv_meal_card_title ?? '');
  const [mealFontSize, setMealFontSize] = useState(String(school.tv_meal_font_size ?? 18));
  const [mealScheduleType, setMealScheduleType] = useState<'weekly' | 'by_date'>(() => {
    try {
      const raw = school.tv_meal_schedule?.trim();
      if (!raw) return 'weekly';
      const o = JSON.parse(raw) as { schedule_type?: string };
      return o.schedule_type === 'by_date' ? 'by_date' : 'weekly';
    } catch {
      return 'weekly';
    }
  });
  const [mealEntries, setMealEntries] = useState<MealEntry[]>(() => {
    try {
      const raw = school.tv_meal_schedule?.trim();
      if (!raw) return [{ title: '', menu: '' }];
      const o = JSON.parse(raw) as { entries?: MealEntry[] };
      const arr = Array.isArray(o.entries) ? o.entries : [];
      if (arr.length === 0) return [{ title: '', menu: '' }];
      return arr.map((e) => ({
        day_of_week: e.day_of_week,
        date: e.date ?? '',
        title: String(e.title ?? '').trim(),
        menu: String(e.menu ?? '').trim(),
      }));
    } catch {
      return [{ title: '', menu: '' }];
    }
  });
  const [dutyCardTitle, setDutyCardTitle] = useState(school.tv_duty_card_title ?? '');
  const [dutyFontSize, setDutyFontSize] = useState(String(school.tv_duty_font_size ?? 18));
  const [dutyScheduleType, setDutyScheduleType] = useState<'weekly' | 'by_date'>(() => {
    try {
      const raw = school.tv_duty_schedule?.trim();
      if (!raw) return 'weekly';
      const o = JSON.parse(raw) as { schedule_type?: string };
      return o.schedule_type === 'by_date' ? 'by_date' : 'weekly';
    } catch {
      return 'weekly';
    }
  });
  const [dutyEntries, setDutyEntries] = useState<DutyEntry[]>(() => {
    try {
      const raw = school.tv_duty_schedule?.trim();
      if (!raw) return [{ title: '', info: '' }];
      const o = JSON.parse(raw) as { entries?: DutyEntry[] };
      const arr = Array.isArray(o.entries) ? o.entries : [];
      if (arr.length === 0) return [{ title: '', info: '' }];
      return arr.map((e) => ({
        day_of_week: e.day_of_week,
        date: e.date ?? '',
        title: String(e.title ?? '').trim(),
        info: String(e.info ?? '').trim(),
      }));
    } catch {
      return [{ title: '', info: '' }];
    }
  });
  const [specialDaysEntries, setSpecialDaysEntries] = useState<SpecialDayEntry[]>(() => {
    try {
      const raw = school.tv_special_days_calendar?.trim();
      if (!raw) return [];
      const o = JSON.parse(raw) as { entries?: SpecialDayEntry[] };
      const arr = Array.isArray(o.entries) ? o.entries : [];
      return arr.filter((e) => e.date && e.title).map((e) => ({
        date: String(e.date ?? '').slice(0, 10),
        title: String(e.title ?? '').trim(),
        responsible: String(e.responsible ?? '').trim(),
        description: e.description ? String(e.description).trim() : undefined,
        image_url: e.image_url ? String(e.image_url).trim() : undefined,
      }));
    } catch {
      return [];
    }
  });
  const [timetableLessonTimes, setTimetableLessonTimes] = useState<TimetableLessonTime[]>(() => {
    try {
      const raw = school.tv_timetable_schedule?.trim();
      if (!raw) return [{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }];
      const o = JSON.parse(raw) as { lesson_times?: TimetableLessonTime[] };
      const arr = Array.isArray(o.lesson_times) ? o.lesson_times : [];
      return arr.length > 0 ? arr : [{ num: 1, start: '08:30', end: '09:10' }];
    } catch {
      return [{ num: 1, start: '08:30', end: '09:10' }];
    }
  });
  const [timetableClassSections, setTimetableClassSections] = useState<string[]>(() => {
    try {
      const raw = school.tv_timetable_schedule?.trim();
      if (!raw) return ['1A', '1B', '1C'];
      const o = JSON.parse(raw) as { class_sections?: string[] };
      const arr = Array.isArray(o.class_sections) ? o.class_sections : [];
      return arr.length > 0 ? arr : ['1A', '1B', '1C'];
    } catch {
      return ['1A', '1B', '1C'];
    }
  });
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>(() => {
    try {
      const raw = school.tv_timetable_schedule?.trim();
      if (!raw) return [];
      const o = JSON.parse(raw) as { entries?: TimetableEntry[] };
      return Array.isArray(o.entries) ? o.entries : [];
    } catch {
      return [];
    }
  });
  const [birthdayCardTitle, setBirthdayCardTitle] = useState(school.tv_birthday_card_title ?? '');
  const [birthdayFontSize, setBirthdayFontSize] = useState(String(school.tv_birthday_font_size ?? 24));
  const [birthdayEntries, setBirthdayEntries] = useState<BirthdayEntry[]>(() => {
    try {
      const raw = school.tv_birthday_calendar?.trim();
      if (!raw) return [];
      const o = JSON.parse(raw) as { entries?: BirthdayEntry[] };
      const arr = Array.isArray(o.entries) ? o.entries : [];
      return arr
        .filter((e): e is BirthdayEntry => e && typeof e === 'object' && typeof (e as BirthdayEntry).date === 'string' && typeof (e as BirthdayEntry).name === 'string')
        .map((e) => ({
          date: String((e as BirthdayEntry).date ?? '').slice(0, 10),
          name: String((e as BirthdayEntry).name ?? '').trim(),
          type: ((e as BirthdayEntry).type === 'student' ? 'student' : 'teacher') as 'teacher' | 'student',
          class_section: (e as BirthdayEntry).class_section ? String((e as BirthdayEntry).class_section).trim() || undefined : undefined,
        }));
    } catch {
      return [];
    }
  });
  const [countdownTargets, setCountdownTargets] = useState<CountdownTarget[]>(() => {
    try {
      const raw = school.tv_countdown_targets?.trim();
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x): x is { label?: string; target_date?: string } => x && typeof x === 'object')
        .map((x) => {
          const raw = String(x.target_date ?? '').trim();
          const hasTime = raw.includes('T');
          return {
            label: String(x.label ?? '').trim() || 'Hedef',
            target_date: hasTime ? raw.slice(0, 16) : (raw.slice(0, 10) || '') + 'T09:00',
          };
        })
        .filter((x) => x.target_date);
    } catch {
      return [];
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [timetableUseSchoolPlan, setTimetableUseSchoolPlan] = useState(() => school.tv_timetable_use_school_plan !== false);
  const [timetablePreview, setTimetablePreview] = useState<{
    empty: boolean;
    entry_count: number;
    lesson_times_count: number;
    class_sections: string[];
    sample_entries: Array<{ day: number; lesson: number; class: string; subject: string }>;
  } | null>(null);
  const [timetablePreviewLoading, setTimetablePreviewLoading] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'genel' | 'görünüm' | 'alt' | 'sag' | 'takvim'>('genel');

  useEffect(() => {
    setAllowedIps(school.tv_allowed_ips ?? '');
    setWeatherCity(school.tv_weather_city ?? '');
    setWelcomeImageUrl(school.tv_welcome_image_url ?? '');
    setSlideDuration(String(school.tv_default_slide_duration ?? 10));
    setRssUrl(school.tv_rss_url ?? '');
    setRssMarqueeDuration(String(school.tv_rss_marquee_duration ?? 90));
    setRssMarqueeFontSize(String(school.tv_rss_marquee_font_size ?? 18));
    setGununSozuRssUrl(school.tv_gunun_sozu_rss_url ?? '');
    setGununSozuFontSize(String(school.tv_gunun_sozu_font_size ?? 20));
    setGununSozuMarqueeDuration(String(school.tv_gunun_sozu_marquee_duration ?? 90));
    setGununSozuTextTransform(school.tv_gunun_sozu_text_transform ?? 'none');
    setTickerMarqueeDuration(String(school.tv_ticker_marquee_duration ?? 45));
    setTickerFontSize(String(school.tv_ticker_font_size ?? 18));
    setTickerTextTransform(school.tv_ticker_text_transform ?? 'none');
    setNowInClassBarTitle(school.tv_now_in_class_bar_title ?? '');
    setNowInClassBarFontSize(String(school.tv_now_in_class_bar_font_size ?? 18));
    setNowInClassBarMarqueeDuration(String(school.tv_now_in_class_bar_marquee_duration ?? 30));
    setNightStart(school.tv_night_mode_start ?? '');
    setNightEnd(school.tv_night_mode_end ?? '');
    setLogoUrl(school.tv_logo_url ?? '');
    setCardPosition(school.tv_card_position ?? 'right');
    setLogoPosition(school.tv_logo_position ?? 'left');
    const ls = school.tv_logo_size;
    setLogoSize(ls === 'small' || ls === 'large' ? ls : 'medium');
    setTheme(school.tv_theme ?? 'dark');
    setPrimaryColor(school.tv_primary_color ?? '');
    setVisibleCards(mergeTvVisibleCardsFromServer(school.tv_visible_cards));
    setCountdownCardTitle(school.tv_countdown_card_title ?? '');
    setCountdownFontSize(String(school.tv_countdown_font_size ?? 24));
    setMealCardTitle(school.tv_meal_card_title ?? '');
    setMealFontSize(String(school.tv_meal_font_size ?? 18));
    try {
      const raw = school.tv_meal_schedule?.trim();
      if (!raw) {
        setMealScheduleType('weekly');
        setMealEntries([{ title: '', menu: '' }]);
      } else {
        const o = JSON.parse(raw) as { schedule_type?: string; entries?: MealEntry[] };
        setMealScheduleType(o.schedule_type === 'by_date' ? 'by_date' : 'weekly');
        const arr = Array.isArray(o.entries) ? o.entries : [];
        setMealEntries(arr.length ? arr.map((e) => ({ day_of_week: e.day_of_week, date: e.date ?? '', title: String(e.title ?? ''), menu: String(e.menu ?? '') })) : [{ title: '', menu: '' }]);
      }
    } catch {
      setMealScheduleType('weekly');
      setMealEntries([{ title: '', menu: '' }]);
    }
    setDutyCardTitle(school.tv_duty_card_title ?? '');
    setDutyFontSize(String(school.tv_duty_font_size ?? 18));
    try {
      const raw = school.tv_duty_schedule?.trim();
      if (!raw) {
        setDutyScheduleType('weekly');
        setDutyEntries([{ title: '', info: '' }]);
      } else {
        const o = JSON.parse(raw) as { schedule_type?: string; entries?: DutyEntry[] };
        setDutyScheduleType(o.schedule_type === 'by_date' ? 'by_date' : 'weekly');
        const arr = Array.isArray(o.entries) ? o.entries : [];
        setDutyEntries(arr.length ? arr.map((e) => ({ day_of_week: e.day_of_week, date: e.date ?? '', title: String(e.title ?? ''), info: String(e.info ?? '') })) : [{ title: '', info: '' }]);
      }
    } catch {
      setDutyScheduleType('weekly');
      setDutyEntries([{ title: '', info: '' }]);
    }
    try {
      const raw = school.tv_special_days_calendar?.trim();
      if (!raw) setSpecialDaysEntries([]);
      else {
        const o = JSON.parse(raw) as { entries?: SpecialDayEntry[] };
        const arr = Array.isArray(o.entries) ? o.entries : [];
        setSpecialDaysEntries(
          arr.filter((e) => e.date && e.title).map((e) => ({
            date: String(e.date ?? '').slice(0, 10),
            title: String(e.title ?? '').trim(),
            responsible: String(e.responsible ?? '').trim(),
            description: e.description ? String(e.description).trim() : undefined,
            image_url: e.image_url ? String(e.image_url).trim() : undefined,
          }))
        );
      }
    } catch {
      setSpecialDaysEntries([]);
    }
    setBirthdayCardTitle(school.tv_birthday_card_title ?? '');
    setBirthdayFontSize(String(school.tv_birthday_font_size ?? 24));
    try {
      const raw = school.tv_birthday_calendar?.trim();
      if (!raw) setBirthdayEntries([]);
      else {
        const o = JSON.parse(raw) as { entries?: BirthdayEntry[] };
        const arr = Array.isArray(o.entries) ? o.entries : [];
        setBirthdayEntries(
          arr
            .filter((e): e is BirthdayEntry => e && typeof e === 'object' && typeof (e as BirthdayEntry).date === 'string')
            .map((e) => ({
              date: String((e as BirthdayEntry).date ?? '').slice(0, 10),
              name: String((e as BirthdayEntry).name ?? '').trim(),
              type: ((e as BirthdayEntry).type === 'student' ? 'student' : 'teacher') as 'teacher' | 'student',
              class_section: (e as BirthdayEntry).class_section ? String((e as BirthdayEntry).class_section).trim() || undefined : undefined,
            })),
        );
      }
    } catch {
      setBirthdayEntries([]);
    }
    try {
      const raw = school.tv_timetable_schedule?.trim();
      if (!raw) {
        setTimetableLessonTimes([{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }]);
        setTimetableClassSections(['1A', '1B', '1C']);
        setTimetableEntries([]);
      } else {
        const o = JSON.parse(raw) as { lesson_times?: TimetableLessonTime[]; class_sections?: string[]; entries?: TimetableEntry[] };
        setTimetableLessonTimes(Array.isArray(o.lesson_times) && o.lesson_times.length > 0 ? o.lesson_times : [{ num: 1, start: '08:30', end: '09:10' }]);
        setTimetableClassSections(Array.isArray(o.class_sections) && o.class_sections.length > 0 ? o.class_sections : ['1A', '1B', '1C']);
        setTimetableEntries(Array.isArray(o.entries) ? o.entries : []);
      }
    } catch {
      setTimetableLessonTimes([{ num: 1, start: '08:30', end: '09:10' }]);
      setTimetableClassSections(['1A', '1B', '1C']);
      setTimetableEntries([]);
    }
    const sep = school.tv_countdown_separator;
    setCountdownSeparator(
      sep === 'pipe' || sep === 'dash' ? sep : 'bullet',
    );
    try {
      const raw = school.tv_countdown_targets?.trim();
      if (!raw) setCountdownTargets([]);
      else {
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) setCountdownTargets([]);
        else {
          setCountdownTargets(
            arr
              .filter((x): x is { label?: string; target_date?: string } => x && typeof x === 'object')
              .map((x) => {
                const raw = String(x.target_date ?? '').trim();
                const hasTime = raw.includes('T');
                return {
                  label: String(x.label ?? '').trim() || 'Hedef',
                  target_date: hasTime ? raw.slice(0, 16) : (raw.slice(0, 10) || '') + 'T09:00',
                };
              })
              .filter((x) => x.target_date),
          );
        }
      }
    } catch {
      setCountdownTargets([]);
    }
    setTimetableUseSchoolPlan(school.tv_timetable_use_school_plan !== false);
    setTimetablePreview(null);
  }, [school]);

  const HHMM_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const isValidTime = (v: string) => !v.trim() || HHMM_REGEX.test(v.trim());
  const nightValid = isValidTime(nightStart) && isValidTime(nightEnd);

  const fetchTimetablePreview = async () => {
    if (!token || !school.id) return;
    setTimetablePreviewLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('school_id', school.id);
      const res = await apiFetch<{
        empty: boolean;
        entry_count: number;
        lesson_times_count: number;
        class_sections: string[];
        sample_entries: Array<{ day: number; lesson: number; class: string; subject: string }>;
      }>(`/teacher-timetable/tv-schedule-preview?${q.toString()}`, { token });
      setTimetablePreview(res);
      if (res.empty) {
        toast.message('TV’de ders grid’i boş görünebilir — yayınlanmış plan ve ders satırları kontrol edin.');
      } else {
        toast.success(`Önizleme: ${res.entry_count} hücre, ${res.lesson_times_count} ders saati`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme alınamadı');
      setTimetablePreview(null);
    } finally {
      setTimetablePreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token || !school.id) return;
    if (!nightValid) {
      toast.error('Gece modu saatleri HH:mm formatında olmalı (örn. 22:00)');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await apiFetch<SchoolTvConfig>(`/schools/${school.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          tv_allowed_ips: allowedIps.trim() || null,
          tv_weather_city: weatherCity.trim() || null,
          tv_welcome_image_url: welcomeImageUrl.trim() || null,
          tv_default_slide_duration: slideDuration ? parseInt(slideDuration, 10) : null,
          tv_rss_url: rssUrl.trim() || null,
          tv_rss_marquee_duration: rssMarqueeDuration ? parseInt(rssMarqueeDuration, 10) : null,
          tv_rss_marquee_font_size: rssMarqueeFontSize ? parseInt(rssMarqueeFontSize, 10) : null,
          tv_gunun_sozu_rss_url: gununSozuRssUrl.trim() || null,
          tv_gunun_sozu_font_size: gununSozuFontSize ? parseInt(gununSozuFontSize, 10) : null,
          tv_gunun_sozu_marquee_duration: gununSozuMarqueeDuration ? parseInt(gununSozuMarqueeDuration, 10) : null,
          tv_gunun_sozu_text_transform: gununSozuTextTransform || null,
          tv_ticker_marquee_duration: tickerMarqueeDuration ? parseInt(tickerMarqueeDuration, 10) : null,
          tv_ticker_font_size: tickerFontSize ? parseInt(tickerFontSize, 10) : null,
          tv_ticker_text_transform: tickerTextTransform || null,
          tv_now_in_class_bar_title: nowInClassBarTitle.trim() || null,
          tv_now_in_class_bar_font_size: nowInClassBarFontSize ? parseInt(nowInClassBarFontSize, 10) : null,
          tv_now_in_class_bar_marquee_duration: nowInClassBarMarqueeDuration ? parseInt(nowInClassBarMarqueeDuration, 10) : null,
          tv_timetable_use_school_plan: timetableUseSchoolPlan,
          tv_night_mode_start: nightStart.trim() || null,
          tv_night_mode_end: nightEnd.trim() || null,
          tv_logo_url: logoUrl.trim() || null,
          tv_card_position: cardPosition,
          tv_logo_position: logoPosition,
          tv_logo_size: logoSize,
          tv_theme: theme,
          tv_primary_color: primaryColor.trim() || null,
          tv_visible_cards:
            visibleCards.size === TV_VISIBILITY_OPTIONS.length
              ? null
              : visibleCards.size === 0
                ? ''
                : Array.from(visibleCards).join(','),
          tv_countdown_card_title: countdownCardTitle.trim() || null,
          tv_countdown_font_size: countdownFontSize ? parseInt(countdownFontSize, 10) : null,
          tv_countdown_separator: countdownSeparator || null,
          tv_countdown_targets:
            countdownTargets.length > 0
              ? JSON.stringify(countdownTargets.filter((t) => t.target_date))
              : null,
          tv_meal_card_title: mealCardTitle.trim() || null,
          tv_meal_font_size: mealFontSize ? parseInt(mealFontSize, 10) : null,
          tv_meal_schedule:
            (() => {
              const valid = mealEntries.filter((e) => {
                if (mealScheduleType === 'weekly') return e.day_of_week && e.day_of_week >= 1 && e.day_of_week <= 7 && e.title.trim();
                return e.date?.trim() && e.title.trim();
              });
              return valid.length > 0
                ? JSON.stringify({
                    schedule_type: mealScheduleType,
                    entries: valid.map((e) =>
                      mealScheduleType === 'weekly'
                        ? { day_of_week: e.day_of_week, title: e.title.trim(), menu: (e.menu || '').trim() || null }
                        : { date: (e.date || '').slice(0, 10), title: e.title.trim(), menu: (e.menu || '').trim() || null },
                    ),
                  })
                : null;
            })(),
          tv_duty_card_title: dutyCardTitle.trim() || null,
          tv_duty_font_size: dutyFontSize ? parseInt(dutyFontSize, 10) : null,
          tv_duty_schedule:
            (() => {
              const valid = dutyEntries.filter((e) => {
                if (dutyScheduleType === 'weekly') return e.day_of_week && e.day_of_week >= 1 && e.day_of_week <= 7 && e.title.trim();
                return e.date?.trim() && e.title.trim();
              });
              return valid.length > 0
                ? JSON.stringify({
                    schedule_type: dutyScheduleType,
                    entries: valid.map((e) =>
                      dutyScheduleType === 'weekly'
                        ? { day_of_week: e.day_of_week, title: e.title.trim(), info: (e.info || '').trim() || null }
                        : { date: (e.date || '').slice(0, 10), title: e.title.trim(), info: (e.info || '').trim() || null },
                    ),
                  })
                : null;
            })(),
          tv_special_days_calendar:
            (() => {
              const valid = specialDaysEntries.filter((e) => e.date?.trim() && e.title?.trim());
              return valid.length > 0
                ? JSON.stringify({
                    entries: valid.map((e) => ({
                      date: (e.date || '').slice(0, 10),
                      title: e.title.trim(),
                      responsible: (e.responsible || '').trim() || null,
                      description: e.description?.trim() || null,
                      image_url: e.image_url?.trim() || null,
                    })),
                  })
                : null;
            })(),
          tv_birthday_card_title: birthdayCardTitle.trim() || null,
          tv_birthday_font_size: birthdayFontSize ? parseInt(birthdayFontSize, 10) : null,
          tv_birthday_calendar:
            (() => {
              const valid = birthdayEntries.filter((e) => e.date?.trim() && e.name?.trim());
              return valid.length > 0
                ? JSON.stringify({
                    entries: valid.map((e) => ({
                      date: (e.date || '').slice(0, 10),
                      name: e.name.trim(),
                      type: e.type,
                      class_section: e.class_section?.trim() || null,
                    })),
                  })
                : null;
            })(),
          ...(timetableUseSchoolPlan
            ? {}
            : {
                tv_timetable_schedule: (() => {
                  const validEntries = timetableEntries.filter((e) => e.day >= 1 && e.day <= 5 && e.lesson >= 1 && (e.class ?? '').trim() && (e.subject ?? '').trim());
                  const validSections = timetableClassSections.filter((s) => (s ?? '').trim());
                  const validTimes = timetableLessonTimes.filter((t) => t.num >= 1 && (t.start ?? '').trim() && (t.end ?? '').trim());
                  const derivedSections = validSections.length > 0 ? validSections : [...new Set(validEntries.map((e) => (e.class ?? '').trim()).filter(Boolean))].sort();
                  if (validEntries.length === 0) return null;
                  return JSON.stringify({
                    lesson_times: validTimes.length > 0 ? validTimes : [{ num: 1, start: '08:30', end: '09:10' }],
                    class_sections: derivedSections.length > 0 ? derivedSections : ['1A', '1B', '1C'],
                    entries: validEntries,
                  });
                })(),
              }),
        }),
      });
      onSaved(updated);
      toast.success('TV ayarları kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearSection = async (
    field: 'meal' | 'duty' | 'special_days' | 'birthday' | 'timetable' | 'countdown',
    label: string,
  ) => {
    if (!confirm(`${label} listesini tamamen silmek istediğinize emin misiniz?`)) return;
    if (!token || !school.id) return;
    setSubmitting(true);
    try {
      const payload: Record<string, null> = {};
      if (field === 'meal') payload.tv_meal_schedule = null;
      if (field === 'duty') payload.tv_duty_schedule = null;
      if (field === 'special_days') payload.tv_special_days_calendar = null;
      if (field === 'birthday') payload.tv_birthday_calendar = null;
      if (field === 'timetable') payload.tv_timetable_schedule = null;
      if (field === 'countdown') payload.tv_countdown_targets = null;
      const updated = await apiFetch<SchoolTvConfig>(`/schools/${school.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
      onSaved(updated);
      if (field === 'meal') {
        setMealEntries([{ title: '', menu: '' }]);
        setMealScheduleType('weekly');
      }
      if (field === 'duty') {
        setDutyEntries([{ title: '', info: '' }]);
        setDutyScheduleType('weekly');
      }
      if (field === 'special_days') setSpecialDaysEntries([]);
      if (field === 'birthday') setBirthdayEntries([]);
      if (field === 'timetable') {
        setTimetableLessonTimes([{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }]);
        setTimetableClassSections(['1A', '1B', '1C']);
        setTimetableEntries([]);
      }
      if (field === 'countdown') setCountdownTargets([]);
      toast.success(`${label} listesi temizlendi`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAllLists = async () => {
    if (!confirm('Tüm TV listelerini (yemek, nöbet, belirli gün, doğum günü, ders programı, sayaçlar) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    if (!token || !school.id) return;
    setSubmitting(true);
    try {
      const updated = await apiFetch<SchoolTvConfig>(`/schools/${school.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          tv_meal_schedule: null,
          tv_duty_schedule: null,
          tv_special_days_calendar: null,
          tv_birthday_calendar: null,
          tv_timetable_schedule: null,
          tv_countdown_targets: null,
        }),
      });
      onSaved(updated);
      setMealEntries([{ title: '', menu: '' }]);
      setMealScheduleType('weekly');
      setDutyEntries([{ title: '', info: '' }]);
      setDutyScheduleType('weekly');
      setSpecialDaysEntries([]);
      setBirthdayEntries([]);
      setTimetableLessonTimes([{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }]);
      setTimetableClassSections(['1A', '1B', '1C']);
      setTimetableEntries([]);
      setCountdownTargets([]);
      toast.success('Tüm TV listeleri temizlendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAnyListData =
    mealEntries.some((e) => (e.title || e.menu)?.trim()) ||
    dutyEntries.some((e) => (e.title || e.info)?.trim()) ||
    specialDaysEntries.length > 0 ||
    birthdayEntries.length > 0 ||
    (timetableEntries.length > 0 && !timetableUseSchoolPlan) ||
    countdownTargets.length > 0;

  const TV_SETTINGS_TABS = [
    { id: 'genel' as const, label: 'Genel', icon: <Settings className="size-4" />, active: 'bg-indigo-500 text-white shadow-md border-indigo-600 dark:bg-indigo-600 dark:border-indigo-500' },
    { id: 'görünüm' as const, label: 'Görünüm & Logo', icon: <Monitor className="size-4" />, active: 'bg-violet-500 text-white shadow-md border-violet-600 dark:bg-violet-600 dark:border-violet-500' },
    { id: 'alt' as const, label: 'Alt şeritler', icon: <Rss className="size-4" />, active: 'bg-rose-500 text-white shadow-md border-rose-600 dark:bg-rose-600 dark:border-rose-500' },
    { id: 'sag' as const, label: 'Sağ panel', icon: <Utensils className="size-4" />, active: 'bg-amber-500 text-white shadow-md border-amber-600 dark:bg-amber-600 dark:border-amber-500' },
    { id: 'takvim' as const, label: 'Takvim & İçerik', icon: <CalendarDays className="size-4" />, active: 'bg-teal-500 text-white shadow-md border-teal-600 dark:bg-teal-600 dark:border-teal-500' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Sekmeler */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/5 p-2">
        {TV_SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSettingsTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all',
              settingsTab === tab.id
                ? tab.active
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-muted-foreground/30',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sekme: Genel */}
      {settingsTab === 'genel' && (
        <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/25 dark:bg-indigo-950/15 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <p className="text-sm font-medium">
            TV&apos;de ne görünsün?
            <span title="Yan panel, alt şeritler ve orta alan slayt türleri. Listede hiç tik yoksa (veya kayıtta boş) hepsi açık kabul edilir; en az bir tik varsa yalnızca işaretlenenler gösterilir. Orta slayt tikleri yalnızca tik listesinde slide_ ile başlayan anahtar varsa uygulanır (eski kayıtlar: orta slaytlar hep açık)." className="ml-1.5 cursor-help inline-flex align-middle">
              <HelpCircle className="size-3.5 text-muted-foreground" />
            </span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Hiçbirini işaretlemezseniz kayıtta tümü açık kalır. Kısmi seçimde yalnızca işaretlenenler yayında olur.
        </p>

        <div className="rounded-md border border-indigo-200/60 bg-background/60 p-3 dark:border-indigo-800/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Yan panel kartları</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TV_PANEL_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleCards.has(opt.key)}
                  onChange={(e) => {
                    setVisibleCards((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(opt.key);
                      else next.delete(opt.key);
                      return next;
                    });
                  }}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-rose-200/60 bg-background/60 p-3 dark:border-rose-800/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Alt şeritler</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TV_BOTTOM_STRIP_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleCards.has(opt.key)}
                  onChange={(e) => {
                    setVisibleCards((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(opt.key);
                      else next.delete(opt.key);
                      return next;
                    });
                  }}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-teal-200/60 bg-background/60 p-3 dark:border-teal-800/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">Orta alan slaytları</p>
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
            Ders programı, doğum günü, müdür mesajı vb. döngüdeki slayt türleri. Bu grupta hiç tik yoksa (kayıtta slide_ yoksa) tüm slayt türleri eskisi gibi gösterilir.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TV_CENTER_SLIDE_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleCards.has(opt.key)}
                  onChange={(e) => {
                    setVisibleCards((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(opt.key);
                      else next.delete(opt.key);
                      return next;
                    });
                  }}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-sky-200/80 dark:border-sky-800/50 bg-sky-50/25 dark:bg-sky-950/15 p-3">
        <p className="mb-2 text-sm font-medium text-sky-800 dark:text-sky-200">Yedekleme ve yükleme</p>
        <p className="mb-3 text-xs text-muted-foreground">Tüm TV ayarlarını ve listeleri JSON olarak indirin veya daha önce indirdiğiniz yedekten yükleyin.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const exportData = {
                exportedAt: new Date().toISOString(),
                schoolId: school.id,
                schoolName: school.name,
                tv_weather_city: weatherCity.trim() || null,
                tv_welcome_image_url: welcomeImageUrl.trim() || null,
                tv_default_slide_duration: slideDuration ? parseInt(slideDuration, 10) : null,
                tv_rss_url: rssUrl.trim() || null,
                tv_gunun_sozu_rss_url: gununSozuRssUrl.trim() || null,
                tv_allowed_ips: allowedIps.trim() || null,
                tv_theme: theme,
                tv_primary_color: primaryColor.trim() || null,
                tv_meal_schedule: mealEntries.some((e) => (e.title || e.menu)?.trim())
                  ? { schedule_type: mealScheduleType, entries: mealEntries }
                  : null,
                tv_duty_schedule: dutyEntries.some((e) => (e.title || e.info)?.trim())
                  ? { schedule_type: dutyScheduleType, entries: dutyEntries }
                  : null,
                tv_special_days_calendar: specialDaysEntries.length > 0 ? { entries: specialDaysEntries } : null,
                tv_birthday_calendar: birthdayEntries.length > 0 ? { entries: birthdayEntries } : null,
                tv_timetable_use_school_plan: timetableUseSchoolPlan,
                tv_timetable_schedule_note: timetableUseSchoolPlan
                  ? 'Okul ders programından — manuel grid bu yedek dosyasında yer almaz.'
                  : null,
                tv_timetable_schedule: timetableEntries.length > 0
                  ? { lesson_times: timetableLessonTimes, class_sections: timetableClassSections, entries: timetableEntries }
                  : null,
                tv_countdown_targets: countdownTargets.length > 0 ? countdownTargets : null,
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `tv-yedek-${school.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
              toast.success('Yedek indirildi');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60"
          >
            <Download className="size-4" />
            Yedek indir
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60">
            <Upload className="size-4" />
            Yedekten yükle
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(reader.result as string) as Record<string, unknown>;
                    if (data.tv_weather_city != null) setWeatherCity(String(data.tv_weather_city));
                    if (data.tv_welcome_image_url != null) setWelcomeImageUrl(String(data.tv_welcome_image_url));
                    if (data.tv_default_slide_duration != null) setSlideDuration(String(data.tv_default_slide_duration));
                    if (data.tv_rss_url != null) setRssUrl(String(data.tv_rss_url));
                    if (data.tv_gunun_sozu_rss_url != null) setGununSozuRssUrl(String(data.tv_gunun_sozu_rss_url));
                    if (data.tv_allowed_ips != null) setAllowedIps(String(data.tv_allowed_ips));
                    if (data.tv_theme === 'light' || data.tv_theme === 'school' || data.tv_theme === 'dark') setTheme(data.tv_theme as 'dark' | 'light' | 'school');
                    if (data.tv_primary_color != null) setPrimaryColor(String(data.tv_primary_color));
                    const meal = data.tv_meal_schedule as { schedule_type?: string; entries?: MealEntry[] } | null;
                    if (meal?.entries?.length) {
                      setMealScheduleType(meal.schedule_type === 'by_date' ? 'by_date' : 'weekly');
                      setMealEntries(meal.entries.map((x: MealEntry) => ({ day_of_week: x.day_of_week, date: x.date ?? '', title: String(x.title ?? ''), menu: String(x.menu ?? '') })));
                    } else { setMealScheduleType('weekly'); setMealEntries([{ title: '', menu: '' }]); }
                    const duty = data.tv_duty_schedule as { schedule_type?: string; entries?: DutyEntry[] } | null;
                    if (duty?.entries?.length) {
                      setDutyScheduleType(duty.schedule_type === 'by_date' ? 'by_date' : 'weekly');
                      setDutyEntries(duty.entries.map((x: DutyEntry) => ({ day_of_week: x.day_of_week, date: x.date ?? '', title: String(x.title ?? ''), info: String(x.info ?? '') })));
                    } else { setDutyScheduleType('weekly'); setDutyEntries([{ title: '', info: '' }]); }
                    const sd = data.tv_special_days_calendar as { entries?: SpecialDayEntry[] } | null;
                    if (sd?.entries?.length) setSpecialDaysEntries(sd.entries.map((x: SpecialDayEntry) => ({ date: String((x.date ?? '').slice(0, 10)), title: String(x.title ?? '').trim(), responsible: String(x.responsible ?? '').trim(), description: x.description ? String(x.description).trim() : undefined, image_url: x.image_url ? String(x.image_url).trim() : undefined })));
                    else setSpecialDaysEntries([]);
                    const bd = data.tv_birthday_calendar as { entries?: BirthdayEntry[] } | null;
                    if (bd?.entries?.length) setBirthdayEntries(bd.entries.filter((e): e is BirthdayEntry => e && typeof (e as BirthdayEntry).date === 'string').map((e) => ({ date: String((e as BirthdayEntry).date ?? '').slice(0, 10), name: String((e as BirthdayEntry).name ?? '').trim(), type: ((e as BirthdayEntry).type === 'student' ? 'student' : 'teacher') as 'teacher' | 'student', class_section: (e as BirthdayEntry).class_section ? String((e as BirthdayEntry).class_section).trim() || undefined : undefined })));
                    else setBirthdayEntries([]);
                    if (typeof data.tv_timetable_use_school_plan === 'boolean') setTimetableUseSchoolPlan(data.tv_timetable_use_school_plan);
                    const tt = data.tv_timetable_schedule as { lesson_times?: TimetableLessonTime[]; class_sections?: string[]; entries?: TimetableEntry[] } | null;
                    if (tt?.entries?.length) {
                      setTimetableLessonTimes(Array.isArray(tt.lesson_times) && tt.lesson_times.length > 0 ? tt.lesson_times : [{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }]);
                      setTimetableClassSections(Array.isArray(tt.class_sections) && tt.class_sections.length > 0 ? tt.class_sections : ['1A', '1B', '1C']);
                      setTimetableEntries(tt.entries);
                    } else { setTimetableLessonTimes([{ num: 1, start: '08:30', end: '09:10' }, { num: 2, start: '09:20', end: '10:00' }]); setTimetableClassSections(['1A', '1B', '1C']); setTimetableEntries([]); }
                    const cd = data.tv_countdown_targets as Array<{ label?: string; target_date?: string }> | null;
                    if (Array.isArray(cd) && cd.length > 0) setCountdownTargets(cd.filter((x) => x && x.target_date).map((x) => ({ label: String(x.label ?? '').trim() || 'Hedef', target_date: String(x.target_date ?? '').includes('T') ? String(x.target_date).slice(0, 16) : (String(x.target_date).slice(0, 10) || '') + 'T09:00' })));
                    else setCountdownTargets([]);
                    toast.success('Yedek yüklendi. Değişiklikleri kaydetmek için formu gönderin.');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Yedek dosyası okunamadı');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      {hasAnyListData && (
        <div className="rounded-lg border border-red-200/80 dark:border-red-800/50 bg-red-50/25 dark:bg-red-950/15 p-3">
          <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">Tüm listeleri temizle</p>
          <p className="mb-2 text-xs text-red-700/90 dark:text-red-300/90">
            Yemek, nöbet, belirli gün, doğum günü, ders programı ve sayaç listelerinin hepsini siler.
          </p>
          <button
            type="button"
            onClick={handleClearAllLists}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60"
          >
            <Trash2 className="size-4" />
            Tüm listeleri temizle
          </button>
        </div>
      )}
      <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/25 dark:bg-amber-950/15 p-3">
        <label htmlFor="tv-allowed-ips" className="mb-1 flex items-center gap-1.5 text-sm font-medium">
          TV erişim kısıtlaması (sadece okul ağı)
          <span title="Kapalı devre kurulumda sadece okul IP'sinden erişimi kısıtlayabilirsiniz. Virgülle birden fazla IP/ön ek girebilirsiniz." className="cursor-help">
            <HelpCircle className="size-3.5 text-muted-foreground" />
          </span>
        </label>
        <input
          id="tv-allowed-ips"
          type="text"
          value={allowedIps}
          onChange={(e) => setAllowedIps(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Boş = tüm IP'ler. Örn: 85.123.45.67 veya 192.168.1."
        />
        <p id="tv-allowed-ips-desc" className="mt-1 text-xs text-muted-foreground">
          Sadece bu IP&apos;lerden TV sayfası açılabilsin. Virgülle ayırın. Okulun genel IP&apos;sini bulmak için okuldan whatismyip.com açın.
        </p>
      </div>
      <div>
        <label htmlFor="tv-weather-city" className="mb-1 block text-sm font-medium">
          Hava durumu şehri
        </label>
        <select
          id="tv-weather-city"
          value={weatherCity}
          onChange={(e) => setWeatherCity(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          aria-describedby="tv-weather-desc"
        >
          <option value="">Kapalı</option>
          {TV_WEATHER_CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <p id="tv-weather-desc" className="mt-1 text-xs text-muted-foreground">
          Open-Meteo ile otomatik hava durumu. Şehir seçiliyse TV ekranında gösterilir.
        </p>
      </div>
      <div>
        <label htmlFor="tv-welcome-image" className="mb-1 block text-sm font-medium">
          Hoş geldin görsel
        </label>
        <ImageUrlInput
          id="tv-welcome-image"
          value={welcomeImageUrl}
          onChange={setWelcomeImageUrl}
          token={token}
          purpose="school_welcome"
          hint="Slayt arka planı veya hoş geldin ekranında kullanılır."
        />
      </div>
      <div>
        <label htmlFor="tv-slide-duration" className="mb-1 block text-sm font-medium">
          Varsayılan slayt süresi (saniye)
        </label>
        <input
          id="tv-slide-duration"
          type="number"
          min={3}
          max={120}
          value={slideDuration}
          onChange={(e) => setSlideDuration(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Varsayılan 10 sn. Duyuru bazında farklı süre verilebilir.
        </p>
      </div>
        </div>
      )}

      {/* Sekme: Görünüm & Logo */}
      {settingsTab === 'görünüm' && (
        <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700/70 bg-slate-50/30 dark:bg-slate-900/20 p-3">
        <p className="mb-3 text-sm font-medium">Görünüm ve tema</p>
        <div className="space-y-3">
          <div>
            <label htmlFor="tv-theme" className="mb-1 block text-xs font-medium text-muted-foreground">Tema</label>
            <select id="tv-theme" value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="dark">Koyu</option>
              <option value="light">Açık</option>
              <option value="school">Okul rengi</option>
            </select>
          </div>
          {theme === 'school' && (
            <div>
              <label htmlFor="tv-primary-color" className="mb-1 block text-xs font-medium text-muted-foreground">Okul rengi (hex, örn. #0ea5e9)</label>
              <input id="tv-primary-color" type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#0ea5e9" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label htmlFor="tv-card-position" className="mb-1 block text-xs font-medium text-muted-foreground">Yan kart konumu</label>
            <select id="tv-card-position" value={cardPosition} onChange={(e) => setCardPosition(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="left">Sol</option>
              <option value="right">Sağ</option>
            </select>
          </div>
          <div>
            <label htmlFor="tv-logo-position" className="mb-1 block text-xs font-medium text-muted-foreground">Logo konumu</label>
            <select id="tv-logo-position" value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="left">Sol üst</option>
              <option value="right">Sağ üst</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="tv-logo-url" className="mb-1 block text-sm font-medium">
          Okul logosu (sol/sağ üst 3D alan)
        </label>
        <ImageUrlInput
          id="tv-logo-url"
          value={logoUrl}
          onChange={setLogoUrl}
          token={token}
          purpose="school_logo"
          hint="Uzaktan görünür olması için yeterli çözünürlükte PNG/SVG kullanın."
        />
      </div>
      <div>
        <label htmlFor="tv-logo-size" className="mb-1 block text-xs font-medium text-muted-foreground">
          Logo büyüklüğü
        </label>
        <select id="tv-logo-size" value={logoSize} onChange={(e) => setLogoSize(e.target.value as 'small' | 'medium' | 'large')} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="small">Küçük (40px)</option>
          <option value="medium">Orta (56px)</option>
          <option value="large">Büyük (72px)</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tv-night-start" className="mb-1 block text-sm font-medium">
            Gece modu başlangıç (HH:mm)
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            Ekran kapanış saati. Örn. 22:00
          </p>
          <input
            id="tv-night-start"
            type="text"
            value={nightStart}
            onChange={(e) => setNightStart(e.target.value)}
            placeholder="22:00"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${!isValidTime(nightStart) ? 'border-destructive' : 'border-input bg-background'}`}
          />
        </div>
        <div>
          <label htmlFor="tv-night-end" className="mb-1 block text-sm font-medium">
            Gece modu bitiş (HH:mm)
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            Ekran açılış saati. Örn. 07:00
          </p>
          <input
            id="tv-night-end"
            type="text"
            value={nightEnd}
            onChange={(e) => setNightEnd(e.target.value)}
            placeholder="07:00"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${!isValidTime(nightEnd) ? 'border-destructive' : 'border-input bg-background'}`}
          />
        </div>
      </div>
      {(!nightValid && (nightStart || nightEnd)) && (
        <p className="text-xs text-destructive">
          Gece modu saatleri HH:mm formatında olmalı (örn. 22:00, 07:30).
        </p>
      )}
        </div>
      )}

      {/* Sekme: Alt şeritler */}
      {settingsTab === 'alt' && (
        <div className="space-y-4">
      <div className="rounded-xl border-2 border-slate-300 bg-slate-50/50 p-5 dark:border-slate-700 dark:bg-slate-900/30">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <PlayCircle className="size-5 text-slate-600 dark:text-slate-400" />
          Alt şeritler (kayan bantlar) – ayarlar
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Alttaki bantların hangilerinin görüneceği &quot;TV&apos;de görünecek kartlar&quot; bölümünden seçilir. Burada her bandın içerik ve görünüm ayarları yapılır.
        </p>

        <div className="space-y-5">
          <div>
            <label htmlFor="tv-rss" className="mb-1 block text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Rss className="size-4 text-orange-500" />
                Kırmızı bar – RSS haber kaynağı
              </span>
            </label>
            <input
              id="tv-rss"
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="https://www.trthaber.com/egitim_articles.rss"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Eğitim haber RSS. TRT Haber, MEB vb.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="tv-rss-marquee" className="text-xs text-muted-foreground">Kayma hızı (sn):</label>
                <input
                  id="tv-rss-marquee"
                  type="number"
                  min={30}
                  max={300}
                  value={rssMarqueeDuration}
                  onChange={(e) => setRssMarqueeDuration(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="tv-rss-font" className="text-xs text-muted-foreground">Yazı boyutu (px):</label>
                <input
                  id="tv-rss-font"
                  type="number"
                  min={12}
                  max={48}
                  value={rssMarqueeFontSize}
                  onChange={(e) => setRssMarqueeFontSize(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-800 dark:bg-indigo-900/15">
            <label className="mb-1 block text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Quote className="size-4 text-indigo-600" />
                Günün Sözü bar
              </span>
            </label>
            <input
              id="tv-gunun-sozu-rss"
              type="url"
              value={gununSozuRssUrl}
              onChange={(e) => setGununSozuRssUrl(e.target.value)}
              className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="https://panel-adresiniz.com/gunun-sozu.xml"
            />
            <p className="mb-3 text-xs text-muted-foreground">
              Dahili örnek: panel kök URL + <code className="rounded bg-muted px-1">/gunun-sozu.xml</code> (içerik: <code className="rounded bg-muted px-1">src/app/gunun-sozu.xml/route.ts</code>). Harici RSS (Webnode vb.) da kullanılabilir; söz + yazar ayrıştırılır.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="tv-gunun-sozu-marquee" className="text-xs text-muted-foreground">Kayma hızı (sn):</label>
                <input
                  id="tv-gunun-sozu-marquee"
                  type="number"
                  min={20}
                  max={300}
                  value={gununSozuMarqueeDuration}
                  onChange={(e) => setGununSozuMarqueeDuration(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="tv-gunun-sozu-font" className="text-xs text-muted-foreground">Yazı boyutu (px):</label>
                <input
                  id="tv-gunun-sozu-font"
                  type="number"
                  min={14}
                  max={36}
                  value={gununSozuFontSize}
                  onChange={(e) => setGununSozuFontSize(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="tv-gunun-sozu-transform" className="text-xs text-muted-foreground">Yazı tipi:</label>
                <select
                  id="tv-gunun-sozu-transform"
                  value={gununSozuTextTransform}
                  onChange={(e) => setGununSozuTextTransform(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-1 text-sm"
                >
                  <option value="none">Normal (değişmez)</option>
                  <option value="uppercase">Büyük harf (Türkçe)</option>
                  <option value="lowercase">Küçük harf (Türkçe)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-800 dark:bg-amber-900/10">
            <label className="mb-1 block text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Megaphone className="size-4 text-amber-600" />
                Sarı bar – Okul duyuruları
              </span>
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Duyuru kategorisi &quot;Okul Duyuruları (Sarı Bar)&quot; ile eklenen duyurular.
            </p>
            <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="tv-ticker-marquee" className="text-xs text-muted-foreground">Kayma hızı (sn):</label>
            <input
              id="tv-ticker-marquee"
              type="number"
              min={20}
              max={120}
              value={tickerMarqueeDuration}
              onChange={(e) => setTickerMarqueeDuration(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="tv-ticker-font" className="text-xs text-muted-foreground">Yazı boyutu (px):</label>
            <input
              id="tv-ticker-font"
              type="number"
              min={14}
              max={36}
              value={tickerFontSize}
              onChange={(e) => setTickerFontSize(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="tv-ticker-transform" className="text-xs text-muted-foreground">Yazı tipi:</label>
            <select
              id="tv-ticker-transform"
              value={tickerTextTransform}
              onChange={(e) => setTickerTextTransform(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="none">Normal (değişmez)</option>
              <option value="uppercase">Büyük harf (Türkçe)</option>
              <option value="lowercase">Küçük harf (Türkçe)</option>
            </select>
          </div>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
            <label className="mb-1 block text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="size-4 text-emerald-600" />
                Şuan Derste (kayan bar)
              </span>
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Ders programı ve &quot;Şu An Derste&quot; kategorili duyurulardan oluşan siyah kayan bar. Başlık, yazı boyutu ve kayma süresi.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="tv-now-in-class-title" className="text-xs text-muted-foreground">Bar başlığı:</label>
                <input
                  id="tv-now-in-class-title"
                  type="text"
                  maxLength={32}
                  value={nowInClassBarTitle}
                  onChange={(e) => setNowInClassBarTitle(e.target.value)}
                  placeholder="Şuan Derste"
                  className="w-32 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="tv-now-in-class-font" className="text-xs text-muted-foreground">Yazı boyutu (px):</label>
                <input
                  id="tv-now-in-class-font"
                  type="number"
                  min={14}
                  max={48}
                  value={nowInClassBarFontSize}
                  onChange={(e) => setNowInClassBarFontSize(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="tv-now-in-class-marquee" className="text-xs text-muted-foreground">Kayma süresi (sn):</label>
                <input
                  id="tv-now-in-class-marquee"
                  type="number"
                  min={15}
                  max={180}
                  value={nowInClassBarMarqueeDuration}
                  onChange={(e) => setNowInClassBarMarqueeDuration(e.target.value)}
                  className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* Sekme: Sağ panel */}
      {settingsTab === 'sag' && (
        <div className="space-y-4">
      <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/25 dark:bg-amber-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4 text-primary" />
            Sayaç paneli (Sınav / Tatil / Karne)
          </span>
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Geri sayım hedefleri TV ekranında canlı olarak görünür. Başlık, yazı boyutu ve ayırıcı ayarları.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="tv-countdown-title" className="mb-1 block text-xs font-medium text-muted-foreground">Kart başlığı</label>
            <input
              id="tv-countdown-title"
              type="text"
              value={countdownCardTitle}
              onChange={(e) => setCountdownCardTitle(e.target.value)}
              placeholder="SAYAÇLAR (Sınav / Tatil / Karne)"
              maxLength={64}
              className="w-64 rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-countdown-font" className="mb-1 block text-xs font-medium text-muted-foreground">Yazı boyutu (px)</label>
            <input
              id="tv-countdown-font"
              type="number"
              min={14}
              max={48}
              value={countdownFontSize}
              onChange={(e) => setCountdownFontSize(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-countdown-sep" className="mb-1 block text-xs font-medium text-muted-foreground">Ayırıcı</label>
            <select
              id="tv-countdown-sep"
              value={countdownSeparator}
              onChange={(e) => setCountdownSeparator(e.target.value as 'bullet' | 'pipe' | 'dash')}
              className="rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="bullet">Bullet (•)</option>
              <option value="pipe">Pipe (|)</option>
              <option value="dash">Tire (–)</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Geri sayım hedefleri</p>
              <p className="text-[11px] text-muted-foreground">
                Her hedef için etiket, tarih ve saat girin. TV ekranında kalan süre canlı gösterilir.
              </p>
            </div>
            {countdownTargets.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearSection('countdown', 'Sayaç hedefleri')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
          <div className="space-y-2">
            {countdownTargets.map((t, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 p-2"
              >
                <input
                  type="text"
                  value={t.label}
                  onChange={(e) =>
                    setCountdownTargets((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  placeholder="Örn: Sınav, Tatil, Karne"
                  className="w-full min-w-0 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[120px]"
                />
                <input
                  type="datetime-local"
                  value={t.target_date}
                  onChange={(e) =>
                    setCountdownTargets((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, target_date: e.target.value } : x)),
                    )
                  }
                  className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setCountdownTargets((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Kaldır"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
              <button
                type="button"
                onClick={() => {
                  const n = new Date();
                  const dt = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
                  setCountdownTargets((prev) => [...prev, { label: '', target_date: dt }]);
                }}
              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-3.5" />
              Hedef ekle
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/50 bg-rose-50/25 dark:bg-rose-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Utensils className="size-4 text-primary" />
            Yemek / Kantin kartı
          </span>
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Sağ paneldeki yemek menüsü kartının başlığı ve yazı boyutu. Menü TV ekranında bugüne göre otomatik gösterilir.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="tv-meal-title" className="mb-1 block text-xs font-medium text-muted-foreground">Kart başlığı</label>
            <input
              id="tv-meal-title"
              type="text"
              value={mealCardTitle}
              onChange={(e) => setMealCardTitle(e.target.value)}
              placeholder="Yemek / Kantin Menüsü"
              maxLength={64}
              className="w-56 rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-meal-font" className="mb-1 block text-xs font-medium text-muted-foreground">Yazı boyutu (px)</label>
            <input
              id="tv-meal-font"
              type="number"
              min={14}
              max={48}
              value={mealFontSize}
              onChange={(e) => setMealFontSize(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-meal-schedule-type" className="mb-1 block text-xs font-medium text-muted-foreground">Liste türü</label>
            <select
              id="tv-meal-schedule-type"
              value={mealScheduleType}
              onChange={(e) => setMealScheduleType(e.target.value as 'weekly' | 'by_date')}
              className="rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="weekly">Haftalık (Pazartesi–Pazar tekrarlı)</option>
              <option value="by_date">Aylık (tarih bazlı, Excel ile yüklenir)</option>
            </select>
          </div>
        </div>
        <div className="mb-4 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Excel ile aylık liste yükle</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Tarih, Başlık ve Menü sütunları olan Excel dosyasını yükleyin. TV ekranında bugüne göre otomatik gösterilir.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ['Tarih', 'Başlık', 'Menü'],
                  ['2025-02-11', 'Öğle Yemeği', 'Çorba, pilav, salata'],
                  ['2025-02-12', 'Öğle Yemeği', 'Makarna, köfte'],
                  ['2025-02-13', 'Öğle Yemeği', 'Mercimek çorbası, bulgur pilavı'],
                ], { cellDates: false });
                ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 40 }];
                ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Yemek Listesi');
                XLSX.writeFile(wb, 'yemek-menusu-sablon.xlsx');
                toast.success('Şablon indirildi');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon indir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="size-4" />
              Excel yükle
              <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data = ev.target?.result;
                          if (!data || typeof data !== 'object') return;
                          const wb = XLSX.read(data, { type: 'array', cellDates: true });
                          const firstSheet = wb.Sheets[wb.SheetNames[0]];
                          const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as (string | number | Date)[][];
                          if (rows.length < 2) {
                            toast.error('Excel dosyasında en az 1 veri satırı olmalı');
                            return;
                          }
                          const headers = (rows[0] ?? []).map((h) => String(h ?? '').toLowerCase());
                          const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
                          const titleIdx = headers.findIndex((h) => h.includes('başlık') || h.includes('baslik') || h === 'title');
                          const menuIdx = headers.findIndex((h) => h.includes('menü') || h.includes('menu') || h === 'menu');
                          const toLocalDateStr = (d: Date): string =>
                            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const excelSerialToDate = (serial: number): string => {
                            if (serial < 1) return '';
                            const utc = (serial - 25569) * 86400 * 1000;
                            return toLocalDateStr(new Date(utc));
                          };
                          const getCol = (row: (string | number | Date)[], i: number) => {
                            if (i >= 0 && i < row.length) {
                              const v = row[i];
                              if (v instanceof Date) return toLocalDateStr(v);
                              if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
                              return String(v ?? '').trim();
                            }
                            return '';
                          };
                          const entries: MealEntry[] = [];
                          for (let r = 1; r < rows.length; r++) {
                            const row = rows[r] ?? [];
                            const date = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
                            const title = (titleIdx >= 0 ? getCol(row, titleIdx) : getCol(row, 1)) || 'Menü';
                            const menu = menuIdx >= 0 ? String(row[menuIdx] ?? '').trim() : String(row[2] ?? '').trim();
                            if (date && title) {
                              const dateStr = date.includes('-') && date.length >= 10 ? date.slice(0, 10) : date;
                              entries.push({ date: dateStr, title, menu });
                            }
                          }
                          if (entries.length === 0) {
                            toast.error('Geçerli satır bulunamadı. Tarih ve başlık sütunlarını kontrol edin.');
                            return;
                          }
                          setMealEntries(entries);
                          setMealScheduleType('by_date');
                          toast.success(`${entries.length} menü yüklendi`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Excel okunamadı');
                        }
                        e.target.value = '';
                      };
                      reader.readAsArrayBuffer(file);
                    }}
                  />
                </label>
            {(mealEntries.length > 1 || mealEntries.some((e) => (e.title || e.menu)?.trim())) && (
              <button
                type="button"
                onClick={() => handleClearSection('meal', 'Yemek menüsü')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Yemek menüsü – elle giriş veya düzenleme</p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {mealScheduleType === 'weekly'
              ? 'Her satır: gün (1–7), başlık, menü içeriği. 1=Pazartesi, 7=Pazar.'
              : 'Aylık liste: Excel\'den yükleyin (Tarih, Başlık, Menü sütunları). TV ekranında bugüne göre otomatik gösterilir.'}
          </p>
          <div className="space-y-2">
            {mealEntries.map((entry, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 p-2">
                {mealScheduleType === 'weekly' ? (
                  <select
                    value={entry.day_of_week ?? ''}
                    onChange={(e) =>
                      setMealEntries((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, day_of_week: e.target.value ? parseInt(e.target.value, 10) : undefined } : x,
                        ),
                      )
                    }
                    className="w-32 rounded border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">Gün seç</option>
                    {DAY_NAMES.slice(1).map((name, idx) => (
                      <option key={idx} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={entry.date ?? ''}
                    onChange={(e) => setMealEntries((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                    className="w-36 rounded border border-input bg-background px-2 py-1.5 text-sm"
                  />
                )}
                <input
                  type="text"
                  value={entry.title}
                  onChange={(e) => setMealEntries((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  placeholder="Başlık (örn. Öğle Yemeği)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[120px]"
                />
                <input
                  type="text"
                  value={entry.menu}
                  onChange={(e) => setMealEntries((prev) => prev.map((x, j) => (j === i ? { ...x, menu: e.target.value } : x)))}
                  placeholder="Menü: Çorba, pilav, salata..."
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[180px]"
                />
                <button
                  type="button"
                  onClick={() => setMealEntries((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Kaldır"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setMealEntries((prev) => [
                  ...prev,
                  mealScheduleType === 'weekly' ? { title: '', menu: '' } : (() => { const d = new Date(); return { title: '', menu: '', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }; })(),
                ])
              }
              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-3.5" />
              Satır ekle
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/50 bg-violet-50/25 dark:bg-violet-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <BellRing className="size-4 text-primary" />
            Nöbetçi Öğretmen kartı
          </span>
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Sağ paneldeki nöbetçi kartının başlığı ve yazı boyutu. Liste TV ekranında bugüne göre otomatik gösterilir.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="tv-duty-title" className="mb-1 block text-xs font-medium text-muted-foreground">Kart başlığı</label>
            <input
              id="tv-duty-title"
              type="text"
              value={dutyCardTitle}
              onChange={(e) => setDutyCardTitle(e.target.value)}
              placeholder="Nöbetçi Öğretmen"
              maxLength={64}
              className="w-56 rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-duty-font" className="mb-1 block text-xs font-medium text-muted-foreground">Yazı boyutu (px)</label>
            <input
              id="tv-duty-font"
              type="number"
              min={14}
              max={48}
              value={dutyFontSize}
              onChange={(e) => setDutyFontSize(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-duty-schedule-type" className="mb-1 block text-xs font-medium text-muted-foreground">Liste türü</label>
            <select
              id="tv-duty-schedule-type"
              value={dutyScheduleType}
              onChange={(e) => setDutyScheduleType(e.target.value as 'weekly' | 'by_date')}
              className="rounded border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="weekly">Haftalık (Pazartesi–Pazar tekrarlı)</option>
              <option value="by_date">Aylık (tarih bazlı, Excel ile yüklenir)</option>
            </select>
          </div>
        </div>
        <div className="mb-4 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Excel ile aylık liste yükle veya nöbet planından al</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Tarih, Başlık ve Bilgi sütunları olan Excel dosyasını yükleyin; veya yayınlanmış nöbet planından bu ayın listesini alın.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                try {
                  const d = new Date();
                  const y = d.getFullYear();
                  const m = d.getMonth();
                  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
                  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
                  const slots = await apiFetch<Array<{ date: string; area_name: string | null; user?: { display_name: string | null; email: string } }>>(
                    `/duty/daily-range?from=${from}&to=${to}`,
                    { token },
                  );
                  const entries: DutyEntry[] = (Array.isArray(slots) ? slots : []).map((s) => ({
                    date: s.date?.slice(0, 10) ?? '',
                    title: s.user?.display_name || s.user?.email || 'Nöbetçi',
                    info: s.area_name || '',
                  }));
                  if (entries.length === 0) {
                    toast.error('Bu ay için yayınlanmış nöbet kaydı yok. Nöbet planı oluşturup yayınlayın.');
                    return;
                  }
                  setDutyEntries(entries);
                  setDutyScheduleType('by_date');
                  toast.success(`${entries.length} nöbet kaydı nöbet planından alındı`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Nöbet planı alınamadı');
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30"
            >
              <CalendarDays className="size-4" />
              Nöbet planından al
            </button>
            <button
              type="button"
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ['Tarih', 'Başlık', 'Bilgi'],
                  ['2025-02-11', 'Ahmet Yılmaz', '1. kat koridor'],
                  ['2025-02-12', 'Ayşe Demir', 'Giriş kat'],
                  ['2025-02-13', 'Mehmet Kaya', 'Bahçe'],
                ], { cellDates: false });
                ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 24 }];
                ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Nöbet Listesi');
                XLSX.writeFile(wb, 'nobet-listesi-sablon.xlsx');
                toast.success('Şablon indirildi');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon indir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="size-4" />
              Excel yükle
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = ev.target?.result;
                      if (!data || typeof data !== 'object') return;
                      const wb = XLSX.read(data, { type: 'array', cellDates: true });
                      const firstSheet = wb.Sheets[wb.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as (string | number | Date)[][];
                      if (rows.length < 2) {
                        toast.error('Excel dosyasında en az 1 veri satırı olmalı');
                        return;
                      }
                      const headers = (rows[0] ?? []).map((h) => String(h ?? '').toLowerCase());
                      const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
                      const titleIdx = headers.findIndex((h) => h.includes('başlık') || h.includes('baslik') || h === 'title');
                      const infoIdx = headers.findIndex((h) => h.includes('bilgi') || h === 'info');
                      const toLocalDateStr = (d: Date): string =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const excelSerialToDate = (serial: number): string => {
                        if (serial < 1) return '';
                        const utc = (serial - 25569) * 86400 * 1000;
                        return toLocalDateStr(new Date(utc));
                      };
                      const getCol = (row: (string | number | Date)[], i: number) => {
                        if (i >= 0 && i < row.length) {
                          const v = row[i];
                          if (v instanceof Date) return toLocalDateStr(v);
                          if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
                          return String(v ?? '').trim();
                        }
                        return '';
                      };
                      const entries: DutyEntry[] = [];
                      for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] ?? [];
                        const date = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
                        const title = (titleIdx >= 0 ? getCol(row, titleIdx) : getCol(row, 1)) || 'Nöbetçi';
                        const info = infoIdx >= 0 ? String(row[infoIdx] ?? '').trim() : String(row[2] ?? '').trim();
                        if (date && title) {
                          const dateStr = date.includes('-') && date.length >= 10 ? date.slice(0, 10) : date;
                          entries.push({ date: dateStr, title, info });
                        }
                      }
                      if (entries.length === 0) {
                        toast.error('Geçerli satır bulunamadı. Tarih ve başlık sütunlarını kontrol edin.');
                        return;
                      }
                      setDutyEntries(entries);
                      setDutyScheduleType('by_date');
                      toast.success(`${entries.length} nöbet kaydı yüklendi`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Excel okunamadı');
                    }
                    e.target.value = '';
                  };
                  reader.readAsArrayBuffer(file);
                }}
              />
            </label>
            {(dutyEntries.length > 1 || dutyEntries.some((e) => (e.title || e.info)?.trim())) && (
              <button
                type="button"
                onClick={() => handleClearSection('duty', 'Nöbet listesi')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Nöbet listesi – elle giriş veya düzenleme</p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {dutyScheduleType === 'weekly'
              ? 'Her satır: gün (1–7), başlık (nöbetçi adı), bilgi. 1=Pazartesi, 7=Pazar.'
              : 'Aylık liste: Excel\'den yükleyin (Tarih, Başlık, Bilgi sütunları). TV ekranında bugüne göre otomatik gösterilir.'}
          </p>
          <div className="space-y-2">
            {dutyEntries.map((entry, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 p-2">
                {dutyScheduleType === 'weekly' ? (
                  <select
                    value={entry.day_of_week ?? ''}
                    onChange={(e) =>
                      setDutyEntries((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, day_of_week: e.target.value ? parseInt(e.target.value, 10) : undefined } : x,
                        ),
                      )
                    }
                    className="w-32 rounded border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">Gün seç</option>
                    {DAY_NAMES.slice(1).map((name, idx) => (
                      <option key={idx} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={entry.date ?? ''}
                    onChange={(e) => setDutyEntries((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                    className="w-36 rounded border border-input bg-background px-2 py-1.5 text-sm"
                  />
                )}
                <input
                  type="text"
                  value={entry.title}
                  onChange={(e) => setDutyEntries((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  placeholder="Başlık (örn. Ahmet Yılmaz)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[120px]"
                />
                <input
                  type="text"
                  value={entry.info}
                  onChange={(e) => setDutyEntries((prev) => prev.map((x, j) => (j === i ? { ...x, info: e.target.value } : x)))}
                  placeholder="Bilgi (örn. 1. kat koridor)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[180px]"
                />
                <button
                  type="button"
                  onClick={() => setDutyEntries((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Kaldır"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDutyEntries((prev) => [
                  ...prev,
                  dutyScheduleType === 'weekly' ? { title: '', info: '' } : (() => { const d = new Date(); return { title: '', info: '', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }; })(),
                ])
              }
              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-3.5" />
              Satır ekle
            </button>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* Sekme: Takvim & İçerik */}
      {settingsTab === 'takvim' && (
        <div className="space-y-4">
      <div className="rounded-lg border border-teal-200/80 dark:border-teal-800/50 bg-teal-50/25 dark:bg-teal-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" />
            Belirli Gün ve Haftalar takvimi
          </span>
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Tarih bazlı etkinlik takvimi. Girilen tarihe denk gelen gün otomatik yayınlanır. Görsel URL ve görevli bilgisi eklenebilir.
        </p>
        <div className="mb-4 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Excel ile toplu yükle</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Tarih, Başlık, Görevli, Açıklama ve Görsel URL sütunları olan Excel dosyasını yükleyin.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ['Tarih', 'Başlık', 'Görevli', 'Açıklama', 'Görsel URL'],
                  ['2025-02-11', 'Kütüphane Haftası', 'Ahmet Öğretmen', 'Okul kütüphanesinde etkinlikler', ''],
                  ['2025-02-14', 'Sevgililer Günü', 'Ayşe Öğretmen', 'Okul koridorlarında etkinlik', 'https://...'],
                  ['2025-04-23', 'Ulusal Egemenlik', '', '23 Nisan kutlamaları', ''],
                ], { cellDates: false });
                ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 36 }, { wch: 30 }];
                ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Belirli Gün ve Haftalar');
                XLSX.writeFile(wb, 'belirli-gun-ve-haftalar-sablon.xlsx');
                toast.success('Şablon indirildi');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon indir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="size-4" />
              Excel yükle
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = ev.target?.result;
                      if (!data || typeof data !== 'object') return;
                      const wb = XLSX.read(data, { type: 'array', cellDates: true });
                      const firstSheet = wb.Sheets[wb.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as (string | number | Date)[][];
                      if (rows.length < 2) {
                        toast.error('Excel dosyasında en az 1 veri satırı olmalı');
                        return;
                      }
                      const headers = (rows[0] ?? []).map((h) => String(h ?? '').toLowerCase());
                      const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
                      const titleIdx = headers.findIndex((h) => h.includes('başlık') || h.includes('baslik') || h === 'title');
                      const respIdx = headers.findIndex((h) => h.includes('görevli') || h.includes('gorevli'));
                      const descIdx = headers.findIndex((h) => h.includes('açıklama') || h.includes('aciklama') || h === 'description');
                      const imgIdx = headers.findIndex((h) => h.includes('görsel') || h.includes('gorsel') || h === 'image_url' || h === 'image');
                      const toLocalDateStr = (d: Date): string =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const excelSerialToDate = (serial: number): string => {
                        if (serial < 1) return '';
                        const utc = (serial - 25569) * 86400 * 1000;
                        return toLocalDateStr(new Date(utc));
                      };
                      const getCol = (row: (string | number | Date)[], i: number) => {
                        if (i >= 0 && i < row.length) {
                          const v = row[i];
                          if (v instanceof Date) return toLocalDateStr(v);
                          if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
                          return String(v ?? '').trim();
                        }
                        return '';
                      };
                      const entries: SpecialDayEntry[] = [];
                      for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] ?? [];
                        const date = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
                        const title = (titleIdx >= 0 ? getCol(row, titleIdx) : getCol(row, 1)) || '';
                        const responsible = respIdx >= 0 ? getCol(row, respIdx) : getCol(row, 2);
                        const description = descIdx >= 0 ? getCol(row, descIdx) : '';
                        const image_url = imgIdx >= 0 ? getCol(row, imgIdx) : '';
                        if (date && title) {
                          const dateStr = date.includes('-') && date.length >= 10 ? date.slice(0, 10) : date;
                          entries.push({ date: dateStr, title, responsible, description: description || undefined, image_url: image_url || undefined });
                        }
                      }
                      if (entries.length === 0) {
                        toast.error('Geçerli satır bulunamadı. Tarih ve başlık sütunlarını kontrol edin.');
                        return;
                      }
                      setSpecialDaysEntries(entries);
                      toast.success(`${entries.length} belirli gün kaydı yüklendi`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Excel okunamadı');
                    }
                    e.target.value = '';
                  };
                  reader.readAsArrayBuffer(file);
                }}
              />
            </label>
            {specialDaysEntries.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearSection('special_days', 'Belirli Gün ve Haftalar')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Elle giriş veya düzenleme</p>
          <div className="space-y-2">
            {specialDaysEntries.map((entry, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 p-2">
                <input
                  type="date"
                  value={entry.date}
                  onChange={(e) => setSpecialDaysEntries((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                  className="w-36 rounded border border-input bg-background px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={entry.title}
                  onChange={(e) => setSpecialDaysEntries((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  placeholder="Başlık (örn. Kütüphane Haftası)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[140px]"
                />
                <input
                  type="text"
                  value={entry.responsible}
                  onChange={(e) => setSpecialDaysEntries((prev) => prev.map((x, j) => (j === i ? { ...x, responsible: e.target.value } : x)))}
                  placeholder="Görevli (örn. Ahmet Öğretmen)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[140px]"
                />
                <input
                  type="text"
                  value={entry.description ?? ''}
                  onChange={(e) => setSpecialDaysEntries((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value || undefined } : x)))}
                  placeholder="Açıklama (opsiyonel)"
                  className="w-full min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[140px]"
                />
                <ImageUrlInput
                  id={`special-day-img-${i}`}
                  value={entry.image_url ?? ''}
                  onChange={(url) => setSpecialDaysEntries((prev) => prev.map((x, j) => (j === i ? { ...x, image_url: url || undefined } : x)))}
                  token={token}
                  purpose="special_day"
                  placeholder="Görsel (opsiyonel)"
                  compact
                />
                <button
                  type="button"
                  onClick={() => setSpecialDaysEntries((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Kaldır"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                setSpecialDaysEntries((prev) => [...prev, { date: dateStr, title: '', responsible: '' }]);
              }}
              className="inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-3.5" />
              Satır ekle
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/50 bg-rose-50/25 dark:bg-rose-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Cake className="size-4 text-primary" />
            Doğum günü (öğrenci / öğretmen)
          </span>
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          Tarih bazlı doğum günü takvimi. Bugüne denk gelenler TV slaytında otomatik gösterilir. Öğretmen/öğrenci ayrımı yapılabilir.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="tv-birthday-title" className="mb-1 block text-xs font-medium text-muted-foreground">Kart başlığı</label>
            <input
              id="tv-birthday-title"
              type="text"
              value={birthdayCardTitle}
              onChange={(e) => setBirthdayCardTitle(e.target.value)}
              placeholder="Bugün doğum günü olanlar"
              maxLength={64}
              className="w-56 rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tv-birthday-font" className="mb-1 block text-xs font-medium text-muted-foreground">Yazı boyutu (px)</label>
            <input
              id="tv-birthday-font"
              type="number"
              min={14}
              max={48}
              value={birthdayFontSize}
              onChange={(e) => setBirthdayFontSize(e.target.value)}
              className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="mb-4 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Excel ile toplu yükle</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Tarih, Ad, Tür (öğretmen/öğrenci) ve Sınıf (opsiyonel) sütunları olan Excel dosyasını yükleyin.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ['Tarih', 'Ad', 'Tür', 'Sınıf'],
                  ['2025-02-11', 'Ahmet Yılmaz', 'öğretmen', ''],
                  ['2025-02-12', 'Zeynep Kaya', 'öğrenci', '3A'],
                  ['2025-03-15', 'Mehmet Demir', 'öğrenci', '5B'],
                  ['2025-04-01', 'Fatma Öz', 'öğrenci', '7C'],
                ], { cellDates: false });
                ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 10 }];
                ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Doğum Günleri');
                XLSX.writeFile(wb, 'dogum-gunleri-sablon.xlsx');
                toast.success('Şablon indirildi');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon indir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="size-4" />
              Excel yükle
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = ev.target?.result;
                      if (!data || typeof data !== 'object') return;
                      const wb = XLSX.read(data, { type: 'array', cellDates: true });
                      const firstSheet = wb.Sheets[wb.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as (string | number | Date)[][];
                      if (rows.length < 2) {
                        toast.error('Excel dosyasında en az 1 veri satırı olmalı');
                        return;
                      }
                      const headers = (rows[0] ?? []).map((h) => String(h ?? '').toLowerCase());
                      const dateIdx = headers.findIndex((h) => h.includes('tarih') || h === 'date');
                      const nameIdx = headers.findIndex((h) => h === 'ad' || h.includes('isim') || h === 'name');
                      const typeIdx = headers.findIndex((h) => h === 'tür' || h.includes('tur') || h === 'type' || h.includes('tip'));
                      const classIdx = headers.findIndex((h) => h.includes('sınıf') || h.includes('sinif') || h === 'class');
                      const toLocalDateStr = (d: Date): string =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const excelSerialToDate = (serial: number): string => {
                        if (serial < 1) return '';
                        const utc = (serial - 25569) * 86400 * 1000;
                        return toLocalDateStr(new Date(utc));
                      };
                      const getCol = (row: (string | number | Date)[], i: number) => {
                        if (i >= 0 && i < row.length) {
                          const v = row[i];
                          if (v instanceof Date) return toLocalDateStr(v);
                          if (typeof v === 'number' && v > 1000 && v < 100000) return excelSerialToDate(v);
                          return String(v ?? '').trim();
                        }
                        return '';
                      };
                      const entries: BirthdayEntry[] = [];
                      for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] ?? [];
                        const date = dateIdx >= 0 ? getCol(row, dateIdx) : getCol(row, 0);
                        const name = (nameIdx >= 0 ? getCol(row, nameIdx) : getCol(row, 1)) || '';
                        const typeRaw = typeIdx >= 0 ? getCol(row, typeIdx).toLowerCase() : '';
                        const type: 'teacher' | 'student' = typeRaw.includes('öğrenci') || typeRaw === 'ogrenci' || typeRaw === 'student' ? 'student' : 'teacher';
                        const classSection = classIdx >= 0 ? getCol(row, classIdx) : '';
                        if (date && name) {
                          const dateStr = date.includes('-') && date.length >= 10 ? date.slice(0, 10) : date;
                          entries.push({ date: dateStr, name, type, class_section: classSection || undefined });
                        }
                      }
                      if (entries.length === 0) {
                        toast.error('Geçerli satır bulunamadı. Tarih ve ad sütunlarını kontrol edin.');
                        return;
                      }
                      setBirthdayEntries(entries);
                      toast.success(`${entries.length} doğum günü kaydı yüklendi`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Excel işlenemedi');
                    }
                  };
                  reader.readAsArrayBuffer(file);
                }}
              />
            </label>
            {birthdayEntries.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearSection('birthday', 'Doğum günü')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Manuel kayıtlar ({birthdayEntries.length})</p>
          {birthdayEntries.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 p-2"
            >
              <input
                type="date"
                value={entry.date}
                onChange={(e) => setBirthdayEntries((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                className="rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={entry.name}
                onChange={(e) => setBirthdayEntries((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Ad"
                className="w-full min-w-0 rounded border border-input bg-background px-2 py-1.5 text-sm sm:w-auto sm:min-w-[120px]"
              />
              <select
                value={entry.type}
                onChange={(e) => setBirthdayEntries((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as 'teacher' | 'student' } : x)))}
                className="rounded border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="teacher">Öğretmen</option>
                <option value="student">Öğrenci</option>
              </select>
              <input
                type="text"
                value={entry.class_section ?? ''}
                onChange={(e) => setBirthdayEntries((prev) => prev.map((x, j) => (j === i ? { ...x, class_section: e.target.value || undefined } : x)))}
                placeholder="Sınıf (ops.)"
                className="w-16 rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setBirthdayEntries((prev) => prev.filter((_, j) => j !== i))}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Kaldır"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              setBirthdayEntries((prev) => [...prev, { date: dateStr, name: '', type: 'student' }]);
            }}
            className="inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="size-3.5" />
            Kayıt ekle
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-blue-200/80 dark:border-blue-800/50 bg-blue-50/25 dark:bg-blue-950/15 p-4">
        <label className="mb-2 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Table2 className="size-4 text-primary" />
            Ders programı (Program slayt + Şu An Derste)
          </span>
        </label>
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3">
          <input type="checkbox" checked={timetableUseSchoolPlan} onChange={(e) => setTimetableUseSchoolPlan(e.target.checked)} className="mt-1 size-4 rounded border-input" />
          <span>
            <span className="text-sm font-medium text-foreground">Okul ders programından otomatik çek</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Yayınlanmış plan ve okul ders saatleri (Nöbet ayarları). Bu sayfadaki manuel tablo / Excel gerekmez.</span>
          </span>
        </label>
        {timetableUseSchoolPlan ? (
          <div className="space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/30 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-100">
            <p className="text-xs leading-relaxed">
              Ders hücreleri ve <strong>ders saatleri</strong> okul{' '}
              <Link href="/ders-programi" className="font-medium text-primary underline">Ders Programı</Link> yayınlanmış planı ile; saatler{' '}
              <Link href="/ders-programi/ayarlar" className="font-medium text-primary underline">Ders saatleri ve nöbet ayarları</Link> üzerinden gelir.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchTimetablePreview()}
                disabled={!token || timetablePreviewLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-600/15 disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
              >
                {timetablePreviewLoading ? 'Yükleniyor…' : 'Sunucudan önizle'}
              </button>
              <span className="text-[11px] text-muted-foreground">TV API ile aynı derleme (5 dk önbellek).</span>
            </div>
            {timetablePreview && (
              <div
                className={`rounded-md border px-2.5 py-2 text-xs ${
                  timetablePreview.empty
                    ? 'border-amber-300/80 bg-amber-50/80 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-emerald-300/50 bg-background/60 text-foreground dark:border-emerald-800'
                }`}
              >
                {timetablePreview.empty ? (
                  <p>Yayınlanmış planda ders satırı yok veya plan bulunamadı. Ders Programı’nda planı yayınlayın.</p>
                ) : (
                  <>
                    <p className="font-medium">
                      {timetablePreview.entry_count} hücre · {timetablePreview.lesson_times_count} ders saati ·{' '}
                      {timetablePreview.class_sections.length} sınıf sütunu
                    </p>
                    <ul className="mt-1.5 list-inside list-disc text-[11px] text-muted-foreground">
                      {timetablePreview.sample_entries.map((e, i) => (
                        <li key={i}>
                          {WEEKDAY_NAMES[e.day]} {e.lesson}. ders · {e.class} · {e.subject}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
        <p className="mb-3 text-xs text-muted-foreground">
          Görseldeki gibi ders programı grid ve alt bar &quot;Şu An Derste&quot; otomatik dolar. Ders saatleri ile anlık dersten hangi sınıfta ne okunduğu gösterilir. Excel ile toplu yükleme desteklenir.
        </p>
        <div className="mb-4 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Ders saatleri (Şu An Derste için gerekli)</p>
            <div className="flex flex-wrap items-center gap-2">
              {timetableLessonTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-sm">
                  <span className="text-muted-foreground">{t.num}.</span>
                  <input type="text" value={t.start} onChange={(e) => setTimetableLessonTimes((p) => p.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} placeholder="08:30" className="w-14 rounded border-0 bg-transparent px-1 py-0.5 text-xs" />
                  <span className="text-muted-foreground">–</span>
                  <input type="text" value={t.end} onChange={(e) => setTimetableLessonTimes((p) => p.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} placeholder="09:10" className="w-14 rounded border-0 bg-transparent px-1 py-0.5 text-xs" />
                </div>
              ))}
              <button type="button" onClick={() => setTimetableLessonTimes((p) => [...p, { num: p.length + 1, start: '09:00', end: '09:40' }])} className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">+ Saat</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Sınıflar (virgülle ayırın)</p>
            <input
              type="text"
              value={timetableClassSections.join(', ')}
              onChange={(e) => setTimetableClassSections(e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean))}
              placeholder="1A, 1B, 1C, 2A, 2B, 2C, 2D, 3A, 3B"
              className="w-full max-w-md rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mb-4 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Excel ile toplu yükle</p>
          <p className="mb-3 text-xs text-muted-foreground">
            İki sayfa: &quot;Ders Saatleri&quot; (Ders No, Başlangıç, Bitiş) ve &quot;Program&quot; (Gün, Ders, 1A, 1B, 1C, …). Gün: 1–5 (Pzt–Cuma), Ders: 1–n.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const timesSheet = XLSX.utils.aoa_to_sheet([
                  ['Ders No', 'Başlangıç', 'Bitiş'],
                  [1, '08:30', '09:10'],
                  [2, '09:20', '10:00'],
                  [3, '10:10', '10:50'],
                  [4, '11:00', '11:40'],
                  [5, '12:00', '12:40'],
                  [6, '13:30', '14:10'],
                  [7, '14:20', '15:00'],
                  [8, '15:10', '15:50'],
                ]);
                timesSheet['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 12 }];
                const progSheet = XLSX.utils.aoa_to_sheet([
                  ['Gün', 'Ders', '1A', '1B', '1C', '2A', '2B', '2C', '2D', '3A', '3B'],
                  [1, 1, 'TÜRKÇE', 'MATEMATİK', 'SPOR', 'H.BİLG.', 'TÜRKÇE', 'MÜZİK', 'RESİM', 'İNGİLİZCE', 'DEĞERL.'],
                  [1, 2, 'MATEMATİK', 'TÜRKÇE', 'H.BİLG.', 'SPOR', 'MÜZİK', 'TÜRKÇE', 'İNGİLİZCE', 'DEĞERL.', 'RESİM'],
                  [2, 1, 'İNGİLİZCE', 'TÜRKÇE', 'MATEMATİK', 'SPOR', 'H.BİLG.', 'TÜRKÇE', 'MÜZİK', 'RESİM', 'DEĞERL.'],
                  [2, 2, 'TÜRKÇE', 'İNGİLİZCE', 'DEĞERL.', 'MATEMATİK', 'SPOR', 'H.BİLG.', 'TÜRKÇE', 'MÜZİK', 'RESİM'],
                  [3, 1, 'MÜZİK', 'SPOR', 'TÜRKÇE', 'RESİM', 'MATEMATİK', 'İNGİLİZCE', 'H.BİLG.', 'TÜRKÇE', 'MATEMATİK'],
                ]);
                progSheet['!cols'] = [{ wch: 6 }, { wch: 6 }, ...Array(9).fill({ wch: 12 })];
                progSheet['!freeze'] = { xSplit: 2, ySplit: 1 };
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, timesSheet, 'Ders Saatleri');
                XLSX.utils.book_append_sheet(wb, progSheet, 'Program');
                XLSX.writeFile(wb, 'ders-programi-sablon.xlsx');
                toast.success('Şablon indirildi');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon indir
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="size-4" />
              Excel yükle
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = ev.target?.result;
                      if (!data || typeof data !== 'object') return;
                      const wb = XLSX.read(data, { type: 'array', cellDates: true });
                      const dayNames: Record<string, number> = { pzt: 1, pazartesi: 1, salı: 2, sali: 2, çarşamba: 3, carsamba: 3, perşembe: 4, persembe: 4, cuma: 5, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
                      const parseDay = (v: unknown): number => {
                        const s = String(v ?? '').trim().toLowerCase();
                        return dayNames[s] ?? (parseInt(s, 10) >= 1 && parseInt(s, 10) <= 5 ? parseInt(s, 10) : 0);
                      };
                      const times: TimetableLessonTime[] = [];
                      const timesSheet = wb.SheetNames.find((n) => n.toLowerCase().includes('saat') || n.toLowerCase().includes('times'));
                      if (timesSheet) {
                        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[timesSheet], { header: 1 }) as (string | number)[][];
                        const headers = (rows[0] ?? []).map((h) => String(h ?? '').toLowerCase());
                        const numIdx = headers.findIndex((h) => h.includes('ders') && h.includes('no') || h === 'no');
                        const startIdx = headers.findIndex((h) => h.includes('başlangıç') || h.includes('baslangic') || h === 'start');
                        const endIdx = headers.findIndex((h) => h.includes('bitiş') || h.includes('bitis') || h === 'end');
                        for (let r = 1; r < rows.length; r++) {
                          const row = rows[r] ?? [];
                          const num = numIdx >= 0 ? Number(row[numIdx]) || r : r;
                          const start = startIdx >= 0 ? String(row[startIdx] ?? '').trim() : '';
                          const end = endIdx >= 0 ? String(row[endIdx] ?? '').trim() : '';
                          if (num >= 1 && start && end) times.push({ num, start, end });
                        }
                      }
                      if (times.length > 0) setTimetableLessonTimes(times);
                      const progSheet = wb.SheetNames.find((n) => {
                        const l = n.toLowerCase();
                        return (l.includes('program') || l === 'program') && !l.includes('saat');
                      }) ?? wb.SheetNames.find((n) => n !== timesSheet);
                      const sheetName = progSheet ?? wb.SheetNames[0];
                      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], { header: 1 }) as (string | number)[][];
                      if (rows.length < 2) { toast.error('Program sayfasında en az 1 veri satırı olmalı'); e.target.value = ''; return; }
                      const headers = (rows[0] ?? []).map((h) => String(h ?? '').trim());
                      const dayIdx = headers.findIndex((h) => { const l = h.toLowerCase(); return l.includes('gün') || l.includes('gun') || l === 'day'; });
                      const lessonIdx = headers.findIndex((h) => { const l = h.toLowerCase(); return (l.includes('ders') && !l.includes('no')) || l === 'lesson'; });
                      const classCols: { idx: number; name: string }[] = [];
                      headers.forEach((h, idx) => {
                        if (idx !== dayIdx && idx !== lessonIdx && h && !h.toLowerCase().includes('başlangıç') && !h.toLowerCase().includes('bitiş')) classCols.push({ idx, name: h });
                      });
                      if (classCols.length > 0) setTimetableClassSections(classCols.map((c) => c.name));
                      const entries: TimetableEntry[] = [];
                      for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] ?? [];
                        const day = dayIdx >= 0 ? parseDay(row[dayIdx]) : 1;
                        const lesson = lessonIdx >= 0 ? (Number(row[lessonIdx]) || r) : r;
                        if (day < 1 || day > 5 || lesson < 1) continue;
                        for (const col of classCols.length > 0 ? classCols : [{ idx: 2, name: '1A' }]) {
                          const subject = String(row[col.idx] ?? '').trim();
                          if (subject) entries.push({ day, lesson, class: col.name, subject });
                        }
                      }
                      if (entries.length === 0) { toast.error('Geçerli program satırı bulunamadı'); e.target.value = ''; return; }
                      setTimetableUseSchoolPlan(false);
                      setTimetableEntries(entries);
                      toast.success(`${entries.length} ders programı kaydı yüklendi`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Excel okunamadı');
                    }
                    e.target.value = '';
                  };
                  reader.readAsArrayBuffer(file);
                }}
              />
            </label>
            {timetableEntries.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearSection('timetable', 'Ders programı')}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Yüklü program – görüntüle ve düzenle</p>
          {timetableEntries.length === 0 ? (
            <p className="rounded border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              Henüz kayıt yok. Excel ile yükleyin veya aşağıdan satır ekleyin.
            </p>
          ) : (
            <div className="max-h-72 overflow-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Gün</th>
                    <th className="px-2 py-2 text-left font-medium">Ders</th>
                    <th className="px-2 py-2 text-left font-medium">Sınıf</th>
                    <th className="px-2 py-2 text-left font-medium">Ders Adı</th>
                    <th className="w-10 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {timetableEntries.map((entry, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-2 py-1.5">
                            <select
                              value={entry.day}
                              onChange={(e) => setTimetableEntries((p) => p.map((x, j) => (j === idx ? { ...x, day: parseInt(e.target.value, 10) } : x)))}
                              className="w-28 rounded border border-input bg-background px-2 py-1 text-xs"
                            >
                              {WEEKDAY_NAMES.slice(1, 6).map((name, d) => (
                                <option key={d} value={d + 1}>{name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={entry.lesson}
                              onChange={(e) => setTimetableEntries((p) => p.map((x, j) => (j === idx ? { ...x, lesson: parseInt(e.target.value, 10) } : x)))}
                              className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                            >
                              {Array.from({ length: Math.max(12, timetableLessonTimes.length, ...timetableEntries.map((e) => e.lesson)) }, (_, n) => n + 1).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={entry.class}
                              onChange={(e) => setTimetableEntries((p) => p.map((x, j) => (j === idx ? { ...x, class: e.target.value } : x)))}
                              className="min-w-[70px] rounded border border-input bg-background px-2 py-1 text-xs"
                            >
                              {timetableClassSections.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                              {!timetableClassSections.includes(entry.class) && (
                                <option value={entry.class}>{entry.class}</option>
                              )}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={entry.subject}
                              onChange={(e) => setTimetableEntries((p) => p.map((x, j) => (j === idx ? { ...x, subject: e.target.value } : x)))}
                              placeholder="Ders adı"
                              className="w-full min-w-0 rounded border border-input bg-background px-2 py-1 text-xs sm:min-w-[100px]"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <button
                              type="button"
                              onClick={() => setTimetableEntries((p) => p.filter((_, j) => j !== idx))}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Kaldır"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTimetableEntries((p) => [...p, { day: 1, lesson: 1, class: timetableClassSections[0] ?? '1A', subject: '' }])}
            className="mt-2 inline-flex items-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="size-3.5" />
            Satır ekle
          </button>
        </div>
        {timetableEntries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {timetableEntries.length} kayıt. TV program slaytında grid, &quot;Şu An Derste&quot; barında anlık ders bilgisi gösterilir. Kaydet butonuna basın.
          </p>
        )}
          </>
        )}
      </div>
        </div>
      )}

      {/* Kaydet butonu – her sekmede görünür */}
      <div className="border-t border-border pt-4">
      <button
        type="button"
        onClick={handleSave}
        disabled={submitting || !nightValid}
        aria-busy={submitting}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      </div>
    </div>
  );
}
