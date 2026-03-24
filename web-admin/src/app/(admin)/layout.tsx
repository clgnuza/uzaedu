'use client';

import { AdminLayout } from '@/components/layout/admin-layout';

/**
 * Tüm admin route'ları (dashboard, announcements, ...) bu layout ile: sidebar + header + route guard.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
