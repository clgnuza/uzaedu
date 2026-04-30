'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, BookOpen, CircleCheck, ExternalLink, Layers, StickyNote, Target } from 'lucide-react';

type BilsemPlanRow = {
  id: string;
  week_order: number;
  hafta_label: string | null;
  week_start: string | null;
  week_end: string | null;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
  ders_saati: number | null;
  surec_bilesenleri: string | null;
  olcme_degerlendirme: string | null;
  sosyal_duygusal: string | null;
  degerler: string | null;
  okuryazarlik_becerileri: string | null;
  belirli_gun_haftalar: string | null;
  zenginlestirme: string | null;
  okul_temelli_planlama: string | null;
};

const NOTES_KEY = 'bilsem-kazanim-notlari';

type NoteItem = { id: string; text: string; createdAt: string };

function getNotes(itemId: string): NoteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const obj = JSON.parse(raw) as Record<string, NoteItem[]>;
    return obj[itemId] ?? [];
  } catch {
    return [];
  }
}

function addNote(itemId: string, text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, NoteItem[]>) : {};
    const list = obj[itemId] ?? [];
    list.push({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() });
    obj[itemId] = list;
    localStorage.setItem(NOTES_KEY, JSON.stringify(obj));
  } catch {}
}

function deleteNote(itemId: string, noteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, NoteItem[]>;
    const list = (obj[itemId] ?? []).filter((n) => n.id !== noteId);
    if (list.length) obj[itemId] = list;
    else delete obj[itemId];
    localStorage.setItem(NOTES_KEY, JSON.stringify(obj));
  } catch {}
}

function NotesModal({
  open,
  onClose,
  row,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  row: BilsemPlanRow | null;
  onChanged: () => void;
}) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  useEffect(() => {
    if (!open || !row) return;
    setText('');
    setNotes(getNotes(row.id));
  }, [open, row]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
        <div className="relative inline-block w-full max-w-lg transform rounded-xl bg-background text-left shadow-xl transition-all sm:align-middle">
          <div className="rounded-t-xl bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4" />
                <h3 className="text-sm font-semibold">Kazanım Notları · W{row.week_order}</h3>
              </div>
              <button onClick={onClose} className="rounded px-2 py-0.5 text-lg leading-none hover:bg-white/20">×</button>
            </div>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz not yok.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm">{n.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      deleteNote(row.id, n.id);
                      setNotes(getNotes(row.id));
                      onChanged();
                    }}
                    className="mt-2 text-xs text-destructive hover:underline"
                  >
                    Sil
                  </button>
                </div>
              ))
            )}
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Not ekleyin..."
            />
          </div>
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-border px-4 py-3">
            <button onClick={onClose} className="rounded-lg border border-input px-3 py-1.5 text-sm">Kapat</button>
            <button
              onClick={() => {
                const t = text.trim();
                if (!t) return;
                addNote(row.id, t);
                setNotes(getNotes(row.id));
                setText('');
                onChanged();
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseId(id: string): { subject_code: string; academic_year: string; ana_grup: string; alt_grup?: string } | null {
  const parts = decodeURIComponent(id || '').split(':');
  if (parts.length < 3) return null;
  const [subject_code, academic_year, ana_grup, alt_grup] = parts;
  if (!subject_code || !academic_year || !ana_grup) return null;
  return { subject_code, academic_year, ana_grup, alt_grup: alt_grup || undefined };
}

function formatWeekTitle(row: BilsemPlanRow): string {
  if (row.hafta_label?.trim()) return row.hafta_label.trim();
  return `${row.week_order}. Hafta`;
}

function formatWeekRange(row: BilsemPlanRow): string {
  if (!row.week_start || !row.week_end) return '';
  try {
    const s = new Date(`${row.week_start}T12:00:00`);
    const e = new Date(`${row.week_end}T12:00:00`);
    const ay = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
    if (s.getMonth() === e.getMonth()) return `${s.getDate()}-${e.getDate()} ${ay[s.getMonth()]}`;
    return `${s.getDate()} ${ay[s.getMonth()]} - ${e.getDate()} ${ay[e.getMonth()]}`;
  } catch {
    return '';
  }
}

function formatDuration(row: BilsemPlanRow): string {
  if (row.ders_saati != null && row.ders_saati > 0) return `${row.ders_saati} ders saati`;
  return 'Saat bilgisi yok';
}

export default function BilsemKazanimSablonuDetayPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const key = useMemo(() => parseId(id), [id]);
  const [items, setItems] = useState<BilsemPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notesVersion, setNotesVersion] = useState(0);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesModalRow, setNotesModalRow] = useState<BilsemPlanRow | null>(null);

  const canAccess = me?.role === 'teacher' || me?.role === 'school_admin' || me?.role === 'superadmin';
  const canCreateSet = me?.role === 'superadmin';

  const fetchRows = useCallback(async () => {
    if (!token || !key) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('subject_code', key.subject_code);
      qs.set('academic_year', key.academic_year);
      qs.set('ana_grup', key.ana_grup);
      if (key.alt_grup) qs.set('alt_grup', key.alt_grup);
      const res = await apiFetch<{ items?: BilsemPlanRow[] }>(`/bilsem/yillik-plan/plan-rows?${qs.toString()}`, { token });
      const rows = (res.items ?? []).sort((a, b) => a.week_order - b.week_order);
      setItems(rows);
      if (rows.length) setActiveWeek(rows[0].week_order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, key]);

  useEffect(() => {
    if (me && !canAccess) router.replace('/403');
  }, [me, canAccess, router]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const byWeek = useMemo(() => {
    const m = new Map<number, BilsemPlanRow[]>();
    for (const row of items) {
      const arr = m.get(row.week_order) ?? [];
      arr.push(row);
      m.set(row.week_order, arr);
    }
    return m;
  }, [items]);

  const weeks = useMemo(() => [...byWeek.keys()].sort((a, b) => a - b), [byWeek]);

  useEffect(() => {
    const c = tabScrollRef.current;
    if (!c || activeWeek == null) return;
    const btn = c.querySelector(`[data-week="${activeWeek}"]`) as HTMLElement | null;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const cRect = c.getBoundingClientRect();
      const left = btn.offsetLeft - cRect.width / 2 + rect.width / 2;
      c.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [activeWeek]);

  const syncSet = useCallback(async () => {
    if (!token || !key || !canCreateSet) return;
    setSyncing(true);
    try {
      await apiFetch('/bilsem/yillik-plan/outcome-sets/import-from-yillik-plan', {
        token,
        method: 'POST',
        body: JSON.stringify({
          subject_code: key.subject_code,
          academic_year: key.academic_year,
          ana_grup: key.ana_grup,
          alt_grup: key.alt_grup,
        }),
      });
      toast.success('Kazanım seti oluşturuldu.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Set oluşturulamadı');
    } finally {
      setSyncing(false);
    }
  }, [token, key, canCreateSet]);

  function SectionCard({
    title,
    value,
    tint,
  }: {
    title: string;
    value: string | null | undefined;
    tint: string;
  }) {
    if (!String(value ?? '').trim()) return null;
    return (
      <div className={`border-b border-gray-100 px-3 py-3 dark:border-gray-700 sm:px-4 ${tint}`}>
        <div className="inline-flex rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground/80 ring-1 ring-border sm:text-xs">
          {title}
        </div>
        <div className="mt-2 rounded-lg border border-border/70 bg-background px-2.5 py-2 sm:px-3">
          <p className="whitespace-pre-wrap text-[12px] leading-5 text-foreground sm:text-sm sm:leading-6">{value}</p>
        </div>
      </div>
    );
  }

  const currentRows = byWeek.get(activeWeek ?? -1) ?? [];
  const activeMeta = currentRows[0] ?? null;
  const activeRange = activeMeta ? formatWeekRange(activeMeta) : '';

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yukleniyor..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bilsem/yillik-plan/kazanim-sablonlari" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="size-4" />
            Geri
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Bilsem Haftalik Kazanimlar</h1>
            <p className="text-sm text-muted-foreground">
              {key ? `${key.subject_code} · ${key.academic_year} · ${key.ana_grup}` : ''}
            </p>
            {activeMeta ? (
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {formatWeekTitle(activeMeta)}
                {activeRange ? <span className="text-foreground/70">· {activeRange}</span> : null}
                <span className="text-foreground/70">· {formatDuration(activeMeta)}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/bilsem/yillik-plan"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="size-4" />
            Word plana don
          </Link>
          {canCreateSet ? (
            <button
              type="button"
              onClick={syncSet}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Layers className="size-4" />
              {syncing ? 'Set olusturuluyor...' : 'Kazanim seti olustur'}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : error || !key ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <EmptyState
            icon={<BookOpen className="size-10 text-muted-foreground" />}
            title="Icerik bulunamadi"
            description={error ?? 'Plan anahtari gecersiz.'}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 bg-linear-to-r from-violet-500/10 via-cyan-500/10 to-emerald-500/10 px-4 py-2 dark:border-gray-700">
            <svg viewBox="0 0 600 48" className="h-8 w-full" aria-hidden="true">
              <path d="M0 28 C120 4, 180 44, 300 24 C420 4, 480 44, 600 20" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/50" />
              <circle cx="120" cy="17" r="3" className="fill-primary/60" />
              <circle cx="300" cy="24" r="3" className="fill-cyan-500/60" />
              <circle cx="480" cy="24" r="3" className="fill-emerald-500/60" />
            </svg>
          </div>
          <div className="relative overflow-hidden border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <div ref={tabScrollRef} className="tab-nav-scroll hide-scrollbar overflow-x-auto px-2">
              <nav className="flex min-w-max gap-1 border-b-2 border-gray-200 dark:border-gray-700">
              {weeks.map((w) => (
                (() => {
                  const rows = byWeek.get(w) ?? [];
                  const hasMissing = rows.some((r) => !(r.unite || r.konu || r.kazanimlar));
                  const title = rows[0] ? formatWeekTitle(rows[0]) : `${w}. Hafta`;
                  return (
                <button
                  key={w}
                  data-week={w}
                  type="button"
                  onClick={() => setActiveWeek(w)}
                  className={`group relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs font-semibold transition-all sm:px-6 sm:py-3 sm:text-sm ${
                    activeWeek === w ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{title}</span>
                  {hasMissing ? <AlertTriangle className="size-3 text-amber-500" /> : <CircleCheck className="size-3 text-emerald-500" />}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                      activeWeek === w ? 'bg-primary' : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'
                    }`}
                  />
                </button>
                  );
                })()
              ))}
              </nav>
            </div>
          </div>

          <div className="p-3 sm:p-6">
            {currentRows.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-10 text-muted-foreground" />}
                title="Bu haftada icerik yok"
                description="Farkli hafta secin veya plan icerigini kontrol edin."
              />
            ) : (
              <div className="space-y-3">
                {currentRows.map((r) => (
                  <div key={r.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-muted/30 px-3 py-2 dark:border-gray-700 sm:px-4">
                      <div className="text-xs font-semibold">
                        {formatWeekTitle(r)}
                        {formatWeekRange(r) ? <span className="ml-1 font-normal text-muted-foreground">· {formatWeekRange(r)}</span> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotesModalRow(r);
                          setNotesModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs"
                      >
                        <StickyNote className="size-3.5" />
                        Notlar
                        {getNotes(r.id).length > 0 ? <span key={`${r.id}:${notesVersion}`} className="rounded bg-primary/20 px-1">{getNotes(r.id).length}</span> : null}
                      </button>
                    </div>
                    <SectionCard title="Ünite / Tema" value={r.unite} tint="bg-linear-to-r from-violet-50 to-transparent dark:from-violet-900/20" />
                    <SectionCard title="Konu" value={r.konu} tint="bg-linear-to-r from-blue-50 to-transparent dark:from-blue-900/20" />
                    <SectionCard title="Öğrenme Çıktısı (Kazanımlar)" value={r.kazanimlar} tint="bg-linear-to-r from-amber-50 to-transparent dark:from-amber-900/20" />
                    <SectionCard title="Süreç Bileşenleri" value={r.surec_bilesenleri} tint="bg-linear-to-r from-cyan-50 to-transparent dark:from-cyan-900/20" />
                    <SectionCard title="Ölçme ve Değerlendirme" value={r.olcme_degerlendirme} tint="bg-linear-to-r from-orange-50 to-transparent dark:from-orange-900/20" />
                    <SectionCard title="Sosyal-Duygusal Beceriler" value={r.sosyal_duygusal} tint="bg-linear-to-r from-pink-50 to-transparent dark:from-pink-900/20" />
                    <SectionCard title="Değerler" value={r.degerler} tint="bg-linear-to-r from-purple-50 to-transparent dark:from-purple-900/20" />
                    <SectionCard title="Okuryazarlık Becerileri" value={r.okuryazarlik_becerileri} tint="bg-linear-to-r from-rose-50 to-transparent dark:from-rose-900/20" />
                    <SectionCard title="Belirli Gün ve Haftalar" value={r.belirli_gun_haftalar} tint="bg-linear-to-r from-fuchsia-50 to-transparent dark:from-fuchsia-900/20" />
                    <SectionCard title="Farklılaştırma (Zenginleştirme)" value={r.zenginlestirme} tint="bg-linear-to-r from-teal-50 to-transparent dark:from-teal-900/20" />
                    <SectionCard title="Okul Temelli Planlama" value={r.okul_temelli_planlama} tint="bg-linear-to-r from-indigo-50 to-transparent dark:from-indigo-900/20" />
                    {r.ders_saati != null && r.ders_saati > 0 ? (
                      <div className="bg-linear-to-r from-emerald-50 to-transparent px-4 py-3 dark:from-emerald-900/20">
                        <h4 className="text-xs font-bold sm:text-sm">Ders Saati</h4>
                        <p className="text-xs sm:text-sm">{r.ders_saati}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <NotesModal
        open={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false);
          setNotesModalRow(null);
        }}
        row={notesModalRow}
        onChanged={() => setNotesVersion((v) => v + 1)}
      />
    </div>
  );
}

