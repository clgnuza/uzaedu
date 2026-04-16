'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileDown, Calendar, Users, UserCheck, LayoutList, ClipboardList, PenSquare, BarChart3, BadgeDollarSign, FileText } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type Session = { id: string; subjectName: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null; studentCount?: number };

const REPORT_GROUPS = [
  {
    label: 'Program Raporları',
    items: [
      { key: 'program',         icon: Calendar,        label: 'Sınav Programı',         desc: 'Tüm oturumlar, tarih/saat/salon, görevliler. (A4 Yatay)', color: 'indigo', adminOnly: false },
      { key: 'ogrenci-program', icon: LayoutList,      label: 'Öğrenci Programı',       desc: 'Her öğrencinin hangi derste hangi oturuma atandığı.', color: 'sky', adminOnly: false },
    ],
  },
  {
    label: 'Görevlendirme',
    items: [
      { key: 'gorevlendirme',   icon: UserCheck,       label: 'Görevlendirme Çizelgesi',desc: 'Komisyon üyeleri ve gözcüler, oturum bazlı. (A4 Yatay)', color: 'teal', adminOnly: false },
      { key: 'imza-sirkulu',    icon: PenSquare,       label: 'Öğretmen İmza Sirkülü',  desc: 'Her öğretmenin görev listesi ve imza alanı.', color: 'violet', adminOnly: false },
      { key: 'gorev-dagilimi',  icon: BarChart3,       label: 'Görev Dağılımı',         desc: 'Öğretmen başına komisyon/gözcü görev sayıları ve ek ders saatleri.', color: 'emerald', adminOnly: false },
    ],
  },
  {
    label: 'Resmi Belgeler',
    items: [
      { key: 'ek-ucret-onay',   icon: BadgeDollarSign, label: 'Ek Ücret Onay Belgesi',  desc: 'MEB ek ders ücreti (5 saat/oturum) onay formu. Muhasebe için.', color: 'amber', adminOnly: true },
      { key: 'tutanak',         icon: FileText,        label: 'Sınav Tutanakları',       desc: 'Her oturum için ayrı resmi tutanak (tüm oturumlar tek PDF).', color: 'rose', adminOnly: false },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo:  'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  sky:     'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  teal:    'bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  amber:   'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  violet:  'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  rose:    'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};

function dateLabel(s: Session) {
  try {
    return new Date(s.sessionDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  } catch { return s.sessionDate; }
}

export default function RaporlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [sessions, setSessions]       = useState<Session[]>([]);
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !token) return;
    setLoading(true);
    apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token })
      .then((d) => setSessions(d))
      .catch(() => toast.error('Oturumlar yüklenemedi'))
      .finally(() => setLoading(false));
  }, [groupId, token, schoolQ]);

  const downloadPdf = async (url: string, filename: string) => {
    setDownloading(filename);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
      const res = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      toast.success(`${filename} indirildi`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setDownloading(null); }
  };

  const dl = (key: string) => {
    if (!groupId) return toast.error('Grup seçili değil');
    void downloadPdf(`/sorumluluk-exam/groups/${groupId}/pdf/${key}${schoolQ}`, `${key}.pdf`);
  };

  const dlYoklama = (sessionId: string, subjectName: string, date: string) => {
    const safe = subjectName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, '').trim();
    void downloadPdf(`/sorumluluk-exam/sessions/${sessionId}/pdf/yoklama${schoolQ}`, `yoklama-${safe}-${date}.pdf`);
  };

  const dlAllYoklama = async () => {
    for (const s of sessions) {
      await dlYoklama(s.id, s.subjectName, s.sessionDate);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  if (!groupId) return <p className="text-sm text-muted-foreground text-center py-8">Önce bir grup seçin.</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Grup raporları — gruplandırılmış */}
      {REPORT_GROUPS.map((group) => {
        const visibleItems = group.items.filter((r) => !r.adminOnly || isAdmin);
        if (!visibleItems.length) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:mb-2 sm:text-xs">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {visibleItems.map((r) => {
                const Icon = r.icon;
                const busy = downloading === `${r.key}.pdf`;
                return (
                  <div key={r.key} className="rounded-xl border border-white/50 bg-white/80 p-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:rounded-2xl sm:p-4">
                    <div className="mb-1.5 flex items-start gap-2 sm:mb-2 sm:items-center sm:gap-2.5">
                      <div className={`rounded-lg p-2 sm:rounded-xl sm:p-2.5 ${COLOR_MAP[r.color]}`}>
                        <Icon className="size-3.5 sm:size-4" />
                      </div>
                      <p className="text-xs font-semibold leading-tight sm:text-sm">{r.label}</p>
                    </div>
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground sm:mb-3 sm:text-xs sm:leading-relaxed">{r.desc}</p>
                    <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={busy} onClick={() => dl(r.key)}>
                      {busy ? <LoadingSpinner className="size-4" /> : <FileDown className="size-4" />}
                      PDF İndir
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Yoklama listeleri */}
      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:text-xs">
            <ClipboardList className="size-3.5" /> Yoklama Listeleri
          </p>
          {sessions.length > 1 && (
            <Button size="sm" variant="outline" className="h-8 w-full gap-1.5 text-[11px] sm:h-9 sm:w-auto sm:text-xs" onClick={dlAllYoklama} disabled={!!downloading}>
              <FileDown className="size-3.5" /> Tümünü İndir
            </Button>
          )}
        </div>

        {loading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}

        {!loading && sessions.length === 0 && (
          <div className="rounded-2xl border bg-white/60 p-8 text-center text-muted-foreground dark:bg-zinc-900/40">
            <Users className="mx-auto mb-2 size-6 opacity-30" />
            <p className="text-xs">Bu grupta henüz oturum yok.</p>
          </div>
        )}

        <div className="space-y-2">
          {sessions.map((s) => {
            const key = `yoklama-${s.subjectName}-${s.sessionDate}.pdf`;
            const busy = downloading === key;
            return (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-white/50 bg-white/70 px-3 py-2.5 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:gap-3 sm:rounded-xl sm:px-4 sm:py-3">
                <div className={`shrink-0 rounded-lg p-1.5 sm:p-2 ${COLOR_MAP['amber']}`}>
                  <ClipboardList className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-tight sm:text-sm">{s.subjectName}</p>
                  <p className="mt-0.5 break-words text-[10px] text-muted-foreground sm:text-xs">{dateLabel(s)} · {s.startTime?.substring(0,5)}–{s.endTime?.substring(0,5)}{s.roomName ? ` · ${s.roomName}` : ''}</p>
                  {(s.studentCount !== undefined) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5"><Users className="inline size-3 mr-0.5" />{s.studentCount} öğrenci</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-8 w-full shrink-0 gap-1.5 text-xs sm:h-9 sm:w-auto" disabled={busy} onClick={() => dlYoklama(s.id, s.subjectName, s.sessionDate)}>
                  {busy ? <LoadingSpinner className="size-4" /> : <FileDown className="size-4" />}
                  Yoklama
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
