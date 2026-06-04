'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileImage, FileText, MessageSquare, Share2, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  classifyShareFiles,
  clearShareFiles,
  clearShareText,
  peekShareFiles,
  peekShareText,
  saveShareText,
  setShareTarget,
} from '@/lib/pwa-share-intake';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { hapticTap } from '@/lib/pwa-haptic';

function GelenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [text, setText] = useState(peekShareText());
  const [fileCount, setFileCount] = useState(0);
  const [fileKind, setFileKind] = useState<'image' | 'pdf' | 'mixed' | 'other'>('other');

  useEffect(() => {
    if (!token) {
      router.replace(`/login/ogretmen?redirect=${encodeURIComponent('/pwa/gelen')}`);
      return;
    }
    const title = searchParams.get('title') ?? undefined;
    const sharedText = searchParams.get('text') ?? undefined;
    const url = searchParams.get('url') ?? undefined;
    if (title || sharedText || url) {
      saveShareText({ title, text: sharedText, url });
      setText(peekShareText());
      trackPwaEvent('pwa_share_target', { has_url: !!url });
    }
    void peekShareFiles().then((files) => {
      setFileCount(files.length);
      if (files.length) setFileKind(classifyShareFiles(files));
    });
  }, [token, router, searchParams]);

  const dismiss = async () => {
    clearShareText();
    await clearShareFiles();
    router.push('/dashboard');
  };

  const go = (target: 'optik' | 'evrak' | 'mesaj', href: string) => {
    hapticTap();
    setShareTarget(target);
    if (target === 'mesaj') {
      const t = peekShareText();
      if (t?.text || t?.url) {
        try {
          sessionStorage.setItem('pwa-mesaj-draft', [t.title, t.text, t.url].filter(Boolean).join('\n'));
        } catch {
          /* ignore */
        }
      }
      clearShareText();
    }
    trackPwaEvent('pwa_share_route', { target });
    router.push(href);
  };

  if (!token) return null;

  const hasText = !!(text?.text?.trim() || text?.url?.trim() || text?.title?.trim());
  const showMesaj = hasText;
  const showOptik = fileCount > 0 && (fileKind === 'image' || fileKind === 'mixed');
  const showEvrak = fileCount > 0 && (fileKind === 'pdf' || fileKind === 'mixed');

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600">
          <Share2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">Paylaşılan içerik</h1>
          <p className="text-sm text-muted-foreground">Hangi modülde açmak istediğinizi seçin.</p>
        </div>
        <button type="button" onClick={() => void dismiss()} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Kapat">
          <X className="size-4" />
        </button>
      </div>

      {hasText ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          {text?.title ? <p className="font-medium">{text.title}</p> : null}
          {text?.text ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{text.text}</p> : null}
          {text?.url ? (
            <p className="mt-1 truncate text-xs text-primary">{text.url}</p>
          ) : null}
        </div>
      ) : null}

      {fileCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {fileCount} dosya hazır
          {fileKind === 'mixed' ? ' (görsel + PDF)' : ''}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {showOptik ? (
          <Button type="button" className="justify-start gap-2" onClick={() => void go('optik', '/optik-okuma?from_share=1')}>
            <FileImage className="size-4" />
            Optik okuma
          </Button>
        ) : null}
        {showEvrak ? (
          <Button type="button" variant="secondary" className="justify-start gap-2" onClick={() => void go('evrak', '/evrak?from_share=1')}>
            <FileText className="size-4" />
            Evrak
          </Button>
        ) : null}
        {showMesaj ? (
          <Button type="button" variant="secondary" className="justify-start gap-2" onClick={() => void go('mesaj', '/mesaj-merkezi?from_share=1')}>
            <MessageSquare className="size-4" />
            Mesaj merkezi
          </Button>
        ) : null}
        {!showOptik && !showEvrak && !showMesaj ? (
          <p className="text-sm text-muted-foreground">İşlenecek paylaşım bulunamadı.</p>
        ) : null}
      </div>

      <Button type="button" variant="ghost" onClick={() => void dismiss()}>
        Vazgeç
      </Button>
    </main>
  );
}

export default function PwaGelenPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Yükleniyor…</div>}>
      <GelenContent />
    </Suspense>
  );
}
