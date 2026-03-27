'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, X, User, FileText, Package, Users } from 'lucide-react';

/** Tarih: DD.MM.YYYY veya YYYY-MM-DD → input value YYYY-MM-DD */
function trDateToInput(s: string | undefined): string {
  if (!s?.trim()) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[.\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c?.length === 4) return `${c}-${(b ?? '').padStart(2, '0')}-${(a ?? '').padStart(2, '0')}`;
  }
  return '';
}

/** Input value YYYY-MM-DD → DD.MM.YYYY */
function inputToTrDate(s: string | undefined): string {
  if (!s?.trim()) return '';
  const d = new Date(s!);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR');
}

/** Zümre formatı: "İsim|Görev, İsim2|Görev2" — document-generate ile uyumlu */
const GOREV_OPTIONS = [
  { value: '', label: 'Görev Seçiniz' },
  { value: 'Okul Müdürü', label: 'Okul Müdürü' },
  { value: 'Müdür Yardımcısı', label: 'Müdür Yardımcısı' },
  { value: 'Zümre Başkanı', label: 'Zümre Başkanı' },
  { value: 'Zümre Öğretmeni', label: 'Zümre Öğretmeni' },
  { value: 'Kulüp Öğretmeni', label: 'Kulüp Öğretmeni' },
  { value: 'Rehberlik Öğretmeni', label: 'Rehberlik Öğretmeni' },
];

function parseZumreList(raw: string): { name: string; gorev: string }[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((part) => {
    const i = part.indexOf('|');
    if (i >= 0) return { name: part.slice(0, i).trim(), gorev: part.slice(i + 1).trim() };
    return { name: part, gorev: '' };
  });
}

function serializeZumreList(items: { name: string; gorev: string }[]): string {
  return items.map(({ name, gorev }) => (gorev ? `${name}|${gorev}` : name)).join(', ');
}

export type EvrakDefaults = {
  okul_adi?: string;
  mudur_adi?: string;
  ogretim_yili?: string;
  sinif?: string;
  zumreler?: string;
  zumre_ogretmenleri?: string;
  onay_tarihi?: string;
  /** İmza alanında öğretmen ismi altında görünecek unvan (örn. Coğrafya Öğretmeni) */
  ogretmen_unvani?: string;
} | null;

export function EvrakDefaultsForm({
  token,
  evrakDefaults,
  schoolName,
  schoolPrincipal,
  onSuccess,
}: {
  token: string | null;
  evrakDefaults: EvrakDefaults;
  schoolName?: string;
  schoolPrincipal?: string;
  onSuccess: () => void;
}) {
  const [okulAdi, setOkulAdi] = useState(evrakDefaults?.okul_adi ?? schoolName ?? '');
  const [mudurAdi, setMudurAdi] = useState(evrakDefaults?.mudur_adi ?? schoolPrincipal ?? '');
  const [ogretimYili, setOgretimYili] = useState(evrakDefaults?.ogretim_yili ?? '');
  const [sinif, setSinif] = useState(evrakDefaults?.sinif ?? '');
  const [zumreList, setZumreList] = useState<{ name: string; gorev: string }[]>(() =>
    parseZumreList(evrakDefaults?.zumre_ogretmenleri ?? evrakDefaults?.zumreler ?? ''),
  );
  const [ogretmenUnvani, setOgretmenUnvani] = useState(evrakDefaults?.ogretmen_unvani ?? '');
  const [onayTarihi, setOnayTarihi] = useState(evrakDefaults?.onay_tarihi ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOkulAdi(evrakDefaults?.okul_adi ?? schoolName ?? '');
    setMudurAdi(evrakDefaults?.mudur_adi ?? schoolPrincipal ?? '');
    setOgretimYili(evrakDefaults?.ogretim_yili ?? '');
    setSinif(evrakDefaults?.sinif ?? '');
    setZumreList(parseZumreList(evrakDefaults?.zumre_ogretmenleri ?? evrakDefaults?.zumreler ?? ''));
    setOgretmenUnvani(evrakDefaults?.ogretmen_unvani ?? '');
    setOnayTarihi(evrakDefaults?.onay_tarihi ?? '');
  }, [evrakDefaults, schoolName, schoolPrincipal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          evrak_defaults: {
            okul_adi: okulAdi.trim(),
            mudur_adi: mudurAdi.trim(),
            ogretim_yili: ogretimYili.trim(),
            sinif: sinif.trim(),
            zumre_ogretmenleri: serializeZumreList(zumreList),
            zumreler: serializeZumreList(zumreList),
            ogretmen_unvani: ogretmenUnvani.trim(),
            onay_tarihi: onayTarihi.trim(),
          },
        }),
      });
      toast.success('Evrak varsayılanları kaydedildi');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kaydedilemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert message={error} />}
      <div className="rounded-xl border border-border bg-muted/10 p-5">
        <p className="mb-4 text-sm text-muted-foreground">
          Evrak ve planlarda otomatik kullanılacak bilgileri aşağıya girin.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="evrak-okul" className="block text-sm font-medium text-foreground">
            Okul adı
          </label>
          <input
            id="evrak-okul"
            type="text"
            value={okulAdi}
            onChange={(e) => setOkulAdi(e.target.value)}
            maxLength={512}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn: Atatürk Anadolu Lisesi"
          />
        </div>
        <div>
          <label htmlFor="evrak-mudur" className="block text-sm font-medium text-foreground">
            Müdür adı
          </label>
          <input
            id="evrak-mudur"
            type="text"
            value={mudurAdi}
            onChange={(e) => setMudurAdi(e.target.value)}
            maxLength={255}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn: Mehmet Yılmaz"
          />
        </div>
        <div>
          <label htmlFor="evrak-ogretim-yili" className="block text-sm font-medium text-foreground">
            Öğretim yılı
          </label>
          <input
            id="evrak-ogretim-yili"
            type="text"
            value={ogretimYili}
            onChange={(e) => setOgretimYili(e.target.value)}
            maxLength={32}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn: 2024-2025"
          />
        </div>
        <div>
          <label htmlFor="evrak-sinif" className="block text-sm font-medium text-foreground">
            Sınıf
          </label>
          <input
            id="evrak-sinif"
            type="text"
            value={sinif}
            onChange={(e) => setSinif(e.target.value)}
            maxLength={32}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn: 9"
          />
        </div>
        <div>
          <label htmlFor="evrak-ogretmen-unvani" className="block text-sm font-medium text-foreground">
            Öğretmen unvanı / branş
          </label>
          <input
            id="evrak-ogretmen-unvani"
            type="text"
            value={ogretmenUnvani}
            onChange={(e) => setOgretmenUnvani(e.target.value)}
            maxLength={100}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Örn: Coğrafya Öğretmeni, Matematik Öğretmeni"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Evrak imza alanında öğretmen ismi altında görünür. Boş bırakırsanız ders adı veya profil branşı kullanılır.
          </p>
        </div>
        <div>
          <label htmlFor="evrak-onay-tarihi" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calendar className="size-4 text-muted-foreground" />
            Onay tarihi (varsayılan)
          </label>
          <input
            id="evrak-onay-tarihi"
            type="date"
            value={trDateToInput(onayTarihi)}
            onChange={(e) => setOnayTarihi(e.target.value ? inputToTrDate(e.target.value) : '')}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Boş bırakırsanız evrak üretirken bugünün tarihi kullanılır
          </p>
        </div>
        </div>
      </div>

      {/* Zümre Listesi – Defterdoldur tarzı */}
      <div className="rounded-xl border border-border bg-muted/10 p-5 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <label htmlFor="zumre-adi" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
              <User className="size-4 text-muted-foreground" />
              Adı Soyadı (Kendiniz hariç)
            </label>
            <input
              id="zumre-adi"
              type="text"
              placeholder="Adı Soyadı"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const inp = document.getElementById('zumre-adi') as HTMLInputElement;
                  const sel = document.getElementById('zumre-gorev') as HTMLSelectElement;
                  const v = inp?.value?.trim();
                  if (v) {
                    setZumreList((prev) => [...prev, { name: v, gorev: sel?.value ?? '' }]);
                    inp.value = '';
                    if (sel) sel.value = '';
                  }
                }
              }}
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="zumre-gorev" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
              <FileText className="size-4 text-muted-foreground" />
              Görev
            </label>
            <select
              id="zumre-gorev"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {GOREV_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 shrink-0"
            onClick={() => {
              const inp = document.getElementById('zumre-adi') as HTMLInputElement;
              const sel = document.getElementById('zumre-gorev') as HTMLSelectElement;
              const v = inp?.value?.trim();
              if (v) {
                setZumreList((prev) => [...prev, { name: v, gorev: sel?.value ?? '' }]);
                inp.value = '';
                if (sel) sel.value = '';
              }
            }}
          >
            <Plus className="size-4" />
            Ekle
          </Button>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Users className="size-4 text-primary" />
            Zümre Listesi
          </h3>
          {zumreList.length > 0 ? (
            <div className="table-x-scroll rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-12">#</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">ADI SOYADI</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">GÖREV</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground w-20">İŞLEM</th>
                  </tr>
                </thead>
                <tbody>
                  {zumreList.map((item, i) => (
                    <tr key={`${item.name}-${i}`} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{item.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{item.gorev || '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setZumreList((prev) => prev.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive"
                          title="Sil"
                        >
                          <X className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 py-12">
              <Package className="size-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Henüz zümre üyesi eklenmemiş.</p>
            </div>
          )}
        </div>
      </div>

      <Button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? 'Kaydediliyor…' : 'Kaydet'}
      </Button>
    </form>
  );
}
