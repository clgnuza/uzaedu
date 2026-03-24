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
          <div className="space-y-4">
            <div>
              <Label>Şablon adı *</Label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="örn: Toplantı notu"
                className="mt-1 min-h-[44px]"
              />
            </div>
            <div>
              <Label>İçerik (opsiyonel)</Label>
              <textarea
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[100px]"
                placeholder="Şablon metni..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !createTitle.trim()}>Kaydet</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz şablon yok.</p>
            ) : (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t);
                        onOpenChange(false);
                      }}
                      className="w-full text-left rounded-xl border px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-all"
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-2">
              {onCreateTemplate && (
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="rounded-xl">
                  Yeni şablon
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl">
                İptal
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
