'use client';

import { useMemo, useRef, useState } from 'react';
import { CloudDownload, CloudUpload, Download, FileUp, RefreshCw } from 'lucide-react';
import { apiFetch, type ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { SCHOOL_MODULE_KEYS, SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import {
  downloadDriveFileAsTextReliable,
  getDriveAccessToken,
  isGoogleDriveBackupConfigured,
  listOgretmenProBackups,
  uploadJsonToDrive,
  type DriveBackupFile,
} from '@/lib/google-drive-backup';

const ACCOUNT_KEY = 'account' as const;

const ALL_KEYS = [ACCOUNT_KEY, ...SCHOOL_MODULE_KEYS] as const;

/** Sunucu `POST /me/data-import` ile geri yüklenebilen modüller (diğerleri yedekte yer alır; içe aktarım henüz yok). */
const SERVER_IMPORT_KEYS = new Set<string>([ACCOUNT_KEY, 'teacher_agenda']);

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Bir hata oluştu';
}

function backupFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `ogretmenpro-yedek-${stamp}.json`;
}

function formatBytes(n: string | undefined): string {
  if (n == null || n === '') return '—';
  const b = Number(n);
  if (!Number.isFinite(b)) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerJsonDownload(data: Record<string, unknown>, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function defaultSelection(enabled: string[] | null | undefined): Set<string> {
  const s = new Set<string>([ACCOUNT_KEY]);
  if (enabled?.length) {
    for (const k of enabled) {
      if (SCHOOL_MODULE_KEYS.includes(k as SchoolModuleKey)) s.add(k);
    }
  } else {
    ALL_KEYS.forEach((k) => s.add(k));
  }
  return s;
}

type Props = {
  token: string | null;
  /** Okulda açık modüller — yoksa tümü seçili başlar */
  enabledModules?: string[] | null;
};

export function BackupExportPanel({ token, enabledModules }: Props) {
  const { refetchMe } = useAuth();
  const [selected, setSelected] = useState(() => defaultSelection(enabledModules));
  const [loading, setLoading] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveListing, setDriveListing] = useState(false);
  const [driveDialogOpen, setDriveDialogOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<Record<string, unknown> | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const driveConfigured = isGoogleDriveBackupConfigured();

  const labels = useMemo(
    () =>
      Object.fromEntries([
        [ACCOUNT_KEY, 'Hesap ve profil'],
        ...SCHOOL_MODULE_KEYS.map((k) => [k, SCHOOL_MODULE_LABELS[k]] as const),
      ]),
    [],
  );

  const importPreview = useMemo(() => {
    if (!parsedBackup) return null;
    const ev = parsedBackup.export_version;
    const ta = parsedBackup.teacher_agenda as Record<string, unknown> | undefined;
    const agendaUnavailable = !!(ta && typeof ta === 'object' && ta.unavailable === true);
    const hasAccountBlock =
      parsedBackup.export_version === 2
        ? parsedBackup.account != null && typeof parsedBackup.account === 'object'
        : typeof parsedBackup.id === 'string';
    return {
      exportVersion: typeof ev === 'number' ? ev : null,
      agendaUnavailable,
      hasAccountBlock,
    };
  }, [parsedBackup]);

  const selectedServerImportLabels = useMemo(() => {
    return ALL_KEYS.filter((k) => selected.has(k) && SERVER_IMPORT_KEYS.has(k)).map((k) => labels[k] ?? k);
  }, [selected, labels]);

  const selectedNonImportable = useMemo(() => {
    return ALL_KEYS.filter((k) => selected.has(k) && !SERVER_IMPORT_KEYS.has(k)).map((k) => labels[k] ?? k);
  }, [selected, labels]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (key === ACCOUNT_KEY) return next;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(ALL_KEYS));
  const selectNone = () => setSelected(new Set([ACCOUNT_KEY]));

  const fetchBackupPayload = async (): Promise<{ data: Record<string, unknown>; filename: string }> => {
    if (!token) throw new Error('Oturum bulunamadı. Sayfayı yenileyip tekrar giriş yapın.');
    const mods = ALL_KEYS.filter((k) => selected.has(k));
    if (mods.length === 0) throw new Error('En az bir modül seçmelisiniz (hesap her zaman dahildir).');
    const qs = new URLSearchParams();
    qs.set('modules', mods.join(','));
    const data = await apiFetch<Record<string, unknown>>(`/me/data-export?${qs.toString()}`, {
      method: 'GET',
      token,
    });
    return { data, filename: backupFilename() };
  };

  const download = async () => {
    if (!token) {
      toast.error('Oturum bulunamadı', {
        description: 'Sayfayı yenileyip tekrar giriş yapın.',
      });
      return;
    }
    setLoading(true);
    try {
      const { data, filename } = await fetchBackupPayload();
      triggerJsonDownload(data, filename);
      toast.success('Yedek bilgisayarınıza indirildi', {
        description: `Dosya adı: ${filename}. İndirme klasörünüzde veya tarayıcı indirme geçmişinde görünür.`,
      });
    } catch (e) {
      const err = e as ApiError;
      toast.error(err?.message ? String(err.message) : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const loadDriveList = async (showToastEmpty?: boolean) => {
    const accessToken = await getDriveAccessToken();
    const files = await listOgretmenProBackups(accessToken);
    setDriveFiles(files);
    if (showToastEmpty && files.length === 0) {
      toast.message('Uygun yedek bulunamadı', {
        description:
          'Arama: adında “ogretmenpro-yedek” geçen .json dosyaları. Önce “Drive’a yükle” ile yedek oluşturun veya dosya adını kontrol edin.',
      });
    }
  };

  const uploadToGoogleDrive = async () => {
    if (!token) {
      toast.error('Oturum bulunamadı', { description: 'Sayfayı yenileyip tekrar giriş yapın.' });
      return;
    }
    if (!driveConfigured) {
      toast.error('Google Drive henüz etkin değil', {
        description:
          'Bu özellik sunucu tarafında yapılandırılmalıdır. Şimdilik “Seçilenleri indir (yerel)” ile yedek alabilirsiniz.',
      });
      return;
    }
    setDriveUploading(true);
    try {
      const { data, filename } = await fetchBackupPayload();
      const accessToken = await getDriveAccessToken();
      await uploadJsonToDrive(accessToken, filename, JSON.stringify(data, null, 2));
      toast.success('Yedek Google Drive’a kaydedildi', {
        description: `Dosya: ${filename}. Kendi Drive’ınızda, bu uygulama ile oluşturulan dosyalar arasında görünür.`,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDriveUploading(false);
    }
  };

  const openDriveList = async () => {
    if (!driveConfigured) {
      toast.error('Google Drive henüz etkin değil', {
        description: 'Yönetici yapılandırması gerekir. Yerel indirme kullanabilirsiniz.',
      });
      return;
    }
    setDriveListing(true);
    try {
      await loadDriveList(true);
      setDriveDialogOpen(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDriveListing(false);
    }
  };

  const refreshDriveList = async () => {
    setDriveListing(true);
    try {
      await loadDriveList(false);
      toast.success('Liste yenilendi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDriveListing(false);
    }
  };

  const downloadFromDrive = async (f: DriveBackupFile) => {
    setDownloadingId(f.id);
    try {
      const text = await downloadDriveFileAsTextReliable(f.id);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const name = f.name.endsWith('.json') ? f.name : `${f.name}.json`;
      triggerJsonDownload(parsed, name);
      toast.success('Yedek bilgisayarınıza indirildi', {
        description: `Dosya: ${name}. İndirme klasörünüzde veya tarayıcı indirme geçmişinde kontrol edin.`,
      });
      setDriveDialogOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const onLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as Record<string, unknown>;
        setParsedBackup(parsed);
        setImportDialogOpen(true);
      } catch {
        toast.error('Dosya okunamadı', {
          description: 'Geçerli bir .json yedek dosyası seçin (ÖğretmenPro dışa aktarma çıktısı).',
        });
      }
    };
    reader.readAsText(file);
  };

  const runServerImport = async () => {
    if (!token || !parsedBackup) {
      toast.error('Oturum veya dosya yok');
      return;
    }
    const mods = ALL_KEYS.filter((k) => selected.has(k));
    if (mods.length === 0) {
      toast.error('En az bir modül seçin');
      return;
    }
    setImportLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('modules', mods.join(','));
      const res = await apiFetch<{ imported: string[] }>(`/me/data-import?${qs.toString()}`, {
        method: 'POST',
        body: JSON.stringify(parsedBackup),
        token,
      });
      const list = res.imported?.join(', ') ?? '';
      toast.success('Sunucu güncellendi', { description: list ? `İçe aktarılan: ${list}` : undefined });
      await refetchMe();
      setImportDialogOpen(false);
      setParsedBackup(null);
    } catch (err) {
      const e = err as ApiError;
      toast.error(e?.message ? String(e.message) : errorMessage(err));
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="info" className="text-sm leading-relaxed [&_div]:text-foreground/90">
        <p>
          <strong className="font-semibold text-foreground">Modül seçimi</strong> hem yerel indirme hem Drive yüklemesi hem de
          sunucuya geri yükleme için kullanılır. Dışa aktarımda henüz veri üretilmeyen modüller dosyada{' '}
          <span className="font-medium">unavailable</span> olarak işaretlenir.
        </p>
        <p className="mt-2 border-t border-border/50 pt-2">
          <strong className="font-semibold text-foreground">Sunucuya içe aktarma:</strong> Şu an yalnızca{' '}
          <span className="font-medium">Hesap ve profil</span> ile <span className="font-medium">Öğretmen Ajandası</span>{' '}
          sunucuda güncellenir. Diğer modüller seçili olsa bile yedekte veri yoksa veya içe aktarım henüz yoksa bu adım
          etkilenmez veya işlem reddedilebilir.
        </p>
        <p className="mt-2 border-t border-border/50 pt-2 text-muted-foreground">
          <strong className="font-semibold text-foreground">KVKK:</strong> Yedek dosyası kişisel veri içerir. Yerel
          saklama ve Google Drive kullanımında veri güvenliği ve sağlayıcı koşulları size aittir.
        </p>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={selectAll}>
          Tümünü seç
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={selectNone}>
          Yalnızca hesap
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {ALL_KEYS.map((key) => {
          const disabled = key === ACCOUNT_KEY;
          const checked = selected.has(key);
          return (
            <li key={key}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm ${
                  disabled ? 'opacity-80' : 'hover:bg-muted/40'
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(key)}
                />
                <span>{labels[key] ?? key}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <p className="text-xs font-medium text-foreground">Bilgisayara indir</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Dosya tarayıcınızın indirme klasörüne kaydedilir. İsterseniz aynı dosyayı aşağıdan sunucuya da uygulayabilirsiniz.
        </p>
        <Button
          type="button"
          disabled={!token || loading}
          onClick={download}
          className="gap-2 rounded-lg w-fit"
          aria-busy={loading}
        >
          <Download className="size-4 shrink-0" aria-hidden />
          {loading ? 'İndiriliyor…' : 'Seçilenleri indir (yerel)'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <p className="text-xs font-medium text-foreground">Google Drive</p>
        {driveConfigured ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            İlk seferde Google hesabı ve Drive izni istenir. Listede yalnızca bu uygulama ile yüklenen veya adında
            “ogretmenpro-yedek” geçen .json dosyaları görünür; başka kullanıcıların dosyalarına erişilmez. Drive’dan indirdiğiniz
            dosyayı sunucuya uygulamak için sayfadaki “.json seç” adımını kullanın.
          </p>
        ) : (
          <Alert variant="warning" className="text-xs leading-relaxed [&_div]:text-foreground/90">
            <p>
              Google Drive yedekleme bu ortamda kapalı. Açılması için yönetici{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID</code> ve Google
              Cloud’da Drive API ayarlarını yapmalıdır. Şimdilik yalnızca yerel indirme kullanılabilir.
            </p>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 rounded-lg"
            disabled={!token || driveUploading || !driveConfigured}
            onClick={uploadToGoogleDrive}
          >
            <CloudUpload className="size-4 shrink-0" aria-hidden />
            {driveUploading ? 'Yükleniyor…' : 'Drive’a yükle'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-lg"
            disabled={driveListing || !driveConfigured}
            onClick={openDriveList}
          >
            <CloudDownload className="size-4 shrink-0" aria-hidden />
            {driveListing ? 'Açılıyor…' : 'Drive’dan indir (listele)'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <p className="text-xs font-medium text-foreground">Elinizdeki yedek dosyası</p>
        <Alert variant="warning" className="text-xs leading-relaxed [&_div]:text-foreground/90">
          <p>
            <strong className="font-semibold text-foreground">Geri yükleme riski:</strong> Sunucuya uygulama, yalnızca sizin
            hesabınıza ait yedeklerle çalışır; başka kullanıcının dosyası reddedilir. <strong className="font-semibold">Öğretmen
            Ajandası</strong> seçiliyken mevcut ajanda verileri silinir ve yedekteki kayıtlarla değiştirilir (geri alınamaz
            sayılır; önce yeni bir yedek alın).
          </p>
          <p className="mt-2 border-t border-border/50 pt-2">
            Diğer modül kutuları dışa aktarım için seçilebilir; sunucuya yazılanlar şu an{' '}
            <span className="font-medium">hesap</span> ve <span className="font-medium">öğretmen ajandası</span> ile
            sınırlıdır.
          </p>
        </Alert>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={onLocalFile} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-lg w-fit"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="size-4 shrink-0" aria-hidden />
          Yedek .json seç ve sunucuya uygula
        </Button>
      </div>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) setParsedBackup(null);
        }}
      >
        <DialogContent title="Yedeği sunucuya uygula">
          <Alert variant="warning" className="text-xs leading-relaxed [&_div]:text-foreground/90">
            <p>
              Onayladığınızda seçimdeki, sunucuda desteklenen modüller veritabanına yazılır. Öğretmen Ajandası bu seçimdeyse
              mevcut ajanda içeriği önce temizlenir; yedekte ajanda yoksa veya <span className="font-medium">unavailable</span>{' '}
              ise işlem tamamlanmayabilir.
            </p>
          </Alert>
          {importPreview && (
            <ul className="text-xs text-muted-foreground space-y-1 rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
              {importPreview.exportVersion != null && (
                <li>
                  Yedek biçimi: <span className="font-medium text-foreground">export_version {importPreview.exportVersion}</span>
                </li>
              )}
              {importPreview.agendaUnavailable && selected.has('teacher_agenda') && (
                <li className="text-amber-800 dark:text-amber-200">
                  Bu dosyada Öğretmen Ajandası verisi yok veya dışa aktarımda kullanılamıyor; ajanda içe aktarılmayabilir.
                </li>
              )}
              {!importPreview.hasAccountBlock && selected.has(ACCOUNT_KEY) && (
                <li className="text-amber-800 dark:text-amber-200">
                  Dosyada tanınan hesap bilgisi bulunamadı; hesap güncellemesi atlanabilir.
                </li>
              )}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            İstekte gönderilen modüller:{' '}
            <span className="font-medium text-foreground">
              {ALL_KEYS.filter((k) => selected.has(k))
                .map((k) => labels[k] ?? k)
                .join(', ')}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Sunucuda güncellenebilecekler (yedekte veri varsa):{' '}
            <span className="font-medium text-foreground">
              {selectedServerImportLabels.length ? selectedServerImportLabels.join(', ') : '—'}
            </span>
          </p>
          {selectedNonImportable.length > 0 && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Şu an yalnızca dışa aktarım / dosya bütünlüğü için seçili: {selectedNonImportable.join(', ')}. Bunlar sunucuda
              henüz içe aktarılmaz.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => setImportDialogOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={!token || importLoading || !parsedBackup}
              onClick={() => void runServerImport()}
            >
              {importLoading ? 'Uygulanıyor…' : 'Onayla ve uygula'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={driveDialogOpen} onOpenChange={setDriveDialogOpen}>
        <DialogContent title="Google Drive’daki yedekler">
          <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
            Bu listede bu sayfadan yüklenen veya adında “ogretmenpro-yedek” geçen .json dosyaları görünür. İndir: dosya
            bilgisayarınıza iner; sunucuya uygulamak için listeden sonra “Yedek .json seç ve sunucuya uygula”yı kullanın.
          </p>
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              disabled={driveListing}
              onClick={() => void refreshDriveList()}
            >
              <RefreshCw className={`size-3.5 ${driveListing ? 'animate-spin' : ''}`} aria-hidden />
              Yenile
            </Button>
          </div>
          {driveFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Liste boş. “Drive’a yükle” ile yedek oluşturun veya Drive’da dosya adının “ogretmenpro-yedek” içerdiğinden emin
              olun.
            </p>
          ) : (
            <ul className="space-y-2">
              {driveFiles.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('tr-TR') : '—'}
                      <span className="mx-1.5">·</span>
                      {formatBytes(f.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 rounded-lg"
                    disabled={downloadingId !== null}
                    onClick={() => downloadFromDrive(f)}
                  >
                    {downloadingId === f.id ? '…' : 'İndir'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
