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

type SupportState = 'loading' | 'ready' | 'browser' | 'server';

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'multiDevice') return <Cloud className="size-4 text-sky-400" aria-hidden />;
  if (typeof window !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    return <Smartphone className="size-4 text-red-400" aria-hidden />;
  }
  return <Laptop className="size-4 text-red-400" aria-hidden />;
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
    <li className="rounded-2xl border border-white/8 bg-zinc-900/55 p-3.5 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-950/50 ring-1 ring-red-800/35">
          <DeviceIcon type={row.device_type} />
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={120}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
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
                <p className="truncate text-sm font-semibold text-zinc-50">
                  {row.name?.trim() || passkeyDeviceTypeLabel(row.device_type)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-red-900/50 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-200/90">
                    {passkeyDeviceTypeLabel(row.device_type)}
                  </span>
                  {row.backed_up ? (
                    <span className="rounded-full border border-sky-800/40 bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-200/90">
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
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                  aria-label="Yeniden adlandır"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(row.id)}
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Kaldır"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-zinc-500 sm:text-[11px]">
            <div>
              <dt className="uppercase tracking-wide">Eklendi</dt>
              <dd className="text-zinc-300">{formatPasskeyDate(row.created_at)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Son giriş</dt>
              <dd className="text-zinc-300">{formatPasskeyDate(row.last_used_at)}</dd>
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
      await registerPasskey(token, label);
      toast.success('Biyometrik giriş eklendi.');
      setShowAdd(false);
      setAddName('');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız.');
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
      await reload();
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
      ? { label: 'Aktif', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25' }
      : support === 'ready' && loginEnabled
        ? { label: 'Hazır', cls: 'bg-amber-500/15 text-amber-200 ring-amber-500/25' }
        : { label: 'Kapalı', cls: 'bg-zinc-800 text-zinc-400 ring-white/10' };

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-red-500/20 bg-linear-to-br from-zinc-950/95 via-card/90 to-red-950/15 shadow-sm',
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-red-700 to-red-900 text-white shadow-lg shadow-red-950/40">
            <Fingerprint className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Biyometrik giriş</h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                  statusBadge.cls,
                )}
              >
                {statusBadge.label}
              </span>
            </div>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              Parmak izi veya yüz tanıma ile hızlı giriş. Şifreniz geçerlidir; PWA ve desteklenen tarayıcılarda çalışır.
            </p>
          </div>
        </div>
      </div>

      {support === 'loading' ? (
        <LoadingDots className="py-6" />
      ) : support === 'browser' ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3 text-xs leading-relaxed text-amber-100/95">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Bu tarayıcı veya bağlantı biyometrik girişi desteklemiyor. HTTPS ve güncel Chrome / Safari / Edge kullanın.
        </div>
      ) : support === 'server' ? (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3 text-xs leading-relaxed text-amber-100/95">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Sunucuda WebAuthn yapılandırması eksik. Yöneticiye <code className="text-[10px]">WEBAUTHN_RP_ID</code> bildirin.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-zinc-900/45 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Biyometrik girişe izin ver</p>
              <p className="text-[11px] text-muted-foreground">Kapalıyken giriş ekranında parmak izi / yüz seçeneği görünmez.</p>
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
                <LoadingDots className="py-4" />
              ) : (
                <ul className={cn('space-y-2.5', !compact && 'sm:space-y-3')}>
                  {rows.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/35 px-4 py-5 text-center text-xs text-muted-foreground">
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
                <div className="mt-3 space-y-2 rounded-xl border border-red-800/30 bg-red-950/15 p-3">
                  <label className="block text-[11px] font-medium text-muted-foreground">Cihaz adı</label>
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder={suggestPasskeyDeviceName()}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="h-9 gap-1.5" disabled={busy} onClick={() => void add()}>
                      <Fingerprint className="size-3.5" />
                      {busy ? 'Kaydediliyor…' : 'Doğrula ve ekle'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9"
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
                  className="mt-3 h-9 w-full gap-1.5 border-red-800/35 bg-transparent hover:bg-red-950/25 sm:w-auto"
                  disabled={!token || busy}
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="size-3.5" />
                  Bu cihazı ekle
                </Button>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-white/8 bg-zinc-900/35 px-3.5 py-3 text-xs text-muted-foreground">
              Biyometrik giriş kapalı. Kayıtlı cihazlar silinmez; tekrar açtığınızda kullanılabilir.
            </p>
          )}
        </>
      )}
    </section>
  );
}
