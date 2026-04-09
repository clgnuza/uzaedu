import { cache } from 'react';
import { getApiUrl } from '@/lib/api';

export type GdprPublic = {
  cookie_banner_enabled: boolean;
  /** Boşsa istemci "Çerez tercihleri" */
  cookie_banner_title: string | null;
  accept_button_label: string | null;
  reject_button_label: string | null;
  cookie_banner_body_html: string | null;
  consent_version: string;
  data_controller_name: string | null;
  dpo_email: string | null;
  cookie_policy_path: string;
  reject_button_visible: boolean;
  cache_ttl_gdpr: number;
};

const GDPR_ISR = Math.min(
  86400,
  Math.max(10, parseInt(process.env.NEXT_PUBLIC_GDPR_ISR || '120', 10) || 120),
);

export const fetchGdprPublic = cache(async function fetchGdprPublic(): Promise<GdprPublic | null> {
  try {
    const res = await fetch(getApiUrl('/content/gdpr'), {
      next: { revalidate: GDPR_ISR },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});
