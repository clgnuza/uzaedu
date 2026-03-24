'use client';

import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Eye, Pencil, Trash2, MonitorPlay, AlertTriangle, Info, CalendarPlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageUrlInput } from '@/components/image-url-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export type AnnouncementItem = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  importance: string;
  category: string;
  show_on_tv: boolean;
  tv_slot: string | null;
  tv_audience?: string;
  published_at: string | null;
  created_at: string;
  read_at: string | null;
  scheduled_from?: string | null;
  scheduled_until?: string | null;
  urgent_override_until?: string | null;
  tv_slide_duration_seconds?: number | null;
  creator?: { display_name: string | null; email: string } | null;
  attachment_url?: string | null;
  youtube_url?: string | null;
  tv_wait_for_video_end?: boolean;
};

type ListResponse = {
  total: number;
  page: number;
  limit: number;
  items: AnnouncementItem[];
};

const IMPORTANCE_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Genel',
  special_day: 'Belirli gün / hafta',
  principal_message: 'Müdür mesajı',
  staff: 'Öğretmenlerimiz',
  info_bank: 'Bilgi bankası',
  birthday: 'Doğum günü',
  success: 'Başarı',
  timetable: 'Ders programı',
  duty: 'Nöbet listesi',
  meal: 'Yemek listesi',
  ticker: 'Okul Duyuruları (Sarı Bar)',
  weather: 'Hava durumu',
  countdown: 'Sayaç',
  now_in_class: 'Şu an derste',
};

const ANNOUNCEMENT_FORM_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'general', label: 'Genel (orta bölüm)' },
  { value: 'ticker', label: 'Okul Duyuruları (alt şerit – sarı bar)' },
  { value: 'principal_message', label: 'Müdür mesajı (orta bölüm)' },
  { value: 'staff', label: 'Öğretmenlerimiz (orta bölüm)' },
  { value: 'success', label: 'Başarı (orta bölüm)' },
];

const TV_SLOT_LABELS: Record<string, string> = {
  middle: 'Orta bölüm',
  bottom: 'Alt bölüm',
  right: 'Sağ bölüm',
  ticker: 'Sarı bar – Okul duyuruları',
};

function getTvAudienceLabel(audience: string | undefined): string {
  if (!audience || audience === 'all') return 'Tüm ekranlarda';
  if (audience === 'both') return 'Koridor + Öğretmenler odası';
  if (audience === 'corridor') return 'Sadece koridor';
  if (audience === 'teachers') return 'Sadece öğretmenler odası';
  if (audience === 'classroom') return 'Sadece Akıllı Tahta';
  return audience;
}

/** Kategori → sol kenarlık ve arka plan rengi (Duyuru TV ile uyumlu) */
const CATEGORY_COLORS: Record<string, { border: string; bg: string; header: string }> = {
  general: { border: 'border-l-slate-500', bg: 'bg-slate-50/60 dark:bg-slate-950/30', header: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
  special_day: { border: 'border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-950/20', header: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' },
  principal_message: { border: 'border-l-violet-500', bg: 'bg-violet-50/50 dark:bg-violet-950/20', header: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200' },
  staff: { border: 'border-l-teal-500', bg: 'bg-teal-50/50 dark:bg-teal-950/20', header: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200' },
  info_bank: { border: 'border-l-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/20', header: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' },
  success: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20', header: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' },
  birthday: { border: 'border-l-rose-500', bg: 'bg-rose-50/50 dark:bg-rose-950/20', header: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200' },
  ticker: { border: 'border-l-yellow-500', bg: 'bg-yellow-50/50 dark:bg-yellow-950/20', header: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200' },
  now_in_class: { border: 'border-l-sky-500', bg: 'bg-sky-50/50 dark:bg-sky-950/20', header: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200' },
  timetable: { border: 'border-l-indigo-500', bg: 'bg-indigo-50/50 dark:bg-indigo-950/20', header: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200' },
  duty: { border: 'border-l-orange-500', bg: 'bg-orange-50/50 dark:bg-orange-950/20', header: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200' },
  meal: { border: 'border-l-lime-500', bg: 'bg-lime-50/50 dark:bg-lime-950/20', header: 'bg-lime-100 dark:bg-lime-900/40 text-lime-800 dark:text-lime-200' },
  weather: { border: 'border-l-cyan-500', bg: 'bg-cyan-50/50 dark:bg-cyan-950/20', header: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200' },
  countdown: { border: 'border-l-pink-500', bg: 'bg-pink-50/50 dark:bg-pink-950/20', header: 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-200' },
};

const CATEGORY_ORDER = [
  'ticker', 'general', 'special_day', 'principal_message', 'staff', 'info_bank',
  'success', 'birthday', 'now_in_class', 'timetable', 'duty', 'meal', 'weather', 'countdown',
];

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
}

function isUrgentOverrideActive(until: string | null | undefined): boolean {
  if (!until) return false;
  try {
    return new Date(until) > new Date();
  } catch {
    return false;
  }
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AnnouncementDetailModal({
  id,
  token,
  onClose,
}: {
  id: string;
  token: string | null;
  onClose: () => void;
}) {
  const [addToAgendaLoading, setAddToAgendaLoading] = useState(false);
  const [item, setItem] = useState<AnnouncementItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiFetch<AnnouncementItem>(`/announcements/${id}`, { token })
      .then(setItem)
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi'))
      .finally(() => setLoading(false));
  }, [id, token]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Duyuru önizlemesi" className="max-w-2xl">
        {loading && <LoadingSpinner label="Duyuru yükleniyor…" className="py-8" />}
        {error && !loading && <Alert message={error} />}
        {item && !loading && (
          <div className="space-y-4">
            {/* TV stili önizleme – Duyuru TV ekranında nasıl görüneceği */}
            <div className="overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-900 shadow-xl">
              <p className="border-b border-slate-700/80 bg-slate-800/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sky-400">
                TV önizleme · {CATEGORY_LABELS[item.category] ?? item.category}
              </p>
              <div className="relative flex aspect-video min-h-[220px] flex-col justify-end overflow-hidden bg-slate-950">
                {item.attachment_url && (
                  <>
                    <img
                      src={item.attachment_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/20"
                      aria-hidden
                    />
                  </>
                )}
                <div className="relative max-h-full overflow-y-auto px-5 pb-5 pt-4">
                  <span
                    className="inline-block text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                  <h2
                    className="mt-2 text-xl font-extrabold leading-tight text-white md:text-2xl"
                    style={{
                      letterSpacing: '-0.02em',
                      textShadow: '0 2px 4px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.8)',
                    }}
                  >
                    {item.title}
                  </h2>
                  {(item.summary || item.body) && (
                    <p
                      className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-white/95"
                      style={{
                        letterSpacing: '0.02em',
                        textShadow: '0 1px 3px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
                      }}
                    >
                      {item.summary || item.body}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Metin ve meta bilgiler */}
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Başlık</span>
                <p className="mt-0.5 font-medium text-foreground">{item.title}</p>
              </div>
              {item.summary && (
                <div>
                  <span className="font-medium text-muted-foreground">Özet</span>
                  <p className="mt-0.5 text-foreground">{item.summary}</p>
                </div>
              )}
              {item.body && (
                <div>
                  <span className="font-medium text-muted-foreground">İçerik</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.body}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 pt-1">
                <span><strong className="text-muted-foreground">Önem:</strong> {IMPORTANCE_LABELS[item.importance] ?? item.importance}</span>
                <span><strong className="text-muted-foreground">Durum:</strong> {item.published_at ? 'Yayında' : 'Taslak'}</span>
                {item.show_on_tv && (
                  <span className="flex items-center gap-1">
                    <Info className="size-3.5" />
                    <strong className="text-muted-foreground">Yayın:</strong> {getTvAudienceLabel(item.tv_audience)}
                  </span>
                )}
                <span><strong className="text-muted-foreground">Oluşturulma:</strong> {new Date(item.created_at).toLocaleString('tr-TR')}</span>
              </div>
              {item.creator && (
                <p><strong className="text-muted-foreground">Oluşturan:</strong> {item.creator.display_name || item.creator.email}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                disabled={!token || addToAgendaLoading}
                onClick={async () => {
                  if (!token || !item) return;
                  setAddToAgendaLoading(true);
                  try {
                    await apiFetch('/teacher-agenda/notes', {
                      method: 'POST',
                      token,
                      body: JSON.stringify({
                        title: item.title,
                        body: (item.summary || item.body) ?? undefined,
                        tags: ['duyuru'],
                      }),
                    });
                    toast.success('Ajandaya eklendi');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Ajandaya eklenemedi');
                  } finally {
                    setAddToAgendaLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                <CalendarPlus className="size-4" />
                {addToAgendaLoading ? 'Ekleniyor…' : 'Ajandaya ekle'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditAnnouncementForm({
  token,
  item,
  onSuccess,
  onCancel,
}: {
  token: string | null;
  item: AnnouncementItem;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary ?? '');
  const [body, setBody] = useState(item.body ?? '');
  const [attachmentUrl, setAttachmentUrl] = useState(item.attachment_url ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(item.youtube_url ?? '');
  const [waitForVideoEnd, setWaitForVideoEnd] = useState(!!item.tv_wait_for_video_end);
  const [importance, setImportance] = useState(item.importance);
  const [category, setCategory] = useState(item.category || 'general');
  const [showOnTv, setShowOnTv] = useState(!!item.show_on_tv);
  const [tvSlot, setTvSlot] = useState(item.tv_slot ?? '');
  const [tvAudience, setTvAudience] = useState(item.tv_audience || 'all');
  const [publish, setPublish] = useState(!!item.published_at);
  const [scheduledFrom, setScheduledFrom] = useState(isoToDatetimeLocal(item.scheduled_from));
  const [scheduledUntil, setScheduledUntil] = useState(isoToDatetimeLocal(item.scheduled_until));
  const [slideDuration, setSlideDuration] = useState(
    item.tv_slide_duration_seconds ? String(item.tv_slide_duration_seconds) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/announcements/${item.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || null,
          body: body.trim() || null,
          attachment_url: attachmentUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          tv_wait_for_video_end: youtubeUrl.trim() ? waitForVideoEnd : undefined,
          importance: importance || 'normal',
          category: category || 'general',
          show_on_tv: showOnTv,
          tv_slot: tvSlot || null,
          tv_audience: showOnTv ? tvAudience : undefined,
          publish,
          scheduled_from: scheduledFrom ? new Date(scheduledFrom).toISOString() : null,
          scheduled_until: scheduledUntil ? new Date(scheduledUntil).toISOString() : null,
          tv_slide_duration_seconds: slideDuration ? parseInt(slideDuration, 10) : null,
        }),
      });
      toast.success('Duyuru güncellendi');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = !item.category || ANNOUNCEMENT_FORM_CATEGORIES.some((c) => c.value === item.category)
    ? ANNOUNCEMENT_FORM_CATEGORIES
    : [
        { value: item.category, label: CATEGORY_LABELS[item.category] ?? item.category },
        ...ANNOUNCEMENT_FORM_CATEGORIES,
      ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert message={error} />}
      <div>
        <label htmlFor="edit-ann-title" className="mb-1 block text-sm font-medium text-foreground">
          Başlık *
        </label>
        <input
          id="edit-ann-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div>
        <label htmlFor="edit-ann-summary" className="mb-1 block text-sm font-medium text-foreground">
          Özet
        </label>
        <input
          id="edit-ann-summary"
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div>
        <label htmlFor="edit-ann-body" className="mb-1 block text-sm font-medium text-foreground">
          İçerik
        </label>
        <textarea
          id="edit-ann-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-ann-attachment" className="mb-1 block text-sm font-medium text-foreground">
            Görsel (Duyuru TV)
          </label>
          <ImageUrlInput
            id="edit-ann-attachment"
            value={attachmentUrl}
            onChange={setAttachmentUrl}
            token={token}
            purpose="announcement"
          />
        </div>
        <div>
          <label htmlFor="edit-ann-youtube" className="mb-1 block text-sm font-medium text-foreground">
            YouTube linki (Duyuru TV)
          </label>
          <input
            id="edit-ann-youtube"
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="https://youtube.com/watch?v=..."
          />
          {youtubeUrl.trim() && category !== 'ticker' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                id="edit-ann-wait-video"
                type="checkbox"
                checked={waitForVideoEnd}
                onChange={(e) => setWaitForVideoEnd(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <label htmlFor="edit-ann-wait-video" className="text-xs text-muted-foreground">
                Video bitimine kadar slayt dursun
              </label>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Önem</label>
        <select
          value={importance}
          onChange={(e) => setImportance(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="normal">Normal</option>
          <option value="high">Yüksek</option>
          <option value="urgent">Acil</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Kategori (Duyuru TV)</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex items-center gap-2">
          <input
            id="edit-ann-show-tv"
            type="checkbox"
            checked={showOnTv}
            onChange={(e) => setShowOnTv(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <label htmlFor="edit-ann-show-tv" className="text-sm font-medium text-foreground">
            Duyuru TV ekranında göster
          </label>
        </div>
        {showOnTv && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-ann-tv-slot" className="mb-1 block text-xs font-medium text-muted-foreground">
                TV konumu
              </label>
              <select
                id="edit-ann-tv-slot"
                value={tvSlot}
                onChange={(e) => setTvSlot(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Otomatik</option>
                <option value="middle">Orta bölüm</option>
                <option value="bottom">Alt bölüm</option>
                <option value="right">Sağ bölüm</option>
                <option value="ticker">Sarı bar</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-ann-tv-audience" className="mb-1 block text-xs font-medium text-muted-foreground">
                Hedef ekran
              </label>
              <select
                id="edit-ann-tv-audience"
                value={tvAudience}
                onChange={(e) => setTvAudience(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="all">Tüm ekranlarda</option>
                <option value="both">Koridor + Öğretmenler odası</option>
                <option value="corridor">Sadece koridor</option>
                <option value="teachers">Sadece öğretmenler odası</option>
                <option value="classroom">Sadece Akıllı Tahta</option>
              </select>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          id="edit-ann-publish"
          type="checkbox"
          checked={publish}
          onChange={(e) => setPublish(e.target.checked)}
          className="size-4 rounded border-input"
        />
        <label htmlFor="edit-ann-publish" className="text-sm font-medium text-foreground">
          Yayında
        </label>
      </div>
      {showOnTv && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <label className="text-sm font-medium text-foreground">Zamanlama (TV)</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-scheduled-from" className="mb-1 block text-xs text-muted-foreground">
                Gösterim başlangıcı
              </label>
              <input
                id="edit-scheduled-from"
                type="datetime-local"
                value={scheduledFrom}
                onChange={(e) => setScheduledFrom(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-scheduled-until" className="mb-1 block text-xs text-muted-foreground">
                Gösterim bitişi
              </label>
              <input
                id="edit-scheduled-until"
                type="datetime-local"
                value={scheduledUntil}
                onChange={(e) => setScheduledUntil(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          {category !== 'ticker' && (
            <div>
              <label htmlFor="edit-slide-duration" className="mb-1 block text-xs text-muted-foreground">
                Slayt süresi (saniye)
              </label>
              <input
                id="edit-slide-duration"
                type="number"
                min={3}
                value={slideDuration}
                onChange={(e) => setSlideDuration(e.target.value)}
                placeholder="10"
                className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      )}
      {showOnTv && publish && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/25">
          <label className="mb-1 block text-sm font-bold text-foreground">Acil duyuru – TV ekranlarını kapla</label>
          {isUrgentOverrideActive(item.urgent_override_until) && (
            <div className="mb-3 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 dark:border-red-600 dark:bg-red-900/30">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">Bu duyuru şu an acil durumda.</p>
            </div>
          )}
          <select
            id="edit-ann-urgent"
            defaultValue=""
            onChange={async (e) => {
              const v = e.target.value;
              if (!token) return;
              try {
                await apiFetch(`/announcements/${item.id}`, {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ urgent_override_minutes: v === '0' ? 0 : parseInt(v, 10) }),
                });
                toast.success(v === '0' ? 'Acil duyuru iptal edildi' : 'Acil duyuru ayarlandı');
                onSuccess();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'İşlem başarısız');
              }
            }}
            className="w-full rounded-lg border-2 border-input bg-background px-3 py-2.5 text-sm font-medium"
          >
            <option value="">— Süre seçin veya iptal edin —</option>
            <option value="0">Acil duyuruyu iptal et</option>
            <option value="5">5 dakika</option>
            <option value="15">15 dakika</option>
            <option value="30">30 dakika</option>
            <option value="60">1 saat</option>
          </select>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          İptal
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          aria-busy={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}

export function AnnouncementListSection({
  token,
  isSchoolAdmin,
  onRefresh,
  onCreateClick,
  schoolId,
  refreshTrigger,
}: {
  token: string | null;
  isSchoolAdmin: boolean;
  onRefresh: () => void;
  onCreateClick?: () => void;
  /** Superadmin: Hangi okulun duyuruları listelenecek. */
  schoolId?: string | null;
  /** Değişince liste yenilenir (örn. yeni duyuru sonrası). */
  refreshTrigger?: number;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<AnnouncementItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [urgentItem, setUrgentItem] = useState<AnnouncementItem | null>(null);
  const limit = 100;

  const fetchList = async () => {
    if (!token) return;
    if (!isSchoolAdmin && (!schoolId || schoolId === '')) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (schoolId) params.set('school_id', schoolId);
      const res = await apiFetch<ListResponse>(`/announcements?${params}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [token, page, schoolId, refreshTrigger]);

  const handleSuccess = () => {
    fetchList();
    onRefresh();
  };

  const byCategory = useMemo(() => {
    if (!data?.items.length) return [];
    const map: Record<string, AnnouncementItem[]> = {};
    for (const a of data.items) {
      const key = a.category || 'general';
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    for (const arr of Object.values(map)) {
      arr.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
    }
    const result: Array<{ category: string; items: AnnouncementItem[] }> = [];
    const seen = new Set<string>();
    for (const cat of CATEGORY_ORDER) {
      if (map[cat]?.length) {
        result.push({ category: cat, items: map[cat] });
        seen.add(cat);
      }
    }
    for (const cat of Object.keys(map)) {
      if (!seen.has(cat)) result.push({ category: cat, items: map[cat] });
    }
    return result;
  }, [data?.items]);

  const renderItem = (a: AnnouncementItem) => (
    <div
      key={a.id}
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/30 sm:flex-nowrap"
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{a.title}</div>
        {a.summary && (
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.summary}</div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              a.importance === 'urgent' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
              a.importance === 'high' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
              a.importance === 'normal' && 'bg-muted text-muted-foreground'
            )}
          >
            {IMPORTANCE_LABELS[a.importance] ?? a.importance}
          </span>
          {a.published_at ? (
            <span className="text-xs text-muted-foreground">Yayında</span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">Taslak</span>
          )}
          {a.show_on_tv && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              <MonitorPlay className="size-3" />
              TV
            </span>
          )}
          {isUrgentOverrideActive(a.urgent_override_until) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-900/40 dark:text-red-200">
              <AlertTriangle className="size-3" />
              Acil
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(a.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {a.show_on_tv && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            <span>Yayın: {getTvAudienceLabel(a.tv_audience)}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setDetailId(a.id)}
          className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Detay"
        >
          <Eye className="size-4" />
        </button>
        {isSchoolAdmin && a.show_on_tv && a.published_at && (
          <button
            type="button"
            onClick={() => setUrgentItem(a)}
            className="rounded p-2 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
            title="Acil duyuru"
          >
            <AlertTriangle className="size-4" />
          </button>
        )}
        {isSchoolAdmin && (
          <>
            <button
              type="button"
              onClick={() => setEditItem(a)}
              className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Düzenle"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteId(a.id)}
              className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Sil"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Okul duyuruları</CardTitle>
        <p className="text-sm text-muted-foreground">Eklenen duyurular aşağıda kategoriye ve renge göre listelenir</p>
        {error && <Alert message={error} className="mt-2" />}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <LoadingSpinner label="Duyuru listesi yükleniyor…" />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="space-y-4">
              {byCategory.map(({ category, items }) => {
                const colors = getCategoryColor(category);
                const label = CATEGORY_LABELS[category] ?? category ?? 'Genel';
                return (
                  <div
                    key={category}
                    className={cn('overflow-hidden rounded-lg border border-l-4', colors.border, colors.bg)}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-between px-4 py-2.5 text-sm font-semibold',
                        colors.header
                      )}
                    >
                      <span>{label}</span>
                      <span className="text-xs font-normal opacity-90">({items.length})</span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {items.map(renderItem)}
                    </div>
                  </div>
                );
              })}
            </div>
            {data.total > limit && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Toplam {data.total} duyuru (ilk {limit} gösteriliyor)</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    Önceki
                  </button>
                  <button
                    type="button"
                    disabled={page * limit >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Megaphone />}
            title="Henüz duyuru yok"
            description="İlk duyuruyu oluşturarak başlayabilirsiniz."
            action={
              isSchoolAdmin && onCreateClick ? (
                <button
                  type="button"
                  onClick={onCreateClick}
                  className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                >
                  İlk duyuruyu oluştur
                </button>
              ) : undefined
            }
          />
        )}
      </CardContent>

      {detailId && (
        <AnnouncementDetailModal id={detailId} token={token} onClose={() => setDetailId(null)} />
      )}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent title="Duyuruyu düzenle" className="max-w-2xl">
            <EditAnnouncementForm
              token={token}
              item={editItem}
              onSuccess={() => {
                setEditItem(null);
                handleSuccess();
              }}
              onCancel={() => setEditItem(null)}
            />
          </DialogContent>
        </Dialog>
      )}
      {urgentItem && (
        <Dialog open={!!urgentItem} onOpenChange={(open) => !open && setUrgentItem(null)}>
          <DialogContent title="Acil duyuru – TV ekranlarını kapla" className="max-w-2xl">
            {/* Acil slayt önizlemesi – TV ekranında nasıl görüneceği */}
            <div className="overflow-hidden rounded-xl border-2 border-red-800/50">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Acil slayt önizleme
              </p>
              <div
                className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center"
                style={{
                  background: 'linear-gradient(145deg, #7f1d1d 0%, #991b1b 25%, #b91c1c 50%, #dc2626 75%, #991b1d 100%)',
                }}
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-1.5 text-sm font-extrabold uppercase tracking-wider text-red-700 shadow-lg">
                  <AlertTriangle className="size-4" />
                  Acil Duyuru
                </div>
                <h1 className="mt-4 text-xl font-extrabold text-white drop-shadow-lg md:text-2xl">
                  {urgentItem.title}
                </h1>
                {(urgentItem.summary || urgentItem.body) && (
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/90">
                    {urgentItem.summary || urgentItem.body}
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Bu duyuru tüm Duyuru TV ekranlarında belirtilen süre boyunca tek başına gösterilecek.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    try {
                      await apiFetch(`/announcements/${urgentItem.id}`, {
                        method: 'PATCH',
                        token,
                        body: JSON.stringify({ urgent_override_minutes: mins }),
                      });
                      toast.success(`${mins} dakika acil duyuru aktif`);
                      setUrgentItem(null);
                      handleSuccess();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
                    }
                  }}
                  className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                >
                  {mins} dakika
                </button>
              ))}
              {isUrgentOverrideActive(urgentItem.urgent_override_until) && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    try {
                      await apiFetch(`/announcements/${urgentItem.id}`, {
                        method: 'PATCH',
                        token,
                        body: JSON.stringify({ urgent_override_minutes: 0 }),
                      });
                      toast.success('Acil duyuru iptal edildi');
                      setUrgentItem(null);
                      handleSuccess();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
                    }
                  }}
                  className="rounded-lg border-2 border-red-500 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/50"
                >
                  Acil duyuruyu iptal et
                </button>
              )}
              <button
                type="button"
                onClick={() => setUrgentItem(null)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                İptal
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {deleteId && (
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent title="Duyuruyu sil">
            <p className="text-sm text-muted-foreground">Bu duyuruyu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!token || !deleteId) return;
                  try {
                    await apiFetch(`/announcements/${deleteId}`, { method: 'DELETE', token });
                    toast.success('Duyuru silindi');
                    setDeleteId(null);
                    handleSuccess();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Silinemedi');
                  }
                }}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              >
                Sil
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
