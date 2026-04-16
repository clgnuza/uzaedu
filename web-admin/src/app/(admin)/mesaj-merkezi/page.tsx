'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Campaign, TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, loadCampaigns, deleteCampaign, msgQ } from '@/lib/messaging-api';
import TeacherWaQuickSend from './components/TeacherWaQuickSend';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, Send, Clock, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const QUICK_LINKS = [
  { href: '/mesaj-merkezi/veli-iletisim',  label: 'Veli / Toplu Mesaj', desc: 'Excel veya manuel giriş',     color: 'from-sky-500 to-cyan-500' },
  { href: '/mesaj-merkezi/gruplar',        label: 'Gruplar',            desc: 'Sınırsız kişi, toplu gönder', color: 'from-violet-500 to-purple-500' },
  { href: '/mesaj-merkezi/veli-toplantisi',label: 'Veli Toplantısı',   desc: 'Toplantı + davetiye gönder',  color: 'from-cyan-500 to-sky-600' },
  { href: '/mesaj-merkezi/davetiye',       label: 'Davetiye',           desc: 'Etkinlik & özel gün',         color: 'from-pink-500 to-rose-500' },
  { href: '/mesaj-merkezi/mebbis-puantaj', label: 'MEBBİS Puantaj',    desc: 'Otomatik ayrıştır & gönder', color: 'from-slate-500 to-gray-600',  adminOnly: true },
  { href: '/mesaj-merkezi/kbs-ek-ders',   label: 'KBS Ek Ders Bordro', desc: 'KBS Excel ayrıştır & gönder', color: 'from-amber-500 to-orange-500', adminOnly: true },
  { href: '/mesaj-merkezi/kbs-maas',      label: 'KBS Maaş Bordro',   desc: 'Gizli, kişiye özel gönderim', color: 'from-emerald-500 to-teal-500', adminOnly: true },
  { href: '/mesaj-merkezi/devamsizlik',       label: 'Günlük Devamsızlık',     desc: 'E-Okul Excel yükle',         color: 'from-rose-500 to-pink-500' },
  { href: '/mesaj-merkezi/ders-devamsizlik',  label: 'Ders Devamsızlık',      desc: 'E-öğretmen — ders bazlı',    color: 'from-red-500 to-rose-600' },
  { href: '/mesaj-merkezi/devamsizlik-mektup',label: 'Devamsızlık Mektubu',   desc: 'PDF böl & veliye gönder',    color: 'from-orange-500 to-red-500', adminOnly: true },
  { href: '/mesaj-merkezi/ara-karne',         label: 'Ara Karne',             desc: 'PDF böl & veliye gönder',    color: 'from-teal-500 to-emerald-500', adminOnly: true },
  { href: '/mesaj-merkezi/karne',             label: 'Karne',                 desc: 'PDF böl & veliye gönder',    color: 'from-emerald-500 to-green-600', adminOnly: true },
  { href: '/mesaj-merkezi/izin',              label: 'Evci / Çarşı İzin',     desc: 'E-Okul izin Excel',          color: 'from-lime-500 to-green-500' },
];

export default function MesajMerkeziPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q      = msgQ(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';
  const isTeacher = me?.role === 'teacher';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setCampaigns(await loadCampaigns(token, q)); }
    catch { toast.error('Kampanyalar yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, q]);

  const del = async (id: string) => {
    if (!confirm('Kampanyayı silmek istiyor musunuz?')) return;
    try { await deleteCampaign(token ?? '', id, q); toast.success('Silindi'); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const stats = { total: campaigns.length, sent: campaigns.filter((c) => c.status === 'completed').length, sending: campaigns.filter((c) => c.status === 'sending').length };

  return (
    <div className="space-y-5">
      {isTeacher ? (
        <Link
          href={`/mesaj-merkezi/ogretmen-ayarlar${q}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm shadow-sm transition hover:bg-emerald-100/80 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40"
        >
          <span>
            <span className="font-semibold text-emerald-900 dark:text-emerald-100 block">Ayarlarım — gönderim tercihleri</span>
            <span className="mt-0.5 block text-[11px] font-normal text-emerald-800/85 dark:text-emerald-200/80">
              İmza, wa.me nasıl açılsın; yalnızca sizin hesabınıza kaydedilir.
            </span>
          </span>
          <Settings className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
        </Link>
      ) : null}

      {isTeacher ? (
        <TeacherWaQuickSend token={token} q={q} onCampaignCreated={load} />
      ) : null}

      {/* Hızlı erişim */}
      {!isTeacher ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Yeni Kampanya</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => (
              <Link key={l.href} href={`${l.href}${q}`}
                className={`rounded-2xl bg-gradient-to-br ${l.color} p-3 text-white shadow hover:opacity-90 transition-opacity`}>
                <p className="font-bold text-sm leading-tight">{l.label}</p>
                <p className="text-xs opacity-85 mt-0.5">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* İstatistik */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Kampanya', value: stats.total, icon: Clock, color: 'text-indigo-600' },
          { label: 'Tamamlanan', value: stats.sent, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Aktif Gönderim', value: stats.sending, icon: Send, color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60 text-center">
            <s.icon className={cn('mx-auto mb-1 size-5', s.color)} />
            <p className="text-2xl font-bold leading-none">{s.value}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Kampanya listesi */}
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">Son Kampanyalar</p>
        {campaigns.length === 0 && (
          <div className="rounded-2xl border bg-white/60 p-10 text-center text-muted-foreground dark:bg-zinc-900/40">
            <XCircle className="mx-auto mb-2 size-8 opacity-30" />
            <p className="text-sm">Henüz kampanya yok.</p>
          </div>
        )}
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-white/70 px-4 py-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm leading-tight">{c.title}</span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {TYPE_LABELS[c.type] ?? c.type}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[c.status])}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </div>
                <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-green-500" />{c.sentCount}/{c.totalCount}</span>
                  {c.failedCount > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="size-3" />{c.failedCount} hatalı</span>}
                  <span>{new Date(c.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={() => del(c.id)} className="shrink-0 text-muted-foreground hover:text-red-600">
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
