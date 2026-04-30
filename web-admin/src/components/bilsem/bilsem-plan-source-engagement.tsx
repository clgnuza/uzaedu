'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SourcePayload = {
  has_community_source: boolean;
  submission_id: string | null;
  author_label: string | null;
  like_count: number;
  user_liked: boolean;
  comments: { id: string; body: string; author_label: string; created_at: string }[];
};

type Props = {
  token: string | null;
  subjectCode: string;
  anaGrup: string;
  altGrup: string;
  academicYear: string;
};

function fmtShort(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export function BilsemPlanSourceEngagement({ token, subjectCode, anaGrup, altGrup, academicYear }: Props) {
  const [data, setData] = useState<SourcePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const canQuery =
    !!token && !!subjectCode?.trim() && !!anaGrup?.trim() && !!academicYear?.trim();

  const load = useCallback(async () => {
    if (!canQuery) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const p = new URLSearchParams({
        subject_code: subjectCode.trim(),
        ana_grup: anaGrup.trim(),
        academic_year: academicYear.trim(),
      });
      if (altGrup?.trim()) p.set('alt_grup', altGrup.trim());
      const res = await apiFetch<SourcePayload>(`/bilsem/plan-engagement/source?${p.toString()}`, {
        token: token!,
      });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canQuery, token, subjectCode, anaGrup, altGrup, academicYear]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!token || !data?.submission_id) return;
    setLikeBusy(true);
    try {
      const r = await apiFetch<{ liked: boolean; like_count: number }>(
        `/bilsem/plan-engagement/${encodeURIComponent(data.submission_id)}/like`,
        { token, method: 'POST', body: '{}' },
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              user_liked: r.liked,
              like_count: r.like_count,
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      setLikeBusy(false);
    }
  }

  async function sendComment() {
    if (!token || !data?.submission_id) return;
    const t = commentDraft.trim();
    if (!t) return;
    setSending(true);
    try {
      const row = await apiFetch<{
        id: string;
        body: string;
        author_label: string;
        created_at: string;
      }>(`/bilsem/plan-engagement/${encodeURIComponent(data.submission_id)}/comments`, {
        token,
        method: 'POST',
        body: JSON.stringify({ body: t }),
      });
      setCommentDraft('');
      setData((prev) =>
        prev
          ? {
              ...prev,
              comments: [row, ...prev.comments],
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSending(false);
    }
  }

  if (!canQuery) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2.5 text-[11px] text-muted-foreground sm:px-4 sm:text-sm">
        Plan kaynağı yükleniyor…
      </div>
    );
  }

  if (!data?.has_community_source) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.07] to-transparent px-3 py-3 sm:px-4 sm:py-3.5',
        'dark:border-violet-500/20 dark:from-violet-950/30',
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-violet-950 dark:text-violet-100 sm:text-sm">
            <User className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
            Topluluk planı
          </p>
          <p className="text-[11px] leading-snug text-foreground/90 sm:text-sm">
            İçerik paylaşan:{' '}
            <span className="font-semibold text-foreground">
              {data.author_label?.trim() || 'Katılımcı'}
            </span>
            <span className="text-muted-foreground"> · onaylı katkı</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={data.user_liked ? 'default' : 'outline'}
            className={cn('h-8 gap-1 px-2.5 text-xs', data.user_liked && 'bg-rose-600 hover:bg-rose-600/90')}
            disabled={likeBusy}
            onClick={() => void toggleLike()}
            title="Beğen"
          >
            <Heart className={cn('size-3.5', data.user_liked && 'fill-current')} />
            {data.like_count}
          </Button>
        </div>
      </div>

      <div className="mt-3 border-t border-violet-400/20 pt-3 dark:border-violet-500/15">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <MessageCircle className="size-3" />
          Yorumlar
        </p>
        <ul className="max-h-36 space-y-2 overflow-y-auto text-[11px] sm:max-h-40 sm:text-xs">
          {data.comments.length === 0 ? (
            <li className="text-muted-foreground">Henüz yorum yok. İlk yorumu siz yazın.</li>
          ) : (
            data.comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border/60 bg-background/60 px-2 py-1.5 leading-snug"
              >
                <span className="font-medium text-foreground">{c.author_label}</span>
                <span className="text-[10px] text-muted-foreground"> · {fmtShort(c.created_at)}</span>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{c.body}</p>
              </li>
            ))
          )}
        </ul>
        <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-end">
          <textarea
            className="min-h-[56px] flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-xs shadow-sm sm:text-sm"
            placeholder="Görüşünüzü yazın…"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            maxLength={2000}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0"
            disabled={sending || !commentDraft.trim()}
            onClick={() => void sendComment()}
          >
            Gönder
          </Button>
        </div>
      </div>
    </div>
  );
}
