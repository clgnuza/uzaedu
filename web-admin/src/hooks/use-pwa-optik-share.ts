'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { clearShareFiles, peekShareFiles, takeShareTarget } from '@/lib/pwa-share-intake';
import { optikToast } from '@/lib/optik-toast';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Paylaşılan görseli optik MC taramasına aktarır */
export function usePwaOptikShare(runMcDecode: (input: string | string[]) => Promise<void>, hasTemplate: boolean) {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (searchParams.get('from_share') !== '1') return;
    const target = takeShareTarget();
    if (target && target !== 'optik') return;
    void peekShareFiles().then((files) => {
      const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));
      setFileCount(imgs.length);
      setPending(imgs.length > 0);
    });
  }, [searchParams]);

  const importShare = useCallback(async () => {
    const files = await peekShareFiles();
    const img = files.find((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!img) {
      optikToast.warn('Paylaşım', 'Görsel bulunamadı');
      return;
    }
    if (!hasTemplate) {
      optikToast.warn('Şablon', 'Önce bir optik şablon seçin');
      return;
    }
    try {
      const b64 = await fileToDataUrl(img);
      await runMcDecode(b64);
      await clearShareFiles();
      setPending(false);
      setFileCount(0);
    } catch (e) {
      optikToast.error(e, 'scan');
    }
  }, [hasTemplate, runMcDecode]);

  return { pending, fileCount, importShare };
}
