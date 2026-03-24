'use client';

import { DutyNav } from '@/components/duty/duty-nav';

export default function DutyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-0">
      <DutyNav />
      {children}
    </div>
  );
}
