'use client';

import { useCallback, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PLACEMENT_SEARCH_BUDGETS } from '@/lib/timetable-placement-budget';
import {
  DEFAULT_TIMETABLE_PLACEMENT_SETTINGS,
  loadTimetablePlacementSettings,
  saveTimetablePlacementSettingsLocal,
  type TimetablePlacementSettings,
} from '@/lib/timetable-placement-settings';
import {
  fetchPlacementSearchPolicy,
  patchPlacementSearchPolicy,
} from '@/lib/placement-search-policy';

export function TimetablePlacementSettingsMenu({
  studioId,
  token,
  onChange,
}: {
  studioId?: string | null;
  token?: string | null;
  onChange?: (settings: TimetablePlacementSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_TIMETABLE_PLACEMENT_SETTINGS);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (token && studioId) {
      try {
        const remote = await fetchPlacementSearchPolicy(token, studioId);
        setSettings(remote);
        onChange?.(remote);
        return;
      } catch {
        /* yerel yedek */
      }
    }
    const local = loadTimetablePlacementSettings();
    setSettings(local);
    onChange?.(local);
  }, [token, studioId, onChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const patch = async (next: TimetablePlacementSettings) => {
    setSettings(next);
    saveTimetablePlacementSettingsLocal(next);
    onChange?.(next);
    if (!token || !studioId) return;
    setSaving(true);
    try {
      const saved = await patchPlacementSearchPolicy(token, studioId, next);
      setSettings(saved);
      onChange?.(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="print:hidden" title="Arama ayarları">
          <Settings2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Arama ayarları</DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">
          Program üretimi ve sürükle-bırak yer açma aynı stüdyo ayarını kullanır.
        </p>
        <div className="space-y-4 text-sm">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Karmaşıklık (olasılık)</legend>
            {(
              [
                ['normal', 'Normal', PLACEMENT_SEARCH_BUDGETS.normal],
                ['large', 'Geniş', PLACEMENT_SEARCH_BUDGETS.large],
                ['huge', 'Çok geniş', PLACEMENT_SEARCH_BUDGETS.huge],
              ] as const
            ).map(([id, label, b]) => (
              <label key={id} className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="searchComplexity"
                  className="mt-0.5"
                  disabled={saving}
                  checked={settings.search_complexity === id}
                  onChange={() => void patch({ ...settings, search_complexity: id })}
                />
                <span>
                  {label}
                  <span className="block text-[10px] text-muted-foreground">
                    ~{(b.maxNodes / 1_000_000).toFixed(1).replace('.', ',')}M × {b.restarts} tur (editör)
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Dolu slotta (editör)</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="conflictMode"
                disabled={saving}
                checked={settings.conflict_mode === 'auto_relocate'}
                onChange={() => void patch({ ...settings, conflict_mode: 'auto_relocate' })}
              />
              Önce otomatik yer aç
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="conflictMode"
                disabled={saving}
                checked={settings.conflict_mode === 'ask'}
                onChange={() => void patch({ ...settings, conflict_mode: 'ask' })}
              />
              Hemen çakışma sorusu
            </label>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="allow-ignore-clash" className="text-xs leading-snug">
              Çelişkileri dikkate alma
            </Label>
            <Switch
              id="allow-ignore-clash"
              disabled={saving}
              checked={settings.allow_ignore_clash}
              onCheckedChange={(checked) =>
                void patch({ ...settings, allow_ignore_clash: checked })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
