import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DtSozlesmeLegacyRedirect({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const u = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (raw == null) continue;
    if (Array.isArray(raw)) raw.forEach((v) => u.append(key, String(v)));
    else u.set(key, String(raw));
  }
  const q = u.toString();
  redirect(`/dogrudan-temin/${id}${q ? `?${q}` : ''}`);
}
