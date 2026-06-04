'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BellRing,
  Check,
  Moon,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
  Vibrate,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { pushSupported, subscribeWebPush, unsubscribeWebPush } from '@/lib/web-push';
import { getChannelTheme, type NotificationChannelId } from '@/lib/notification-channel-theme';
import { NotificationChannelIcon } from '@/components/notification-channel-icon';
import { emitNotificationsUpdated } from '@/hooks/use-duty-notifications-unread';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DEFAULT_PUSH_SETTINGS,
  minutesToTimeInput,
  timeInputToMinutes,
  type PushUserSettings,
} from '@/lib/notification-push-prefs';
import { isIosSafari } from '@/lib/pwa-display';
import { PwaOfflineQueueBadge } from '@/components/pwa-offline-queue-badge';
import { PwaSettingsCard } from '@/components/pwa-settings-card';

type ChannelDef = { id: string; label: string };
type Pref = { channel: string; push_enabled: boolean; critical?: boolean };

function SettingSwitch({
  label,
  hint,
  checked,
  disabled,
  onChange,
  icon: Icon,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        checked ? 'border-border/60 bg-card' : 'border-border/30 bg-muted/15 opacity-90',
      )}
    >
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div
        className={cn(
          'size-9 shrink-0 rounded-full border-2 transition-colors',
          checked ? 'border-primary bg-primary' : 'border-muted-foreground/30 bg-muted',
        )}
      >
        {checked ? <Check className="m-auto size-4 text-primary-foreground" strokeWidth={3} /> : null}
      </div>
    </button>
  );
}

function ChannelToggle({
  channelId,
  label,
  enabled,
  critical,
  disabled,
  onChange,
  onCriticalChange,
}: {
  channelId: NotificationChannelId | string;
  label: string;
  enabled: boolean;
  critical: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
  onCriticalChange: (on: boolean) => void;
}) {
  const theme = getChannelTheme(channelId);
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-all',
        enabled ? 'border-border/60 bg-card shadow-sm' : 'border-border/30 bg-muted/20 opacity-75',
        `ring-1 ${theme.cardRing}`,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-[0.07]',
          `bg-linear-to-br ${theme.previewGradient}`,
        )}
      />
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className="group relative flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]"
      >
        <NotificationChannelIcon channelId={channelId} size="lg" className="relative z-10" />
        <div className="relative z-10 min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{theme.shortLabel} · push</p>
        </div>
        <div
          className={cn(
            'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2',
            enabled
              ? `border-transparent bg-linear-to-br ${theme.previewGradient} text-white shadow-md`
              : 'border-muted-foreground/25 bg-muted/40',
          )}
        >
          {enabled ? <Check className="size-4" strokeWidth={3} /> : null}
        </div>
      </button>
      {enabled ? (
        <div className="relative z-10 border-t border-border/40 px-3 py-2">
          <button
            type="button"
            role="switch"
            aria-checked={critical}
            disabled={disabled}
            onClick={() => onCriticalChange(!critical)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
              critical
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1">Kritik — sessiz saatte de gönder</span>
            {critical ? <Check className="size-3.5" /> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LockScreenPreview({
  channelId,
  subscribed,
  silent,
}: {
  channelId: string;
  subscribed: boolean;
  silent: boolean;
}) {
  const theme = getChannelTheme(channelId);
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-[1.75rem] border border-border/80 bg-linear-to-b from-slate-900 to-slate-950 p-3 shadow-xl">
      <div className="mb-3 flex justify-center">
        <div className="h-1 w-12 rounded-full bg-white/20" />
      </div>
      <p className="mb-2 text-center text-[10px] font-medium tracking-wide text-white/50">Kilit ekranı önizleme</p>
      <div
        className={cn(
          'flex gap-2.5 rounded-2xl border border-white/10 bg-white/10 p-2.5 backdrop-blur-md',
          !subscribed && 'opacity-60',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={theme.pushIcon}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-xl shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/icon-192.png';
          }}
        />
        <div className="min-w-0 flex-1 text-white">
          <p className="truncate text-xs font-semibold">Uzaedu · {theme.shortLabel}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/75">
            Örnek: {theme.label} bildirimi
            {silent ? ' (sessiz)' : ''}
          </p>
          <p className="mt-1 text-[9px] text-white/40">şimdi</p>
        </div>
      </div>
    </div>
  );
}

export function NotificationPushSettings() {
  const { token } = useAuth();
  const [channels, setChannels] = useState<ChannelDef[]>([]);
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [settings, setSettings] = useState<PushUserSettings>(DEFAULT_PUSH_SETTINGS);
  const [subscribed, setSubscribed] = useState(false);
  const [pushServer, setPushServer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewChannel, setPreviewChannel] = useState<string>('nobet');
  const [savingSettings, setSavingSettings] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    setIosHint(isIosSafari());
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [prefRes, statusRes] = await Promise.all([
        apiFetch<{
          channels: ChannelDef[];
          preferences: Pref[];
          settings: PushUserSettings;
        }>('/notification-preferences', { token }),
        apiFetch<{ subscribed: boolean; pushEnabled: boolean }>('/push/status', { token }),
      ]);
      setChannels(prefRes.channels ?? []);
      setPrefs(prefRes.preferences ?? []);
      setSettings({ ...DEFAULT_PUSH_SETTINGS, ...prefRes.settings });
      setSubscribed(!!statusRes.subscribed);
      setPushServer(!!statusRes.pushEnabled);
      if (prefRes.channels?.[0]?.id) setPreviewChannel(prefRes.channels[0].id);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const prefMap = new Map(
    prefs.map((p) => [p.channel, { push: p.push_enabled !== false, critical: p.critical === true }]),
  );

  const patchSettings = async (patch: Partial<PushUserSettings>) => {
    if (!token) return;
    setSavingSettings(true);
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const res = await apiFetch<{ settings: PushUserSettings }>('/notification-preferences', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ settings: patch }),
      });
      if (res.settings) setSettings({ ...DEFAULT_PUSH_SETTINGS, ...res.settings });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
      void load();
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    if (!token) return;
    setPreviewChannel(channelId);
    await apiFetch('/notification-preferences', {
      token,
      method: 'PATCH',
      body: JSON.stringify({ channels: [{ channel: channelId, push_enabled: enabled }] }),
    });
    setPrefs((prev) => {
      const rest = prev.filter((p) => p.channel !== channelId);
      const old = prev.find((p) => p.channel === channelId);
      return [...rest, { channel: channelId, push_enabled: enabled, critical: old?.critical }];
    });
  };

  const toggleCritical = async (channelId: string, critical: boolean) => {
    if (!token) return;
    setPreviewChannel(channelId);
    await apiFetch('/notification-preferences', {
      token,
      method: 'PATCH',
      body: JSON.stringify({ channels: [{ channel: channelId, critical }] }),
    });
    setPrefs((prev) => {
      const rest = prev.filter((p) => p.channel !== channelId);
      const old = prev.find((p) => p.channel === channelId);
      return [
        ...rest,
        { channel: channelId, push_enabled: old?.push_enabled !== false, critical },
      ];
    });
  };

  const enableDevice = async () => {
    if (!token) return;
    const r = await subscribeWebPush(token);
    if (r.ok) {
      toast.success('Telefon bildirimleri açıldı');
      setSubscribed(true);
      emitNotificationsUpdated();
      return;
    }
    if (r.reason === 'denied') toast.error('Bildirim izni reddedildi — tarayıcı ayarlarından açın');
    else if (r.reason === 'server') toast.error('Sunucuda push henüz yapılandırılmamış');
    else toast.error('Bildirim açılamadı');
  };

  const disableDevice = async () => {
    if (!token) return;
    await unsubscribeWebPush(token);
    setSubscribed(false);
    toast.success('Bu cihazdaki push kapatıldı');
  };

  if (!token || !pushSupported()) return null;

  return (
    <>
    <PwaSettingsCard className="mb-3" />
    <section className="mb-4 overflow-hidden rounded-2xl border border-teal-500/20 bg-linear-to-br from-teal-500/8 via-card to-violet-500/5 shadow-sm">
      <div className="border-b border-border/40 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Telefon bildirimleri</h2>
              <PwaOfflineQueueBadge />
              {subscribed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Aktif
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Kapalı
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Kanal, sessiz saat, ses/titreşim ve kritik bildirimleri siz yönetirsiniz.
            </p>
            {iosHint ? (
              <p className="mt-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-900 dark:text-amber-100">
                iPhone/iPad: push için uygulamayı Safari → Paylaş → Ana Ekrana Ekle ile kurun (iOS 16.4+).
              </p>
            ) : null}
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            {subscribed ? (
              <Button type="button" variant="outline" size="sm" className="h-9 flex-1 sm:flex-none" onClick={() => void disableDevice()}>
                Cihazı kapat
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-9 flex-1 bg-linear-to-r from-teal-600 to-cyan-600 sm:flex-none"
                disabled={!pushServer || loading}
                onClick={() => void enableDevice()}
              >
                <BellRing className="mr-1.5 size-4" />
                Etkinleştir
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_minmax(0,300px)] sm:p-5">
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kullanıcı kontrolü</p>
            <SettingSwitch
              icon={Moon}
              label="Sessiz saat"
              hint={`${minutesToTimeInput(settings.quiet_start_minutes)} – ${minutesToTimeInput(settings.quiet_end_minutes)} (TR)`}
              checked={settings.quiet_hours_enabled}
              disabled={loading || savingSettings}
              onChange={(on) => void patchSettings({ quiet_hours_enabled: on })}
            />
            {settings.quiet_hours_enabled ? (
              <div className="grid grid-cols-2 gap-2 pl-1">
                <label className="text-[10px] text-muted-foreground">
                  Başlangıç
                  <input
                    type="time"
                    className="mt-0.5 block w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                    value={minutesToTimeInput(settings.quiet_start_minutes)}
                    disabled={savingSettings}
                    onChange={(e) =>
                      void patchSettings({ quiet_start_minutes: timeInputToMinutes(e.target.value) })
                    }
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Bitiş
                  <input
                    type="time"
                    className="mt-0.5 block w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                    value={minutesToTimeInput(settings.quiet_end_minutes)}
                    disabled={savingSettings}
                    onChange={(e) =>
                      void patchSettings({ quiet_end_minutes: timeInputToMinutes(e.target.value) })
                    }
                  />
                </label>
              </div>
            ) : null}
            <SettingSwitch
              icon={settings.sound_enabled ? Volume2 : VolumeX}
              label="Bildirim sesi"
              checked={settings.sound_enabled}
              disabled={loading || savingSettings}
              onChange={(on) => void patchSettings({ sound_enabled: on })}
            />
            <SettingSwitch
              icon={Vibrate}
              label="Titreşim"
              checked={settings.vibration_enabled}
              disabled={loading || savingSettings}
              onChange={(on) => void patchSettings({ vibration_enabled: on })}
            />
          </div>

          <div className="space-y-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5" />
              Kanallar
            </div>
            {loading ? (
              <p className="text-xs text-muted-foreground">Yükleniyor…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {channels.map((ch) => {
                  const p = prefMap.get(ch.id);
                  return (
                    <ChannelToggle
                      key={ch.id}
                      channelId={ch.id}
                      label={ch.label}
                      enabled={p?.push ?? true}
                      critical={p?.critical ?? false}
                      disabled={loading}
                      onChange={(on) => void toggleChannel(ch.id, on)}
                      onCriticalChange={(on) => void toggleCritical(ch.id, on)}
                    />
                  );
                })}
              </div>
            )}
            {!pushServer && !loading ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">Sunucuda VAPID anahtarları tanımlı değil.</p>
            ) : null}
          </div>
        </div>
        <LockScreenPreview
          channelId={previewChannel}
          subscribed={subscribed}
          silent={!settings.sound_enabled}
        />
      </div>
    </section>
    </>
  );
}
