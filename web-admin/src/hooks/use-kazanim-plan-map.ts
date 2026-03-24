'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type PlanSummary = {
  id: string;
  subject_code: string;
  subject_label: string;
  grade: number;
  academic_year: string;
  section: string | null;
};

function normSubject(s: string): string {
  const m = (s || '').match(/^([^-–—]+?)(?:\s*[-–—]\s*|$)/);
  return (m ? m[1] : s).trim().toLowerCase();
}

function parseClassSection(cs: string): { grade: number; section: string } {
  const s = (cs || '').trim();
  const dash = s.indexOf('-');
  if (dash >= 0) {
    const grade = parseInt(s.slice(0, dash).trim(), 10);
    const section = s.slice(dash + 1).trim() || '';
    return { grade: Number.isFinite(grade) ? grade : 0, section };
  }
  const match = s.match(/^(\d+)(.*)$/);
  if (match) {
    return { grade: parseInt(match[1], 10) || 0, section: (match[2] || '').trim() };
  }
  return { grade: 0, section: '' };
}

export function useKazanimPlanMap(token: string | null, isTeacher: boolean) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  const academicYear =
    new Date().getMonth() >= 8
      ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
      : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;

  useEffect(() => {
    if (!token || !isTeacher) return;
    apiFetch<{ items: PlanSummary[] }>('/yillik-plan-icerik/teacher/plans', { token })
      .then((r) => setPlans(r.items ?? []))
      .catch(() => setPlans([]));
  }, [token, isTeacher]);

  const getKazanimHref = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plans) {
      if (p.academic_year !== academicYear) continue;
      const subj = normSubject(p.subject_label || p.subject_code || '');
      const sec = (p.section || '').toLowerCase().trim();
      m.set(`${subj}:${p.grade}:${sec}`, p.id);
    }
    return (subject: string, classSection: string): string | undefined => {
      const { grade, section } = parseClassSection(classSection);
      if (!grade || grade < 1 || grade > 12) return undefined;
      const subj = normSubject(subject);
      const sec = section.toLowerCase().trim();
      let id = m.get(`${subj}:${grade}:${sec}`);
      if (!id && sec) id = m.get(`${subj}:${grade}:`);
      if (!id) id = m.get(`${subj}:${grade}:ders`);
      return id ? `/kazanim-takip/${encodeURIComponent(id)}` : undefined;
    };
  }, [plans, academicYear]);

  return { getKazanimHref, academicYear };
}
