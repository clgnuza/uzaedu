'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';
import { downloadPardusKurulumZip } from '@/lib/pardus-kurulum-bundle';
import { parseClassroomSetupLink, buildPardusKurulumPageUrl } from '@/lib/smart-board-setup-link-parse';
import { sortSmartBoardDevicesByName } from '@/lib/smart-board-device-sort';
import { SMART_BOARD_QR_FLOW_SUMMARY } from '@/lib/smart-board-teacher-qr-flow';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Link2,
  Monitor,
  Package,
  School,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SetupDevice = { id: string; name: string; class_section: string | null };

const STEPS = [
  { id: 'link', title: 'Kurulum linki', icon: Link2 },
  { id: 'board', title: 'Tahta seçimi', icon: Monitor },
  { id: 'download', title: 'Paket indir', icon: Download },
  { id: 'install', title: "Pardus'ta kur", icon: Terminal },
  { id: 'done', title: 'Tamamlandı', icon: Check },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function classroomSetupErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'INVALID_SETUP_CODE':
    case 'SETUP_CODE_NOT_FOUND':
      return 'Kurulum kodu geçersiz. Okul yöneticisinden güncel link isteyin.';
    case 'TV_ACCESS_RESTRICTED':
      return 'İstek okul ağı dışından. Tahtayı okul internetine bağlayın.';
    case 'PAIRING_CODE_INVALID':
      return 'Eşleştirme kodu hatalı. Tahta etiketindeki 8 karakterli kodu girin.';
    case 'SETUP_DEVICE_SCOPE':
      return 'Bu tahta bu okul kurulum koduna ait değil.';
    case 'TV_RATE_LIMIT':
      return 'Çok fazla deneme. Biraz bekleyin.';
    case 'TV_IP_NOT_CONFIGURED':
      return 'Okul panelinde TV izinli IP listesi tanımlanmalı (canlı ortam).';
    default:
      return fallback || 'İşlem tamamlanamadı.';
  }
}

export function PardusKurulumWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get('kod')?.trim().toUpperCase() ?? '';

  const [step, setStep] = useState<StepId>('link');
  const [linkInput, setLinkInput] = useState(prefillCode);
  const [setupCode, setSetupCode] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [devices, setDevices] = useState<SetupDevice[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [customClass, setCustomClass] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [registeredDeviceId, setRegisteredDeviceId] = useState('');

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const sortedDevices = useMemo(() => sortSmartBoardDevicesByName(devices), [devices]);

  const selectedDevice = useMemo(
    () => sortedDevices.find((d) => d.id === selectedId) ?? null,
    [sortedDevices, selectedId],
  );

  const deviceLabel = useMemo(() => {
    if (selectedDevice) {
      return selectedDevice.class_section
        ? `${selectedDevice.class_section} — ${selectedDevice.name}`
        : selectedDevice.name;
    }
    return customClass.trim() || 'Tahta';
  }, [selectedDevice, customClass]);

  const fetchSchool = useCallback(async (code: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(getApiUrl(`/tv/classroom-setup/info?setup_code=${encodeURIComponent(code)}`));
      const body = (await res.json().catch(() => ({}))) as {
        school_id?: string;
        school_name?: string;
        devices?: SetupDevice[];
        suggested_classes?: string[];
        message?: string;
        code?: string;
      };
      if (!res.ok) throw new Error(classroomSetupErrorMessage(body.code, body.message));
      setSetupCode(code);
      setSchoolId(body.school_id ?? '');
      setSchoolName(body.school_name ?? '');
      setDevices(body.devices ?? []);
      setSuggested(body.suggested_classes ?? []);
      setStep('board');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bağlantı hatası');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (prefillCode && !setupCode) {
      void fetchSchool(prefillCode);
    }
  }, [prefillCode, setupCode, fetchSchool]);

  const registerDevice = async (): Promise<string> => {
    const res = await fetch(getApiUrl('/tv/classroom-setup/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup_code: setupCode,
        device_id: selectedId || undefined,
        class_section: selectedId ? undefined : customClass.trim(),
        pairing_code: selectedId ? pairingCode.trim() : undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      device_id?: string;
      school_id?: string;
      message?: string;
      code?: string;
    };
    if (!res.ok || !body.device_id) {
      throw new Error(classroomSetupErrorMessage(body.code, body.message));
    }
    return body.device_id;
  };

  const handleLinkContinue = () => {
    const parsed = parseClassroomSetupLink(linkInput);
    if (!parsed) {
      setErr('Geçerli kurulum linki veya okul kodu girin (ör. ABC123 veya panel linki).');
      return;
    }
    void fetchSchool(parsed.setupCode);
  };

  const handleBoardContinue = async () => {
    if (!selectedId && !customClass.trim()) {
      setErr('Listeden tahta seçin veya yeni sınıf adı yazın.');
      return;
    }
    if (selectedId && pairingCode.trim().length < 6) {
      setErr('Kayıtlı tahta için etiketteki eşleştirme kodunu girin.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const deviceId = await registerDevice();
      setRegisteredDeviceId(deviceId);
      setStep('download');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kayıt hatası');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    const deviceId = registeredDeviceId || selectedId;
    if (!schoolId || !deviceId) return;
    setBusy(true);
    setErr(null);
    try {
      await downloadPardusKurulumZip({
        panelOrigin: origin,
        apiBaseUrl: resolveDefaultApiBase(),
        schoolId,
        deviceId,
        deviceLabel,
        setupCode,
      });
      setDownloaded(true);
      toast.success('Kurulum ZIP indirildi');
      setStep('install');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Paket oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const tvUrl =
    schoolId && (registeredDeviceId || selectedId)
      ? buildClassroomTvUrl({
          origin,
          schoolId,
          deviceId: registeredDeviceId || selectedId,
        })
      : '';

  const copy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${label} kopyalandı`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <img
            src="/landing/uza-logo.png"
            alt="Uzaedu Öğretmen"
            width={160}
            height={160}
            className="mx-auto mb-3 h-16 w-auto object-contain sm:h-20"
          />
          <p className="text-xs font-semibold tracking-wide text-slate-400">
            <span className="text-slate-200">Uzaedu</span>{' '}
            <span className="bg-linear-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent">Öğretmen</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Pardus tahta kurulumu</h1>
          <p className="mt-2 text-sm text-slate-400">
            Okul panelindeki link ile tahtayı seçin, kurulum paketini indirin, tek komutla kurun.
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">{SMART_BOARD_QR_FLOW_SUMMARY}</p>
        </header>

        <nav className="mb-8 flex justify-between gap-1" aria-label="Adımlar">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div
                key={s.id}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors',
                  active && 'bg-teal-500/15 ring-1 ring-teal-500/40',
                  done && !active && 'opacity-70',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-bold',
                    done ? 'bg-teal-600 text-white' : active ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-500',
                  )}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="hidden text-[10px] font-medium leading-tight sm:block">{s.title}</span>
              </div>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
          {err ? (
            <p className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-center text-sm text-red-300">{err}</p>
          ) : null}

          {step === 'link' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Okul yöneticisinin <strong className="text-white">Akıllı Tahta → Kurulum</strong> sekmesindeki{' '}
                <em>ilk kurulum linkini</em> yapıştırın veya kurulum kodunu yazın.
              </p>
              <input
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="https://…/tv/classroom?setup=1&school_code=… veya ABC123"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkContinue()}
              />
              <button
                type="button"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold hover:bg-teal-500 disabled:opacity-50"
                onClick={handleLinkContinue}
              >
                {busy ? <LoadingSpinner className="size-4" /> : <ArrowRight className="size-4" />}
                Devam et
              </button>
            </div>
          )}

          {step === 'board' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
                <School className="size-4 shrink-0 text-teal-400" />
                <span>
                  <strong className="text-white">{schoolName}</strong>
                  <span className="ml-2 font-mono text-xs text-teal-300">{setupCode}</span>
                </span>
              </div>

              {sortedDevices.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">Panelde kayıtlı tahtalar (ada göre)</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-700 p-2">
                    {sortedDevices.map((d) => (
                      <label
                        key={d.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-800',
                          selectedId === d.id && 'bg-teal-500/15 ring-1 ring-teal-500/50',
                        )}
                      >
                        <input
                          type="radio"
                          name="device"
                          className="size-4 accent-teal-500"
                          checked={selectedId === d.id}
                          onChange={() => {
                            setSelectedId(d.id);
                            setCustomClass('');
                            setPairingCode('');
                          }}
                        />
                        <span className="text-sm">
                          <span className="font-semibold text-white">{d.name}</span>
                          {d.class_section ? (
                            <span className="text-slate-400"> · {d.class_section}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Henüz kayıtlı tahta yok; aşağıdan sınıf ekleyin.</p>
              )}

              {selectedId ? (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
                  <p className="text-xs font-medium text-amber-200">Eşleştirme kodu (güvenlik)</p>
                  <p className="text-[11px] text-slate-400">
                    Panelde yazdırılan tahta etiketindeki 8 karakterli kodu girin. Başka okulun kodu ile bu tahta
                    kurulamaz.
                  </p>
                  <input
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm tracking-widest uppercase"
                    placeholder="Örn. A1B2C3D4"
                    maxLength={12}
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  />
                </div>
              ) : null}

              <div className="space-y-2 border-t border-slate-700 pt-4">
                <p className="text-xs font-medium text-slate-300">Tahtanız listede yoksa</p>
                {suggested.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suggested.slice(0, 10).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs',
                          customClass === c
                            ? 'border-teal-500 bg-teal-500/20 text-teal-100'
                            : 'border-slate-600 hover:bg-slate-800',
                        )}
                        onClick={() => {
                          setCustomClass(c);
                          setSelectedId('');
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Sınıf adı (örn. 10-A)"
                  value={customClass}
                  onChange={(e) => {
                    setCustomClass(e.target.value);
                    setSelectedId('');
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-600 py-3 text-sm"
                  onClick={() => setStep('link')}
                >
                  <ArrowLeft className="size-4" /> Geri
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold disabled:opacity-50"
                  onClick={() => void handleBoardContinue()}
                >
                  {busy ? <LoadingSpinner className="size-4" /> : <ArrowRight className="size-4" />}
                  Tahtayı onayla
                </button>
              </div>
            </div>
          )}

          {step === 'download' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                <strong className="text-white">{deviceLabel}</strong> için Pardus kurulum paketi hazırlanacak
                (`.deb` + otomatik kurulum betiği).
              </p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-teal-500" />
                  Chromium kiosk ve duyuru ekranı adresi pakete gömülür
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-teal-500" />
                  Okul ve tahta kimliği önceden tanımlıdır
                </li>
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-600 py-3 text-sm"
                  onClick={() => setStep('board')}
                >
                  <ArrowLeft className="size-4" /> Geri
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold disabled:opacity-50"
                  onClick={() => void handleDownload()}
                >
                  {busy ? <LoadingSpinner className="size-4" /> : <Download className="size-4" />}
                  Kurulum ZIP indir
                </button>
              </div>
            </div>
          )}

          {step === 'install' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                İndirilen ZIP’i tahtaya kopyalayın, arşivden çıkarın ve terminalde şu komutları çalıştırın:
              </p>
              <div className="space-y-2 rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300">
                <p>cd ~/İndirilenler/ogretmenpro-pardus-kurulum_*</p>
                <p>chmod +x kur-pardus.sh</p>
                <p className="text-teal-300">./kur-pardus.sh</p>
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 py-2.5 text-sm"
                onClick={() =>
                  copy(
                    'cd ~/İndirilenler && unzip ogretmenpro-pardus-kurulum_*.zip && cd ogretmenpro-pardus-kurulum_* && chmod +x kur-pardus.sh && ./kur-pardus.sh',
                    'Komutlar',
                  )
                }
              >
                <Copy className="size-4" /> Komutları kopyala
              </button>
              {!downloaded ? (
                <button
                  type="button"
                  className="w-full text-center text-xs text-teal-400 underline"
                  onClick={() => void handleDownload()}
                >
                  ZIP tekrar indir
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold"
                onClick={() => setStep('done')}
              >
                Kurulumu yaptım, devam <ArrowRight className="size-4" />
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <Check className="mx-auto size-12 text-teal-400" />
              <p className="text-sm text-slate-300">
                Kurulum sonrası tahta her açılışta <strong className="text-white">duyuru ekranını</strong> açar. Ders için
                öğretmen <strong className="text-white">telefonda Uzaedu’ya girişli</strong> iken tahtadaki QR’ı okutur; tahta
                birkaç saniye içinde kullanım moduna geçer — <strong className="text-white">tahtaya şifre gerekmez</strong>.
              </p>
              {tvUrl ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold"
                    onClick={() => window.open(tvUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Duyuru ekranını test et
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm"
                    onClick={() => router.replace(tvUrl)}
                  >
                    Bu sayfada aç
                  </button>
                </div>
              ) : null}
              <p className="text-[11px] text-slate-500">
                Sorun olursa okul IT: {buildPardusKurulumPageUrl(origin, setupCode)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
