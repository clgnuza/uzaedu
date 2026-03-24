'use client';

import { useRef, useState, useEffect } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Paperclip, X, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export type AttachmentItem = { key: string; filename: string; mime_type?: string; size_bytes?: number };

const FALLBACK_MAX_MB = 5;
const FALLBACK_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachmentInput({
  value,
  onChange,
  token,
  disabled,
}: {
  value: AttachmentItem[];
  onChange: (items: AttachmentItem[]) => void;
  token: string | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [limits, setLimits] = useState<{ max_size_mb: number; allowed_types: string[] } | null>(null);
  const [r2NotConfigured, setR2NotConfigured] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ max_size_mb: number; allowed_types: string[] }>('/upload/limits', { token })
      .then(setLimits)
      .catch(() => setLimits({ max_size_mb: FALLBACK_MAX_MB, allowed_types: FALLBACK_TYPES }));
  }, [token]);

  const maxSizeMb = limits?.max_size_mb ?? FALLBACK_MAX_MB;
  const allowedTypes = limits?.allowed_types ?? FALLBACK_TYPES;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !token) return;
    e.target.value = '';

    setUploading(true);
    setR2NotConfigured(false);
    const added: AttachmentItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`"${file.name}" desteklenmiyor. Görsel (JPEG, PNG, WebP, GIF), PDF veya Word/Excel kullanın.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`"${file.name}" çok büyük. En fazla ${maxSizeMb} MB.`);
        continue;
      }

      try {
        const res = await apiFetch<{ uploadUrl: string; key: string }>('/upload/presign', {
          method: 'POST',
          token,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            purpose: 'ticket_attachment',
          }),
        });
        await fetch(res.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        added.push({ key: res.key, filename: file.name, mime_type: file.type, size_bytes: file.size });
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr?.code === 'R2_NOT_CONFIGURED') {
          setR2NotConfigured(true);
          toast.error('Dosya yükleme yapılandırılmamış. Yönetici Ayarlar → Depolama (R2) bölümünden ayarlayabilir.');
        } else {
          toast.error(apiErr?.message || 'Yükleme başarısız.');
        }
        break;
      }
    }

    if (added.length > 0) {
      onChange([...value, ...added]);
    }
    setUploading(false);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {r2NotConfigured && (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>Dosya ekleme şu an kullanılamıyor. Yöneticiye başvurun.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm font-medium transition-colors',
            'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
            'focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2',
            (disabled || uploading || !token || r2NotConfigured) && 'pointer-events-none opacity-50',
          )}
        >
          <Paperclip className="size-4 text-muted-foreground" />
          {uploading ? 'Yükleniyor…' : 'Dosya ekle veya sürükle'}
          <input
            ref={inputRef}
            type="file"
            accept={allowedTypes.join(',')}
            className="sr-only"
            disabled={disabled || uploading || !token || r2NotConfigured}
            onChange={handleFileChange}
            multiple
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Max {maxSizeMb} MB • Görsel, PDF, Word, Excel
        </span>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((a, idx) => (
            <li
              key={a.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.filename}</span>
                {a.size_bytes != null && (
                  <span className="text-xs text-muted-foreground">{formatSize(a.size_bytes)}</span>
                )}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Dosyayı kaldır"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

