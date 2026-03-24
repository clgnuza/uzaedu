'use client';

import { DersProgramiNav } from '@/components/ders-programi/ders-programi-nav';

export default function DersProgramiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <DersProgramiNav />
      {children}
    </div>
  );
}
