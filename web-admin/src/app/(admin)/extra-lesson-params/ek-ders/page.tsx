'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Calculator, Table2, Save, ArrowLeft } from 'lucide-react';

type LineItem = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
  indicator?: number;
  multiplier?: number;
  unit_price_day?: number;
  unit_price_night?: number;
  unit_price?: number;
  fixed_amount?: number;
  sort_order?: number;
};

type TaxBracket = {
  max_matrah: number;
  rate_percent: number;
};

type CentralExamRole = {
  key: string;
  label: string;
  fixed_amount?: number;
  indicator?: number;
};

type EducationLevelRow = {
  key: string;
  label: string;
  unit_day: number;
  unit_night: number;
};

type ExtraLessonParam = {
  id: string;
  semester_code: string;
  title: string;
  monthly_coefficient?: string | null;
  indicator_day?: number;
  indicator_night?: number;
  line_items: LineItem[];
  tax_brackets: TaxBracket[];
  gv_exemption_max: string;
  dv_exemption_max: string;
  stamp_duty_rate: string;
  sgk_employee_rate?: string | null;
  ucretli_unit_scale?: string | null;
  central_exam_roles: CentralExamRole[] | null;
  education_levels?: EducationLevelRow[] | null;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
};

const DEFAULT_EDUCATION_LEVELS: EducationLevelRow[] = [
  { key: 'lisans', label: 'Lisans', unit_day: 194.3, unit_night: 208.18 },
  { key: 'yuksek_lisans', label: 'Yüksek Lisans', unit_day: 207.9, unit_night: 222.75 },
  { key: 'doktora', label: 'Doktora', unit_day: 233.16, unit_night: 249.82 },
];

const DEFAULT_TAX_BRACKETS: TaxBracket[] = [
  { max_matrah: 190000, rate_percent: 15 },
  { max_matrah: 400000, rate_percent: 20 },
  { max_matrah: 1500000, rate_percent: 27 },
  { max_matrah: 5300000, rate_percent: 35 },
  { max_matrah: 999999999, rate_percent: 40 },
];

const COEFF_DEFAULT = 1.387871;
const IND_DAY = 140;
const IND_NIGHT = 150;
const r = (v: number) => Math.round(v * 100) / 100;

const DEFAULT_LINE_ITEMS: LineItem[] = [
  { key: 'gunduz', label: 'Gündüz', type: 'hourly', indicator: 140, multiplier: 1, unit_price_day: r(COEFF_DEFAULT * 140), unit_price_night: r(COEFF_DEFAULT * 150), sort_order: 1 },
  { key: 'gece', label: 'Gece', type: 'hourly', indicator: 150, multiplier: 1, unit_price: r(COEFF_DEFAULT * 150), sort_order: 2 },
  { key: 'nobet', label: 'Nöbet Görevi', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 3 },
  { key: 'belleticilik', label: 'Belleticilik', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 4 },
  { key: 'sinav_gorevi', label: 'Sınav Görevi', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 5 },
  { key: 'egzersiz', label: 'Egzersiz', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 6 },
  { key: 'hizmet_ici', label: 'Hizmet İçi', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 7 },
  { key: 'ozel_egitim_25_gunduz', label: '%25 Fazla - Gündüz (EYG Gündüz Gör.)', type: 'hourly', indicator: 140, multiplier: 1.25, unit_price_day: r(COEFF_DEFAULT * 175), unit_price_night: r(COEFF_DEFAULT * 187.5), sort_order: 8 },
  { key: 'ozel_egitim_25_gece', label: '%25 Fazla - Gece (EYG Gece Gör.)', type: 'hourly', indicator: 150, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 187.5), sort_order: 9 },
  { key: 'ozel_egitim_25_nobet', label: '%25 Fazla - Nöbet (gösterge 187,5)', type: 'hourly', indicator: 150, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 187.5), sort_order: 10 },
  { key: 'ozel_egitim_25_belleticilik', label: '%25 Fazla - Belleticilik', type: 'hourly', indicator: 140, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 175), sort_order: 11 },
  { key: 'destek_odasi_25', label: 'Destek Odası %25', type: 'hourly', indicator: 140, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 175), sort_order: 12 },
  { key: 'evde_egitim_25', label: 'Evde Eğitim %25', type: 'hourly', indicator: 140, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 175), sort_order: 13 },
  { key: 'cezaevi_gunduz', label: 'Cezaevi Görevi Gündüz', type: 'hourly', indicator: 140, multiplier: 1.25, unit_price_day: r(COEFF_DEFAULT * 175), unit_price_night: r(COEFF_DEFAULT * 187.5), sort_order: 14 },
  { key: 'cezaevi_gece', label: 'Cezaevi Görevi Gece', type: 'hourly', indicator: 150, multiplier: 1.25, unit_price: r(COEFF_DEFAULT * 187.5), sort_order: 15 },
  { key: 'takviye_gunduz', label: 'DYK Gündüz', type: 'hourly', indicator: 140, multiplier: 2, unit_price_day: r(COEFF_DEFAULT * 280), unit_price_night: r(COEFF_DEFAULT * 300), sort_order: 16 },
  { key: 'takviye_gece', label: 'DYK Gece', type: 'hourly', indicator: 150, multiplier: 2, unit_price: r(COEFF_DEFAULT * 300), sort_order: 17 },
  { key: 'iyep_gunduz', label: 'İYEP Gündüz', type: 'hourly', indicator: 140, multiplier: 1, unit_price: r(COEFF_DEFAULT * 140), sort_order: 18 },
  { key: 'iyep_gece', label: 'İYEP Gece', type: 'hourly', indicator: 150, multiplier: 1, unit_price: r(COEFF_DEFAULT * 150), sort_order: 19 },
];

type LineItemTemplate = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
  indicator_day: number;
  indicator_night: number | null;
  sort_order: number;
};

/** Tüm merkezi sınav rolleri: Brüt=Katsayı×Gösterge. E-Sınav gösterge: 1300, 1200, 1560, 1440. */
const DEFAULT_CENTRAL_EXAM: CentralExamRole[] = [
  { key: 'bina_sinav_sorumlusu', label: 'Bina Sınav Sorumlusu', indicator: 2000 },
  { key: 'komisyon_baskani', label: 'SG (Bina Yön.)', indicator: 1900 },
  { key: 'komisyon_uyesi', label: 'SG (Bin. Yön. Yrd.)', indicator: 1700 },
  { key: 'salon_baskani', label: 'SG (Salon Başk.)', indicator: 1650 },
  { key: 'gozetmen', label: 'SG (Gözetmen)', indicator: 1600 },
  { key: 'yedek_gozetmen', label: 'SG (Yed. Göz.)', indicator: 1200 },
  { key: 'yrd_engelli_gozetmen', label: 'SG (Yar.Eng.Gz.)', indicator: 2000 },
  { key: 'cezaevi_salon_baskani', label: 'SG (Cezaevi Salon Başk.)', indicator: 1650 },
  { key: 'cezaevi_gozetmen', label: 'SG (Cezaevi Gözetmen)', indicator: 1600 },
  { key: 'salon_baskani_esinav', label: 'E-Sınav Salon Başk.', indicator: 1300 },
  { key: 'gozetmen_esinav', label: 'E-Sınav Gözetmen', indicator: 1200 },
  { key: 'salon_baskani_esinav_20', label: 'E-Sınav Salon Başk. %20', indicator: 1560 },
  { key: 'gozetmen_esinav_20', label: 'E-Sınav Gözetmen %20', indicator: 1440 },
];

export default function EkDersParamsPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [params, setParams] = useState<ExtraLessonParam[]>([]);
  const [templates, setTemplates] = useState<LineItemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ExtraLessonParam | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTemplates, setEditingTemplates] = useState(false);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('extra_lesson_params'));

  const fetchParams = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const [paramsData, templatesData] = await Promise.all([
        apiFetch<ExtraLessonParam[]>('/extra-lesson/params', { token }),
        apiFetch<LineItemTemplate[]>('/extra-lesson/line-item-templates', { token }),
      ]);
      setParams(paramsData);
      setTemplates(templatesData);
    } catch {
      setParams([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  useEffect(() => {
    if (!canManage) {
      router.replace('/403');
      return;
    }
    fetchParams();
  }, [canManage, router, fetchParams]);

  if (!canManage) return null;

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/extra-lesson-params"
          className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Hesaplama Parametreleri
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Ek Ders Hesaplama</h1>
        <p className="text-sm text-muted-foreground">
          Bütçe dönemleri, gösterge tablosu, birim ücretler ve vergi ayarları.
        </p>
      </div>

      <Alert
        variant="info"
        message="Bütçe dönemleri, birim ücretler ve vergi dilimleri buradan yönetilir. Resmi yayımlara göre güncelleyin."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Table2 className="size-4" />
            Gösterge Tablosu (Kalem Şablonları)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Birim ücretler formül ile hesaplanır: Tutar = Katsayı × Gösterge. Göstergeler bu tabloda düzenlenebilir.
          </p>
        </CardHeader>
        <CardContent>
          <IndicatorTable
            templates={templates}
            editing={editingTemplates}
            onEdit={() => setEditingTemplates(true)}
            onCancel={() => setEditingTemplates(false)}
            onSave={async (updated) => {
              if (!token) return;
              setSaving(true);
              try {
                const res = await apiFetch<LineItemTemplate[]>('/extra-lesson/line-item-templates', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ templates: updated }),
                });
                setTemplates(res);
                setEditingTemplates(false);
                toast.success('Gösterge tablosu güncellendi');
                fetchParams();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        {me?.role === 'superadmin' && params.length > 0 && (
          <>
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                setSaving(true);
                try {
                  const res = await apiFetch<{ updated: number }>('/extra-lesson/params/apply-resmi-2026', {
                    method: 'POST',
                    token,
                  });
                  toast.success(`${res.updated} parametre setinin vergi ve sözleşmeli/ücretli alanları 2026 resmi değerlerine güncellendi`);
                  fetchParams();
                } catch (e) {
                  toast.error('Güncelleme başarısız');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-600/30 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 disabled:opacity-50"
            >
              {saving ? 'Güncelleniyor…' : "Vergi Parametrelerini 2026 Resmi Değerlere Güncelle"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!token) return;
                setSaving(true);
                try {
                  const res = await apiFetch<{ updated: number }>('/extra-lesson/params/refresh-all', {
                    method: 'POST',
                    token,
                  });
                  toast.success(`${res.updated} parametre seti güncel tabloya göre yenilendi`);
                  fetchParams();
                } catch (e) {
                  toast.error('Güncelleme başarısız');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-600/30 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50 disabled:opacity-50"
            >
              {saving ? 'Güncelleniyor…' : 'Tüm Setleri Tabloya Göre Güncelle'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Yeni Dönem Ekle
        </button>
      </div>

      {params.length === 0 && !creating && !editing && (
        <EmptyState
          icon={<Calculator className="size-10" />}
          title="Henüz parametre seti yok"
          description="İlk bütçe dönemini ekleyerek başlayın. Gösterge tablosu ve parametreler tamamen sizin kontrolünüzde."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Yeni Dönem Ekle
            </button>
          }
        />
      )}

      {(creating || editing) && (
        <ParamForm
          param={editing ?? undefined}
          onSave={async (dto) => {
            if (!token) return;
            setSaving(true);
            try {
              if (editing) {
                await apiFetch(`/extra-lesson/params/${editing.id}`, {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify(dto),
                });
                toast.success('Parametre seti güncellendi');
              } else {
                await apiFetch('/extra-lesson/params', {
                  method: 'POST',
                  token,
                  body: JSON.stringify(dto),
                });
                toast.success('Parametre seti oluşturuldu');
              }
              setCreating(false);
              setEditing(null);
              fetchParams();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          saving={saving}
        />
      )}

      <div className="space-y-3">
        {params.map((p) => (
          <Card key={p.id}>
            <CardHeader
              className="cursor-pointer py-4"
              onClick={() => setExpandedId((id) => (id === p.id ? null : p.id))}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {expandedId === p.id ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  {p.title} ({p.semester_code})
                  {p.is_active && (
                    <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                      Aktif
                    </span>
                  )}
                </CardTitle>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setCreating(false);
                    }}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token || !confirm(`"${p.title}" parametre setini silmek istediğinize emin misiniz?`))
                        return;
                      try {
                        await apiFetch(`/extra-lesson/params/${p.id}`, { method: 'DELETE', token });
                        toast.success('Parametre seti silindi');
                        fetchParams();
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
              </div>
            </CardHeader>
            {expandedId === p.id && (
              <CardContent className="border-t border-border pt-4">
                <ParamSummary param={p} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Katsayılar ve göstergeler resmi yayımlara göre güncellenmelidir. Tüm veriler sizin girişinizle yönetilir.
      </p>
    </div>
  );
}

function IndicatorTable({
  templates,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
}: {
  templates: LineItemTemplate[];
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (templates: LineItemTemplate[]) => Promise<void>;
  saving: boolean;
}) {
  const [local, setLocal] = useState<LineItemTemplate[]>([]);

  useEffect(() => {
    setLocal([...templates]);
  }, [templates, editing]);

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">Gösterge tablosu yükleniyor…</p>;
  }

  const update = (idx: number, field: keyof LineItemTemplate, value: number | string | null) => {
    setLocal((prev) => {
      const next = [...prev];
      (next[idx] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Kalem</th>
              <th className="px-3 py-2 text-left font-medium">Etiket</th>
              <th className="px-3 py-2 text-right font-medium">Gösterge Gündüz</th>
              <th className="px-3 py-2 text-right font-medium">Gösterge Gece</th>
              <th className="px-3 py-2 text-right font-medium w-16">Sıra</th>
            </tr>
          </thead>
          <tbody>
            {(editing ? local : templates).map((t, idx) => (
              <tr key={t.key} className="border-b border-border/50">
                <td className="px-3 py-2 font-mono text-muted-foreground">{t.key}</td>
                <td className="px-3 py-2">
                  {editing ? (
                    <input
                      type="text"
                      value={local[idx]?.label ?? ''}
                      onChange={(e) => update(idx, 'label', e.target.value)}
                      className="w-full max-w-[240px] rounded border border-input bg-background px-2 py-1 text-sm"
                    />
                  ) : (
                    t.label
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editing ? (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={local[idx]?.indicator_day ?? ''}
                      onChange={(e) => update(idx, 'indicator_day', e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-20 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    t.indicator_day
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editing ? (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="—"
                      value={local[idx]?.indicator_night ?? ''}
                      onChange={(e) =>
                        update(idx, 'indicator_night', e.target.value ? parseFloat(e.target.value) : null)
                      }
                      className="w-20 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                    />
                  ) : t.indicator_night != null ? (
                    t.indicator_night
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      value={local[idx]?.sort_order ?? 0}
                      onChange={(e) => update(idx, 'sort_order', parseInt(e.target.value, 10) || 0)}
                      className="w-14 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    t.sort_order
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => onSave(local)}
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
          >
            <Pencil className="size-4" />
            Düzenle
          </button>
        )}
      </div>
    </div>
  );
}

function ParamSummary({ param }: { param: ExtraLessonParam }) {
  return (
    <div className="space-y-4 text-sm">
      {(param.monthly_coefficient || param.indicator_day || param.indicator_night) && (
        <div className="grid gap-4 sm:grid-cols-4">
          {param.monthly_coefficient && (
            <div>
              <span className="text-muted-foreground">Katsayı:</span>{' '}
              {parseFloat(param.monthly_coefficient).toLocaleString('tr-TR')}
            </div>
          )}
          {param.indicator_day != null && (
            <div>
              <span className="text-muted-foreground">Gündüz göstergesi:</span> {param.indicator_day}
            </div>
          )}
          {param.indicator_night != null && (
            <div>
              <span className="text-muted-foreground">Gece göstergesi:</span> {param.indicator_night}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">GV İstisna max (vergi tutarı):</span>{' '}
          {parseFloat(param.gv_exemption_max).toLocaleString('tr-TR')} TL
        </div>
        <div>
          <span className="text-muted-foreground">DV İstisna matrah max (brüt):</span>{' '}
          {parseFloat(param.dv_exemption_max).toLocaleString('tr-TR')} TL
        </div>
        <div>
          <span className="text-muted-foreground">Damga vergisi oranı:</span> ‰{param.stamp_duty_rate}{' '}
          <span className="text-muted-foreground">(binde)</span>
        </div>
        {param.sgk_employee_rate != null && (
          <div>
            <span className="text-muted-foreground">SGK işçi payı (sözleşmeli/ücretli):</span> %{param.sgk_employee_rate}
          </div>
        )}
        {param.ucretli_unit_scale != null && (
          <div>
            <span className="text-muted-foreground">Ücretli birim ücret oranı:</span> {(parseFloat(param.ucretli_unit_scale) * 100).toFixed(2)}%
          </div>
        )}
      </div>
      {param.education_levels && param.education_levels.length > 0 && (
        <div>
          <span className="font-medium">Öğrenim durumu birim ücretleri:</span>
          <ul className="mt-1 flex flex-wrap gap-2">
            {param.education_levels.map((el) => (
              <li key={el.key} className="rounded bg-muted px-2 py-0.5 text-xs">
                {el.label}: {parseFloat(String(el.unit_day)).toLocaleString('tr-TR')} / {parseFloat(String(el.unit_night)).toLocaleString('tr-TR')} TL
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <span className="font-medium">Kalemler ({param.line_items.length} adet, brüt):</span>
        <ul className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2">
          {param.line_items.map((li) => (
            <li key={li.key} className="flex justify-between gap-4 py-0.5">
              <span>{li.label}</span>
              <span className="text-muted-foreground">
                {li.type === 'fixed'
                  ? `${li.fixed_amount ?? 0} TL brüt (sabit)`
                  : `${li.unit_price ?? li.unit_price_day ?? 0} TL brüt/saat`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <span className="font-medium">Vergi dilimleri (brüt matrah sınırları):</span>
        <ul className="mt-1 flex flex-wrap gap-2">
          {param.tax_brackets.map((tb, i) => (
            <li key={i} className="rounded bg-muted px-2 py-0.5">
              ≤{tb.max_matrah.toLocaleString('tr-TR')} TL: %{tb.rate_percent}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type ParamFormProps = {
  param?: ExtraLessonParam;
  onSave: (dto: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

function recomputeFromFormula(items: LineItem[], coeff: number, indDay: number, indNight: number): LineItem[] {
  return items.map((li) => {
    if (li.type === 'fixed') return li;
    const mult = li.multiplier ?? 1;
    const day = r(coeff * indDay * mult);
    const night = r(coeff * indNight * mult);
    const hasBothRates = li.unit_price_day != null && li.unit_price_night != null;
    if (hasBothRates) return { ...li, unit_price_day: day, unit_price_night: night, unit_price: undefined };
    const useNight = li.indicator === 150 || li.unit_price === li.unit_price_night || li.key.endsWith('_gece') || li.key === 'gece';
    if (useNight) return { ...li, unit_price: night, unit_price_day: undefined, unit_price_night: undefined };
    return { ...li, unit_price: day, unit_price_day: undefined, unit_price_night: undefined };
  });
}

function ParamForm({ param, onSave, onCancel, saving }: ParamFormProps) {
  const [semesterCode, setSemesterCode] = useState(param?.semester_code ?? '2026-1');
  const [title, setTitle] = useState(param?.title ?? '2026 Ocak-Haziran (%18,6)');
  const [coeff, setCoeff] = useState(param?.monthly_coefficient ? parseFloat(param.monthly_coefficient) : COEFF_DEFAULT);
  const [indDay, setIndDay] = useState(param?.indicator_day ?? IND_DAY);
  const [indNight, setIndNight] = useState(param?.indicator_night ?? IND_NIGHT);
  const [gvMax, setGvMax] = useState(param ? parseFloat(param.gv_exemption_max) : 4211.33);
  const [dvMax, setDvMax] = useState(param ? parseFloat(param.dv_exemption_max) : 33030);
  const [stampRate, setStampRate] = useState(param ? parseFloat(param.stamp_duty_rate) : 7.59);
  const [sgkRate, setSgkRate] = useState(param?.sgk_employee_rate ? parseFloat(param.sgk_employee_rate) : 14);
  const [ucretliScale, setUcretliScale] = useState(param?.ucretli_unit_scale ? parseFloat(param.ucretli_unit_scale) : 1);
  const [isActive, setIsActive] = useState(param?.is_active ?? true);
  const [lineItems, setLineItems] = useState<LineItem[]>(param?.line_items ?? DEFAULT_LINE_ITEMS);
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>(param?.tax_brackets ?? DEFAULT_TAX_BRACKETS);
  const [centralExam, setCentralExam] = useState<CentralExamRole[]>(
    param?.central_exam_roles ?? DEFAULT_CENTRAL_EXAM
  );
  const [educationLevels, setEducationLevels] = useState<EducationLevelRow[]>(() => {
    if (!param?.education_levels?.length) return DEFAULT_EDUCATION_LEVELS;
    return param.education_levels.map((el) => ({
      key: el.key,
      label: el.label,
      unit_day: typeof el.unit_day === 'number' ? el.unit_day : parseFloat(String(el.unit_day)) || 0,
      unit_night: typeof el.unit_night === 'number' ? el.unit_night : parseFloat(String(el.unit_night)) || 0,
    }));
  });
  const [useDefaults, setUseDefaults] = useState(!param);

  const handleRecompute = () => {
    setLineItems(recomputeFromFormula(lineItems, coeff, indDay, indNight));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      semester_code: semesterCode,
      title,
      monthly_coefficient: coeff,
      indicator_day: indDay,
      indicator_night: indNight,
      gv_exemption_max: gvMax,
      dv_exemption_max: dvMax,
      stamp_duty_rate: stampRate,
      sgk_employee_rate: sgkRate,
      ucretli_unit_scale: ucretliScale,
      is_active: isActive,
      line_items: lineItems,
      tax_brackets: taxBrackets,
      central_exam_roles: centralExam,
      education_levels: educationLevels,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{param ? 'Parametre Setini Düzenle' : 'Yeni Parametre Seti'}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bütçe dönemi, kalemler ve vergi ayarları. Formül: Katsayı×140 (gündüz), ×150 (gece). Nöbet/belleticilik/sınav: gündüz tarifesi. Takviye 2×, özel eğitim 1,25×.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Dönem kodu</label>
              <input
                type="text"
                value={semesterCode}
                onChange={(e) => setSemesterCode(e.target.value)}
                placeholder="2026-1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Başlık</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="2026 Ocak-Haziran (%18,6)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="rounded border border-border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium">Formül: Brüt birim ücret = Katsayı × Gösterge × Çarpan</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Tüm hesaplamalar brüt tutarlar üzerinden yapılır. Kalemler brüt TL/saat, vergi dilimleri brüt matrah sınırlarıdır.
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Aylık katsayı</label>
                <input
                  type="number"
                  step="0.000001"
                  value={coeff}
                  onChange={(e) => setCoeff(parseFloat(e.target.value) || COEFF_DEFAULT)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Gündüz göstergesi</label>
                <input
                  type="number"
                  value={indDay}
                  onChange={(e) => setIndDay(parseInt(e.target.value, 10) || IND_DAY)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Gece göstergesi</label>
                <input
                  type="number"
                  value={indNight}
                  onChange={(e) => setIndNight(parseInt(e.target.value, 10) || IND_NIGHT)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleRecompute}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted/50"
                >
                  Formülden hesapla
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">GV İstisna max (vergi tutarı, TL)</label>
              <input
                type="number"
                step="0.01"
                value={gvMax}
                onChange={(e) => setGvMax(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Brüt üzerinden hesaplanan GV&#39;den muaf tutulacak max vergi tutarı.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">DV İstisna matrah max (brüt, TL)</label>
              <input
                type="number"
                step="0.01"
                value={dvMax}
                onChange={(e) => setDvMax(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">Damga vergisinden muaf brüt matrah limiti (örn. brüt asgari ücret).</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Damga vergisi oranı (‰ binde)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={stampRate}
                onChange={(e) => setStampRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ücret bordrosu için 2026 resmi oran: binde 7,59 (‰7,59). Değer binde (per-mille) olarak saklanır.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">SGK işçi payı (sözleşmeli/ücretli, %)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={sgkRate}
                onChange={(e) => setSgkRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Sözleşmeli ve ücretli öğretmenler için SGK+İşsizlik işçi payı (5510). Kadrolu: kesinti yok. 2026: %14.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ücretli birim ücret oranı (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min={0}
                max={1}
                value={ucretliScale}
                onChange={(e) => setUcretliScale(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ücretli öğretmen birim ücreti kadroluya göre.               1 = kadrolu ile aynı. 0,725 = MEB %72,5 tarifesi.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Öğrenim durumu birim ücretleri (TL/saat, brüt)</p>
            <p className="text-xs text-muted-foreground">
              Kadrolu/sözleşmeli için Lisans, Y.Lisans, Doktora farklı birim ücret uygular. Hesaplama bu değerlere göre ölçeklenir.
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Öğrenim</th>
                    <th className="px-3 py-2 text-right font-medium">Gündüz</th>
                    <th className="px-3 py-2 text-right font-medium">Gece</th>
                  </tr>
                </thead>
                <tbody>
                  {educationLevels.map((el, idx) => (
                    <tr key={el.key} className="border-b border-border/50">
                      <td className="px-3 py-2">{el.label}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={el.unit_day}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setEducationLevels((prev) => {
                              const next = [...prev];
                              (next[idx] as EducationLevelRow).unit_day = v;
                              return next;
                            });
                          }}
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={el.unit_night}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setEducationLevels((prev) => {
                              const next = [...prev];
                              (next[idx] as EducationLevelRow).unit_night = v;
                              return next;
                            });
                          }}
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Aktif (öğretmenler bu seti kullanabilsin)</span>
          </label>

          {!param && (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={useDefaults}
                onChange={(e) => {
                  setUseDefaults(e.target.checked);
                  if (e.target.checked) {
                    setLineItems(DEFAULT_LINE_ITEMS);
                    setTaxBrackets(DEFAULT_TAX_BRACKETS);
                    setCentralExam(DEFAULT_CENTRAL_EXAM);
                    setEducationLevels(DEFAULT_EDUCATION_LEVELS);
                    setCoeff(COEFF_DEFAULT);
                    setIndDay(IND_DAY);
                    setIndNight(IND_NIGHT);
                  }
                }}
                className="size-4 rounded border-border"
              />
              <span className="text-sm font-medium">Varsayılan kalemleri kullan</span>
            </label>
          )}

          <details className="rounded border border-border p-4">
            <summary className="cursor-pointer font-medium">Kalemler ({lineItems.length}) – Brüt birim ücretler</summary>
            <div className="mt-4 space-y-2">
              {lineItems.map((li) => (
                <div key={li.key} className="flex flex-wrap items-center gap-2 rounded bg-muted/50 p-2">
                  <span className="font-mono text-xs">{li.key}</span>
                  <span>{li.label}</span>
                  {li.type === 'hourly' && (
                    <>
                      {li.unit_price != null ? (
                        <span className="text-muted-foreground">{li.unit_price} TL brüt/saat</span>
                      ) : (
                        <>
                          <span>Gündüz: {li.unit_price_day ?? 0} TL brüt/saat</span>
                          <span>Gece: {li.unit_price_night ?? 0} TL brüt/saat</span>
                        </>
                      )}
                    </>
                  )}
                  {li.type === 'fixed' && <span>{li.fixed_amount ?? 0} TL brüt sabit</span>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Kalem düzenleme ileride genişletilecek. Şimdilik varsayılan set veya mevcut değerler kullanılır.
            </p>
          </details>

          <div className="rounded border border-border p-4">
            <p className="mb-3 text-sm font-medium">Merkezi Sınav Rolleri – Gösterge Tablosu</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Brüt = Katsayı × Gösterge (yukarıdaki aylık katsayı). Gösterge girilen roller otomatik hesaplanır. Sabit TL sütunu gerekirse manuel tutar girişi için.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium">Rol</th>
                    <th className="px-3 py-2 text-left font-medium">Etiket</th>
                    <th className="px-3 py-2 text-right font-medium">Gösterge (K×G=TL)</th>
                    <th className="px-3 py-2 text-right font-medium">Sabit TL (opsiyonel)</th>
                  </tr>
                </thead>
                <tbody>
                  {centralExam.map((r, idx) => (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{r.key}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={r.label}
                          onChange={(e) => {
                            const next = [...centralExam];
                            (next[idx] as CentralExamRole).label = e.target.value;
                            setCentralExam(next);
                          }}
                          className="w-full max-w-[200px] rounded border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          placeholder="—"
                          value={r.indicator ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            setCentralExam((prev) => {
                              const next = [...prev];
                              const role = { ...next[idx] } as CentralExamRole;
                              if (val != null && !isNaN(val)) {
                                role.indicator = val;
                                role.fixed_amount = undefined;
                              } else {
                                role.indicator = undefined;
                              }
                              next[idx] = role;
                              return next;
                            });
                          }}
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="—"
                          value={r.fixed_amount ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            setCentralExam((prev) => {
                              const next = [...prev];
                              const role = { ...next[idx] } as CentralExamRole;
                              if (val != null && !isNaN(val)) {
                                role.fixed_amount = val;
                                role.indicator = undefined;
                              } else {
                                role.fixed_amount = undefined;
                              }
                              next[idx] = role;
                              return next;
                            });
                          }}
                          className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : param ? 'Güncelle' : 'Oluştur'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/50"
            >
              İptal
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
