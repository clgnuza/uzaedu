'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
  Moon,
  ShieldAlert,
  Smartphone,
  Volume2,
  VolumeX,
  Vibrate,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  pushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
  getNotificationPermission,
  requestNotificationPermission,
  getPushDeviceSnapshot,
  fetchPushStatus,
  repairPushSubscriptionIfNeeded,
  pushReasonMessage,
  canSubscribePushOnDevice,
} from '@/lib/web-push';
import { getChannelTheme, type NotificationChannelId } from '@/lib/notification-channel-theme';
import { NotificationChannelIcon } from '@/components/notification-channel-icon';
import { emitNotificationsUpdated } from '@/hooks/use-duty-notifications-unread';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DEFAULT_PUSH_SETTINGS,
  minutesToTimeInput,
  timeInputToMinutes,
  type PushUserSettings,
} from '@/lib/notification-push-prefs';
import { isIos, pushPlatformHint } from '@/lib/pwa-display';
import { PwaOfflineQueueBadge } from '@/components/pwa-offline-queue-badge';
import {
  NotificationPermissionDeniedHelp,
  NotificationPermissionPrompt,
} from '@/components/notification-permission-prompt';

const PUSH_TOAST_ID = 'uza-push-subscribe';

type ChannelDef = { id: string; label: string };
type Pref = { channel: string; push_enabled: boolean; critical?: boolean };

function CompactSwitch({
  label,
  checked,
  disabled,
  onChange,
  icon: Icon,
}: {
  label: string;
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
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold leading-tight transition-all active:scale-[0.98] touch-manipulation sm:min-h-15 sm:rounded-2xl sm:text-[11px]',
        checked
          ? 'border-2 border-teal-400/85 bg-linear-to-br from-teal-100 via-teal-50 to-cyan-50 text-teal-950 shadow-lg shadow-teal-500/25 ring-2 ring-teal-400/40 dark:border-teal-500 dark:from-teal-900/65 dark:via-teal-950 dark:to-cyan-950/55 dark:text-teal-50'
          : 'border border-teal-200/85 bg-linear-to-b from-teal-50/95 to-cyan-50/40 text-teal-950 shadow-sm hover:border-teal-300 dark:border-teal-900/45 dark:from-teal-950/45 dark:to-cyan-950/25 dark:text-teal-100',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl',
          checked
            ? 'bg-teal-600 text-white shadow-inner dark:bg-teal-500'
            : 'bg-teal-200/85 text-teal-950 dark:bg-teal-800/55 dark:text-teal-100',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span>{label}</span>
    </button>
  );
}

function ChannelRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-2">
      <div className="size-7 shrink-0 rounded-lg bg-muted" />
      <div className="h-3 flex-1 rounded bg-muted" />
      <div className="size-7 shrink-0 rounded-full bg-muted" />
    </div>
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
        'flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors',
        enabled ? 'border-border/60 bg-background/80' : 'border-border/30 bg-muted/15 opacity-75',
      )}
    >
      <NotificationChannelIcon channelId={channelId} size="sm" className="!size-7 shrink-0 !rounded-lg" />
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
          'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-transform active:scale-95',
          enabled
            ? cn('border-transparent text-white shadow-sm', `bg-linear-to-br ${theme.previewGradient}`)
            : 'border-muted-foreground/25 bg-muted/40',
        )}
      >
        {enabled ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      {enabled ? (
        <button
          type="button"
          title="Kritik — sessiz saatte de"
          aria-label="Kritik bildirim"
          disabled={disabled}
          onClick={() => onCriticalChange(!critical)}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
            critical
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'border-transparent text-muted-foreground hover:bg-muted/50',
          )}
        >
          <ShieldAlert className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
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
  const [localSubscribed, setLocalSubscribed] = useState(false);
  const [serverThisDevice, setServerThisDevice] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [pushServer, setPushServer] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [platformHint, setPlatformHint] = useState<ReturnType<typeof pushPlatformHint>>(null);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setPlatformHint(pushPlatformHint());
    setPermissionState(getNotificationPermission());
  }, []);

  const applyDeviceState = useCallback(
    (snap: Awaited<ReturnType<typeof getPushDeviceSnapshot>>, statusRes: Awaited<ReturnType<typeof fetchPushStatus>>) => {
      setPermissionState(snap.permission);
      setLocalSubscribed(snap.localSubscribed);
      setServerThisDevice(statusRes.thisDevice);
      setDeviceCount(statusRes.deviceCount);
      setPushServer(!!statusRes.pushEnabled);
      const active = snap.permission === 'granted' && snap.localSubscribed && statusRes.thisDevice;
      setSubscribed(active);
    },
    [],
  );

  const loadPreferences = useCallback(async () => {
    if (!token) return;
    setChannelsLoading(true);
    try {
      const prefRes = await apiFetch<{
        channels: ChannelDef[];
        preferences: Pref[];
        settings: PushUserSettings;
      }>('/notification-preferences', { token });
      setChannels(prefRes.channels ?? []);
      setPrefs(prefRes.preferences ?? []);
      setSettings({ ...DEFAULT_PUSH_SETTINGS, ...prefRes.settings });
    } catch {
      /* ignore */
    } finally {
      setChannelsLoading(false);
    }
  }, [token]);

  const loadDevice = useCallback(async () => {
    if (!token) return;
    try {
      const snap = await getPushDeviceSnapshot();
      const statusRes = await fetchPushStatus(token, snap.endpoint);
      applyDeviceState(snap, statusRes);
    } catch {
      /* ignore */
    }
  }, [token, applyDeviceState]);

  const resyncDevice = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || syncing) return;
      setSyncing(true);
      try {
        const r = await repairPushSubscriptionIfNeeded(token);
        if (r.ok) {
          await loadDevice();
          return true;
        }
        if (!opts?.silent && r.reason) {
          toast.error(pushReasonMessage(r.reason), { id: PUSH_TOAST_ID, duration: 4500 });
        }
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [token, syncing, loadDevice],
  );

  useEffect(() => {
    void loadPreferences();
    void loadDevice();
  }, [loadPreferences, loadDevice]);

  useEffect(() => {
    if (!token) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (getNotificationPermission() !== 'granted') {
        void loadDevice();
        return;
      }
      void resyncDevice({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token, loadDevice, resyncDevice]);

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
      void loadPreferences();
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
      return [...rest, { channel: channelId, push_enabled: old?.push_enabled !== false, critical }];
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
      if (!skipPermissionRequest) {
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          setPermissionDenied(true);
          toast.error('Bildirim izni verilmedi. Chrome’da “Bu site için izin ver” deyin.', {
            id: PUSH_TOAST_ID,
            duration: 4500,
          });
          return;
        }
      } else if (getNotificationPermission() !== 'granted') {
        setPermissionDenied(true);
        toast.error('Bildirim izni yok.', { id: PUSH_TOAST_ID, duration: 4000 });
        return;
      }

      setPermissionPromptOpen(false);
      setPermissionDenied(false);
      toast.loading('Bildirimler açılıyor…', { id: PUSH_TOAST_ID, duration: Infinity });

      const r = await subscribeWebPush(token, { skipPermissionRequest: true });

      if (r.ok) {
        await loadDevice();
        emitNotificationsUpdated();
        toast.success('Telefon bildirimleri açıldı', { id: PUSH_TOAST_ID, duration: 2500 });
        return;
      }

      if (r.reason === 'denied') {
        setPermissionDenied(true);
        toast.error(pushReasonMessage('denied'), { id: PUSH_TOAST_ID, duration: 4500 });
        return;
      }
      toast.error(pushReasonMessage(r.reason, r.message), { id: PUSH_TOAST_ID, duration: 4500 });
    } catch {
      toast.error('Bildirim açılamadı', { id: PUSH_TOAST_ID, duration: 4000 });
    } finally {
      setEnablingPush(false);
    }
  };

  const openEnableFlow = () => {
    setExpanded(true);
    const gate = canSubscribePushOnDevice();
    if (!gate.ok) {
      toast.error(pushReasonMessage(gate.reason), { id: PUSH_TOAST_ID, duration: 5000 });
      return;
    }
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
  };

  const disableDevice = async () => {
    if (!token) return;
    await unsubscribeWebPush(token);
    await loadDevice();
    toast.success('Bu cihazdaki push kapatıldı', { duration: 2500 });
  };

  if (!token) return null;
  if (!pushSupported() && !isIos()) return null;

  const gate = canSubscribePushOnDevice();
  const badgeLabel = subscribed
    ? 'Aktif'
    : permissionState === 'granted' && (localSubscribed || serverThisDevice)
      ? 'Eksik'
      : 'Kapalı';
  const controlsDisabled = channelsLoading || savingSettings;
  const statusHint =
    permissionState === 'granted' ? 'izin verildi' : permissionState === 'denied' ? 'izin engelli' : 'izin bekleniyor';

  return (
    <>
      <NotificationPermissionPrompt
        open={permissionPromptOpen}
        onOpenChange={setPermissionPromptOpen}
        onConfirm={confirmPermissionPrompt}
        busy={enablingPush}
        showDeniedHelp={permissionDenied}
      />
      <Card className="mb-3 overflow-hidden rounded-2xl border-border/50 shadow-md ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="space-y-0 border-b-0 p-0">
          <div className="relative overflow-hidden bg-linear-to-br from-violet-600 via-indigo-600 to-sky-600 px-3 py-2.5 sm:px-4 sm:py-3 dark:from-violet-800 dark:via-indigo-800 dark:to-sky-800">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 80%, #fbbf24 0%, transparent 40%)',
              }}
              aria-hidden
            />
            <div className="relative flex min-h-[44px] items-center gap-2 sm:gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner ring-1 ring-white/25">
                <Smartphone className="size-4 sm:size-[18px]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold leading-tight tracking-tight text-white sm:text-base">
                  Telefon bildirimleri
                </h2>
                <p className="truncate text-[11px] leading-snug text-white/85 sm:text-xs">
                  Kilit ekranı · {statusHint}
                  {deviceCount > 1 ? ` · ${deviceCount} cihaz` : ''}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ring-1 sm:px-2.5 sm:py-1 sm:text-xs',
                  subscribed
                    ? 'bg-emerald-400/90 text-white ring-white/40'
                    : permissionState === 'granted'
                      ? 'bg-amber-400/90 text-amber-950 ring-white/40'
                      : 'bg-white/25 text-white ring-white/30',
                )}
              >
                {badgeLabel}
              </span>
              <PwaOfflineQueueBadge />
              <div className="flex shrink-0 items-center gap-1">
                {subscribed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full bg-white/15 px-3 text-xs font-semibold text-white hover:bg-white/25"
                    onClick={() => void disableDevice()}
                  >
                    Kapat
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full bg-white/20 px-3 text-xs font-semibold text-white hover:bg-white/30"
                    disabled={!pushServer || !gate.ok || enablingPush || syncing}
                    onClick={openEnableFlow}
                  >
                    <BellRing className="mr-1 size-3.5" />
                    {permissionState === 'granted' && !subscribed ? 'Tamamla' : 'Aç'}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-9 text-white hover:bg-white/20 sm:size-10',
                    expanded && 'bg-white/25 ring-1 ring-white/35',
                  )}
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Ayarları gizle' : 'Ayarları göster'}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          {expanded ? (
            <div className="border-b border-border/40 bg-linear-to-b from-violet-50/40 via-muted/25 to-muted/10 px-2.5 pb-3 pt-3 dark:from-violet-950/20 sm:px-4">
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                <CompactSwitch
                  icon={Moon}
                  label="Sessiz"
                  checked={settings.quiet_hours_enabled}
                  disabled={controlsDisabled}
                  onChange={(on) => void patchSettings({ quiet_hours_enabled: on })}
                />
                <CompactSwitch
                  icon={settings.sound_enabled ? Volume2 : VolumeX}
                  label="Ses"
                  checked={settings.sound_enabled}
                  disabled={controlsDisabled}
                  onChange={(on) => void patchSettings({ sound_enabled: on })}
                />
                <CompactSwitch
                  icon={Vibrate}
                  label="Titreşim"
                  checked={settings.vibration_enabled}
                  disabled={controlsDisabled}
                  onChange={(on) => void patchSettings({ vibration_enabled: on })}
                />
              </div>
            </div>
          ) : null}
        </CardHeader>

        {expanded ? (
          <CardContent className="space-y-3 border-t border-border/30 bg-muted/15 p-3 sm:p-4">
            {permissionDenied && !subscribed ? (
              <NotificationPermissionDeniedHelp onRetry={openEnableFlow} />
            ) : null}

            {platformHint === 'ios_standalone' ? (
              <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                iOS: Ana ekrana ekleyip uygulamadan açın (iOS 16.4+).
              </p>
            ) : platformHint === 'android_ok' ? (
              <p className="text-[11px] text-muted-foreground">Android: İzin sonrası &quot;Tamamla&quot;ya basın.</p>
            ) : null}

            {settings.quiet_hours_enabled ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-muted-foreground">
                  Sessiz başlangıç
                  <input
                    type="time"
                    className="mt-1 block h-9 w-full rounded-xl border border-input bg-background px-2 text-xs"
                    value={minutesToTimeInput(settings.quiet_start_minutes)}
                    disabled={savingSettings}
                    onChange={(e) => void patchSettings({ quiet_start_minutes: timeInputToMinutes(e.target.value) })}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Sessiz bitiş
                  <input
                    type="time"
                    className="mt-1 block h-9 w-full rounded-xl border border-input bg-background px-2 text-xs"
                    value={minutesToTimeInput(settings.quiet_end_minutes)}
                    disabled={savingSettings}
                    onChange={(e) => void patchSettings({ quiet_end_minutes: timeInputToMinutes(e.target.value) })}
                  />
                </label>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Kanallar</p>
                <p className="text-[10px] text-muted-foreground">Kalkan = kritik</p>
              </div>
              <div className="max-h-[min(42vh,280px)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                {channelsLoading
                  ? Array.from({ length: 8 }, (_, i) => <ChannelRowSkeleton key={i} />)
                  : channels.map((ch) => {
                      const p = prefMap.get(ch.id);
                      return (
                        <ChannelRow
                          key={ch.id}
                          channelId={ch.id}
                          label={ch.label}
                          enabled={p?.push ?? true}
                          critical={p?.critical ?? false}
                          disabled={channelsLoading}
                          onChange={(on) => void toggleChannel(ch.id, on)}
                          onCriticalChange={(on) => void toggleCritical(ch.id, on)}
                        />
                      );
                    })}
              </div>
              {!pushServer && !channelsLoading ? (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">Push sunucuda yapılandırılmamış.</p>
              ) : null}
            </div>
          </CardContent>
        ) : null}
      </Card>
    </>
  );
}
