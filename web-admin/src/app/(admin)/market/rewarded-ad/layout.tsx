import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ödüllü reklam',
  description: 'Mobil uygulamada ödüllü reklam izleyerek jeton kazanın.',
};

export default function RewardedAdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
