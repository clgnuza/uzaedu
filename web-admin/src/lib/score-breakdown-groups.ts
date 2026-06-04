import type { ProgramScoreBreakdown, ScoreDeduction, ScoreDeductionFocus } from '@/lib/ders-dagit-score-breakdown';

export type ScoreDeductionGroup = {
  id: string;
  label: string;
  detail: string;
  /** Sağ kutucukta gösterilecek özet */
  aside?: string;
  points: number;
  count: number;
  items: ScoreDeduction[];
  focus?: ScoreDeductionFocus;
  href?: string;
};

function mergedAside(items: ScoreDeduction[]): string | undefined {
  const raw = [...new Set(items.map((i) => i.aside?.trim()).filter(Boolean))] as string[];
  if (raw.length === 1) return raw[0];
  if (raw.length > 1) {
    const sections = new Set(
      items.map((i) => i.focus?.class_section?.trim()).filter(Boolean) as string[],
    );
    if (sections.size > 1) return `${sections.size} şube`;
    if (sections.size === 1) return [...sections][0];
    return `${raw.length} kayıt`;
  }
  const sec = items[0]?.focus?.class_section?.trim();
  if (sec) return sec;
  const hour = items[0]?.title.match(/(\d+)\s*saat\s+yerleşmedi/i);
  if (hour) return `${hour[1]} saat`;
  return undefined;
}

function subjectFromTitle(title: string): string | null {
  const colon = title.indexOf(':');
  if (colon <= 0) return null;
  return title.slice(0, colon).trim() || null;
}

function ruleFromTitle(title: string): string {
  const colon = title.indexOf(':');
  if (colon < 0) return title.trim();
  return title.slice(colon + 1).trim();
}

function groupKey(d: ScoreDeduction): string {
  if (d.focus?.type === 'clash') return '__clash__';
  if (d.focus?.type === 'unplaced') return '__unplaced__';
  if (d.focus?.type === 'rules') return '__rules__';
  const subj = d.focus?.subject ?? subjectFromTitle(d.title) ?? d.title;
  const rule = d.focus?.rule_key ?? ruleFromTitle(d.title);
  return `${subj.toLocaleUpperCase('tr')}::${rule}`;
}

function mergedFocus(items: ScoreDeduction[]): ScoreDeductionFocus | undefined {
  const first = items[0]?.focus;
  if (!first) {
    const subj = subjectFromTitle(items[0]?.title ?? '');
    if (subj) return { type: 'assignment', subject: subj };
    return undefined;
  }
  if (first.type === 'assignment') {
    return {
      type: 'assignment',
      subject: first.subject ?? subjectFromTitle(items[0]!.title) ?? undefined,
      rule_key: first.rule_key,
    };
  }
  return first;
}

/** Aynı ders + aynı kural maddelerini birleştirir; liste kısalır. */
export function groupScoreDeductions(breakdown: ProgramScoreBreakdown): ScoreDeductionGroup[] {
  const buckets = new Map<string, ScoreDeduction[]>();
  const order: string[] = [];

  for (const d of breakdown.deductions) {
    const key = groupKey(d);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(d);
  }

  return order.map((key) => {
    const items = buckets.get(key)!;
    const points = items.reduce((s, x) => s + x.points, 0);
    const first = items[0]!;

    if (key === '__clash__') {
      return {
        id: 'g-clash',
        label: 'Çakışmalar',
        detail: first.subtitle ?? first.title,
        aside: mergedAside(items),
        points,
        count: items.length,
        items,
        focus: { type: 'clash' },
        href: first.href,
      };
    }
    if (key === '__unplaced__') {
      return {
        id: 'g-unplaced',
        label: 'Yerleşmeyen saatler',
        detail: first.subtitle ?? first.title,
        aside: mergedAside(items),
        points,
        count: items.length,
        items,
        focus: { type: 'unplaced' },
        href: first.href,
      };
    }
    if (key === '__rules__') {
      return {
        id: 'g-rules',
        label: first.title,
        detail: first.subtitle ?? 'Yumuşak kural cezaları',
        aside: mergedAside(items),
        points,
        count: items.length,
        items,
        focus: { type: 'rules' },
        href: first.href,
      };
    }

    const subject = subjectFromTitle(first.title) ?? first.title;
    const rule = ruleFromTitle(first.title);
    const countLabel = items.length > 1 ? `${items.length} atama` : '1 atama';

    return {
      id: `g-${key}`,
      label: subject,
      detail: `${rule} · ${countLabel}`,
      aside: mergedAside(items),
      points,
      count: items.length,
      items,
      focus: mergedFocus(items),
      href: first.href,
    };
  });
}
