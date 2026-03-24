'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, UserMinus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type UserItem = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  moderator_modules?: string[] | null;
};

export function SupportTeamDialog({
  open,
  onOpenChange,
  token,
  schoolId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  schoolId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [moderators, setModerators] = useState<UserItem[]>([]);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !schoolId) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ items: UserItem[] }>(`/users?school_id=${encodeURIComponent(schoolId)}&role=moderator&limit=50`),
      apiFetch<{ items: UserItem[] }>(`/users?school_id=${encodeURIComponent(schoolId)}&role=teacher&limit=50`),
    ])
      .then(([modRes, teaRes]) => {
        setModerators(modRes.items || []);
        setTeachers(teaRes.items || []);
      })
      .catch(() => {
        setModerators([]);
        setTeachers([]);
      })
      .finally(() => setLoading(false));
  }, [open, token, schoolId]);

  const hasSupport = (u: UserItem) =>
    Array.isArray(u.moderator_modules) && u.moderator_modules.includes('support');
  const supportModerators = moderators.filter(hasSupport);
  const moderatorsWithoutSupport = moderators.filter((u) => !hasSupport(u));

  const addSupport = async (user: UserItem) => {
    if (!token) return;
    setUpdating(user.id);
    try {
      const current = (user.moderator_modules || []) as string[];
      const next = current.includes('support') ? current : [...current, 'support'];
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ moderator_modules: next }),
      });
      toast.success(`${user.display_name || user.email} destek ekibine eklendi`);
      setModerators((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, moderator_modules: next } : u)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setUpdating(null);
    }
  };

  const removeSupport = async (user: UserItem) => {
    if (!token) return;
    setUpdating(user.id);
    try {
      const current = (user.moderator_modules || []) as string[];
      const next = current.filter((m) => m !== 'support');
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ moderator_modules: next.length ? next : null }),
      });
      toast.success(`${user.display_name || user.email} destek ekibinden çıkarıldı`);
      setModerators((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, moderator_modules: next.length ? next : null } : u)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setUpdating(null);
    }
  };

  const makeModeratorWithSupport = async (user: UserItem) => {
    if (!token || user.role !== 'teacher') return;
    setUpdating(user.id);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ role: 'moderator', moderator_modules: ['support'] }),
      });
      toast.success(`${user.display_name || user.email} destek moderatörü yapıldı`);
      setTeachers((prev) => prev.filter((u) => u.id !== user.id));
      setModerators((prev) => [...prev, { ...user, role: 'moderator', moderator_modules: ['support'] }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Destek ekibi / Moderatörler
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Destek taleplerini yanıtlayabilecek moderatörleri buradan atayabilirsiniz.
        </p>
        {loading ? (
          <LoadingSpinner label="Yükleniyor…" className="py-6" />
        ) : (
          <div className="space-y-4">
            {supportModerators.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Destek ekibindekiler</h4>
                <ul className="space-y-1.5">
                  {supportModerators.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{u.display_name || u.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSupport(u)}
                        disabled={updating === u.id}
                      >
                        <UserMinus className="size-3.5 mr-1" />
                        Çıkar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {moderatorsWithoutSupport.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Moderatör (destek ekibinde değil)</h4>
                <ul className="space-y-1.5">
                  {moderatorsWithoutSupport.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm">{u.display_name || u.email}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => addSupport(u)}
                        disabled={updating === u.id}
                      >
                        <UserPlus className="size-3.5 mr-1" />
                        Ekle
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {teachers.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">Öğretmeni destek moderatörü yap</h4>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Öğretmen moderatör rolüne geçer ve destek taleplerini yanıtlayabilir.
                </p>
                <ul className="space-y-1.5">
                  {teachers.slice(0, 10).map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm">{u.display_name || u.email}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => makeModeratorWithSupport(u)}
                        disabled={updating === u.id}
                      >
                        <UserPlus className="size-3.5 mr-1" />
                        Moderatör yap
                      </Button>
                    </li>
                  ))}
                  {teachers.length > 10 && (
                    <p className="text-[11px] text-muted-foreground">İlk 10 öğretmen gösteriliyor. Diğerleri için Kullanıcılar sayfasını kullanın.</p>
                  )}
                </ul>
              </div>
            )}
            {supportModerators.length === 0 && moderatorsWithoutSupport.length === 0 && teachers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Bu okulda atanacak kullanıcı bulunamadı.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
