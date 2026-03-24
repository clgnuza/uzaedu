import type { Metadata, Viewport } from 'next';
import './tv.css';

export const metadata: Metadata = {
  title: 'Duyuru TV',
  description: 'Okul duyuru ekranı',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TvLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="tv-root flex h-full min-h-screen w-full flex-col" lang="tr">
      {children}
    </div>
  );
}
