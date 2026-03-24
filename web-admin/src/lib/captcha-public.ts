import { cache } from 'react';

export type CaptchaProvider = 'none' | 'recaptcha_v2' | 'recaptcha_v3' | 'turnstile' | 'hcaptcha';

export type CaptchaPublic = {
  enabled: boolean;
  provider: CaptchaProvider;
  site_key: string | null;
  v3_min_score: number;
  protect_login: boolean;
  protect_register: boolean;
  protect_forgot_password: boolean;
  cache_ttl_captcha: number;
};

export type CaptchaAdmin = CaptchaPublic & {
  secret_key: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

const CAPTCHA_ISR = Math.min(
  86400,
  Math.max(10, parseInt(process.env.NEXT_PUBLIC_CAPTCHA_ISR || '120', 10) || 120),
);

export const fetchCaptchaPublic = cache(async function fetchCaptchaPublic(): Promise<CaptchaPublic | null> {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/captcha`, {
      next: { revalidate: CAPTCHA_ISR },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});
