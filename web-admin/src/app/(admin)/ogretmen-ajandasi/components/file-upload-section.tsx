'use client';

import { useRef } from 'react';
import { Paperclip, X, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PendingFile = {
  file: File;
  url?: string;
  fileType?: string;
  fileName?: string;
  uploading?: boolean;
  error?: string;
};

export function FileUploadSection({
  files,
  onFilesChange,
  onUpload,
  disabled,
  maxFiles = 5,
}: {
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  onUpload: (file: File) => Promise<{ publicUrl: string; fileType?: string; fileName?: string }>;
  disabled?: boolean;
  maxFiles?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length + selected.length > maxFiles) selected.splice(maxFiles - files.length);
    const newFiles: PendingFile[] = selected.map((f) => ({ file: f, uploading: true }));
    onFilesChange([...files, ...newFiles]);
    for (let i = 0; i < newFiles.length; i++) {
      try {
        const res = await onUpload(newFiles[i].file);
        newFiles[i] = { ...newFiles[i], url: res.publicUrl, fileType: res.fileType, fileName: res.fileName, uploading: false };
      } catch {
        newFiles[i] = { ...newFiles[i], error: 'Yüklenemedi', uploading: false };
      }
      onFilesChange([...files, ...newFiles]);
    }
  };

  const remove = (idx: number) => onFilesChange(files.filter((_, i) => i !== idx));
  const isImage = (f: File) => f.type.startsWith('image/');

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        multiple
        onChange={handleSelect}
        disabled={disabled || files.length >= maxFiles}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= maxFiles}
        className="h-8 w-full justify-center rounded-lg border-dashed px-2 text-xs sm:h-9 sm:w-auto sm:rounded-xl sm:px-3 sm:text-sm"
      >
        <Paperclip className="mr-1 size-3.5 shrink-0 sm:mr-1.5 sm:size-4" />
        Dosya ({files.length}/{maxFiles})
      </Button>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {files.map((pf, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1.5 text-xs sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm',
                pf.error && 'border-destructive/50 bg-destructive/5',
              )}
            >
              {isImage(pf.file) ? <Image className="size-4 shrink-0 text-primary" /> : <FileText className="size-4 shrink-0 text-primary" />}
              <span className="truncate max-w-[140px]">{pf.file.name}</span>
              {pf.uploading && <span className="text-xs text-muted-foreground animate-pulse">Yükleniyor</span>}
              {pf.error && <span className="text-xs text-destructive">{pf.error}</span>}
              <button type="button" onClick={() => remove(idx)} disabled={pf.uploading} className="ml-1 p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
