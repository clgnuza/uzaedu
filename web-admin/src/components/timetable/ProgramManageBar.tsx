'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import {
  archiveProgram,
  cloneProgram,
  deleteProgram,
  patchProgramName,
  setFavoriteProgram,
  type DdProgramRow,
} from '@/lib/ders-dagit-program-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Archive, Copy, Pencil, Star, Trash2 } from 'lucide-react';

type Props = {
  programId: string;
  program: DdProgramRow | null;
  onChanged: (next?: { selectId?: string; removedId?: string }) => void | Promise<void>;
  compact?: boolean;
};

export function ProgramManageBar({ programId, program, onChanged, compact }: Props) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (!programId || !token || !studio) return null;

  const published = program?.status === 'published';
  const favorite = !!program?.is_favorite;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  const btn = compact ? 'sm' : 'sm';

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
        <Button
          type="button"
          size={btn}
          variant="outline"
          disabled={busy}
          onClick={() => {
            setNameDraft(program?.name ?? '');
            setRenameOpen(true);
          }}
        >
          <Pencil className="mr-1 size-3.5" />
          Ad
        </Button>
        <Button
          type="button"
          size={btn}
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const copy = await cloneProgram(token, studio.id, programId);
              toast.success('Kopya oluşturuldu');
              await onChanged({ selectId: copy.id });
            })
          }
        >
          <Copy className="mr-1 size-3.5" />
          Kopyala
        </Button>
        <Button
          type="button"
          size={btn}
          variant={favorite ? 'default' : 'outline'}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await setFavoriteProgram(token, studio.id, programId);
              toast.success('Favori güncellendi');
              await onChanged();
            })
          }
        >
          <Star className={`mr-1 size-3.5 ${favorite ? 'fill-current' : ''}`} />
          Favori
        </Button>
        <Button
          type="button"
          size={btn}
          variant="outline"
          disabled={busy || published}
          title={published ? 'Yayındaki program arşivlenemez' : undefined}
          onClick={() => {
            if (!window.confirm('Program arşive alınsın mı?')) return;
            void run(async () => {
              await archiveProgram(token, studio.id, programId);
              toast.success('Arşivlendi');
              await onChanged({ removedId: programId });
            });
          }}
        >
          <Archive className="mr-1 size-3.5" />
          Arşivle
        </Button>
        <Button
          type="button"
          size={btn}
          variant="destructive"
          disabled={busy || published}
          title={published ? 'Yayındaki program silinemez' : undefined}
          onClick={() => {
            if (!window.confirm('Program kalıcı silinsin mi?')) return;
            void run(async () => {
              await deleteProgram(token, studio.id, programId);
              toast.success('Silindi');
              await onChanged({ removedId: programId });
            });
          }}
        >
          <Trash2 className="mr-1 size-3.5" />
          Sil
        </Button>
        {!compact && (
          <Button type="button" size={btn} variant="ghost" asChild>
            <Link href="/ders-dagit/studyo/arsiv">Arşiv</Link>
          </Button>
        )}
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Program adı</DialogTitle>
            <DialogDescription>Liste ve dışa aktarmada görünen ad.</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Ad</Label>
            <Input className="mt-1" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={busy || !nameDraft.trim()}
              onClick={() =>
                void run(async () => {
                  await patchProgramName(token, studio.id, programId, nameDraft.trim());
                  toast.success('Kaydedildi');
                  setRenameOpen(false);
                  await onChanged();
                })
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
