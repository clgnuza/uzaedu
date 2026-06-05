'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  Moon,
  ShieldAlert,
  Smartphone,
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
import {
  NotificationPermissionDeniedHelp,
  NotificationPermissionPrompt,
} from '@/components/notification-permission-prompt';
import { getNotificationPermission } from '@/lib/web-push';
type ChannelDef = { id: string; label: string };
type Pref = { channel: string; push_enabled: boolean; critical?: boolean };

function CompactSwitch({
  label,
  checked,
  disabled,
  onChange,
  icon: Icon,
  className,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
        checked
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border/50 bg-muted/20 text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      <span
        className={cn(
          'ml-0.5 size-3.5 shrink-0 rounded-full border',
          checked ? 'border-primary bg-primary' : 'border-muted-foreground/35 bg-muted',
        )}
      >
        {checked ? <Check className="m-auto size-2 text-primary-foreground" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

function ChannelRow({
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
        'flex items-center gap-2 rounded-lg border px-2 py-1.5',
        enabled ? 'border-border/60 bg-card' : 'border-border/30 bg-muted/15 opacity-80',
      )}
    >
      <NotificationChannelIcon channelId={channelId} size="sm" className="!size-6 shrink-0 !rounded-md sm:!size-6" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-xs font-medium leading-tight"
        disabled={disabled}
        onClick={() => onChange(!enabled)}
      >
        {label}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label} push`}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          enabled
            ? cn('border-transparent text-white', `bg-linear-to-br ${theme.previewGradient}`)
            : 'border-muted-foreground/25 bg-muted/40',
        )}
      >
        {enabled ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      {enabled ? (
        <button
          type="button"
          title="Kritik — sessiz saatte de"
          aria-label="Kritik bildirim"
          disabled={disabled}
          onClick={() => onCriticalChange(!critical)}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md border',
            critical
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'border-transparent text-muted-foreground hover:bg-muted/50',
          )}
        >
          <ShieldAlert className="size-3.5" aria-hidden />
        </button>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
    const prevPrefs = prefs;
    setPrefs((prev) => {
      const rest = prev.filter((p) => p.channel !== channelId);
      const old = prev.find((p) => p.channel === channelId);
      return [...rest, { channel: channelId, push_enabled: enabled, critical: old?.critical }];
    });
    try {
      await apiFetch('/notification-preferences', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ channels: [{ channel: channelId, push_enabled: enabled }] }),
      });
    } catch (e) {
      setPrefs(prevPrefs);
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const toggleCritical = async (channelId: string, critical: boolean) => {
    if (!token) return;
    const prevPrefs = prefs;
    setPrefs((prev) => {
      const rest = prev.filter((p) => p.channel !== channelId);
      const old = prev.find((p) => p.channel === channelId);
      return [
        ...rest,
        { channel: channelId, push_enabled: old?.push_enabled !== false, critical },
      ];
    });
    try {
      await apiFetch('/notification-preferences', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ channels: [{ channel: channelId, critical }] }),
      });
    } catch (e) {
      setPrefs(prevPrefs);
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const finishSubscribe = async (skipPermissionRequest: boolean) => {
    if (!token) return;
    setEnablingPush(true);
    try {
      const r = await subscribeWebPush(token, { skipPermissionRequest });
      if (r.ok) {
        toast.success('Telefon bildirimleri açıldı');
        setSubscribed(true);
        setPermissionDenied(false);
        setPermissionPromptOpen(false);
        emitNotificationsUpdated();
        return;
      }
      if (r.reason === 'denied') {
        setPermissionDenied(true);
        toast.error('Bildirim izni verilmedi');
      } else if (r.reason === 'server') toast.error('Sunucuda push henüz yapılandırılmamış');
      else toast.error('Bildirim açılamadı');
    } finally {
      setEnablingPush(false);
    }
  };

  const openEnableFlow = () => {
    const perm = getNotificationPermission();
    if (perm === 'granted') {
      void finishSubscribe(true);
      return;
    }
    if (perm === 'denied') {
      setPermissionDenied(true);
      setPermissionPromptOpen(true);
      return;
    }
    setPermissionDenied(false);
    setPermissionPromptOpen(true);
  };

  const confirmPermissionPrompt = async () => {
    await finishSubscribe(false);
    if (getNotificationPermission() === 'denied') setPermissionDenied(true);
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
      <NotificationPermissionPrompt
        open={permissionPromptOpen}
        onOpenChange={setPermissionPromptOpen}
        onConfirm={confirmPermissionPrompt}
        busy={enablingPush}
      />
      <section className="mb-3 overflow-hidden rounded-xl border border-teal-500/20 bg-card/80 shadow-sm">
        <div className="flex items-center gap-2 px-2.5 py-2 sm:px-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-teal-600 to-cyan-600 text-white">
            <Smartphone className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-semibold leading-none">Telefon bildirimleri</h2>
              <PwaOfflineQueueBadge />
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[9px] font-semibold',
                  subscribed
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {subscribed ? 'Aktif' : 'Kapalı'}
              </span>
            </div>
          </div>
          {subscribed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => void disableDevice()}
            >
              Kapat
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11px] bg-teal-600 hover:bg-teal-700"
              disabled={!pushServer || loading || enablingPush}
              onClick={openEnableFlow}
            >
              <BellRing className="mr-1 size-3" />
              Aç
            </Button>
          )}
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60"
            aria-expanded={expanded}
            aria-label={expanded ? 'Ayarları gizle' : 'Ayarları göster'}
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        {permissionDenied && !subscribed ? (
          <div className="border-t border-border/40 px-2.5 py-2 sm:px-3">
            <NotificationPermissionDeniedHelp onRetry={openEnableFlow} />
          </div>
        ) : null}

        {iosHint ? (
          <p className="border-t border-border/40 px-2.5 py-1.5 text-[10px] leading-snug text-amber-800 dark:text-amber-200">
            iOS: Ana ekrana ekleyin (Safari → Paylaş), iOS 16.4+.
          </p>
        ) : null}

        {expanded ? (
          <div className="space-y-2 border-t border-border/40 px-2.5 py-2 sm:px-3">
            <div className="flex flex-wrap gap-1.5">
              <CompactSwitch
                icon={Moon}
                label="Sessiz"
                checked={settings.quiet_hours_enabled}
                disabled={loading || savingSettings}
                onChange={(on) => void patchSettings({ quiet_hours_enabled: on })}
              />
              <CompactSwitch
                icon={settings.sound_enabled ? Volume2 : VolumeX}
                label="Ses"
                checked={settings.sound_enabled}
                disabled={loading || savingSettings}
                onChange={(on) => void patchSettings({ sound_enabled: on })}
              />
              <CompactSwitch
                icon={Vibrate}
                label="Titreşim"
                checked={settings.vibration_enabled}
                disabled={loading || savingSettings}
                onChange={(on) => void patchSettings({ vibration_enabled: on })}
              />
            </div>

            {settings.quiet_hours_enabled ? (
              <div className="grid grid-cols-2 gap-1.5">
                <label className="text-[10px] text-muted-foreground">
                  Başlangıç
                  <input
                    type="time"
                    className="mt-0.5 block h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
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
                    className="mt-0.5 block h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
                    value={minutesToTimeInput(settings.quiet_end_minutes)}
                    disabled={savingSettings}
                    onChange={(e) =>
                      void patchSettings({ quiet_end_minutes: timeInputToMinutes(e.target.value) })
                    }
                  />
                </label>
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">
                Kanallar
                <span className="ml-1 font-normal">(kalkan = kritik)</span>
              </p>
              {loading ? (
                <p className="text-[11px] text-muted-foreground">Yükleniyor…</p>
              ) : (
                <div className="max-h-[min(40vh,240px)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                  {channels.map((ch) => {
                    const p = prefMap.get(ch.id);
                    return (
                      <ChannelRow
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
                <p className="text-[10px] text-amber-700 dark:text-amber-300">Push sunucuda yapılandırılmamış.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
