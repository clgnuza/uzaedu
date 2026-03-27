'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RectangleHorizontal, Pencil, Trash2, Plus, Link2, Copy, Coins, UserPlus, Globe, Smartphone, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AD_PLACEMENT_SUGGESTIONS,
  ADSENSE_FORMATS,
  ADMOB_FORMATS,
  GOOGLE_AD_POLICY_LINKS,
  payloadTemplateForProvider,
  type AdProviderUi,
} from '@/lib/ads-admin';
import { buildAdsPublicActiveUrl, type AdsPublicRow } from '@/lib/ads-public';

type AdPlatform = 'web' | 'ios' | 'android';

type AdRow = AdsPublicRow;

type ListRes = { total: number; items: AdRow[] };

const PLATFORMS: { key: AdPlatform; label: string }[] = [
  { key: 'web', label: 'Web' },
  { key: 'ios', label: 'iOS' },
  { key: 'android', label: 'Android' },
];

type AdFormState = {
  placement: string;
  format: string;
  title: string;
  payloadText: string;
  ad_provider: AdProviderUi;
  web_surface: 'desktop' | 'mobile' | 'all';
  consent_mode: 'contextual' | 'targeting';
  active: boolean;
  priority: number;
  starts_at: string;
  ends_at: string;
  platform: AdPlatform;
};

function emptyForm(platform: AdPlatform): AdFormState {
  const ad_provider: AdProviderUi = platform === 'web' ? 'adsense' : 'admob';
  return {
    placement: '',
    format: platform === 'web' ? 'auto' : 'banner',
    title: '',
    payloadText: payloadTemplateForProvider(ad_provider, platform),
    ad_provider,
    web_surface: 'all' as 'desktop' | 'mobile' | 'all',
    consent_mode: 'contextual' as 'contextual' | 'targeting',
    active: true,
    priority: 0,
    starts_at: '',
    ends_at: '',
    platform,
  };
}

export default function ReklamlarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <ReklamlarPageInner />
    </Suspense>
  );
}

function ReklamlarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me, loading: authLoading } = useAuth();
  const [platform, setPlatform] = useState<AdPlatform>('web');
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | AdProviderUi>('all');
  const [webSurfaceFilter, setWebSurfaceFilter] = useState<'all' | 'desktop' | 'mobile'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [data, setData] = useState<ListRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);
  const [form, setForm] = useState<AdFormState>(() => emptyForm('web'));
  const [saving, setSaving] = useState(false);

  const [rewardedCfg, setRewardedCfg] = useState({
    enabled: false,
    jeton_per_reward: 1,
    max_rewards_per_day: 10,
    cooldown_seconds: 90,
    allowed_ad_unit_ids_text: '',
  });
  const [rewardedLoading, setRewardedLoading] = useState(false);
  const [rewardedSaving, setRewardedSaving] = useState(false);

  const [viewTab, setViewTab] = useState<'ads' | 'invite'>('ads');
  const [inviteCfg, setInviteCfg] = useState({
    enabled: false,
    jeton_for_invitee: 5,
    jeton_for_inviter: 10,
    max_invites_per_teacher: 50,
    code_length: 8,
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);

  const isSuperadmin = me?.role === 'superadmin';

  const fetchList = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('platform', platform);
      q.set('limit', '200');
      if (search.trim()) q.set('search', search.trim());
      if (activeFilter === 'yes') q.set('active', 'true');
      if (activeFilter === 'no') q.set('active', 'false');
      if (providerFilter !== 'all') q.set('ad_provider', providerFilter);
      if (platform === 'web' && webSurfaceFilter !== 'all') q.set('web_surface', webSurfaceFilter);
      const res = await apiFetch<ListRes>(`/ads/admin?${q.toString()}`, { token });
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, platform, search, activeFilter, providerFilter, webSurfaceFilter, isSuperadmin]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!token || !isSuperadmin) return;
    setRewardedLoading(true);
    setInviteLoading(true);
    void apiFetch<{
      rewarded_ad_jeton: {
        enabled: boolean;
        jeton_per_reward: number;
        max_rewards_per_day: number;
        cooldown_seconds: number;
        allowed_ad_unit_ids: string[];
      };
      teacher_invite_jeton?: {
        enabled: boolean;
        jeton_for_invitee: number;
        jeton_for_inviter: number;
        max_invites_per_teacher: number;
        code_length: number;
      };
    }>('/app-config/market-policy', { token })
      .then((d) => {
        const r = d.rewarded_ad_jeton;
        if (r) {
          setRewardedCfg({
            enabled: r.enabled,
            jeton_per_reward: r.jeton_per_reward,
            max_rewards_per_day: r.max_rewards_per_day,
            cooldown_seconds: r.cooldown_seconds,
            allowed_ad_unit_ids_text: (r.allowed_ad_unit_ids ?? []).join(', '),
          });
        }
        const ti = d.teacher_invite_jeton;
        if (ti) {
          setInviteCfg({
            enabled: ti.enabled,
            jeton_for_invitee: ti.jeton_for_invitee,
            jeton_for_inviter: ti.jeton_for_inviter,
            max_invites_per_teacher: ti.max_invites_per_teacher,
            code_length: ti.code_length,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        setRewardedLoading(false);
        setInviteLoading(false);
      });
  }, [token, isSuperadmin]);

  useEffect(() => {
    const t = searchParams.get('tab');
    setViewTab(t === 'invite' ? 'invite' : 'ads');
  }, [searchParams]);

  const setTabRoute = useCallback(
    (tab: 'ads' | 'invite') => {
      setViewTab(tab);
      if (tab === 'invite') {
        router.replace('/reklamlar?tab=invite', { scroll: false });
      } else {
        router.replace('/reklamlar', { scroll: false });
      }
    },
    [router],
  );

  const saveRewardedJeton = async () => {
    if (!token) return;
    setRewardedSaving(true);
    try {
      const allowed = rewardedCfg.allowed_ad_unit_ids_text
        .split(/[,\\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch('/app-config/market-policy', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          rewarded_ad_jeton: {
            enabled: rewardedCfg.enabled,
            jeton_per_reward: rewardedCfg.jeton_per_reward,
            max_rewards_per_day: rewardedCfg.max_rewards_per_day,
            cooldown_seconds: rewardedCfg.cooldown_seconds,
            allowed_ad_unit_ids: allowed,
          },
        }),
      });
      toast.success('Market jeton ayarları kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setRewardedSaving(false);
    }
  };

  const saveInviteJeton = async () => {
    if (!token) return;
    setInviteSaving(true);
    try {
      await apiFetch('/app-config/market-policy', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          teacher_invite_jeton: {
            enabled: inviteCfg.enabled,
            jeton_for_invitee: inviteCfg.jeton_for_invitee,
            jeton_for_inviter: inviteCfg.jeton_for_inviter,
            max_invites_per_teacher: inviteCfg.max_invites_per_teacher,
            code_length: inviteCfg.code_length,
          },
        }),
      });
      toast.success('Davetiye ayarları kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setInviteSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(platform));
    setDialogOpen(true);
  };

  const openEdit = (row: AdRow) => {
    setEditing(row);
    setForm({
      placement: row.placement,
      format: row.format,
      title: row.title,
      payloadText: JSON.stringify(row.payload ?? {}, null, 2),
      ad_provider: row.ad_provider ?? 'custom',
      web_surface: (row.web_surface as 'desktop' | 'mobile' | 'all') ?? 'all',
      consent_mode: row.consent_mode ?? 'contextual',
      active: row.active,
      priority: row.priority,
      starts_at: row.starts_at ? row.starts_at.slice(0, 16) : '',
      ends_at: row.ends_at ? row.ends_at.slice(0, 16) : '',
      platform: row.platform,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(form.payloadText || '{}') as Record<string, unknown>;
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('Payload bir nesne olmalı');
      }
    } catch {
      toast.error('Payload geçerli JSON nesnesi değil');
      return;
    }
    const body: Record<string, unknown> = {
      platform: editing?.platform ?? form.platform,
      ad_provider: form.ad_provider,
      placement: form.placement.trim(),
      format: form.format.trim(),
      title: form.title.trim(),
      payload,
      consent_mode: form.consent_mode,
      active: form.active,
      priority: form.priority,
    };
    if (form.platform === 'web') body.web_surface = form.web_surface;
    if (form.starts_at) body.starts_at = new Date(form.starts_at).toISOString();
    else body.starts_at = null;
    if (form.ends_at) body.ends_at = new Date(form.ends_at).toISOString();
    else body.ends_at = null;

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/ads/admin/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Güncellendi');
      } else {
        await apiFetch('/ads/admin', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Eklendi');
      }
      setDialogOpen(false);
      void fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const copyPublicUrl = (row: AdRow) => {
    const url = buildAdsPublicActiveUrl(getApiUrl(''), {
      platform: row.platform,
      placement: row.placement,
      web_surface: row.web_surface ?? undefined,
    });
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Public URL kopyalandı'),
      () => toast.error('Kopyalanamadı'),
    );
  };

  const remove = async (row: AdRow) => {
    if (!token) return;
    if (!confirm(`"${row.title}" silinsin mi?`)) return;
    try {
      await apiFetch(`/ads/admin/${row.id}`, { method: 'DELETE', token });
      toast.success('Silindi');
      void fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  if (authLoading && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Oturum doğrulanıyor…" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="space-y-6">
        <Alert message="Bu sayfa yalnızca süper admin içindir." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Reklamlar</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'AdSense (web)', icon: Globe },
              { label: 'AdMob (mobil)', icon: Smartphone },
              { label: 'meta / API', icon: Code },
            ]}
            summary="Google AdSense (web) ve AdMob (iOS/Android) için ad_provider. Web'de web_surface; kamu API meta: client_hint, privacy_policy_url, non_personalized_ads_recommended, policy_links. İstek: targeting_allowed, web'de cookie_consent."
          />
        </ToolbarHeading>
      </Toolbar>

      <div
        className="sticky top-0 z-30 -mx-1 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-1 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
        role="tablist"
        aria-label="Reklamlar bölümleri"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'ads'}
          id="tab-reklam-ads"
          onClick={() => setTabRoute('ads')}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            viewTab === 'ads'
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          Reklam birimleri
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === 'invite'}
          id="tab-reklam-invite"
          onClick={() => setTabRoute('invite')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            viewTab === 'invite'
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          <UserPlus className="size-4 shrink-0" aria-hidden />
          Öğretmen davetiye
        </button>
      </div>

      {viewTab === 'ads' ? (
        <>
          <Alert variant="info" className="text-xs [&_a]:underline">
        Program politikaları:{' '}
        <a href={GOOGLE_AD_POLICY_LINKS.adsense_program_policies} target="_blank" rel="noreferrer">
          AdSense
        </a>
        {' · '}
        <a href={GOOGLE_AD_POLICY_LINKS.admob_policies} target="_blank" rel="noreferrer">
          AdMob
        </a>
        {' · '}
        <a href={GOOGLE_AD_POLICY_LINKS.consent_mode_ads} target="_blank" rel="noreferrer">
          Consent Mode
        </a>
        {' · '}
        <a href={GOOGLE_AD_POLICY_LINKS.admob_ump} target="_blank" rel="noreferrer">
          UMP (mobil)
        </a>
      </Alert>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-5" />
            Market — ödüllü reklam jetonu (öğretmen)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Mobil AdMob ödüllü reklam: <code className="rounded bg-muted px-1">setUserId(öğretmen UUID)</code> + SSV bu
            URL’ye. Kamu: <code className="rounded bg-muted px-1">GET /api/content/market-policy</code> →{' '}
            <code className="rounded bg-muted px-1">rewarded_ad_jeton</code>. İzinli ad unit boşsa tümü.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs">
              {`${getApiUrl('').replace(/\/$/, '')}/market/rewarded-ad/ssv`}
            </code>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => {
                const u = `${getApiUrl('').replace(/\/$/, '')}/market/rewarded-ad/ssv`;
                void navigator.clipboard.writeText(u).then(
                  () => toast.success('SSV URL kopyalandı'),
                  () => {},
                );
              }}
            >
              Kopyala <Copy className="inline size-3" />
            </button>
          </div>
          {rewardedLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={rewardedCfg.enabled}
                  onChange={(e) => setRewardedCfg((c) => ({ ...c, enabled: e.target.checked }))}
                />
                Ödüllü reklamla jeton kazanımı açık
              </label>
              <div>
                <Label className="text-xs">Jeton / ödül</Label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rewardedCfg.jeton_per_reward}
                  onChange={(e) =>
                    setRewardedCfg((c) => ({ ...c, jeton_per_reward: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Günlük üst sınır (öğretmen)</Label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rewardedCfg.max_rewards_per_day}
                  onChange={(e) =>
                    setRewardedCfg((c) => ({
                      ...c,
                      max_rewards_per_day: Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 1)),
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">İki ödül arası min. süre (sn)</Label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rewardedCfg.cooldown_seconds}
                  onChange={(e) =>
                    setRewardedCfg((c) => ({
                      ...c,
                      cooldown_seconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">İzinli AdMob ad unit ID (virgülle; boş = hepsi)</Label>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  value={rewardedCfg.allowed_ad_unit_ids_text}
                  onChange={(e) => setRewardedCfg((c) => ({ ...c, allowed_ad_unit_ids_text: e.target.value }))}
                  placeholder="ca-app-pub-xxx/yyy, …"
                />
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={rewardedSaving || rewardedLoading}
            onClick={() => void saveRewardedJeton()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {rewardedSaving ? 'Kaydediliyor…' : 'Market jeton ayarlarını kaydet'}
          </button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPlatform(p.key)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              platform === p.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Ara (başlık / placement)</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-0.5 w-56 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            placeholder="…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Sağlayıcı</label>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as 'all' | AdProviderUi)}
            className="mt-0.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="all">Tümü</option>
            <option value="adsense">AdSense</option>
            <option value="admob">AdMob</option>
            <option value="custom">Özel</option>
          </select>
        </div>
        {platform === 'web' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Web yüzeyi</label>
            <select
              value={webSurfaceFilter}
              onChange={(e) => setWebSurfaceFilter(e.target.value as 'all' | 'desktop' | 'mobile')}
              className="mt-0.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">Tümü</option>
              <option value="desktop">Masaüstü</option>
              <option value="mobile">Mobil</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Aktif</label>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as 'all' | 'yes' | 'no')}
            className="mt-0.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
          >
            <option value="all">Tümü</option>
            <option value="yes">Evet</option>
            <option value="no">Hayır</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground pb-1">
          {data != null ? `Toplam: ${data.total}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RectangleHorizontal className="size-5" />
            {PLATFORMS.find((p) => p.key === platform)?.label} reklamları
          </CardTitle>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Yeni
          </button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="table-x-scroll">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Sağlayıcı</th>
                    <th className="p-2 font-medium">Web yüzey</th>
                    <th className="p-2 font-medium">Placement</th>
                    <th className="p-2 font-medium">Format</th>
                    <th className="p-2 font-medium">İzin</th>
                    <th className="p-2 font-medium">Başlık</th>
                    <th className="p-2 font-medium">Öncelik</th>
                    <th className="p-2 font-medium">Aktif</th>
                    <th className="p-2 font-medium">Tarih aralığı</th>
                    <th className="p-2 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="p-2 text-xs">
                        {row.ad_provider === 'adsense'
                          ? 'AdSense'
                          : row.ad_provider === 'admob'
                            ? 'AdMob'
                            : 'Özel'}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {row.platform === 'web'
                          ? row.web_surface === 'desktop'
                            ? 'Masaüstü'
                            : row.web_surface === 'mobile'
                              ? 'Mobil'
                              : 'Tümü'
                          : '—'}
                      </td>
                      <td className="p-2 font-mono text-xs">{row.placement}</td>
                      <td className="p-2">{row.format}</td>
                      <td className="p-2 text-xs">{row.consent_mode === 'targeting' ? 'Targeting' : 'Bağlamsal'}</td>
                      <td className="p-2 max-w-[200px] truncate" title={row.title}>
                        {row.title}
                      </td>
                      <td className="p-2">{row.priority}</td>
                      <td className="p-2">{row.active ? 'Evet' : 'Hayır'}</td>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                        {row.starts_at ? new Date(row.starts_at).toLocaleString('tr-TR') : '—'}
                        {' → '}
                        {row.ends_at ? new Date(row.ends_at).toLocaleString('tr-TR') : '—'}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => copyPublicUrl(row)}
                            title="Public API URL (placement) kopyala"
                            aria-label="URL kopyala"
                          >
                            <Link2 className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => openEdit(row)}
                            aria-label="Düzenle"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                            onClick={() => void remove(row)}
                            aria-label="Sil"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.items?.length && !loading && (
                <p className="py-8 text-center text-muted-foreground">Kayıt yok.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-5" />
              Öğretmen davetiye sistemi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Kayıt <code className="rounded bg-muted px-1">invite_code</code>; API:{' '}
              <code className="rounded bg-muted px-1">/teacher-invite/me</code>,{' '}
              <code className="rounded bg-muted px-1">/teacher-invite/ensure-code</code>,{' '}
              <code className="rounded bg-muted px-1">/teacher-invite/redemptions</code>. Kamu{' '}
              <code className="rounded bg-muted px-1">GET /content/market-policy</code> →{' '}
              <code className="rounded bg-muted px-1">teacher_invite_jeton</code>.
            </p>
            {inviteLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={inviteCfg.enabled}
                    onChange={(e) => setInviteCfg((c) => ({ ...c, enabled: e.target.checked }))}
                  />
                  Davetiye sistemi açık
                </label>
                <div>
                  <Label className="text-xs">Yeni öğretmen jetonu</Label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteCfg.jeton_for_invitee}
                    onChange={(e) =>
                      setInviteCfg((c) => ({ ...c, jeton_for_invitee: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Davet sahibi jetonu</Label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteCfg.jeton_for_inviter}
                    onChange={(e) =>
                      setInviteCfg((c) => ({ ...c, jeton_for_inviter: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Öğretmen başına max davet (0 = sınırsız)</Label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteCfg.max_invites_per_teacher}
                    onChange={(e) =>
                      setInviteCfg((c) => ({
                        ...c,
                        max_invites_per_teacher: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Kod uzunluğu (6–12)</Label>
                  <input
                    type="number"
                    min={6}
                    max={12}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteCfg.code_length}
                    onChange={(e) =>
                      setInviteCfg((c) => ({
                        ...c,
                        code_length: Math.min(12, Math.max(6, parseInt(e.target.value, 10) || 8)),
                      }))
                    }
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={inviteSaving || inviteLoading}
              onClick={() => void saveInviteJeton()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteSaving ? 'Kaydediliyor…' : 'Davetiye ayarlarını kaydet'}
            </button>
          </CardContent>
        </Card>
      )}

      <datalist id="ad-placement-suggestions">
        {AD_PLACEMENT_SUGGESTIONS[form.platform].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="ad-format-hints">
        {(form.platform === 'web' ? ADSENSE_FORMATS : ADMOB_FORMATS).map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? 'Reklam düzenle' : 'Yeni reklam'} className="max-w-2xl">
          <div className="space-y-4">
            {!editing && (
              <div>
                <Label>Platform</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.platform}
                  onChange={(e) => setForm(emptyForm(e.target.value as AdPlatform))}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label>Sağlayıcı</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.ad_provider}
                onChange={(e) => {
                  const ap = e.target.value as AdProviderUi;
                  setForm((f) => ({
                    ...f,
                    ad_provider: ap,
                    format: ap === 'adsense' ? 'auto' : ap === 'admob' ? 'banner' : f.format,
                    payloadText: payloadTemplateForProvider(ap, f.platform),
                  }));
                }}
              >
                {form.platform === 'web' ? (
                  <>
                    <option value="adsense">Google AdSense</option>
                    <option value="custom">Özel (HTML / görsel)</option>
                  </>
                ) : (
                  <>
                    <option value="admob">Google AdMob</option>
                    <option value="custom">Özel</option>
                  </>
                )}
              </select>
            </div>
            {form.platform === 'web' && (
              <div>
                <Label>Web yüzeyi</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.web_surface}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      web_surface: e.target.value as 'desktop' | 'mobile' | 'all',
                    }))
                  }
                >
                  <option value="all">Tümü (masaüstü + mobil)</option>
                  <option value="desktop">Masaüstü</option>
                  <option value="mobile">Mobil</option>
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="ad-placement">Placement</Label>
              <input
                id="ad-placement"
                list="ad-placement-suggestions"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={form.placement}
                onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
                placeholder="örn. banner_home"
              />
            </div>
            <div>
              <Label htmlFor="ad-format">Format</Label>
              <input
                id="ad-format"
                list="ad-format-hints"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.format}
                onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                placeholder={
                  form.ad_provider === 'adsense'
                    ? 'display, in_article, auto…'
                    : 'banner, interstitial, rewarded…'
                }
              />
            </div>
            <div>
              <Label htmlFor="ad-title">İç başlık</Label>
              <input
                id="ad-title"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ad-consent">Consent modu</Label>
              <select
                id="ad-consent"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.consent_mode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    consent_mode: e.target.value as 'contextual' | 'targeting',
                  }))
                }
              >
                <option value="contextual">Bağlamsal (izin/ATT gerekmez)</option>
                <option value="targeting">Targeting (UMP/ATT + web çerez)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ad-payload">Payload (JSON)</Label>
              <textarea
                id="ad-payload"
                className="mt-1 min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={form.payloadText}
                onChange={(e) => setForm((f) => ({ ...f, payloadText: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      payloadText: payloadTemplateForProvider(f.ad_provider, f.platform),
                    }))
                  }
                >
                  Şablon yükle
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() => {
                    const sample = buildAdsPublicActiveUrl(getApiUrl(''), {
                      platform: form.platform,
                      placement: form.placement.trim() || 'banner_home',
                      web_surface: form.platform === 'web' ? form.web_surface : undefined,
                    });
                    void navigator.clipboard.writeText(sample).then(
                      () => toast.success('Örnek istek URL’si kopyalandı'),
                      () => {},
                    );
                  }}
                >
                  Örnek API URL <Copy className="inline size-3" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                AdSense: <code>publisher_id</code>, <code>slot_id</code>; AdMob: <code>app_id</code>,{' '}
                <code>ad_unit_id</code>; özel web: <code>image_url</code>, <code>click_url</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ad-prio">Öncelik</Label>
                <input
                  id="ad-prio"
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))
                  }
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Aktif
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ad-start">Başlangıç (yerel)</Label>
                <input
                  id="ad-start"
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="ad-end">Bitiş (yerel)</Label>
                <input
                  id="ad-end"
                  type="datetime-local"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm"
              onClick={() => setDialogOpen(false)}
            >
              İptal
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => void submit()}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
