'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  type AuthPortal,
  type PasskeyCredentialRow,
  deletePasskey,
  fetchWebAuthnSupported,
  listPasskeys,
  registerPasskey,
} from '@/lib/webauthn';
import { LoadingDots } from '@/components/ui/loading-spinner';

function deviceLabel(row: PasskeyCredentialRow): string {
  if (row.name?.trim()) return row.name;
  if (row.device_type === 'singleDevice') return 'Bu cihaz (yerel)';
  if (row.device_type === 'multiDevice') return 'Senkronize passkey';
  return 'Kayıtlı cihaz';
}

export function PasskeyPreference({
  token,
  portal,
  className,
}: {
  token: string | null;
  portal: AuthPortal;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [rows, setRows] = useState<PasskeyCredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setRows(await listPasskeys(token));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchWebAuthnSupported().then(setSupported);
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const add = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const label =
        portal === 'school' ? 'Okul yönetimi — bu cihaz' : 'Öğretmen — bu cihaz';
      await registerPasskey(token, label);
      toast.success('Biyometrik giriş eklendi.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await deletePasskey(token, id);
      toast.success('Kaldırıldı.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/40 sm:rounded-xl sm:p-4',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Fingerprint className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-xs font-semibold text-foreground sm:text-sm">Biyometrik giriş</h3>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground leading-snug sm:text-xs">
        PWA veya tarayıcıda parmak izi / yüz tanıma ile hızlı giriş. İsteğe bağlıdır; şifreniz geçerlidir.
      </p>
      {loading ? (
        <LoadingDots className="py-2" />
      ) : (
        <ul className="mb-2 space-y-1.5">
          {rows.length === 0 ? (
            <li className="text-[11px] text-muted-foreground sm:text-xs">Henüz kayıtlı cihaz yok.</li>
          ) : (
            rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 text-xs sm:text-sm"
              >
                <span className="truncate">{deviceLabel(r)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(r.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Kaldır"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <button
        type="button"
        disabled={!token || busy}
        onClick={() => void add()}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:text-sm"
      >
        {busy ? '…' : 'Bu cihazı ekle'}
      </button>
    </div>
  );
}
