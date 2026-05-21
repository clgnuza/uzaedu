'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { GraduationCap, Layers, User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type SchoolClass = { id: string; name: string; grade?: number | null; section?: string | null };
type SchoolSubject = { id: string; name: string; code?: string | null };

export type OptikScanMeta = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  studentId: string;
  studentLabel: string;
};

type ClassStudent = { id: string; name: string };

export function OptikScanMetaBar({
  token,
  value,
  onChange,
}: {
  token: string | null;
  value: OptikScanMeta;
  onChange: (v: OptikScanMeta) => void;
}) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<SchoolClass[]>('/classes-subjects/classes', { token }).catch(() => []),
      apiFetch<SchoolSubject[]>('/classes-subjects/subjects', { token }).catch(() => []),
    ]).then(([c, s]) => {
      setClasses(c);
      setSubjects(s);
    });
  }, [token]);

  useEffect(() => {
    if (!token || !value.classId) {
      setStudents([]);
      return;
    }
    apiFetch<ClassStudent[]>(`/classes-subjects/classes/${value.classId}/students`, { token })
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [token, value.classId]);

  const patch = (p: Partial<OptikScanMeta>) => onChange({ ...value, ...p });

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-linear-to-br from-violet-500/8 to-fuchsia-500/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
        <Layers className="size-3.5" />
        Sınıf & ders (rapor için)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={value.classId || '_'}
          onValueChange={(id) => {
            if (id === '_') {
              patch({ classId: '', className: '', studentId: '', studentLabel: '' });
              return;
            }
            const c = classes.find((x) => x.id === id);
            patch({ classId: id, className: c?.name ?? '' });
          }}
        >
          <SelectTrigger className="h-9 rounded-xl text-xs">
            <GraduationCap className="mr-1 size-3.5 shrink-0 opacity-60" />
            <SelectValue placeholder="Sınıf" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">— Sınıf seç —</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.subjectId || '_'}
          onValueChange={(id) => {
            if (id === '_') {
              patch({ subjectId: '', subjectName: '' });
              return;
            }
            const s = subjects.find((x) => x.id === id);
            patch({ subjectId: id, subjectName: s?.name ?? '' });
          }}
        >
          <SelectTrigger className="h-9 rounded-xl text-xs">
            <SelectValue placeholder="Ders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">— Ders seç —</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {students.length > 0 ? (
        <Select
          value={value.studentId || '_'}
          onValueChange={(id) => {
            if (id === '_') {
              patch({ studentId: '', studentLabel: '' });
              return;
            }
            const s = students.find((x) => x.id === id);
            patch({ studentId: id, studentLabel: s?.name ?? '' });
          }}
        >
          <SelectTrigger className="mt-2 h-9 rounded-xl text-xs">
            <User className="mr-1 size-3.5 shrink-0 opacity-60" />
            <SelectValue placeholder="Öğrenci (isteğe bağlı)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">— Öğrenci seç —</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="relative mt-2">
          <User className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={cn('h-9 rounded-xl pl-8 text-xs')}
            placeholder="Öğrenci no / ad (isteğe bağlı)"
            value={value.studentLabel}
            onChange={(e) => patch({ studentLabel: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
