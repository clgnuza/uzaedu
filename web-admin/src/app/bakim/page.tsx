import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bakım | Uzaedu Öğretmen',
  description: 'Sistem bakımı veya güncelleme. Kısa süre içinde tekrar deneyin.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const DEFAULT_HTML =
  '<p>Kısa süreli bir güncelleme yapılıyor. Lütfen birkaç dakika sonra tekrar deneyin.</p>';

async function fetchMaintenanceMessage(): Promise<string> {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
  try {
    const res = await fetch(`${apiBase}/content/web-extras`, { cache: 'no-store' });
    if (!res.ok) return DEFAULT_HTML;
    const data = (await res.json()) as { maintenance_message_html?: string | null };
    return data.maintenance_message_html?.trim() || DEFAULT_HTML;
  } catch {
    return DEFAULT_HTML;
  }
}

export default async function BakimPage() {
  const html = await fetchMaintenanceMessage();

  return (
    <article className="bakim-card">
      <div className="bakim-spinner" role="status" aria-label="Güncelleniyor" />
      <p className="bakim-eyebrow">Geçici olarak kullanılamıyor</p>
      <h1 className="bakim-title">Güncelleme yapılıyor</h1>
      <p className="bakim-lead">İşlem tamamlandığında site otomatik olarak normale döner.</p>
      <div className="bakim-msg" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="bakim-actions">
        <a className="bakim-btn" href="/">
          Tekrar dene
        </a>
      </div>
    </article>
  );
}
