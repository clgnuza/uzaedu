'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Target,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  StickyNote,
  ExternalLink,
} from 'lucide-react';

type PlanItem = {
  id: string;
  weekOrder: number;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
  dersSaati: number;
  belirliGunHaftalar: string | null;
  surecBilesenleri: string | null;
  olcmeDegerlendirme: string | null;
  sosyalDuygusal: string | null;
  degerler: string | null;
  okuryazarlikBecerileri: string | null;
  zenginlestirme?: string | null;
  okulTemelliPlanlama?: string | null;
  hafta_label?: string;
  ay?: string;
  week_start?: string | null;
  week_end?: string | null;
};

type PlanContentResponse = {
  subject_code: string;
  subject_label: string;
  grade: number;
  academic_year: string;
  section: string | null;
  items: PlanItem[];
};

const STORAGE_KEY = 'kazanim-notlari';

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function getNotes(itemId: string): { id: string; text: string; createdAt: string }[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: Record<string, { id: string; text: string; createdAt: string }[]> = JSON.parse(raw);
    return all[itemId] ?? [];
  } catch {
    return [];
  }
}

function saveNote(itemId: string, text: string): void {
  if (!isStorageAvailable()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, { id: string; text: string; createdAt: string }[]> = raw ? JSON.parse(raw) : {};
    const list = all[itemId] ?? [];
    const id = crypto.randomUUID();
    list.push({ id, text, createdAt: new Date().toISOString() });
    all[itemId] = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function deleteNote(itemId: string, noteId: string): void {
  if (!isStorageAvailable()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all: Record<string, { id: string; text: string; createdAt: string }[]> = JSON.parse(raw);
    const list = (all[itemId] ?? []).filter((n) => n.id !== noteId);
    if (list.length) all[itemId] = list;
    else delete all[itemId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function parsePlanId(id: string): { subject_code: string; grade: number; academic_year: string; section: string } | null {
  const parts = decodeURIComponent(id || '').split(':');
  if (parts.length < 3) return null;
  const [subject_code, gradeStr, academic_year, section = ''] = parts;
  const grade = parseInt(gradeStr || '0', 10);
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) return null;
  return { subject_code, grade, academic_year, section };
}

function formatWeekLabel(item: PlanItem): string {
  if (item.hafta_label) return item.hafta_label;
  if (item.week_start && item.week_end) {
    try {
      const s = new Date(item.week_start + 'T12:00:00');
      const e = new Date(item.week_end + 'T12:00:00');
      const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return `${s.getDate()}-${e.getDate()} ${aylar[s.getMonth()]}`;
    } catch {
      return `${item.weekOrder}. Hafta`;
    }
  }
  return `${item.weekOrder}. Hafta`;
}

function KazanimNotesModal({
  open,
  onClose,
  item,
  dersName,
  weekLabel,
  onNotesChange,
}: {
  open: boolean;
  onClose: () => void;
  item: PlanItem | null;
  dersName: string;
  weekLabel: string;
  onNotesChange: () => void;
}) {
  const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (open && item) {
      setNotes(getNotes(item.id));
      setNewNote('');
    }
  }, [open, item]);

  const handleSave = () => {
    if (!item || !newNote.trim()) return;
    saveNote(item.id, newNote.trim());
    setNotes(getNotes(item.id));
    setNewNote('');
    onNotesChange();
  };

  const handleDelete = (noteId: string) => {
    if (!item) return;
    deleteNote(item.id, noteId);
    setNotes(getNotes(item.id));
    onNotesChange();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black/50 dark:bg-gray-900/80 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
        <div className="relative inline-block w-full max-w-lg transform rounded-xl bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:align-middle">
          <div className="px-4 py-3 bg-primary text-primary-foreground rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StickyNote className="size-5" />
                <div>
                  <h3 className="font-semibold">Kazanım Notları</h3>
                  <p className="text-xs opacity-90">{dersName}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/20 transition-colors">
                <span className="sr-only">Kapat</span>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                Mevcut Notlar <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{notes.length}</span>
              </h4>
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Henüz not eklenmemiş</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-lg bg-muted/50 dark:bg-muted/20 p-3">
                      <p className="text-sm">{n.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('tr-TR')}</span>
                        <button type="button" onClick={() => handleDelete(n.id)} className="text-xs text-destructive hover:underline">Sil</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3">Yeni Not Ekle</h4>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Bu kazanım ile ilgili notunuzu yazın…"
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 dark:bg-muted/20 border-t border-border rounded-b-xl">
            <span className="text-xs text-muted-foreground">{weekLabel}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">Kapat</button>
              <button type="button" onClick={handleSave} disabled={!newNote.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">Kaydet</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutcomeSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const { me, token } = useAuth();
  const id = typeof params?.id === 'string' ? params.id : '';
  const planKey = useMemo(() => parsePlanId(id), [id]);
  const [data, setData] = useState<PlanContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesModalItem, setNotesModalItem] = useState<PlanItem | null>(null);
  const [notesVersion, setNotesVersion] = useState(0);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const fetchData = useCallback(async () => {
    if (!token || !planKey || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        subject_code: planKey.subject_code,
        grade: String(planKey.grade),
        academic_year: planKey.academic_year,
      });
      if (planKey.section) query.set('section', planKey.section);
      const resp = await apiFetch<PlanContentResponse>(`/yillik-plan-icerik/teacher/plan-content?${query}`, { token });
      setData(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan yüklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, planKey, canManage]);

  useEffect(() => {
    if (me && !canManage) {
      router.replace('/403');
      return;
    }
  }, [me, canManage, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const items = data?.items ?? [];
  const byWeek = items.reduce<Map<number, PlanItem[]>>((acc, item) => {
    const w = item.weekOrder;
    if (!acc.has(w)) acc.set(w, []);
    acc.get(w)!.push(item);
    return acc;
  }, new Map());
  const weekOrder = Array.from(byWeek.keys()).sort((a, b) => a - b);

  useEffect(() => {
    if (weekOrder.length > 0 && activeTab === null) setActiveTab(weekOrder[0]);
  }, [weekOrder, activeTab]);

  useEffect(() => {
    const container = tabScrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('.active-hafta');
    if (activeBtn) {
      const rect = activeBtn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollLeft = (activeBtn as HTMLElement).offsetLeft - containerRect.width / 2 + rect.width / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [activeTab]);

  const openNotesModal = (item: PlanItem) => {
    setNotesModalItem(item);
    setNotesModalOpen(true);
  };

  const editPlanUrl = planKey
    ? `/yillik-plan-icerik?subject_code=${encodeURIComponent(planKey.subject_code)}&grade=${planKey.grade}&academic_year=${encodeURIComponent(planKey.academic_year)}${planKey.section ? `&section=${encodeURIComponent(planKey.section)}` : ''}`
    : '/yillik-plan-icerik';

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Plan yükleniyor…" />
      </div>
    );
  }

  if (error || !data || !planKey) {
    return (
      <div className="space-y-4 px-4 py-8">
        <Link href="/outcome-sets" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" />
          Kazanım Setlerine dön
        </Link>
        <div className="rounded-xl border border-border bg-card p-8">
          <EmptyState
            icon={<BookOpen className="size-10 text-muted-foreground" />}
            title="Plan bulunamadı"
            description={error ?? (planKey ? 'Bu plan mevcut değil veya erişim yetkiniz yok.' : 'Geçersiz plan adresi.')}
            action={
              <Link href="/outcome-sets" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <ArrowLeft className="size-4" />
                Listeye dön
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const dersLabel = `${data.subject_label} · ${data.grade}. Sınıf · ${data.academic_year}${data.section ? ` · ${data.section}` : ''}`;

  function SectionCard({ icon: Icon, title, children, gradient }: { icon: React.ElementType; title: string; children: React.ReactNode; gradient: string }) {
    return (
      <div className={`flex gap-3 px-4 py-3 bg-linear-to-r ${gradient} border-b border-gray-100 dark:border-gray-700`}>
        <div className="shrink-0 size-9 rounded-lg bg-opacity-20 flex items-center justify-center">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold">{title}</h4>
          <div className="text-xs sm:text-sm text-foreground mt-0.5 prose dark:prose-invert max-w-none [&_p]:mb-1">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/outcome-sets" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="size-4" />
            Geri
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{dersLabel}</h1>
            <p className="text-sm text-muted-foreground">Yıllık plan içeriği · {items.length} satır</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={editPlanUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            Yıllık Plan İçeriklerinde Düzenle
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        {weekOrder.length > 0 && (
          <div className="kazanim-takip relative bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
            <div ref={tabScrollRef} className="overflow-x-auto hide-scrollbar tab-nav-scroll px-2">
              <nav className="flex gap-1 min-w-max border-b-2 border-gray-200 dark:border-gray-700">
                {weekOrder.map((week) => {
                  const first = byWeek.get(week)?.[0];
                  const label = first ? formatWeekLabel(first) : `${week}. Hafta`;
                  const isActive = activeTab === week;
                  return (
                    <button
                      key={week}
                      type="button"
                      onClick={() => setActiveTab(week)}
                      className={`group relative inline-flex items-center gap-1.5 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                        isActive ? 'text-primary active-hafta' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={<BookOpen className="size-10 text-muted-foreground" />} title="İçerik yok" description="Bu plan için henüz haftalık içerik eklenmemiş. Yıllık Plan İçerikleri sayfasından ekleyin." />
            </div>
          ) : (
            weekOrder.map((week) => {
              const list = byWeek.get(week) ?? [];
              if (activeTab !== week) return null;

              return (
                <div key={week} className="space-y-4">
                  {list.map((item) => {
                    const itemNotes = getNotes(item.id);
                    return (
                      <div key={item.id} className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
                        <div className="flex flex-wrap justify-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => openNotesModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                          >
                            <StickyNote className="size-4" />
                            <span className="hidden sm:inline">Notlar</span>
                            {itemNotes.length > 0 && <span className="rounded-full bg-primary/20 px-1.5 text-xs">{itemNotes.length}</span>}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {item.unite && (
                            <SectionCard icon={Target} title="Ünite / Tema" gradient="from-violet-50 to-transparent dark:from-violet-900/20">
                              <p>{item.unite}</p>
                            </SectionCard>
                          )}
                          {item.konu && (
                            <SectionCard icon={BookOpen} title="Konu" gradient="from-blue-50 to-transparent dark:from-blue-900/20">
                              <p>{item.konu}</p>
                            </SectionCard>
                          )}
                          {item.kazanimlar && (
                            <SectionCard icon={Target} title="Öğrenme Çıktısı (Kazanımlar)" gradient="from-amber-50 to-transparent dark:from-amber-900/20">
                              <p className="whitespace-pre-wrap">{item.kazanimlar}</p>
                            </SectionCard>
                          )}
                          {item.surecBilesenleri && (
                            <SectionCard icon={Target} title="Süreç Bileşenleri" gradient="from-cyan-50 to-transparent dark:from-cyan-900/20">
                              <p className="whitespace-pre-wrap">{item.surecBilesenleri}</p>
                            </SectionCard>
                          )}
                          {(item.dersSaati != null && item.dersSaati > 0) && (
                            <div className="flex gap-3 px-4 py-3 bg-linear-to-r from-emerald-50 to-transparent dark:from-emerald-900/20">
                              <div className="shrink-0 size-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Target className="size-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <h4 className="text-xs sm:text-sm font-bold">Ders Saati</h4>
                                <p className="text-sm">{item.dersSaati}</p>
                              </div>
                            </div>
                          )}
                          {item.belirliGunHaftalar && (
                            <SectionCard icon={Target} title="Belirli Gün ve Haftalar" gradient="from-fuchsia-50 to-transparent dark:from-fuchsia-900/20">
                              <p>{item.belirliGunHaftalar}</p>
                            </SectionCard>
                          )}
                          {item.olcmeDegerlendirme && (
                            <SectionCard icon={Target} title="Ölçme ve Değerlendirme" gradient="from-orange-50 to-transparent dark:from-orange-900/20">
                              <p className="whitespace-pre-wrap">{item.olcmeDegerlendirme}</p>
                            </SectionCard>
                          )}
                          {item.sosyalDuygusal && (
                            <SectionCard icon={Target} title="Sosyal-Duygusal Beceriler" gradient="from-pink-50 to-transparent dark:from-pink-900/20">
                              <p className="whitespace-pre-wrap">{item.sosyalDuygusal}</p>
                            </SectionCard>
                          )}
                          {item.degerler && (
                            <SectionCard icon={Target} title="Değerler" gradient="from-purple-50 to-transparent dark:from-purple-900/20">
                              <p className="whitespace-pre-wrap">{item.degerler}</p>
                            </SectionCard>
                          )}
                          {item.okuryazarlikBecerileri && (
                            <SectionCard icon={Target} title="Okuryazarlık Becerileri" gradient="from-rose-50 to-transparent dark:from-rose-900/20">
                              <p className="whitespace-pre-wrap">{item.okuryazarlikBecerileri}</p>
                            </SectionCard>
                          )}
                          {item.zenginlestirme && (
                            <SectionCard icon={Target} title="Farklılaştırma (Zenginleştirme)" gradient="from-teal-50 to-transparent dark:from-teal-900/20">
                              <p className="whitespace-pre-wrap">{item.zenginlestirme}</p>
                            </SectionCard>
                          )}
                          {item.okulTemelliPlanlama && (
                            <SectionCard icon={Target} title="Okul Temelli Planlama" gradient="from-indigo-50 to-transparent dark:from-indigo-900/20">
                              <p className="whitespace-pre-wrap">{item.okulTemelliPlanlama}</p>
                            </SectionCard>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      <KazanimNotesModal
        open={notesModalOpen}
        onClose={() => { setNotesModalOpen(false); setNotesModalItem(null); }}
        item={notesModalItem}
        dersName={dersLabel}
        weekLabel={notesModalItem ? formatWeekLabel(notesModalItem) : ''}
        onNotesChange={() => setNotesVersion((v) => v + 1)}
      />
    </div>
  );
}
