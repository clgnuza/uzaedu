'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Save, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { ImageUrlInput } from '@/components/image-url-input';

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
  schoolId,
  schoolIds,
}: {
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
  defaultShowOnTv?: boolean;
  defaultPublish?: boolean;
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
  const [category, setCategory] = useState('general');
  const [showOnTv, setShowOnTv] = useState(defaultShowOnTv);
  const [tvSlot, setTvSlot] = useState('');
  const [tvAudience, setTvAudience] = useState('all');
  const [publish, setPublish] = useState(defaultPublish);

  useEffect(() => {
    if (category === 'ticker') {
      setShowOnTv(true);
      setPublish(true);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert message={error} />}
      {targetSchools.length > 1 && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Bu duyuru <strong>{targetSchools.length} okula</strong> gönderilecek.
        </p>
      )}
      <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <FileText className="size-4" />
          Şablonlar
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTemplateId(id);
              const t = templates.find((x) => x.id === id);
              if (t) applyTemplate(t);
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">— Şablon seç —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={templateSaveName}
            onChange={(e) => setTemplateSaveName(e.target.value)}
            placeholder="Şablon adı"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 max-w-[160px]"
          />
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Save className="size-4" />
            Şablon olarak kaydet
          </button>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={() => handleDeleteTemplate(selectedTemplateId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Şablonu sil
            </button>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="ann-title" className="mb-1 block text-sm font-medium text-foreground">
          Başlık <span className="text-destructive">*</span>
        </label>
        <input
          id="ann-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder={category === 'staff' ? 'Öğretmen adı soyadı' : 'Duyuru başlığı'}
        />
      </div>
      <div>
        <label htmlFor="ann-summary" className="mb-1 block text-sm font-medium text-foreground">
          Özet
        </label>
        <input
          id="ann-summary"
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder={category === 'staff' ? 'Branş (örn. Matematik Öğretmeni)' : 'Kısa özet (liste görünümünde)'}
        />
      </div>
      <div>
        <label htmlFor="ann-body" className="mb-1 block text-sm font-medium text-foreground">
          İçerik
        </label>
        <textarea
          id="ann-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Duyuru metni"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ann-attachment" className="mb-1 block text-sm font-medium text-foreground">
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
        <div>
          <label htmlFor="ann-youtube" className="mb-1 block text-sm font-medium text-foreground">
            YouTube linki (Duyuru TV)
          </label>
          <input
            id="ann-youtube"
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="https://youtube.com/watch?v=..."
          />
          {category === 'ticker' && (
            <p className="mt-0.5 text-xs text-muted-foreground">Sarı bar sadece metin gösterir, video kullanılmaz.</p>
          )}
          {youtubeUrl.trim() && category !== 'ticker' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                id="ann-wait-video"
                type="checkbox"
                checked={waitForVideoEnd}
                onChange={(e) => setWaitForVideoEnd(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <label htmlFor="ann-wait-video" className="text-xs text-muted-foreground">
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
          {ANNOUNCEMENT_FORM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {category === 'staff' && (
          <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
            <strong>Kullanım:</strong> Her öğretmen için ayrı duyuru ekleyin. Başlık = ad soyad, Özet = branş (örn. Matematik Öğretmeni). 
            Görsel URL = öğretmen fotoğrafı (opsiyonel). TV orta bölümde kartlar halinde gösterilir.
          </p>
        )}
      </div>
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">
          TV ekranında görünmesi için <strong className="text-foreground">her ikisi de</strong> işaretli olmalı.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="ann-show-tv"
            type="checkbox"
            checked={showOnTv}
            onChange={(e) => setShowOnTv(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <label htmlFor="ann-show-tv" className="text-sm font-medium text-foreground">
            Duyuru TV ekranında göster
          </label>
        </div>
        {showOnTv && (
          <div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="ann-tv-slot" className="mb-1 block text-xs font-medium text-muted-foreground">
                  TV konumu (opsiyonel)
                </label>
                <select
                  id="ann-tv-slot"
                  value={tvSlot}
                  onChange={(e) => setTvSlot(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Otomatik yerleşim</option>
                  <option value="middle">Orta bölüm</option>
                  <option value="bottom">Alt bölüm</option>
                  <option value="right">Sağ bölüm</option>
                  <option value="ticker">Sarı bar – Okul duyuruları</option>
                </select>
              </div>
              <div>
                <label htmlFor="ann-tv-audience" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Hedef ekran
                </label>
                <select
                  id="ann-tv-audience"
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
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="ann-publish"
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <label htmlFor="ann-publish" className="text-sm font-medium text-foreground">
            Hemen yayınla (TV&apos;de görünür olması için zorunlu)
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
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
