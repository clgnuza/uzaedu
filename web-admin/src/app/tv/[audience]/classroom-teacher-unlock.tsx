'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getApiUrl } from '@/lib/api';
import {
  buildClassroomQrImageSrc,
  classroomTvErrorMessage,
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

export function ClassroomTeacherUnlockPanel({
  schoolId,
  deviceId,
  onUnlocked,
  autoStartQr,
}: {
  schoolId: string;
  deviceId: string;
  onUnlocked: (token: string) => void;
  /** Modal açılınca QR üret */
  autoStartQr?: boolean;
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
    void fetch(getApiUrl('/tv/classroom-qr-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, device_id: deviceId }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          session_id?: string;
          code?: string;
          expires_in?: number;
          message?: string;
        };
        if (!res.ok || !body.session_id || !body.code) {
          throw new Error(body.message || 'QR oturumu oluşturulamadı');
        }
        setQrSession({
          session_id: body.session_id,
          code: body.code,
          expires_in: body.expires_in ?? 120,
        });
        qrPollStartedRef.current = Date.now();
      })
      .catch((e) => setQrErr(e instanceof Error ? e.message : 'QR hatası'))
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
    const ms =
      qrPollStartedRef.current > 0 && Date.now() - qrPollStartedRef.current < 30_000 ? 500 : 800;
    const id = setInterval(tick, ms);
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
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
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
      </details>
    </div>
  );
}

/** Duyuru modunda sürekli küçük QR — öğretmeni yönlendirir */
function ClassroomSignageQrChip({
  schoolId,
  deviceId,
  disabled,
  onUnlocked,
  onTvError,
}: {
  schoolId: string;
  deviceId: string;
  disabled?: boolean;
  onUnlocked: (token: string) => void;
  onTvError?: (message: string) => void;
}) {
  const [qrSession, setQrSession] = useState<{ session_id: string; code: string } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const chipPollStartedRef = useRef(0);
  const chipExchangingRef = useRef(false);
  const qrLink = useMemo(() => {
    if (!qrSession || typeof window === 'undefined') return '';
    return `${window.location.origin}/akilli-tahta?qr_school=${encodeURIComponent(schoolId)}&qr_device=${encodeURIComponent(deviceId)}&qr_session=${encodeURIComponent(qrSession.session_id)}&qr_code=${encodeURIComponent(qrSession.code)}`;
  }, [qrSession, schoolId, deviceId]);

  const refresh = useCallback(() => {
    if (disabled) return;
    setQrBusy(true);
    void fetch(getApiUrl('/tv/classroom-qr-session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, device_id: deviceId }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { session_id?: string; code?: string };
        if (!res.ok || !body.session_id || !body.code) throw new Error('QR oluşturulamadı');
        setQrSession({ session_id: body.session_id, code: body.code });
        chipPollStartedRef.current = Date.now();
      })
      .catch(() => setQrSession(null))
      .finally(() => setQrBusy(false));
  }, [schoolId, deviceId, disabled]);

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
          persistClassroomTeacherToken(schoolId, deviceId, tok);
          onUnlocked(tok);
        },
      })
        .then((r) => {
          if (r === 'expired') {
            setQrSession(null);
            refresh();
          }
        })
        .catch((e) => {
          const code = (e as Error & { code?: string }).code;
          onTvError?.(classroomTvErrorMessage(code, e instanceof Error ? e.message : undefined));
        });
    };
    void tick();
    const ms =
      chipPollStartedRef.current > 0 && Date.now() - chipPollStartedRef.current < 30_000 ? 500 : 800;
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [qrSession, schoolId, deviceId, disabled, onUnlocked, refresh, onTvError]);

  if (disabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[85] max-w-[11rem] rounded-xl border border-slate-600/80 bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm sm:max-w-[12.5rem]">
      <p className="flex items-center gap-1 text-[10px] font-semibold text-teal-200">
        <QrCode className="size-3.5 shrink-0" />
        Telefondan okutun
      </p>
      {qrBusy && !qrLink ? <p className="mt-1 text-[9px] text-slate-400">QR hazırlanıyor…</p> : null}
      {qrLink ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={buildClassroomQrImageSrc(qrLink)}
            alt=""
            className="mx-auto mt-1 size-24 rounded bg-white p-0.5"
          />
          <p className="mt-1 text-center font-mono text-[9px] tracking-widest text-slate-300">{qrSession?.code}</p>
        </>
      ) : null}
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
  sessionEndsAt,
  onUnlocked,
  onExitSignage,
  onTvError,
}: {
  schoolId: string;
  deviceId: string;
  teacherMode: boolean;
  teacherName?: string | null;
  pendingConnect?: boolean;
  sessionEndsAt?: number | null;
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
    <>
      <ClassroomSignageQrChip
        schoolId={schoolId}
        deviceId={deviceId}
        disabled={!showSignageQr}
        onUnlocked={onUnlocked}
        onTvError={onTvError}
      />
      {pendingConnect && !teacherMode ? (
        <div className="pointer-events-none absolute left-0 right-0 top-14 z-[91] flex justify-center px-3">
          <p className="rounded-xl border border-sky-500/40 bg-sky-950/90 px-4 py-2 text-sm font-medium text-sky-100 shadow-lg">
            Öğretmen bağlanıyor…
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

      {!open ? (
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

      {open ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            role="dialog"
            aria-labelledby="classroom-unlock-title"
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
            <h2 id="classroom-unlock-title" className="pr-8 text-center text-lg font-semibold text-white">
              Öğretmen girişi
            </h2>
            <p className="mt-1 text-center text-xs text-slate-400">Duyuru TV arka planda çalışmaya devam eder.</p>
            <div className="mt-4">
              <ClassroomTeacherUnlockPanel
                schoolId={schoolId}
                deviceId={deviceId}
                onUnlocked={(t) => {
                  onUnlocked(t);
                  setOpen(false);
                }}
                autoStartQr
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
