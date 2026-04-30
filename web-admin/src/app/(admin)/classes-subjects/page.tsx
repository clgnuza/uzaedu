'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolClassesSubjects } from '@/hooks/use-school-classes-subjects';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Layers3, Library, Upload } from 'lucide-react';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { cn } from '@/lib/utils';
import type { SchoolClass, SchoolSubject } from '@/hooks/use-school-classes-subjects';

type TabId = 'classes' | 'subjects' | 'studentLists';
type SchoolStudent = {
  id: string;
  name: string;
  studentNumber: string | null;
  classId: string | null;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  birthDate: string | null;
};

const ClassIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 1 2 2 5 2s5-1 5-2v-5" />
  </svg>
);
const SubjectIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8M8 11h6" />
  </svg>
);

const USED_IN_MODULES = ['Ders Programı', 'Nöbet', 'Kazanım Takip', 'Evrak'];

function BulkImportSettingsPanel({ variant, isBilsem }: { variant: TabId; isBilsem: boolean }) {
  const title = variant === 'classes' ? (isBilsem ? 'Grup listesi' : 'Sınıf listesi') : isBilsem ? 'Alan / ders listesi' : 'Ders listesi';
  return (
    <div className="border-t border-border/70 bg-muted/15 px-2 py-2.5 sm:px-3 sm:py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        <Upload className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Toplu yükleme — {title}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-relaxed">
        {variant === 'classes'
          ? isBilsem
            ? 'Şablon ve dosya ile toplu grup aktarımı; mükerrer ad ve düzey kuralları burada ayarlanacak.'
            : 'Excel/şablon ile sınıf–şube toplu içe aktarma; çakışma ve güncelleme seçenekleri bu alanda olacak.'
          : 'Ders adı ve kod eşlemesi için toplu içe aktarma; mevcut kayıtlarla birleştirme tercihleri burada yapılandırılacak.'}
      </p>
      <div className="mt-2 flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-[10px] text-muted-foreground sm:min-h-[5.5rem] sm:text-xs">
        Yükleme sihirbazı ve eşleştirme ayarları bir sonraki adımda burada açılacak.
      </div>
    </div>
  );
}

function EokulPdfImportPanel({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (!file) {
      toast.error('Dosya seçin.');
      setErrorText('Önce e-Okul veri raporu seçin: OOG01001R010 Sınıf Şube Öğrenci Sayıları (PDF/Excel).');
      return;
    }
    setErrorText(null);
    const body = new FormData();
    body.append('file', file);
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; parsed_rows: number; classes_added: number; classes_updated: number; classes_skipped: number }>(
        '/classes-subjects/classes/import/eokul-pdf',
        {
          method: 'POST',
          token,
          body,
        },
      );
      if (!res.ok) {
        toast.error('Dosya içeriği çözümlenemedi.');
        setErrorText('Dosya okundu ama sınıf/şube satırları çözümlenemedi. Rapor formatını kontrol edin.');
        return;
      }
      toast.success(
        `Aktarım tamamlandı: +${res.classes_added} yeni, ${res.classes_updated} güncellendi, ${res.classes_skipped} atlandı.`,
      );
      setFile(null);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dosya yüklenemedi';
      toast.error(msg);
      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  }, [token, file, onDone]);

  return (
    <div className="space-y-1.5 border-t border-border/70 bg-emerald-500/[0.05] px-2 py-2 sm:px-3 sm:py-3">
      <div className="rounded-xl border border-sky-500/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2 shadow-sm">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200 sm:text-[11px]">
          e-Okul veri raporu yükleme akışı (OOG01001R010)
        </div>
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
          <div className="rounded-lg border border-sky-400/30 bg-background/80 px-2 py-1">
            <p className="text-[10px] font-semibold text-foreground">1) Raporu seç</p>
            <p className="text-[10px] text-muted-foreground">Sınıf Şube Öğrenci Sayıları PDF/XLS</p>
          </div>
          <div className="rounded-lg border border-cyan-400/30 bg-background/80 px-2 py-1">
            <p className="text-[10px] font-semibold text-foreground">2) Dosyayı doğrula</p>
            <p className="text-[10px] text-muted-foreground">e-Okul veri raporu zorunlu: OOG01001R010</p>
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-background/80 px-2 py-1">
            <p className="text-[10px] font-semibold text-foreground">3) İçe aktar</p>
            <p className="text-[10px] text-muted-foreground">Yeni kayıtlar eklenir</p>
          </div>
        </div>
      </div>
      <input
        type="file"
          accept="application/pdf,.pdf,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs sm:text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          Zorunlu rapor: e-Okul OOG01001R010 Sınıf Şube Öğrenci Sayıları
        </p>
        <button
          type="button"
          disabled={!file || loading}
          onClick={handleUpload}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:text-xs"
        >
          {loading ? 'Yükleniyor…' : 'Dosya ile içe aktar'}
        </button>
      </div>
      {errorText && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive sm:text-xs">
          {errorText}
        </div>
      )}
    </div>
  );
}

function EokulSubjectsXlsImportPanel({ token, onDone }: { token: string | null; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (!file) {
      setErrorText('e-Okul Excel veri raporu seçin: OOK11003R010 Öğretmen Ders Programları.');
      return;
    }
    setErrorText(null);
    const body = new FormData();
    body.append('file', file);
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; parsed_rows: number; subjects_added: number; subjects_skipped: number }>(
        '/classes-subjects/subjects/import/eokul-program-xls',
        { method: 'POST', token, body },
      );
      if (!res.ok) {
        setErrorText('Excel çözümlenemedi.');
        return;
      }
      toast.success(`Ders aktarımı: +${res.subjects_added} yeni, ${res.subjects_skipped} tekrar atlandı.`);
      setFile(null);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Excel yüklenemedi';
      toast.error(msg);
      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  }, [token, file, onDone]);

  return (
    <div className="space-y-1.5 border-t border-border/70 bg-sky-500/5 px-2 py-2 sm:px-3 sm:py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200 sm:text-[11px]">
        e-Okul Excel veri raporu ile toplu ders yükleme (OOK11003R010)
      </div>
      <input
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs sm:text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground sm:text-xs">Zorunlu rapor: e-Okul Excel veri raporu OOK11003R010. Tekrarlı dersler birleştirilir.</p>
        <button
          type="button"
          disabled={!file || loading}
          onClick={handleUpload}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:text-xs"
        >
          {loading ? 'Yükleniyor…' : 'Excel ile ders yükle'}
        </button>
      </div>
      {errorText && <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive sm:text-xs">{errorText}</div>}
    </div>
  );
}

function ClassStudentsPanel({
  token,
  classes,
  canManage,
}: {
  token: string | null;
  classes: SchoolClass[];
  canManage: boolean;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', studentNumber: '', gender: '', birthDate: '' });
  const [importing, setImporting] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!token || !selectedClassId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<SchoolStudent[]>(`/classes-subjects/classes/${selectedClassId}/students`, { token });
      setStudents(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Öğrenciler alınamadı');
    } finally {
      setLoading(false);
    }
  }, [token, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId && classes.length) setSelectedClassId(classes[0].id);
  }, [selectedClassId, classes]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const saveStudent = useCallback(async () => {
    if (!token || !selectedClassId || !form.firstName.trim() || !form.lastName.trim()) return;
    try {
        await apiFetch(`/classes-subjects/classes/${selectedClassId}/students`, {
        method: 'POST',
        token,
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            studentNumber: form.studentNumber.trim() || undefined,
            gender: form.gender.trim() || undefined,
            birthDate: form.birthDate.trim() || undefined,
          }),
      });
      setForm({ firstName: '', lastName: '', studentNumber: '', gender: '', birthDate: '' });
      setAdding(false);
      await loadStudents();
      toast.success('Öğrenci eklendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    }
  }, [token, selectedClassId, form, loadStudents]);

  const updateStudent = useCallback(
    async (id: string, patch: { name?: string; studentNumber?: string | null; firstName?: string; lastName?: string; gender?: string | null; birthDate?: string | null }) => {
      if (!token) return;
      try {
        await apiFetch(`/classes-subjects/students/${id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(patch),
        });
        await loadStudents();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
      }
    },
    [token, loadStudents],
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      if (!token) return;
      if (!confirm('Öğrenci silinsin mi?')) return;
      try {
        await apiFetch(`/classes-subjects/students/${id}`, { method: 'DELETE', token });
        await loadStudents();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      }
    },
    [token, loadStudents],
  );

  const deleteAllStudents = useCallback(async () => {
    if (!token || !selectedClassId) return;
    if (!confirm('Bu sınıftaki tüm öğrenciler silinsin mi?')) return;
    try {
      await apiFetch(`/classes-subjects/classes/${selectedClassId}/students`, { method: 'DELETE', token });
      await loadStudents();
      toast.success('Sınıf öğrenci listesi temizlendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu silinemedi');
    }
  }, [token, selectedClassId, loadStudents]);

  const importXls = useCallback(
    async (file: File | null) => {
      if (!token || !file) return;
      const body = new FormData();
      body.append('file', file);
      setImporting(true);
      try {
        const res = await apiFetch<{ ok: boolean; imported_students: number; skipped_students: number }>(
          '/classes-subjects/students/import/eokul-class-list-xls',
          { method: 'POST', token, body },
        );
        if (res.ok) {
          toast.success(`Öğrenci aktarımı: +${res.imported_students}, atlanan ${res.skipped_students}`);
          await loadStudents();
        } else {
          toast.error('Excel içeriği çözümlenemedi');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Excel yüklenemedi');
      } finally {
        setImporting(false);
      }
    },
    [token, loadStudents],
  );

  return (
    <Card className="overflow-hidden rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/5 via-card to-card shadow-sm ring-1 ring-violet-500/10 sm:rounded-2xl">
      <CardHeader className="border-b border-violet-200/35 bg-linear-to-r from-violet-500/10 via-transparent to-sky-500/6 px-2.5 py-2 dark:border-violet-900/40 sm:px-3 sm:py-2.5">
        <CardTitle className="text-xs font-bold sm:text-base">Sınıf Listeleri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-2.5 sm:p-3">
        <div className="rounded-xl border border-violet-500/25 bg-linear-to-br from-violet-500/12 via-fuchsia-500/8 to-sky-500/10 p-2 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200 sm:text-[11px]">
            e-Okul Excel veri raporu ile tüm sınıflara toplu öğrenci yükleme (OOG01001R070)
          </div>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-3">
            <div className="rounded-lg border border-violet-400/30 bg-background/80 px-2 py-1">
              <p className="text-[10px] font-semibold text-foreground">1) Excel seç</p>
              <p className="text-[10px] text-muted-foreground">Zorunlu: e-Okul OOG01001R070 Şube Listesi (Doğum Tarihi Yaş)</p>
            </div>
            <div className="rounded-lg border border-fuchsia-400/30 bg-background/80 px-2 py-1">
              <p className="text-[10px] font-semibold text-foreground">2) Tüm sınıfları eşleştir</p>
              <p className="text-[10px] text-muted-foreground">Sınıf + şube ile tekilleştirme</p>
            </div>
            <div className="rounded-lg border border-sky-400/30 bg-background/80 px-2 py-1">
              <p className="text-[10px] font-semibold text-foreground">3) Listeyi güncelle</p>
              <p className="text-[10px] text-muted-foreground">No, adı, soyadı, cinsiyet, doğum</p>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs sm:text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {canManage && (
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-2 py-1.5 text-[10px] font-medium hover:bg-muted sm:text-xs">
              {importing ? 'Yükleniyor…' : 'Tüm Sınıflara Excel Yükle'}
              <input
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => importXls(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          Toplu yükleme için e-Okul Excel veri raporu zorunludur. Seçili sınıfa değil dosyadaki tüm sınıflara göre işler.
        </p>

        {canManage && (
          <div className="flex gap-1">
            {!adding ? (
              <>
                <button type="button" onClick={() => setAdding(true)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white sm:text-xs">
                  Öğrenci Ekle
                </button>
                <button type="button" onClick={deleteAllStudents} className="rounded-lg border border-destructive/40 px-2.5 py-1 text-[10px] font-semibold text-destructive sm:text-xs">
                  Toplu Sil
                </button>
              </>
            ) : (
              <>
                <input
                  value={form.studentNumber}
                  onChange={(e) => setForm((f) => ({ ...f, studentNumber: e.target.value }))}
                  placeholder="No"
                  className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                />
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Adı"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                />
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Soyadı"
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                />
                <input
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  placeholder="Cinsiyet"
                  className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                />
                <input
                  value={form.birthDate}
                  onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                  placeholder="YYYY-MM-DD"
                  className="w-32 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                />
                <button type="button" onClick={saveStudent} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                  Kaydet
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-input px-2.5 py-1 text-[10px]">
                  İptal
                </button>
              </>
            )}
          </div>
        )}

        <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60">
          <li className="grid grid-cols-[72px_minmax(120px,1fr)_minmax(120px,1fr)_88px_120px_auto] gap-2 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            <span>No</span>
            <span>Adı</span>
            <span>Soyadı</span>
            <span>Cinsiyet</span>
            <span>Doğum Tarihi</span>
            <span />
          </li>
          {loading ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">Yükleniyor…</li>
          ) : students.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">Bu sınıfta öğrenci yok.</li>
          ) : (
            students.map((s) => (
              <li key={s.id} className="grid grid-cols-[72px_minmax(120px,1fr)_minmax(120px,1fr)_88px_120px_auto] items-center gap-2 px-2 py-1.5">
                <input
                  defaultValue={s.studentNumber ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (s.studentNumber ?? '')) void updateStudent(s.id, { studentNumber: v || null });
                  }}
                  className="w-20 rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                />
                <input
                  defaultValue={s.firstName ?? s.name.split(' ').slice(0, -1).join(' ')}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (s.firstName ?? '')) void updateStudent(s.id, { firstName: v || '' });
                  }}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                />
                <input
                  defaultValue={s.lastName ?? s.name.split(' ').slice(-1).join(' ')}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (s.lastName ?? '')) void updateStudent(s.id, { lastName: v || '' });
                  }}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                />
                <input
                  defaultValue={s.gender ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (s.gender ?? '')) void updateStudent(s.id, { gender: v || null });
                  }}
                  className="rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                />
                <input
                  defaultValue={s.birthDate ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (s.birthDate ?? '')) void updateStudent(s.id, { birthDate: v || null });
                  }}
                  className="rounded border border-input bg-background px-1.5 py-1 text-[11px]"
                />
                {canManage && (
                  <button type="button" onClick={() => deleteStudent(s.id)} className="rounded border border-destructive/35 px-2 py-1 text-[10px] text-destructive">
                    Sil
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function ClassesSubjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const isBilsem = me?.school?.enabled_modules?.includes('bilsem') ?? false;
  const { classes, subjects, loading, error, refetch, canManage } = useSchoolClassesSubjects();
  const [classForm, setClassForm] = useState<{ name: string; grade: string; section: string } | null>(null);
  const [subjectForm, setSubjectForm] = useState<{ name: string; code: string } | null>(null);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editingSubject, setEditingSubject] = useState<SchoolSubject | null>(null);
  const [saving, setSaving] = useState(false);

  const tabParam = searchParams.get('tab');
  const tab: TabId = tabParam === 'subjects' ? 'subjects' : tabParam === 'studentLists' ? 'studentLists' : 'classes';

  const setTab = useCallback(
    (next: TabId) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', next);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (tabParam !== 'subjects' && tabParam !== 'classes' && tabParam !== 'studentLists' && tabParam !== null) {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', 'classes');
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [tabParam, pathname, router, searchParams]);

  const handleSaveClass = useCallback(async () => {
    if (!token || !classForm) return;
    const name = classForm.name.trim();
    if (!name) {
      toast.error(isBilsem ? 'Grup adı girin.' : 'Sınıf adı girin.');
      return;
    }
    setSaving(true);
    try {
      if (editingClass) {
        await apiFetch(`/classes-subjects/classes/${editingClass.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            name,
            grade: classForm.grade ? parseInt(classForm.grade, 10) : undefined,
            section: classForm.section.trim() || undefined,
          }),
        });
        toast.success(isBilsem ? 'Grup güncellendi' : 'Sınıf güncellendi');
      } else {
        await apiFetch('/classes-subjects/classes', {
          method: 'POST',
          token,
          body: JSON.stringify({
            name,
            grade: classForm.grade ? parseInt(classForm.grade, 10) : undefined,
            section: classForm.section.trim() || undefined,
          }),
        });
        toast.success(isBilsem ? 'Grup eklendi' : 'Sınıf eklendi');
      }
      setClassForm(null);
      setEditingClass(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [token, classForm, editingClass, refetch, isBilsem]);

  const handleDeleteClass = useCallback(
    async (id: string) => {
      if (!confirm(isBilsem ? 'Bu grubu silmek istediğinize emin misiniz?' : 'Bu sınıfı silmek istediğinize emin misiniz?')) return;
      if (!token) return;
      try {
        await apiFetch(`/classes-subjects/classes/${id}`, { method: 'DELETE', token });
        toast.success(isBilsem ? 'Grup silindi' : 'Sınıf silindi');
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      }
    },
    [token, refetch, isBilsem],
  );

  const handleSaveSubject = useCallback(async () => {
    if (!token || !subjectForm) return;
    const name = subjectForm.name.trim();
    if (!name) {
      toast.error('Ders adı girin.');
      return;
    }
    setSaving(true);
    try {
      if (editingSubject) {
        await apiFetch(`/classes-subjects/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ name, code: subjectForm.code.trim() || undefined }),
        });
        toast.success('Ders güncellendi');
      } else {
        await apiFetch('/classes-subjects/subjects', {
          method: 'POST',
          token,
          body: JSON.stringify({ name, code: subjectForm.code.trim() || undefined }),
        });
        toast.success('Ders eklendi');
      }
      setSubjectForm(null);
      setEditingSubject(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [token, subjectForm, editingSubject, refetch]);

  const handleDeleteSubject = useCallback(
    async (id: string) => {
      if (!confirm('Bu dersi silmek istediğinize emin misiniz?')) return;
      if (!token) return;
      try {
        await apiFetch(`/classes-subjects/subjects/${id}`, { method: 'DELETE', token });
        toast.success('Ders silindi');
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      }
    },
    [token, refetch],
  );


  if (me?.role !== 'school_admin') {
    router.replace('/403');
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  const tabDefs: { id: TabId; label: string; short: string; count: number; Icon: typeof Layers3 }[] = [
    { id: 'classes', label: 'Sınıflar/Gruplar', short: 'Sınıf/Grup', count: classes.length, Icon: Layers3 },
    { id: 'subjects', label: isBilsem ? 'Alan / dersler' : 'Dersler', short: 'Ders', count: subjects.length, Icon: Library },
    { id: 'studentLists', label: 'Sınıf Listeleri', short: 'Öğrenci', count: classes.length, Icon: Layers3 },
  ];

  const inp = 'w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs sm:px-2.5 sm:py-2 sm:text-sm';

  return (
    <div className="support-page space-y-2 pb-3 sm:space-y-3 sm:pb-5">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-2.5">
        <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-500/10 sm:size-28" aria-hidden />
        <div className="relative flex flex-col gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-9">
              <Layers3 className="size-4 sm:size-[1.05rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base">
                {isBilsem ? 'Gruplar ve Dersler' : 'Sınıflar ve Dersler'}
              </h1>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">
                {isBilsem
                  ? 'Bilsem öbekleri ve alan/ders listesi; tek kaynak.'
                  : 'Sınıf ve ders listesi ders programı ile diğer modüllerde ortak kullanılır.'}
              </p>
              <ToolbarIconHints
                compact
                showOnMobile
                className="mt-1 text-[10px] sm:text-[11px]"
                items={[
                  { label: isBilsem ? 'Gruplar' : 'Sınıflar', icon: Layers3 },
                  { label: 'Dersler', icon: Library },
                ]}
                summary="Sekmelerden yönetin; toplu içe aktarma altta."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 border-t border-border/40 pt-1.5 sm:gap-1.5 sm:pt-2">
            <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">Kullanıldığı:</span>
            {(isBilsem ? [...USED_IN_MODULES, 'Bilsem'] : USED_IN_MODULES).map((m) => (
              <span
                key={m}
                className="inline-flex max-w-[9.5rem] truncate rounded-md border border-border/50 bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:max-w-none sm:rounded-full sm:px-2 sm:text-[10px]"
                title={m}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && <Alert message={error} className="py-1.5 text-xs sm:text-sm" />}

      <div
        role="tablist"
        aria-label="Liste sekmeleri"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-linear-to-r from-emerald-500/10 via-sky-500/10 to-violet-500/10 p-1 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:max-w-xl"
      >
        {tabDefs.map(({ id, label, short, count, Icon }) => {
          const active = tab === id;
          const tone =
            id === 'classes'
              ? {
                  active: 'bg-emerald-500/18 text-emerald-900 ring-1 ring-emerald-500/40 dark:text-emerald-100',
                  badge: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200',
                  idle: 'hover:bg-emerald-500/12',
                }
              : id === 'subjects'
                ? {
                    active: 'bg-sky-500/18 text-sky-900 ring-1 ring-sky-500/40 dark:text-sky-100',
                    badge: 'bg-sky-500/20 text-sky-900 dark:text-sky-200',
                    idle: 'hover:bg-sky-500/12',
                  }
                : {
                    active: 'bg-violet-500/18 text-violet-900 ring-1 ring-violet-500/40 dark:text-violet-100',
                    badge: 'bg-violet-500/20 text-violet-900 dark:text-violet-200',
                    idle: 'hover:bg-violet-500/12',
                  };
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-center transition-colors sm:min-h-11 sm:gap-2 sm:px-2',
                active
                  ? cn('font-semibold shadow-sm', tone.active)
                  : cn('text-muted-foreground hover:text-foreground', tone.idle),
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-80 sm:size-4" aria-hidden />
              <span className="min-w-0 truncate text-[11px] leading-tight sm:hidden">{short}</span>
              <span className="hidden min-w-0 truncate text-xs leading-tight sm:inline sm:text-sm">{label}</span>
              <span
                className={cn(
                  'shrink-0 rounded-md px-1 py-px text-[9px] font-bold tabular-nums sm:text-[10px]',
                  active ? tone.badge : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'classes' && (
        <Card className="overflow-hidden rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/5 via-card to-card shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/20 sm:rounded-2xl">
          <CardHeader className="border-b border-emerald-200/35 bg-linear-to-r from-emerald-500/10 via-transparent to-sky-500/5 px-2.5 py-2 dark:border-emerald-900/40 sm:px-3 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300 sm:size-9 sm:rounded-lg">
                  <ClassIcon className="size-3.5 sm:size-4" />
                </span>
                <span className="truncate">{isBilsem ? 'Gruplar' : 'Sınıflar'}</span>
              </CardTitle>
              {canManage && !classForm && (
                <button
                  type="button"
                  onClick={() => {
                    setClassForm({ name: '', grade: '', section: '' });
                    setEditingClass(null);
                  }}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-emerald-700 sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  <Plus className="size-3 sm:size-3.5" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {classForm && (
              <div className="space-y-1.5 border-b border-border/60 bg-muted/20 p-2 sm:space-y-2 sm:p-2.5">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Grup adı' : 'Sınıf adı (örn. 7/A)'}
                  value={classForm.name}
                  onChange={(e) => setClassForm((f) => f && { ...f, name: e.target.value })}
                  className={inp}
                />
                <div className="flex gap-1 sm:gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    placeholder={isBilsem ? 'Düzey' : 'Sınıf'}
                    value={classForm.grade}
                    onChange={(e) => setClassForm((f) => f && { ...f, grade: e.target.value })}
                    className="w-[4.25rem] shrink-0 rounded-lg border border-input bg-background px-1.5 py-1.5 text-xs sm:w-24 sm:px-2 sm:py-2 sm:text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Şube"
                    value={classForm.section}
                    onChange={(e) => setClassForm((f) => f && { ...f, section: e.target.value })}
                    className={cn(inp, 'min-w-0 flex-1')}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={handleSaveClass}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClassForm(null);
                      setEditingClass(null);
                    }}
                    className="rounded-lg border border-input px-2.5 py-1 text-[10px] hover:bg-muted sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {classes.length === 0 ? (
                <li className="py-5 text-center sm:py-6">
                  <ClassIcon className="mx-auto mb-1.5 size-6 text-muted-foreground/45 sm:size-7" />
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{isBilsem ? 'Henüz grup yok' : 'Henüz sınıf yok'}</p>
                </li>
              ) : (
                classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-1.5 px-2 py-1.5 hover:bg-emerald-500/5 sm:gap-2 sm:px-2.5 sm:py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium leading-tight sm:text-[0.9375rem]">{c.name}</span>
                      {(c.grade != null || c.section) && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground sm:inline sm:ml-2 sm:text-xs">
                          {c.grade != null && (isBilsem ? `Örgün ${c.grade}` : `Sınıf ${c.grade}`)}
                          {c.section && ` · ${c.section}`}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClass(c);
                            setClassForm({
                              name: c.name,
                              grade: c.grade?.toString() ?? '',
                              section: c.section ?? '',
                            });
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Düzenle"
                        >
                          <Pencil className="size-3.5 sm:size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(c.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-3.5 sm:size-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
            {canManage ? <EokulPdfImportPanel token={token} onDone={refetch} /> : <BulkImportSettingsPanel variant="classes" isBilsem={isBilsem} />}
          </CardContent>
        </Card>
      )}

      {tab === 'subjects' && (
        <Card className="overflow-hidden rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/5 via-card to-violet-500/5 shadow-sm ring-1 ring-sky-500/10 dark:from-sky-950/20 dark:to-violet-950/15 sm:rounded-2xl">
          <CardHeader className="border-b border-sky-200/35 bg-linear-to-r from-sky-500/10 via-transparent to-violet-500/6 px-2.5 py-2 dark:border-sky-900/40 sm:px-3 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300 sm:size-9 sm:rounded-lg">
                  <SubjectIcon className="size-3.5 sm:size-4" />
                </span>
                <span className="truncate">{isBilsem ? 'Alan / dersler' : 'Dersler'}</span>
              </CardTitle>
              {canManage && !subjectForm && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectForm({ name: '', code: '' });
                    setEditingSubject(null);
                  }}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-sky-700 sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  <Plus className="size-3 sm:size-3.5" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {subjectForm && (
              <div className="space-y-1.5 border-b border-border/60 bg-muted/20 p-2 sm:space-y-2 sm:p-2.5">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Alan veya ders' : 'Ders adı'}
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, name: e.target.value })}
                  className={inp}
                />
                <input
                  type="text"
                  placeholder="Kod"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, code: e.target.value })}
                  className={inp}
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={handleSaveSubject}
                    disabled={saving}
                    className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectForm(null);
                      setEditingSubject(null);
                    }}
                    className="rounded-lg border border-input px-2.5 py-1 text-[10px] hover:bg-muted sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {subjects.length === 0 ? (
                <li className="py-5 text-center sm:py-6">
                  <SubjectIcon className="mx-auto mb-1.5 size-6 text-muted-foreground/45 sm:size-7" />
                  <p className="text-[11px] text-muted-foreground sm:text-xs">Henüz ders yok</p>
                </li>
              ) : (
                subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-1.5 px-2 py-1.5 hover:bg-sky-500/5 sm:gap-2 sm:px-2.5 sm:py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight sm:text-[0.9375rem]">{s.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.code && (
                        <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground sm:px-2 sm:py-0.5 sm:text-xs">
                          {s.code}
                        </span>
                      )}
                      {canManage && (
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubject(s);
                              setSubjectForm({ name: s.name, code: s.code ?? '' });
                            }}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Düzenle"
                          >
                            <Pencil className="size-3.5 sm:size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(s.id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Sil"
                          >
                            <Trash2 className="size-3.5 sm:size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
            {canManage ? <EokulSubjectsXlsImportPanel token={token} onDone={refetch} /> : <BulkImportSettingsPanel variant="subjects" isBilsem={isBilsem} />}
          </CardContent>
        </Card>
      )}

      {tab === 'studentLists' && <ClassStudentsPanel token={token} classes={classes} canManage={canManage} />}
    </div>
  );
}
