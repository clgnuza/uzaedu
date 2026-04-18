import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'İletişim gelen kutusu | Uzaedu Öğretmen',
};

export default function ContactInboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
