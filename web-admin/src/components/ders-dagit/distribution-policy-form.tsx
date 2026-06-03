'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_DISTRIBUTION_POLICY,
  distributionModeOptions,
  normalizeDistributionMode,
  type DistributionPolicyDto,
} from '@/lib/distribution-policy';

type Props = {
  initial: DistributionPolicyDto | null;
  onSave: (dto: DistributionPolicyDto) => Promise<void>;
};

export function DistributionPolicyForm({ initial, onSave }: Props) {
  const [mode, setMode] = useState<DistributionPolicyDto['mode']>(
    initial ? normalizeDistributionMode(initial.mode) : DEFAULT_DISTRIBUTION_POLICY.mode,
  );
  const [enforcePattern, setEnforcePattern] = useState(initial?.enforce_pattern ?? false);
  const [relaxOnConflict, setRelaxOnConflict] = useState(initial?.relax_on_conflict ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setMode(normalizeDistributionMode(initial.mode));
    setEnforcePattern(initial.enforce_pattern);
    setRelaxOnConflict(initial.relax_on_conflict);
  }, [initial]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ mode, enforce_pattern: enforcePattern, relax_on_conflict: relaxOnConflict });
    } finally {
      setSaving(false);
    }
  };

  const modeOptions = distributionModeOptions();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Haftalık dağıtım modu</Label>
        <Select value={mode} onValueChange={(v) => setMode(normalizeDistributionMode(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modeOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Yeni atamalarda varsayılan gün deseni (2+2, 3+1 …) ve program üretiminde yerleştirme önceliği bu moda göre
          seçilir.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="enforce-pattern">Gün desenini zorunlu tut</Label>
          <p className="text-xs text-muted-foreground">Açıksa atamadaki 2+2+1 vb. skorda ceza üretir.</p>
        </div>
        <Switch id="enforce-pattern" checked={enforcePattern} onCheckedChange={setEnforcePattern} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="relax-conflict">Çözülemeyince esnet</Label>
          <p className="text-xs text-muted-foreground">
            Kapalıyken min gün / desen uyuşmazlığı ihlal listesine yazılır (üretimi durdurmaz).
          </p>
        </div>
        <Switch id="relax-conflict" checked={relaxOnConflict} onCheckedChange={setRelaxOnConflict} />
      </div>
      <Button type="button" onClick={() => void submit()} disabled={saving}>
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </Button>
    </div>
  );
}
