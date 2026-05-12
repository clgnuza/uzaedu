'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { downloadYollukPdf } from '@/lib/yolluk-pdf-download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Teacher = { id: string; display_name: string | null };
type Calc = {
  id: string;
  teacher_user_id: string;
  kind: string;
  status: string;
  title: string | null;
  result: {
    total_tl?: number;
    effective_daily_tl?: number;
    lines?: { key: string; label: string; amount_tl: number }[];
  };
  created_at: string;
};

type ActiveSettings = {
  default_daily_tl: string;
  derece_daily_tl: Record<string, string>;
};

export default function YollukOkulPage() {
  const router = useRouter();
  const { me } = useAuth();
  const can = me?.role === 'school_admin' || me?.role === 'superadmin';
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [list, setList] = useState<Calc[]>([]);
  const [tid, setTid] = useState('');
  const [kind, setKind] = useState<'gecici' | 'surekli'>('gecici');
  const [missionDays, setMissionDays] = useState(1);
  const [yol, setYol] = useState(0);
  const [kon, setKon] = useState(0);
  const [diger, setDiger] = useState(0);
  const [tasitG, setTasitG] = useState(0);
  const [taksiG, setTaksiG] = useState(0);
  const [km, setKm] = useState(0);
  const [aile, setAile] = useState(0);
  const [derece, setDerece] = useState<number | ''>('');
  const [gundelikElle, setGundelikElle] = useState(0);
  const [ydm, setYdm] = useState<'tam' | 'yarim'>('tam');
  const [tasitS, setTasitS] = useState(0);
  const [eskiMahal, setEskiMahal] = useState('');
  const [yeniMahal, setYeniMahal] = useState('');
  const [settings, setSettings] = useState<ActiveSettings | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<{ result: Calc['result'] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const input = useMemo(() => {
    const d = derece === '' ? undefined : derece;
    const gEl = gundelikElle > 0 ? gundelikElle : undefined;
    if (kind === 'gecici') {
      return {
        kind: 'gecici' as const,
        mission_days: missionDays,
        yol_masrafi_tl: yol,
        konaklama_tl: kon,
        diger_tl: diger,
        tasit_ucreti_tl: tasitG,
        taksi_tl: taksiG,
        ...(d !== undefined ? { derece: d } : {}),
        ...(gEl !== undefined ? { gundelik_tl_override: gEl } : {}),
      };
    }
    return {
      kind: 'surekli' as const,
      mesafe_km: km,
      aile_ferdi_sayisi: aile,
      ydm_km_mode: ydm,
      tasit_ucreti_tl: tasitS,
      ...(d !== undefined ? { derece: d } : {}),
      ...(gEl !== undefined ? { gundelik_tl_override: gEl } : {}),
      ...(eskiMahal.trim() ? { eski_mahal: eskiMahal.trim() } : {}),
      ...(yeniMahal.trim() ? { yeni_mahal: yeniMahal.trim() } : {}),
    };
  }, [
    kind,
    missionDays,
    yol,
    kon,
    diger,
    tasitG,
    taksiG,
    km,
    aile,
    derece,
    gundelikElle,
    ydm,
    tasitS,
    eskiMahal,
    yeniMahal,
  ]);

  const [schoolIdSa, setSchoolIdSa] = useState('');
  const effectiveSchoolQ = me?.role === 'superadmin' && schoolIdSa.trim() ? `?school_id=${encodeURIComponent(schoolIdSa.trim())}` : '';

  const loadList = useCallback(async () => {
    const path = me?.role === 'superadmin' ? `/yolluk/calculations${effectiveSchoolQ}` : '/yolluk/calculations';
    const rows = await apiFetch<Calc[]>(path);
    setList(rows);
  }, [me?.role, effectiveSchoolQ]);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    if (me?.role === 'superadmin' && !schoolIdSa.trim()) return;
    (async () => {
      try {
        if (me?.role === 'school_admin') {
          const t = await apiFetch<Teacher[]>('/duty/teachers?teacher_only=true');
          setTeachers(t);
        } else if (me?.role === 'superadmin' && schoolIdSa.trim()) {
          const t = await apiFetch<Teacher[]>(
            `/duty/teachers?school_id=${encodeURIComponent(schoolIdSa.trim())}&teacher_only=true`,
          );
          setTeachers(t);
        }
        try {
          const st = await apiFetch<ActiveSettings>('/yolluk/settings/active');
          setSettings(st);
        } catch {
          setSettings(null);
        }
        await loadList();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [can, me?.role, router, loadList, schoolIdSa]);

  if (!can) return null;

  async function doPreview() {
    setErr(null);
    setBusy(true);
    try {
      const out = await apiFetch<{ result: Calc['result'] }>('/yolluk/calculations/preview', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      setPreview(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doCreate() {
    if (!tid) {
      setErr('Öğretmen seçin.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await apiFetch('/yolluk/calculations', {
        method: 'POST',
        body: JSON.stringify({
          teacher_user_id: tid,
          input,
          title: title || null,
          ...(me?.role === 'superadmin' && schoolIdSa.trim() ? { school_id: schoolIdSa.trim() } : {}),
        }),
      });
      setPreview(null);
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function doFinalize(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/yolluk/calculations/${id}/finalize`, { method: 'POST' });
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Yolluk hesaplama (okul)</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Taslak oluşturun, kesinleştirdiğinizde öğretmene bildirim gider.</p>
        <Button variant="outline" size="sm" asChild>
          <a href="/yolluk-hesaplama/rapor">PDF rapor sayfası</a>
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {me?.role === 'superadmin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Okul bağlamı</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label>Okul UUID</Label>
              <Input value={schoolIdSa} onChange={(e) => setSchoolIdSa(e.target.value)} placeholder="schools.id" />
            </div>
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Uygula (yenile)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni hesap</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:max-w-xl">
          {(me?.role === 'school_admin' || (me?.role === 'superadmin' && schoolIdSa.trim())) && (
            <div>
              <Label>Öğretmen</Label>
              <select className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" value={tid} onChange={(e) => setTid(e.target.value)}>
                <option value="">—</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name || t.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant={kind === 'gecici' ? 'default' : 'outline'} size="sm" onClick={() => setKind('gecici')}>
              Geçici görev
            </Button>
            <Button type="button" variant={kind === 'surekli' ? 'default' : 'outline'} size="sm" onClick={() => setKind('surekli')}>
              Sürekli (yer değiştirme özeti)
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label>Kadro derecesi (1–15, isteğe bağlı)</Label>
              <select
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={derece === '' ? '' : String(derece)}
                onChange={(e) => {
                  const v = e.target.value;
                  setDerece(v === '' ? '' : parseInt(v, 10));
                }}
              >
                <option value="">— (yedek gündelik)</option>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} — {settings?.derece_daily_tl?.[String(n)] ?? '?'} TL
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Elle gündelik TL (0 = kullanma)</Label>
              <Input type="number" min={0} value={gundelikElle || ''} onChange={(e) => setGundelikElle(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          {kind === 'gecici' ? (
            <>
              <div>
                <Label>Görev günü (varış sonrası)</Label>
                <Input type="number" min={0} value={missionDays} onChange={(e) => setMissionDays(parseInt(e.target.value, 10) || 0)} />
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div>
                  <Label>Yol TL</Label>
                  <Input type="number" value={yol} onChange={(e) => setYol(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Taşıt TL</Label>
                  <Input type="number" value={tasitG} onChange={(e) => setTasitG(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Konaklama TL</Label>
                  <Input type="number" value={kon} onChange={(e) => setKon(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Taksi / hamal TL</Label>
                  <Input type="number" value={taksiG} onChange={(e) => setTaksiG(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Diğer TL</Label>
                  <Input type="number" value={diger} onChange={(e) => setDiger(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Mesafe km</Label>
                <Input type="number" value={km} onChange={(e) => setKm(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Aile ferdi (kendisi hariç)</Label>
                <Input type="number" value={aile} onChange={(e) => setAile(parseInt(e.target.value, 10) || 0)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant={ydm === 'tam' ? 'default' : 'outline'} size="sm" onClick={() => setYdm('tam')}>
                  YDM tam (km)
                </Button>
                <Button type="button" variant={ydm === 'yarim' ? 'default' : 'outline'} size="sm" onClick={() => setYdm('yarim')}>
                  YDM yarım
                </Button>
              </div>
              <div>
                <Label>Taşıt ücreti TL</Label>
                <Input type="number" value={tasitS} onChange={(e) => setTasitS(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label>Eski mahal (metin)</Label>
                  <Input value={eskiMahal} onChange={(e) => setEskiMahal(e.target.value)} />
                </div>
                <div>
                  <Label>Yeni mahal (metin)</Label>
                  <Input value={yeniMahal} onChange={(e) => setYeniMahal(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <div>
            <Label>Başlık (isteğe bağlı)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Ocak geçici görev" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void doPreview()}>
              Önizleme
            </Button>
            <Button type="button" disabled={busy} onClick={() => void doCreate()}>
              Taslak kaydet
            </Button>
          </div>
          {me?.role !== 'school_admin' && me?.role !== 'superadmin' && (
            <p className="text-xs text-muted-foreground">Taslak oluşturmak için okul yöneticisi veya süper yönetici girin.</p>
          )}
          {me?.role === 'superadmin' && !schoolIdSa.trim() && (
            <p className="text-xs text-amber-600">Öğretmen listesi ve kayıtlar için yukarıda okul UUID girin.</p>
          )}
        </CardContent>
      </Card>

      {preview?.result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Önizleme — toplam {preview.result.total_tl?.toFixed?.(2) ?? preview.result.total_tl} TL
              {preview.result.effective_daily_tl != null && (
                <span className="text-muted-foreground font-normal"> · gündelik {preview.result.effective_daily_tl.toFixed(2)} TL</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-inside list-disc space-y-1">
              {(preview.result.lines ?? []).map((l) => (
                <li key={l.key}>
                  {l.label}: <strong>{l.amount_tl.toFixed(2)}</strong> TL
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {list.length === 0 && <p className="text-muted-foreground">Henüz kayıt yok.</p>}
          {list.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <div>
                <span className="font-medium">{c.title || c.kind}</span>
                <span className="text-muted-foreground"> · {c.status}</span>
                <div className="text-muted-foreground">
                  Toplam {(c.result?.total_tl as number)?.toFixed?.(2) ?? c.result?.total_tl} TL · {c.id.slice(0, 8)}…
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              {c.status === 'draft' && (me?.role === 'school_admin' || me?.role === 'superadmin') && (
                <Button size="sm" disabled={busy} onClick={() => void doFinalize(c.id)}>
                  Kesinleştir
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={pdfBusy === c.id}
                onClick={() => {
                  setPdfBusy(c.id);
                  setErr(null);
                  downloadYollukPdf(c.id)
                    .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                    .finally(() => setPdfBusy(null));
                }}
              >
                {pdfBusy === c.id ? '…' : 'PDF'}
              </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
