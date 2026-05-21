'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ChevronRight, Home, Plus, RefreshCw, ScanLine, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OPTIK_EXAM_FILTER_ORDER,
  OPTIK_EXAM_LABELS,
  OPTIK_EXAM_TAB_STYLES,
  OPTIK_SCOPE_OPTIONS,
  canModifyOptikFormTemplate,
  downloadOptikFormPdf,
  filterOptikFormTemplates,
  type OptikFormTemplate,
} from '@/lib/optik-form-templates';
import { OptikFormsNotice } from '@/components/optik/OptikTeacherGuide';
import { OptikFormTemplateList } from './components/OptikFormTemplateList';
import {
  OptikFormTemplateEditorDialog,
  type OptikFormEditorPayload,
} from './components/OptikFormTemplateEditorDialog';

export default function OptikFormlarPage() {
  const { token, role, me } = useAuth();
  const [items, setItems] = useState<OptikFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [examFilter, setExamFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<OptikFormTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<OptikFormTemplate[]>('/optik/form-templates', { token });
      setItems(data);
    } catch (e) {
      setItems([]);
      toast.error(e instanceof Error ? e.message : 'Şablonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(
    () => filterOptikFormTemplates(items, { examFilter, scopeFilter, search }),
    [items, examFilter, scopeFilter, search],
  );

  const canModify = useCallback(
    (item: OptikFormTemplate) => canModifyOptikFormTemplate(item, role, me?.id ?? null),
    [role, me?.id],
  );

  const handleDownload = async (item: OptikFormTemplate, prependBlank = 0) => {
    setDownloadingId(item.id);
    try {
      await downloadOptikFormPdf(token, item, prependBlank);
      toast.success(prependBlank > 0 ? 'Yazılı + Form PDF indirildi' : 'PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF indirilemedi');
    } finally {
      setDownloadingId(null);
    }
  };

  const openCreate = () => {
    setEditorItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item: OptikFormTemplate) => {
    setEditorItem(item);
    setEditorOpen(true);
  };

  const handleSave = async (payload: OptikFormEditorPayload) => {
    if (!token) return;
    setSaving(true);
    try {
      if (editorItem) {
        await apiFetch(`/optik/form-templates/${editorItem.id}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Şablon güncellendi');
      } else {
        await apiFetch('/optik/form-templates', {
          token,
          method: 'POST',
          body: JSON.stringify({ ...payload, formType: 'multiple_choice', pageSize: 'A4' }),
        });
        toast.success('Şablon oluşturuldu');
      }
      setEditorOpen(false);
      await fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: OptikFormTemplate) => {
    if (!token || !confirm(`"${item.name}" silinsin mi?`)) return;
    try {
      await apiFetch(`/optik/form-templates/${item.id}`, { token, method: 'DELETE' });
      toast.success('Şablon silindi');
      await fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  if (loading) return <LoadingSpinner className="mx-auto my-8 size-8" />;

  return (
    <div className="optik-formlar space-y-2 px-1.5 py-1 sm:space-y-5 sm:px-4 sm:py-4 md:px-0 md:py-0">
      {role === 'teacher' ? <OptikFormsNotice /> : null}
      <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-linear-to-r from-cyan-500/12 via-sky-500/8 to-violet-500/10 px-1.5 py-1 shadow-sm dark:from-cyan-950/30 dark:via-sky-950/20 dark:to-violet-950/25 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5">
        <Link
          href="/dashboard"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-primary sm:size-8 sm:rounded-lg"
          aria-label="Anasayfa"
        >
          <Home className="size-4 sm:size-[18px]" />
        </Link>
        <ChevronRight className="size-2.5 shrink-0 text-muted-foreground/70 sm:size-3" aria-hidden />
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-600/90 text-white shadow-sm ring-1 ring-cyan-500/30 dark:bg-cyan-600 sm:size-9 sm:rounded-lg">
          <ScanLine className="size-3.5 sm:size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xs font-bold leading-tight text-foreground sm:text-base">Optik formlar</h1>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
            {filteredItems.length}/{items.length} şablon
            {examFilter ? ` · ${OPTIK_EXAM_LABELS[examFilter] ?? examFilter}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="size-7 sm:size-8" onClick={() => void fetchItems()} title="Yenile">
            <RefreshCw className="size-3.5 sm:size-4" />
          </Button>
          {role === 'superadmin' && (
            <Link
              href="/optik-okuma-ayarlar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/80 hover:text-primary sm:size-8"
              title="Optik ayarları"
            >
              <Settings className="size-3.5 sm:size-4" />
            </Link>
          )}
          {role === 'teacher' && (
            <>
              <Link
                href="/optik-oturumlar"
                className="flex h-7 items-center gap-1 rounded-md border border-violet-500/40 px-2 text-[11px] font-medium text-violet-800 hover:bg-violet-500/10 sm:h-8 sm:text-xs dark:text-violet-200"
              >
                Oturum
              </Link>
              <Link
                href="/optik-okuma"
                className="flex h-7 items-center gap-1 rounded-md bg-fuchsia-600/90 px-2 text-[11px] font-medium text-white hover:bg-fuchsia-600 sm:h-8 sm:text-xs"
              >
                Serbest
              </Link>
            </>
          )}
          {(role === 'school_admin' || role === 'teacher') && (
            <Button size="sm" className="h-7 gap-1 px-2 text-[11px] sm:h-8 sm:text-xs" onClick={openCreate}>
              <Plus className="size-3.5" />
              Özel
            </Button>
          )}
        </div>
      </div>

      <Alert variant="info" className="text-xs">
        <strong>PDF</strong> tek sayfa optik form. <strong>Yazılı+Form</strong> yalnızca yazılı sorular için önce boş sayfa ekler.
        Yazdırma %100; okuturken dört köşe karesi ve sol şerit kadrajda olsun.
      </Alert>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-2 p-2 sm:space-y-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs sm:h-9 sm:text-sm"
              placeholder="Ad, slug, sınıf, ders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div
            className="grid grid-cols-3 gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5 dark:bg-muted/10 sm:flex sm:flex-wrap sm:gap-1.5 sm:rounded-lg sm:border-0 sm:bg-transparent sm:p-0"
            role="tablist"
            aria-label="Sınav türü"
          >
            {OPTIK_EXAM_FILTER_ORDER.map((key) => {
              const label = key === '' ? 'Tümü' : OPTIK_EXAM_LABELS[key] ?? key;
              const active = examFilter === key;
              const st = OPTIK_EXAM_TAB_STYLES[key] ?? OPTIK_EXAM_TAB_STYLES['']!;
              return (
                <button
                  key={key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setExamFilter(key)}
                  className={cn(
                    'min-h-8 rounded-md border px-1 py-1 text-center text-[9px] font-semibold leading-tight transition-colors active:scale-[0.98] sm:min-h-9 sm:rounded-lg sm:px-4 sm:py-2 sm:text-xs',
                    active ? st.active : st.idle,
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1">
            {OPTIK_SCOPE_OPTIONS.map((o) => (
              <button
                key={o.value || 'all-scope'}
                type="button"
                onClick={() => setScopeFilter(o.value)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors sm:text-xs',
                  scopeFilter === o.value
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <OptikFormTemplateList
            items={filteredItems}
            totalCount={items.length}
            downloadingId={downloadingId}
            canModify={canModify}
            onDownload={(item, pb) => void handleDownload(item, pb)}
            onEdit={openEdit}
            onDelete={(item) => void handleDelete(item)}
          />
        </CardContent>
      </Card>

      <OptikFormTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorItem}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}
