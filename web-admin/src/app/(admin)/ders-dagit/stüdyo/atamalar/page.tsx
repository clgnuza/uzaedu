'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

type Assignment = {
  id: string;
  subject_name: string;
  class_sections: string[];
  weekly_hours: number;
  teacher_ids?: string[];
  group_id?: string | null;
  room_ids?: string[];
  biweekly?: boolean;
  place_first?: boolean;
  min_days_per_week?: number | null;
  max_per_day?: number | null;
  fixed_slots?: Array<{ day_of_week: number; lesson_num: number; class_section?: string }>;
};

type Room = { id: string; name: string };
type SchoolPlan = { id: string; name: string | null; status: string };

type Group = {
  id: string;
  name: string;
  abbreviation: string;
  parallel_mode: string | null;
  member_sections: string[];
};
type GroupsRes = { groups: Group[] };
type Teacher = { user_id: string; display_name?: string };

export default function AtamalarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subject, setSubject] = useState('');
  const [sections, setSections] = useState('5A');
  const [hours, setHours] = useState(4);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [groupId, setGroupId] = useState('');
  const [biweekly, setBiweekly] = useState(false);
  const [placeFirst, setPlaceFirst] = useState(false);
  const [minDays, setMinDays] = useState(2);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [fixDay, setFixDay] = useState(1);
  const [fixLesson, setFixLesson] = useState(1);
  const [fixedSlots, setFixedSlots] = useState<
    Array<{ day_of_week: number; lesson_num: number; class_section?: string }>
  >([]);
  const [csvText, setCsvText] = useState('');

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [a, g, r, p, t, sub] = await Promise.all([
      apiFetch<Assignment[]>(`/ders-dagit/studios/${studio.id}/assignments`, { token }),
      apiFetch<GroupsRes>(`/ders-dagit/studios/${studio.id}/groups`, { token }),
      apiFetch<Room[]>('/ders-dagit/rooms', { token }),
      apiFetch<SchoolPlan[]>('/teacher-timetable/plans', { token }).catch(() => [] as SchoolPlan[]),
      apiFetch<Teacher[]>(`/ders-dagit/studios/${studio.id}/teachers`, { token }),
      apiFetch<Array<{ id: string; name: string }>>(`/ders-dagit/studios/${studio.id}/subjects`, { token }).catch(
        () => [],
      ),
    ]);
    setRows(a);
    setGroups(g.groups);
    setGroupId((prev) => prev || g.groups[0]?.id || '');
    setRooms(r);
    setPlans(p);
    setTeachers(t);
    setSubjects(sub);
    setRoomId((prev) => prev || r[0]?.id || '');
    setPlanId((prev) => prev || p[0]?.id || '');
    setTeacherIds((prev) => (prev.length ? prev : t[0]?.user_id ? [t[0].user_id] : []));
  }, [token, studio]);

  async function importFromPlan(replace: boolean) {
    if (!token || !studio || !planId) return;
    try {
      const res = await apiFetch<{ imported: number }>(
        `/ders-dagit/studios/${studio.id}/import-from-plan`,
        { token, method: 'POST', body: { plan_id: planId, replace } },
      );
      toast.success(`${res.imported} atama içe aktarıldı`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İçe aktarma başarısız');
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const selectedGroup = groups.find((g) => g.id === groupId);

  async function addAssignment() {
    if (!token || !studio || !subject.trim()) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/assignments`, {
      token,
      method: 'POST',
      body: {
        subject_name: subject.trim(),
        class_sections:
          selectedGroup?.member_sections?.length && groupId
            ? selectedGroup.member_sections
            : sections.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
        weekly_hours: hours,
        max_per_day: maxPerDay,
        min_days_per_week: minDays,
        room_ids: roomId ? [roomId] : [],
        teacher_ids: teacherIds,
        group_id: groupId || null,
        biweekly,
        place_first: placeFirst,
        fixed_slots: fixedSlots,
      },
    });
    setSubject('');
    setFixedSlots([]);
    await load();
    toast.success('Atama eklendi');
  }

  return (
    <div className="space-y-4">
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Okul planından içe aktar (e-Okul köprüsü)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <select
              className="flex h-9 min-w-[200px] rounded-md border border-input bg-transparent px-3 text-sm"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id.slice(0, 8)} ({p.status})
                </option>
              ))}
            </select>
            <Button type="button" size="sm" variant="secondary" onClick={() => void importFromPlan(false)}>
              Ekle
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void importFromPlan(true)}>
              Değiştir (mevcutları sil)
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grup (Horarium divisions)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <select
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Grup yok</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.parallel_mode})
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/ders-dagit/stüdyo/gruplar">Grupları yönet</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni ders ataması</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={biweekly} onChange={(e) => setBiweekly(e.target.checked)} />
            İki haftada bir
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={placeFirst} onChange={(e) => setPlaceFirst(e.target.checked)} />
            Önce yerleştir
          </label>
        </CardContent>
        <CardContent className="grid gap-3 border-t pt-3 sm:grid-cols-6">
          <div>
            <Label>Ders</Label>
            {subjects.length > 0 ? (
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematik" />
            )}
          </div>
          <div>
            <Label>Sınıflar (5A veya 9A/9B)</Label>
            <Input value={sections} onChange={(e) => setSections(e.target.value)} />
          </div>
          <div>
            <Label>Haftalık saat</Label>
            <Input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
          <div>
            <Label>Öğretmen(ler)</Label>
            <select
              multiple
              className="flex h-16 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={teacherIds}
              onChange={(e) =>
                setTeacherIds(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              {teachers.map((t) => (
                <option key={t.user_id} value={t.user_id}>
                  {t.display_name ?? t.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Min gün/hf</Label>
            <Input type="number" min={1} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} />
          </div>
          <div>
            <Label>Max/gün</Label>
            <Input type="number" min={1} value={maxPerDay} onChange={(e) => setMaxPerDay(Number(e.target.value))} />
          </div>
          <div>
            <Label>Derslik</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <select className="h-9 rounded-md border px-2 text-sm" value={fixDay} onChange={(e) => setFixDay(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  Gün {d}
                </option>
              ))}
            </select>
            <Input type="number" className="h-9 w-16" min={1} value={fixLesson} onChange={(e) => setFixLesson(Number(e.target.value))} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFixedSlots((p) => [...p, { day_of_week: fixDay, lesson_num: fixLesson }])}
            >
              + Sabit slot
            </Button>
            <Button type="button" onClick={() => void addAssignment()}>
              Ekle
            </Button>
          </div>
          {fixedSlots.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-6">
              Sabit: {fixedSlots.map((f, i) => `${f.day_of_week}/${f.lesson_num}`).join(', ')}
              <button type="button" className="ml-2 underline" onClick={() => setFixedSlots([])}>
                temizle
              </button>
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV toplu içe aktar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            ders,sınıflar,saat,öğretmen_id|id,derslik_id,2hf,önce,min_gün,max_gün
          </p>
          <textarea
            className="min-h-[80px] w-full rounded-md border p-2 text-xs font-mono"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Matematik,5A,4,user-uuid,,0,0,2,2"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!csvText.trim()}
              onClick={async () => {
                if (!token || !studio) return;
                const res = await apiFetch<{ imported: number }>(
                  `/ders-dagit/studios/${studio.id}/assignments/import-csv`,
                  { token, method: 'POST', body: { csv: csvText } },
                );
                toast.success(`${res.imported} satır`);
                setCsvText('');
                await load();
              }}
            >
              İçe aktar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atamalar ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz atama yok.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span>
                    <strong>{r.subject_name}</strong> — {r.class_sections.join(', ')} · {r.weekly_hours} saat/hafta
                  {r.teacher_ids?.[0] ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {teachers.find((t) => t.user_id === r.teacher_ids![0])?.display_name ?? 'öğrt.'}
                    </span>
                  ) : null}
                    {r.room_ids?.length ? (
                      <span className="text-muted-foreground">
                        {' '}
                        · {rooms.find((x) => x.id === r.room_ids![0])?.name ?? 'derslik'}
                      </span>
                    ) : null}
                  {r.group_id ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {groups.find((g) => g.id === r.group_id)?.abbreviation ?? 'grup'}
                    </span>
                  ) : null}
                  {r.biweekly ? <span className="text-muted-foreground"> · 2hf</span> : null}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!token || !studio) return;
                      await apiFetch(`/ders-dagit/studios/${studio.id}/assignments/${r.id}`, {
                        token,
                        method: 'DELETE',
                      });
                      toast.success('Silindi');
                      await load();
                    }}
                  >
                    Sil
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
