'use client';

import { DutyNav } from '@/components/duty/duty-nav';

export default function DutyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="duty-module space-y-0">
      <DutyNav />
      <div className="mt-0 space-y-2 sm:space-y-3">{children}</div>
    </div>
  );
}
