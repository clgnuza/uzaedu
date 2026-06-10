'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Fingerprint, Landmark, MapPin, Save, Shield } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import type { EvrakDefaults } from '@/providers/auth-provider';

export const officialFieldIn = cn(
  'h-9 w-full rounded-xl border border-input bg-background/90 px-3 text-sm shadow-sm',
  'transition-[border-color,box-shadow] focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20',
);

export type YollukTeacher = NonNullable<NonNullable<EvrakDefaults>['yolluk_teacher']>;

export type OfficialProfileState = {
  tc: string;
  iban: string;
  kadroDerece: string;
  kadroKademe: string;
  adresIl: string;
  adresIlce: string;
};

export function officialStateFromDefaults(evrakDefaults: EvrakDefaults): OfficialProfileState {
  const y = evrakDefaults?.yolluk_teacher ?? {};
  return {
    tc: y.tc_kimlik ?? '',
    iban: y.iban ?? '',
    kadroDerece: y.kadro_derecesi != null ? String(y.kadro_derecesi) : '',
    kadroKademe: y.kadro_kademesi ?? '',
    adresIl: y.adres_il ?? '',
    adresIlce: y.adres_ilce ?? '',
  };
}

export function serializeOfficialProfile(state: OfficialProfileState): { payload?: YollukTeacher; error?: string } {
  const tcTrim = state.tc.replace(/\D/g, '').slice(0, 11);
  if (tcTrim && tcTrim.length !== 11) {
    return { error: 'T.C. kimlik 11 haneli olmalıdır.' };
  }
  const ibanNorm = state.iban.replace(/\s/g, '').toUpperCase();
  if (ibanNorm && !/^TR[0-9A-Z]{24}$/.test(ibanNorm) && ibanNorm.length < 15) {
    return { error: 'Geçerli bir IBAN girin.' };
  }
  return {
    payload: {
      tc_kimlik: tcTrim || undefined,
      iban: ibanNorm || undefined,
      kadro_derecesi: state.kadroDerece ? Math.min(15, Math.max(1, parseInt(state.kadroDerece, 10))) : undefined,
      kadro_kademesi: state.kadroKademe.trim() || undefined,
      adres_il: state.adresIl.trim() || undefined,
      adres_ilce: state.adresIlce.trim() || undefined,
    },
  };
}

export function TeacherOfficialProfileFields({
  state,
  onChange,
  fieldClass = officialFieldIn,
  hint = 'İsteğe bağlı. Yolluk ve resmî formlarda kullanılır; KVKK kapsamında yalnızca öğretmen ve yetkili yönetici görür.',
}: {
  state: OfficialProfileState;
  onChange: (next: OfficialProfileState) => void;
  fieldClass?: string;
  hint?: string;
}) {
  const set = (patch: Partial<OfficialProfileState>) => onChange({ ...state, ...patch });

  return (
    <div className="rounded-2xl border border-violet-200/50 bg-linear-to-br from-violet-500/8 via-fuchsia-500/5 to-sky-500/8 p-3 dark:border-violet-900/40 dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-sky-950/25 sm:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200">
          <Shield className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Resmî bilgiler</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{hint}</p>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Fingerprint className="size-3.5 text-violet-600" aria-hidden />
            T.C. kimlik
          </span>
          <input
            inputMode="numeric"
            maxLength={11}
            value={state.tc}
            onChange={(e) => set({ tc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
            placeholder="11 hane"
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <CreditCard className="size-3.5 text-violet-600" aria-hidden />
            IBAN
          </span>
          <input
            value={state.iban}
            onChange={(e) => set({ iban: e.target.value.toUpperCase() })}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            maxLength={34}
            className={cn(fieldClass, 'font-mono text-[13px]')}
          />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Landmark className="size-3.5 text-violet-600" aria-hidden />
            Kadro derecesi
          </span>
          <select value={state.kadroDerece} onChange={(e) => set({ kadroDerece: e.target.value })} className={fieldClass}>
            <option value="">Seçin</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>{n}. derece</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Kademe</span>
          <input
            value={state.kadroKademe}
            onChange={(e) => set({ kadroKademe: e.target.value })}
            placeholder="örn. 3"
            maxLength={16}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MapPin className="size-3.5 text-violet-600" aria-hidden />
            İl
          </span>
          <select
            value={state.adresIl}
            onChange={(e) => set({ adresIl: e.target.value, adresIlce: '' })}
            className={fieldClass}
          >
            <option value="">Seçin</option>
            {TURKEY_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">İlçe</span>
          <select
            value={state.adresIlce}
            onChange={(e) => set({ adresIlce: e.target.value })}
            disabled={!state.adresIl}
            className={fieldClass}
          >
            <option value="">{state.adresIl ? 'Seçin' : 'Önce il'}</option>
            {getDistrictsForCity(state.adresIl, []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function TeacherOfficialProfileForm({
  token,
  evrakDefaults,
  userId,
  onSuccess,
}: {
  token: string | null;
  evrakDefaults: EvrakDefaults;
  /** Okul yöneticisi: PATCH /users/:id */
  userId?: string;
  onSuccess?: () => void;
}) {
  const [state, setState] = useState<OfficialProfileState>(() => officialStateFromDefaults(evrakDefaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(officialStateFromDefaults(evrakDefaults));
  }, [evrakDefaults]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const { payload, error: serErr } = serializeOfficialProfile(state);
    if (serErr || !payload) {
      setError(serErr ?? 'Geçersiz veri');
      return;
    }
    setSaving(true);
    try {
      const path = userId ? `/users/${userId}` : '/me';
      await apiFetch(path, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ evrak_defaults: { yolluk_teacher: payload } }),
      });
      toast.success('Resmî bilgiler kaydedildi');
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kaydedilemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <TeacherOfficialProfileFields state={state} onChange={setState} />
      {error && <Alert message={error} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving} size="sm" className="gap-1.5 rounded-xl">
          <Save className="size-4" />
          {saving ? 'Kaydediliyor…' : 'Resmî bilgileri kaydet'}
        </Button>
      </div>
    </form>
  );
}
