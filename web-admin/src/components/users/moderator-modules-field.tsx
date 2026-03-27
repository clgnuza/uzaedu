'use client';

import { BookOpen, Building2, Calculator, Layers, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModeratorModuleItem = { key: string; label: string; hint?: string };

export type ModeratorModuleGroup = {
  id: string;
  title: string;
  description: string;
  icon: typeof Building2;
  items: ModeratorModuleItem[];
};

/** Menü `requiredModule` ile uyumlu; süper admin moderatör atarken kullanılır. */
export const MODERATOR_MODULE_GROUPS: ModeratorModuleGroup[] = [
  {
    id: 'school',
    title: 'Okul & değerlendirme',
    description: 'Okul kayıtları, profil moderasyonu ve değerlendirme raporları.',
    icon: Building2,
    items: [
      { key: 'schools', label: 'Okullar', hint: 'Liste, filtre, düzenleme' },
      { key: 'school_profiles', label: 'Okul profilleri', hint: 'Profil moderasyonu' },
      { key: 'school_reviews', label: 'Okul değerlendirmeleri', hint: 'Raporlar ve kriter ayarları' },
    ],
  },
  {
    id: 'content',
    title: 'İçerik & duyuru',
    description: 'Duyurular, sistem mesajları, evrak ve kazanım içerikleri.',
    icon: BookOpen,
    items: [
      { key: 'announcements', label: 'Duyurular', hint: 'Okullara duyuru / sistem mesajı' },
      { key: 'system_announcements', label: 'Sistem duyuruları', hint: 'Platform geneli duyurular' },
      { key: 'document_templates', label: 'Evrak şablonları', hint: 'Yıllık plan, evrak şablonları' },
      { key: 'outcome_sets', label: 'Kazanım setleri', hint: 'Kazanım takip setleri' },
    ],
  },
  {
    id: 'platform',
    title: 'Platform & erişim',
    description: 'Kullanıcılar, modül politikası, market ve destek.',
    icon: Layers,
    items: [
      { key: 'users', label: 'Kullanıcılar', hint: 'Kullanıcı listesi ve detay' },
      { key: 'modules', label: 'Modüller', hint: 'Okul modül yetkileri' },
      { key: 'market_policy', label: 'Market politikası', hint: 'Jeton, ödüller' },
      { key: 'support', label: 'Destek', hint: 'Ticket / gelen kutusu' },
    ],
  },
  {
    id: 'calc',
    title: 'Hesaplama',
    description: 'Ek ders ve sınav görev ücreti parametreleri.',
    icon: Calculator,
    items: [{ key: 'extra_lesson_params', label: 'Hesaplama parametreleri', hint: 'Ek ders, sınav ücreti vb.' }],
  },
];

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  MODERATOR_MODULE_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

export function getModeratorModuleLabel(key: string): string {
  return LABEL_BY_KEY[key] ?? key;
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
};

export function ModeratorModulesField({ value, onChange, idPrefix = 'mod' }: Props) {
  const toggle = (key: string, checked: boolean) => {
    if (checked) onChange([...value, key]);
    else onChange(value.filter((k) => k !== key));
  };

  const selectAllInGroup = (keys: string[]) => {
    const set = new Set(value);
    keys.forEach((k) => set.add(k));
    onChange([...set]);
  };

  const clearGroup = (keys: string[]) => {
    const drop = new Set(keys);
    onChange(value.filter((k) => !drop.has(k)));
  };

  const selectedInGroup = (keys: string[]) => keys.filter((k) => value.includes(k)).length;

  return (
    <div
      className="rounded-xl border border-amber-500/25 bg-linear-to-br from-amber-500/[0.06] via-background to-violet-500/[0.04] p-4 shadow-sm dark:from-amber-950/20 dark:via-background dark:to-violet-950/10"
      role="group"
      aria-label="Moderatör yetki alanları"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-amber-500/15 pb-3">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
            <Shield className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Moderatör yetkileri</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Panele hangi bölümlere erişebileceğini seçin. İçerik ve duyuru alanları ayrı grupta toplanmıştır.
            </p>
          </div>
        </div>
        <p className="text-xs font-medium tabular-nums text-amber-900 dark:text-amber-200/90">
          {value.length} / {MODERATOR_MODULE_GROUPS.reduce((n, g) => n + g.items.length, 0)} seçili
        </p>
      </div>

      <div className="space-y-4">
        {MODERATOR_MODULE_GROUPS.map((group) => {
          const keys = group.items.map((i) => i.key);
          const Icon = group.icon;
          const sel = selectedInGroup(keys);
          return (
            <div
              key={group.id}
              className="rounded-lg border border-border/80 bg-card/80 p-3 shadow-sm backdrop-blur-sm dark:bg-card/40"
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-amber-700/90 dark:text-amber-400/90" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{group.title}</p>
                    <p className="text-[11px] leading-snug text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {sel}/{keys.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectAllInGroup(keys)}
                    className="rounded-md px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-500/10 dark:text-amber-300"
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    onClick={() => clearGroup(keys)}
                    className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                  >
                    Temizle
                  </button>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const checked = value.includes(item.key);
                  const cbId = `${idPrefix}-${group.id}-${item.key}`;
                  return (
                    <li key={item.key}>
                      <label
                        htmlFor={cbId}
                        className={cn(
                          'flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                          checked
                            ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20 dark:bg-amber-950/30'
                            : 'border-border/70 bg-background/50 hover:border-amber-500/25 hover:bg-muted/30',
                        )}
                      >
                        <input
                          id={cbId}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggle(item.key, e.target.checked)}
                          className="mt-0.5 size-4 shrink-0 rounded border-input text-amber-600 focus:ring-amber-500/30"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-snug text-foreground">{item.label}</span>
                          {item.hint && (
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                              {item.hint}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {value.length === 0 && (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/80">
          Henüz modül seçilmedi; moderatör panele giremeyebilir. En az bir yetki işaretleyin.
        </p>
      )}
    </div>
  );
}
