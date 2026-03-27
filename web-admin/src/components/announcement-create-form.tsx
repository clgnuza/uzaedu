'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Save, Trash2, PenLine, ImageIcon, Tv, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { ImageUrlInput } from '@/components/image-url-input';
import { cn } from '@/lib/utils';

const TEMPLATE_STORAGE_KEY = 'announcement_templates';

export type AnnouncementTemplate = {
  id: string;
  name: string;
  createdAt: string;
  title: string;
  summary: string;
  body: string;
  attachmentUrl: string;
  youtubeUrl: string;
  waitForVideoEnd: boolean;
  importance: string;
  category: string;
  showOnTv: boolean;
  tvSlot: string;
  tvAudience: string;
  publish: boolean;
};

function loadTemplates(): AnnouncementTemplate[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(TEMPLATE_STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnnouncementTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: AnnouncementTemplate[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    }
  } catch {
    // ignore
  }
}

const ANNOUNCEMENT_FORM_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'general', label: 'Genel (orta bölüm)' },
  { value: 'ticker', label: 'Okul Duyuruları (alt şerit – sarı bar)' },
  { value: 'principal_message', label: 'Müdür mesajı (orta bölüm)' },
  { value: 'staff', label: 'Öğretmenlerimiz (orta bölüm)' },
  { value: 'success', label: 'Başarı (orta bölüm)' },
];

export function CreateAnnouncementForm({
  token,
  onSuccess,
  onCancel,
  defaultShowOnTv = false,
  defaultPublish = false,
  initialCategory = 'general',
  schoolId,
  schoolIds,
}: {
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
  defaultShowOnTv?: boolean;
  defaultPublish?: boolean;
  /** Dışarıdan (şablon seçimi) açılışta kategori. */
  initialCategory?: string;
  /** Superadmin: Tek okul (geriye uyumluluk). */
  schoolId?: string | null;
  /** Superadmin: Birden fazla okula aynı duyuru gönderilecek. */
  schoolIds?: string[];
}) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [waitForVideoEnd, setWaitForVideoEnd] = useState(false);
  const [importance, setImportance] = useState('normal');
  const [category, setCategory] = useState(initialCategory);
  const [showOnTv, setShowOnTv] = useState(defaultShowOnTv);
  const [tvSlot, setTvSlot] = useState('');
  const [tvAudience, setTvAudience] = useState('both');
  const [publish, setPublish] = useState(defaultPublish);

  useEffect(() => {
    if (category === 'ticker') {
      setShowOnTv(true);
      setPublish(true);
      setTvSlot((s) => s || 'ticker');
    }
  }, [category]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateSaveName, setTemplateSaveName] = useState('');

  const targetSchools = schoolIds?.length ? schoolIds : schoolId ? [schoolId] : [];

  const refreshTemplates = useCallback(() => {
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const applyTemplate = (t: AnnouncementTemplate) => {
    setTitle(t.title);
    setSummary(t.summary);
    setBody(t.body);
    setAttachmentUrl(t.attachmentUrl);
    setYoutubeUrl(t.youtubeUrl);
    setWaitForVideoEnd(t.waitForVideoEnd);
    setImportance(t.importance);
    setCategory(t.category);
    setShowOnTv(t.showOnTv);
    setTvSlot(t.tvSlot);
    setTvAudience(t.tvAudience);
    setPublish(t.publish);
    setSelectedTemplateId(t.id);
    toast.success(`"${t.name}" şablonu yüklendi`);
  };

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    saveTemplates(next);
    setTemplates(next);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    toast.success('Şablon silindi');
  };

  const handleSaveTemplate = () => {
    const name = templateSaveName.trim();
    if (!name || !title.trim()) {
      toast.error('Şablon adı ve başlık gerekli');
      return;
    }
    const template: AnnouncementTemplate = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      title,
      summary,
      body,
      attachmentUrl,
      youtubeUrl,
      waitForVideoEnd,
      importance,
      category,
      showOnTv,
      tvSlot,
      tvAudience,
      publish,
    };
    const next = [...templates, template];
    saveTemplates(next);
    setTemplates(next);
    setTemplateSaveName('');
    setSelectedTemplateId(template.id);
    toast.success('Şablon kaydedildi');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim()) return;
    const schools = targetSchools.length ? targetSchools : [];
    if (schoolIds && schoolIds.length === 0) {
      setError('En az bir okul seçilmeli.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim() || undefined,
        body: body.trim() || undefined,
        attachment_url: attachmentUrl.trim() || undefined,
        youtube_url: youtubeUrl.trim() || undefined,
        tv_wait_for_video_end: youtubeUrl.trim() ? waitForVideoEnd : undefined,
        importance: importance || 'normal',
        category: category || 'general',
        show_on_tv: showOnTv,
        tv_slot: tvSlot || undefined,
        tv_audience: showOnTv ? tvAudience : undefined,
        publish,
      };
      if (schools.length > 0) {
        let ok = 0;
        let fail = 0;
        for (const sid of schools) {
          try {
            await apiFetch('/announcements', {
              method: 'POST',
              token,
              body: JSON.stringify({ ...payload, school_id: sid }),
            });
            ok++;
          } catch {
            fail++;
          }
        }
        if (fail > 0) {
          toast.warning(`${ok} okula gönderildi, ${fail} okula gönderilemedi.`);
        } else {
          toast.success(ok > 1 ? `${ok} okula duyuru gönderildi` : 'Duyuru oluşturuldu');
        }
      } else {
        await apiFetch('/announcements', {
          method: 'POST',
          token,
          body: JSON.stringify({ ...payload, ...(schoolId && { school_id: schoolId }) }),
        });
        toast.success('Duyuru oluşturuldu');
      }
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kaydedilemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25';
  const lab = 'mb-1.5 block text-sm font-medium text-foreground';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert message={error} />}
      {targetSchools.length > 1 && (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Bu duyuru <strong>{targetSchools.length} okula</strong> gönderilecek.
        </p>
      )}

      <section className="rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60">
            <FileText className="size-4 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Şablonlar</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Tarayıcıda saklanan şablonları yükleyin veya mevcut alanları şablon olarak kaydedin.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="ann-template-select" className={lab}>
              Kayıtlı şablon
            </label>
            <select
              id="ann-template-select"
              value={selectedTemplateId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTemplateId(id);
                const t = templates.find((x) => x.id === id);
                if (t) applyTemplate(t);
              }}
              className={field}
            >
              <option value="">— Şablon seç —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="ann-template-name" className={lab}>
                Şablon adı
              </label>
              <input
                id="ann-template-name"
                type="text"
                value={templateSaveName}
                onChange={(e) => setTemplateSaveName(e.target.value)}
                placeholder="Örn. Haftalık hatırlatma"
                className={field}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted sm:flex-initial"
              >
                <Save className="size-4 shrink-0" />
                Şablon olarak kaydet
              </button>
              {selectedTemplateId ? (
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(selectedTemplateId)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="size-4 shrink-0" />
                  Sil
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
          <PenLine className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Metin</h3>
        </div>
        <div className="space-y-4">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-title" className={lab}>
              Başlık <span className="text-destructive">*</span>
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              required
              className={field}
              placeholder={category === 'staff' ? 'Öğretmen adı soyadı' : 'Duyuru başlığı'}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-summary" className={lab}>
              Özet
            </label>
            <input
              id="ann-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={field}
              placeholder={category === 'staff' ? 'Branş (örn. Matematik Öğretmeni)' : 'Kısa özet (liste görünümünde)'}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-body" className={lab}>
              İçerik
            </label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className={cn(field, 'min-h-[100px] resize-y')}
              placeholder="Duyuru metni"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
          <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Görsel ve video</h3>
        </div>
        <div className="flex flex-col gap-6">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-attachment" className={lab}>
              Görsel (Duyuru TV)
            </label>
            <ImageUrlInput
              id="ann-attachment"
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              token={token}
              purpose="announcement"
              hint={
                category === 'ticker'
                  ? 'Sarı bar sadece metin gösterir, görsel kullanılmaz.'
                  : category === 'staff'
                    ? 'Öğretmen fotoğrafı. Orta bölümde kartlarda gösterilir.'
                    : 'Görsel + TV işaretli duyurular sağ panelde beyaz kutuda gösterilir. Metinde **kelime** turuncu vurgulanır.'
              }
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-youtube" className={lab}>
              YouTube (Duyuru TV)
            </label>
            <input
              id="ann-youtube"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className={field}
              placeholder="https://youtube.com/watch?v=..."
            />
            {category === 'ticker' && (
              <p className="text-xs leading-relaxed text-muted-foreground">Sarı bar sadece metin gösterir, video kullanılmaz.</p>
            )}
            {youtubeUrl.trim() && category !== 'ticker' && (
              <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <input
                  id="ann-wait-video"
                  type="checkbox"
                  checked={waitForVideoEnd}
                  onChange={(e) => setWaitForVideoEnd(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-input"
                />
                <label htmlFor="ann-wait-video" className="text-sm leading-snug text-foreground">
                  Video bitimine kadar slayt dursun
                </label>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Sınıflandırma</h3>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-importance" className={lab}>
              Önem
            </label>
            <select
              id="ann-importance"
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
              className={field}
            >
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="ann-category" className={lab}>
              Kategori (Duyuru TV)
            </label>
            <select
              id="ann-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              {ANNOUNCEMENT_FORM_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {category === 'staff' && (
          <p className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-xs leading-relaxed text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            <strong>Kullanım:</strong> Her öğretmen için ayrı duyuru ekleyin. Başlık = ad soyad, Özet = branş (örn. Matematik Öğretmeni).
            Görsel URL = öğretmen fotoğrafı (opsiyonel). TV orta bölümde kartlar halinde gösterilir.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-primary/20 bg-linear-to-br from-primary/5 to-transparent p-4 sm:p-5 dark:from-primary/10">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Tv className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">TV yayını</h3>
            <p className="text-xs text-muted-foreground">
              TV’de görünmek için aşağıdaki seçenekleri kullanın.
            </p>
          </div>
        </div>
        <p className="mb-3 rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/50">
          TV ekranında görünmesi için <strong className="text-foreground">Duyuru TV</strong> ve genelde{' '}
          <strong className="text-foreground">Hemen yayınla</strong> birlikte kullanılmalıdır.
        </p>
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5">
            <input
              id="ann-show-tv"
              type="checkbox"
              checked={showOnTv}
              onChange={(e) => setShowOnTv(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input"
            />
            <div className="min-w-0">
              <label htmlFor="ann-show-tv" className="text-sm font-medium text-foreground">
                Duyuru TV ekranında göster
              </label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Koridor, öğretmenler veya akıllı tahta ekranlarında listelenir.
              </p>
            </div>
          </div>
          {showOnTv && (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 p-3 sm:p-4">
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="ann-tv-slot" className={lab}>
                    TV konumu (opsiyonel)
                  </label>
                  <select
                    id="ann-tv-slot"
                    value={tvSlot}
                    onChange={(e) => setTvSlot(e.target.value)}
                    className={cn(field, 'text-xs')}
                  >
                    <option value="">Otomatik yerleşim</option>
                    <option value="middle">Orta bölüm</option>
                    <option value="bottom">Alt bölüm</option>
                    <option value="right">Sağ bölüm</option>
                    <option value="ticker">Sarı bar – Okul duyuruları</option>
                  </select>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <label htmlFor="ann-tv-audience" className={lab}>
                    Hedef ekran
                  </label>
                  <select
                    id="ann-tv-audience"
                    value={tvAudience}
                    onChange={(e) => setTvAudience(e.target.value)}
                    className={cn(field, 'text-xs')}
                  >
                    <option value="all">Tüm ekranlarda</option>
                    <option value="both">Koridor + Öğretmenler odası</option>
                    <option value="corridor">Sadece koridor</option>
                    <option value="teachers">Sadece öğretmenler odası</option>
                    <option value="classroom">Sadece Akıllı Tahta</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5">
            <input
              id="ann-publish"
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input"
            />
            <div className="min-w-0">
              <label htmlFor="ann-publish" className="text-sm font-medium text-foreground">
                Hemen yayınla
              </label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Yayındaki duyurular TV’de görünür; taslaklar görünmez.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          aria-busy={submitting}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
