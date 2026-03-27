'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText, Download } from 'lucide-react';

type FormTemplate = {
  id: string;
  name: string;
  slug: string;
  formType: string;
  questionCount: number;
  choiceCount: number;
  pageSize?: string;
  examType?: string;
  gradeLevel?: string | null;
  subjectHint?: string | null;
  scope?: string;
};

const EXAM_LABELS: Record<string, string> = {
  genel: 'Genel',
  yazili: 'Yazılı',
  deneme: 'Deneme',
  quiz: 'Quiz',
  karma: 'Karma',
};

const EXAM_OPTIONS = Object.entries(EXAM_LABELS).map(([value, label]) => ({ value, label }));

export default function OptikFormlarPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [examFilter, setExamFilter] = useState<string>('');

  const fetchItems = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<FormTemplate[]>('/optik/form-templates', { token });
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

  const handleDownloadPdf = async (item: FormTemplate, prependBlank = 0) => {
    if (!token) return;
    setDownloadingId(item.id);
    try {
      const qs = prependBlank > 0 ? `?prepend_blank=${prependBlank}` : '';
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/optik/form-templates/${item.id}/pdf${qs}`), {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
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

  const scopeLabel = (s?: string) => (s === 'system' ? 'Sistem' : s === 'school' ? 'Okul' : s === 'teacher' ? 'Özel' : '-');
  const filteredItems = examFilter
    ? items.filter((i) => (i.examType ?? 'genel') === examFilter)
    : items;

  if (loading) return <LoadingSpinner className="mx-auto my-8 size-8" />;

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Optik Form Şablonları</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tanımlı şablonları indirin. Yeni şablon yalnızca süper admin tarafından eklenir (Optik okuma ayarları).
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="exam-filter" className="text-sm text-muted-foreground">Sınav türü:</label>
            <select
              id="exam-filter"
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="rounded border border-border px-2 py-1 text-sm"
            >
              <option value="">Tümü</option>
              {EXAM_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="table-x-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Ad</th>
                  <th className="p-2 text-left">Tür</th>
                  <th className="p-2 text-right">Soru</th>
                  <th className="p-2 text-right">Şık</th>
                  <th className="p-2 text-left">Kaynak</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{EXAM_LABELS[item.examType ?? 'genel'] ?? item.examType}</td>
                    <td className="p-2 text-right">{item.questionCount}</td>
                    <td className="p-2 text-right">{item.choiceCount}</td>
                    <td className="p-2 text-muted-foreground">{scopeLabel(item.scope)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!downloadingId}
                          onClick={() => handleDownloadPdf(item)}
                          title="Sadece optik form"
                        >
                          {downloadingId === item.id ? (
                            <LoadingSpinner className="size-4" />
                          ) : (
                            <Download className="size-4" />
                          )}
                          <span className="ml-1">PDF</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!downloadingId}
                          onClick={() => handleDownloadPdf(item, 1)}
                          title="Önce boş sayfa (yazılı sorular için), sonra optik form"
                        >
                          Yazılı + Form
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <EmptyState
                icon={<FileText className="size-10 text-muted-foreground" />}
                title={items.length === 0 ? 'Henüz form şablonu yok' : 'Bu sınav türünde form yok'}
                description={
                  items.length === 0
                    ? 'Süper admin optik form şablonlarını Optik okuma ayarları üzerinden tanımlar.'
                    : 'Filtreyi değiştirin.'
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
