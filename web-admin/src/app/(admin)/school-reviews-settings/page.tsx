'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

type SchoolReviewCriteria = {
  id: string;
  slug: string;
  label: string;
  hint: string | null;
  sort_order: number;
  min_score: number;
  max_score: number;
  is_active: boolean;
};

type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
};

export default function SchoolReviewsSettingsPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [config, setConfig] = useState<SchoolReviewsConfig | null>(null);
  const [criteria, setCriteria] = useState<SchoolReviewCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<SchoolReviewsConfig>>({});
  const [criteriaForm, setCriteriaForm] = useState<Partial<SchoolReviewCriteria> & { slug?: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    try {
      const [configData, criteriaData] = await Promise.all([
        apiFetch<SchoolReviewsConfig>('/app-config/school-reviews', { token }),
        apiFetch<SchoolReviewCriteria[]>('/school-reviews/criteria/admin', { token }),
      ]);
      setConfig(configData);
      setCriteria(criteriaData);
      setForm({
        enabled: configData.enabled,
        rating_min: configData.rating_min,
        rating_max: configData.rating_max,
        moderation_mode: configData.moderation_mode,
        allow_questions: configData.allow_questions,
        questions_require_moderation: configData.questions_require_moderation,
      });
    } catch {
      setConfig(null);
      setCriteria([]);
    } finally {
      setLoading(false);
    }
  }, [token, me?.role]);

  useEffect(() => {
    if (me?.role !== 'superadmin') {
      router.replace('/403');
      return;
    }
    fetchConfig();
  }, [me?.role, router, fetchConfig]);

  const handleSave = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setSaving(true);
    try {
      await apiFetch('/app-config/school-reviews', {
        method: 'PATCH',
        token,
        body: JSON.stringify(form),
      });
      toast.success('Okul değerlendirme ayarları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (me?.role !== 'superadmin') return null;
  if (loading || !config) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Okul Değerlendirme Ayarları</h1>
        <p className="text-sm text-muted-foreground">
          Öğretmenlerin okullara değerlendirme, yorum ve soru yazması için modül ayarları
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modül Durumu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Modül kapalıyken öğretmenler okul listesine erişemez ve değerlendirme yapamaz.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.enabled ?? config.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Modülü aç</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Değerlendirme (Puan) Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Puan aralığı 1-5 arasında olmalıdır. Öğretmenler bu aralıkta puan verebilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum puan</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.rating_min ?? config.rating_min}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_min: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Maksimum puan</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.rating_max ?? config.rating_max}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_max: parseInt(e.target.value, 10) || 5 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Moderasyon modu</label>
            <select
              value={form.moderation_mode ?? config.moderation_mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moderation_mode: e.target.value as 'auto' | 'moderation',
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="auto">
                Otomatik yayın – Değerlendirmeler anında yayınlanır
              </option>
              <option value="moderation">
                Moderasyon – Değerlendirmeler onay sonrası yayınlanır
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soru / Cevap Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Öğretmenler okullar hakkında soru sorabilir; diğer öğretmenler cevap verebilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.allow_questions ?? config.allow_questions}
              onChange={(e) => setForm((f) => ({ ...f, allow_questions: e.target.checked }))}
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Soru özelliğini aç</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.questions_require_moderation ?? config.questions_require_moderation}
              onChange={(e) =>
                setForm((f) => ({ ...f, questions_require_moderation: e.target.checked }))
              }
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Sorular moderasyondan geçsin</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Değerlendirme Kriterleri</CardTitle>
          <p className="text-sm text-muted-foreground">
            Öğretmenler her kritere 1–5 arası puan verebilir. Kriter yoksa tek genel puan kullanılır.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteriaForm ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Slug (sadece yeni kritere)</label>
                <input
                  type="text"
                  value={criteriaForm.slug ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="sosyo_ekonomik"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  readOnly={!!criteriaForm.id}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Başlık</label>
                <input
                  type="text"
                  value={criteriaForm.label ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Lokasyonun Sosyo-Ekonomik Durumu"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">İpucu (opsiyonel)</label>
                <input
                  type="text"
                  value={criteriaForm.hint ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, hint: e.target.value || undefined }))}
                  placeholder="1 = en pahalı"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    try {
                      if (criteriaForm.id) {
                        await apiFetch(`/school-reviews/criteria/${criteriaForm.id}`, {
                          method: 'PATCH',
                          token,
                          body: JSON.stringify({
                            label: criteriaForm.label,
                            hint: criteriaForm.hint || null,
                          }),
                        });
                        toast.success('Kriter güncellendi');
                      } else if (criteriaForm.slug && criteriaForm.label) {
                        await apiFetch('/school-reviews/criteria', {
                          method: 'POST',
                          token,
                          body: JSON.stringify({
                            slug: criteriaForm.slug.trim().toLowerCase().replace(/\s+/g, '_'),
                            label: criteriaForm.label.trim(),
                            hint: criteriaForm.hint?.trim() || null,
                          }),
                        });
                        toast.success('Kriter eklendi');
                      }
                      setCriteriaForm(null);
                      fetchConfig();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Hata');
                    }
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaForm(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCriteriaForm({ slug: '', label: '', hint: null })}
              className="flex items-center gap-2 rounded-md border border-dashed border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="size-4" />
              Yeni kriter ekle
            </button>
          )}
          <ul className="divide-y divide-border">
            {criteria.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <span className="font-medium">{c.label}</span>
                  {c.hint && <span className="ml-2 text-sm text-muted-foreground">({c.hint})</span>}
                  <span className="ml-2 text-xs text-muted-foreground">#{c.slug}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCriteriaForm({ ...c })}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token || !confirm('Bu kriteri silmek istediğinize emin misiniz?')) return;
                      try {
                        await apiFetch(`/school-reviews/criteria/${c.id}`, { method: 'DELETE', token });
                        toast.success('Kriter silindi');
                        fetchConfig();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Silinemedi');
                      }
                    }}
                    className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {criteria.length === 0 && !criteriaForm && (
            <p className="text-sm text-muted-foreground">Henüz kriter yok. Eklediğinizde öğretmenler her kritere ayrı puan verir.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      <Alert variant="info" message="School admin sadece kendi okuluna ait raporu görür. Moderasyon superadmin'dedir." />
    </div>
  );
}
