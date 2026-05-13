'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Settings = {
  id: string;
  fiscal_year: number;
  default_daily_tl: string;
  derece_rates_json: Record<string, number> | null;
  derece_daily_tl: Record<string, string>;
  ek_gosterge_rates_json?: Record<string, number> | null;
  ek_gosterge_daily_tl?: Record<string, string>;
  denetim_mission_day_cap?: number;
  km_daily_fraction: string;
  memur_fixed_multiplier: number;
  aile_per_multiplier: number;
  aile_fixed_cap_multiplier: number;
  rules_version: string;
};

const EK_JSON_HINT = `H cetveli (örnek 2026):\n{\n  "g8000_ust": 890,\n  "g6400_8000": 880,\n  "g3600_6400": 870,\n  "alt3600": 850\n}`;

export default function YollukAyarlarPage() {
  const router = useRouter();
  const { me } = useAuth();
  const [row, setRow] = useState<Settings | null>(null);
  const [dereceJson, setDereceJson] = useState('{}');
  const [ekJson, setEkJson] = useState('{}');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const can = me?.role === 'superadmin';

  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    (async () => {
      try {
        const s = await apiFetch<Settings>('/yolluk/settings/active');
        setRow(s);
        setDereceJson(JSON.stringify(s.derece_rates_json ?? {}, null, 2));
        setEkJson(JSON.stringify(s.ek_gosterge_rates_json ?? {}, null, 2));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [can, router]);

  if (!can) return null;

  async function save() {
    if (!row) return;
    setSaving(true);
    setErr(null);
    setOk(false);
    const dd = parseFloat(String(row.default_daily_tl).replace(',', '.'));
    const kf = parseFloat(String(row.km_daily_fraction).replace(',', '.'));
    if (!Number.isFinite(dd) || dd < 0 || !Number.isFinite(kf) || kf < 0 || kf > 1) {
      setErr('Yedek gündelik veya km oranı geçersiz (km 0–1 arası).');
      setSaving(false);
      return;
    }
    let parsedD: Record<string, number> | null = null;
    let parsedEk: Record<string, number> | null = null;
    try {
      const o = JSON.parse(dereceJson.trim() || '{}') as unknown;
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        parsedD = {};
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          if (Number.isFinite(n)) parsedD[k] = n;
        }
      } else throw new Error('Nesne bekleniyor');
    } catch {
      setErr('Derece JSON geçersiz.');
      setSaving(false);
      return;
    }
    try {
      const o = JSON.parse(ekJson.trim() || '{}') as unknown;
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        parsedEk = {};
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          if (Number.isFinite(n)) parsedEk[k] = n;
        }
      } else throw new Error('Nesne bekleniyor');
    } catch {
      setErr('Ek gösterge JSON geçersiz.');
      setSaving(false);
      return;
    }
    try {
      const body = {
        fiscal_year: row.fiscal_year,
        default_daily_tl: dd,
        km_daily_fraction: kf,
        memur_fixed_multiplier: row.memur_fixed_multiplier,
        aile_per_multiplier: row.aile_per_multiplier,
        aile_fixed_cap_multiplier: row.aile_fixed_cap_multiplier,
        rules_version: row.rules_version,
        derece_rates_json: parsedD && Object.keys(parsedD).length ? parsedD : null,
        ek_gosterge_rates_json: parsedEk && Object.keys(parsedEk).length ? parsedEk : null,
        denetim_mission_day_cap: row.denetim_mission_day_cap ?? 30,
      };
      const out = await apiFetch<Settings>('/yolluk/settings', { method: 'PUT', body: JSON.stringify(body) });
      setRow(out);
      setDereceJson(JSON.stringify(out.derece_rates_json ?? {}, null, 2));
      setEkJson(JSON.stringify(out.ek_gosterge_rates_json ?? {}, null, 2));
      setOk(true);
      window.setTimeout(() => setOk(false), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Yolluk parametreleri</h1>
      <p className="text-muted-foreground text-sm">
        6245 özeti — kadro derecesi, ek gösterge bantları ve yer değiştirme çarpanları. Geçici görev / bildirim PDF’lerindeki «iç gündelik» (H
        cetveli) bu derece ve ek gösterge tutarlarından türetilir; mali yıl bazlıdır.
      </p>
      {err && <p className="text-destructive text-sm">{err}</p>}
      {ok && <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Kayıt sunucuya yazıldı.</p>}
      {!row && !err && <p className="text-muted-foreground text-sm">Yükleniyor…</p>}
      {row && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mali yıl {row.fiscal_year}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Mali yıl</Label>
              <Input
                type="number"
                value={row.fiscal_year}
                onChange={(e) => setRow({ ...row, fiscal_year: parseInt(e.target.value, 10) || row.fiscal_year })}
              />
            </div>
            <div>
              <Label>Yedek gündelik — derece / ek gösterge yoksa (TL)</Label>
              <Input value={row.default_daily_tl} onChange={(e) => setRow({ ...row, default_daily_tl: e.target.value })} />
            </div>
            <div>
              <Label>Ek gösterge bantları (JSON)</Label>
              <p className="text-muted-foreground mb-1 text-xs">Anahtarlar: g8000_ust, g6400_8000, g3600_6400, alt3600</p>
              <textarea
                className="border-input bg-background min-h-[120px] w-full rounded-md border p-2 font-mono text-xs"
                placeholder={EK_JSON_HINT}
                value={ekJson}
                onChange={(e) => setEkJson(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Birleşik ek gösterge (önizleme):{' '}
              {Object.entries(row.ek_gosterge_daily_tl || {})
                .map(([k, v]) => `${k}:${v}`)
                .join(' · ') || '—'}
            </div>
            <div>
              <Label>Kadro 1–15 gündelik override (JSON, boş {'{}'} = kod varsayılanı)</Label>
              <textarea
                className="border-input bg-background min-h-[140px] w-full rounded-md border p-2 font-mono text-xs"
                value={dereceJson}
                onChange={(e) => setDereceJson(e.target.value)}
              />
            </div>
            <div className="text-muted-foreground text-xs">
              Birleşik derece (önizleme):{' '}
              {Object.entries(row.derece_daily_tl || {})
                .slice(0, 15)
                .map(([k, v]) => `${k}:${v}`)
                .join(' · ')}
            </div>
            <div>
              <Label>Km oranı (gündeliğin katı, örn. 0,05)</Label>
              <Input value={row.km_daily_fraction} onChange={(e) => setRow({ ...row, km_daily_fraction: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Memur ×</Label>
                <Input
                  type="number"
                  value={row.memur_fixed_multiplier}
                  onChange={(e) => setRow({ ...row, memur_fixed_multiplier: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <Label>Aile/kişi ×</Label>
                <Input
                  type="number"
                  value={row.aile_per_multiplier}
                  onChange={(e) => setRow({ ...row, aile_per_multiplier: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <Label>Aile tavan ×</Label>
                <Input
                  type="number"
                  value={row.aile_fixed_cap_multiplier}
                  onChange={(e) => setRow({ ...row, aile_fixed_cap_multiplier: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Kural sürümü</Label>
              <Input value={row.rules_version} onChange={(e) => setRow({ ...row, rules_version: e.target.value })} />
            </div>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
