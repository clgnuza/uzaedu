'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { parseKazanimPlanId } from '@/lib/kazanim-plan-id';
import type { OutcomeInsights, QuestionOutcomeMeta } from '@/lib/optik-sessions-api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { FileText, LayoutGrid, Target, Link2 } from 'lucide-react';

type ButterflyPlan = { id: string; title: string };
type KazanimPlan = { id: string; subject_label: string; grade: number; academic_year: string };
type PlanItem = {
  id: string;
  weekOrder: number;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
};

export function SessionIntegrations({
  token,
  role,
  schoolIdParam,
  sessionId,
  questionCount,
  butterflyPlanId,
  outcomePlanKey,
  questionOutcomes,
  onLinksSaved,
  onOutcomesSaved,
  insights,
  onRefreshInsights,
  onOutcomePdf,
}: {
  token: string | null;
  role: string | null;
  schoolIdParam: string | null;
  sessionId: string;
  questionCount: number;
  butterflyPlanId: string | null;
  outcomePlanKey: string | null;
  questionOutcomes: Record<string, QuestionOutcomeMeta>;
  onLinksSaved: (butterfly: string | null, outcome: string | null) => void | Promise<void>;
  onOutcomesSaved: (q: Record<string, QuestionOutcomeMeta>) => void | Promise<void>;
  insights: OutcomeInsights | null;
  onRefreshInsights: () => void;
  onOutcomePdf?: () => void;
}) {
  const [bPlans, setBPlans] = useState<ButterflyPlan[]>([]);
  const [kPlans, setKPlans] = useState<KazanimPlan[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [bId, setBId] = useState(butterflyPlanId ?? '');
  const [kId, setKId] = useState(outcomePlanKey ?? '');
  const [outcomes, setOutcomes] = useState(questionOutcomes);
  const [saving, setSaving] = useState(false);

  const schoolQ = butterflyExamApiQuery(role, schoolIdParam);

  useEffect(() => {
    setBId(butterflyPlanId ?? '');
    setKId(outcomePlanKey ?? '');
    setOutcomes(questionOutcomes);
  }, [butterflyPlanId, outcomePlanKey, questionOutcomes]);

  useEffect(() => {
    if (!token) return;
    void Promise.all([
      apiFetch<ButterflyPlan[]>(`/butterfly-exam/plans${schoolQ}`, { token })
        .then((list) =>
          list.filter((p) => (p as { rules?: { planType?: string } }).rules?.planType !== 'period'),
        )
        .catch(() => []),
      apiFetch<{ items: KazanimPlan[] }>('/yillik-plan-icerik/teacher/plans', { token })
        .then((r) => r.items)
        .catch(() => []),
    ]).then(([bp, kp]) => {
      setBPlans(bp);
      setKPlans(kp);
    });
  }, [token, schoolQ]);

  const loadPlanItems = useCallback(async () => {
    if (!token || !kId) {
      setPlanItems([]);
      return;
    }
    const key = parseKazanimPlanId(kId);
    if (!key) return;
    const query = new URLSearchParams({
      subject_code: key.subject_code,
      grade: String(key.grade),
      academic_year: key.academic_year,
    });
    if (key.section) query.set('section', key.section);
    const resp = await apiFetch<{ items: PlanItem[] }>(
      `/yillik-plan-icerik/teacher/plan-content?${query}`,
      { token },
    ).catch(() => null);
    setPlanItems(resp?.items ?? []);
  }, [token, kId]);

  useEffect(() => {
    void loadPlanItems();
  }, [loadPlanItems]);

  const saveLinks = async () => {
    setSaving(true);
    try {
      await onLinksSaved(bId || null, kId || null);
    } finally {
      setSaving(false);
    }
  };

  const saveOutcomes = async () => {
    setSaving(true);
    try {
      await onOutcomesSaved(outcomes);
      onRefreshInsights();
    } finally {
      setSaving(false);
    }
  };

  const pickItem = (q: number, itemId: string) => {
    const item = planItems.find((x) => x.id === itemId);
    if (!item) return;
    const label =
      (item.kazanimlar?.split('\n')[0]?.trim() || item.konu || item.unite || `Hafta ${item.weekOrder}`).slice(
        0,
        120,
      );
    setOutcomes((prev) => ({
      ...prev,
      [String(q)]: {
        label,
        plan_item_id: item.id,
        week_order: item.weekOrder,
        konu: item.konu ?? undefined,
      },
    }));
  };

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border bg-card p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <LayoutGrid className="size-4 text-indigo-600" />
          Kelebek sınav planı
        </h3>
        <Select value={bId || '_'} onValueChange={(v) => setBId(v === '_' ? '' : v)}>
          <SelectTrigger className="h-10 rounded-xl text-xs">
            <SelectValue placeholder="Plan seç" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Bağlı değil</SelectItem>
            {bPlans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {bId ? (
          <Link
            href={`/kelebek-sinav/sinav-olustur?plan_id=${bId}`}
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <Link2 className="size-3" />
            Kelebek planına git
          </Link>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <Target className="size-4 text-emerald-600" />
          Kazanım planı
        </h3>
        <Select value={kId || '_'} onValueChange={(v) => setKId(v === '_' ? '' : v)}>
          <SelectTrigger className="h-10 rounded-xl text-xs">
            <SelectValue placeholder="Yıllık plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">Bağlı değil</SelectItem>
            {kPlans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.subject_label} · {p.grade}. sınıf
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kId ? (
          <Link
            href={`/kazanim-takip/${encodeURIComponent(kId)}`}
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            <Link2 className="size-3" />
            Kazanım planına git
          </Link>
        ) : null}
        <Button className="mt-2 h-9 w-full rounded-xl text-xs" disabled={saving} onClick={() => void saveLinks()}>
          Bağlantıları kaydet
        </Button>
      </section>

      {kId && planItems.length > 0 ? (
        <section className="rounded-2xl border bg-card p-3">
          <h3 className="mb-2 text-xs font-semibold">Soru → kazanım eşlemesi</h3>
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
            {Array.from({ length: questionCount }, (_, i) => i + 1).map((q) => (
              <div key={q} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-[10px] font-bold text-muted-foreground">S{q}</span>
                <Select
                  value={outcomes[String(q)]?.plan_item_id ?? '_'}
                  onValueChange={(v) => (v === '_' ? setOutcomes((p) => {
                    const n = { ...p };
                    delete n[String(q)];
                    return n;
                  }) : pickItem(q, v))}
                >
                  <SelectTrigger className="h-8 flex-1 rounded-lg text-[10px]">
                    <SelectValue placeholder="Kazanım seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {planItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        H{it.weekOrder} {it.konu?.slice(0, 40) ?? it.unite?.slice(0, 40) ?? '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button className="mt-2 h-9 w-full rounded-xl text-xs" disabled={saving} onClick={() => void saveOutcomes()}>
            Eşlemeyi kaydet
          </Button>
        </section>
      ) : null}

      {insights && insights.weak_outcomes.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-100">Zayıf kazanımlar</h3>
            {onOutcomePdf ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg text-[10px]"
                onClick={() => onOutcomePdf()}
              >
                <FileText className="mr-1 size-3" />
                PDF
              </Button>
            ) : null}
          </div>
          <ul className="space-y-1 text-[10px]">
            {insights.weak_outcomes.map((w) => (
              <li key={w.question} className="flex justify-between gap-2">
                <span className="truncate">
                  S{w.question} · {w.label}
                </span>
                <span className="shrink-0 tabular-nums">%{Math.round(w.correct_pct)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
