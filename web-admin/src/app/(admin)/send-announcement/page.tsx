'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Plus, School, Search, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SendAdminMessageForm } from '@/components/send-admin-message-form';
import { AdminMessageListSection } from '@/components/admin-message-list';

type SchoolItem = { id: string; name: string; city: string | null; district: string | null };

function schoolMatches(s: SchoolItem, q: string): boolean {
  const qn = q.trim().toLowerCase();
  if (!qn) return true;
  const name = (s.name || '').toLowerCase();
  const city = (s.city || '').toLowerCase();
  const district = (s.district || '').toLowerCase();
  return name.includes(qn) || city.includes(qn) || district.includes(qn);
}

export default function SendAnnouncementPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [schoolIdForList, setSchoolIdForList] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isSuperadmin = me?.role === 'superadmin';

  const filteredSchools = useMemo(() => {
    return schoolSearchQuery.trim()
      ? schools.filter((s) => schoolMatches(s, schoolSearchQuery))
      : schools;
  }, [schools, schoolSearchQuery]);

  const fetchSchools = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<{ items: SchoolItem[] }>('/schools?limit=100', { token });
      const items = res.items ?? [];
      setSchools(items);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (schools.length && !schoolIdForList) {
      setSchoolIdForList(schools[0].id);
    }
  }, [schools, schoolIdForList]);

  useEffect(() => {
    if (!isSuperadmin) {
      router.replace('/403');
      return;
    }
    fetchSchools();
  }, [isSuperadmin, fetchSchools]);

  if (!isSuperadmin) return null;

  return (
    <div className="space-y-8">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-2xl md:text-3xl">Okullara Sistem Mesajı Gönder</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Okul seçimi', icon: School },
              { label: 'Sistem mesajı', icon: Megaphone },
              { label: 'Sistem Mesajları', icon: Mail },
            ]}
            summary='Okul adminlerine sistem, bakım veya hatırlatma mesajları gönderin. Mesajlar okulun Duyuru TV sayfasında değil, "Sistem Mesajları" sayfasında görünür.'
          />
        </ToolbarHeading>
      </Toolbar>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="size-5" />
            Okul seçin
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Mesaj göndermek istediğiniz okulları işaretleyin. Birden fazla okul seçerek aynı mesajı toplu gönderebilirsiniz.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <LoadingSpinner label="Okullar yükleniyor…" className="py-6" />
          ) : schools.length === 0 ? (
            <EmptyState
              icon={<School />}
              title="Henüz okul yok"
              description="Okullar sayfasından önce okul ekleyin."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={schoolSearchQuery}
                    onChange={(e) => setSchoolSearchQuery(e.target.value)}
                    placeholder="Okul ara (ad, il, ilçe)"
                    className="w-full rounded-xl border border-input bg-background pl-9 pr-4 py-2.5 text-foreground transition-shadow duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const all = filteredSchools.map((s) => s.id);
                    const allSelected = all.every((id) => selectedSchoolIds.includes(id));
                    setSelectedSchoolIds(allSelected ? [] : all);
                  }}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-muted hover:shadow-md"
                >
                  {filteredSchools.every((s) => selectedSchoolIds.includes(s.id))
                    ? 'Hiçbirini seçme'
                    : 'Tümünü seç'}
                </button>
              </div>
              <div className="max-h-[220px] overflow-y-auto rounded-xl border border-input p-2 space-y-1">
                {filteredSchools.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Eşleşen okul yok.</p>
                ) : (
                  filteredSchools.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSchoolIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSchoolIds((prev) => [...prev, s.id]);
                          } else {
                            setSelectedSchoolIds((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                        className="size-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">
                        {s.name}
                        {(s.city || s.district) && (
                          <span className="text-muted-foreground">
                            {' '}
                            · {[s.city, s.district].filter(Boolean).join(' / ')}
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {schools.length > 0 && (
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-5" />
              {schools.find((s) => s.id === schoolIdForList)?.name ?? 'Okul'} – Gönderilen mesajlar
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={schoolIdForList}
                onChange={(e) => setSchoolIdForList(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-shadow duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {(s.city || s.district) && ` · ${[s.city, s.district].filter(Boolean).join(' / ')}`}
                  </option>
                ))}
              </select>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-shadow duration-150 hover:opacity-90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={selectedSchoolIds.length === 0}
                    title={
                      selectedSchoolIds.length === 0
                        ? 'Önce okul seçin'
                        : `${selectedSchoolIds.length} okula mesaj gönder`
                    }
                  >
                    <Plus className="size-4" />
                    Yeni mesaj gönder
                    {selectedSchoolIds.length > 0 && ` (${selectedSchoolIds.length} okul)`}
                  </button>
                </DialogTrigger>
                <DialogContent title="Yeni sistem mesajı gönder" className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <SendAdminMessageForm
                    token={token}
                    schoolIds={selectedSchoolIds}
                    onSuccess={() => {
                      setCreateOpen(false);
                      setRefreshKey((k) => k + 1);
                    }}
                    onCancel={() => setCreateOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <AdminMessageListSection
              token={token}
              schoolId={schoolIdForList}
              refreshTrigger={refreshKey}
            />
          </CardContent>
        </Card>
      )}

      {schools.length > 0 && selectedSchoolIds.length === 0 && (
        <Alert message="Mesaj göndermek için yukarıdan en az bir okul seçin." />
      )}
    </div>
  );
}
