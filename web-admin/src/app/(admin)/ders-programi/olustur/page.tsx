'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Trash2,
  Download,
  CheckCircle2,
  Info,
  ExternalLink,
  Send,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TeacherProgramCreateForm } from '@/components/ders-programi/teacher-program-create-form';

type TimetableEntry = {
  user_id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

function getDefaultValidUntil(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month < 6) return `${year}-01-31`;
  return `${year}-06-30`;
}

export default function OlusturPage() {
  const { token, me } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    imported: number;
    errors: string[];
    plan_id?: string;
  } | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil);
  const [openEnded, setOpenEnded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = me?.role === 'school_admin';

  useEffect(() => {
    if (!token || !isAdmin) return;
    apiFetch<TimetableEntry[]>('/teacher-timetable', { token })
      .then((data) => setEntryCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setEntryCount(0));
  }, [token, isAdmin]);

  const handleDownloadExample = async () => {
    if (!token) return;
    try {
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl('/teacher-timetable/example-template'), {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      if (!res.ok) throw new Error('İndirme başarısız.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ogretmen-ders-programi-ornek.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Örnek Excel indirildi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İndirme başarısız.');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error('Sadece Excel (.xlsx, .xls) dosyası yükleyin.');
      return;
    }

    setUploading(true);
    setLastResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch<{ imported: number; errors: string[]; plan_id?: string }>('/teacher-timetable/upload', {
        token,
        method: 'POST',
        body: formData,
        headers: {},
      });
      setLastResult(res);
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidUntil(getDefaultValidUntil());
      setOpenEnded(false);
      toast.success(`${res.imported} satır taslağa aktarıldı. Geçerlilik tarihlerini seçip yayınlayın.`);
      if (res.errors?.length) {
        toast.warning(`${res.errors.length} hata var.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız.');
      setLastResult(null);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePublish = async () => {
    const planId = lastResult?.plan_id;
    if (!token || !planId) return;
    if (!openEnded && validFrom > validUntil) {
      toast.error('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    setPublishing(true);
    try {
      await apiFetch(`/teacher-timetable/plans/${planId}/publish`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          valid_from: validFrom,
          valid_until: openEnded ? null : validUntil,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Ders programı yayınlandı. Öğretmenlere bildirim gönderildi.');
      setLastResult(null);
      const data = await apiFetch<TimetableEntry[]>('/teacher-timetable', { token });
      setEntryCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yayınlama başarısız.';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const handleClear = async () => {
    if (!token) return;
    setClearing(true);
    try {
      await apiFetch('/teacher-timetable', { token, method: 'DELETE' });
      setLastResult(null);
      setEntryCount(0);
      toast.success('Ders programı ve taslaklar temizlendi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Temizleme başarısız.');
    } finally {
      setClearing(false);
    }
  };

  if (!isAdmin) {
    return (
      <TeacherProgramCreateForm token={token} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ders-programi"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Ders Programı
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Excel ile Yükle</h1>
      </div>

      {/* Admin stepper */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          1
        </span>
        <span className="font-medium">Excel Yükle</span>
        <span className="text-muted-foreground">→</span>
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            lastResult?.plan_id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          2
        </span>
        <span className={lastResult?.plan_id ? 'font-medium' : 'text-muted-foreground'}>
          Tarih Seç ve Yayınla
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
          3
        </span>
        <span className="text-muted-foreground">Programlarım</span>
        <Link
          href="/ders-programi/programlarim"
          className="ml-auto text-primary hover:underline font-medium"
        >
          Programlara git
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-5" />
            Excel ile Yükle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-sm space-y-1.5">
            <p className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
              <Info className="size-4 shrink-0" />
              Desteklenen Excel Formatı
            </p>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1 ml-5 list-disc text-xs">
              <li>
                <strong>Ad Soyad</strong> sütunu – sistemdeki tam ad veya e-posta
              </li>
              <li>
                Her gün için sütunlar:{' '}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-[11px]">
                  Pazartesi_ders1
                </code>{' '}
                …{' '}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-[11px]">
                  Cuma_ders8
                </code>
              </li>
              <li>
                Hücre değeri:{' '}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded text-[11px]">7A-MAT</code> (sınıf-ders)
              </li>
              <li>Boş hücre = o saatte dersi yok</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadExample} className="gap-2">
              <Download className="size-4" />
              Örnek Excel İndir
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="size-4" />
              {uploading ? 'Yükleniyor…' : 'Excel Seç ve Yükle'}
            </Button>
            {(entryCount !== null && entryCount > 0) || lastResult?.plan_id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClear}
                disabled={clearing}
              >
                <Trash2 className="size-4" />
                {clearing ? 'Temizleniyor…' : 'Ders Programını ve Taslakları Temizle'}
              </Button>
            ) : null}
          </div>

          {lastResult && (
            <div
              className={cn(
                'rounded-lg border p-3 text-sm',
                lastResult.errors?.length > 0
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20',
              )}
            >
              <p
                className={cn(
                  'font-semibold flex items-center gap-1.5',
                  lastResult.errors?.length > 0
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-emerald-800 dark:text-emerald-200',
                )}
              >
                <CheckCircle2 className="size-4" />
                {lastResult.imported} ders girdisi taslağa aktarıldı.
                {lastResult.errors?.length > 0 && ` (${lastResult.errors.length} satır hatalı)`}
              </p>
              {lastResult.errors?.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-amber-700 dark:text-amber-300 text-xs space-y-0.5">
                  {lastResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {lastResult.errors.length > 10 && (
                    <li className="text-muted-foreground">… ve {lastResult.errors.length - 10} satır daha</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lastResult?.plan_id && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-5 text-primary" />
              Taslak Önizleme – Yayınla
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Geçerlilik tarihlerini seçin ve yayınlayın. Yayınlandıktan sonra öğretmenlere bildirim gönderilir.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="valid-from">Başlangıç tarihi</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open-ended" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="open-ended"
                    type="checkbox"
                    checked={openEnded}
                    onChange={(e) => setOpenEnded(e.target.checked)}
                    className="rounded border-border"
                  />
                  Bitiş tarihi belirsiz (açık uçlu)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Açık uçlu program, yeni program yayınlanana kadar geçerlidir.
                </p>
                {!openEnded && (
                  <>
                    <Label htmlFor="valid-until">Bitiş tarihi</Label>
                    <Input
                      id="valid-until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                <Send className="size-4" />
                {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Ders saatleri</p>
              <p className="text-xs text-muted-foreground">
                Ders başlangıç ve bitiş saatlerini Nöbet → Ayarlar sayfasındaki &quot;Okul Varsayılan Saatleri&quot;
                bölümünden düzenleyebilirsiniz.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link href="/duty/yerler" className="gap-2">
                  <ExternalLink className="size-4" />
                  Nöbet Ayarlarına git
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
