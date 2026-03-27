'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Activity, PowerOff, RefreshCw } from 'lucide-react';
import type { Session } from '../types';

export function SessionTable({
  sessions,
  onDisconnect,
  onRefresh,
  canDisconnect = true,
}: {
  sessions: Session[];
  onDisconnect: (sessionId: string) => void;
  onRefresh: () => void;
  canDisconnect?: boolean;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Bugün Kim Bağlandı
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Yenile">
          <RefreshCw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<Activity className="size-10 text-muted-foreground" />}
            title="Bağlantı yok"
            description="Bugün henüz tahtaya bağlanan olmadı."
          />
        ) : (
          <div className="table-x-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Tahta</th>
                  <th className="py-2 text-left">Öğretmen</th>
                  <th className="py-2 text-left">Bağlanma</th>
                  <th className="py-2 text-left">Durum</th>
                  <th className="py-2 text-left">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2">{s.device_name}</td>
                    <td className="py-2">{s.user_name || '—'}</td>
                    <td className="py-2">{new Date(s.connected_at).toLocaleTimeString('tr-TR')}</td>
                    <td className="py-2">
                      {s.is_active ? (
                        <span className="text-emerald-600">Aktif</span>
                      ) : (
                        <span className="text-muted-foreground">Ayrıldı</span>
                      )}
                    </td>
                    <td className="py-2">
                      {s.is_active && canDisconnect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDisconnect(s.id)}
                          className="text-amber-600 hover:text-amber-700"
                        >
                          <PowerOff className="mr-1 size-4" />
                          Sonlandır
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
