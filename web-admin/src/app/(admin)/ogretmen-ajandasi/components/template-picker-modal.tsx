'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Template = { id: string; title: string; bodyTemplate?: string | null };

export function TemplatePickerModal({
  open,
  onOpenChange,
  templates,
  onSelect,
  onCreateTemplate,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onSelect: (t: Template) => void;
  onCreateTemplate?: (data: { title: string; bodyTemplate?: string }) => Promise<void>;
  loading?: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!createTitle.trim() || !onCreateTemplate) return;
    setCreating(true);
    try {
      await onCreateTemplate({ title: createTitle.trim(), bodyTemplate: createBody.trim() || undefined });
      setShowCreate(false);
      setCreateTitle('');
      setCreateBody('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Şablondan Not Oluştur">
        {showCreate ? (
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label className="text-xs sm:text-sm">Şablon adı *</Label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Toplantı notu…"
                className="mt-1 min-h-10 text-sm sm:min-h-11"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">İçerik (opsiyonel)</Label>
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                rows={3}
                className="mt-1 min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-[100px] sm:py-2.5"
                placeholder="Şablon metni…"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
                İptal
              </Button>
              <Button onClick={handleCreate} disabled={creating || !createTitle.trim()} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
                Kaydet
              </Button>
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <p className="text-xs text-muted-foreground sm:text-sm">Yükleniyor…</p>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground sm:text-sm">Henüz şablon yok.</p>
            ) : (
              <ul className="max-h-[min(45dvh,280px)] space-y-1.5 overflow-y-auto sm:max-h-[300px] sm:space-y-2">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t);
                        onOpenChange(false);
                      }}
                      className="w-full rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-all hover:bg-muted/50 sm:rounded-xl sm:px-4 sm:py-3"
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
              {onCreateTemplate && (
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="h-9 w-full rounded-xl sm:h-10 sm:w-auto">
                  Yeni şablon
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 w-full rounded-xl sm:h-10 sm:w-auto">
                İptal
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
