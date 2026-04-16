'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { getMyMessagingPreferences, msgQ, patchMyMessagingPreferences, type TeacherMessagingPreferences } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

export default function OgretmenMesajAyarlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TeacherMessagingPreferences>({ appendSignature: '', openWaInNewTab: true });

  useEffect(() => {
    if (!token || me?.role !== 'teacher') return;
    void (async () => {
      setLoading(true);
      try {
        const p = await getMyMessagingPreferences(token, q);
        setForm(p);
      } catch {
        toast.error('Ayarlar yüklenemedi');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, q, me?.role]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const p = await patchMyMessagingPreferences(token, q, {
        appendSignature: form.appendSignature,
        openWaInNewTab: form.openWaInNewTab,
      });
      setForm(p);
      toast.success('Kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  };

  if (me?.role !== 'teacher') {
    return (
      <div className="rounded-2xl border bg-white/80 p-6 text-sm dark:bg-zinc-900/60">
        Bu sayfa yalnızca öğretmen hesapları içindir. Okul geneli WhatsApp ayarları için{' '}
        <Link href={`/mesaj-merkezi/ayarlar${q}`} className="font-semibold text-indigo-600 underline">
          WhatsApp Ayarları
        </Link>{' '}
        kullanılır.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href={`/mesaj-merkezi${q}`}>
            <ArrowLeft className="size-4" />
            Genel Bakış
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-4">
        <div>
          <p className="font-bold">Kişisel gönderim ayarları</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Burada <strong className="text-foreground font-semibold">yalnızca sizin hesabınıza</strong> kaydedilen tercihleri yönetirsiniz:
            imza, wa.me bağlantısının nasıl açılacağı. İstediğiniz zaman değiştirip <strong className="text-foreground font-semibold">Kaydet</strong> ile güncelleyebilirsiniz.
            Okul genelindeki teknik WhatsApp (API / wa.me) modu buradan değişmez; bu sayfa gönderim alışkanlıklarınız içindir.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.openWaInNewTab}
            onChange={(e) => setForm((f) => ({ ...f, openWaInNewTab: e.target.checked }))}
          />
          <span className="text-sm">
            <span className="font-semibold">wa.me bağlantılarını yeni sekmede aç</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Kapalıysa aynı sekmede açılır.</span>
          </span>
        </label>

        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mesaj sonuna eklenecek imza / not</label>
          <textarea
            rows={4}
            value={form.appendSignature}
            onChange={(e) => setForm((f) => ({ ...f, appendSignature: e.target.value }))}
            placeholder="Örn: Saygılarımla — Ad Soyad"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y leading-relaxed"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            WhatsApp metin kutusuna otomatik eklenir (wa.me bağlantılarında).
          </p>
        </div>

        <Button className="gap-1.5" disabled={saving} onClick={() => void save()}>
          {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
          Kaydet
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-xs text-slate-700 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-300">
        <span className="font-semibold text-slate-800 dark:text-zinc-200">Okul ayarı (bilgi):</span>{' '}
        Tüm okul için WhatsApp (API / wa.me) modunu okul yöneticisi{' '}
        <Link href={`/mesaj-merkezi/ayarlar${q}`} className="font-medium text-indigo-600 underline dark:text-indigo-400">
          Mesaj → WhatsApp Ayarları
        </Link>{' '}
        üzerinden belirler. Bu, sizin kişisel tercihlerinizi etkilemez; yukarıdaki ayarları tamamen siz kontrol edersiniz.
      </div>
    </div>
  );
}
