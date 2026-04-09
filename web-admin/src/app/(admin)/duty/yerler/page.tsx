'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, ShieldOff, ShieldCheck, MapPin, Settings, Save, Users, ArrowLeftRight, SlidersHorizontal, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { DutySubTabs } from '@/components/duty/duty-sub-tabs';
import { DutyPageHeader } from '@/components/duty/duty-page-header';

type DutyArea = { id: string; name: string; sort_order: number; slots_required?: number; slotsRequired?: number };

type TeacherItem = {
  id: string;
  display_name: string | null;
  email: string;
  duty_exempt: boolean;
  duty_exempt_reason: string | null;
};

const EXEMPT_REASON_PRESETS = [
  'Okul Müdürü',
  'Müdür Yardımcısı',
  'Hamile öğretmen',
  'Engelli öğretmen',
  'Engelli çocuğu olan öğretmen',
  'Hizmet yılı sınırı (Kadın ≥20 yıl)',
  'Hizmet yılı sınırı (Erkek ≥25 yıl)',
  'Diğer',
];

export default function DutyYerlerPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [items, setItems] = useState<DutyArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newSlotsRequired, setNewSlotsRequired] = useState(1);
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlotsRequired, setEditSlotsRequired] = useState(1);
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Belge bilgileri (müdür, ilçe – haftalık çizelge başlığı için)
  const [principalName, setPrincipalName] = useState('');
  const [schoolDistrict, setSchoolDistrict] = useState('');
  const [belgeSaving, setBelgeSaving] = useState(false);

  // Öğretmen özellikleri (Görev Devri, Tercihlerim)
  const [teacherSwapEnabled, setTeacherSwapEnabled] = useState(true);
  const [teacherPreferencesEnabled, setTeacherPreferencesEnabled] = useState(true);
  const [teacherFeaturesSaving, setTeacherFeaturesSaving] = useState(false);

  // Nöbet muafiyeti
  const [allTeachers, setAllTeachers] = useState<TeacherItem[]>([]);
  const [exemptLoading, setExemptLoading] = useState(false);
  const [exemptSaving, setExemptSaving] = useState<string | null>(null);
  const [exemptReasonEdit, setExemptReasonEdit] = useState<Record<string, string>>({});
  const [exemptReasonPendingSave, setExemptReasonPendingSave] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<'school' | 'teacherFeatures' | 'areas' | 'exempt'>('school');

  const fetchAllTeachers = useCallback(async () => {
    if (!token || !isAdmin) return;
    setExemptLoading(true);
    try {
      const list = await apiFetch<TeacherItem[]>('/duty/teachers?includeExempt=true', { token });
      setAllTeachers(Array.isArray(list) ? list : []);
    } catch {
      setAllTeachers([]);
    } finally {
      setExemptLoading(false);
    }
  }, [token, isAdmin]);

  const handleToggleExempt = async (teacher: TeacherItem, newExempt: boolean) => {
    if (!token) return;
    setExemptSaving(teacher.id);
    try {
      const reason = newExempt ? (exemptReasonEdit[teacher.id] ?? teacher.duty_exempt_reason ?? null) : null;
      await apiFetch(`/duty/teachers/${teacher.id}/exempt`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ duty_exempt: newExempt, duty_exempt_reason: reason }),
      });
      toast.success(newExempt ? `${teacher.display_name || teacher.email} nöbet muafiyetine alındı.` : 'Muafiyet kaldırıldı.');
      fetchAllTeachers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setExemptSaving(null);
    }
  };

  const fetchAreas = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<DutyArea[]>('/duty/areas', { token });
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchSchoolDefaultTimes = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const data = await apiFetch<{ principal_name?: string | null; district?: string | null }>('/duty/school-default-times', { token });
      setPrincipalName(data?.principal_name ?? '');
      setSchoolDistrict(data?.district ?? '');
    } catch {
      setPrincipalName('');
      setSchoolDistrict('');
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const fetchTeacherFeatures = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const data = await apiFetch<{ swap_enabled: boolean; preferences_enabled: boolean }>('/duty/teacher-features', { token });
      setTeacherSwapEnabled(data?.swap_enabled ?? true);
      setTeacherPreferencesEnabled(data?.preferences_enabled ?? true);
    } catch {
      setTeacherSwapEnabled(true);
      setTeacherPreferencesEnabled(true);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchSchoolDefaultTimes();
  }, [isAdmin, fetchSchoolDefaultTimes]);

  useEffect(() => {
    if (isAdmin) fetchTeacherFeatures();
  }, [isAdmin, fetchTeacherFeatures]);

  useEffect(() => {
    if (isAdmin) fetchAllTeachers();
  }, [isAdmin, fetchAllTeachers]);

  const handleSaveBelge = async () => {
    if (!token) return;
    setBelgeSaving(true);
    try {
      await apiFetch('/duty/school-default-times', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ principal_name: principalName.trim() || null, district: schoolDistrict.trim() || null }),
      });
      toast.success('Belge bilgileri kaydedildi.');
      fetchSchoolDefaultTimes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setBelgeSaving(false);
    }
  };

  const handleSaveTeacherFeatures = async () => {
    if (!token) return;
    setTeacherFeaturesSaving(true);
    try {
      await apiFetch('/duty/teacher-features', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ swap_enabled: teacherSwapEnabled, preferences_enabled: teacherPreferencesEnabled }),
      });
      toast.success('Öğretmen özellikleri kaydedildi.');
      fetchTeacherFeatures();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setTeacherFeaturesSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!token || !newName.trim()) return;
    setAdding(true);
    try {
      await apiFetch('/duty/areas', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          slots_required: Math.min(10, Math.max(1, newSlotsRequired)),
          sort_order: newSortOrder,
        }),
      });
      toast.success('Nöbet yeri eklendi.');
      setNewName('');
      setNewSlotsRequired(1);
      setNewSortOrder((prev) => prev + 1);
      fetchAreas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi.');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !editingId || !editName.trim()) return;
    try {
      await apiFetch(`/duty/areas/${editingId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          slots_required: Math.min(10, Math.max(1, editSlotsRequired)),
          sort_order: editSortOrder,
        }),
      });
      toast.success('Güncellendi.');
      setEditingId(null);
      setEditName('');
      setEditSlotsRequired(1);
      setEditSortOrder(0);
      fetchAreas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('Bu nöbet yerini silmek istediğinize emin misiniz?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/duty/areas/${id}`, { token, method: 'DELETE' });
      toast.success('Silindi.');
      fetchAreas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const [exemptSearch, setExemptSearch] = useState('');
  const exemptTeachers = allTeachers.filter((t) => t.duty_exempt);
  const nonExemptTeachers = allTeachers.filter((t) => !t.duty_exempt);
  const filteredNonExempt = exemptSearch.trim()
    ? nonExemptTeachers.filter((t) =>
        (t.display_name ?? '').toLowerCase().includes(exemptSearch.toLowerCase()) ||
        t.email.toLowerCase().includes(exemptSearch.toLowerCase()),
      )
    : nonExemptTeachers;

  const SECTIONS = [
    { id: 'school' as const, label: 'Okul Ayarları', icon: Settings },
    { id: 'teacherFeatures' as const, label: 'Öğretmen Özellikleri', icon: Users },
    { id: 'areas' as const, label: 'Nöbet Yerleri', icon: MapPin },
    { id: 'exempt' as const, label: `Muaf Öğretmenler${exemptTeachers.length > 0 ? ` (${exemptTeachers.length})` : ''}`, icon: ShieldOff },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <DutyPageHeader
        icon={Settings}
        title="Nöbet ayarları"
        description="Belge bilgisi, nöbet yerleri, muafiyet ve öğretmen özellikleri."
        color="sky"
        actions={
          <Link
            href="/duty"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-2 sm:px-3 sm:text-sm"
          >
            <ArrowLeft className="size-3.5 sm:size-4" />
            Nöbet
          </Link>
        }
      />

      <DutySubTabs
        aria-label="Nöbet ayarları bölümleri"
        items={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
        value={activeSection}
        onValueChange={(id) =>
          setActiveSection(id as (typeof SECTIONS)[number]['id'])
        }
      />

      {/* BÖLÜM 1: Okul Ayarları – Belge bilgileri + Zaman çizelgesi */}
      {activeSection === 'school' && isAdmin && (
        <div className="space-y-8">
          <Card className="rounded-xl border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                Belge Bilgileri
              </CardTitle>
              <CardDescription className="mt-2">
                Haftalık nöbet çizelgesi ve tebliğ belgelerinde kullanılacak müdür adı ve ilçe bilgisi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="principal-name">Müdür adı</Label>
                  <Input
                    id="principal-name"
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Örn. Ahmet Yılmaz"
                    className="max-w-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school-district">İlçe (başlıkta KAYMAKAMLIĞI ile kullanılır)</Label>
                  <Input
                    id="school-district"
                    value={schoolDistrict}
                    onChange={(e) => setSchoolDistrict(e.target.value)}
                    placeholder="Örn. Pendik"
                    className="max-w-xs"
                  />
                </div>
              </div>
              <Button className="mt-4" onClick={handleSaveBelge} disabled={belgeSaving}>
                <Save className="size-4 mr-2" />
                {belgeSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </CardContent>
          </Card>

          <Alert variant="info" className="rounded-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Günlük Ders Saatleri ve Zaman Çizelgesi</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Okul başlangıç/bitiş, ders süreleri ve günlük ders saatleri artık Ders Programı Ayarlarından yönetilir. Tüm modüller (Ders Programı, Nöbet) bu ayarları kullanır.
                </p>
              </div>
              <Button asChild variant="default" size="sm" className="shrink-0">
                <Link href="/ders-programi/ayarlar">Zaman Çizelgesine git</Link>
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* BÖLÜM: Öğretmen Özellikleri – Görev Devri ve Tercihlerim */}
      {activeSection === 'teacherFeatures' && isAdmin && (
        <div className="space-y-6">
          <Card className="rounded-xl border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="size-5 text-primary" />
                </div>
                Öğretmen Özellikleri
              </CardTitle>
              <CardDescription className="mt-2">
                Öğretmen kullanıcılarının <strong>Görev Devri</strong> ve <strong>Tercihlerim</strong> alanlarına erişimini açıp kapatabilirsiniz. Kapalıyken menüde gizlenir ve erişim engellenir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  className={cn(
                    'group flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-5 transition-all',
                    teacherSwapEnabled
                      ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                      : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                      <ArrowLeftRight className="size-6 text-primary" />
                    </div>
                    <span
                      className={cn(
                        'inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors',
                        teacherSwapEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {teacherSwapEnabled ? 'Açık' : 'Kapalı'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={teacherSwapEnabled}
                    onChange={(e) => setTeacherSwapEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <h4 className="font-semibold text-foreground">Görev Devri</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Öğretmenlerin nöbet değişimi talebi oluşturmasına izin verir. Kapalıyken &quot;Görev Devri&quot; menüsü öğretmenlere gösterilmez.
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    'group flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-5 transition-all',
                    teacherPreferencesEnabled
                      ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                      : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                      <SlidersHorizontal className="size-6 text-primary" />
                    </div>
                    <span
                      className={cn(
                        'inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors',
                        teacherPreferencesEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {teacherPreferencesEnabled ? 'Açık' : 'Kapalı'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={teacherPreferencesEnabled}
                    onChange={(e) => setTeacherPreferencesEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <h4 className="font-semibold text-foreground">Tercihlerim</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Öğretmenlerin nöbet günü tercihlerini (tercih ediyorum, müsait değil vb.) girmesine izin verir. Kapalıyken &quot;Tercihlerim&quot; menüsü öğretmenlere gösterilmez.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSaveTeacherFeatures} disabled={teacherFeaturesSaving}>
                  {teacherFeaturesSaving ? (
                    'Kaydediliyor…'
                  ) : (
                    <>
                      <Save className="size-4" />
                      Kaydet
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Değişiklikleri kaydederek öğretmenlere anında yansıtın.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BÖLÜM 2: Nöbet Yerleri */}
      {activeSection === 'areas' && (
        <>
          {error && (
            <Alert variant="error" title="Hata">
              {error}
            </Alert>
          )}

          <Alert variant="info" className="mb-4">
            <strong>Öncelik sırası:</strong> Düşük numara = otomatik planlamada önce bu alana atanır. Böylece öğretmen sayısı fazla olsa bile her öğretmene eşit nöbet sayısı dağıtılır; öncelikli alanlar önce doldurulur.
          </Alert>

          {isAdmin && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="size-4" />
                  Yeni Nöbet Yeri Ekle
                </CardTitle>
                <CardDescription>Alan adı, öncelik (1 = en yüksek) ve günlük nöbetçi sayısını girin.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Öncelik (1 = en yüksek)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newSortOrder}
                      onChange={(e) => setNewSortOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-24"
                      title="Otomatik planlamada bu sıraya göre alanlara atama yapılır"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nöbet yeri adı</Label>
                    <Input
                      placeholder="Örn: Koridor, Bahçe, Giriş"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" title="Bu alana günlük kaç nöbetçi atanacak">Nöbetçi sayısı</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={newSlotsRequired}
                      onChange={(e) => setNewSlotsRequired(parseInt(e.target.value, 10) || 1)}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAdd} disabled={!newName.trim() || adding}>
                      {adding ? <LoadingSpinner className="size-4" /> : <Plus className="size-4" />}
                      {adding ? 'Ekleniyor…' : 'Ekle'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4" />
                  Tanımlı Nöbet Yerleri
                  {items.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {items.length} alan · Toplam {items.reduce((s, a) => s + (a.slots_required ?? a.slotsRequired ?? 1), 0)} nöbetçi/gün
                    </span>
                  )}
                </CardTitle>
                <CardDescription>Sıralama önceliğe göre; otomatik planlamada bu sırayla atanır.</CardDescription>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="py-12 text-center rounded-lg border border-dashed bg-muted/30">
                    <MapPin className="size-10 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm text-muted-foreground">Henüz nöbet yeri tanımlanmamış.</p>
                    <p className="text-xs text-muted-foreground mt-1">Yukarıdaki formdan ekleyebilirsiniz.</p>
                  </div>
                ) : (
                  <div className="table-x-scroll rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium w-24">Öncelik</th>
                          <th className="px-4 py-3 text-left font-medium">Alan adı</th>
                          <th className="px-4 py-3 text-center font-medium w-28">Nöbetçi/gün</th>
                          {isAdmin && <th className="px-4 py-3 text-right font-medium w-28">İşlem</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a) => {
                          const slotsReq = a.slots_required ?? a.slotsRequired ?? 1;
                          const sortOrder = a.sort_order ?? 0;
                          return (
                            <tr key={a.id} className="border-t border-border/80 hover:bg-muted/20 transition-colors">
                              {editingId === a.id ? (
                                <>
                                  <td className="px-4 py-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={editSortOrder}
                                      onChange={(e) => setEditSortOrder(parseInt(e.target.value, 10) || 0)}
                                      className="w-20 h-8 text-sm"
                                    />
                                  </td>
                                  <td className="px-4 py-2" colSpan={isAdmin ? 2 : 1}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                                        className="max-w-xs"
                                        placeholder="Alan adı"
                                      />
                                      <div className="flex items-center gap-1">
                                        <Label className="text-xs whitespace-nowrap">Nöbetçi:</Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={editSlotsRequired}
                                          onChange={(e) => setEditSlotsRequired(parseInt(e.target.value, 10) || 1)}
                                          className="w-16 h-8 text-sm"
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  {isAdmin && (
                                    <td className="px-4 py-2 text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button size="sm" onClick={handleUpdate}>
                                          <Save className="size-3.5" />
                                          Kaydet
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditName(''); setEditSlotsRequired(1); setEditSortOrder(0); }}>
                                          İptal
                                        </Button>
                                      </div>
                                    </td>
                                  )}
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-primary/10 text-primary font-medium">
                                      {sortOrder}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-medium">
                                    <span className="flex items-center gap-2">
                                      <MapPin className="size-3.5 text-muted-foreground" />
                                      {a.name}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                      {slotsReq} nöbetçi
                                    </span>
                                  </td>
                                  {isAdmin && (
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => { setEditingId(a.id); setEditName(a.name); setEditSlotsRequired(slotsReq); setEditSortOrder(sortOrder); }}
                                        >
                                          <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                          onClick={() => handleDelete(a.id)}
                                          disabled={!!deletingId}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* BÖLÜM 3: Muaf Öğretmenler */}
      {activeSection === 'exempt' && isAdmin && (
        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <strong>MEB Ortaöğretim Kurumları Yönetmeliği Madde 91:</strong>{' '}
            Okul müdürü ve müdür yardımcıları nöbet planlamaya dahil edilmez.
            Hamile öğretmenler (24. haftadan itibaren +1 yıl), engelli öğretmenler ve
            isteğe bağlı olarak 20/25 yılı dolmuş öğretmenler muaf tutulabilir.
            <strong className="block mt-1">Muaf işaretlenen öğretmenler otomatik planlamaya ve önerilere dahil edilmez.</strong>
          </div>

          {/* Özet kartlar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-3 flex items-center gap-3">
              <ShieldOff className="size-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Muaf</p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{exemptTeachers.length}</p>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
              <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Nöbet Tutan</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{nonExemptTeachers.length}</p>
              </div>
            </div>
          </div>

          {exemptLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : (
            <>
              {/* Muaf öğretmenler listesi */}
              {exemptTeachers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldOff className="size-4 text-rose-500" />
                      Muaf Öğretmenler
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                        {exemptTeachers.length}
                      </span>
                    </CardTitle>
                    <CardDescription>Bu öğretmenler nöbet planlamasına dahil edilmez. Muafiyeti kaldırmak için butona tıklayın.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {exemptTeachers.map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/10 px-4 py-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0">
                            <ShieldOff className="size-2.5" />
                            Muaf
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{t.display_name || t.email}</p>
                            {t.display_name && <p className="text-xs text-muted-foreground">{t.email}</p>}
                            {t.duty_exempt_reason && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                                Neden: <strong>{t.duty_exempt_reason}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[160px]"
                            value={exemptReasonEdit[t.id] ?? t.duty_exempt_reason ?? ''}
                            onChange={(e) => {
                              setExemptReasonEdit((r) => ({ ...r, [t.id]: e.target.value }));
                              setExemptReasonPendingSave((p) => ({ ...p, [t.id]: true }));
                            }}
                          >
                            <option value="">Neden seçin…</option>
                            {EXEMPT_REASON_PRESETS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          {exemptReasonPendingSave[t.id] && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              disabled={exemptSaving === t.id}
                              onClick={async () => {
                                const reason = exemptReasonEdit[t.id] ?? t.duty_exempt_reason ?? null;
                                await handleToggleExempt({ ...t, duty_exempt_reason: reason }, true);
                                setExemptReasonPendingSave((p) => ({ ...p, [t.id]: false }));
                              }}
                            >
                              {exemptSaving === t.id ? <LoadingSpinner className="size-3" /> : <Save className="size-3" />}
                              Kaydet
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
                            disabled={exemptSaving === t.id}
                            onClick={() => handleToggleExempt(t, false)}
                          >
                            {exemptSaving === t.id ? <LoadingSpinner className="size-3" /> : <ShieldCheck className="size-3" />}
                            Muafiyeti Kaldır
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Muaf olmayan öğretmenler */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        Nöbet Tutan Öğretmenler
                        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {nonExemptTeachers.length}
                        </span>
                      </CardTitle>
                      <CardDescription>Muafiyet vermek için neden seçip &quot;Muaf Yap&quot; butonuna basın.</CardDescription>
                    </div>
                    <Input
                      placeholder="Öğretmen ara…"
                      value={exemptSearch}
                      onChange={(e) => setExemptSearch(e.target.value)}
                      className="h-8 w-full sm:w-48 text-xs"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredNonExempt.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {exemptSearch ? 'Aramanızla eşleşen öğretmen bulunamadı.' : 'Tüm öğretmenler muaf tutulmuş.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredNonExempt.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                              <ShieldCheck className="size-2.5" />
                              Aktif
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{t.display_name || t.email}</p>
                              {t.display_name && <p className="text-xs text-muted-foreground">{t.email}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="flex h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[160px]"
                              value={exemptReasonEdit[t.id] ?? ''}
                              onChange={(e) => setExemptReasonEdit((r) => ({ ...r, [t.id]: e.target.value }))}
                            >
                              <option value="">Muafiyet nedeni seçin…</option>
                              {EXEMPT_REASON_PRESETS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300"
                              disabled={exemptSaving === t.id}
                              onClick={() => {
                                const reason = exemptReasonEdit[t.id] || null;
                                handleToggleExempt({ ...t, duty_exempt_reason: reason }, true);
                              }}
                            >
                              {exemptSaving === t.id ? <LoadingSpinner className="size-3" /> : <ShieldOff className="size-3" />}
                              Muaf Yap
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
