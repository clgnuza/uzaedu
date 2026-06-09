'use client';

import { Plus, Smartphone, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type IapPack = {
  product_id: string;
  amount: number;
  label?: string | null;
  grant_yillik_plan_uretim?: number;
  grant_evrak_uretim?: number;
};

export type IapSide = { jeton: IapPack[]; ekders: IapPack[] };

const IAP_GRANT_MAX = 10_000;

function parseGrantInt(raw: string): number {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(IAP_GRANT_MAX, n);
}

function parseAmount(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  const x = parseFloat(t);
  if (!Number.isFinite(x) || x < 0) return 0;
  return x;
}

function GrantFields({
  grantYillikPlan,
  grantEvrak,
  onGrantYillikPlan,
  onGrantEvrak,
}: {
  grantYillikPlan: number;
  grantEvrak: number;
  onGrantYillikPlan: (v: number) => void;
  onGrantEvrak: (v: number) => void;
}) {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-2.5 sm:grid-cols-2 sm:max-w-[280px]',
      )}
    >
      <p className="col-span-full text-[10px] font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
        + Üretim hakları (satın alınca)
      </p>
      <div className="space-y-1">
        <Label className="text-[11px]">Plan (MEB+Bilsem)</Label>
        <Input
          type="number"
          min={0}
          max={IAP_GRANT_MAX}
          className="h-8 text-sm"
          value={grantYillikPlan}
          onChange={(e) => onGrantYillikPlan(parseGrantInt(e.target.value))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Evrak</Label>
        <Input
          type="number"
          min={0}
          max={IAP_GRANT_MAX}
          className="h-8 text-sm"
          value={grantEvrak}
          onChange={(e) => onGrantEvrak(parseGrantInt(e.target.value))}
        />
      </div>
    </div>
  );
}

export function MarketIapPolicyPanel({
  iapAndroid,
  iapIos,
  onChange,
}: {
  iapAndroid: IapSide;
  iapIos: IapSide;
  onChange: (platform: 'iap_android' | 'iap_ios', side: IapSide) => void;
}) {
  const addPack = (platform: 'iap_android' | 'iap_ios', kind: 'jeton' | 'ekders') => {
    const side = platform === 'iap_android' ? iapAndroid : iapIos;
    onChange(platform, {
      ...side,
      [kind]: [
        ...side[kind],
        { product_id: '', amount: 0, label: '', grant_yillik_plan_uretim: 0, grant_evrak_uretim: 0 },
      ],
    });
  };

  const setPack = (
    platform: 'iap_android' | 'iap_ios',
    kind: 'jeton' | 'ekders',
    index: number,
    patch: Partial<IapPack>,
  ) => {
    const side = platform === 'iap_android' ? iapAndroid : iapIos;
    const list = [...side[kind]];
    list[index] = { ...list[index], ...patch };
    onChange(platform, { ...side, [kind]: list });
  };

  const removePack = (platform: 'iap_android' | 'iap_ios', kind: 'jeton' | 'ekders', index: number) => {
    const side = platform === 'iap_android' ? iapAndroid : iapIos;
    onChange(platform, { ...side, [kind]: side[kind].filter((_, i) => i !== index) });
  };

  return (
    <>
      {(
        [
          ['iap_android', 'Android (Google Play)', iapAndroid],
          ['iap_ios', 'iOS (App Store)', iapIos],
        ] as const
      ).map(([key, title, side]) => (
        <Card key={key} id={key === 'iap_android' ? 'market-policy-iap' : undefined} className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5" />
              {title} — mağaza paketleri
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              <code className="rounded bg-muted px-1">product_id</code> mağazadaki ürün kimliği ile birebir aynı olmalı.
              Mobil uygulama <code className="rounded bg-muted px-1">GET /content/market-policy</code> listesini okur.
            </p>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {(['jeton', 'ekders'] as const).map((kind) => (
              <div key={kind} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{kind === 'jeton' ? 'Jeton paketleri' : 'Ek ders paketleri'}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => addPack(key, kind)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Satır ekle
                  </Button>
                </div>
                {side[kind].length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    Henüz ürün yok.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {side[kind].map((pack, i) => (
                      <div
                        key={`${kind}-${i}`}
                        className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 p-3 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <div className="min-w-0 flex-1 space-y-1 sm:min-w-[200px]">
                          <Label>product_id</Label>
                          <Input
                            value={pack.product_id}
                            onChange={(e) => setPack(key, kind, i, { product_id: e.target.value })}
                            placeholder={key === 'iap_android' ? 'jeton_100' : 'com.uzaedu.jeton.100'}
                          />
                        </div>
                        <div className="w-full space-y-1 sm:w-28">
                          <Label>Miktar</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={pack.amount}
                            onChange={(e) => setPack(key, kind, i, { amount: parseAmount(e.target.value) })}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1 sm:min-w-[140px]">
                          <Label>Etiket</Label>
                          <Input
                            value={pack.label ?? ''}
                            onChange={(e) => setPack(key, kind, i, { label: e.target.value })}
                          />
                        </div>
                        <GrantFields
                          grantYillikPlan={pack.grant_yillik_plan_uretim ?? 0}
                          grantEvrak={pack.grant_evrak_uretim ?? 0}
                          onGrantYillikPlan={(v) => setPack(key, kind, i, { grant_yillik_plan_uretim: v })}
                          onGrantEvrak={(v) => setPack(key, kind, i, { grant_evrak_uretim: v })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          onClick={() => removePack(key, kind, i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
