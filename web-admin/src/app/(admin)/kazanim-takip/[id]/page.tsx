'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Target,
  BookOpen,
  ArrowLeft,
  Home,
  ChevronRight,
  ChevronLeft,
  StickyNote,
  Calendar,
  Search,
  Download,
  CheckCircle2,
  Circle,
  X,
} from 'lucide-react';
import { addSonPlan, setKaldiginYer, getKazanimDurum, toggleKazanimDurum } from '../kazanim-storage';

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

function findWeekForToday(items: PlanItem[]): number | null {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  for (const item of items) {
    if (item.week_start && item.week_end) {
      if (todayStr >= item.week_start && todayStr <= item.week_end) return item.weekOrder;
    }
  }
  return null;
}

function findNearestWeek(items: PlanItem[]): number | null {
  const todayStr = new Date().toISOString().slice(0, 10);
  let lastPast: number | null = null;
  let firstFuture: number | null = null;
  for (const item of items) {
    if (!item.week_start || !item.week_end) continue;
    if (item.week_end < todayStr) lastPast = item.weekOrder;
    if (item.week_start > todayStr && firstFuture == null) firstFuture = item.weekOrder;
  }
  return lastPast ?? firstFuture ?? null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Türkçe karakterleri normalize et – büyük/küçük harf + geniş arama (ü→u, ö→o, ğ→g, ş→s, ç→c, ı/i→i) */
function normalizeForSearch(s: string): string {
  const lower = s.toLocaleLowerCase('tr-TR');
  return lower
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ı/g, 'i');
}

/** Aranacak metin içinde terim var mı – Türkçe geniş arama ile */
function textContainsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  return normalizeForSearch(text).includes(normalizeForSearch(term));
}

/** API camelCase veya snake_case dönebilir; her iki key'i dene */
function getItemField(item: Record<string, unknown>, camelKey: string): string | null {
  const val = item[camelKey] ?? item[camelKey.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)];
  return typeof val === 'string' ? val : null;
}

/** İtemdeki tüm string alanlarını topla – API farklı key isimleri kullanabilir */
function getAllSearchableText(item: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (k === 'id' || typeof v !== 'string') continue;
    const s = v.trim();
    if (s.length > 0 && !/^[\d\s\-:./]+$/.test(s)) parts.push(s);
  }
  return parts.join(' ');
}

/** Aranacak tüm metin alanları */
const SEARCH_FIELDS = [
  { key: 'unite', label: 'Ünite/Tema' },
  { key: 'konu', label: 'Konu' },
  { key: 'kazanimlar', label: 'Kazanımlar' },
  { key: 'surecBilesenleri', label: 'Süreç Bileşenleri' },
  { key: 'olcmeDegerlendirme', label: 'Ölçme Değerlendirme' },
  { key: 'belirliGunHaftalar', label: 'Belirli Gün/Haftalar' },
  { key: 'sosyalDuygusal', label: 'Sosyal Duygusal' },
  { key: 'degerler', label: 'Değerler' },
  { key: 'okuryazarlikBecerileri', label: 'Okuryazarlık Becerileri' },
  { key: 'zenginlestirme', label: 'Zenginleştirme' },
  { key: 'okulTemelliPlanlama', label: 'Okul Temelli Planlama' },
] as const;

function itemMatchesSearch(item: Record<string, unknown>, q: string): boolean {
  if (!q || !q.trim()) return true;
  const qn = normalizeForSearch(q.trim());
  const allText = getAllSearchableText(item);
  if (allText && normalizeForSearch(allText).includes(qn)) return true;
  for (const { key } of SEARCH_FIELDS) {
    const val = getItemField(item, key);
    if (val && textContainsTerm(val, q)) return true;
  }
  return false;
}

/** Türkçe geniş arama için karakter sınıfı: i/ı/İ/I, u/ü/Ü/U, o/ö/Ö/O, g/ğ/Ğ/G, s/ş/Ş/S, c/ç/Ç/C */
function termToRegexPattern(term: string): string {
  const map: Record<string, string> = {
    i: '[iIıİ]', ı: '[iIıİ]', I: '[iIıİ]', İ: '[iIıİ]',
    u: '[uUüÜ]', ü: '[uUüÜ]', U: '[uUüÜ]', Ü: '[uUüÜ]',
    o: '[oOöÖ]', ö: '[oOöÖ]', O: '[oOöÖ]', Ö: '[oOöÖ]',
    g: '[gGğĞ]', ğ: '[gGğĞ]', G: '[gGğĞ]', Ğ: '[gGğĞ]',
    s: '[sSşŞ]', ş: '[sSşŞ]', S: '[sSşŞ]', Ş: '[sSşŞ]',
    c: '[cCçÇ]', ç: '[cCçÇ]', C: '[cCçÇ]', Ç: '[cCçÇ]',
  };
  return term
    .split('')
    .map((c) => map[c] ?? escapeRegExp(c))
    .join('');
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term || !term.trim()) return text;
  const pattern = termToRegexPattern(term.trim());
  const regex = new RegExp(`(${pattern})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 rounded px-0.5 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
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

function BlurBackground() {
  return (
    <>
      <div className="dark:hidden fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300/40 rounded-full blur-2xl" />
        <div className="absolute -top-20 right-0 w-96 h-96 bg-blue-300/30 rounded-full blur-2xl" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-2xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-200/40 rounded-full blur-2xl" />
        <div className="absolute bottom-20 -left-20 w-64 h-64 bg-indigo-200/30 rounded-full blur-2xl" />
      </div>
      <div className="hidden dark:block fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-2xl" />
        <div className="absolute -top-20 right-0 w-96 h-96 bg-blue-600/15 rounded-full blur-2xl" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-500/15 rounded-full blur-2xl" />
        <div className="absolute bottom-20 -left-20 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl" />
      </div>
    </>
  );
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
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>
        <div className="relative inline-block w-full max-w-lg transform rounded-xl bg-white dark:bg-gray-800 text-left shadow-2xl ring-4 ring-amber-400/20 dark:ring-amber-500/20 transition-all sm:align-middle">
          <div className="px-4 py-4 bg-linear-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/20">
                  <StickyNote className="size-6" />
                </span>
                <div>
                  <h3 className="font-bold text-lg">Kazanım Notları</h3>
                  <p className="text-sm opacity-95">{dersName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 hover:bg-white/20 transition-colors"
              >
                <span className="sr-only">Kapat</span>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                Mevcut Notlar
                {notes.length > 0 && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2.5 py-0.5 text-xs font-bold border border-amber-200 dark:border-amber-700">
                    {notes.length}
                  </span>
                )}
              </h4>
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Henüz not eklenmemiş</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-amber-200/60 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                      <p className="text-sm">{n.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(n.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-300">
                <span className="flex size-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <StickyNote className="size-3.5" />
                </span>
                Yeni Not Ekle
              </h4>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                className="w-full rounded-lg border-2 border-amber-200/60 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-900/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                placeholder="Sınıf bilgisi ve bu kazanım ile ilgili notunuzu yazın…"
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 dark:bg-muted/20 border-t border-border rounded-b-xl">
            <span className="text-xs text-muted-foreground">{weekLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Kapat
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!newNote.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KazanimTakipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [arama, setArama] = useState('');
  const [kazanimDurumVersion, setKazanimDurumVersion] = useState(0);

  const isTeacher = me?.role === 'teacher';

  const fetchData = useCallback(async () => {
    if (!token || !planKey || !isTeacher) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        subject_code: planKey.subject_code,
        grade: String(planKey.grade),
        academic_year: planKey.academic_year,
      });
      if (planKey.section) query.set('section', planKey.section);
      const resp = await apiFetch<PlanContentResponse>(
        `/yillik-plan-icerik/teacher/plan-content?${query}`,
        { token }
      );
      setData(resp);
      const label = `${resp.subject_label} · ${resp.grade}. Sınıf · ${resp.academic_year}${resp.section ? ` (${resp.section})` : ''}`;
      addSonPlan(id, label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan yüklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, planKey, isTeacher, id]);

  useEffect(() => {
    if (me && !isTeacher) {
      router.replace('/dashboard');
      return;
    }
  }, [me, isTeacher, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const items = useMemo(() => {
    const raw = data?.items ?? [];
    return raw.map((item) => {
      const anyItem = item as unknown as Record<string, unknown>;
      const weekOrderRaw = anyItem.weekOrder ?? anyItem.week_order;
      const weekOrder =
        typeof weekOrderRaw === 'number'
          ? weekOrderRaw
          : parseInt(String(weekOrderRaw ?? ''), 10);
      return {
        ...(item as PlanItem),
        weekOrder: Number.isFinite(weekOrder) ? weekOrder : 0,
        hafta_label: (anyItem.hafta_label ?? anyItem.haftaLabel) as string | undefined,
        week_start: (anyItem.week_start ?? anyItem.weekStart) as string | null | undefined,
        week_end: (anyItem.week_end ?? anyItem.weekEnd) as string | null | undefined,
      } satisfies PlanItem;
    });
  }, [data?.items]);
  const byWeek = items.reduce<Map<number, PlanItem[]>>((acc, item) => {
    const w = item.weekOrder;
    if (!acc.has(w)) acc.set(w, []);
    acc.get(w)!.push(item);
    return acc;
  }, new Map());
  const weekOrder = Array.from(byWeek.keys()).sort((a, b) => a - b);

  const calendarProgress = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const seen = new Set<number>();
    let weeksPassed = 0;
    for (const item of items) {
      if (item.week_end && item.week_end < todayStr && !seen.has(item.weekOrder)) {
        seen.add(item.weekOrder);
        weeksPassed += 1;
      }
    }
    const total = weekOrder.length || 1;
    const pct = Math.round((weeksPassed / total) * 100);
    return { weeksPassed, total, geçenPct: pct, kalanPct: 100 - pct };
  }, [items, weekOrder]);

  const weekParam = searchParams.get('week');

  useEffect(() => {
    if (weekOrder.length > 0 && activeTab === null) {
      const weekNum = weekParam ? parseInt(weekParam, 10) : null;
      const validWeek = weekNum && weekOrder.includes(weekNum) ? weekNum : null;
      const todayWeek = findWeekForToday(items);
      const nearest = findNearestWeek(items);
      setActiveTab(validWeek ?? todayWeek ?? nearest ?? weekOrder[0]);
    }
  }, [weekOrder, activeTab, items, weekParam]);

  useEffect(() => {
    if (activeTab != null && data) {
      const label = `${data.subject_label} · ${data.grade}. Sınıf · ${data.academic_year}${data.section ? ` (${data.section})` : ''}`;
      setKaldiginYer(id, label, activeTab);
    }
  }, [activeTab, id, data]);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (weekOrder.length === 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = weekOrder.indexOf(activeTab ?? 0);
        if (idx > 0) setActiveTab(weekOrder[idx - 1]!);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = weekOrder.indexOf(activeTab ?? 0);
        if (idx >= 0 && idx < weekOrder.length - 1) setActiveTab(weekOrder[idx + 1]!);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, weekOrder]);

  const kazanimDurum = getKazanimDurum();
  const highlightTerm = arama;
  const filteredListForWeek = useMemo(() => {
    const list = activeTab != null ? byWeek.get(activeTab) ?? [] : [];
    const q = highlightTerm.trim();
    if (!q) return list;
    return list.filter((item) => itemMatchesSearch(item as Record<string, unknown>, q));
  }, [activeTab, byWeek, highlightTerm]);

  type IcerikSearchHit = { item: PlanItem; weekOrder: number; weekLabel: string; matchIn: string };
  const icerikSearchResults = useMemo((): IcerikSearchHit[] => {
    if (!arama.trim()) return [];
    const q = arama.trim();
    const results: IcerikSearchHit[] = [];
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      if (!itemMatchesSearch(rec, q)) continue;
      const first = byWeek.get(item.weekOrder)?.[0];
      const weekLabel = first ? formatWeekLabel(first) : `${item.weekOrder}. Hafta`;
      let matchIn = 'İçerik';
      for (const { key, label } of SEARCH_FIELDS) {
        const val = getItemField(rec, key);
        if (val && textContainsTerm(val, q)) {
          matchIn = label;
          break;
        }
      }
      results.push({ item, weekOrder: item.weekOrder, weekLabel, matchIn });
    }
    return results;
  }, [items, byWeek, arama]);

  const openNotesModal = (item: PlanItem) => {
    setNotesModalItem(item);
    setNotesModalOpen(true);
  };

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
      <div className="kazanim-takip relative min-h-screen bg-gray-50 dark:bg-gray-900">
        <BlurBackground />
        <div className="px-4 py-8 max-w-2xl mx-auto">
          <div className="rounded-xl border border-border bg-card shadow-sm p-8">
            <EmptyState
              icon={<BookOpen className="size-10 text-muted-foreground" />}
              title="Plan bulunamadı"
              description={error ?? (planKey ? 'Bu plan mevcut değil veya erişim yetkiniz yok.' : 'Geçersiz plan adresi.')}
              action={
                <Link
                  href="/kazanim-takip"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowLeft className="size-4" />
                  Listeye dön
                </Link>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const dersLabel = `${data.subject_label} · ${data.grade}. Sınıf · ${data.academic_year}`;

  function SectionCard({ icon: Icon, title, children, gradient }: { icon: React.ElementType; title: string; children: React.ReactNode; gradient: string }) {
    return (
      <div className={`flex gap-3 px-4 py-3 bg-linear-to-r ${gradient} border-b border-gray-100 dark:border-gray-700`}>
        <div className="shrink-0 size-9 rounded-lg bg-opacity-20 flex items-center justify-center">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold">{title}</h4>
          <div className="text-xs sm:text-sm text-foreground mt-0.5 prose dark:prose-invert max-w-none [&_p]:mb-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kazanim-takip relative min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <BlurBackground />

      <div className="px-2 sm:px-4 lg:px-8 py-4 max-w-[1200px] mx-auto">
        <nav className="flex justify-center mb-4 sm:mb-6">
          <ol className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full text-xs">
            <li>
              <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                <Home className="size-4 inline" />
              </Link>
            </li>
            <li className="text-muted-foreground/50"><ChevronRight className="size-3 inline" /></li>
            <li>
              <Link href="/kazanim-takip" className="text-muted-foreground hover:text-primary transition-colors">Kazanım Takip</Link>
            </li>
            <li className="text-muted-foreground/50"><ChevronRight className="size-3 inline" /></li>
            <li className="font-medium text-primary">{dersLabel}</li>
          </ol>
        </nav>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="size-5 text-primary shrink-0" />
                <span className="line-clamp-1">{dersLabel}</span>
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href={(() => {
                    const q = new URLSearchParams({
                      grade: String(data?.grade ?? ''),
                      subject_code: data?.subject_code ?? '',
                      academic_year: data?.academic_year ?? '',
                    });
                    if (data?.section) q.set('section', data.section);
                    return `/evrak?${q.toString()}`;
                  })()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  <Download className="size-4" />
                  Excel İndirme
                </Link>
                <Link
                  href="/kazanim-takip"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  Listeye dön
                </Link>
              </div>
            </div>
          </div>

          {/* Akademik Takvim / İlerleme widget */}
          {weekOrder.length > 0 && (
            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">
                    Geçen: <span className="font-semibold text-foreground">{calendarProgress.geçenPct}%</span>
                    {' · '}
                    Kalan: <span className="font-semibold text-foreground">{calendarProgress.kalanPct}%</span>
                  </span>
                </div>
                <div className="flex-1 min-w-[120px] max-w-[200px] h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${calendarProgress.geçenPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {calendarProgress.weeksPassed} / {calendarProgress.total} hafta
                </span>
              </div>
            </div>
          )}

          {weekOrder.length > 0 && (
            <div className="relative bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative flex items-center gap-2 min-w-0 flex-1 max-w-md">
                  <Search className="size-4 text-primary shrink-0" />
                  <input
                    type="text"
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                    placeholder="Ünite, tema, konu veya kazanım metninde ara… (tüm planda)"
                    className="flex-1 min-w-0 py-2 pl-3 pr-9 rounded-xl border border-primary/40 dark:border-primary/50 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    aria-label="Plan içeriğinde ara"
                  />
                  {arama && (
                    <button
                      type="button"
                      onClick={() => setArama('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                      aria-label="Temizle"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {arama.trim() && (
                  <div className="w-full px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {icerikSearchResults.length > 0
                        ? `${icerikSearchResults.length} sonuç – tıklayarak ilgili haftaya gidin`
                        : 'Bu terim plan içeriğinde bulunamadı'}
                    </p>
                    {icerikSearchResults.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {icerikSearchResults.map((hit) => (
                          <button
                            key={hit.item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(hit.weekOrder);
                            }}
                            className="inline-flex flex-col items-start text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                          >
                            <span className="font-semibold text-primary">
                              {hit.weekLabel}
                              {hit.matchIn ? ` · ${hit.matchIn}` : ''}
                            </span>
                            <span className="line-clamp-2 text-muted-foreground mt-0.5 max-w-[220px]">
                              {(() => {
                                const rec = hit.item as Record<string, unknown>;
                                const u = getItemField(rec, 'unite');
                                const k = getItemField(rec, 'konu');
                                return u ? `${u} › ${k ?? '-'}` : (k ?? '-');
                              })()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1" title="Önceki/Sonraki hafta (← →)">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = weekOrder.indexOf(activeTab ?? 0);
                      if (idx > 0) setActiveTab(weekOrder[idx - 1]!);
                    }}
                    disabled={weekOrder.indexOf(activeTab ?? 0) <= 0}
                    className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                    aria-label="Önceki hafta"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = weekOrder.indexOf(activeTab ?? 0);
                      if (idx >= 0 && idx < weekOrder.length - 1) setActiveTab(weekOrder[idx + 1]!);
                    }}
                    disabled={weekOrder.indexOf(activeTab ?? 0) >= weekOrder.length - 1}
                    className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                    aria-label="Sonraki hafta"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
              <div ref={tabScrollRef} className="overflow-x-auto hide-scrollbar tab-nav-scroll px-2 sm:px-0">
                <nav className="flex gap-1 min-w-max border-b-2 border-gray-200 dark:border-gray-700">
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    return weekOrder.map((week) => {
                      const first = byWeek.get(week)?.[0];
                      const label = first ? formatWeekLabel(first) : `${week}. Hafta`;
                      const isActive = activeTab === week;
                      const isThisWeek =
                        first?.week_start && first?.week_end && todayStr >= first.week_start && todayStr <= first.week_end;
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
                        {isThisWeek && (
                          <span className="hidden sm:inline-flex text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                            Bu hafta
                          </span>
                        )}
                        <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-gray-300 dark:group-hover:bg-gray-600'}`} />
                      </button>
                    );
                    });
                  })()}
                </nav>
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            {items.length === 0 ? (
              <div className="py-16">
                <EmptyState icon={<BookOpen className="size-10 text-muted-foreground" />} title="İçerik yok" description="Bu plan için henüz haftalık içerik eklenmemiş." />
              </div>
            ) : (
              weekOrder.map((week) => {
                if (activeTab !== week) return null;
                const list = filteredListForWeek;
                const first = byWeek.get(week)?.[0];
                const weekLabel = first ? formatWeekLabel(first) : `${week}. Hafta`;

                return (
                  <div key={week} className="space-y-4">
                    {list.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {highlightTerm.trim() ? 'Arama kriterine uygun kazanım bulunamadı.' : 'Bu hafta için içerik yok.'}
                      </p>
                    ) : (
                    list.map((item) => {
                      const rec = item as Record<string, unknown>;
                      const itemNotes = getNotes(item.id);
                      const tamamlandi = kazanimDurum[item.id];
                      return (
                        <div key={item.id} className={`rounded-xl border overflow-hidden shadow-sm transition-colors ${tamamlandi ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50'}`}>
                          <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={() => {
                                toggleKazanimDurum(item.id);
                                setKazanimDurumVersion((v) => v + 1);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                                tamamlandi ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-700 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                              title={tamamlandi ? 'Tamamlandı olarak işaretlendi' : 'Tamamlandı olarak işaretle'}
                            >
                              {tamamlandi ? <CheckCircle2 className="size-4 fill-emerald-500" /> : <Circle className="size-4" />}
                              <span>{tamamlandi ? 'Tamamlandı' : 'İşaretle'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openNotesModal(item)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                                itemNotes.length > 0
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300/60 dark:border-amber-600/50 hover:bg-amber-200 dark:hover:bg-amber-900/60 shadow-sm ring-1 ring-amber-400/30 dark:ring-amber-500/30'
                                  : 'bg-muted hover:bg-muted/80'
                              }`}
                            >
                              <StickyNote className={`size-4 ${itemNotes.length > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                              <span className="hidden sm:inline">Notlar</span>
                              {itemNotes.length > 0 && (
                                <span className="rounded-full bg-amber-500 dark:bg-amber-500 text-white px-2 py-0.5 text-xs font-bold min-w-[20px] text-center ring-2 ring-amber-400/50 dark:ring-amber-500/50 shadow-sm">
                                  {itemNotes.length}
                                </span>
                              )}
                            </button>
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {getItemField(rec, 'unite') && (
                              <SectionCard icon={Target} title="Ünite / Tema" gradient="from-violet-50 to-transparent dark:from-violet-900/20">
                                <p>{highlightText(getItemField(rec, 'unite') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'konu') && (
                              <SectionCard icon={BookOpen} title="Konu" gradient="from-blue-50 to-transparent dark:from-blue-900/20">
                                <p>{highlightText(getItemField(rec, 'konu') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'kazanimlar') && (
                              <SectionCard icon={Target} title="Öğrenme Çıktısı (Kazanımlar)" gradient="from-amber-50 to-transparent dark:from-amber-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'kazanimlar') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'surecBilesenleri') && (
                              <SectionCard icon={Target} title="Süreç Bileşenleri" gradient="from-cyan-50 to-transparent dark:from-cyan-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'surecBilesenleri') ?? '', highlightTerm)}</p>
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
                            {getItemField(rec, 'belirliGunHaftalar') && (
                              <SectionCard icon={Target} title="Belirli Gün ve Haftalar" gradient="from-fuchsia-50 to-transparent dark:from-fuchsia-900/20">
                                <p>{highlightText(getItemField(rec, 'belirliGunHaftalar') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'olcmeDegerlendirme') && (
                              <SectionCard icon={Target} title="Ölçme ve Değerlendirme" gradient="from-orange-50 to-transparent dark:from-orange-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'olcmeDegerlendirme') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'sosyalDuygusal') && (
                              <SectionCard icon={Target} title="Sosyal-Duygusal Beceriler" gradient="from-pink-50 to-transparent dark:from-pink-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'sosyalDuygusal') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'degerler') && (
                              <SectionCard icon={Target} title="Değerler" gradient="from-purple-50 to-transparent dark:from-purple-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'degerler') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'okuryazarlikBecerileri') && (
                              <SectionCard icon={Target} title="Okuryazarlık Becerileri" gradient="from-rose-50 to-transparent dark:from-rose-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'okuryazarlikBecerileri') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'zenginlestirme') && (
                              <SectionCard icon={Target} title="Farklılaştırma (Zenginleştirme)" gradient="from-teal-50 to-transparent dark:from-teal-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'zenginlestirme') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                            {getItemField(rec, 'okulTemelliPlanlama') && (
                              <SectionCard icon={Target} title="Okul Temelli Planlama" gradient="from-indigo-50 to-transparent dark:from-indigo-900/20">
                                <p className="whitespace-pre-wrap">{highlightText(getItemField(rec, 'okulTemelliPlanlama') ?? '', highlightTerm)}</p>
                              </SectionCard>
                            )}
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                );
              })
            )}
          </div>
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
