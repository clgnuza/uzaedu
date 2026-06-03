'use client';

import { CheckCircle2, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanningRuleListCopy } from '@/lib/planning-rule-list-copy';
import { PLANNING_SCOPE_META, type PlanningRuleScope } from '@/lib/planning-rule-scope';

type Props = {
  title: string;
  copy: PlanningRuleListCopy;
  scope?: PlanningRuleScope;
  schoolRule?: string | null;
  supported: boolean;
  className?: string;
};

const SCOPE_STEPS: Record<PlanningRuleScope, string[]> = {
  ders: ['Ders(ler)i işaretleyin', 'Şube: tümü veya seçili', 'Öncelik: Normal (önerilen)'],
  ogretmen: ['Ders listesi boş bırakılabilir', 'Şubeyle öğretmen kapsamını daraltın', 'Normal = pencere hedefi, kilitlemez'],
  iliski: ['Tam iki ders kartı (veya A→B sırası)', 'Geçerli şubeler', 'Normal ile üretim esnetilir'],
  kisit: ['Sayı veya yasak dilimleri girin', 'İlgili dersleri seçin', 'Sabit slot: atamadan tanımlı'],
};

export function PlanningRuleInfoCard({ title, copy, scope, schoolRule, supported, className }: Props) {
  const scopeMeta = scope ? PLANNING_SCOPE_META[scope] : null;
  const steps = scope ? SCOPE_STEPS[scope] : null;
  return (
    <aside
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-xl border border-[rgb(var(--dd-accent))]/25 bg-gradient-to-br from-[rgb(var(--dd-accent))]/10 via-background to-violet-500/5 p-3 shadow-sm',
        className,
      )}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[rgb(var(--dd-accent))]">
        <Info className="size-3.5 shrink-0" />
        Seçili kural özeti
      </div>
      <div className="flex gap-3 min-w-0">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background/80 text-xl shadow-sm"
          aria-hidden
        >
          {copy.emoji}
        </span>
        <div className="min-w-0 flex-1">
        {supported ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" />
            Dağıtımda uygulanır
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            <Clock className="size-3" />
            Kayıt only — dağıtım yok
          </span>
        )}
        <p className="mt-1 text-sm font-semibold leading-snug">{copy.lead}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{copy.detail}</p>
        {scopeMeta && steps && (
          <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground">
            <li className="font-medium text-foreground/90">
              {scopeMeta.emoji} {scopeMeta.label} — {scopeMeta.editorLead}
            </li>
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-foreground/85">{title}</p>
        {schoolRule && (
          <p className="mt-1 text-[11px]">
            <span className="text-muted-foreground">Okul kuralı: </span>
            <span className="font-medium">{schoolRule}</span>
          </p>
        )}
        </div>
      </div>
    </aside>
  );
}
