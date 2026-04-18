import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { SchoolDetailRedirect } from './school-detail-redirect';

const PUBLIC_BASE = '/school-reviews-public';
const PAGE_PATH = '/okul-degerlendirmeleri';

async function fetchSchool(id: string) {
  try {
    const res = await fetch(getApiUrl(`${PUBLIC_BASE}/schools/${id}`), {
      next: { revalidate: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const school = await fetchSchool(id);
  if (!school) {
    return { title: 'Okul bulunamadı | Uzaedu Öğretmen' };
  }
  const name = school.name || 'Okul';
  const loc = [school.city, school.district].filter(Boolean).join(' / ');
  const desc = [
    school.avg_rating != null ? `${school.avg_rating.toFixed(1)} ⭐ ortalama` : null,
    school.review_count > 0 ? `${school.review_count} değerlendirme` : null,
    loc || null,
  ]
    .filter(Boolean)
    .join(' · ');
  const url = process.env.NEXT_PUBLIC_APP_URL || 'https://uzaedu.com';
  return {
    title: `${name} | Okul Değerlendirmeleri | Uzaedu Öğretmen`,
    description: desc || `${name} – Öğretmen değerlendirmeleri`,
    openGraph: {
      title: `${name} | Uzaedu Öğretmen Okul Değerlendirmeleri`,
      description: desc || `${name} – Öğretmen değerlendirmeleri`,
      type: 'website',
      url: `${url}${PAGE_PATH}/${id}`,
      siteName: 'Uzaedu Öğretmen',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Uzaedu Öğretmen`,
      description: desc || `${name} – Öğretmen değerlendirmeleri`,
    },
  };
}

export default async function SchoolDetailPage({ params }: Props) {
  const { id } = await params;
  const school = await fetchSchool(id);
  if (!school) notFound();

  return <SchoolDetailRedirect schoolId={id} />;
}
