'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Fingerprint,
  Laptop,
  Pencil,
  Plus,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LoadingDots } from '@/components/ui/loading-spinner';
import {
  type AuthPortal,
  type PasskeyCredentialRow,
  clearPasskeyHint,
  deletePasskey,
  fetchWebAuthnSupported,
  isWebAuthnAvailable,
  listPasskeys,
  registerPasskey,
  renamePasskey,
  updatePasskeyLoginEnabled,
} from '@/lib/webauthn';
import {
  formatPasskeyDate,
  passkeyDeviceTypeLabel,
  suggestPasskeyDeviceName,
} from '@/lib/passkey-device-label';
import { getWebAuthnErrorMessage } from '@/lib/webauthn-error-message';

type SupportState = 'loading' | 'ready' | 'browser' | 'server';

const sectionShell =
  'rounded-lg border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-zinc-800/40 sm:rounded-xl sm:p-4';

const iconBox = 'flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:size-8 sm:rounded-lg';

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'multiDevice') return <Cloud className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />;
  if (typeof window !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    return <Smartphone className="size-3.5 text-primary" aria-hidden />;
  }
  return <Laptop className="size-3.5 text-primary" aria-hidden />;
}

function CredentialRow({
  row,
  busy,
  onRename,
  onRemove,
}: {
  row: PasskeyCredentialRow;
  busy: boolean;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.name ?? '');

  const saveRename = () => {
    const next = draft.trim();
    if (!next) {
      toast.error('Cihaz adı boş olamaz.');
      return;
    }
    onRename(row.id, next);
    setEditing(false);
  };

  return (
    <li className="rounded-lg border border-border/60 bg-card/80 p-2.5 shadow-sm sm:rounded-xl sm:p-3">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span className={cn(iconBox, 'mt-0.5')}>
          <DeviceIcon type={row.device_type} />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={120}
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm sm:h-9 sm:rounded-lg sm:px-3"
                autoFocus
              />
              <Button type="button" size="sm" className="h-8" disabled={busy} onClick={saveRename}>
                Kaydet
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={busy}
                onClick={() => {
                  setDraft(row.name ?? '');
                  setEditing(false);
                }}
              >
                İptal
              </Button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                  {row.name?.trim() || passkeyDeviceTypeLabel(row.device_type)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                    {passkeyDeviceTypeLabel(row.device_type)}
                  </span>
                  {row.backed_up ? (
                    <span className="rounded-full border border-sky-200/70 bg-sky-50/80 px-1.5 py-px text-[10px] font-medium text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200">
                      Yedekli
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  aria-label="Yeniden adlandır"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(row.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Kaldır"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            <div>
              <dt>Eklendi</dt>
              <dd className="font-medium text-foreground/80">{formatPasskeyDate(row.created_at)}</dd>
            </div>
            <div>
              <dt>Son giriş</dt>
              <dd className="font-medium text-foreground/80">{formatPasskeyDate(row.last_used_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </li>
  );
}

export function PasskeySettingsPanel({
  token,
  portal,
  enabled,
  onEnabledChange,
  className,
  compact,
}: {
  token: string | null;
  portal: AuthPortal;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  className?: string;
  compact?: boolean;
}) {
  const [support, setSupport] = useState<SupportState>('loading');
  const [rows, setRows] = useState<PasskeyCredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addName, setAddName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loginEnabled, setLoginEnabled] = useState(enabled);

  useEffect(() => {
    setLoginEnabled(enabled);
  }, [enabled]);

  const reload = useCallback(async (): Promise<PasskeyCredentialRow[]> => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return [];
    }
    try {
      const list = await listPasskeys(token);
      setRows(list);
      return list;
    } catch {
      setRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isWebAuthnAvailable()) {
        if (!cancelled) setSupport('browser');
        return;
      }
      const ok = await fetchWebAuthnSupported();
      if (!cancelled) setSupport(ok ? 'ready' : 'server');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (showAdd && !addName) setAddName(suggestPasskeyDeviceName());
  }, [showAdd, addName]);

  const toggleEnabled = async (next: boolean) => {
    if (!token) return;
    setBusy(true);
    try {
      await updatePasskeyLoginEnabled(token, next);
      setLoginEnabled(next);
      onEnabledChange(next);
      toast.success(next ? 'Biyometrik giriş açıldı.' : 'Biyometrik giriş kapatıldı.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!token) return;
    const label =
      addName.trim() ||
      (portal === 'school' ? 'Okul yönetimi — bu cihaz' : suggestPasskeyDeviceName());
    setBusy(true);
    try {
      await registerPasskey(token, label, portal);
      toast.success('Biyometrik giriş eklendi.');
      setShowAdd(false);
      setAddName('');
      await reload();
    } catch (e) {
      toast.error(getWebAuthnErrorMessage(e, 'register'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Bu cihazdaki biyometrik giriş kaldırılsın mı?')) return;
    setBusy(true);
    try {
      await deletePasskey(token, id);
      toast.success('Cihaz kaldırıldı.');
      const next = await reload();
      if (!next?.length) clearPasskeyHint(portal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id: string, name: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await renamePasskey(token, id, name);
      toast.success('Cihaz adı güncellendi.');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const statusBadge =
    support === 'ready' && loginEnabled && rows.length > 0
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : support === 'ready' && loginEnabled
        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
        : 'bg-muted text-muted-foreground';

  const statusLabel =
    support === 'ready' && loginEnabled && rows.length > 0
      ? 'Aktif'
      : support === 'ready' && loginEnabled
        ? 'Hazır'
        : 'Kapalı';

  const alertBox =
    'flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs';

  return (
    <section className={cn(sectionShell, compact && 'sm:p-3', className)}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2 sm:mb-3">
        <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
          <span className={iconBox}>
            <Fingerprint className="size-3.5 text-primary sm:size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-xs font-semibold text-foreground sm:text-sm">Biyometrik giriş</h3>
              <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', statusBadge)}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-0.5 max-w-lg text-[11px] leading-snug text-muted-foreground sm:text-xs">
              Parmak izi veya yüz tanıma ile hızlı giriş. PWA ve desteklenen tarayıcılarda çalışır.
            </p>
          </div>
        </div>
      </div>

      {support === 'loading' ? (
        <LoadingDots className="py-4" />
      ) : support === 'browser' ? (
        <div className={alertBox}>
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 sm:size-4" aria-hidden />
          Bu tarayıcı veya bağlantı biyometrik girişi desteklemiyor. HTTPS ve güncel Chrome / Safari / Edge kullanın.
        </div>
      ) : support === 'server' ? (
        <div className={alertBox}>
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 sm:size-4" aria-hidden />
          Sunucuda WebAuthn yapılandırması eksik. Yöneticiye{' '}
          <code className="text-[10px]">WEBAUTHN_RP_ID</code> bildirin.
        </div>
      ) : (
        <>
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 sm:mb-3 sm:rounded-xl sm:px-3 sm:py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground sm:text-sm">Biyometrik girişe izin ver</p>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                Kapalıyken giriş ekranında parmak izi / yüz seçeneği görünmez.
              </p>
            </div>
            <Switch
              checked={loginEnabled}
              disabled={busy || !token}
              onCheckedChange={(v) => void toggleEnabled(v)}
            />
          </div>

          {loginEnabled ? (
            <>
              {loading ? (
                <LoadingDots className="py-3" />
              ) : (
                <ul className="space-y-2">
                  {rows.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground sm:text-xs">
                      Henüz kayıtlı cihaz yok. Aşağıdan bu cihazı ekleyin.
                    </li>
                  ) : (
                    rows.map((r) => (
                      <CredentialRow key={r.id} row={r} busy={busy} onRename={rename} onRemove={remove} />
                    ))
                  )}
                </ul>
              )}

              {showAdd ? (
                <div className="mt-2.5 space-y-2 rounded-lg border border-border/60 bg-muted/15 p-2.5 sm:mt-3 sm:rounded-xl sm:p-3">
                  <label className="block text-[11px] font-medium text-foreground sm:text-xs">Cihaz adı</label>
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    maxLength={120}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm sm:h-9 sm:rounded-lg sm:px-3"
                    placeholder={suggestPasskeyDeviceName()}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="h-8 gap-1.5 sm:h-9" disabled={busy} onClick={() => void add()}>
                      <Fingerprint className="size-3.5" />
                      {busy ? 'Kaydediliyor…' : 'Doğrula ve ekle'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 sm:h-9"
                      disabled={busy}
                      onClick={() => {
                        setShowAdd(false);
                        setAddName('');
                      }}
                    >
                      İptal
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2.5 h-8 w-full gap-1.5 sm:mt-3 sm:h-9 sm:w-auto"
                  disabled={!token || busy}
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="size-3.5" />
                  Bu cihazı ekle
                </Button>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2 text-[11px] text-muted-foreground sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs">
              Biyometrik giriş kapalı. Kayıtlı cihazlar silinmez; tekrar açtığınızda kullanılabilir.
            </p>
          )}
        </>
      )}
    </section>
  );
}
