import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Okullar',
  description: 'Okul listesi, filtreleme ve kurum yönetimi',
};

export default function SchoolsLayout({ children }: { children: ReactNode }) {
  return children;
}
