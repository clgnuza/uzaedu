'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import {
  Globe,
  Mail,
  Cloud,
  LayoutTemplate,
  Shield,
  ScrollText,
  Cookie,
  SlidersHorizontal,
  Smartphone,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { YayinSeoPanel } from './yayin-seo-panel';
import { R2SettingsPanel } from './r2-settings-panel';
import { MailSettingsPanel } from './mail-settings-panel';
import { WebPublicPanel } from './web-public-panel';
import { LegalPageEditPanel } from './legal-page-edit-panel';
import { WebExtrasPanel } from './web-extras-panel';
import { MobileAppPanel } from './mobile-app-panel';
import { GdprPanel } from './gdpr-panel';
import { CaptchaPanel } from './captcha-panel';
import type { LegalPageKey } from './legal-pages-types';

const TABS = [
  { id: 'seo', label: 'SEO', icon: Globe },
  { id: 'site', label: 'Site', icon: LayoutTemplate },
  { id: 'gizlilik', label: 'Gizlilik', icon: Shield },
  { id: 'sartlar', label: 'Şartlar', icon: ScrollText },
  { id: 'cerez', label: 'Çerez', icon: Cookie },
  { id: 'mail', label: 'Mail', icon: Mail },
  { id: 'r2', label: 'Depolama', icon: Cloud },
  { id: 'ekstra', label: 'Gelişmiş', icon: SlidersHorizontal },
  { id: 'gdpr', label: 'GDPR', icon: ShieldCheck },
  { id: 'captcha', label: 'CAPTCHA', icon: Bot },
  { id: 'mobil', label: 'Mobil', icon: Smartphone },
] as const;

const LEGAL_TAB_TO_KEY: Record<string, LegalPageKey> = {
  gizlilik: 'privacy',
  sartlar: 'terms',
  cerez: 'cookies',
};

export function WebSettingsTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams.get('tab');
  const tab = TABS.some((t) => t.id === raw) ? raw! : 'seo';
  const legalKey = LEGAL_TAB_TO_KEY[tab];

  return (
    <div className="space-y-8">
      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-border/50 bg-muted/25 p-1"
        aria-label="Web ve mobil ayarlar sekmeleri"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => router.replace(`/web-ayarlar?tab=${t.id}`)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5 opacity-80" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div>{tab === 'seo' && <YayinSeoPanel />}</div>
      <div>{tab === 'site' && <WebPublicPanel />}</div>
      <div>{legalKey && <LegalPageEditPanel pageKey={legalKey} />}</div>
      <div>{tab === 'mail' && <MailSettingsPanel />}</div>
      <div>{tab === 'r2' && <R2SettingsPanel />}</div>
      <div>{tab === 'ekstra' && <WebExtrasPanel />}</div>
      <div>{tab === 'gdpr' && <GdprPanel />}</div>
      <div>{tab === 'captcha' && <CaptchaPanel />}</div>
      <div>{tab === 'mobil' && <MobileAppPanel />}</div>
    </div>
  );
}
