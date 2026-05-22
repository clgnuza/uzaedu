'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';

const PACKS = [
  { href: '/mesaj-merkezi/devamsizlik', label: 'Haftalık devamsızlık', desc: 'E-Okul Excel → SMS/WA bilgilendirme', color: 'from-rose-500 to-pink-600' },
  { href: '/mesaj-merkezi/ders-devamsizlik', label: 'Ders devamsızlık', desc: 'E-öğretmen → birleşik mesaj', color: 'from-red-500 to-rose-600' },
  { href: '/mesaj-merkezi/karne', label: 'Karne günü', desc: 'PDF böl → WhatsApp belge', color: 'from-emerald-500 to-green-600' },
  { href: '/mesaj-merkezi/veli-toplantisi', label: 'Veli toplantısı', desc: 'Davetiye + toplantı metni', color: 'from-cyan-500 to-sky-600' },
  { href: '/mesaj-merkezi/mebbis-puantaj', label: 'Puantaj dönemi', desc: 'MEBBİS bordro → öğretmen', color: 'from-slate-500 to-gray-600', admin: true },
  { href: '/mesaj-merkezi/veli-iletisim', label: 'Acil bilgilendirme', desc: 'Manuel / Excel toplu mesaj', color: 'from-sky-500 to-cyan-500' },
];

export default function IsAkislariPage() {
  const searchParams = useSearchParams();
  const { me } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  return (
    <div className="space-y-4">
      <p className="font-bold text-base">Hazır iş akışları</p>
      <p className="text-xs text-muted-foreground">Okul takvimine uygun kısayollar — doğru şablon ve kanal önerisiyle</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PACKS.filter((p) => !p.admin || isAdmin).map((p) => (
          <Link
            key={p.href}
            href={`${p.href}${q}`}
            className={`rounded-2xl bg-gradient-to-br ${p.color} p-4 text-white shadow hover:opacity-90 transition-opacity`}
          >
            <p className="font-bold">{p.label}</p>
            <p className="text-xs opacity-90 mt-1">{p.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
