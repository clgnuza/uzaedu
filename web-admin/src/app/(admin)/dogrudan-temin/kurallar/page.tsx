'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Shield, BadgeCheck, Landmark, Handshake, StickyNote, Megaphone } from 'lucide-react';

type DtRules = {
  require_award_before_payment: boolean;
  require_budget_account_on_file: boolean;
  require_quote_on_payment: boolean;
  payment_note_min_length: number;
  platform_notice_tr: string;
};

export default function DtKurallarPage() {
  const { me, token } = useAuth();
  const isSuper = me?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<DtRules | null>(null);

  const load = useCallback(async () => {
    if (!token || !isSuper) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<DtRules>('/app-config/dogrudan-temin-rules', { token });
      setRules(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [isSuper, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !rules) return;
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch<DtRules>('/app-config/dogrudan-temin-rules', {
        token,
        method: 'PATCH',
        body: JSON.stringify(rules),
      });
      setRules(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuper) return <ForbiddenView description="Sadece süper yönetici DT platform kurallarını düzenleyebilir." />;

  return (
    <div className="space-y-3 text-xs">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan Temin — platform kuralları</ToolbarPageTitle>
        </ToolbarHeading>
      </Toolbar>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="size-4 text-primary" />
            Tüm okullar için geçerli kurallar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {error ? <Alert message={error} /> : null}
          {loading || !rules ? (
            <LoadingSpinner label="Yükleniyor…" className="py-8" />
          ) : (
            <div className="space-y-4">
              <Alert variant="info" message="Bu ayarlar tüm okulların web arayüzünde doğrudan temin ödeme ve bloke adımlarına uygulanır. Değişiklik öncesi yedek / iletişim önerilir." />
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.require_award_before_payment}
                    onChange={(e) => setRules((s) => (s ? { ...s, require_award_before_payment: e.target.checked } : s))}
                    className="size-4 rounded border-border mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <BadgeCheck className="size-4 text-emerald-600 shrink-0" />
                      Ödeme öncesi karar zorunlu
                    </div>
                    <p className="text-[11px] text-muted-foreground">Açıkken ödeme kaydı için dosyada karar (ihale kararı / award) oluşmuş olmalı; aksi halde API reddeder.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.require_budget_account_on_file}
                    onChange={(e) => setRules((s) => (s ? { ...s, require_budget_account_on_file: e.target.checked } : s))}
                    className="size-4 rounded border-border mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Landmark className="size-4 text-amber-600 shrink-0" />
                      Dosyada bütçe hesabı zorunlu
                    </div>
                    <p className="text-[11px] text-muted-foreground">Ödeme veya bloke işlemlerinden önce dosyanın bir bütçe hesabına bağlanmasını zorunlu kılar.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.require_quote_on_payment}
                    onChange={(e) => setRules((s) => (s ? { ...s, require_quote_on_payment: e.target.checked } : s))}
                    className="size-4 rounded border-border mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <Handshake className="size-4 text-sky-600 shrink-0" />
                      Ödemede teklif seçimi zorunlu
                    </div>
                    <p className="text-[11px] text-muted-foreground">Her ödeme kaydında hangi firma teklifine istinaden ödeme yapıldığı seçilmeli.</p>
                  </div>
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-2">
                  <StickyNote className="size-3.5" />
                  Ödeme notu minimum uzunluk (karakter)
                </label>
                <p className="text-[10px] text-muted-foreground">0 = opsiyonel</p>
                <Input
                  type="number"
                  min={0}
                  max={2000}
                  value={rules.payment_note_min_length}
                  onChange={(e) =>
                    setRules((s) => (s ? { ...s, payment_note_min_length: Number(e.target.value) || 0 } : s))
                  }
                  className="text-xs max-w-[140px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase flex items-center gap-2">
                  <Megaphone className="size-3.5" />
                  Okul yöneticilerine üst bildirim
                </label>
                <p className="text-[10px] text-muted-foreground">Doğrudan Temin modülünün başında gösterilecek metin</p>
                <textarea
                  value={rules.platform_notice_tr}
                  onChange={(e) => setRules((s) => (s ? { ...s, platform_notice_tr: e.target.value } : s))}
                  rows={6}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                  placeholder="Önemli kurallar, hatırlatmalar, uyarılar…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button onClick={() => void load()} variant="outline" disabled={saving}>
                  Sıfırla
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                  Değişiklikleri Kaydet
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
