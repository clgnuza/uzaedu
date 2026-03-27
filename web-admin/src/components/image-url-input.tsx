'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_MAX_SIZE_MB = 5;

type Purpose = 'announcement' | 'school_logo' | 'school_welcome' | 'special_day' | 'admin_message';

export function ImageUrlInput({
  id,
  value,
  onChange,
  placeholder = 'https://...',
  hint,
  token,
  purpose = 'announcement',
  compact,
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  hint?: string;
  token: string | null;
  purpose?: Purpose;
  /** Daha sıkı yerleşim (tablo satırı için) */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [limits, setLimits] = useState<{ max_size_mb: number; allowed_types: string[] } | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ max_size_mb: number; allowed_types: string[] }>('/upload/limits', { token })
      .then(setLimits)
      .catch(() => setLimits(null));
  }, [token]);

  const allowedTypes = limits?.allowed_types?.length ? limits.allowed_types : DEFAULT_ALLOWED_TYPES;
  const maxSizeMb = limits?.max_size_mb ?? DEFAULT_MAX_SIZE_MB;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = '';

    if (!allowedTypes.includes(file.type)) {
      toast.error(`Desteklenmeyen format. İzin verilenler: ${allowedTypes.join(', ')}`);
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Dosya en fazla ${maxSizeMb} MB olabilir`);
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await apiFetch<{ uploadUrl: string; publicUrl: string }>(
        '/upload/presign',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            purpose,
          }),
        },
      );
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      onChange(publicUrl);
      toast.success('Görsel yüklendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  const inputClass = compact
    ? 'min-w-[140px] flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm'
    : 'min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20';
  const btnClass = compact
    ? 'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-input bg-muted/50 px-2 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={compact ? 'flex min-w-0 flex-1 items-center gap-1.5' : 'space-y-2'}>
      <div className={compact ? 'flex min-w-0 flex-1 gap-1.5' : 'flex min-w-0 flex-wrap gap-2'}>
        <input
          ref={inputRef}
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
        />
        <label className={btnClass}>
          <Upload className="size-3.5" />
          {uploading ? '…' : compact ? 'Yükle' : 'Dosya yükle'}
          <input
            type="file"
            accept={allowedTypes.join(',')}
            className="sr-only"
            disabled={uploading || !token}
            onChange={handleFileChange}
          />
        </label>
      </div>
      {!compact && value && (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt="Önizleme"
            className="h-12 w-12 rounded border border-border object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      {!compact && hint && (
        <p className="border-t border-border/50 pt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
