'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

const DOC_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
];
const DOC_ACCEPT = '.docx,.xlsx,.pdf';

export function DocumentUrlInput({
  id,
  value,
  onChange,
  token,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (urlOrKey: string) => void;
  token: string | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    e.target.value = '';

    if (!DOC_TYPES.includes(file.type)) {
      toast.error('Desteklenmeyen format. Word (.docx), Excel (.xlsx) veya PDF yükleyin.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Dosya en fazla 50 MB olabilir');
      return;
    }

    setUploading(true);
    try {
      const res = await apiFetch<{ uploadUrl: string; publicUrl: string; key: string }>(
        '/upload/presign',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            purpose: 'document_template',
          }),
        },
      );
      const putRes = await fetch(res.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error('Yükleme başarısız');
      onChange(res.key);
      toast.success('Dosya yüklendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="R2 key veya tam URL (örn. document_template/xxx.docx)"
        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        disabled={disabled}
      />
      <label
        className={
          'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        <Upload className="size-4" />
        {uploading ? '…' : 'Yükle'}
        <input
          type="file"
          accept={DOC_ACCEPT}
          className="sr-only"
          disabled={uploading || !token || disabled}
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
