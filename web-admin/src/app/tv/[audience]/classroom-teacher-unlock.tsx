'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent, ReactNode } from 'react';
import { getApiUrl } from '@/lib/api';
import {
  buildClassroomQrImageSrc,
  CLASSROOM_QR_POLL_INTERVAL_MS,
  classroomTvErrorMessage,
  createClassroomQrSession,
  tryUnlockFromQrPoll,
} from '@/lib/smart-board-classroom-api';
import { KeyRound, Monitor, QrCode, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function classroomTeacherStorageKey(schoolId: string, deviceId: string) {
  return `tv_usb_${schoolId}_${deviceId}`;
}

export function persistClassroomTeacherToken(schoolId: string, deviceId: string, token: string) {
  try {
    sessionStorage.setItem(classroomTeacherStorageKey(schoolId, deviceId), token);
  } catch {
    /* ignore */
  }
}

export function clearClassroomTeacherToken(schoolId: string, deviceId: string) {
  try {
    sessionStorage.removeItem(classroomTeacherStorageKey(schoolId, deviceId));
  } catch {
    /* ignore */
  }
}

function ClassroomUnlockDialog({
  open,
  onClose,
  titleId,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        role="dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X className="size-5" />
        </button>
        <h2 id={titleId} className="pr-8 text-center text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">Duyuru TV arka planda çalışmaya devam eder.</p>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ClassroomTeacherUnlockPanel({
  schoolId,
  deviceId,
  onUnlocked,
  autoStartQr,
  pinFocus,
}: {
  schoolId: string;
  deviceId: string;
  onUnlocked: (token: string) => void;
  /** Modal açılınca QR üret */
  autoStartQr?: boolean;
  /** Yalnız PIN/OTP formu (yan panel yedek giriş) */
  pinFocus?: boolean;
}) {
  const [pin, setPin] = useState('');
  const [unlockMode, setUnlockMode] = useState<'pin' | 'otp' | 'auto'>('auto');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrErr, setQrErr] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<{ session_id: string; code: string; expires_in: number } | null>(null);
  const [qrLeftSec, setQrLeftSec] = useState(0);
  const qrAutoStartedRef = useRef(false);
  const qrPollStartedRef = useRef(0);
  const qrExchangingRef = useRef(false);

  const qrLink = useMemo(() => {
    if (!qrSession || typeof window === 'undefined') return '';
    return `${window.location.origin}/akilli-tahta?qr_school=${encodeURIComponent(schoolId)}&qr_device=${encodeURIComponent(deviceId)}&qr_session=${encodeURIComponent(qrSession.session_id)}&qr_code=${encodeURIComponent(qrSession.code)}`;
  }, [qrSession, schoolId, deviceId]);

  const createQrSession = useCallback(() => {
    setQrBusy(true);
    setQrErr(null);
    void createClassroomQrSession({ schoolId, deviceId })
      .then((body) => {
        setQrSession({
          session_id: body.session_id,
          code: body.code,
          expires_in: body.expires_in ?? 120,
        });
        qrPollStartedRef.current = Date.now();
      })
      .catch((e) => {
        const code = (e as Error & { code?: string }).code;
        setQrErr(classroomTvErrorMessage(code, e instanceof Error ? e.message : undefined));
      })
      .finally(() => setQrBusy(false));
  }, [schoolId, deviceId]);

  useEffect(() => {
    if (!autoStartQr || qrAutoStartedRef.current) return;
    qrAutoStartedRef.current = true;
    createQrSession();
  }, [autoStartQr, createQrSession]);

  useEffect(() => {
    if (!qrSession) {
      setQrLeftSec(0);
      return;
    }
    setQrLeftSec(Math.max(1, qrSession.expires_in || 120));
    const id = setInterval(() => {
      setQrLeftSec((prev) => {
        if (prev <= 1) {
          setQrSession(null);
          setQrErr('QR süresi doldu. Yeniden oluşturun.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [qrSession]);

  useEffect(() => {
    if (!qrSession) return;
    const tick = () => {
      void tryUnlockFromQrPoll({
        schoolId,
        deviceId,
        sessionId: qrSession.session_id,
        exchangingRef: qrExchangingRef,
        onUnlocked: (tok) => {
          persistClassroomTeacherToken(schoolId, deviceId, tok);
          onUnlocked(tok);
        },
      }).then((r) => {
        if (r === 'expired') {
          setQrSession(null);
          setQrErr('QR süresi doldu. Yeniden oluşturun.');
        }
      })
        .catch((e) => {
          const code = (e as Error & { code?: string }).code;
          setQrErr(classroomTvErrorMessage(code, e instanceof Error ? e.message : undefined));
        });
    };
    void tick();
    const id = setInterval(tick, CLASSROOM_QR_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [qrSession, schoolId, deviceId, onUnlocked]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '').slice(0, 8);
    if (p.length < 4) {
      setErr('PIN en az 4 hane olmalıdır.');
      return;
    }
    setBusy(true);
    setErr(null);
    void fetch(getApiUrl('/tv/classroom-usb-unlock'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, device_id: deviceId, pin: p, mode: unlockMode }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { message?: string; access_token?: string };
        if (!res.ok) throw new Error(body.message || 'PIN kabul edilmedi');
        const tok = body.access_token;
        if (!tok) throw new Error('Yanıt geçersiz');
        persistClassroomTeacherToken(schoolId, deviceId, tok);
        onUnlocked(tok);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Hata'))
      .finally(() => setBusy(false));
  };

  const pinForm = (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="grid grid-cols-3 gap-2">
        {(['auto', 'pin', 'otp'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-lg border px-2 py-2 text-xs ${unlockMode === m ? 'border-sky-500 bg-sky-600/20 text-white' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
            onClick={() => setUnlockMode(m)}
          >
            {m === 'auto' ? 'Otomatik' : m === 'pin' ? 'PIN' : 'OTP'}
          </button>
        ))}
      </div>
      <input
        type="password"
        inputMode="numeric"
        maxLength={8}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        placeholder="••••"
        autoFocus={pinFocus}
        className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.35em]"
      />
      {err ? <p className="text-center text-sm text-red-400">{err}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Doğrulanıyor…' : 'PIN / OTP ile geç'}
      </button>
    </form>
  );

  if (pinFocus) {
    return (
      <div className="space-y-3 text-slate-100">
        <p className="text-center text-sm text-slate-400">
          Okul tahta PIN veya tek kullanımlık OTP kodunu girin.
        </p>
        {pinForm}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-100">
      <p className="text-center text-sm text-slate-400">
        Telefondan veya panelden <strong className="text-slate-200">Akıllı Tahta</strong> hesabınızla QR okutun. Tahta duyuru
        modundan çıkar.
      </p>
      <button
        type="button"
        disabled={qrBusy}
        className="w-full rounded-xl border border-teal-600/50 bg-teal-950/80 px-4 py-3 text-sm font-semibold hover:bg-teal-900/80 disabled:opacity-50"
        onClick={createQrSession}
      >
        {qrBusy ? 'QR hazırlanıyor…' : 'QR göster'}
      </button>
      {qrErr ? <p className="text-center text-sm text-red-400">{qrErr}</p> : null}
      {qrSession ? (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p className="text-center text-xs text-slate-300">
            Kod: <span className="font-mono text-base tracking-widest text-white">{qrSession.code}</span>
          </p>
          <p className="text-center text-[11px] text-slate-400">
            Kalan: <span className="font-mono text-slate-200">{qrLeftSec}s</span>
          </p>
          {qrLink ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildClassroomQrImageSrc(qrLink)}
                alt=""
                className="mx-auto size-36 rounded bg-white p-1"
              />
              <p className="break-all rounded bg-slate-900 p-2 font-mono text-[9px] text-slate-400">{qrLink}</p>
            </>
          ) : null}
        </div>
      ) : null}
      <details className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-200">Yedek: PIN / OTP</summary>
        <div className="mt-3">{pinForm}</div>
      </details>
    </div>
  );
}

/** Duyuru modunda QR — öğretmeni yönlendirir (yan panel veya köşe chip) */
function ClassroomSignageQrChip({
  schoolId,
  deviceId,
  disabled,
  onUnlocked,
  onTvError,
  variant = 'floating',
  qrSize = 'sm',
}: {
  schoolId: string;
  deviceId: string;
  disabled?: boolean;
  onUnlocked: (token: string) => void;
  onTvError?: (message: string) => void;
  variant?: 'floating' | 'inline';
  /** sm: köşe chip; lg: yan panel — tam genişlik, yüksek çözünürlük */
  qrSize?: 'sm' | 'lg';
}) {
  const [qrSession, setQrSession] = useState<{ session_id: string; code: string } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [takeoverSecondsLeft, setTakeoverSecondsLeft] = useState<number | null>(null);
  const [takeoverTeacherName, setTakeoverTeacherName] = useState<string | null>(null);
  const chipPollStartedRef = useRef(0);
  const chipExchangingRef = useRef(false);
  const chipRefreshInFlightRef = useRef(false);
  const chipRateLimitedUntilRef = useRef(0);
  const qrLink = useMemo(() => {
    if (!qrSession || typeof window === 'undefined') return '';
    return `${window.location.origin}/akilli-tahta?qr_school=${encodeURIComponent(schoolId)}&qr_device=${encodeURIComponent(deviceId)}&qr_session=${encodeURIComponent(qrSession.session_id)}&qr_code=${encodeURIComponent(qrSession.code)}`;
  }, [qrSession, schoolId, deviceId]);

  const refresh = useCallback(() => {
    if (disabled || chipRefreshInFlightRef.current) return;
    if (chipRateLimitedUntilRef.current > Date.now()) return;
    chipRefreshInFlightRef.current = true;
    setQrBusy(true);
    void createClassroomQrSession({ schoolId, deviceId })
      .then((body) => {
        setQrSession({ session_id: body.session_id, code: body.code });
        chipPollStartedRef.current = Date.now();
      })
      .catch((e) => {
        const code = (e as Error & { code?: string }).code;
        if (code === 'TV_RATE_LIMIT') chipRateLimitedUntilRef.current = Date.now() + 60_000;
        setQrSession(null);
        onTvError?.(classroomTvErrorMessage(code, e instanceof Error ? e.message : undefined));
      })
      .finally(() => {
        chipRefreshInFlightRef.current = false;
        setQrBusy(false);
      });
  }, [schoolId, deviceId, disabled, onTvError]);

  useEffect(() => {
    if (!disabled) refresh();
  }, [refresh, disabled]);

  useEffect(() => {
    if (!qrSession || disabled) return;
    const tick = () => {
      void tryUnlockFromQrPoll({
        schoolId,
        deviceId,
        sessionId: qrSession.session_id,
        exchangingRef: chipExchangingRef,
        onUnlocked: (tok) => {
          setTakeoverSecondsLeft(null);
          setTakeoverTeacherName(null);
          persistClassroomTeacherToken(schoolId, deviceId, tok);
          onUnlocked(tok);
        },
        onTakeoverPending: ({ seconds_left, teacher_name }) => {
          setTakeoverSecondsLeft(seconds_left);
          setTakeoverTeacherName(teacher_name);
        },
      })
        .then((r) => {
          if (r === 'takeover_pending') return;
          if (r === 'unlocked') {
            setTakeoverSecondsLeft(null);
            setTakeoverTeacherName(null);
          }
          if (r === 'expired') setQrSession(null);
        })
        .catch((e) => {
          const code = (e as Error & { code?: string }).code;
          if (code === 'TV_RATE_LIMIT') chipRateLimitedUntilRef.current = Date.now() + 60_000;
          onTvError?.(classroomTvErrorMessage(code, e instanceof Error ? e.message : undefined));
        });
    };
    void tick();
    const id = setInterval(tick, CLASSROOM_QR_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [qrSession, schoolId, deviceId, disabled, onUnlocked, refresh, onTvError]);

  if (disabled) return null;

  const isPanel = variant === 'inline' && qrSize === 'lg';
  const qrPx = isPanel ? 420 : 280;

  const inner = (
    <>
      {!isPanel ? (
        <p className="flex items-center gap-1 text-[10px] font-semibold text-teal-200">
          <QrCode className="size-3.5 shrink-0" />
          Telefondan okutun (Uzaedu girişli)
        </p>
      ) : null}
      {qrBusy && !qrLink ? (
        <p className={cn('text-slate-400', isPanel ? 'py-8 text-center text-sm' : 'mt-1 text-[9px]')}>
          QR hazırlanıyor…
        </p>
      ) : null}
      {qrLink ? (
        <>
          <div
            className={cn(
              'mx-auto flex items-center justify-center rounded-lg bg-white shadow-inner',
              isPanel ? 'mt-0 w-full p-3' : 'mt-1 p-0.5',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildClassroomQrImageSrc(qrLink, { px: qrPx })}
              alt="Öğretmen girişi QR kodu"
              className={cn(
                'block rounded-sm',
                isPanel ? 'h-auto w-full max-w-full' : 'size-24',
              )}
            />
          </div>
          {qrSession?.code ? (
            <p
              className={cn(
                'text-center font-mono font-bold tracking-[0.35em]',
                isPanel
                  ? 'mt-3 text-base text-[var(--tv-text)] sm:text-lg'
                  : 'mt-1 text-[9px] tracking-widest text-slate-300',
              )}
            >
              {qrSession.code}
            </p>
          ) : null}
          {isPanel ? (
            <p className="mt-2 text-center text-xs leading-snug text-[var(--tv-text-muted)]">
              Telefon kamerasıyla okutun veya aşağıdan PIN girin
            </p>
          ) : null}
          {takeoverSecondsLeft != null && takeoverSecondsLeft > 0 ? (
            <p className="mt-2 text-center text-xs font-semibold text-amber-200">
              {takeoverTeacherName ? `${takeoverTeacherName} ` : ''}
              bağlanıyor… {takeoverSecondsLeft} sn
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );

  if (variant === 'inline') {
    return <div className="min-w-0">{inner}</div>;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[85] max-w-[11rem] rounded-xl border border-slate-600/80 bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm sm:max-w-[12.5rem]">
      {inner}
    </div>
  );
}

/** Koridor TV yan paneli — tahta QR, kod ve öğretmen girişi */
export function ClassroomSidePanelBlock({
  schoolId,
  deviceId,
  teacherMode,
  teacherName,
  pendingConnect,
  takeoverSecondsLeft,
  takeoverTeacherName,
  sessionEndsAt,
  currentSlotLabel,
  onUnlocked,
  onExitSignage,
  onTvError,
}: {
  schoolId: string;
  deviceId: string;
  teacherMode: boolean;
  teacherName?: string | null;
  pendingConnect?: boolean;
  takeoverSecondsLeft?: number | null;
  takeoverTeacherName?: string | null;
  sessionEndsAt?: number | null;
  currentSlotLabel?: string | null;
  onUnlocked: (token: string) => void;
  onExitSignage: () => void;
  onTvError?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [remainLabel, setRemainLabel] = useState<string | null>(null);
  const showSignageQr = !teacherMode && !pendingConnect;

  useEffect(() => {
    if (!teacherMode || !sessionEndsAt) {
      setRemainLabel(null);
      return;
    }
    const tick = () => setRemainLabel(formatSessionRemaining(sessionEndsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [teacherMode, sessionEndsAt]);

  return (
    <div className="tv-classroom-panel min-h-0 min-w-0 shrink-0 overflow-hidden rounded-xl bg-white/5">
      <div className="tv-panel-banner tv-panel-banner--accent flex items-center justify-center gap-2">
        <QrCode className="size-4 shrink-0" aria-hidden />
        Öğretmen girişi
      </div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        {currentSlotLabel ? (
          <p className="mb-3 text-center text-sm leading-snug text-[var(--tv-text-muted)]">{currentSlotLabel}</p>
        ) : null}
        {pendingConnect && !teacherMode ? (
          <p className="py-4 text-center text-sm font-medium text-[var(--tv-accent)]">
            {takeoverSecondsLeft != null && takeoverSecondsLeft > 0
              ? `${takeoverTeacherName ? `${takeoverTeacherName} ` : ''}ders oturumu ${takeoverSecondsLeft} sn`
              : 'Öğretmen bağlanıyor…'}
          </p>
        ) : null}
        {teacherMode ? (
          <div className="space-y-3 text-sm text-[var(--tv-text)]">
            <p className="text-center">
              <Monitor className="mx-auto mb-2 size-8 text-[var(--tv-accent)]" aria-hidden />
              <strong className="font-semibold">Ders oturumu</strong>
              {teacherName ? ` — ${teacherName}` : ''}
              {remainLabel ? (
                <>
                  <br />
                  <span className="text-[var(--tv-text-muted)]">Kalan: {remainLabel}</span>
                </>
              ) : null}
            </p>
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--tv-accent)]/40 bg-[var(--tv-accent)]/15 px-3 py-2.5 text-sm font-semibold text-[var(--tv-text)] hover:bg-[var(--tv-accent)]/25"
              onClick={onExitSignage}
            >
              Duyuru moduna dön
            </button>
          </div>
        ) : (
          <>
            <ClassroomSignageQrChip
              schoolId={schoolId}
              deviceId={deviceId}
              disabled={!showSignageQr}
              variant="inline"
              qrSize="lg"
              onUnlocked={onUnlocked}
              onTvError={onTvError}
            />
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-[var(--tv-text)] hover:bg-white/10"
              onClick={() => setOpen(true)}
            >
              <KeyRound className="size-4 text-[var(--tv-accent)]" aria-hidden />
              PIN / OTP ile giriş
            </button>
          </>
        )}
      </div>
      <ClassroomUnlockDialog
        open={open}
        onClose={() => setOpen(false)}
        titleId="classroom-unlock-panel-title"
        title="PIN / OTP ile giriş"
      >
        <ClassroomTeacherUnlockPanel
          schoolId={schoolId}
          deviceId={deviceId}
          pinFocus
          onUnlocked={(t) => {
            onUnlocked(t);
            setOpen(false);
          }}
        />
      </ClassroomUnlockDialog>
    </div>
  );
}

export function ClassroomBoardNotice({ message, tone }: { message: string | null; tone?: 'info' | 'success' | 'warn' }) {
  if (!message) return null;
  const styles =
    tone === 'success'
      ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100'
      : tone === 'warn'
        ? 'border-amber-500/50 bg-amber-950/90 text-amber-100'
        : 'border-sky-500/50 bg-sky-950/90 text-sky-100';
  return (
    <div
      className={cn(
        'pointer-events-none fixed left-1/2 top-14 z-[92] max-w-lg -translate-x-1/2 rounded-xl border px-4 py-2.5 text-center text-sm font-medium shadow-lg backdrop-blur-sm',
        styles,
      )}
      role="status"
    >
      {message}
    </div>
  );
}

function formatSessionRemaining(endsAt: number | null): string | null {
  if (!endsAt) return null;
  const sec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ClassroomTeacherControls({
  schoolId,
  deviceId,
  teacherMode,
  teacherName,
  pendingConnect,
  takeoverSecondsLeft,
  takeoverTeacherName,
  sessionEndsAt,
  onUnlocked,
  onExitSignage,
  onTvError,
  uiMode = 'overlay',
}: {
  schoolId: string;
  deviceId: string;
  teacherMode: boolean;
  teacherName?: string | null;
  pendingConnect?: boolean;
  takeoverSecondsLeft?: number | null;
  takeoverTeacherName?: string | null;
  sessionEndsAt?: number | null;
  onUnlocked: (token: string) => void;
  onExitSignage: () => void;
  onTvError?: (message: string) => void;
  /** panel: QR/giriş yan menüde; overlay: köşe chip + FAB */
  uiMode?: 'overlay' | 'panel';
}) {
  const [open, setOpen] = useState(false);
  const [remainLabel, setRemainLabel] = useState<string | null>(null);
  const showSignageQr = !teacherMode && !pendingConnect;
  const usePanel = uiMode === 'panel';

  useEffect(() => {
    if (!teacherMode || !sessionEndsAt) {
      setRemainLabel(null);
      return;
    }
    const tick = () => setRemainLabel(formatSessionRemaining(sessionEndsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [teacherMode, sessionEndsAt]);

  return (
    <>
      {!usePanel ? (
        <ClassroomSignageQrChip
          schoolId={schoolId}
          deviceId={deviceId}
          disabled={!showSignageQr}
          onUnlocked={onUnlocked}
          onTvError={onTvError}
        />
      ) : null}
      {pendingConnect && !teacherMode ? (
        <div className="pointer-events-none absolute left-0 right-0 top-14 z-[91] flex justify-center px-3">
          <p className="rounded-xl border border-sky-500/40 bg-sky-950/90 px-4 py-2 text-sm font-medium text-sky-100 shadow-lg">
            {takeoverSecondsLeft != null && takeoverSecondsLeft > 0
              ? `${takeoverTeacherName ? `${takeoverTeacherName} ` : ''}ders oturumu ${takeoverSecondsLeft} sn içinde başlayacak`
              : 'Öğretmen bağlanıyor…'}
          </p>
        </div>
      ) : null}
      {teacherMode ? (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[90] flex justify-center px-3 pt-2">
          <div className="pointer-events-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-950/90 px-3 py-2 text-xs text-teal-100 shadow-lg backdrop-blur-sm">
            <Monitor className="size-4 shrink-0 text-teal-300" aria-hidden />
            <span>
              <strong className="font-semibold">Akıllı tahta kullanımı</strong>
              {teacherName ? ` — ${teacherName}` : ''}
              {remainLabel ? ` · Sinyal: ${remainLabel}` : ''}. Oturum bitince duyuru moduna döner.
            </span>
            <button
              type="button"
              className="rounded-lg border border-teal-500/50 bg-teal-800/60 px-2.5 py-1 text-[11px] font-semibold hover:bg-teal-700/60"
              onClick={onExitSignage}
            >
              Duyuru moduna dön
            </button>
          </div>
        </div>
      ) : null}

      {!usePanel && !open ? (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-[85] flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-900/95 px-4 py-2.5 text-sm font-semibold text-slate-100 shadow-xl backdrop-blur-sm hover:bg-slate-800"
          onClick={() => setOpen(true)}
          aria-label={teacherMode ? 'Öğretmen ayarları' : 'Öğretmen girişi'}
        >
          <KeyRound className="size-4 text-teal-400" />
          {teacherMode ? 'Tahta kullanımı' : 'Öğretmen girişi'}
        </button>
      ) : null}

      <ClassroomUnlockDialog
        open={!usePanel && open}
        onClose={() => setOpen(false)}
        titleId="classroom-unlock-title"
        title="Öğretmen girişi"
      >
        <ClassroomTeacherUnlockPanel
          schoolId={schoolId}
          deviceId={deviceId}
          onUnlocked={(t) => {
            onUnlocked(t);
            setOpen(false);
          }}
          autoStartQr
        />
      </ClassroomUnlockDialog>
    </>
  );
}
