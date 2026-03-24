'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Save, Trash2, Send, Info, ImagePlus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { ImageUrlInput } from '@/components/image-url-input';

const TEMPLATE_STORAGE_KEY = 'admin_message_templates';

type AdminMessageTemplate = {
  id: string;
  name: string;
  createdAt: string;
  title: string;
  body: string;
  imageUrl: string;
};

function loadTemplates(): AdminMessageTemplate[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (AdminMessageTemplate & { attachmentUrl?: string })[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({
      ...t,
      imageUrl: t.imageUrl ?? t.attachmentUrl ?? '',
    }));
  } catch {
    return [];
  }
}

function saveTemplates(templates: AdminMessageTemplate[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage erişimine izin yok (örn. iframe, tarayıcı eklentisi)
  }
}

export function SendAdminMessageForm({
  token,
  schoolIds,
  onSuccess,
  onCancel,
}: {
  token: string | null;
  schoolIds: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AdminMessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateSaveName, setTemplateSaveName] = useState('');

  const refreshTemplates = useCallback(() => setTemplates(loadTemplates()), []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const applyTemplate = (t: AdminMessageTemplate) => {
    setTitle(t.title);
    setBody(t.body);
    setImageUrl(t.imageUrl || '');
    setSelectedTemplateId(t.id);
    toast.success(`"${t.name}" şablonu yüklendi`);
  };

  const handleSaveTemplate = () => {
    const name = templateSaveName.trim();
    if (!name || !title.trim()) {
      toast.error('Şablon adı ve başlık gerekli');
      return;
    }
    const template: AdminMessageTemplate = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      title,
      body,
      imageUrl,
    };
    const next = [...templates, template];
    saveTemplates(next);
    setTemplates(next);
    setTemplateSaveName('');
    setSelectedTemplateId(template.id);
    toast.success('Şablon kaydedildi');
  };

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    saveTemplates(next);
    setTemplates(next);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    toast.success('Şablon silindi');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !title.trim()) return;
    if (schoolIds.length === 0) {
      setError('En az bir okul seçilmeli.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; ids: string[] }>('/admin-messages', {
        method: 'POST',
        token,
        body: JSON.stringify({
          school_ids: schoolIds,
          title: title.trim(),
          body: body.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
        }),
      });
      toast.success(res.created > 1 ? `${res.created} okula mesaj gönderildi` : 'Mesaj gönderildi');
      onSuccess();
    } catch (e) {
      let msg = e instanceof Error ? e.message : 'Kaydedilemedi';
      if (typeof msg === 'string' && (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('connection'))) {
        msg = 'Backend bağlantısı kurulamadı. Sunucunun çalıştığından emin olun (örn. backend\'de npm run start:dev).';
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert message={error} />}

      <div className="flex gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <Info className="size-6 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            Bu mesaj <strong>{schoolIds.length} okulun</strong> admin sayfasında &quot;Sistem Mesajları&quot; bölümünde görünecek.
          </p>
          <p className="mt-1 text-muted-foreground">
            Duyuru TV veya okul duyurularında yer almaz. Sistem, bakım veya hatırlatma içerikleri için.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Şablonlar</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTemplateId(id);
              const t = templates.find((x) => x.id === id);
              if (t) applyTemplate(t);
            }}
            className="min-w-[160px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
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
            className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <Save className="size-4" />
            Kaydet
          </button>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={() => handleDeleteTemplate(selectedTemplateId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Sil
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Mesaj içeriği</h3>
        <div>
          <label htmlFor="am-title" className="mb-1.5 block text-sm font-medium text-foreground">
            Başlık <span className="text-destructive">*</span>
          </label>
          <input
            id="am-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            required
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn. Sistem bakımı, Yeni güncelleme"
          />
        </div>
        <div>
          <label htmlFor="am-body" className="mb-1.5 block text-sm font-medium text-foreground">
            İçerik
          </label>
          <textarea
            id="am-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Mesaj metni..."
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
            <ImagePlus className="size-4" />
            Görsel
          </label>
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 focus-within:border-primary">
            <ImageUrlInput
              id="am-image"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="URL veya dosya yükle"
              hint="JPEG, PNG, WebP, GIF. Max 5 MB"
              token={token}
              purpose="admin_message"
            />
            {imageUrl && (
              <div className="mt-3">
                <img
                  src={imageUrl}
                  alt="Önizleme"
                  className="max-h-40 rounded-lg border border-border object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          İptal
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          aria-busy={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4" />
          {submitting ? 'Gönderiliyor…' : `${schoolIds.length} okula gönder`}
        </button>
      </div>
    </form>
  );
}
