'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  deleteMessagingTemplate,
  loadMessagingTemplates,
  msgQ,
  saveMessagingTemplate,
  TYPE_LABELS,
  type MessagingTemplate,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import TemplateEditorWithPreview from '../components/TemplateEditorWithPreview';
import { toast } from 'sonner';
import { Plus, Trash2, Save } from 'lucide-react';

export default function SablonlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [rows, setRows] = useState<MessagingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<MessagingTemplate | null>(null);
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('toplu_mesaj');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setRows(await loadMessagingTemplates(token, q));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, q]);

  const save = async () => {
    if (!token || !title.trim()) return toast.error('Başlık gerekli');
    try {
      await saveMessagingTemplate(token, q, {
        id: edit?.id,
        campaignType: type,
        title: title.trim(),
        body,
      });
      toast.success('Kaydedildi');
      setEdit(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-base">Şablon kütüphanesi</p>
          <p className="text-xs text-muted-foreground">Okul geneli mesaj metinleri — kampanya türüne göre</p>
        </div>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => {
            setEdit(null);
            setTitle('');
            setBody('');
            setType('toplu_mesaj');
          }}
        >
          <Plus className="size-4" />
          Yeni
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setEdit(t);
              setTitle(t.title);
              setBody(t.body);
              setType(t.campaignType);
            }}
            className="rounded-xl border bg-white/80 p-3 text-left hover:border-indigo-300 dark:bg-zinc-900/60"
          >
            <p className="text-xs font-semibold text-indigo-600">{TYPE_LABELS[t.campaignType] ?? t.campaignType}</p>
            <p className="font-semibold text-sm">{t.title}</p>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.body}</p>
          </button>
        ))}
      </div>

      {(edit || title || body) && (
        <div className="rounded-2xl border p-4 space-y-3 bg-white/80 dark:bg-zinc-900/60">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Şablon adı" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-lg border px-3 text-sm dark:bg-zinc-900"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <TemplateEditorWithPreview value={body} onChange={setBody} rows={10} />
          <div className="flex gap-2">
            <Button className="gap-1" onClick={() => void save()}>
              <Save className="size-4" />
              Kaydet
            </Button>
            {edit && !edit.isSystem ? (
              <Button
                variant="outline"
                className="gap-1 text-red-600"
                onClick={async () => {
                  if (!confirm('Silinsin mi?')) return;
                  await deleteMessagingTemplate(token ?? '', edit.id, q);
                  toast.success('Silindi');
                  setEdit(null);
                  void load();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
