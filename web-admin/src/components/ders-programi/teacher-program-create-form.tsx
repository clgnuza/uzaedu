'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const TERM_OPTIONS = ['Tüm Yıl', '1. Dönem', '2. Dönem'];

export function TeacherProgramCreateForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState(
    () => `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  );
  const [term, setTerm] = useState('Tüm Yıl');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) {
      toast.error('Program adı gerekli.');
      return;
    }
    setSubmitting(true);
    try {
      const program = await apiFetch<{ id: string }>('/teacher-timetable/my-programs', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          academic_year: academicYear.trim() || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          term,
          entries: [],
        }),
      });
      toast.success('Program oluşturuldu. Ders ekleyebilirsiniz.');
      router.push(`/ders-programi/olustur/${program.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <h1 className="text-2xl font-semibold text-foreground">Yeni Program Oluştur</h1>
      </div>

      {/* Öğretmen stepper */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          1
        </span>
        <span className="font-medium">Program Bilgileri</span>
        <span className="text-muted-foreground">→</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
          2
        </span>
        <span className="text-muted-foreground">Ders Ekle</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="size-5" />
            Program Bilgileri
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Kendi ders programınızı oluşturun. Oluşturduktan sonra haftalık tabloya ders ekleyebilirsiniz.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="program-name">Program Adı *</Label>
              <Input
                id="program-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: 2024-2025 Haftalık Ders Programı"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic-year">Akademik Yıl</Label>
              <Input
                id="academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2024-2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Dönem</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger id="term">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Oluşturuluyor…' : 'Program Oluştur'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/ders-programi/programlarim">Programlarım</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Okul yöneticisi tarafından yüklenen resmi programınızı &quot;Programlarım&quot; sayfasında da
            görebilirsiniz. Kendi oluşturduğunuz programlar burada listelenir.
          </p>
          <Button variant="outline" size="sm" asChild className="mt-3">
            <Link href="/ders-programi/programlarim">Programlarımı Görüntüle</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
