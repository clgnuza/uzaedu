'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { BookOpen, Megaphone, Rss, Users } from 'lucide-react';

type TvAudience = 'corridor' | 'teachers' | 'classroom';

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
  youtube_url?: string | null;
  tv_slide_duration_seconds?: number | null;
  tv_wait_for_video_end?: boolean;
  creator_display_name?: string | null;
};

declare global {
  interface Window {
    YT?: { Player: new (el: string | HTMLElement, opts: { videoId: string; events?: { onStateChange?: (e: { data: number }) => void } }) => { destroy: () => void } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function getYoutubeEmbedUrl(url: string | null | undefined, noLoop?: boolean): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const watchMatch = u.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const shortMatch = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const id = watchMatch?.[1] ?? shortMatch?.[1];
  if (!id) return null;
  // noLoop: video bitimine kadar bekle – loop yok, video bitince slayt ilerler
  if (noLoop) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&enablejsapi=1`;
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0&loop=1&playlist=${id}`;
}

function TvVideoIframe({
  embedUrl,
  title,
  waitForEnd,
  onVideoEnd,
  active,
}: {
  embedUrl: string;
  title: string;
  waitForEnd: boolean;
  onVideoEnd?: () => void;
  active: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<InstanceType<NonNullable<Window['YT']>['Player']> | null>(null);
  const videoId = useMemo(() => {
    const m = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
    return m?.[1] ?? null;
  }, [embedUrl]);

  useEffect(() => {
    if (!waitForEnd || !active || !videoId || !onVideoEnd) return;
    let mounted = true;
    const initPlayer = () => {
      if (!mounted) return;
      const el = containerRef.current;
      if (!el || !window.YT?.Player) return;
      const player = new window.YT.Player(el, {
        videoId,
        playerVars: { autoplay: 1, mute: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (mounted && e.data === 0) onVideoEnd();
          },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      playerRef.current = player;
    };
    if (window.YT?.Player) {
      initPlayer();
      return () => { mounted = false; try { playerRef.current?.destroy?.(); } catch { /* ignore */ } playerRef.current = null; };
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      window.onYouTubeIframeAPIReady = undefined;
      initPlayer();
    };
    return () => { mounted = false; try { playerRef.current?.destroy?.(); } catch { /* ignore */ } playerRef.current = null; };
  }, [waitForEnd, active, videoId, onVideoEnd]);

  if (!waitForEnd || !videoId) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <div ref={containerRef} className="h-full w-full" data-video-id={videoId} />;
}

type TvResponse = {
  items: TvAnnouncement[];
  school?: {
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
    tv_birthday_card_title?: string | null;
    tv_birthday_font_size?: number | null;
    tv_birthday_calendar?: string | null;
    tv_now_in_class_bar_title?: string | null;
    tv_now_in_class_bar_font_size?: number | null;
    tv_now_in_class_bar_marquee_duration?: number | null;
  };
  urgent?: { id: string; title: string; summary: string | null; body: string | null } | null;
  /** Tahta ekranı (classroom) için sınıfa özel şu anki ders slotu */
  current_slot?: {
    lesson_num: number;
    subject: string;
    teacher_name: string;
    class_section: string | null;
  } | null;
};

/** tv_visible_cards içindeki slide_* anahtarlarına eşler (orta alan slayt filtresi). */
function tvSlideVisibilityKey(slideType: string): string {
  const m: Record<string, string> = {
    welcome: 'slide_welcome',
    special_day: 'slide_special_day',
    principal_message: 'slide_principal',
    staff: 'slide_staff',
    birthday: 'slide_birthday',
    success: 'slide_success',
    timetable: 'slide_timetable',
    news: 'slide_news',
    video: 'slide_video',
  };
  return m[slideType] ?? `slide_${slideType}`;
}

export default function TvAudienceContent() {
  const params = useParams<{ audience?: string }>();
  const searchParams = useSearchParams();
  const audience: TvAudience =
    params?.audience === 'classroom'
      ? 'classroom'
      : params?.audience === 'teachers'
        ? 'teachers'
        : 'corridor';
  const schoolId = searchParams?.get('school_id') ?? undefined;
  const deviceId = searchParams?.get('device_id') ?? undefined;
  const isKiosk = searchParams?.get('kiosk') === '1';

  const cacheKey = `tv_${audience}_${schoolId || 'all'}_${audience === 'classroom' ? deviceId || '' : ''}`;
  const [data, setData] = useState<TvResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(cacheKey);
        if (raw) setData(JSON.parse(raw) as TvResponse);
      }
    } catch { /* ignore - storage erişimi bazı bağlamlarda yasak */ }
  }, [cacheKey]);

  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    setError(null);
    setLoading(true);
    const params = new URLSearchParams();
    if (schoolId) params.set('school_id', schoolId);
    if (audience === 'classroom' && deviceId) params.set('device_id', deviceId);
    const qs = params.toString();
    const url = qs ? `/tv/announcements/${audience}?${qs}` : `/tv/announcements/${audience}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(getApiUrl(url), {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) return res.json().then((b) => { throw new Error((b as { message?: string }).message || res.statusText); });
        return res.json();
      })
      .then((res: TvResponse) => {
        setData(res);
        setOffline(false);
        setRetryCount(0);
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, JSON.stringify(res));
        } catch { /* ignore */ }
      })
      .catch((e) => {
        let cached: TvResponse | null = null;
        try {
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem(cacheKey);
            cached = raw ? (JSON.parse(raw) as TvResponse) : null;
          }
        } catch { /* ignore */ }
        if (cached) {
          setData(cached);
          setOffline(true);
          setError(null);
        } else {
          setError(
            e.name === 'AbortError'
              ? 'Backend bağlantısı zaman aşımına uğradı. Backend çalışıyor mu?'
              : (e instanceof Error ? e.message : 'Duyuru TV içeriği yüklenemedi.'),
          );
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
  }, [audience, schoolId, deviceId, cacheKey, refreshTrigger, retryCount]);

  useEffect(() => {
    if (!error || loading || retryCount >= 3) return;
    setRetrying(true);
    const id = setTimeout(() => {
      setRetryCount((c) => c + 1);
      setRetrying(false);
    }, 5000);
    return () => clearTimeout(id);
  }, [error, loading, retryCount]);

  const triggerRetry = () => setRetryCount((c) => c + 1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (schoolId) params.set('school_id', schoolId);
    if (audience === 'classroom' && deviceId) params.set('device_id', deviceId);
    const qs = params.toString();
    const url = qs ? `/tv/announcements/${audience}?${qs}` : `/tv/announcements/${audience}`;
    const interval = setInterval(() => {
      fetch(getApiUrl(url), { headers: { 'Content-Type': 'application/json' } })
        .then((r) => r.ok ? r.json() : null)
        .then((res: TvResponse | null) => {
          if (res) {
            setData(res);
            try {
              if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, JSON.stringify(res));
            } catch { /* ignore */ }
          }
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [audience, schoolId, deviceId, cacheKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setRefreshTrigger((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const [showKioskPrompt, setShowKioskPrompt] = useState(false);
  useEffect(() => {
    if (isKiosk && typeof window !== 'undefined') setShowKioskPrompt(true);
  }, [isKiosk]);
  const requestFullscreenKiosk = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    setShowKioskPrompt(false);
  };

  const [weather, setWeather] = useState<{ city: string; temp: string } | null>(null);
  const tvWeatherCity = data?.school?.tv_weather_city;
  useEffect(() => {
    if (!tvWeatherCity?.trim()) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    fetch(getApiUrl(`/tv/weather?city=${encodeURIComponent(tvWeatherCity.trim())}`))
      .then((r) => r.json())
      .then((w) => {
        if (!cancelled && w?.city && w?.temp) setWeather({ city: w.city, temp: w.temp });
      })
      .catch(() => setWeather(null));
    return () => { cancelled = true; };
  }, [tvWeatherCity]);

  const [rssItems, setRssItems] = useState<Array<{ title: string }>>([]);
  const [quoteItems, setQuoteItems] = useState<Array<{ quote: string; author?: string }>>([]);
  const tvRssUrl = data?.school?.tv_rss_url;
  const tvGununSozuRssUrl = data?.school?.tv_gunun_sozu_rss_url;
  const rssSchoolId = data?.school?.id ?? schoolId;
  useEffect(() => {
    if (!tvRssUrl?.trim() || !rssSchoolId) {
      setRssItems([]);
      return;
    }
    let cancelled = false;
    fetch(getApiUrl(`/tv/rss-feed?school_id=${encodeURIComponent(rssSchoolId)}`))
      .then((r) => r.json())
      .then((w: { items?: Array<{ title: string }> }) => {
        if (!cancelled && Array.isArray(w?.items)) setRssItems(w.items);
      })
      .catch(() => setRssItems([]));
    return () => { cancelled = true; };
  }, [tvRssUrl, rssSchoolId]);
  useEffect(() => {
    if (!tvGununSozuRssUrl?.trim() || !rssSchoolId) {
      setQuoteItems([]);
      return;
    }
    let cancelled = false;
    fetch(getApiUrl(`/tv/quote-feed?school_id=${encodeURIComponent(rssSchoolId)}`))
      .then((r) => r.json())
      .then((w: { items?: Array<{ quote: string; author?: string }> }) => {
        if (!cancelled && Array.isArray(w?.items)) setQuoteItems(w.items);
      })
      .catch(() => setQuoteItems([]));
    return () => { cancelled = true; };
  }, [tvGununSozuRssUrl, rssSchoolId]);

  /* Backend zaten show_on_tv=true olanları döndürüyor; yanıtta show_on_tv eksikse tüm items kullanılır. */
  const tvItems = useMemo(
    () => (data?.items ?? []).filter((a) => a.show_on_tv !== false),
    [data],
  );

  const filtered = useMemo(
    () =>
      tvItems.filter((a) => {
        const raw =
          (a as TvAnnouncement & { tvAudience?: string }).tv_audience ??
          (a as TvAnnouncement & { tvAudience?: string }).tvAudience;
        const target = String(raw ?? '')
          .trim()
          .toLowerCase() || 'both';
        if (target === 'all') return true;
        if (audience === 'corridor') return target === 'corridor' || target === 'both';
        if (audience === 'teachers') return target === 'teachers' || target === 'both';
        if (audience === 'classroom') return target === 'classroom' || target === 'all';
        return target === 'corridor' || target === 'both';
      }),
    [tvItems, audience],
  );

  const byCategory = useMemo(() => groupByCategory(filtered), [filtered]);

  const specialDayItems = useMemo(() => {
    const announcementSpecial = byCategory.special_day ?? [];
    const calRaw = data?.school?.tv_special_days_calendar?.trim();
    if (!calRaw) return announcementSpecial;
    try {
      const cal = JSON.parse(calRaw) as {
        entries?: Array<{ date?: string; title?: string; responsible?: string; description?: string; image_url?: string }>;
      };
      const entries = Array.isArray(cal.entries) ? cal.entries : [];
      if (entries.length === 0) return announcementSpecial;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayEntries = entries.filter((e) => (e.date ?? '').slice(0, 10) === todayStr);
      if (todayEntries.length === 0) return announcementSpecial;
      return todayEntries.map((e, i) => {
        const parts: string[] = [];
        if (e.responsible?.trim()) parts.push(`Görevli: ${e.responsible.trim()}`);
        if (e.description?.trim()) parts.push(e.description.trim());
        const body = parts.join('\n');
        const imgUrl = e.image_url?.trim();
        return {
          id: `special-cal-${i}`,
          title: e.title || 'Belirli Gün ve Hafta',
          summary: body || null,
          body: body || null,
          importance: 'normal' as const,
          category: 'special_day',
          show_on_tv: true,
          tv_slot: null,
          published_at: null,
          created_at: new Date().toISOString(),
          attachment_url: imgUrl || null,
        } as TvAnnouncement;
      });
    } catch {
      return announcementSpecial;
    }
  }, [data?.school?.tv_special_days_calendar, byCategory.special_day, now]);

  const timetableData = useMemo(() => {
    const raw = data?.school?.tv_timetable_schedule?.trim();
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as {
        lesson_times?: Array<{ num: number; start: string; end: string }>;
        lesson_times_weekend?: Array<{ num: number; start: string; end: string }>;
        class_sections?: string[];
        entries?: Array<{ day: number; lesson: number; class: string; subject: string }>;
      };
      const entries = Array.isArray(o.entries) ? o.entries : [];
      const sections = Array.isArray(o.class_sections) ? o.class_sections : [];
      const times = Array.isArray(o.lesson_times) ? o.lesson_times : [];
      const timesWeekend = Array.isArray(o.lesson_times_weekend) ? o.lesson_times_weekend : undefined;
      if (entries.length === 0) return null;
      return { entries, sections, times, timesWeekend };
    } catch {
      return null;
    }
  }, [data?.school?.tv_timetable_schedule]);

  const currentLessonNum = useMemo(() => {
    const js = now.getDay();
    const turkishDow = js === 0 ? 7 : js;
    const isWeekend = turkishDow === 6 || turkishDow === 7;
    const slotList =
      isWeekend && timetableData?.timesWeekend && timetableData.timesWeekend.length > 0
        ? timetableData.timesWeekend
        : timetableData?.times;
    if (!slotList?.length) return 0;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const parseTime = (s: string) => {
      const [h, m] = String(s).split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    for (let i = slotList.length - 1; i >= 0; i--) {
      const lt = slotList[i]!;
      const start = parseTime(lt.start);
      const end = parseTime(lt.end);
      if (nowMins >= start && nowMins <= end) return lt.num;
    }
    return 0;
  }, [timetableData?.times, timetableData?.timesWeekend, now]);

  const timetableItems = useMemo(() => {
    const announcementTimetable = byCategory.timetable ?? [];
    if (!timetableData?.entries?.length) return announcementTimetable;
    return [{ id: '_timetable-grid', title: 'Ders Programı', summary: null, body: null } as TvAnnouncement];
  }, [timetableData, byCategory.timetable]);

  const birthdayItems = useMemo(() => {
    const announcementBirthday = byCategory.birthday ?? [];
    const calRaw = data?.school?.tv_birthday_calendar?.trim();
    if (!calRaw) return announcementBirthday;
    try {
      const cal = JSON.parse(calRaw) as {
        entries?: Array<{ date?: string; name?: string; type?: string; class_section?: string }>;
      };
      const entries = Array.isArray(cal.entries) ? cal.entries : [];
      if (entries.length === 0) return announcementBirthday;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayEntries = entries.filter((e) => (e.date ?? '').slice(0, 10) === todayStr && (e.name ?? '').trim());
      if (todayEntries.length === 0) return announcementBirthday;
      return todayEntries.map((e, i) => ({
        id: `bday-cal-${i}`,
        title: (e.name ?? '').trim(),
        summary: (e.type === 'student' ? 'student' : 'teacher') as string,
        body: (e.class_section ?? '').trim() || null,
        importance: 'normal' as const,
        category: 'birthday',
        show_on_tv: true,
        tv_slot: null,
        published_at: null,
        created_at: new Date().toISOString(),
        attachment_url: null,
      })) as TvAnnouncement[];
    } catch {
      return announcementBirthday;
    }
  }, [data?.school?.tv_birthday_calendar, byCategory.birthday, now]);

  const nowInClassItems = useMemo(() => {
    /* Tahta ekranı (classroom): API'den gelen sınıfa özel current_slot kullan */
    if (audience === 'classroom' && data?.current_slot) {
      const s = data.current_slot;
      const text = s.class_section
        ? `${s.class_section}: ${s.subject} – ${s.teacher_name}`
        : `${s.subject} – ${s.teacher_name}`;
      return [
        {
          id: '_classroom-slot',
          title: '',
          summary: text,
          body: text,
        } as TvAnnouncement,
      ];
    }
    const announcementNowInClass = byCategory.now_in_class ?? [];
    /* entries.day: 1=Pzt … 7=Paz — JS getDay: 0=Paz, 1=Pzt … 6=Cmt */
    const jsDow = now.getDay();
    const turkishDow = jsDow === 0 ? 7 : jsDow;
    const timetableEntries: Array<{ id: string; summary: string; body: string; title: string }> = [];
    if (timetableData && currentLessonNum > 0) {
      const filteredEntries = timetableData.entries.filter(
        (e) => e.day === turkishDow && e.lesson === currentLessonNum,
      );
      filteredEntries.forEach((e, i) => {
        timetableEntries.push({
          id: `now-t-${i}`,
          title: '',
          summary: `${e.class}: ${e.subject}`,
          body: `${e.class}: ${e.subject}`,
        });
      });
    }
    const fromAnnouncements = announcementNowInClass.map((a) => ({
      id: a.id,
      title: a.title || '',
      summary: a.summary || a.body || a.title || '',
      body: a.body || a.summary || a.title || '',
    }));
    return [...timetableEntries, ...fromAnnouncements] as TvAnnouncement[];
  }, [audience, data?.current_slot, timetableData, currentLessonNum, now, byCategory.now_in_class]);

  const videoItems = useMemo(() => {
    return (filtered ?? []).filter((a) => (a as TvAnnouncement).youtube_url?.trim());
  }, [filtered]);

  const visibleCardsRaw = data?.school?.tv_visible_cards;
  const visibleCardsSet = useMemo((): Set<string> | null => {
    if (visibleCardsRaw == null) return null;
    const trimmed = String(visibleCardsRaw).trim();
    if (!trimmed) return null;
    return new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean));
  }, [visibleCardsRaw]);

  const isSlideTypeVisible = useCallback(
    (slideType: string) => {
      /* Hoş geldin görseli kayıtlıysa slayt her zaman dönsün (slide_welcome tikini unutan okullar). */
      if (slideType === 'welcome' && data?.school?.tv_welcome_image_url?.trim()) return true;
      if (visibleCardsSet === null) return true;
      const hasSlide = [...visibleCardsSet].some((k) => k.startsWith('slide_'));
      if (!hasSlide) return true;
      return visibleCardsSet.has(tvSlideVisibilityKey(slideType));
    },
    [visibleCardsSet, data?.school?.tv_welcome_image_url],
  );

  const isCardVisible = useCallback(
    (key: string) => (visibleCardsSet === null ? true : visibleCardsSet.has(key)),
    [visibleCardsSet],
  );

  const slides: SlideConfig[] = useMemo(() => {
    const generalNews = (byCategory.general ?? []).filter((a) => !a.youtube_url?.trim());
    const infoBankNews = (byCategory.info_bank ?? []).filter((a) => !a.youtube_url?.trim());
    const newsSlides: SlideConfig[] = [
      ...generalNews.map((item, i) => ({
        key: `news-general-${item.id}-${i}`,
        type: 'news' as const,
        items: [item],
      })),
      ...infoBankNews.map((item, i) => ({
        key: `news-infobank-${item.id}-${i}`,
        type: 'news' as const,
        items: [item],
      })),
    ];
    const all: SlideConfig[] = [
      { key: 'welcome', type: 'welcome' },
      { key: 'special_day', type: 'special_day', items: stripYoutubeForVideoOnly(specialDayItems) },
      {
        key: 'principal_message',
        type: 'principal_message',
        items: stripYoutubeForVideoOnly(byCategory.principal_message ?? []),
      },
      { key: 'staff', type: 'staff', items: stripYoutubeForVideoOnly(byCategory.staff ?? []) },
      { key: 'birthday', type: 'birthday', items: stripYoutubeForVideoOnly(birthdayItems) },
      { key: 'success', type: 'success', items: stripYoutubeForVideoOnly(byCategory.success ?? []) },
      { key: 'timetable', type: 'timetable', items: stripYoutubeForVideoOnly(timetableItems) },
      ...newsSlides,
      ...videoItems.map((item, i) => ({
        key: `video-${item.id}-${i}`,
        type: 'video' as const,
        items: [item],
      })),
    ];
    return all.filter(
      (s) =>
        isSlideTypeVisible(s.type) && (s.type === 'welcome' || (s.items && s.items.length > 0)),
    );
  }, [byCategory, specialDayItems, birthdayItems, timetableItems, videoItems, isSlideTypeVisible]);

  const [activeIndex, setActiveIndex] = useState(0);
  const slideDuration = (data?.school?.tv_default_slide_duration ?? 10) * 1000;

  const currentSlide = slides[activeIndex];
  const isVideoWaitSlide =
    currentSlide?.type === 'video' &&
    (currentSlide.items?.[0] as TvAnnouncement | undefined)?.tv_wait_for_video_end === true;

  useEffect(() => {
    if (slides.length === 0 || data?.urgent) return;
    if (isVideoWaitSlide) return; // Video bitene kadar timer yok, onVideoEnd ile ilerler
    const id = setInterval(
      () => setActiveIndex((prev) => (prev + 1) % slides.length),
      slideDuration,
    );
    return () => clearInterval(id);
  }, [slides.length, slideDuration, data?.urgent, isVideoWaitSlide]);

  const slidesLengthRef = useRef(slides.length);
  slidesLengthRef.current = slides.length;
  const advanceToNextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slidesLengthRef.current);
  }, []);

  const mealItems = useMemo(() => {
    const scheduleRaw = data?.school?.tv_meal_schedule?.trim();
    const announcementMeals = byCategory.meal ?? [];
    if (!scheduleRaw) return announcementMeals;
    try {
      const schedule = JSON.parse(scheduleRaw) as {
        schedule_type?: string;
        entries?: Array<{ day_of_week?: number; date?: string; title: string; menu?: string }>;
      };
      const entries = Array.isArray(schedule.entries) ? schedule.entries : [];
      if (entries.length === 0) return announcementMeals;
      const today = now;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const turkishDow = today.getDay() === 0 ? 7 : today.getDay();
      const filtered =
        schedule.schedule_type === 'by_date'
          ? entries.filter((e) => (e.date ?? '').slice(0, 10) === todayStr)
          : entries.filter((e) => e.day_of_week === turkishDow);
      if (filtered.length === 0) return announcementMeals;
      return filtered.map((e, i) => ({
        id: `meal-schedule-${i}`,
        title: e.title || 'Menü',
        summary: e.menu || null,
        body: e.menu || null,
        importance: 'normal',
        category: 'meal',
        show_on_tv: true,
        tv_slot: null,
        published_at: null,
        created_at: new Date().toISOString(),
        attachment_url: null,
      })) as TvAnnouncement[];
    } catch {
      return announcementMeals;
    }
  }, [data?.school?.tv_meal_schedule, byCategory.meal, now]);

  const dutyItems = useMemo(() => {
    const scheduleRaw = data?.school?.tv_duty_schedule?.trim();
    const announcementDuties = byCategory.duty ?? [];
    if (!scheduleRaw) return announcementDuties;
    try {
      const schedule = JSON.parse(scheduleRaw) as {
        schedule_type?: string;
        entries?: Array<{ day_of_week?: number; date?: string; title: string; info?: string }>;
      };
      const entries = Array.isArray(schedule.entries) ? schedule.entries : [];
      if (entries.length === 0) return announcementDuties;
      const today = now;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const turkishDow = today.getDay() === 0 ? 7 : today.getDay();
      const filtered =
        schedule.schedule_type === 'by_date'
          ? entries.filter((e) => (e.date ?? '').slice(0, 10) === todayStr)
          : entries.filter((e) => e.day_of_week === turkishDow);
      if (filtered.length === 0) return announcementDuties;
      return filtered.map((e, i) => ({
        id: `duty-schedule-${i}`,
        title: e.title || 'Nöbetçi',
        summary: e.info || null,
        body: e.info || null,
        importance: 'normal',
        category: 'duty',
        show_on_tv: true,
        tv_slot: null,
        published_at: null,
        created_at: new Date().toISOString(),
        attachment_url: null,
      })) as TvAnnouncement[];
    } catch {
      return announcementDuties;
    }
  }, [data?.school?.tv_duty_schedule, byCategory.duty, now]);

  const countdownTargetsParsed = useMemo(() => {
    try {
      const raw = data?.school?.tv_countdown_targets?.trim();
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x): x is { label?: string; target_date?: string } => x && typeof x === 'object')
        .map((x) => {
          const raw = String(x.target_date ?? '').trim();
          const hasTime = raw.includes('T');
          const target_date = hasTime ? raw.slice(0, 16) : raw.slice(0, 10) + 'T00:00';
          return { label: String(x.label ?? '').trim() || 'Hedef', target_date };
        })
        .filter((x) => x.target_date);
    } catch {
      return [];
    }
  }, [data?.school?.tv_countdown_targets]);

  /** Sarı bar: ticker + Genel + Bilgi Bankası — erken return'lerden önce (hook sırası) */
  const tickerItems = useMemo(() => {
    const buckets = ['ticker', 'general', 'info_bank'] as const;
    const seen = new Set<string>();
    const out: TvAnnouncement[] = [];
    for (const cat of buckets) {
      for (const a of byCategory[cat] ?? []) {
        if (seen.has(a.id)) continue;
        seen.add(a.id);
        out.push(a);
      }
    }
    return out;
  }, [byCategory]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner label="Duyuru TV yükleniyor…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-8 py-6">
          <p className="text-xl font-semibold text-red-300">Yükleme hatası</p>
          <p className="mt-2 max-w-lg text-center text-base text-slate-300">{error}</p>
          {retrying && (
            <p className="mt-4 text-center text-sm text-amber-300">Bağlantı yeniden deneniyor… ({retryCount + 1}/3)</p>
          )}
          {!retrying && retryCount < 3 && (
            <button
              type="button"
              onClick={triggerRetry}
              className="mt-4 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/30"
            >
              Şimdi dene
            </button>
          )}
        </div>
      </div>
    );
  }

  const tarihKisa = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const gunAdi = now.toLocaleDateString('tr-TR', { weekday: 'long' });
  const saat = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const countdownSep = (() => {
    const s = data?.school?.tv_countdown_separator ?? 'bullet';
    if (s === 'pipe') return '  |  ';
    if (s === 'dash') return '  –  ';
    return '  •  ';
  })();
  const countdownItems = byCategory.countdown ?? [];

  const countdownText =
    countdownItems.length > 0
      ? countdownItems
          .map((c) => {
            const val = c.summary || c.body || '';
            const label = (c.title || '').trim();
            return label && val ? `${label}: ${val}` : val || label;
          })
          .filter(Boolean)
          .join(countdownSep) || 'Güncel sayaç bilgisi yok'
      : 'Güncel sayaç bilgisi yok';

  const gununSozuItems =
    (byCategory.gunun_sozu && byCategory.gunun_sozu.length
      ? byCategory.gunun_sozu
      : (byCategory.general ?? []).filter((i) =>
          (i.title || '').toLowerCase().includes('günün sözü'),
        )) ?? [];
  const schoolName = data?.school?.name ?? 'Okul';
  const logoUrl = data?.school?.tv_logo_url ?? undefined;
  const cardPosition = data?.school?.tv_card_position === 'left' ? 'left' : 'right';
  const logoPosition = data?.school?.tv_logo_position === 'right' ? 'right' : 'left';
  const logoSize = data?.school?.tv_logo_size === 'small' ? 'small' : data?.school?.tv_logo_size === 'large' ? 'large' : 'medium';
  const theme = data?.school?.tv_theme ?? 'dark';
  const primaryColor = data?.school?.tv_primary_color ?? undefined;

  if (data?.urgent) {
    return (
      <div className="tv-main tv-urgent-card flex-1 w-full">
        {offline && (
          <div className="absolute right-4 top-4 z-[10] rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-black shadow-lg">
            Çevrimdışı – önbellekten
          </div>
        )}
        <div className="tv-urgent-inner text-center">
          <div className="tv-urgent-badge">
            <svg className="size-[1.1em] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            Acil Duyuru
          </div>
          <h1 className="tv-urgent-title">{data.urgent.title}</h1>
          {(data.urgent.summary || data.urgent.body) && (
            <p className="tv-urgent-body mx-auto">
              {data.urgent.summary || data.urgent.body}
            </p>
          )}
        </div>
      </div>
    );
  }

  const themeClass = theme === 'light' ? 'tv-theme-light' : theme === 'school' ? 'tv-theme-school' : 'tv-theme-dark';
  const rootStyle = primaryColor ? { '--tv-accent': primaryColor, '--tv-primary': primaryColor } as React.CSSProperties : undefined;

  return (
    <div
      className={`tv-main relative flex w-full flex-1 flex-col ${themeClass}`}
      data-theme={theme}
      data-card-position={cardPosition}
      data-logo-position={logoPosition}
      style={rootStyle}
    >
        {showKioskPrompt && (
          <button
            type="button"
            onClick={requestFullscreenKiosk}
            className="absolute inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/60 text-white transition-opacity hover:bg-black/70"
            aria-label="Tam ekrana geçmek için dokunun"
          >
            <span className="rounded-xl bg-white/20 px-8 py-4 text-xl font-medium backdrop-blur-sm">
              Tam ekrana geçmek için dokunun
            </span>
          </button>
        )}
        {/* Ana alan + Sidebar – overflow sadece main'de, sidebar tam görünsün */}
        <div className="flex min-h-0 min-w-0 flex-1">
          {cardPosition === 'left' && (
            <SidePanel
              cardPosition={cardPosition}
              data={data}
              weather={weather}
              byCategory={byCategory}
              schoolName={schoolName}
              dutyItems={dutyItems}
              mealItems={mealItems}
              gununSozuItems={gununSozuItems}
              countdownText={countdownText}
              countdownTargets={countdownTargetsParsed}
              countdownCardTitle={data?.school?.tv_countdown_card_title ?? 'SAYAÇLAR (Sınav / Tatil / Karne)'}
              countdownFontSize={data?.school?.tv_countdown_font_size ?? 24}
              countdownNow={now}
              mealCardTitle={data?.school?.tv_meal_card_title ?? 'Yemek / Kantin Menüsü'}
              mealFontSize={data?.school?.tv_meal_font_size ?? 18}
              dutyCardTitle={data?.school?.tv_duty_card_title ?? 'Nöbetçi Öğretmen'}
              dutyFontSize={data?.school?.tv_duty_font_size ?? 18}
              isCardVisible={isCardVisible}
              tarihKisa={tarihKisa}
              gunAdi={gunAdi}
              saat={saat}
            />
          )}
          {/* Ana slider – modern grid layout, içerik odaklı */}
          <div className="tv-slide-zone relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--tv-bg-dark)]">
            {/* Logo badge – köşede */}
            <div
              className={`absolute top-3 z-20 flex items-center gap-2 ${logoPosition === 'right' ? 'right-3' : 'left-3'}`}
            >
              {logoUrl ? (
                <div
                  className={`flex items-center justify-center overflow-hidden ${
                    logoSize === 'small' ? 'h-10 w-10 md:h-11 md:w-11' : logoSize === 'large' ? 'h-14 w-14 md:h-[72px] md:w-[72px]' : 'h-12 w-12 md:h-14 md:w-14'
                  }`}
                >
                  <img src={logoUrl} alt="" className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]" />
                </div>
              ) : (
                <div
                  className={`flex items-center justify-center rounded-xl bg-[var(--tv-accent)] text-white shadow-lg md:rounded-2xl ${
                    logoSize === 'small' ? 'h-10 w-10 md:h-11 md:w-11' : logoSize === 'large' ? 'h-14 w-14 md:h-[72px] md:w-[72px]' : 'h-12 w-12 md:h-14 md:w-14'
                  }`}
                >
                  <svg className="size-6 md:size-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z"/>
                  </svg>
                </div>
              )}
            </div>
            {offline && (
              <div className={`absolute top-3 z-20 ${logoPosition === 'right' ? 'left-3' : 'right-3'}`}>
                <span className="rounded-lg bg-amber-500/90 px-2 py-1 text-xs font-medium text-black">Çevrimdışı</span>
              </div>
            )}
            {/* Slayt içerik alanı – flex-1, progress üstüne binmez */}
            <div className="relative min-h-0 flex-1">
              {slides.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-[var(--tv-accent)]/20 text-4xl md:size-24 md:text-5xl">
                    📺
                  </div>
                  <p className="text-center text-xl font-semibold text-[var(--tv-text)] md:text-3xl">
                    Duyuru TV için henüz içerik girilmemiş
                  </p>
                  <p className="max-w-md text-center text-base text-[var(--tv-text-muted)]">
                    Admin panelinden duyuru ekleyerek bu ekranda yayınlamaya başlayabilirsiniz.
                  </p>
                </div>
              ) : (
                <>
                  {slides.map((slide, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <SlideView
                      key={slide.key + index}
                      slide={slide}
                      active={index === activeIndex}
                      onVideoEnd={index === activeIndex && isVideoWaitSlide ? advanceToNextSlide : undefined}
                      schoolName={schoolName}
                      welcomeImageUrl={data?.school?.tv_welcome_image_url ?? undefined}
                      timetableData={timetableData}
                      currentLessonNum={currentLessonNum}
                      currentDay={now.getDay()}
                      birthdayCardTitle={data?.school?.tv_birthday_card_title ?? undefined}
                      birthdayFontSize={data?.school?.tv_birthday_font_size ?? undefined}
                    />
                  ))}
                </>
              )}
            </div>
            {/* Gösterge + ilerleme – layout içinde, içeriği kesmez */}
            {slides.length > 0 && (
              <div className="tv-slide-footer shrink-0 border-t border-[var(--tv-border)]/50 bg-[var(--tv-bg-dark)]/95 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex shrink-0 gap-2">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`h-2 rounded-full transition-all duration-300 ${
                          i === activeIndex ? 'w-6 bg-[var(--tv-accent)]' : 'w-2 bg-white/25 hover:bg-white/40'
                        }`}
                        aria-label={`Slayt ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-[var(--tv-accent)] tv-slide-progress" key={activeIndex} />
                  </div>
                  <span
                    className="shrink-0 tabular-nums text-xs font-semibold tracking-wide text-white/75"
                    aria-live="polite"
                  >
                    {activeIndex + 1} / {slides.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {cardPosition === 'right' && (
            <SidePanel
              cardPosition={cardPosition}
              data={data}
              weather={weather}
              byCategory={byCategory}
              schoolName={schoolName}
              dutyItems={dutyItems}
              mealItems={mealItems}
              gununSozuItems={gununSozuItems}
              countdownText={countdownText}
              countdownTargets={countdownTargetsParsed}
              countdownCardTitle={data?.school?.tv_countdown_card_title ?? 'SAYAÇLAR (Sınav / Tatil / Karne)'}
              countdownFontSize={data?.school?.tv_countdown_font_size ?? 24}
              countdownNow={now}
              mealCardTitle={data?.school?.tv_meal_card_title ?? 'Yemek / Kantin Menüsü'}
              mealFontSize={data?.school?.tv_meal_font_size ?? 18}
              dutyCardTitle={data?.school?.tv_duty_card_title ?? 'Nöbetçi Öğretmen'}
              dutyFontSize={data?.school?.tv_duty_font_size ?? 18}
              isCardVisible={isCardVisible}
              tarihKisa={tarihKisa}
              gunAdi={gunAdi}
              saat={saat}
            />
          )}
        </div>

        {/* Alt şeritler */}
        <div className="mt-2 flex shrink-0 flex-col gap-0">
          {isCardVisible('now_in_class_bar') && (
          <div className="tv-now-in-class-bar flex min-h-[52px] items-center gap-4 bg-black/98 px-5 py-3.5">
            <div className="tv-now-in-class-label flex shrink-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--tv-red)]/20">
                <BookOpen className="size-4 text-[var(--tv-red)]" strokeWidth={2.5} aria-hidden />
              </div>
              <span className="text-base font-bold uppercase tracking-wide text-[var(--tv-red)]">
                {data?.school?.tv_now_in_class_bar_title?.trim() || 'Şuan Derste'}
              </span>
            </div>
            <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
            <div className="min-w-0 flex-1 overflow-hidden py-0.5">
              <div
                className="tv-marquee tv-now-in-class-marquee inline-flex shrink-0 items-center gap-0 whitespace-nowrap text-white/95"
                style={{
                  animation: `tv-marquee ${data?.school?.tv_now_in_class_bar_marquee_duration ?? 30}s linear infinite`,
                  WebkitAnimation: `tv-marquee ${data?.school?.tv_now_in_class_bar_marquee_duration ?? 30}s linear infinite`,
                  fontSize: `${data?.school?.tv_now_in_class_bar_font_size ?? 18}px`,
                  fontFamily: "'Segoe UI', 'Helvetica Neue', system-ui, sans-serif",
                  lineHeight: 1.6,
                }}
              >
                {(() => {
                  const parts = (nowInClassItems.length ? nowInClassItems : [])
                    .map((i) => i.summary || i.body || i.title)
                    .filter(Boolean);
                  const text = parts.length ? parts.join('   •   ') : 'Ders bilgisi yok';
                  return (
                    <>
                      <span className="inline-flex shrink-0 items-center gap-0 whitespace-nowrap" style={{ minWidth: '100vw' }}>{text}</span>
                      <span className="inline-flex shrink-0 items-center gap-0 whitespace-nowrap" style={{ minWidth: '100vw' }} aria-hidden>{text}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          )}
          {isCardVisible('ticker') && (
          <div className="tv-ticker-bar flex min-h-[52px] items-center gap-4 border-b-2 border-black/20 bg-[var(--tv-yellow)] px-5 py-3 shadow-inner">
            <div className="tv-ticker-label flex shrink-0 items-center gap-1.5">
              <Megaphone className="size-4 shrink-0 text-black/80" strokeWidth={2} aria-hidden />
              <span className="text-base font-bold uppercase tracking-wide text-black/95">
                Okul Duyuruları
              </span>
            </div>
            {countdownText && countdownText !== 'Güncel sayaç bilgisi yok' ? (
              <p className="shrink-0 text-base font-bold text-black">
                3. DERSİN BİTMESİNE <span className="font-extrabold text-[var(--tv-red)]">{countdownText}</span>
              </p>
            ) : null}
            <div className="min-w-0 flex-1 overflow-hidden">
              <div
                className="tv-marquee tv-ticker-marquee font-semibold text-black"
                lang="tr"
                style={{
                  animation: `tv-marquee ${data?.school?.tv_ticker_marquee_duration ?? 45}s linear infinite`,
                  WebkitAnimation: `tv-marquee ${data?.school?.tv_ticker_marquee_duration ?? 45}s linear infinite`,
                  fontSize: `${data?.school?.tv_ticker_font_size ?? 18}px`,
                  fontFamily: "'Segoe UI', 'Helvetica Neue', system-ui, sans-serif",
                  letterSpacing: '0.02em',
                  lineHeight: 1.5,
                }}
              >
                {(() => {
                  const transform = data?.school?.tv_ticker_text_transform ?? 'none';
                  const applyTransform = (s: string) => {
                    if (transform === 'uppercase') return s.toLocaleUpperCase('tr-TR');
                    if (transform === 'lowercase') return s.toLocaleLowerCase('tr-TR');
                    return s;
                  };
                  const seenIds = new Set<string>();
                  const source = tickerItems.filter((i) => {
                    if (seenIds.has(i.id)) return false;
                    seenIds.add(i.id);
                    return true;
                  });
                  const parts = source.map((i) => {
                    const title = (i.title || '').trim();
                    const rawContent = (i.summary || i.body || '').trim().replace(/\s+/g, ' ');
                    return applyTransform(rawContent ? `${title}: ${rawContent}` : title);
                  }).filter(Boolean);
                  const emptyText = applyTransform('Okul duyurusu eklenmemiş.');
                  const tickerChunks = parts.length
                    ? parts.map((text, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5">
                          <Megaphone className="tv-ticker-icon size-[0.9em] shrink-0 text-[var(--tv-red)]" strokeWidth={2.5} aria-hidden />
                          <span>{text}</span>
                        </span>
                      ))
                    : [<span key="empty" className="text-black/70">{emptyText}</span>];
                  const separator = <span className="mx-2 shrink-0 text-black/60" aria-hidden>•</span>;
                  const blockContent = tickerChunks.reduce<ReactNode[]>((acc, el, i) => (i > 0 ? [...acc, separator, el] : [...acc, el]), []);
                  return (
                    <>
                      <span className="inline-flex shrink-0 items-center gap-0 whitespace-nowrap" style={{ minWidth: '100vw' }}>
                        {blockContent}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-0 whitespace-nowrap" style={{ minWidth: '100vw' }} aria-hidden>
                        {blockContent}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          )}

          {isCardVisible('rss') && rssItems.length > 0 && (
            <div className="flex min-h-[48px] items-center gap-4 border-t-2 border-red-900/50 bg-[var(--tv-red)] px-4 py-3">
              <div className="flex shrink-0 items-center justify-center rounded bg-white/15 p-1.5" aria-hidden>
                <Rss className="size-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="tv-marquee font-medium text-white/95"
                  style={{
                    animation: `tv-marquee ${data?.school?.tv_rss_marquee_duration ?? 90}s linear infinite`,
                    WebkitAnimation: `tv-marquee ${data?.school?.tv_rss_marquee_duration ?? 90}s linear infinite`,
                    fontSize: `${data?.school?.tv_rss_marquee_font_size ?? 18}px`,
                  }}
                >
                  <span>EĞİTİM DUYURULARI · {rssItems.map((i) => (i.title || '').toLocaleUpperCase('tr-TR')).join('     ·     ')}</span>
                  <span className="ml-8">EĞİTİM DUYURULARI · {rssItems.map((i) => (i.title || '').toLocaleUpperCase('tr-TR')).join('     ·     ')}</span>
                </div>
              </div>
            </div>
          )}
          {isCardVisible('gunun_sozu_bar') && quoteItems.length > 0 && (
            <div className="tv-quote-bar flex min-h-[64px] items-center gap-4 border-t border-indigo-500/30 bg-gradient-to-r from-indigo-950/95 via-slate-900/98 to-indigo-950/95 px-6 py-4 shadow-inner">
              <div className="flex shrink-0 items-center justify-center rounded-lg bg-indigo-500/25 p-2" aria-hidden>
                <svg className="size-8 text-indigo-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 17h3l2-4V7H5v4h3l-2 4zm8 0h3l2-4V7h-6v4h3l-2 4z"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="tv-marquee tv-quote-marquee font-serif italic text-indigo-100"
                  style={{
                    animation: `tv-marquee ${data?.school?.tv_gunun_sozu_marquee_duration ?? 90}s linear infinite`,
                    WebkitAnimation: `tv-marquee ${data?.school?.tv_gunun_sozu_marquee_duration ?? 90}s linear infinite`,
                    fontSize: `${data?.school?.tv_gunun_sozu_font_size ?? 20}px`,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {(() => {
                    const transform = data?.school?.tv_gunun_sozu_text_transform ?? 'none';
                    const applyTransform = (s: string) => {
                      if (transform === 'uppercase') return s.toLocaleUpperCase('tr-TR');
                      if (transform === 'lowercase') return s.toLocaleLowerCase('tr-TR');
                      return s;
                    };
                    const raw = quoteItems
                      .map((q) => (q.author ? `"${q.quote}" — ${q.author}` : `"${q.quote}"`))
                      .join('     ⋯     ');
                    const text = applyTransform(raw);
                    return (
                      <>
                        <span>{text}</span>
                        <span className="ml-8" aria-hidden>{text}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

function TvWeatherCard({ temp, city }: { temp?: string; city?: string }) {
  const t = temp ?? '—';
  const c = city ?? '—';
  const num = parseInt(t.replace(/\D/g, ''), 10);
  const isCold = !Number.isNaN(num) && num < 10;
  const isHot = !Number.isNaN(num) && num >= 28;

  return (
    <div className="min-h-0 min-w-0 shrink-0 overflow-hidden rounded-lg bg-[var(--tv-bg)]/60">
      <div className="tv-panel-banner tv-panel-banner--red">Hava Durumu</div>
      <div className="flex flex-nowrap items-center justify-between gap-4 px-4 py-5">
        <span className="shrink-0 text-4xl">{isCold ? '❄️' : isHot ? '☀️' : '⛅'}</span>
        <span className="shrink-0 text-2xl font-bold tabular-nums text-[var(--tv-text)] md:text-3xl">
          {t.includes('°') || t === '—' ? t : `${t}°`}
        </span>
        <span className="min-w-0 shrink truncate text-lg font-semibold text-[var(--tv-text-muted)]">{c}</span>
      </div>
    </div>
  );
}

type CountdownTarget = { label: string; target_date: string };

function getRemaining(targetDateStr: string, now: Date): { d: number; h: number; m: number; s: number } | null {
  const str = targetDateStr.trim();
  if (!str) return null;
  let target: Date;
  if (str.includes('T')) {
    target = new Date(str);
    if (Number.isNaN(target.getTime())) return null;
  } else {
    const [y, mo, day] = str.split('-').map(Number);
    if (!y || !mo || !day) return null;
    target = new Date(y, mo - 1, day, 0, 0, 0, 0);
  }
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor((diff / 1000) % 60);
  const m = Math.floor((diff / 60_000) % 60);
  const h = Math.floor((diff / 3_600_000) % 24);
  const d = Math.floor(diff / 86_400_000);
  return { d, h, m, s };
}

function CountdownCard({
  title,
  targets,
  now,
  fontSize,
}: {
  title: string;
  targets: CountdownTarget[];
  now: Date;
  fontSize: number;
}) {
  const [idx, setIdx] = useState(0);
  const target = targets[idx % targets.length] ?? targets[0];
  const remaining = target ? getRemaining(target.target_date, now) : null;

  useEffect(() => {
    if (targets.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % targets.length), 8000);
    return () => clearInterval(id);
  }, [targets.length]);

  const pad = (n: number) => String(n).padStart(2, '0');

  const bannerTitle = target?.label ? target.label.toLocaleUpperCase('tr-TR') : (title || 'SAYAÇ');

  return (
    <div className="min-h-0 min-w-0 shrink-0 overflow-hidden rounded-xl bg-white/5">
      <div className="tv-panel-banner tv-panel-banner--yellow">{bannerTitle}</div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        {target && remaining ? (
          <div className="space-y-3">
            {remaining.d === 0 && remaining.h === 0 && remaining.m === 0 && remaining.s === 0 ? (
              <p className="text-center font-bold text-[var(--tv-accent)]" style={{ fontSize: `${Math.max(16, fontSize - 4)}px` }}>
                Bugün!
              </p>
            ) : (
              <div className="flex justify-center gap-1.5">
                {[
                  { v: remaining.d, l: 'gün' },
                  { v: remaining.h, l: 'saat' },
                  { v: remaining.m, l: 'dakika' },
                  { v: remaining.s, l: 'saniye' },
                ].map(({ v, l }) => (
                  <div
                    key={l}
                    className="flex flex-col items-center rounded-lg bg-[var(--tv-bg-dark)]/80 px-2 py-2 shadow-inner"
                    style={{ minWidth: 44 }}
                  >
                    <span
                      className="font-extrabold tabular-nums text-[var(--tv-accent)]"
                      style={{ fontSize: `${Math.max(14, fontSize - 6)}px`, lineHeight: 1.1 }}
                    >
                      {pad(v)}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--tv-text-muted)]">
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-[var(--tv-text-muted)]">
            Hedef tarihi girilmedi
          </div>
        )}
      </div>
    </div>
  );
}

function SidePanel({
  cardPosition,
  data,
  weather,
  byCategory,
  schoolName,
  dutyItems,
  mealItems,
  dutyCardTitle,
  dutyFontSize,
  gununSozuItems,
  countdownText,
  countdownTargets,
  countdownCardTitle,
  countdownFontSize,
  countdownNow,
  mealCardTitle,
  mealFontSize,
  isCardVisible,
  tarihKisa,
  gunAdi,
  saat,
}: {
  cardPosition: 'left' | 'right';
  data: TvResponse | null;
  weather: { city: string; temp: string } | null;
  byCategory: Record<string, TvAnnouncement[]>;
  schoolName: string;
  dutyItems: TvAnnouncement[];
  mealItems: TvAnnouncement[];
  gununSozuItems: TvAnnouncement[];
  countdownText: string;
  countdownTargets: CountdownTarget[];
  countdownCardTitle: string;
  countdownFontSize: number;
  countdownNow: Date;
  mealCardTitle: string;
  mealFontSize: number;
  dutyCardTitle: string;
  dutyFontSize: number;
  isCardVisible: (key: string) => boolean;
  tarihKisa: string;
  gunAdi: string;
  saat: string;
}) {
  const borderClass = cardPosition === 'right' ? 'border-l' : 'border-r';

  return (
    <div
      className={`flex min-h-0 w-[220px] shrink-0 flex-col self-stretch sm:w-[260px] md:w-[300px] lg:w-[340px] ${borderClass} border-[var(--tv-border)] bg-[var(--tv-bg-dark)]`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
      {isCardVisible('datetime') && (
      <div className="tv-datetime-card flex min-h-0 min-w-0 shrink-0 flex-col items-center justify-center rounded-lg px-3 py-3 text-center">
        <p className="text-center text-sm font-medium text-[var(--tv-text-muted)]">{tarihKisa} · {gunAdi}</p>
        <p className="tv-datetime-clock mt-1 font-extrabold leading-none text-[var(--tv-accent)]">{saat}</p>
      </div>
      )}
      {isCardVisible('weather') && (
      <TvWeatherCard
        temp={weather?.temp}
        city={weather?.city ?? (byCategory.weather ?? [])[0]?.title}
      />
      )}
      {isCardVisible('gunun_sozu') && gununSozuItems.length > 0 && (
        <SideCarousel
          title="GÜNÜN SÖZÜ"
          bannerVariant="accent"
          items={gununSozuItems}
          renderItem={(item) => (
            <div className="py-2 text-center">
              <p className="text-lg italic text-[var(--tv-text)] md:text-xl">
                &ldquo;{item.body || item.summary || item.title || '—'}&rdquo;
              </p>
              {item.title && !(item.title || '').toLowerCase().includes('günün sözü') && (
                <p className="mt-2 text-sm text-[var(--tv-text-muted)]">— {item.title}</p>
              )}
            </div>
          )}
        />
      )}
      {isCardVisible('duty') && (
      <SideCarousel
        title={dutyCardTitle || 'Nöbetçi Öğretmen'}
        bannerVariant="red"
        items={dutyItems}
        renderItem={(item) => (
          <div className="flex items-start gap-2 py-1.5 sm:gap-3 sm:py-2">
            {item.attachment_url ? (
              <img src={item.attachment_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-xl sm:h-16 sm:w-16 sm:text-2xl" aria-hidden>
                👤
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--tv-text)]" style={{ fontSize: `${dutyFontSize}px` }}>{item.title}</p>
              <p
                className="mt-1 text-[var(--tv-text-muted)]"
                style={{ fontSize: `${Math.max(14, dutyFontSize - 4)}px` }}
              >
                {item.summary || item.body || 'Görev bilgisi'}
              </p>
            </div>
          </div>
        )}
      />
      )}
      {isCardVisible('countdown') && (
      countdownTargets.length > 0 ? (
        <CountdownCard
          title={countdownCardTitle || 'SAYAÇLAR (Sınav / Tatil / Karne)'}
          targets={countdownTargets}
          now={countdownNow}
          fontSize={countdownFontSize}
        />
      ) : (
        <SideCarousel
          title={countdownCardTitle || 'SAYAÇLAR (Sınav / Tatil / Karne)'}
          bannerVariant="yellow"
          items={
            (byCategory.countdown ?? []).length > 0
              ? byCategory.countdown ?? []
              : [{ id: '_empty', title: '', summary: countdownText, body: '' } as TvAnnouncement]
          }
          renderItem={() => (
            <div className="flex items-center gap-3 py-2">
              <p
                className="flex-1 text-center font-extrabold tabular-nums text-[var(--tv-text)]"
                style={{ fontSize: `${countdownFontSize}px` }}
              >
                {countdownText}
              </p>
            </div>
          )}
        />
      )
      )}
      {isCardVisible('meal') && (
      <SideCarousel
        title={mealCardTitle || 'Yemek / Kantin Menüsü'}
        bannerVariant="accent"
        items={mealItems}
        renderItem={(item) => {
          const menuText = (item.summary || item.body || '').trim() || 'Menü bilgisi yok';
          const menuLines = menuText.split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean);
          return (
            <div className="flex items-start gap-2 py-1.5 sm:gap-3 sm:py-2">
              {item.attachment_url ? (
                <img src={item.attachment_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--tv-accent)]/20 text-xl sm:h-16 sm:w-16 sm:text-2xl" aria-hidden>
                  🍽️
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--tv-text)]" style={{ fontSize: `${mealFontSize}px` }}>{item.title}</p>
                {menuLines.length > 0 ? (
                  <ul className="mt-2 space-y-1" style={{ fontSize: `${Math.max(14, mealFontSize - 4)}px` }}>
                    {menuLines.map((line, i) => (
                      <li key={i} className="flex items-center gap-2 text-[var(--tv-text-muted)]">
                        <span className="text-[var(--tv-accent)]">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[var(--tv-text-muted)]" style={{ fontSize: `${Math.max(12, mealFontSize - 4)}px` }}>
                    {menuText}
                  </p>
                )}
              </div>
            </div>
          );
        }}
      />
      )}
      </div>
    </div>
  );
}

function staffInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR');
}

/** TV öğretmen kartı: özet (summary) ile içerik (body) ayrı; ikisi aynıysa tek blok. */
function staffSummaryAndBody(t: { summary?: string | null; body?: string | null }): {
  summary: string;
  body: string;
  duplicate: boolean;
} {
  const s = (t.summary ?? '').trim();
  const b = (t.body ?? '').trim();
  const duplicate = s !== '' && b !== '' && s === b;
  return { summary: s, body: b, duplicate };
}

/* Görsel tam dolu, yazılar görsele uyumlu overlay */
function SlideCard({
  category,
  title,
  body,
  image,
  accentTitle = false,
  categoryColor = 'accent',
  customBody,
}: {
  category: string;
  title?: string;
  body?: string;
  image?: ReactNode;
  accentTitle?: boolean;
  categoryColor?: 'accent' | 'warm' | 'cool' | 'success';
  customBody?: ReactNode;
}) {
  const categoryClass = {
    accent: 'tv-slide-category text-[var(--tv-accent-muted)]',
    warm: 'tv-slide-category text-amber-200',
    cool: 'tv-slide-category text-indigo-200',
    success: 'tv-slide-category text-emerald-200',
  }[categoryColor];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 tv-slide-media-wrap">
        {image ?? (
          <div className="h-full w-full bg-gradient-to-br from-[var(--tv-bg-dark)] to-[var(--tv-accent)]/20" />
        )}
      </div>
      {/* Gradient – panel ile birlikte daha yumuşak */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="tv-slide-content-panel tv-slide-overlay w-full max-w-4xl py-1 md:py-2">
          <span className={`${categoryClass} inline-block`}>
            {category}
          </span>
          {customBody ? (
            <div className="mt-3 md:mt-4">{customBody}</div>
          ) : (
            <>
              {title != null && title !== '' && (
                <h2
                  className={`tv-slide-title mt-3 text-balance text-white ${accentTitle ? '!text-amber-50' : ''}`}
                >
                  {title}
                </h2>
              )}
              {body && (
                <div className="tv-slide-body tv-slide-body-scroll mt-3">
                  <p className="text-white/95 whitespace-pre-line">{body}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type TimetableData = {
  entries: Array<{ day: number; lesson: number; class: string; subject: string }>;
  sections: string[];
  times: Array<{ num: number; start: string; end: string }>;
  timesWeekend?: Array<{ num: number; start: string; end: string }>;
} | null;

function SlideView({
  slide,
  active,
  onVideoEnd,
  schoolName = 'Okul',
  welcomeImageUrl,
  timetableData,
  currentLessonNum,
  currentDay,
  birthdayCardTitle,
  birthdayFontSize,
}: {
  slide: SlideConfig;
  active: boolean;
  onVideoEnd?: () => void;
  schoolName?: string;
  welcomeImageUrl?: string;
  timetableData?: TimetableData;
  currentLessonNum?: number;
  currentDay?: number;
  birthdayCardTitle?: string;
  birthdayFontSize?: number;
}) {
  const base = 'absolute inset-0 flex flex-col transition-opacity duration-500 ease-out';

  if (slide.type === 'welcome') {
    return (
      <div
        className={`${base} items-center justify-center px-6 py-8 md:px-12 md:py-12 ${
          active ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {welcomeImageUrl && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={welcomeImageUrl}
              alt=""
              className="h-full w-full object-cover opacity-[0.48]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--tv-bg-dark)]/45 via-[var(--tv-bg-dark)]/55 to-[var(--tv-bg-dark)]/92" />
          </div>
        )}
        <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6 text-center">
          <h1 className="tv-gradient-text text-3xl font-extrabold uppercase leading-tight tracking-wide md:text-5xl lg:text-6xl">
            {schoolName.toUpperCase()} KANALINA HOŞ GELDİNİZ
          </h1>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-5 py-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--tv-red)] text-white">
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 4c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--tv-red)]">Öğretmen Pro</span>
          </div>
          <p className="text-lg leading-relaxed text-[var(--tv-text-muted)] md:text-xl">
            Okulunuzun duyuruları, programları ve bilgilendirmeleri bu ekrandan yayınlanır.
            <span className="mt-2 block font-medium text-[var(--tv-accent-muted)]">İyi seyirler dileriz.</span>
          </p>
        </div>
      </div>
    );
  }

  const first = slide.items?.[0];
  const title = first?.title || '';
  const body = first?.body || first?.summary || '';

  let content: ReactNode = null;

  switch (slide.type) {
    case 'special_day': {
      const imgSrc = first?.attachment_url;
      content = (
        <SlideCard
          category="Belirli Gün ve Haftalar"
          title={title}
          body={body}
          categoryColor="accent"
          image={
            imgSrc ? (
              <img src={imgSrc} alt="" className="tv-slide-media tv-slide-media--cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--tv-accent)]/30 to-transparent text-6xl">
                📅
              </div>
            )
          }
        />
      );
      break;
    }
    case 'principal_message': {
      const imgSrc = first?.attachment_url;
      content = (
        <SlideCard
          category="Okul Müdürü"
          title={title}
          body={body}
          categoryColor="accent"
          image={
            imgSrc ? (
              <img src={imgSrc} alt="" className="tv-slide-media tv-slide-media--cover object-top" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[var(--tv-accent)]/40 to-[var(--tv-bg-dark)] text-6xl">
                👔
              </div>
            )
          }
        />
      );
      break;
    }
    case 'staff': {
      const list = (slide.items ?? []).slice(0, 6);
      if (list.length === 1) {
        const t = list[0];
        const avatarUrl = (t as { attachment_url?: string }).attachment_url;
        const name = (t.title || 'Öğretmen').trim();
        const { summary: sum, body: bod, duplicate } = staffSummaryAndBody(t);
        const showSummary = !duplicate && sum !== '';
        const showBody = duplicate ? sum !== '' : bod !== '';
        const bodyText = duplicate ? sum : bod;
        const hasText = showSummary || showBody;
        content = (
          <div className="tv-staff-solo">
            {/* Sol: fotoğraf alanı */}
            <div className="tv-staff-solo__photo">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="tv-staff-solo__img" />
              ) : (
                <div className="tv-staff-solo__initials-wrap">
                  <span className="tv-staff-solo__initials">{staffInitials(name)}</span>
                </div>
              )}
              <div className="tv-staff-solo__photo-overlay" aria-hidden />
            </div>
            {/* Sağ: bilgi paneli */}
            <div className="tv-staff-solo__info">
              <p className="tv-staff-solo__eyebrow">Öğretmenimiz</p>
              <h2 className="tv-staff-solo__name">{name}</h2>
              {hasText && (
                <>
                  <div className="tv-staff-solo__divider" aria-hidden />
                  {showSummary && <p className="tv-staff-solo__summary">{sum}</p>}
                  {showBody && (
                    <p className="tv-staff-solo__detail whitespace-pre-line">{bodyText}</p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      } else if (list.length === 0) {
        content = (
          <div className="tv-staff-empty">
            <Users className="tv-staff-empty__icon" strokeWidth={1.5} />
            <p className="tv-staff-empty__text">Henüz öğretmen bilgisi eklenmedi.</p>
          </div>
        );
      } else {
        content = (
          <div className="tv-staff-multi">
            <div className="tv-staff-multi__bg" aria-hidden />
            <div className="tv-staff-multi__inner">
              <header className="tv-staff-multi__header">
                <div className="tv-staff-multi__header-icon" aria-hidden>
                  <Users strokeWidth={2} />
                </div>
                <span className="tv-staff-multi__header-label">Öğretmenlerimiz</span>
                <span className="tv-staff-multi__count tabular-nums">{list.length}</span>
              </header>
              <div className={`tv-staff-multi__grid tv-staff-multi__grid--${list.length}`}>
                {list.map((t) => {
                  const avatarUrl = (t as { attachment_url?: string }).attachment_url;
                  const name = (t.title || 'Öğretmen').trim();
                  const { summary: sum, body: bod, duplicate } = staffSummaryAndBody(t);
                  const showSummary = !duplicate && sum !== '';
                  const showBody = duplicate ? sum !== '' : bod !== '';
                  const bodyText = duplicate ? sum : bod;
                  return (
                    <article key={t.id} className="tv-staff-card2">
                      <div className="tv-staff-card2__photo">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="tv-staff-card2__img" />
                        ) : (
                          <span className="tv-staff-card2__initials">{staffInitials(name)}</span>
                        )}
                      </div>
                      <div className="tv-staff-card2__info">
                        <h3 className="tv-staff-card2__name">{name}</h3>
                        {showSummary && <p className="tv-staff-card2__summary">{sum}</p>}
                        {showBody && (
                          <p className="tv-staff-card2__detail whitespace-pre-line">{bodyText}</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
      break;
    }
    case 'birthday': {
      const items = slide.items ?? [];
      const isCalendarFormat = items.some((i) => i.summary === 'teacher' || i.summary === 'student');
      const teachers = items.filter((i) => i.summary === 'teacher');
      const students = items.filter((i) => i.summary === 'student');
      const totalCount = teachers.length + students.length;
      const cardTitle = birthdayCardTitle?.trim() || 'Bugün doğum günü olanlar';
      const baseFontSize = birthdayFontSize ?? 28;
      // Çok kişi varsa yazı boyutunu otomatik küçült – hepsi tek slaytta sığsın
      const scaleFactor =
        totalCount <= 2 ? 1.1 :
        totalCount <= 4 ? 1 :
        totalCount <= 6 ? 0.85 :
        totalCount <= 10 ? 0.7 :
        totalCount <= 15 ? 0.58 : 0.5;
      const nameFontSize = Math.round(baseFontSize * scaleFactor);
      const formatName = (item: { title?: string | null; body?: string | null }) => {
        const cls = item.body?.trim();
        return cls ? `${item.title ?? ''} (${cls})` : (item.title ?? '');
      };
      const hasCalendarData = isCalendarFormat && (teachers.length > 0 || students.length > 0);
      const imgSrc = first?.attachment_url;

      content = (
        <div className="absolute inset-0 flex flex-col overflow-hidden">
          {/* Arka plan: tam ekran görsel – büyük ve net */}
          <div className="absolute inset-0 tv-slide-media-wrap">
            {imgSrc ? (
              <>
                <img src={imgSrc} alt="" className="tv-slide-media tv-slide-media--cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20" aria-hidden />
              </>
            ) : (
              <div
                className="size-full"
                style={{
                  background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1510 25%, #4a2020 50%, #3d1a1a 75%, #1f0d0a 100%)',
                }}
              >
                <div className="absolute -left-20 -top-20 h-[30vh] w-[30vh] rounded-full bg-amber-500/25 blur-3xl md:h-[40vh] md:w-[40vh]" aria-hidden />
                <div className="absolute -right-20 top-1/3 h-[25vh] w-[25vh] rounded-full bg-rose-500/25 blur-3xl md:h-[35vh] md:w-[35vh]" aria-hidden />
                <div className="absolute bottom-0 left-1/2 h-[15vh] w-[80vw] -translate-x-1/2 rounded-full bg-yellow-500/20 blur-3xl" aria-hidden />
                <div className="absolute inset-0 overflow-hidden opacity-50" aria-hidden>
                  {['#fbbf24', '#f59e0b', '#f97316', '#fb7185', '#e879f9'].map((color, ci) =>
                    [...Array(5)].map((_, i) => (
                      <div
                        key={`${ci}-${i}`}
                        className="absolute size-[0.4rem] rounded-full md:size-[0.5rem] lg:size-3"
                        style={{
                          left: `${(ci * 19 + i * 13) % 100}%`,
                          top: `${(ci * 17 + i * 9) % 100}%`,
                          backgroundColor: color,
                          opacity: 0.5 + (i % 2) * 0.2,
                        }}
                      />
                    )),
                  )}
                </div>
                <div className="absolute right-4 top-4 text-[min(8vw,6rem)] opacity-25 md:right-8 md:top-8" aria-hidden>🎂</div>
                <div className="absolute bottom-8 left-4 text-[min(6vw,4rem)] opacity-20 md:left-8" aria-hidden>🎈</div>
                <div className="absolute bottom-16 right-4 text-[min(5vw,3rem)] opacity-20 md:right-12" aria-hidden>🎁</div>
              </div>
            )}
          </div>

          {/* İçerik – ekrana göre ölçeklenir, tüm alanı kullanır */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-6 md:gap-6 md:px-8 md:py-10 lg:gap-8 lg:px-12 lg:py-12">
            {hasCalendarData ? (
              <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4 lg:gap-6">
                {/* Ana başlık – ekrana ve kişi sayısına göre ölçeklenir */}
                <div className="shrink-0 text-center">
                  <p className="mb-0.5 text-[clamp(0.6rem,1.5vw,1rem)] font-bold uppercase tracking-[0.2em] text-amber-300/95">
                    {cardTitle}
                  </p>
                  <h1
                    className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-clip-text font-extrabold leading-tight text-transparent drop-shadow-lg"
                    style={{
                      fontSize: totalCount > 10
                        ? 'clamp(1rem, 3vw, 2rem)'
                        : totalCount > 6
                          ? 'clamp(1.2rem, 3.5vw, 2.5rem)'
                          : 'clamp(1.5rem, 4.5vw, 3.5rem)',
                    }}
                  >
                    DOĞUM GÜNÜNÜZ KUTLU OLSUN
                  </h1>
                  <p
                    className="mt-1 text-amber-200/85 md:mt-2"
                    style={{ fontSize: totalCount > 10 ? 'clamp(0.6rem, 1.5vw, 0.85rem)' : 'clamp(0.7rem, 2vw, 1rem)' }}
                  >
                    Bugün özel olanlara binlerce tebrik! 🎉
                  </p>
                </div>

                {/* İsimler – tek slaytta hepsi, responsive grid, ekrana göre otomatik sığdırma */}
                <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 md:flex-row md:gap-8 lg:gap-12">
                  {teachers.length > 0 && (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:gap-3">
                      <div className="flex shrink-0 items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/25 px-4 py-1.5 md:px-5 md:py-2">
                        <span className="text-[clamp(1rem,2.5vw,1.5rem)]">👩‍🏫</span>
                        <span className="text-[clamp(0.65rem,1.5vw,0.85rem)] font-bold uppercase tracking-wider text-amber-200">Öğretmenler</span>
                      </div>
                      <ul
                        className={`grid w-full auto-rows-fr justify-items-center gap-1.5 sm:gap-2 ${
                          totalCount > 8
                            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}
                      >
                        {teachers.map((t, i) => (
                          <li
                            key={i}
                            className="w-full max-w-sm rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-500/35 to-amber-700/25 px-4 py-2.5 shadow-lg backdrop-blur-sm md:px-5 md:py-3"
                            style={{ fontSize: `clamp(0.8rem, 2.2vw, ${nameFontSize}px)` }}
                          >
                            <span className="block text-center font-bold leading-tight text-amber-50 drop-shadow break-words">
                              {formatName(t)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {students.length > 0 && (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:gap-3">
                      <div className="flex shrink-0 items-center gap-2 rounded-full border border-rose-400/60 bg-rose-500/25 px-4 py-1.5 md:px-5 md:py-2">
                        <span className="text-[clamp(1rem,2.5vw,1.5rem)]">🎓</span>
                        <span className="text-[clamp(0.65rem,1.5vw,0.85rem)] font-bold uppercase tracking-wider text-rose-200">Öğrenciler</span>
                      </div>
                      <ul
                        className={`grid w-full auto-rows-fr justify-items-center gap-1.5 sm:gap-2 ${
                          totalCount > 8
                            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}
                      >
                        {students.map((s, i) => (
                          <li
                            key={i}
                            className="w-full max-w-sm rounded-xl border-2 border-rose-400/60 bg-gradient-to-br from-rose-500/35 to-rose-700/25 px-4 py-2.5 shadow-lg backdrop-blur-sm md:px-5 md:py-3"
                            style={{ fontSize: `clamp(0.8rem, 2.2vw, ${nameFontSize}px)` }}
                          >
                            <span className="block text-center font-bold leading-tight text-rose-50 drop-shadow break-words">
                              {formatName(s)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Duyuru formatı */
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-2 rounded-2xl border-2 border-amber-400/50 bg-amber-500/25 px-6 py-4 md:mb-4 md:px-8 md:py-5">
                  <span className="text-[clamp(3rem,10vw,6rem)]">🎂</span>
                </div>
                <h1 className="mb-2 bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-clip-text text-[clamp(1.5rem,5vw,3.5rem)] font-extrabold text-transparent">
                  {title || 'Doğum günü kutlu olsun!'}
                </h1>
                {body && (
                  <p className="max-w-3xl whitespace-pre-line text-[clamp(1rem,2.5vw,1.5rem)] text-amber-100/95">
                    {body}
                  </p>
                )}
                <p className="mt-4 text-[clamp(0.8rem,2vw,1rem)] text-amber-300/80 md:mt-6">
                  Nice mutlu yıllara! 🎉
                </p>
              </div>
            )}
          </div>
        </div>
      );
      break;
    }
    case 'success': {
      const imgSrc = first?.attachment_url;
      content = (
        <div className="tv-success-slide relative flex h-full min-h-0 w-full overflow-hidden">
          <div className="tv-success-slide__media absolute inset-0 min-h-0 min-w-0">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="tv-success-slide__fallback" aria-hidden />
            )}
            <div className="tv-success-slide__scrim" aria-hidden />
            <div className="tv-success-slide__vignette" aria-hidden />
          </div>
          <div className="relative z-10 flex h-full min-h-0 w-full flex-1 flex-col items-center justify-end px-[clamp(0.75rem,2.5vmin,2rem)] pb-[clamp(1rem,3vmin,2.5rem)] pt-[clamp(0.5rem,1.5vmin,1rem)]">
            <div className="tv-success-slide__panel tv-slide-overlay flex max-h-full min-h-0 w-full flex-col items-center text-center">
              <span className="tv-success-badge">Başarı</span>
              <h2 className="tv-success-title mt-[clamp(0.5rem,2vmin,1.25rem)]">
                {title || 'Tebrik ederiz!'}
              </h2>
              {body ? (
                <div className="tv-success-slide__body tv-success-body tv-slide-body">
                  <p className="whitespace-pre-line">{body}</p>
                </div>
              ) : (
                <p className="tv-success-title tv-success-title--sub mt-[clamp(0.75rem,2.5vmin,1.5rem)]">
                  TEBRİK EDERİZ.
                </p>
              )}
              <div className="tv-success-slide__accent-line mt-[clamp(1rem,2.5vmin,1.75rem)]" aria-hidden />
            </div>
          </div>
        </div>
      );
      break;
    }
    case 'video': {
      const videoItem = slide.items?.[0] as TvAnnouncement | undefined;
      const waitForEnd = videoItem?.tv_wait_for_video_end === true;
      const embedUrl = getYoutubeEmbedUrl(videoItem?.youtube_url, waitForEnd);
      const { summary: vSum, body: vBod, duplicate: vDup } = staffSummaryAndBody(videoItem ?? {});
      const vTitle = videoItem?.title?.trim() || '';
      const hasOverlayText = !!(vTitle || vSum || vBod);
      content = (
        <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-black">
          <div className="tv-slide-video-wrap z-0">
            {embedUrl ? (
            <TvVideoIframe
              embedUrl={embedUrl}
              title={videoItem?.title || 'Video'}
              waitForEnd={waitForEnd && !!onVideoEnd}
              onVideoEnd={onVideoEnd}
              active={active}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[var(--tv-bg-dark)]">
              <span className="text-6xl">🎬</span>
              <p className="text-xl text-[var(--tv-text-muted)]">Video yüklenemedi</p>
              {vTitle ? <p className="text-sm text-white/70">{vTitle}</p> : null}
            </div>
          )}
          </div>
          {embedUrl && hasOverlayText ? (
            <>
              <div
                className="absolute inset-0 z-[5] bg-gradient-to-t from-black/85 via-black/40 to-black/15 pointer-events-none"
                aria-hidden
              />
              <div className="absolute inset-0 z-[6] flex flex-col justify-end p-4 sm:p-6 md:p-8 lg:p-10 pointer-events-none">
                <div className="tv-slide-content-panel tv-slide-overlay w-full max-w-4xl py-1 md:py-2">
                  <span className="tv-slide-category inline-block text-[var(--tv-accent-muted)] drop-shadow-md">
                    {tvCategoryLabelForSlide(videoItem?.category)}
                  </span>
                  {vTitle ? (
                    <h2 className="tv-slide-title mt-3 text-balance text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                      {vTitle}
                    </h2>
                  ) : null}
                  {vDup && vSum ? (
                    <div className="tv-slide-body tv-slide-body-scroll mt-3 max-h-[28vh]">
                      <p className="whitespace-pre-line text-white/95">{vSum}</p>
                    </div>
                  ) : (
                    <>
                      {vSum ? (
                        <p className="mt-3 text-balance text-lg font-semibold leading-snug text-white/95 drop-shadow-md md:text-xl">
                          {vSum}
                        </p>
                      ) : null}
                      {vBod ? (
                        <div className="tv-slide-body tv-slide-body-scroll mt-3 max-h-[28vh]">
                          <p className="whitespace-pre-line text-white/95">{vBod}</p>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      );
      break;
    }
    case 'timetable': {
      const items = slide.items ?? [];
      const withImages = items.filter((i) => i.attachment_url);
      const hasGrid = timetableData && items.some((i) => i.id === '_timetable-grid');
      content = (
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 flex flex-col bg-[var(--tv-bg-dark)]">
            {hasGrid && timetableData ? (
              <TimetableGrid
                data={timetableData}
                currentLessonNum={currentLessonNum ?? 0}
                currentDay={currentDay ?? 1}
              />
            ) : withImages.length > 0 ? (
              <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center">
                <TimetableImageCarousel items={withImages} />
              </div>
            ) : (
              <div className="tv-slide-media-wrap flex h-full w-full min-h-0 min-w-0 items-center justify-center">
                <img
                  src="/tv/slider/dersprogrami.jpg"
                  alt="Ders programı"
                  className="tv-slide-media"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <div className="absolute bottom-6 left-6 right-6 rounded-lg border border-white/25 bg-transparent px-4 py-2">
            <span className="tv-slide-label text-white/90">Ders Programı</span>
          </div>
        </div>
      );
      break;
    }
    case 'news': {
      const item = slide.items?.[0] as TvAnnouncement | undefined;
      const catLabel =
        item?.category === 'info_bank' ? 'Bilgi Bankası' : 'Genel';
      const imgSrc = item?.attachment_url;
      content = (
        <SlideCard
          category={catLabel}
          title={title}
          body={body}
          categoryColor="cool"
          image={
            imgSrc ? (
              <img src={imgSrc} alt="" className="tv-slide-media tv-slide-media--cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-900/40 to-[var(--tv-bg-dark)] text-6xl">
                📰
              </div>
            )
          }
        />
      );
      break;
    }
    default:
      content = null;
  }

  return (
    <div
      className={`${base} ${
        active ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
    </div>
  );
}

type SlideType =
  | 'welcome'
  | 'special_day'
  | 'principal_message'
  | 'staff'
  | 'birthday'
  | 'success'
  | 'timetable'
  | 'news'
  | 'video';

type SlideConfig = {
  key: string;
  type: SlideType;
  items?: TvAnnouncement[];
};

/** Metinde **kalın** kısımları turuncu vurguya çevirir */
function renderHighlightedText(text: string | null | undefined): ReactNode {
  if (text == null || typeof text !== 'string') return null;
  const s = String(text);
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i} className="text-[#ea580c] font-bold">{m[1]}</strong>;
    return <span key={i}>{p}</span>;
  });
}

function TimetableGrid({
  data,
  currentLessonNum,
  currentDay = 1,
}: {
  data: TimetableData;
  currentLessonNum: number;
  /** JS getDay(): 0–6 */
  currentDay?: number;
}) {
  if (!data) return null;
  const turkishFromJs = currentDay === 0 ? 7 : (currentDay ?? 1);
  const day = turkishFromJs >= 1 && turkishFromJs <= 7 ? turkishFromJs : 1;
  const lessons = [...new Set(data.entries.filter((e) => e.day === day).map((e) => e.lesson))].sort((a, b) => a - b);
  const sections = data.sections.length > 0 ? data.sections : [...new Set(data.entries.map((e) => e.class))].sort();
  const getCell = (lesson: number, cls: string) =>
    data.entries.find((e) => e.day === day && e.lesson === lesson && e.class === cls)?.subject ?? '—';

  return (
    <div className="flex h-full w-full flex-col overflow-auto p-4 md:p-6">
      <h2 className="mb-3 text-center text-lg font-bold text-white md:text-xl">Ders Programı</h2>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-max border-collapse text-sm md:text-base">
          <thead>
            <tr className="border-b border-white/30">
              <th className="bg-white/10 px-2 py-2 text-left font-semibold text-white">Ders</th>
              {sections.map((s) => (
                <th key={s} className="border-l border-white/20 bg-white/10 px-2 py-2 text-center font-semibold text-white">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => {
              const isCurrent = lesson === currentLessonNum;
              return (
                <tr
                  key={lesson}
                  className={`border-b border-white/15 ${isCurrent ? 'bg-[var(--tv-red)]/40' : 'bg-white/5'}`}
                >
                  <td className={`px-2 py-2 font-semibold ${isCurrent ? 'text-white' : 'text-white/90'}`}>
                    {lesson}. Ders
                  </td>
                  {sections.map((cls) => (
                    <td
                      key={cls}
                      className={`border-l border-white/20 px-2 py-2 text-center ${isCurrent ? 'font-semibold text-white' : 'text-white/85'}`}
                    >
                      {getCell(lesson, cls)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimetableImageCarousel({ items }: { items: TvAnnouncement[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % items.length),
      12000,
    );
    return () => clearInterval(id);
  }, [items.length]);

  const item = items[index] ?? items[0];
  if (!item?.attachment_url) return null;

  return (
    <div className="tv-slide-media-wrap flex h-full w-full min-h-0 min-w-0 items-center justify-center p-2">
      <img
        src={item.attachment_url}
        alt={item.title || 'Ders programı'}
        className="tv-slide-media max-h-full max-w-full"
      />
    </div>
  );
}

function ImagePromoCarousel({ items }: { items: TvAnnouncement[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % items.length),
      8000,
    );
    return () => clearInterval(id);
  }, [items.length]);

  const item = items[index] ?? items[0];
  if (!item) return null;

  const text = item.body || item.summary || item.title || '';
  return (
    <div className="tv-image-promo overflow-hidden">
      {item.attachment_url && (
        <div className="mb-2 min-h-0 min-w-0 overflow-hidden rounded">
          <img
            src={item.attachment_url}
            alt=""
            className="h-24 w-full min-h-0 object-cover object-center md:h-28"
          />
        </div>
      )}
      <div className="text-[#1f2937]">
        {item.title && (item.body || item.summary) && (
          <p className="mb-2 text-sm font-semibold uppercase text-[#374151]">{item.title}</p>
        )}
        <p className="whitespace-pre-line text-[15px] leading-relaxed md:text-base">
          {renderHighlightedText(text)}
        </p>
      </div>
    </div>
  );
}

function SideCarousel({
  title,
  bannerVariant = 'red',
  items,
  renderItem,
}: {
  title: string;
  bannerVariant?: 'red' | 'yellow' | 'accent';
  items: TvAnnouncement[];
  renderItem: (item: TvAnnouncement) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % items.length),
      6000,
    );
    return () => clearInterval(id);
  }, [items.length]);

  const current = items[index] ?? items[0];
  const bannerClass = `tv-panel-banner tv-panel-banner--${bannerVariant}`;

  return (
    <div className="min-h-0 min-w-0 shrink-0 overflow-hidden rounded-xl bg-white/5">
      <div className={bannerClass}>{title}</div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        {current ? (
          <div className="text-base text-[var(--tv-text)] md:text-lg">{renderItem(current)}</div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="mb-2 text-3xl opacity-50">📋</span>
            <p className="text-base text-[var(--tv-text-muted)]">Henüz içerik eklenmemiş</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** YouTube URL’li kayıt yalnızca `video` slaytında; kategori slaytlarında tekrar gösterilmez. */
function stripYoutubeForVideoOnly(items: TvAnnouncement[]): TvAnnouncement[] {
  return items.filter((a) => !a.youtube_url?.trim());
}

function tvCategoryLabelForSlide(category: string | undefined | null): string {
  const c = (category || 'general').trim().toLowerCase() || 'general';
  const m: Record<string, string> = {
    general: 'Genel',
    special_day: 'Belirli Gün ve Haftalar',
    principal_message: 'Okul Müdürü',
    staff: 'Öğretmenlerimiz',
    info_bank: 'Bilgi Bankası',
    birthday: 'Doğum günü',
    success: 'Başarı',
    timetable: 'Ders programı',
    ticker: 'Okul Duyuruları (Sarı Bar)',
    duty: 'Nöbet listesi',
    meal: 'Yemek listesi',
    countdown: 'Sayaç',
    now_in_class: 'Şu an derste',
    weather: 'Hava durumu',
  };
  return m[c] ?? 'Duyuru';
}

function groupByCategory(items: TvAnnouncement[]): Record<string, TvAnnouncement[]> {
  const map: Record<string, TvAnnouncement[]> = {};
  for (const item of items) {
    const key = (item.category || 'general').trim().toLowerCase() || 'general';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

