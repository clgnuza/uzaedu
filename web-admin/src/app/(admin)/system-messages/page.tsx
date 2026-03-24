'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { AdminMessageListSection } from '@/components/admin-message-list';

export default function SystemMessagesPage() {
  const router = useRouter();
  const { token, me } = useAuth();

  const isSchoolAdmin = me?.role === 'school_admin';

  useEffect(() => {
    if (!isSchoolAdmin) {
      router.replace('/403');
    }
  }, [isSchoolAdmin, router]);

  if (!isSchoolAdmin) return null;

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="size-6 text-primary" />
            </div>
            <div>
              <ToolbarPageTitle>Sistem Mesajları</ToolbarPageTitle>
              <ToolbarIconHints
                compact
                items={[
                  { label: 'Merkez mesajlar', icon: Megaphone },
                  { label: 'Bakım / hatırlatma', icon: Mail },
                ]}
                summary="Merkezden gönderilen sistem, bakım ve hatırlatma mesajları. Duyuru TV veya okul duyurularından ayrıdır."
              />
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      <div className="rounded-xl border-2 border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Megaphone className="size-5 text-primary" />
          Merkezden gelen mesajlar
        </h2>
        <AdminMessageListSection token={token} canMarkRead />
      </div>
    </div>
  );
}
