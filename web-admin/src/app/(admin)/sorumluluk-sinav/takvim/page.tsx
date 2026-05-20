'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { CalendarDays, Plus, Trash2, Save, Sparkles, MapPin, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { TakvimQuickBuilder, type GeneratedSlot } from './takvim-quick-builder';
type Slot = {
  id?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
  capacity: number;
  sortOrder: number;
  label: string | null;
};

type DraftSlot = Slot & { _key: string };

const EMPTY_DRAFT = (): DraftSlot => ({
  _key: crypto.randomUUID(),
  sessionDate: '',
  startTime: '08:30',
  endTime: '09:10',
  roomName: null,
  capacity: 30,
  sortOrder: 0,
  label: '1. Ders',
});

function trimTime(t: string) {
  return t?.slice(0, 5) ?? '';
}

function groupByDate(slots: DraftSlot[]) {
  const map = new Map<string, DraftSlot[]>();
  for (const s of slots) {
    const k = s.sessionDate || 'Tarihsiz';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.sortOrder - b.sortOrder));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function slotTitle(slot: DraftSlot) {
  if (slot.label?.trim()) return slot.label.trim();
  return `${slot.startTime}–${slot.endTime}`;
}

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 px-3 py-10 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20 sm:gap-3 sm:rounded-2xl sm:py-16">
    <CalendarDays className="size-10 text-indigo-400" strokeWidth={1.25} />
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir sınav grubu seçin veya oluşturun.</p>
  </div>
);

export default function TakvimPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [drafts, setDrafts] = useState<DraftSlot[]>([]);
  const [loading, setLoading] = useState(!!groupId);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editKey, setEditKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<Slot[]>(`/sorumluluk-exam/groups/${groupId}/slots${schoolQ}`, { token });
      setDrafts(
        data.map((s, i) => ({
          _key: s.id ?? crypto.randomUUID(),
          id: s.id,
          sessionDate: s.sessionDate?.slice(0, 10) ?? '',
          startTime: trimTime(s.startTime),
          endTime: trimTime(s.endTime),
          roomName: s.roomName,
          capacity: s.capacity ?? 30,
          sortOrder: s.sortOrder ?? i,
          label: s.label,
        })),
      );
    } catch {
      toast.error('Takvim yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, groupId, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const valid = drafts.filter((d) => d.sessionDate && d.startTime && d.endTime);
    if (!valid.length) return toast.error('En az bir geçerli slot ekleyin (tarih + saat)');
    for (const d of valid) {
      if (d.startTime >= d.endTime) return toast.error('Bitiş saati başlangıçtan sonra olmalı');
    }
    setSaving(true);
    try {
      const saved = await apiFetch<Slot[]>(`/sorumluluk-exam/groups/${groupId}/slots${schoolQ}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          slots: valid.map((d, i) => ({
            sessionDate: d.sessionDate,
            startTime: d.startTime,
            endTime: d.endTime,
            roomName: d.roomName?.trim() || undefined,
            capacity: Number(d.capacity) || 30,
            sortOrder: i,
            label: d.label?.trim() || undefined,
          })),
        }),
      });
      setDrafts(
        saved.map((s, i) => ({
          _key: s.id ?? `saved-${i}`,
          id: s.id,
          sessionDate: s.sessionDate?.slice(0, 10) ?? '',
          startTime: trimTime(s.startTime),
          endTime: trimTime(s.endTime),
          roomName: s.roomName,
          capacity: s.capacity ?? 30,
          sortOrder: s.sortOrder ?? i,
          label: s.label,
        })),
      );
      toast.success('Takvim kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const applyToSessions = async () => {
    const valid = drafts.filter((d) => d.sessionDate && d.startTime && d.endTime);
    if (!valid.length) return toast.error('Önce en az bir slot tanımlayın');
    setApplying(true);
    try {
      await apiFetch<Slot[]>(`/sorumluluk-exam/groups/${groupId}/slots${schoolQ}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          slots: valid.map((d, i) => ({
            sessionDate: d.sessionDate,
            startTime: d.startTime,
            endTime: d.endTime,
            roomName: d.roomName?.trim() || undefined,
            capacity: Number(d.capacity) || 30,
            sortOrder: i,
            label: d.label?.trim() || undefined,
          })),
        }),
      });
      const res = await apiFetch<{ created: number; skipped: string[]; slotsTotal: number }>(
        `/sorumluluk-exam/groups/${groupId}/sessions-from-slots${schoolQ}`,
        { method: 'POST', token },
      );
      if (res.created > 0) toast.success(`${res.created} oturum oluşturuldu`);
      if (res.skipped?.length) {
        toast.warning(`${res.skipped.length} ders için slot kalmadı: ${res.skipped.slice(0, 3).join(', ')}${res.skipped.length > 3 ? '…' : ''}`);
      }
      if (!res.created && !res.skipped?.length) toast.info('Yeni oturum gerekmedi (dersler zaten tanımlı)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oturumlar oluşturulamadı');
    } finally {
      setApplying(false);
    }
  };

  const applyQuickSlots = (generated: GeneratedSlot[], mode: 'replace' | 'append') => {
    const mapped: DraftSlot[] = generated.map((s, i) => ({
      _key: crypto.randomUUID(),
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      roomName: s.roomName,
      capacity: s.capacity,
      sortOrder: mode === 'append' ? drafts.length + i : i,
      label: s.label,
    }));
    setDrafts(mode === 'append' ? [...drafts, ...mapped] : mapped);
    const dates = new Set(mapped.map((m) => m.sessionDate));
    setExpanded((p) => {
      const next = { ...p };
      for (const d of dates) next[d] = true;
      return next;
    });
    toast.success(`${mapped.length} slot — Kaydet ile kaydedin`);
  };

  const grouped = useMemo(() => groupByDate(drafts), [drafts]);
  const oturumlarHref = `/sorumluluk-sinav/oturumlar${schoolQ ? schoolQ + '&' : '?'}group_id=${groupId}`;

  if (!groupId) return NO_GROUP;
  if (!isAdmin) {
    return (
      <p className="text-center text-sm text-muted-foreground py-10">Bu adım yalnızca okul yöneticisi içindir.</p>
    );
  }
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20 sm:p-4">
        <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
          <CalendarDays className="size-4 shrink-0" /> Sınav takvimi
        </p>
        <p className="text-[11px] text-rose-800/90 dark:text-rose-300/90 mt-1 leading-snug">
          Slotlar okul ders saatleriyle (1. ders, 2. ders…) üretilir. MEB import ve oturumlar bu sırayı kullanır.
        </p>
      </div>

      <TakvimQuickBuilder onApply={applyQuickSlots} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setDrafts((p) => [...p, { ...EMPTY_DRAFT(), sortOrder: p.length }])}>
          <Plus className="size-3.5" /> Tek slot
        </Button>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{drafts.length} slot</span>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={save} disabled={saving}>
          {saving ? <LoadingSpinner className="size-3.5" /> : <Save className="size-3.5" />}
          Kaydet
        </Button>
        <Button size="sm" variant="secondary" className="h-8 gap-1 text-xs" onClick={applyToSessions} disabled={applying || !drafts.length}>
          {applying ? <LoadingSpinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
          Oturumlara uygula
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          <p className="text-sm font-medium">Henüz slot yok</p>
          <p className="text-xs mt-1 opacity-70">Hızlı takvim ile ders saatlerinden üretin.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([date, daySlots]) => {
            const open = expanded[date] !== false;
            const label =
              date === 'Tarihsiz'
                ? 'Tarih seçilmemiş'
                : new Date(date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={date} className="rounded-lg border bg-white/90 dark:bg-zinc-900/70 overflow-hidden text-xs">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800/60 border-b text-left font-semibold text-slate-800 dark:text-slate-100"
                  onClick={() => setExpanded((p) => ({ ...p, [date]: !open }))}
                >
                  {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                  <span className="flex-1">{label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground tabular-nums">{daySlots.length} slot</span>
                </button>
                {open && (
                  <ul className="divide-y dark:divide-zinc-800">
                    {daySlots.map((slot) => {
                      const editing = editKey === slot._key;
                      return (
                        <li key={slot._key}>
                          {editing ? (
                            <div className="p-2 grid grid-cols-2 gap-1.5 sm:grid-cols-6 sm:items-end">
                              <div className="col-span-2 sm:col-span-1">
                                <label className="text-[9px] text-muted-foreground">Tarih</label>
                                <Input type="date" value={slot.sessionDate} className="h-7 text-[11px]"
                                  onChange={(e) => setDrafts((p) => p.map((x) => x._key === slot._key ? { ...x, sessionDate: e.target.value } : x))} />
                              </div>
                              <div>
                                <label className="text-[9px] text-muted-foreground">Başlangıç</label>
                                <Input type="time" value={slot.startTime} className="h-7 text-[11px]"
                                  onChange={(e) => setDrafts((p) => p.map((x) => x._key === slot._key ? { ...x, startTime: e.target.value } : x))} />
                              </div>
                              <div>
                                <label className="text-[9px] text-muted-foreground">Bitiş</label>
                                <Input type="time" value={slot.endTime} className="h-7 text-[11px]"
                                  onChange={(e) => setDrafts((p) => p.map((x) => x._key === slot._key ? { ...x, endTime: e.target.value } : x))} />
                              </div>
                              <div>
                                <label className="text-[9px] text-muted-foreground">Salon</label>
                                <Input placeholder="B-201" value={slot.roomName ?? ''} className="h-7 text-[11px]"
                                  onChange={(e) => setDrafts((p) => p.map((x) => x._key === slot._key ? { ...x, roomName: e.target.value || null } : x))} />
                              </div>
                              <div>
                                <label className="text-[9px] text-muted-foreground">Kap.</label>
                                <Input type="number" min={1} value={slot.capacity} className="h-7 text-[11px]"
                                  onChange={(e) => setDrafts((p) => p.map((x) => x._key === slot._key ? { ...x, capacity: Number(e.target.value) || 30 } : x))} />
                              </div>
                              <div className="col-span-2 sm:col-span-1 flex gap-1 justify-end">
                                <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditKey(null)}>Tamam</Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 cursor-pointer"
                              onClick={() => setEditKey(slot._key)}
                            >
                              <span className="font-semibold text-rose-800 dark:text-rose-300 w-[4.5rem] shrink-0 truncate">{slotTitle(slot)}</span>
                              <span className="tabular-nums text-muted-foreground shrink-0">{slot.startTime}–{slot.endTime}</span>
                              {slot.roomName ? (
                                <span className="truncate text-slate-600 dark:text-slate-400 flex items-center gap-0.5 min-w-0">
                                  <MapPin className="size-3 shrink-0 opacity-60" />
                                  {slot.roomName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 italic">salon yok</span>
                              )}
                              <span className="ml-auto flex items-center gap-1 text-muted-foreground shrink-0 tabular-nums">
                                <Users className="size-3 opacity-60" />
                                {slot.capacity}
                              </span>
                              <button
                                type="button"
                                className="p-1 text-muted-foreground hover:text-red-600 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDrafts((p) => p.filter((x) => x._key !== slot._key));
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        <Link href={oturumlarHref} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Oturumlar</Link>
        {' '}sekmesinde kontrol edin.
      </p>
    </div>
  );
}
