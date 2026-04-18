'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Quote, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { formatTrDateTimeMedium } from '@/lib/format-tr-datetime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Detail = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  status: string;
  notify_email_sent: boolean;
  first_read_at: string | null;
  reply_sent_at: string | null;
  reply_body: string | null;
  replied_by: { id: string; display_name: string } | null;
};

export default function ContactInboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, me } = useAuth();
  const [row, setRow] = useState<Detail | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const allowed = me?.role === 'superadmin' || me?.role === 'moderator';

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const d = await apiFetch<Detail>(`/admin/contact-submissions/${id}`, { token });
      setRow(d);
    } catch {
      toast.error('Kayıt yüklenemedi');
      router.replace('/contact-inbox');
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendReply = async () => {
    if (!token || !id || !reply.trim()) return;
    setSending(true);
    try {
      const out = await apiFetch<Detail>(`/admin/contact-submissions/${id}/reply`, {
        method: 'POST',
        token,
        body: JSON.stringify({ message: reply.trim() }),
      });
      setRow(out);
      setReply('');
      toast.success('Yanıt gönderildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const setArchived = async (archived: boolean) => {
    if (!token || !id) return;
    try {
      const out = await apiFetch<Detail>(`/admin/contact-submissions/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: archived ? 'archived' : 'new' }),
      });
      setRow(out);
      toast.success(archived ? 'Arşivlendi' : 'Yeniden açıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  if (!allowed) return null;
  if (loading || !row) {
    return <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  const canReply = !row.reply_sent_at;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/contact-inbox">
            <ArrowLeft className="size-4" />
            Liste
          </Link>
        </Button>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-violet-500/15 bg-linear-to-br from-violet-500/10 via-background to-cyan-500/8',
          'shadow-sm ring-1 ring-violet-500/10 dark:from-violet-950/35 dark:via-background dark:to-cyan-950/20',
        )}
      >
        <div className="h-1 bg-linear-to-r from-violet-500 via-fuchsia-500 to-cyan-500" aria-hidden />
        <div className="space-y-1 px-5 pb-4 pt-5 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">İletişim kaydı</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{row.subject}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/90">{row.name}</span>
            <span className="mx-1.5 text-border">·</span>
            <a href={`mailto:${row.email}`} className="text-primary underline-offset-2 hover:underline">
              {row.email}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">{formatTrDateTimeMedium(row.created_at)}</p>
          {!row.notify_email_sent ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Bildirim e-postası gönderilemedi (SMTP kapalı veya hata). Kayıt yine de saklandı.
            </p>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-md">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-start gap-2">
            <Quote className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <div>
              <CardTitle className="text-base font-semibold">Gelen mesaj</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                E-postadaki “Alıntı” bölümünde konu, adınız ve bu metin birlikte gösterilir.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div
            className={cn(
              'relative whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-slate-50/90 p-4 text-sm leading-relaxed text-slate-800',
              'dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-slate-100',
              'before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:bg-linear-to-b before:from-violet-500 before:to-cyan-500 before:content-[""]',
              'pl-5',
            )}
          >
            {row.message}
          </div>

          <details className="group rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-sm">
            <summary className="cursor-pointer list-none font-medium text-foreground outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-3.5 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
                E-postada nasıl görünecek?
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">(özet)</span>
              </span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <p>
                Konu satırı: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">[Uzaedu] Re: …</code>
              </p>
              <p>Üstte kişisel selam, ortada yanıtınız, altta tablo ile konu / gönderen adı ve monospaced alıntı kutusu.</p>
              <p>İmza: yanıtı gönderen hesabın adı veya e-postası.</p>
            </div>
          </details>

          {row.reply_sent_at ? (
            <div
              className={cn(
                'rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/8 via-background to-teal-500/5 p-4',
                'ring-1 ring-emerald-500/10',
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Gönderilen yanıt · {formatTrDateTimeMedium(row.reply_sent_at)}
                {row.replied_by ? ` · ${row.replied_by.display_name}` : ''}
              </p>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{row.reply_body}</div>
            </div>
          ) : null}

          {canReply ? (
            <div
              className={cn(
                'space-y-3 rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/5 via-background to-cyan-500/5 p-4',
                'ring-1 ring-violet-500/10 sm:p-5',
              )}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">Yanıt yaz</p>
                <p className="text-xs text-muted-foreground">
                  Gövde sadece yazdığınız metin olur; alıcıya konu ve ileti özeti otomatik eklenir.
                </p>
              </div>
              <textarea
                value={reply}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReply(e.target.value)}
                rows={8}
                placeholder="Kısa ve net yazın; teknik detay veya sonraki adım varsa belirtin."
                className={cn(
                  'min-h-[160px] w-full resize-y rounded-xl border border-violet-500/15 bg-background/95 px-4 py-3 text-sm leading-relaxed shadow-inner',
                  'placeholder:text-muted-foreground/70 focus-visible:border-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25',
                )}
              />
              <Button
                type="button"
                disabled={sending || !reply.trim()}
                onClick={() => void sendReply()}
                className="gap-2 rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 text-white shadow-md hover:opacity-95"
              >
                <Send className="size-4" />
                {sending ? 'Gönderiliyor…' : 'E-posta ile gönder'}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
            {row.status !== 'archived' ? (
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void setArchived(true)}>
                Arşivle
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void setArchived(false)}>
                Arşivden çıkar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
