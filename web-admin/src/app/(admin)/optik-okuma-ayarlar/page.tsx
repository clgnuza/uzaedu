'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  ScanLine,
  Settings,
  Cpu,
  Eye,
  Award,
  Gauge,
  Download,
  FileText,
  ListChecks,
  BarChart3,
  School,
  Map,
  DollarSign,
  KeyRound,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Thermometer,
  Info,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OptikConfig = {
  module_enabled: boolean;
  default_language: 'tr' | 'en';
  openai_api_key: string | null;
  openai_model: string;
  openai_temperature: number;
  ocr_provider: string;
  ocr_google_project_id: string | null;
  ocr_google_credentials: string | null;
  ocr_google_location: string | null;
  ocr_google_processor_id: string | null;
  ocr_azure_endpoint: string | null;
  ocr_azure_api_key: string | null;
  ocr_azure_model: string | null;
  ocr_timeout_seconds: number | null;
  ocr_retry_count: number | null;
  ocr_language_hint: 'tr' | 'en' | null;
  confidence_threshold: number;
  grade_modes: string[];
  daily_limit_per_user: number | null;
  key_text_cache_ttl_hours: number;
};

type FormTemplate = {
  id: string;
  name: string;
  slug: string;
  formType: string;
  questionCount: number;
  choiceCount: number;
  pageSize: string;
  examType?: string;
  gradeLevel?: string | null;
  subjectHint?: string | null;
  scope?: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

const EXAM_TYPES = [
  { value: 'genel', label: 'Genel' },
  { value: 'yazili', label: 'Yazılı' },
  { value: 'deneme', label: 'Deneme' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'karma', label: 'Karma' },
] as const;

const FORM_PRESETS = [
  { name: 'Yazılı (15+3 karma)', slug: 'yazili-15-3', formType: 'multiple_choice' as const, questionCount: 18, choiceCount: 4, examType: 'yazili', gradeLevel: '6-12', subjectHint: 'Genel' },
  { name: 'LGS (90 soru, 6 ders)', slug: 'lgs-20-4', formType: 'multiple_choice' as const, questionCount: 90, choiceCount: 4, examType: 'deneme', gradeLevel: 'LGS', subjectHint: null },
  { name: 'YKS TYT (120 soru, 4 test)', slug: 'yks-tyt-120', formType: 'multiple_choice' as const, questionCount: 120, choiceCount: 4, examType: 'deneme', gradeLevel: 'YKS', subjectHint: null },
  { name: 'YKS Tek Ders (40 soru, 5 şık)', slug: 'yks-40-5', formType: 'multiple_choice' as const, questionCount: 40, choiceCount: 5, examType: 'deneme', gradeLevel: 'YKS', subjectHint: null },
  { name: 'Quiz (10 soru, 4 şık)', slug: 'quiz-10-4', formType: 'multiple_choice' as const, questionCount: 10, choiceCount: 4, examType: 'quiz', gradeLevel: null, subjectHint: null },
];

type RubricTemplate = {
  id: string;
  slug: string;
  name: string;
  mode: string;
  subject: string | null;
  criteria: Array<{ criterion: string; max_points: number; weight?: number }>;
  sortOrder: number;
  isActive: boolean;
};

const RUBRIC_MODES: Array<{ value: string; label: string; desc: string }> = [
  { value: 'CONTENT', label: 'İçerik', desc: 'Konuya uygunluk, bilgi doğruluğu (Sosyal, Fen, Edebiyat)' },
  { value: 'LANGUAGE', label: 'Dil', desc: 'Yazım, noktalama, anlaşılırlık' },
  { value: 'CONTENT_LANGUAGE', label: 'İçerik + Dil', desc: 'Hem bilgi hem dil birlikte' },
  { value: 'MATH_FINAL', label: 'Matematik – Sonuç', desc: 'Sadece doğru cevap puanlanır' },
  { value: 'MATH_STEPS', label: 'Matematik – Adımlar', desc: 'Çözüm adımlarına göre kısmi puan' },
];

const RUBRIC_PRESETS: Array<{
  name: string;
  slug: string;
  mode: string;
  subject: string;
  criteria: Array<{ criterion: string; max_points: number; weight?: number }>;
}> = [
  {
    name: 'İçerik (Sosyal, Fen, Edebiyat)',
    slug: 'content-genel',
    mode: 'CONTENT',
    subject: '',
    criteria: [
      { criterion: 'Konuya uygunluk', max_points: 4 },
      { criterion: 'Bilgi doğruluğu', max_points: 4 },
      { criterion: 'Örnekler ve açıklama', max_points: 2 },
    ],
  },
  {
    name: 'Dil (Yazım ve anlaşılırlık)',
    slug: 'language-genel',
    mode: 'LANGUAGE',
    subject: '',
    criteria: [
      { criterion: 'Yazım kuralları', max_points: 3 },
      { criterion: 'Cümle yapısı ve noktalama', max_points: 3 },
      { criterion: 'Anlaşılırlık ve akıcılık', max_points: 4 },
    ],
  },
  {
    name: 'Matematik – Adım adım (kısmi puan)',
    slug: 'math-steps-genel',
    mode: 'MATH_STEPS',
    subject: 'Matematik',
    criteria: [
      { criterion: 'Doğru çözüm yolu', max_points: 5 },
      { criterion: 'Ara adımların doğruluğu', max_points: 3 },
      { criterion: 'Sonuç doğruluğu', max_points: 2 },
    ],
  },
  {
    name: 'Matematik – Sadece sonuç',
    slug: 'math-final-genel',
    mode: 'MATH_FINAL',
    subject: 'Matematik',
    criteria: [{ criterion: 'Sonuç doğruluğu', max_points: 10 }],
  },
];

type UsageStats = {
  totalOcr: number;
  totalGrade: number;
  byDay: Array<{ date: string; ocr: number; grade: number }>;
  bySchool: Array<{ school_id: string; school_name: string; ocr: number; grade: number }>;
};

const TABS = [
  { id: 'genel', label: 'Genel', icon: Settings },
  { id: 'ai', label: 'AI / GPT', icon: Cpu },
  { id: 'ocr', label: 'OCR', icon: Eye },
  { id: 'puanlama', label: 'Puanlama', icon: Award },
  { id: 'limitler', label: 'Limitler', icon: Gauge },
  { id: 'form-sablonlari', label: 'Form Şablonları', icon: FileText },
  { id: 'rubrik-sablonlari', label: 'Rubrik Şablonları', icon: ListChecks },
  { id: 'kullanim', label: 'Kullanım İstatistikleri', icon: BarChart3 },
  { id: 'e-okul', label: 'e-Okul Yol Haritası', icon: Map },
  { id: 'maliyet', label: 'Maliyet Özeti', icon: DollarSign },
] as const;

const emptyFormData = () => ({
  name: '',
  slug: '',
  formType: 'multiple_choice',
  questionCount: 20,
  choiceCount: 5,
  pageSize: 'A4',
  examType: 'genel',
  gradeLevel: '' as string | null,
  subjectHint: '' as string | null,
  description: '',
  isActive: true,
});

function FormSablonlariTab({ token }: { token: string }) {
  const [items, setItems] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [examFilter, setExamFilter] = useState<string>('');
  const [formData, setFormData] = useState(emptyFormData);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiFetch<FormTemplate[]>('/optik/admin/form-templates', { token });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const payload = {
    ...formData,
    gradeLevel: formData.gradeLevel?.trim() || null,
    subjectHint: formData.subjectHint?.trim() || null,
  };
  const handleSave = async () => {
    try {
      if (editing) {
        await apiFetch(`/optik/admin/form-templates/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
        toast.success('Form şablonu güncellendi');
      } else {
        await apiFetch('/optik/admin/form-templates', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        toast.success('Form şablonu eklendi');
      }
      setModalOpen(false);
      setEditing(null);
      setFormData(emptyFormData());
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const handleDownloadPdf = async (item: FormTemplate, prependBlank = 0) => {
    setDownloadingId(item.id);
    try {
      const qs = prependBlank > 0 ? `?prepend_blank=${prependBlank}` : '';
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const fetchOpts =
        Object.keys(headers).length > 0
          ? { credentials: 'include' as const, headers }
          : { credentials: 'include' as const };
      // Superadmin: once admin endpoint, 404 ise ana endpoint (superadmin her ikisine erisir)
      let res = await fetch(getApiUrl(`/optik/admin/form-templates/${item.id}/pdf${qs}`), fetchOpts);
      if (res.status === 404) {
        res = await fetch(getApiUrl(`/optik/form-templates/${item.id}/pdf${qs}`), fetchOpts);
      }
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = prependBlank > 0 ? `${item.slug || item.id}-yazili-form.pdf` : `${item.slug || item.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(prependBlank > 0 ? 'Yazılı + Form PDF indirildi' : 'PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF indirilemedi');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu form şablonunu silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/optik/admin/form-templates/${id}`, { method: 'DELETE', token });
      toast.success('Silindi');
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const openEdit = (item: FormTemplate) => {
    setEditing(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      formType: item.formType,
      questionCount: item.questionCount,
      choiceCount: item.choiceCount,
      pageSize: item.pageSize ?? 'A4',
      examType: item.examType ?? 'genel',
      gradeLevel: item.gradeLevel ?? '',
      subjectHint: item.subjectHint ?? '',
      description: item.description ?? '',
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const applyPreset = (preset: (typeof FORM_PRESETS)[number]) => {
    setEditing(null);
    setFormData({
      ...emptyFormData(),
      name: preset.name,
      slug: preset.slug,
      formType: preset.formType,
      questionCount: preset.questionCount,
      choiceCount: preset.choiceCount,
      examType: preset.examType,
      gradeLevel: preset.gradeLevel ?? '',
      subjectHint: preset.subjectHint ?? '',
    });
    setModalOpen(true);
  };

  const filteredItems = examFilter
    ? items.filter((i) => (i.examType ?? 'genel') === examFilter)
    : items;

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  if (loading) return <LoadingSpinner className="mx-auto my-8 size-8" />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Form Şablonları</CardTitle>
          <p className="text-sm text-muted-foreground">Yazılı, deneme, quiz vb. okul sınav türleri için optik form şablonları</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORM_PRESETS.map((p) => (
            <Button key={p.slug} size="sm" variant="outline" onClick={() => applyPreset(p)}>
              + {p.name}
            </Button>
          ))}
          <Button size="sm" onClick={() => { setEditing(null); setFormData(emptyFormData()); setModalOpen(true); }}>
            + Özel Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Label className="text-sm">Sınav türü:</Label>
          <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
            <option value="">Tümü</option>
            {EXAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="table-x-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Ad</th>
                <th className="p-2 text-left">Slug</th>
                <th className="p-2 text-left">Kaynak</th>
                <th className="p-2 text-left">Sınav türü</th>
                <th className="p-2 text-left">Tip</th>
                <th className="p-2 text-right">Soru</th>
                <th className="p-2 text-right">Şık</th>
                <th className="p-2">Durum</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="p-2">{item.name}</td>
                  <td className="p-2 font-mono text-xs">{item.slug}</td>
                  <td className="p-2 text-muted-foreground">{(item.scope === 'system' && 'Sistem') || (item.scope === 'school' && 'Okul') || (item.scope === 'teacher' && 'Öğretmen') || '-'}</td>
                  <td className="p-2">{EXAM_TYPES.find((t) => t.value === (item.examType ?? 'genel'))?.label ?? item.examType ?? '-'}</td>
                  <td className="p-2">{item.formType}</td>
                  <td className="p-2 text-right">{item.questionCount}</td>
                  <td className="p-2 text-right">{item.choiceCount}</td>
                  <td className="p-2">{item.isActive ? 'Aktif' : 'Pasif'}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!downloadingId}
                        onClick={() => handleDownloadPdf(item)}
                        title="PDF indir"
                      >
                        {downloadingId === item.id ? <LoadingSpinner className="size-4" /> : <Download className="size-4" />}
                        <span className="ml-1">PDF</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!downloadingId}
                        onClick={() => handleDownloadPdf(item, 1)}
                        title="Yazılı + Form (boş sayfa + optik form)"
                      >
                        Yazılı+Form
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>Düzenle</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(item.id)}>Sil</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            {filteredItems.length === 0 && <p className="py-6 text-center text-muted-foreground">Henüz form şablonu yok.{examFilter ? ' Bu filtreden eşleşen yok.' : ''}</p>}
        </div>
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setModalOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-4 font-semibold">{editing ? 'Şablon Düzenle' : 'Yeni Form Şablonu'}</h3>
              <div className="space-y-3">
                <input placeholder="Ad" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} className="w-full rounded border border-border px-3 py-2 text-sm" />
                <input placeholder="Slug (ör: meb-20-5)" value={formData.slug} onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value }))} className="w-full rounded border border-border px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Sınav türü</Label>
                    <select value={formData.examType} onChange={(e) => setFormData((f) => ({ ...f, examType: e.target.value }))} className="mt-0.5 w-full rounded border border-border px-3 py-2 text-sm">
                      {EXAM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sınıf / Seviye</Label>
                    <input placeholder="6-12, LGS, YKS" value={formData.gradeLevel ?? ''} onChange={(e) => setFormData((f) => ({ ...f, gradeLevel: e.target.value || null }))} className="mt-0.5 w-full rounded border border-border px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ders ipucu (opsiyonel)</Label>
                  <input placeholder="Matematik, Türkçe..." value={formData.subjectHint ?? ''} onChange={(e) => setFormData((f) => ({ ...f, subjectHint: e.target.value || null }))} className="mt-0.5 w-full rounded border border-border px-3 py-2 text-sm" />
                </div>
                <select value={formData.formType} onChange={(e) => setFormData((f) => ({ ...f, formType: e.target.value }))} className="w-full rounded border border-border px-3 py-2 text-sm">
                  <option value="multiple_choice">Çoktan Seçmeli</option>
                  <option value="open_ended">Açık Uçlu</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Soru sayısı" value={formData.questionCount} onChange={(e) => setFormData((f) => ({ ...f, questionCount: parseInt(e.target.value, 10) || 0 }))} className="rounded border border-border px-3 py-2 text-sm" />
                  <input type="number" placeholder="Şık sayısı" value={formData.choiceCount} onChange={(e) => setFormData((f) => ({ ...f, choiceCount: parseInt(e.target.value, 10) || 0 }))} className="rounded border border-border px-3 py-2 text-sm" />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))} />
                  <span className="text-sm">Aktif</span>
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>İptal</Button>
                <Button onClick={handleSave}>Kaydet</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const emptyRubricFormData = () => ({
  slug: '',
  name: '',
  mode: 'CONTENT',
  subject: '',
  isActive: true,
  criteria: [] as Array<{ criterion: string; max_points: number; weight?: number }>,
});

function RubrikSablonlariTab({ token }: { token: string }) {
  const [items, setItems] = useState<RubricTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RubricTemplate | null>(null);
  const [formData, setFormData] = useState(emptyRubricFormData());

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiFetch<RubricTemplate[]>('/optik/admin/rubric-templates', { token });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.slug?.trim()) {
      toast.error('Şablon adı ve kısa kod zorunludur');
      return;
    }
    try {
      const payload = {
        ...formData,
        subject: formData.subject?.trim() || undefined,
        criteria: formData.criteria.filter((c) => c.criterion?.trim()).map((c) => ({
          criterion: c.criterion.trim(),
          max_points: Math.max(0, c.max_points),
          weight: c.weight,
        })),
      };
      if (editing) {
        await apiFetch(`/optik/admin/rubric-templates/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
        toast.success('Rubrik şablonu güncellendi');
      } else {
        await apiFetch('/optik/admin/rubric-templates', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        toast.success('Rubrik şablonu eklendi');
      }
      setModalOpen(false);
      setEditing(null);
      setFormData(emptyRubricFormData());
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu rubrik şablonunu silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/optik/admin/rubric-templates/${id}`, { method: 'DELETE', token });
      toast.success('Silindi');
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const openEdit = (item: RubricTemplate) => {
    setEditing(item);
    setFormData({
      slug: item.slug,
      name: item.name,
      mode: item.mode,
      subject: item.subject ?? '',
      isActive: item.isActive,
      criteria: (item.criteria?.length ? item.criteria : [{ criterion: '', max_points: 5 }]).map((c) => ({
        criterion: c.criterion,
        max_points: c.max_points ?? 5,
        weight: c.weight,
      })),
    });
    setModalOpen(true);
  };

  const applyPreset = (preset: (typeof RUBRIC_PRESETS)[number]) => {
    setEditing(null);
    setFormData({
      slug: preset.slug,
      name: preset.name,
      mode: preset.mode,
      subject: preset.subject,
      isActive: true,
      criteria: [...preset.criteria],
    });
    setModalOpen(true);
  };

  const addCriterion = () => {
    setFormData((f) => ({
      ...f,
      criteria: [...f.criteria, { criterion: '', max_points: 5 }],
    }));
  };

  const updateCriterion = (idx: number, field: 'criterion' | 'max_points', value: string | number) => {
    setFormData((f) => ({
      ...f,
      criteria: f.criteria.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const removeCriterion = (idx: number) => {
    setFormData((f) => ({
      ...f,
      criteria: f.criteria.filter((_, i) => i !== idx),
    }));
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  if (loading) return <LoadingSpinner className="mx-auto my-8 size-8" />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Rubrik Şablonları</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Açık uçlu sorularda GPT, öğrenci cevabını bu kriterlere göre puanlar. Önce bir örnek yükleyin veya kendiniz oluşturun.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Örnek yükle (hazır şablon):</p>
          <div className="flex flex-wrap gap-2">
            {RUBRIC_PRESETS.map((p) => (
              <Button
                key={p.slug}
                size="sm"
                variant="outline"
                onClick={() => applyPreset(p)}
                title={p.name}
              >
                <Upload className="mr-1.5 size-3.5" />
                {p.name}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setFormData(emptyRubricFormData());
              setModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 size-3.5" />
            Sıfırdan özel şablon ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-x-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Şablon adı</th>
                <th className="p-2 text-left">Kısa kod</th>
                <th className="p-2 text-left">Puanlama türü</th>
                <th className="p-2 text-left">Ders</th>
                <th className="p-2 text-center">Kriter sayısı</th>
                <th className="p-2">Durum</th>
                <th className="p-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2 font-medium">{item.name}</td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">{item.slug}</td>
                  <td className="p-2">
                    <span title={RUBRIC_MODES.find((m) => m.value === item.mode)?.desc} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {RUBRIC_MODES.find((m) => m.value === item.mode)?.label ?? item.mode}
                    </span>
                  </td>
                  <td className="p-2">{item.subject ?? '-'}</td>
                  <td className="p-2 text-center">{item.criteria?.length ?? 0}</td>
                  <td className="p-2">{item.isActive ? 'Aktif' : 'Pasif'}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        Düzenle
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="py-12 text-center">
              <ListChecks className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">Henüz rubrik şablonu yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                &quot;Örnek yükle&quot; butonlarından birine tıklayıp hazır şablonu düzenleyerek kaydedin veya sıfırdan oluşturun.
              </p>
            </div>
          )}
        </div>
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setModalOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold">{editing ? 'Şablonu düzenle' : 'Yeni rubrik şablonu'}</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Şablon adı</Label>
                  <Input
                    placeholder="örn: Sosyal bilgiler açık uçlu"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Kısa kod</Label>
                  <Input
                    placeholder="örn: sosyal-acik-uclu (benzersiz, tire ile)"
                    value={formData.slug}
                    onChange={(e) => setFormData((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Puanlama türü</Label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData((f) => ({ ...f, mode: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {RUBRIC_MODES.map((m) => (
                      <option key={m.value} value={m.value} title={m.desc}>
                        {m.label} – {m.desc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ders (opsiyonel)</Label>
                  <Input
                    placeholder="örn: Matematik, Türkçe"
                    value={formData.subject}
                    onChange={(e) => setFormData((f) => ({ ...f, subject: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Puanlama kriterleri
                      <span className="ml-1 font-normal text-muted-foreground">(GPT bunlara göre puan verir)</span>
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
                      <Plus className="mr-1 size-3" />
                      Ekle
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.criteria.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="örn: Konuya uygunluk"
                          value={c.criterion}
                          onChange={(e) => updateCriterion(i, 'criterion', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          placeholder="Max"
                          value={c.max_points}
                          onChange={(e) => updateCriterion(i, 'max_points', parseInt(e.target.value, 10) || 0)}
                          className="w-20"
                          title="Bu kriterden alınabilecek en yüksek puan"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          onClick={() => removeCriterion(i)}
                          title="Kriteri sil"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {formData.criteria.length === 0 && (
                      <p className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 py-3 text-center text-sm text-muted-foreground">
                        Henüz kriter yok. &quot;Ekle&quot; ile kriter tanımlayın.
                      </p>
                    )}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span className="text-sm">Aktif (sınavlarda kullanılabilir)</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  İptal
                </Button>
                <Button onClick={handleSave}>Kaydet</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DATE_PRESETS = [
  { label: 'Son 7 gün', days: 7 },
  { label: 'Son 30 gün', days: 30 },
  { label: 'Bu ay', days: -1 },
] as const;

function formatDateTr(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function KullanimTab({ token }: { token: string }) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UsageStats>(`/optik/admin/usage-stats?from=${from}&to=${to}`, { token });
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = days < 0
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  const hasData = stats && (stats.totalOcr > 0 || stats.totalGrade > 0);

  if (loading && !stats) return <LoadingSpinner className="mx-auto my-8 size-8" />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Kullanım İstatistikleri</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Optik form okutma (OCR) ve açık uçlu puanlama isteklerinin sayısı. Tarih aralığı seçip inceleyebilirsiniz.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tarih aralığı</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => applyPreset(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? <LoadingSpinner className="mr-2 size-4" /> : null}
            Yenile
          </Button>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Form okutma (OCR)</p>
                <p className="mt-1 text-xl font-semibold sm:text-2xl">{stats.totalOcr}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Optik form tarama sayısı</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Açık uçlu puanlama</p>
                <p className="mt-1 text-xl font-semibold sm:text-2xl">{stats.totalGrade}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">GPT ile puanlanan cevap sayısı</p>
              </div>
            </div>

            {!hasData && (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 py-10 text-center">
                <BarChart3 className="mx-auto mb-2 size-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Bu dönemde kullanım yok</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seçilen tarih aralığında form okutma veya puanlama kaydı bulunamadı.
                </p>
              </div>
            )}

            {hasData && stats.byDay.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Günlük dağılım</h4>
                <div className="table-x-scroll rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="p-2.5 text-left font-medium">Tarih</th>
                        <th className="p-2.5 text-right font-medium">Form okutma</th>
                        <th className="p-2.5 text-right font-medium">Puanlama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.byDay].reverse().map((row) => (
                        <tr key={row.date} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2.5">{formatDateTr(row.date)}</td>
                          <td className="p-2.5 text-right tabular-nums">{row.ocr}</td>
                          <td className="p-2.5 text-right tabular-nums">{row.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hasData && stats.bySchool.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Okul bazlı</h4>
                <div className="table-x-scroll rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="p-2.5 text-left font-medium">Okul</th>
                        <th className="p-2.5 text-right font-medium">Form okutma</th>
                        <th className="p-2.5 text-right font-medium">Puanlama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bySchool
                        .sort((a, b) => (b.ocr + b.grade) - (a.ocr + a.grade))
                        .map((row) => (
                          <tr key={row.school_id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2.5 font-medium">{row.school_name}</td>
                            <td className="p-2.5 text-right tabular-nums">{row.ocr}</td>
                            <td className="p-2.5 text-right tabular-nums">{row.grade}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Tahmini birim maliyetler (GPT-4o Vision / GPT-4o – OpenAI fiyatlarına göre yaklaşık) */
const EST_OCR_USD_PER_CALL = 0.01;
const EST_GRADE_USD_PER_CALL = 0.002;

function MaliyetTab({ token }: { token: string }) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UsageStats>(`/optik/admin/usage-stats?from=${from}&to=${to}`, { token });
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = days < 0
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  if (loading && !stats) return <LoadingSpinner className="mx-auto my-8 size-8" />;

  const totalOcr = stats?.totalOcr ?? 0;
  const totalGrade = stats?.totalGrade ?? 0;
  const totalCalls = totalOcr + totalGrade;
  const estOcrUsd = totalOcr * EST_OCR_USD_PER_CALL;
  const estGradeUsd = totalGrade * EST_GRADE_USD_PER_CALL;
  const estTotalUsd = estOcrUsd + estGradeUsd;
  const hasData = totalCalls > 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Maliyet Özeti</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Optik modül kullanımına dayalı tahmini OpenAI maliyeti. Tarih aralığı seçip inceleyebilirsiniz.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tarih aralığı</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPreset(7)}>Son 7 gün</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(30)}>Son 30 gün</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(-1)}>Bu ay</Button>
          </div>
          <Button size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? <LoadingSpinner className="mr-2 size-4" /> : null}
            Yenile
          </Button>
        </div>

        {!hasData && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 py-10 text-center">
            <DollarSign className="mx-auto mb-2 size-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Bu dönemde kullanım yok</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seçilen tarih aralığında OCR veya puanlama kaydı bulunamadı. Maliyet hesaplanamadı.
            </p>
            <Link href="/optik-okuma-ayarlar?tab=kullanim" className="mt-3 inline-block text-sm text-primary hover:underline">
              Kullanım İstatistikleri →
            </Link>
          </div>
        )}

        {hasData && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Toplam istek</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{totalCalls}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">OCR + puanlama toplamı</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Form okutma (OCR)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">~${estOcrUsd.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{totalOcr} istek × ~${EST_OCR_USD_PER_CALL}/istek</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Açık uçlu puanlama</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">~${estGradeUsd.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{totalGrade} istek × ~${EST_GRADE_USD_PER_CALL}/istek</p>
              </div>
              <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
                <p className="text-xs font-medium text-primary">Tahmini toplam</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary">~${estTotalUsd.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">USD (yaklaşık)</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/30 p-4">
              <Info className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Tahmin nasıl hesaplanıyor?</p>
                <p className="mt-1 text-muted-foreground">
                  OCR için GPT-4o Vision, puanlama için GPT-4o varsayılan birim fiyatlarıyla yaklaşık maliyet hesaplanır.
                  Gerçek faturalandırma{' '}
                  <a
                    href="https://platform.openai.com/usage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    OpenAI kullanım raporu
                  </a>
                  {' '}üzerinden takip edilir. Detaylı istatistik için{' '}
                  <Link href="/optik-okuma-ayarlar?tab=kullanim" className="text-primary hover:underline">
                    Kullanım İstatistikleri
                  </Link>
                  {' '}sekmesine bakın.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const OCR_PROVIDERS = [
  {
    value: 'openai_vision',
    label: 'OpenAI Vision',
    desc: 'Şu an kullanılıyor – El yazısı ve basılı metin için GPT-4o Vision. Tek API, hızlı kurulum.',
    active: true,
    badge: 'Aktif',
  },
  {
    value: 'google',
    label: 'Google Document AI',
    desc: 'Planlanan – Yüksek hacim, yerel işleme. Ek yapılandırma gerekir.',
    active: false,
    badge: 'Yakında',
  },
  {
    value: 'azure',
    label: 'Azure Form Recognizer',
    desc: 'Planlanan – Kurumsal senaryolar için. Ek yapılandırma gerekir.',
    active: false,
    badge: 'Yakında',
  },
  {
    value: 'placeholder',
    label: 'Placeholder',
    desc: 'Geçiş / test için. Gerçek OCR yapmaz.',
    active: false,
    badge: 'Dev',
  },
] as const;

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Hızlı, ekonomik – OCR ve standart puanlama için önerilen', recommended: true },
  { value: 'gpt-4o', label: 'GPT-4o', desc: 'Gelişmiş – Karmaşık açık uçlu sorular için', recommended: false },
  { value: 'gpt-4', label: 'GPT-4', desc: 'En yüksek kalite – Yedek seçenek', recommended: false },
] as const;

export default function OptikOkumaAyarlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [config, setConfig] = useState<OptikConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState<Partial<OptikConfig>>({});

  const tab = (searchParams.get('tab') as (typeof TABS)[number]['id']) || 'genel';

  const fetchConfig = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    try {
      const data = await apiFetch<OptikConfig>('/app-config/optik', { token });
      setConfig(data);
      setForm({
        module_enabled: data.module_enabled,
        default_language: data.default_language,
        openai_model: data.openai_model,
        openai_temperature: data.openai_temperature,
        ocr_provider: data.ocr_provider,
        ocr_google_project_id: data.ocr_google_project_id ?? null,
        ocr_google_credentials: data.ocr_google_credentials ?? null,
        ocr_google_location: data.ocr_google_location ?? null,
        ocr_google_processor_id: data.ocr_google_processor_id ?? null,
        ocr_azure_endpoint: data.ocr_azure_endpoint ?? null,
        ocr_azure_api_key: data.ocr_azure_api_key ?? null,
        ocr_azure_model: data.ocr_azure_model ?? null,
        ocr_timeout_seconds: data.ocr_timeout_seconds ?? null,
        ocr_retry_count: data.ocr_retry_count ?? null,
        ocr_language_hint: data.ocr_language_hint ?? null,
        confidence_threshold: data.confidence_threshold,
        grade_modes: data.grade_modes,
        daily_limit_per_user: data.daily_limit_per_user,
        key_text_cache_ttl_hours: data.key_text_cache_ttl_hours,
      });
    } catch {
      setConfig(null);
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
      const body: Record<string, unknown> = {
        module_enabled: form.module_enabled ?? config?.module_enabled,
        default_language: form.default_language ?? config?.default_language,
        openai_model: form.openai_model ?? config?.openai_model,
        openai_temperature: form.openai_temperature ?? config?.openai_temperature ?? 0,
        ocr_provider: form.ocr_provider ?? config?.ocr_provider,
        ocr_google_project_id: form.ocr_google_project_id ?? config?.ocr_google_project_id ?? null,
        ocr_google_location: form.ocr_google_location ?? config?.ocr_google_location ?? null,
        ocr_google_processor_id: form.ocr_google_processor_id ?? config?.ocr_google_processor_id ?? null,
        ocr_azure_endpoint: form.ocr_azure_endpoint ?? config?.ocr_azure_endpoint ?? null,
        ocr_azure_model: form.ocr_azure_model ?? config?.ocr_azure_model ?? null,
        ocr_timeout_seconds: form.ocr_timeout_seconds ?? config?.ocr_timeout_seconds ?? null,
        ocr_retry_count: form.ocr_retry_count ?? config?.ocr_retry_count ?? null,
        ocr_language_hint: form.ocr_language_hint ?? config?.ocr_language_hint ?? null,
        confidence_threshold: form.confidence_threshold ?? config?.confidence_threshold ?? 0.7,
        grade_modes: form.grade_modes ?? config?.grade_modes ?? [],
        daily_limit_per_user: form.daily_limit_per_user ?? config?.daily_limit_per_user,
        key_text_cache_ttl_hours: form.key_text_cache_ttl_hours ?? config?.key_text_cache_ttl_hours ?? 24,
      };
      if (form.openai_api_key && form.openai_api_key !== '••••••••') {
        body.openai_api_key = form.openai_api_key;
      }
      if (form.ocr_google_credentials && form.ocr_google_credentials !== '••••••••') {
        body.ocr_google_credentials = form.ocr_google_credentials;
      }
      if (form.ocr_azure_api_key && form.ocr_azure_api_key !== '••••••••') {
        body.ocr_azure_api_key = form.ocr_azure_api_key;
      }
      await apiFetch('/app-config/optik', {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      });
      toast.success('Optik / Açık Uçlu ayarları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setTesting(true);
    setLastTestResult(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/app-config/optik/test', {
        method: 'POST',
        token,
      });
      setLastTestResult(res);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bağlantı test edilemedi';
      setLastTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  if (me?.role !== 'superadmin') return null;
  if (loading || !config) {
    return (
      <div className="mx-auto flex min-h-[min(420px,70vh)] max-w-6xl flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-linear-to-b from-muted/30 to-muted/10 px-6 py-16">
        <LoadingSpinner className="size-10 text-primary" />
        <p className="text-sm font-medium text-foreground">Optik ayarları yükleniyor…</p>
        <p className="max-w-sm text-center text-xs text-muted-foreground">Yapılandırma sunucudan alınıyor</p>
      </div>
    );
  }

  const moduleOn = form.module_enabled ?? config.module_enabled;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-primary/[0.07] via-background to-muted/50 p-6 shadow-md ring-1 ring-border/40 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/8 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
              <ScanLine className="size-6" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Optik / Açık Uçlu Ayarları
                </h1>
                <span className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Süper yönetici
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                OCR, GPT puanlama, limitler ve şablonlar tek yerden. Okullar için modülü burada açıp kapatabilir,
                yetkili okulları{' '}
                <Link href="/schools" className="font-medium text-primary underline-offset-4 hover:underline">
                  Okullar
                </Link>{' '}
                üzerinden seçebilirsiniz.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                moduleOn
                  ? 'border border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300'
                  : 'border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
              }`}
            >
              {moduleOn ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
              {moduleOn ? 'Modül platformda açık' : 'Modül platformda kapalı'}
            </span>
            {config.openai_api_key ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Zap className="size-3.5 text-primary" />
                OpenAI anahtarı tanımlı
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                OpenAI anahtarı eksik
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-tab-scroll -mx-1 px-1">
        <nav
          className="flex min-w-max gap-0.5 rounded-2xl border border-border/50 bg-muted/40 p-1.5 shadow-inner ring-1 ring-border/30 backdrop-blur-md dark:bg-muted/20"
          aria-label="Optik ayar sekmeleri"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link
                key={t.id}
                href={`/optik-okuma-ayarlar?tab=${t.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? 'opacity-100' : 'opacity-80'}`} aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === 'genel' && (
        <>
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Genel Ayarlar</CardTitle>
              <CardDescription className="text-sm">
                Modül açık/kapalı ve varsayılan dil ayarları
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <label className="flex cursor-pointer items-start gap-4">
                  <input
                    type="checkbox"
                    checked={form.module_enabled ?? config.module_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, module_enabled: e.target.checked }))}
                    className="mt-1 size-4 rounded-md border-border accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Modülü aç</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Açıksa yetkili okullara Optik Okuma modülü sunulur; kapalıysa modül hiçbir okulda görünmez.
                    </span>
                  </span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Varsayılan dil</label>
                <select
                  value={form.default_language ?? config.default_language}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_language: e.target.value as 'tr' | 'en' }))
                  }
                  className="h-11 w-full max-w-xs rounded-xl border border-input bg-background px-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">İngilizce</option>
                </select>
              </div>
            </CardContent>
          </Card>
          <Card variant="sky" soft className="rounded-2xl border-border/40 shadow-sm">
            <CardContent className="flex flex-row items-start gap-4 pt-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <School className="size-5" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-foreground">Okul bazlı yetkilendirme</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Hangi okulların optik modülünü kullanabileceğini{' '}
                  <Link href="/schools" className="font-medium text-primary underline-offset-4 hover:underline">
                    Okullar
                  </Link>
                  {' '}sayfasından yönetin. Okul satırına tıklayıp <strong className="font-medium text-foreground">Modül yetkilendirme</strong> kartında{' '}
                  <strong className="font-medium text-foreground">Optik Okuma</strong> kutusunu işaretleyin veya kaldırın.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Harici OCR (Google/Azure) Genel Ayarları */}
          {((form.ocr_provider ?? config.ocr_provider) === 'google' ||
            (form.ocr_provider ?? config.ocr_provider) === 'azure') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="size-5 text-primary" />
                  Harici OCR Genel Ayarları
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Google Document AI veya Azure Form Recognizer için genel parametreler
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="ocr-timeout">Timeout (saniye)</Label>
                    <Input
                      id="ocr-timeout"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="30"
                      value={form.ocr_timeout_seconds ?? config.ocr_timeout_seconds ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setForm((f) => ({
                          ...f,
                          ocr_timeout_seconds: v === '' ? null : parseInt(v, 10) || null,
                        }));
                      }}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">1–120 sn, boş = varsayılan</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ocr-retry">Yeniden deneme</Label>
                    <Input
                      id="ocr-retry"
                      type="number"
                      min={0}
                      max={5}
                      placeholder="2"
                      value={form.ocr_retry_count ?? config.ocr_retry_count ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setForm((f) => ({
                          ...f,
                          ocr_retry_count: v === '' ? null : parseInt(v, 10) ?? null,
                        }));
                      }}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">0–5</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ocr-lang-hint">OCR dil ipucu</Label>
                    <select
                      id="ocr-lang-hint"
                      value={form.ocr_language_hint ?? config.ocr_language_hint ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ocr_language_hint: (e.target.value as 'tr' | 'en') || null,
                        }))
                      }
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm"
                    >
                      <option value="">Varsayılan kullan</option>
                      <option value="tr">Türkçe</option>
                      <option value="en">İngilizce</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'ai' && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="size-5 text-primary" />
                  AI / GPT Ayarları
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  OCR ve açık uçlu puanlama için OpenAI entegrasyonu. Anahtar güvenle backend&apos;de saklanır.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {config.openai_api_key ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-3.5" />
                    Anahtar tanımlı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <AlertCircle className="size-3.5" />
                    Anahtar gerekli
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* API Anahtarı */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                <Label htmlFor="openai-key" className="text-sm font-semibold">
                  OpenAI API Anahtarı
                </Label>
              </div>
              <Input
                id="openai-key"
                type="password"
                autoComplete="off"
                placeholder={config.openai_api_key ? '•••••••• (değiştirmek için yeni anahtar girin)' : 'sk-proj-... veya sk-...'}
                value={form.openai_api_key ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, openai_api_key: e.target.value }))}
                className="max-w-md font-mono text-sm"
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ExternalLink className="size-3.5 shrink-0" />
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
                adresinden alın
              </p>
            </div>

            {/* Model Seçimi */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-muted-foreground" />
                <Label htmlFor="openai-model" className="text-sm font-semibold">
                  Puanlama Modeli
                </Label>
              </div>
              <div className="max-w-md space-y-2">
                <select
                  id="openai-model"
                  value={form.openai_model ?? config.openai_model}
                  onChange={(e) => setForm((f) => ({ ...f, openai_model: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>option]:bg-background"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} {m.recommended ? '— Önerilen' : ''}
                    </option>
                  ))}
                </select>
                {(MODELS.find((m) => m.value === (form.openai_model ?? config.openai_model))?.desc) && (
                  <p className="text-xs text-muted-foreground">
                    {MODELS.find((m) => m.value === (form.openai_model ?? config.openai_model))!.desc}
                  </p>
                )}
              </div>
            </div>

            {/* Gelişmiş: Temperature */}
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Thermometer className="size-4 text-muted-foreground" />
                <Label htmlFor="openai-temp" className="text-sm font-semibold">
                  Temperature (gelişmiş)
                </Label>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  Önerilen: 0
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  id="openai-temp"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.openai_temperature ?? config.openai_temperature ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      openai_temperature: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="h-2 w-40 max-w-[160px] cursor-pointer rounded-lg accent-primary"
                />
                <span className="min-w-10 font-mono text-sm tabular-nums">
                  {form.openai_temperature ?? config.openai_temperature ?? 0}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                0 = tutarlı, deterministik puanlama. Yüksek değerler daha yaratıcı ancak tutarsız sonuç verebilir.
              </p>
            </div>

            {/* Bağlantı Testi */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <Button
                variant={config.openai_api_key ? 'outline' : 'default'}
                size="sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <LoadingSpinner className="mr-2 size-4" />
                    Test ediliyor…
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 size-4" />
                    Bağlantıyı test et
                  </>
                )}
              </Button>
              {lastTestResult && (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm ${
                    lastTestResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                  }`}
                >
                  {lastTestResult.ok ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                  {lastTestResult.message}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'ocr' && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="size-5 text-primary" />
                  OCR Ayarları
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  El yazısı ve basılı metin tanıma sağlayıcısı. Açık uçlu cevaplar bu altyapı ile okunur.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(form.ocr_provider ?? config.ocr_provider) === 'openai_vision' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-3.5" />
                    OpenAI Vision aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {OCR_PROVIDERS.find((p) => p.value === (form.ocr_provider ?? config.ocr_provider))?.label ?? 'Seçili'}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sağlayıcı Seçimi */}
            <div className="space-y-3">
              <Label htmlFor="ocr-provider" className="text-sm font-semibold">
                OCR Sağlayıcı
              </Label>
              <select
                id="ocr-provider"
                value={form.ocr_provider ?? config.ocr_provider}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ocr_provider: e.target.value as (typeof OCR_PROVIDERS)[number]['value'] }))
                }
                className="flex h-10 w-full max-w-md rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {OCR_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} {p.badge ? `— ${p.badge}` : ''}
                  </option>
                ))}
              </select>
              {(OCR_PROVIDERS.find((p) => p.value === (form.ocr_provider ?? config.ocr_provider))?.desc) && (
                <p className="text-xs text-muted-foreground">
                  {OCR_PROVIDERS.find((p) => p.value === (form.ocr_provider ?? config.ocr_provider))!.desc}
                </p>
              )}
            </div>

            {/* Google Document AI Ayarları */}
            {(form.ocr_provider ?? config.ocr_provider) === 'google' && (
              <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-muted-foreground" />
                  Google Document AI
                </h4>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ocr-google-project">GCP Proje ID</Label>
                    <Input
                      id="ocr-google-project"
                      placeholder="my-project-123"
                      value={form.ocr_google_project_id ?? config.ocr_google_project_id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ocr_google_project_id: e.target.value || null }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ocr-google-location">Location</Label>
                    <select
                      id="ocr-google-location"
                      value={form.ocr_google_location ?? config.ocr_google_location ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ocr_google_location: e.target.value || null }))
                      }
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm"
                    >
                      <option value="">Seçin</option>
                      <option value="us">us</option>
                      <option value="eu">eu</option>
                      <option value="asia">asia</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Document AI processor bölgesi</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ocr-google-processor">Processor ID</Label>
                    <Input
                      id="ocr-google-processor"
                      placeholder="abc123def456..."
                      value={form.ocr_google_processor_id ?? config.ocr_google_processor_id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ocr_google_processor_id: e.target.value || null }))}
                      className="max-w-md font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Document AI processor ID (Form Parser, Document OCR vb.)
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ocr-google-creds">Service Account JSON</Label>
                    <Input
                      id="ocr-google-creds"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        config.ocr_google_credentials ? '•••••••• (değiştirmek için yeni girin)' : 'JSON içeriği veya base64'
                      }
                      value={form.ocr_google_credentials ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ocr_google_credentials: e.target.value || null }))}
                      className="max-w-md font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Document AI yetkili service account JSON
                    </p>
                  </div>
                </div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Bu sağlayıcı henüz uygulanmadı. Ayarlar kaydedilir ve gelecekte kullanılacak.
                </p>
              </div>
            )}

            {/* Azure Form Recognizer Ayarları */}
            {(form.ocr_provider ?? config.ocr_provider) === 'azure' && (
              <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-muted-foreground" />
                  Azure Form Recognizer
                </h4>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ocr-azure-endpoint">Endpoint URL</Label>
                    <Input
                      id="ocr-azure-endpoint"
                      placeholder="https://xxx.cognitiveservices.azure.com/"
                      value={form.ocr_azure_endpoint ?? config.ocr_azure_endpoint ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ocr_azure_endpoint: e.target.value || null }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ocr-azure-key">API Anahtarı</Label>
                    <Input
                      id="ocr-azure-key"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        config.ocr_azure_api_key ? '•••••••• (değiştirmek için yeni girin)' : 'Azure Form Recognizer API key'
                      }
                      value={form.ocr_azure_api_key ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ocr_azure_api_key: e.target.value || null }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ocr-azure-model">Model</Label>
                    <select
                      id="ocr-azure-model"
                      value={form.ocr_azure_model ?? config.ocr_azure_model ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ocr_azure_model: e.target.value || null }))
                      }
                      className="flex h-10 w-full max-w-md rounded-lg border border-input bg-background px-4 py-2 text-sm"
                    >
                      <option value="">Varsayılan</option>
                      <option value="prebuilt-read">prebuilt-read</option>
                      <option value="prebuilt-document">prebuilt-document</option>
                      <option value="prebuilt-layout">prebuilt-layout</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      prebuilt-read: metin odaklı, prebuilt-document: form + metin
                    </p>
                  </div>
                </div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Bu sağlayıcı henüz uygulanmadı. Ayarlar kaydedilir ve gelecekte kullanılacak.
                </p>
              </div>
            )}

            {/* OpenAI Vision – AI sekmesindeki anahtar kullanılır */}
            {(form.ocr_provider ?? config.ocr_provider) === 'openai_vision' && (
              <div className="flex gap-3 rounded-xl border border-border/60 bg-green-500/5 p-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-400" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">OpenAI Vision kullanılıyor</p>
                  <p className="text-muted-foreground">
                    API anahtarı AI / GPT sekmesinden alınır. Ek yapılandırma gerekmez.
                  </p>
                </div>
              </div>
            )}

            {/* Bilgi Kutusu */}
            <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Mevcut Durum</p>
                <p className="text-muted-foreground">
                  Tüm OCR işlemleri şu an <strong>OpenAI Vision</strong> (GPT-4o) ile yapılmaktadır. Bu ayar
                  ileride Google Document AI veya Azure Form Recognizer entegrasyonu için kaydedilir. Varsayılan
                  dil ipucu (Türkçe/İngilizce) Genel sekmesinden ayarlanır.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'puanlama' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-5 text-primary" />
              Puanlama Ayarları
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Açık uçlu soru puanlama parametreleri. Güven eşiği ve desteklenen modlar.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Güven Eşiği */}
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="confidence-threshold" className="text-sm font-semibold">
                    OCR Güven Eşiği
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Bu değerin altında <code className="rounded bg-muted px-1">needs_rescan=true</code> dönülür; puanlama yapılmaz, yeniden okutma önerilir.
                  </p>
                </div>
                <span className="min-w-12 font-mono text-lg tabular-nums text-primary">
                  {form.confidence_threshold ?? config.confidence_threshold ?? 0.7}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  id="confidence-threshold"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.confidence_threshold ?? config.confidence_threshold ?? 0.7}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      confidence_threshold: parseFloat(e.target.value) || 0.7,
                    }))
                  }
                  className="h-2 flex-1 max-w-xs cursor-pointer rounded-lg accent-primary"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, confidence_threshold: 0.5 }))}
                  >
                    0.5
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, confidence_threshold: 0.7 }))}
                  >
                    0.7
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, confidence_threshold: 0.9 }))}
                  >
                    0.9
                  </Button>
                </div>
              </div>
            </div>

            {/* Puanlama Modları */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Desteklenen Puanlama Modları</Label>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Açık uçlu sorularda kullanılabilecek modlar.
                <Link
                  href="/optik-okuma-ayarlar?tab=rubrik-sablonlari"
                  className="text-primary hover:underline"
                >
                  Rubrik Şablonları
                </Link>
                sekmesinden detaylı şablon oluşturabilirsiniz.
              </p>
              <div className="flex flex-wrap gap-2">
                {RUBRIC_MODES.map((mode) => {
                  const modes = form.grade_modes ?? config.grade_modes ?? [];
                  const isActive = modes.includes(mode.value);
                  return (
                    <label
                      key={mode.value}
                      className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-4 py-3 transition-colors ${
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/30 hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => {
                            const m = form.grade_modes ?? config.grade_modes ?? [];
                            const next = e.target.checked
                              ? [...m.filter((x) => x !== mode.value), mode.value]
                              : m.filter((x) => x !== mode.value);
                            setForm((f) => ({ ...f, grade_modes: next.length ? next : ['CONTENT'] }));
                          }}
                          className="size-4 rounded border-border"
                        />
                        <span className="font-medium text-sm">{mode.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{mode.desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bilgi Kutusu */}
            <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Çalışma Mantığı</p>
                <p className="text-muted-foreground">
                  OCR ile okunan metnin güven skoru eşiğin altındaysa GPT puanlamaya çağrılmaz; öğretmene “Yeniden okut”
                  gösterilir. Bu sayede yanlış okuma nedeniyle hatalı puan verilmesi önlenir. Puanlama modları Rubrik
                  Şablonları sekmesinde detaylı kriterlerle tanımlanabilir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'limitler' && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="size-5 text-primary" />
                  Limitler
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kullanıcı başı kota ve anahtar metin cache süresi
                </p>
              </div>
              {(form.daily_limit_per_user ?? config.daily_limit_per_user) == null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="size-3.5" />
                  Kotasız
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Günlük Kota */}
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div>
                <Label htmlFor="daily-limit" className="text-sm font-semibold">
                  Günlük limit (kullanıcı başı)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Her öğretmen günde en fazla bu kadar OCR + puanlama isteği yapabilir. Boş = sınırsız.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="daily-limit"
                  type="number"
                  min={0}
                  placeholder="Sınırsız"
                  value={form.daily_limit_per_user ?? config.daily_limit_per_user ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setForm((f) => ({
                      ...f,
                      daily_limit_per_user: v === '' ? null : Math.max(0, parseInt(v, 10) || 0),
                    }));
                  }}
                  className="h-10 w-32 font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  {[100, 500, 1000, 5000].map((n) => (
                    <Button
                      key={n}
                      variant={
                        (form.daily_limit_per_user ?? config.daily_limit_per_user) === n
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, daily_limit_per_user: n }))}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button
                    variant={
                      (form.daily_limit_per_user ?? config.daily_limit_per_user) == null
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, daily_limit_per_user: null }))}
                  >
                    Sınırsız
                  </Button>
                </div>
              </div>
            </div>

            {/* Anahtar Metin Cache */}
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div>
                <Label htmlFor="cache-ttl" className="text-sm font-semibold">
                  Anahtar metin cache (saat)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Aynı soru anahtarı için sonuçlar bu süre boyunca önbellekte tutulur. 1–168 saat.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  id="cache-ttl"
                  type="number"
                  min={1}
                  max={168}
                  value={form.key_text_cache_ttl_hours ?? config.key_text_cache_ttl_hours ?? 24}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      key_text_cache_ttl_hours: Math.max(1, Math.min(168, parseInt(e.target.value, 10) || 24)),
                    }))
                  }
                  className="h-10 w-24 font-mono"
                />
                <span className="text-sm text-muted-foreground">saat</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { h: 24, label: '24 saat' },
                    { h: 48, label: '2 gün' },
                    { h: 72, label: '3 gün' },
                    { h: 168, label: '1 hafta' },
                  ].map(({ h, label }) => (
                    <Button
                      key={h}
                      variant={
                        (form.key_text_cache_ttl_hours ?? config.key_text_cache_ttl_hours ?? 24) === h
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, key_text_cache_ttl_hours: h }))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bilgi */}
            <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Kota ve cache</p>
                <p className="mt-1 text-muted-foreground">
                  Günlük limit aşıldığında öğretmen OCR/puanlama yapamaz. Cache ile aynı anahtar için tekrarlayan
                  istekler azaltılır.{' '}
                  <Link
                    href="/optik-okuma-ayarlar?tab=kullanim"
                    className="text-primary hover:underline"
                  >
                    Kullanım İstatistikleri
                  </Link>
                  sekmesinden takip edilebilir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'form-sablonlari' && token && (
        <FormSablonlariTab token={token} />
      )}

      {tab === 'rubrik-sablonlari' && token && (
        <RubrikSablonlariTab token={token} />
      )}

      {tab === 'kullanim' && token && (
        <KullanimTab token={token} />
      )}

      {tab === 'e-okul' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">e-Okul Entegrasyonu Yol Haritası</CardTitle>
            <CardDescription className="text-sm">
              Mevcut özellikler ve planlanan e-Okul entegrasyonu adımları
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-green-200/80 bg-green-50/60 p-5 text-sm shadow-sm dark:border-green-900/40 dark:bg-green-950/25">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                Mevcut durum (Faz 1 hazır)
              </p>
              <ul className="mt-3 list-outside space-y-2 pl-1 text-muted-foreground">
                <li className="ml-4 list-disc">Optik form okutma ve puanlama sonuçları Excel/PDF olarak dışa aktarılabilir</li>
                <li className="ml-4 list-disc">Öğretmen uygulamasından veya web üzerinden sonuçları indirip e-Okul&apos;a manuel aktarım yapılabilir</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm shadow-sm">
              <p className="font-semibold text-foreground">Planlanan fazlar</p>
              <ul className="mt-3 list-outside space-y-2.5 pl-1 text-muted-foreground">
                <li className="ml-4 list-disc"><span className="font-medium text-foreground">Faz 2:</span> e-Okul formatında toplu not giriş dosyası üretimi</li>
                <li className="ml-4 list-disc"><span className="font-medium text-foreground">Faz 3:</span> MEB SSO / e-Okul API (resmi entegrasyon) — MEB onayı gerekir</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'maliyet' && token && (
        <MaliyetTab token={token} />
      )}

      {(tab === 'genel' || tab === 'ai' || tab === 'ocr' || tab === 'puanlama' || tab === 'limitler') && (
        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/85 p-4 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Yapılandırma değişiklikleri kaydedilene kadar sunucuda güncellenmez.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="min-w-28 rounded-xl shadow-sm">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
            <Link href="/settings">
              <Button variant="outline" className="rounded-xl">
                Ayarlara dön
              </Button>
            </Link>
          </div>
        </div>
      )}
      {(tab === 'form-sablonlari' || tab === 'rubrik-sablonlari' || tab === 'kullanim' || tab === 'e-okul' || tab === 'maliyet') && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Bu sekmede değişiklikler otomatik kaydedilir veya ilgili ekranda uygulanır.</p>
            <Link href="/settings">
              <Button variant="outline" className="rounded-xl">
                Ayarlara dön
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
