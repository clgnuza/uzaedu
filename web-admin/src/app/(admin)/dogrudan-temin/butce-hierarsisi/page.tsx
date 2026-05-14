'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { DT_LEGAL_NOTICE, dtFormatNumberTr } from '@/lib/dt-ui';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ChevronDown, ChevronRight, Wallet } from 'lucide-react';
import Link from 'next/link';

type BudgetItem = {
  id: string;
  code: string | null;
  label: string;
  allocated: string;
  blocked: string;
  spent: string;
  has_children: boolean;
};

export default function DtBudgetHierarchyPage() {
  const { token, me } = useAuth();
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, BudgetItem[]>>({});

  const schoolId = (me as { school_id?: string })?.school_id ?? me?.school?.id ?? '';
  const year = new Date().getFullYear();

  const fetchRoots = useCallback(async () => {
    if (!token || !ok) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: BudgetItem[]; year: number }>(
        dtUrl(`/dogrudan-temin/budgets/hierarchy?year=${year}`, me?.role, schoolId),
        { token },
      );
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [ok, schoolId, token, me?.role, year]);

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expanded.has(id)) {
        setExpanded((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      } else {
        if (!childrenCache[id]) {
          try {
            const res = await apiFetch<BudgetItem[]>(
              dtUrl(`/dogrudan-temin/budgets/hierarchy/${id}?year=${year}`, me?.role, schoolId),
              { token },
            );
            setChildrenCache((s) => ({ ...s, [id]: res ?? [] }));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Çocuklar yüklenemedi');
            return;
          }
        }
        setExpanded((s) => new Set([...s, id]));
      }
    },
    [expanded, childrenCache, token, me?.role, schoolId, year],
  );

  useEffect(() => {
    void fetchRoots();
  }, [fetchRoots]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  if (loading) return <LoadingSpinner label="Yükleniyor…" className="py-10" />;
  if (error) return <Alert message={error} />;

  const renderItem = (item: BudgetItem, level: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(item.id);
    const children = childrenCache[item.id] ?? [];

    return (
      <div key={item.id}>
        <div className="flex items-center gap-1 border-b border-border/50 py-2 pl-2" style={{ marginLeft: `${level * 20}px` }}>
          {item.has_children ? (
            <button
              onClick={() => void toggleExpand(item.id)}
              className="inline-flex items-center justify-center rounded hover:bg-muted p-0.5"
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <Wallet className="size-3.5 text-primary" />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {item.code ? `${item.code} - ${item.label}` : item.label}
            </p>
          </div>

          <div className="flex gap-3 text-[10px] text-muted-foreground whitespace-nowrap">
            <span title="Bu hesaba tahsis edilen yıllık ödenek tutarı (kurum kaydı).">
              Ayrılan ödenek: {dtFormatNumberTr(item.allocated)}
            </span>
            <span title="Doğrudan temin dosyalarında geçici olarak ayrılmış tutar.">
              Bloke: {dtFormatNumberTr(item.blocked)}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400" title="Gerçekleşen harcama / ödeme kayıtları toplamı.">
              Harcanan: {dtFormatNumberTr(item.spent)}
            </span>
          </div>
        </div>

        {isExpanded && children.length > 0 && (
          <div>
            {children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-2">
            <Link href="/dogrudan-temin" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
              Doğrudan Temin
            </Link>
            <span className="text-muted-foreground">/</span>
            <ToolbarPageTitle className="text-base">Bütçe Hiyerarşisi</ToolbarPageTitle>
          </div>
        </ToolbarHeading>
      </Toolbar>

      <Alert variant="info" message={DT_LEGAL_NOTICE} />

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Bütçe Hesapları ({year})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {items.length ? (
            <div className="space-y-0 max-h-[600px] overflow-y-auto rounded-md border border-border">
              {items.map((item) => renderItem(item, 0))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-4">Bütçe hesabı yok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
