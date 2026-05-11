'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Building2, CalendarDays, GraduationCap, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EvrakDefaults } from '@/components/evrak-defaults-form';

const fieldIn = cn(
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-sm',
  'transition-[color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
  'max-sm:h-8 max-sm:px-2 max-sm:text-[13px] sm:rounded-lg sm:px-3',
);
const lblRow = 'flex items-center gap-1.5 text-xs font-medium text-foreground sm:gap-2 sm:text-sm';
const iconBox =
  'flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 sm:size-7';

export function SchoolAdminBelgeForm({
  token,
  evrakDefaults,
  schoolName,
  schoolCity,
  schoolDistrict,
  schoolPrincipalName,
  onSuccess,
}: {
  token: string | null;
  evrakDefaults: EvrakDefaults;
  schoolName?: string;
  schoolCity?: string | null;
  schoolDistrict?: string | null;
  schoolPrincipalName?: string | null;
  onSuccess: () => void;
}) {
  const [ogretimYili, setOgretimYili] = useState(evrakDefaults?.ogretim_yili ?? '');
  const [mudurAdi, setMudurAdi] = useState(
    evrakDefaults?.mudur_adi?.trim() || schoolPrincipalName?.trim() || '',
  );
  const [duzenleyenAdi, setDuzenleyenAdi] = useState(evrakDefaults?.duzenleyen_adi ?? '');
  const [imzaUnvani, setImzaUnvani] = useState(evrakDefaults?.ogretmen_unvani ?? 'Müdür Yardımcısı');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOgretimYili(evrakDefaults?.ogretim_yili ?? '');
    setMudurAdi(evrakDefaults?.mudur_adi?.trim() || schoolPrincipalName?.trim() || '');
    setDuzenleyenAdi(evrakDefaults?.duzenleyen_adi ?? '');
    setImzaUnvani(evrakDefaults?.ogretmen_unvani ?? 'Müdür Yardımcısı');
  }, [evrakDefaults?.ogretim_yili, evrakDefaults?.mudur_adi, evrakDefaults?.duzenleyen_adi, evrakDefaults?.ogretmen_unvani, schoolPrincipalName]);

  const currentYearStart = (() => {
    const now = new Date();
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  })();
  const yearOptions = (() => {
    const list: string[] = [];
    for (let y = currentYearStart - 3; y <= currentYearStart + 3; y += 1) list.push(`${y} - ${y + 1}`);
    return list;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const mudur = mudurAdi.trim();
      const zumreLine = mudur ? `${mudur}|Okul Müdürü` : '';
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          evrak_defaults: {
            okul_adi: (schoolName ?? '').trim(),
            mudur_adi: mudur,
            ogretim_yili: ogretimYili.trim(),
            sinif: '',
            zumre_ogretmenleri: zumreLine,
            zumreler: zumreLine,
          ogretmen_unvani: imzaUnvani.trim(),
          duzenleyen_adi: duzenleyenAdi.trim(),
          onay_tarihi: (evrakDefaults?.onay_tarihi ?? '').trim(),
          },
        }),
      });
      toast.success('Belge varsayılanları kaydedildi');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 dark:border-border/80 dark:bg-muted/15">
        <div className={lblRow}>
          <span className={iconBox}>
            <Building2 className="size-3.5" />
          </span>
          Okul (kayıt — tam ad)
        </div>
        <p className="mt-1.5 wrap-break-word text-sm font-semibold leading-snug text-foreground">
          {(schoolName ?? '').trim() || '—'}
        </p>
        {(schoolDistrict?.trim() || schoolCity?.trim()) && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {[schoolDistrict?.trim(), schoolCity?.trim()].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Okul adı / şehir / ilçe okul kaydından gelir. Düzenlemek için <strong>Okul</strong> sekmesindeki sayfalara bakın.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="ogretim-yili" className={lblRow}>
            <span className={iconBox}>
              <CalendarDays className="size-3.5" />
            </span>
            Öğretim yılı
          </label>
          <select
            id="ogretim-yili"
            value={ogretimYili || `${currentYearStart} - ${currentYearStart + 1}`}
            onChange={(e) => setOgretimYili(e.target.value)}
            className={cn(fieldIn, 'cursor-pointer')}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Raporlarda başlıkta görünür.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mudur-adi" className={lblRow}>
            <span className={iconBox}>
              <User className="size-3.5" />
            </span>
            Okul müdürü adı (Onaylayan)
          </label>
          <input
            id="mudur-adi"
            type="text"
            value={mudurAdi}
            onChange={(e) => setMudurAdi(e.target.value)}
            maxLength={128}
            placeholder="Örn: Ahmet YILMAZ"
            className={fieldIn}
          />
          <p className="text-[11px] text-muted-foreground">Raporlarda «Onaylayan / Müdür» olarak görünür.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="duzenleyen-adi" className={lblRow}>
            <span className={iconBox}>
              <User className="size-3.5" />
            </span>
            Düzenleyen ad-soyad
          </label>
          <input
            id="duzenleyen-adi"
            type="text"
            value={duzenleyenAdi}
            onChange={(e) => setDuzenleyenAdi(e.target.value)}
            maxLength={128}
            placeholder="Örn: Ayşe DEMİR"
            className={fieldIn}
          />
          <p className="text-[11px] text-muted-foreground">
            Raporlarda «Düzenleyen» imzasında görünür. Boşsa sistem görünen adınız kullanılır.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="imza-unvani" className={lblRow}>
            <span className={iconBox}>
              <GraduationCap className="size-3.5" />
            </span>
            Düzenleyen ünvanı
          </label>
          <input
            id="imza-unvani"
            type="text"
            value={imzaUnvani}
            onChange={(e) => setImzaUnvani(e.target.value)}
            maxLength={100}
            placeholder="Örn: Müdür Yardımcısı"
            className={fieldIn}
          />
          <p className="text-[11px] text-muted-foreground">
            Raporlarda imza alanında ad-soyad altında görünür (Düzenleyen ünvanı).
          </p>
        </div>
      </div>

      <div className="flex justify-end border-t border-border/60 pt-3">
        <Button type="submit" size="sm" disabled={submitting} className="gap-2">
          <Save className="size-4" />
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </form>
  );
}
