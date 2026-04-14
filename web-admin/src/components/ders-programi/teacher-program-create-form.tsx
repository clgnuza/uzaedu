'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
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
import { DersProgramiSubpageIntro } from '@/components/ders-programi/ders-programi-subpage-intro';

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
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
      <DersProgramiSubpageIntro
        title="Yeni program"
        subtitle="Adım 1: bilgiler · Adım 2: haftalık tabloya ders ekleme"
        accent="emerald"
      />

      {/* Öğretmen stepper */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/50 bg-emerald-500/[0.06] px-3 py-2.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/25 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
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

      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <PlusCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
            Program bilgileri
          </CardTitle>
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

      <Card className="rounded-xl border-dashed border-border/80 bg-muted/10">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground sm:text-sm">Resmi okul programı ve listeler için Programlarım.</p>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/ders-programi/programlarim">Programlarım</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
