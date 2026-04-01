'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileSignature, Save, Printer, BookOpen, Calendar, CalendarRange } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

const DEFAULT_BOS_DERS_PARAGRAF = `Okulumuz öğretmenlerinin değişik mazeretlerle görevinin başında olmamasından dolayı nöbet görev süreniz boyunca dersi boş geçecek olan sınıflardan sorumluluğu uhdenize verilenler aşağıda gösterilmiştir. Belirtilen ders saatlerinde bizzat sınıflarda bulunarak öğrencilere nezaret etmeniz hususunda, gereğini rica ederim.`;

const DEFAULT_BOS_DERS_KONU = 'Nöbet Görevi';

const DEFAULT_HAFTALIK_BASLIK = 'HAFTALIK NÖBET ÇİZELGESİ';
const DEFAULT_HAFTALIK_DUTY_DUTIES = `1- Günlük vakit çizelgesini uygulamak.
2- Öğretmenlerin derslere zamanında girip girmediğini izlemek ve öğretmeni gelmeyen sınıfları okul yönetimine bildirmek ve bu sınıflara nezaret etmek.
3- Isıtma, elektrik ve sıhhi tesislerin çalışıp çalışmadığını, okul içi temizliğin yapılıp yapılmadığını, okul bina ve tesislerinin yangından koruma önlemlerinin alınıp alınmadığının günlük kontrollerini yapmak, giderilebildiği eksikleri gidermek, gerekli olanları ilgililere duyurmak.
4- Bahçedeki, koridorlardaki ve sınıflardaki öğrencileri gözetlemek.
5- Beklenmedik olaylar karşısında gerekli tedbirleri almak ve bu durumu ilgililere bildirmek.
6- Nöbet süresince okulun eğitim öğretim disiplin gibi çeşitli işlerini izlemek, bu hususlarda günlük tedbirleri almak.
7- Nöbet sonunda okul nöbet defterine nöbet süresi içerisinde önemli olayları ve aldığı tedbirleri belirten raporu yazmak.
8- Nöbet görevi sabah saat 08:30'da başlar, akşam 16:45'de sona erer.`;

const BOS_DERS_PLACEHOLDERS = [
  { key: '{{okul_adi}}', desc: 'Okul adı' },
  { key: '{{tarih}}', desc: 'Tebliğ tarihi' },
  { key: '{{konu}}', desc: 'Konu (örn. Nöbet Görevi)' },
  { key: '{{gun_adi}}', desc: 'Gün adı (PAZARTESİ vb.)' },
  { key: '{{mudur_adi}}', desc: 'Müdür adı' },
];

function mergePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.replaceAll(k, v ?? '');
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type BosDersRow = {
  teacher_id: string;
  teacher_name: string;
  absent_type?: string;
  lessons: Record<number, string>;
};

type BosDersTebligResponse = {
  date: string;
  date_label: string;
  day_name: string;
  max_lessons: number;
  /** Tabloda gösterilecek ders sütunları (en az bir satırda dolu olanlar) */
  lesson_columns?: number[];
  gelmeyenler: BosDersRow[];
  gorevlendirilenler: BosDersRow[];
};

type HaftalikCizelgeResponse = {
  week_start: string;
  education_mode?: 'single' | 'double';
  areas: string[];
  days: { date: string; day_name: string; row: Record<string, string>; morning?: Record<string, string>; afternoon?: Record<string, string> }[];
  duty_duties_text: string;
  teachers?: { name: string; branch: string | null }[];
};

type AylikCizelgeResponse = {
  school_name: string;
  school_district: string | null;
  principal_name: string | null;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  education_mode: 'single' | 'double';
  areas: string[];
  dates: { date: string; day_name: string; morning: Record<string, string>; afternoon: Record<string, string> }[];
};

function formatAylikDocTitle(data: AylikCizelgeResponse, monthNames: readonly string[]): string {
  const ps = data.period_start;
  const pe = data.period_end;
  const first = new Date(ps + 'T12:00:00');
  const y = first.getFullYear();
  const m = first.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastOfMonth = new Date(y, m, 0);
  const fullMonth = ps === `${y}-${pad(m)}-01` && pe === toYMD(lastOfMonth);
  if (fullMonth) {
    return `${monthNames[data.month - 1]} ${data.year} ÖĞRETMEN NÖBET ÇİZELGESİ`;
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fmt(new Date(ps + 'T12:00:00'))} – ${fmt(new Date(pe + 'T12:00:00'))} ÖĞRETMEN NÖBET ÇİZELGESİ`.toLocaleUpperCase('tr-TR');
}

function getMondayOfWeek(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

export default function DutyTebligPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bosDersParagraf, setBosDersParagraf] = useState(DEFAULT_BOS_DERS_PARAGRAF);
  const [bosDersKonu, setBosDersKonu] = useState(DEFAULT_BOS_DERS_KONU);
  const [schoolName, setSchoolName] = useState('');
  const [schoolDistrict, setSchoolDistrict] = useState<string | null>(null);
  const [principalName, setPrincipalName] = useState<string | null>(null);
  const [deputyPrincipalName, setDeputyPrincipalName] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [bosDersDate, setBosDersDate] = useState(() => toYMD(new Date()));
  const [bosDersData, setBosDersData] = useState<BosDersTebligResponse | null>(null);
  const [bosDersLoading, setBosDersLoading] = useState(false);

  const [haftalikWeekStart, setHaftalikWeekStart] = useState(() => getMondayOfWeek(toYMD(new Date())));
  const [haftalikData, setHaftalikData] = useState<HaftalikCizelgeResponse | null>(null);
  const [haftalikLoading, setHaftalikLoading] = useState(false);
  const [haftalikBaslik, setHaftalikBaslik] = useState(DEFAULT_HAFTALIK_BASLIK);
  const [haftalikDutyDutiesText, setHaftalikDutyDutiesText] = useState(DEFAULT_HAFTALIK_DUTY_DUTIES);
  const [haftalikEditedCells, setHaftalikEditedCells] = useState<Record<string, string>>({});
  const [haftalikEditedAreaNames, setHaftalikEditedAreaNames] = useState<Record<string, string>>({});
  const [haftalikDateRange, setHaftalikDateRange] = useState('');

  const [aylikFrom, setAylikFrom] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}-01`;
  });
  const [aylikTo, setAylikTo] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return toYMD(new Date(y, m, 0));
  });
  /** Yazdırma / önizlemede müdür altı tarih; boş = gösterme */
  const [aylikImzaTarihi, setAylikImzaTarihi] = useState('');
  const [aylikData, setAylikData] = useState<AylikCizelgeResponse | null>(null);
  const [aylikLoading, setAylikLoading] = useState(false);

  const fetchBosDersTeblig = useCallback(async () => {
    if (!token) return;
    setBosDersLoading(true);
    try {
      const res = await apiFetch<BosDersTebligResponse>(`/duty/bos-ders-teblig?date=${bosDersDate}`, { token });
      setBosDersData(res ?? null);
    } catch {
      setBosDersData(null);
      toast.error('Veri yüklenemedi');
    } finally {
      setBosDersLoading(false);
    }
  }, [token, bosDersDate]);

  const fetchTemplates = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const res = await apiFetch<{
        coverage_template: string | null;
        bos_ders_paragraf: string | null;
        bos_ders_konu: string | null;
        school_name: string;
        school_district: string | null;
        principal_name: string | null;
        deputy_principal_name: string | null;
        haftalik_baslik: string | null;
        haftalik_duty_duties_text: string | null;
      }>('/duty/teblig-templates', { token });
      setSchoolName(res?.school_name ?? '');
      setSchoolDistrict(res?.school_district ?? null);
      setPrincipalName(res?.principal_name ?? null);
      setDeputyPrincipalName(res?.deputy_principal_name ?? null);
      setBosDersParagraf(res?.bos_ders_paragraf ?? DEFAULT_BOS_DERS_PARAGRAF);
      setBosDersKonu(res?.bos_ders_konu ?? DEFAULT_BOS_DERS_KONU);
      setHaftalikBaslik(res?.haftalik_baslik ?? DEFAULT_HAFTALIK_BASLIK);
      setHaftalikDutyDutiesText(res?.haftalik_duty_duties_text ?? DEFAULT_HAFTALIK_DUTY_DUTIES);
    } catch {
      toast.error('Şablonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchTemplates();
  }, [isAdmin, fetchTemplates]);

  useEffect(() => {
    if (token && bosDersDate) fetchBosDersTeblig();
  }, [token, bosDersDate, fetchBosDersTeblig]);

  const fetchHaftalikCizelge = useCallback(async () => {
    if (!token) return;
    setHaftalikLoading(true);
    try {
      const res = await apiFetch<HaftalikCizelgeResponse>(`/duty/haftalik-cizelge?weekStart=${haftalikWeekStart}`, { token });
      setHaftalikData(res ?? null);
      if (res?.days?.length) {
        const first = res.days[0];
        const last = res.days[res.days.length - 1];
        const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        setHaftalikDateRange(first.date === last.date ? fmt(first.date) : `${fmt(first.date)} - ${fmt(last.date)}`);
      } else {
        setHaftalikDateRange('');
      }
    } catch {
      setHaftalikData(null);
      toast.error('Veri yüklenemedi');
    } finally {
      setHaftalikLoading(false);
    }
  }, [token, haftalikWeekStart]);

  const fetchAylikCizelge = useCallback(async () => {
    if (!token || !aylikFrom || !aylikTo || aylikFrom > aylikTo) return;
    setAylikLoading(true);
    try {
      const res = await apiFetch<AylikCizelgeResponse>(
        `/duty/aylik-cizelge?from=${encodeURIComponent(aylikFrom)}&to=${encodeURIComponent(aylikTo)}`,
        { token },
      );
      setAylikData(res ?? null);
    } catch {
      setAylikData(null);
      toast.error('Veri yüklenemedi');
    } finally {
      setAylikLoading(false);
    }
  }, [token, aylikFrom, aylikTo]);

  useEffect(() => {
    if (token && haftalikWeekStart) fetchHaftalikCizelge();
  }, [token, haftalikWeekStart, fetchHaftalikCizelge]);

  useEffect(() => {
    if (token && aylikFrom && aylikTo && aylikFrom <= aylikTo) fetchAylikCizelge();
  }, [token, aylikFrom, aylikTo, fetchAylikCizelge]);

  const handleSaveHaftalik = async () => {
    if (!token || !isAdmin) return;
    setSaving(true);
    try {
      await apiFetch('/duty/teblig-templates', {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          haftalik_baslik: haftalikBaslik,
          haftalik_duty_duties_text: haftalikDutyDutiesText,
          principal_name: principalName ?? undefined,
        }),
      });
      toast.success('Haftalık metinleri kaydedildi');
    } catch {
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBosDers = async () => {
    if (!token || !isAdmin) return;
    setSaving(true);
    try {
      await apiFetch('/duty/teblig-templates', {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          bos_ders_paragraf: bosDersParagraf,
          bos_ders_konu: bosDersKonu,
          principal_name: principalName ?? undefined,
          deputy_principal_name: deputyPrincipalName,
        }),
      });
      toast.success('Kaydedildi');
    } catch {
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!token || !isAdmin) return;
    setSaving(true);
    try {
      await apiFetch('/duty/teblig-templates', {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          bos_ders_paragraf: bosDersParagraf,
          bos_ders_konu: bosDersKonu,
          principal_name: principalName ?? undefined,
          deputy_principal_name: deputyPrincipalName,
          haftalik_baslik: haftalikBaslik,
          haftalik_duty_duties_text: haftalikDutyDutiesText,
        }),
      });
      toast.success('Şablonlar kaydedildi');
    } catch {
      toast.error('Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintBosDers = () => {
    if (!bosDersData || !schoolName) {
      toast.error('Veri yok veya okul adı eksik');
      return;
    }
    const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const maxL = bosDersData.max_lessons;
    const lessonCols =
      bosDersData.lesson_columns?.length
        ? bosDersData.lesson_columns
        : Array.from({ length: maxL }, (_, i) => i + 1);
    const konu = bosDersKonu || DEFAULT_BOS_DERS_KONU;
    const dateLabelFull = bosDersData.date_label ?? `${today} ${bosDersData.day_name}`;
    const paragraf = mergePlaceholders(bosDersParagraf || DEFAULT_BOS_DERS_PARAGRAF, {
      '{{okul_adi}}': schoolName,
      '{{tarih}}': today,
      '{{konu}}': konu,
      '{{gun_adi}}': dateLabelFull,
      '{{mudur_adi}}': principalName ?? 'Okul Müdürü',
    });
    const paragrafHtml = escapeHtml(paragraf).replace(/\n/g, '<br>');
    const esc = escapeHtml;
    const cell = (v: string | undefined | null) => esc(v ?? '—');

    const gelmeyenRows = bosDersData.gelmeyenler
      .map(
        (r) =>
          `<tr><td>${esc(r.teacher_name)}</td>${lessonCols.map((n) => `<td>${cell(r.lessons[n])}</td>`).join('')}<td>${cell(r.absent_type)}</td></tr>`,
      )
      .join('');

    const gorevRows = bosDersData.gorevlendirilenler
      .map(
        (r) =>
          `<tr><td>${esc(r.teacher_name)}</td>${lessonCols.map((n) => `<td>${cell(r.lessons[n])}</td>`).join('')}<td></td></tr>`,
      )
      .join('');

    const imzaListesiRows =
      bosDersData.gorevlendirilenler.length > 0
        ? bosDersData.gorevlendirilenler
            .map(
              (r, i) =>
                `<tr><td>${i + 1}.</td><td>${esc(r.teacher_name)}</td><td></td><td></td></tr>`,
            )
            .join('')
        : '';

    const headerCells = lessonCols.map((n) => `<th>${n}.Ders</th>`).join('');
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title> </title>
  <style>
    @media print {
      @page { margin: 5mm; size: auto; }
      body { margin: 0; padding: 8px; }
      .paragraf, td.preserve-ws { white-space: pre-wrap !important; }
    }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; padding: 8px; margin: 0; }
    .header { text-align: center; margin-bottom: 8px; }
    .header p { margin: 1px 0; }
    .konu { margin: 6px 0; font-size: 10pt; }
    .paragraf { margin: 8px 0; text-align: justify; line-height: 1.5; font-size: 10pt; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; font-size: 9pt; }
    th { background: #f5f5f5; }
    .day-title { font-weight: bold; font-size: 12pt; margin: 8px 0 4px; }
    .imza { margin-top: 12px; text-align: right; font-size: 10pt; }
    .imza-block { text-align: right; margin-top: 12px; }
    .imza-block .line { border-bottom: 1px solid #000; width: 180px; margin-left: auto; margin-bottom: 4px; }
    .imza-block .name { font-weight: bold; }
    .imza-block .unvan { font-size: 9pt; color: #333; }
    .imza-listesi { margin-top: 12px; }
    .imza-listesi table th { text-align: left; }
  </style>
</head>
<body>
  <div class="header">
    <p>T.C.</p>
    ${schoolDistrict ? `<p>${esc(schoolDistrict.toUpperCase())} KAYMAKAMLIĞI</p>` : ''}
    <p>${esc(schoolName)}</p>
  </div>
  <div class="konu">
    <p>Sayı: _______________</p>
    <p>Tarih: ${esc(today)}</p>
    <p><strong>Konu:</strong> ${esc(konu)}</p>
  </div>
  <div class="paragraf">${paragrafHtml}</div>
  <div class="imza-block">
    <div class="line">&nbsp;</div>
    <p class="name">${esc(principalName?.trim() || '_________________________')}</p>
    <p class="unvan">Okul Müdürü</p>
  </div>
  <p class="day-title">${esc(dateLabelFull)}</p>
  <p><strong>Gelmeyen Öğretmen</strong></p>
  <table>
    <thead><tr><th>Gelmeyen Öğretmenin Adı Soyadı</th>${headerCells}<th>Mazeret Nedeni</th></tr></thead>
    <tbody>${gelmeyenRows || '<tr><td colspan="' + (lessonCols.length + 2) + '">Bu tarihte gelmeyen öğretmen bulunmamaktadır.</td></tr>'}</tbody>
  </table>
  <p><strong>Yerine Görevlendirilen Nöbetçi Öğretmen</strong></p>
  <table>
    <thead><tr><th>Nöbetçi Öğretmenin Adı Soyadı</th>${headerCells}<th>İmza</th></tr></thead>
    <tbody>${gorevRows || '<tr><td colspan="' + (lessonCols.length + 2) + '">Bu tarihte yerine görevlendirilen öğretmen bulunmamaktadır.</td></tr>'}</tbody>
  </table>
  <div class="imza-block" style="margin-top: 12px;">
    <div class="line">&nbsp;</div>
    <p class="name">${esc(deputyPrincipalName?.trim() || '_________________________')}</p>
    <p class="unvan">Nöbetçi Müdür Yardımcısı</p>
  </div>
  ${imzaListesiRows ? `
  <div class="imza-listesi">
    <p><strong>Görev Verilen Öğretmenler İmza Listesi</strong></p>
    <table>
      <thead><tr><th>Sıra</th><th>Adı Soyadı</th><th>İmza</th><th>Tarih</th></tr></thead>
      <tbody>${imzaListesiRows}</tbody>
    </table>
  </div>
  ` : ''}
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Pop-up engellendi. Yazdırmak için tarayıcı ayarlarını kontrol edin.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    const runPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          w.close();
        } catch {
          /* ignore */
        }
      }, 300);
    };
    if (w.document.readyState === 'complete') {
      setTimeout(runPrint, 0);
    } else {
      w.onload = runPrint;
    }
  };

  const handlePrintHaftalik = () => {
    if (!haftalikData || !schoolName) {
      toast.error('Veri yok veya okul adı eksik');
      return;
    }
    const weekRange = haftalikDateRange.trim() || (() => {
      const firstDay = haftalikData.days[0];
      const lastDay = haftalikData.days[haftalikData.days.length - 1];
      if (!firstDay || !lastDay) return '';
      const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      return firstDay.date === lastDay.date ? fmt(new Date(firstDay.date + 'T12:00:00')) : fmt(new Date(firstDay.date + 'T12:00:00')) + ' - ' + fmt(new Date(lastDay.date + 'T12:00:00'));
    })();
    const areaDisplayName = (a: string) => haftalikEditedAreaNames[a] ?? a;
    const hasDouble = haftalikData.education_mode === 'double' && haftalikData.days.some((d) => d.morning || d.afternoon);
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const getCellValue = (date: string, area: string, shift?: 'morning' | 'afternoon') => {
      const key = shift ? `${date}:${area}:${shift}` : `${date}:${area}`;
      const day = haftalikData!.days.find((d) => d.date === date);
      let raw: string;
      if (haftalikEditedCells[key] !== undefined) {
        raw = haftalikEditedCells[key];
      } else if (shift && day) {
        raw = shift === 'morning' ? (day.morning?.[area] ?? '') : (day.afternoon?.[area] ?? '');
      } else {
        raw = day?.row[area] ?? '';
      }
      return escapeHtml(raw).replace(/\n/g, '<br/>');
    };
    const areaHeaders = hasDouble
      ? haftalikData.areas.map((a) => `<th colspan="2" style="padding:4px 6px;font-size:8pt;border:1px solid #000;">${areaDisplayName(a)}</th>`).join('')
      : haftalikData.areas.map((a) => `<th style="padding:4px 6px;font-size:8pt;border:1px solid #000;">${areaDisplayName(a)}</th>`).join('');
    const subHeaders = hasDouble
      ? haftalikData.areas.flatMap((a) => ['<th style="padding:2px 4px;font-size:7pt;border:1px solid #000;">SABAH</th>', '<th style="padding:2px 4px;font-size:7pt;border:1px solid #000;">ÖĞLEN</th>']).join('')
      : '';
    const rows = haftalikData.days
      .map((d) => {
        const cellStyle = 'padding:4px 6px;font-size:8pt;border:1px solid #000;white-space:pre-wrap';
        const cells = hasDouble
          ? haftalikData.areas.flatMap((a) => [
              `<td class="preserve-ws" style="${cellStyle}">${getCellValue(d.date, a, 'morning')}</td>`,
              `<td class="preserve-ws" style="${cellStyle}">${getCellValue(d.date, a, 'afternoon')}</td>`,
            ])
          : haftalikData.areas.map((a) => `<td class="preserve-ws" style="${cellStyle}">${getCellValue(d.date, a)}</td>`);
        return `<tr><td style="padding:4px 6px;font-size:9pt;border:1px solid #000;font-weight:600;">${d.day_name}</td>${cells.join('')}</tr>`;
      })
      .join('');
    const dutiesHtml = (haftalikDutyDutiesText || haftalikData.duty_duties_text)
      .split('\n')
      .filter(Boolean)
      .map((line) => `<li>${escapeHtml(line.replace(/^\d+[.-]\s*/, ''))}</li>`)
      .join('');

    const branchByName = new Map<string, string | null>();
    for (const t of haftalikData.teachers ?? []) {
      if (t.name && !branchByName.has(t.name)) branchByName.set(t.name, t.branch);
    }
    const allTeacherNames = new Set<string>();
    for (const d of haftalikData.days) {
      for (const a of haftalikData.areas) {
        if (hasDouble && (d.morning || d.afternoon)) {
          const rawM = haftalikEditedCells[`${d.date}:${a}:morning`] ?? d.morning?.[a] ?? '';
          const rawO = haftalikEditedCells[`${d.date}:${a}:afternoon`] ?? d.afternoon?.[a] ?? '';
          [rawM, rawO].forEach((raw) => raw.split(/\n/).forEach((n) => { const t = n.trim(); if (t && t !== '—') allTeacherNames.add(t); }));
        } else {
          const raw = haftalikEditedCells[`${d.date}:${a}`] ?? d.row[a] ?? '';
          raw.split(/\n/).forEach((n) => { const t = n.trim(); if (t && t !== '—') allTeacherNames.add(t); });
        }
      }
    }
    const sortedTeachers = Array.from(allTeacherNames).sort((a, b) => a.localeCompare(b, 'tr'));
    const imzaRows = sortedTeachers
      .map((name) => {
        const branch = branchByName.get(name) ?? null;
        const branchCell = branch ? escapeHtml(branch) : '';
        return `<tr><td style="padding:4px 8px;border:1px solid #000;">${escapeHtml(name)}</td><td style="padding:4px 8px;border:1px solid #000;">${branchCell}</td><td style="padding:4px 20px;border:1px solid #000;">_________________________</td></tr>`;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title> </title>
  <style>
    @media print {
      @page { margin: 5mm; size: auto; }
      body { margin: 0; padding: 8px; }
      td.preserve-ws, .paragraf, .duties li { white-space: pre-wrap !important; }
    }
    body { font-family: Arial, sans-serif; font-size: 10pt; padding: 8px; margin: 0; }
    .header { text-align: center; margin-bottom: 6px; }
    .header .line { font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.3; }
    .header .title { font-size: 12pt; font-weight: bold; margin: 4px 0 2px 0; }
    .header hr { border: none; border-top: 1px solid #000; margin: 4px 0 6px 0; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9pt; }
    th, td { border: 1px solid #000; padding: 6px 8px; }
    td.preserve-ws { white-space: pre-wrap; }
    th { background: #f0f0f0; }
    .duties { margin-top: 10px; font-size: 9pt; line-height: 1.4; }
    .duties ol { margin: 4px 0; padding-left: 20px; }
    .duties li { margin: 1px 0; white-space: pre-wrap; }
    .footer { margin-top: 10px; text-align: right; font-size: 10pt; }
    .footer .name { font-weight: bold; }
    .footer .unvan { font-size: 9pt; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <p class="line">T.C.</p>
    ${schoolDistrict ? `<p class="line">${schoolDistrict.toUpperCase()} KAYMAKAMLIĞI</p>` : ''}
    <p class="line">${schoolName}</p>
    <p class="title">${haftalikBaslik || DEFAULT_HAFTALIK_BASLIK}</p>
    <hr/>
    <p class="sub" style="font-size:9pt;color:#444;margin:0;">${weekRange}</p>
  </div>
  <table>
    <thead>
      <tr><th rowspan="${hasDouble ? 2 : 1}" style="width:100px;">Gün</th>${areaHeaders}</tr>
      ${hasDouble ? `<tr>${subHeaders}</tr>` : ''}
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer"><span class="name">${principalName || '_________________________'}</span><br/><span class="unvan">Okul Müdürü</span></p>
  <div class="duties">
    <p><strong>NÖBETÇİ ÖĞRETMENLERİN GÖREVLERİ</strong></p>
    <ol>${dutiesHtml}</ol>
  </div>
  ${imzaRows ? `
  <div class="imza-list" style="margin-top:10px;break-inside:avoid;">
    <p style="font-weight:bold;margin-bottom:4px;">ÖĞRETMEN İMZA LİSTESİ</p>
    <table style="width:100%;max-width:500px;border-collapse:collapse;font-size:9pt;">
      <thead><tr><th style="padding:4px 8px;border:1px solid #000;text-align:left;">Ad Soyad</th><th style="padding:4px 8px;border:1px solid #000;text-align:left;">Branş</th><th style="padding:4px 20px;border:1px solid #000;text-align:left;">İmza</th></tr></thead>
      <tbody>${imzaRows}</tbody>
    </table>
  </div>
  ` : ''}
  <script>
    try { history.replaceState({}, '', location.origin + '/'); } catch(e){}
    window.print();
    window.close();
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Pop-up engellendi. Yazdırmak için tarayıcı ayarlarını kontrol edin.');
      return;
    }
    w.document.write(html);
    w.document.close();
    try { w.history.replaceState({}, '', window.location.origin + '/'); } catch (_) {}
  };

  const MONTH_NAMES = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

  const handlePrintAylik = () => {
    if (!aylikData || !aylikData.school_name) {
      toast.error('Veri yok veya okul adı eksik');
      return;
    }
    const docTitle = formatAylikDocTitle(aylikData, MONTH_NAMES);
    const district = aylikData.school_district ?? schoolDistrict;
    const school = aylikData.school_name ?? schoolName;
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hasAfternoon = aylikData.education_mode === 'double';

    const areaHeaders = aylikData.areas
      .map(
        (a) =>
          hasAfternoon
            ? `<th colspan="2" style="padding:4px 6px;font-size:8pt;border:1px solid #000;">${escapeHtml(a)}</th>`
            : `<th style="padding:4px 6px;font-size:8pt;border:1px solid #000;">${escapeHtml(a)}</th>`,
      )
      .join('');
    const subHeaders = aylikData.areas
      .map((a) =>
        hasAfternoon
          ? `<th style="padding:2px 4px;font-size:7pt;border:1px solid #000;">SABAH</th><th style="padding:2px 4px;font-size:7pt;border:1px solid #000;">ÖĞLEN</th>`
          : `<th style="padding:2px 4px;font-size:7pt;border:1px solid #000;">${escapeHtml(a)}</th>`,
      )
      .join('');
    const cellStyle = 'padding:4px 6px;font-size:8pt;border:1px solid #000;white-space:pre-wrap';
    const rows = aylikData.dates.map((d) => {
      const cells = aylikData.areas.flatMap((area) => {
        const morning = escapeHtml(d.morning[area] ?? '').replace(/\n/g, '<br/>');
        const afternoon = escapeHtml(d.afternoon[area] ?? '').replace(/\n/g, '<br/>');
        return hasAfternoon
          ? [`<td class="preserve-ws" style="${cellStyle}">${morning}</td><td class="preserve-ws" style="${cellStyle}">${afternoon}</td>`]
          : [`<td class="preserve-ws" style="${cellStyle}">${morning}</td>`];
      });
      return `<tr><td style="padding:4px 6px;font-size:9pt;border:1px solid #000;">${fmtDate(d.date)}</td><td style="padding:4px 6px;font-size:9pt;border:1px solid #000;font-weight:600;">${escapeHtml(d.day_name)}</td>${cells.join('')}</tr>`;
    });

    const imzaTarihStr = aylikImzaTarihi
      ? new Date(aylikImzaTarihi + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title> </title>
  <style>
    @media print {
      @page { margin: 5mm; size: auto; }
      body { margin: 0; padding: 8px; }
      td.preserve-ws { white-space: pre-wrap !important; }
    }
    body { font-family: Arial, sans-serif; font-size: 10pt; padding: 8px; margin: 0; }
    .header { text-align: center; margin-bottom: 6px; }
    .header .line { font-size: 11pt; font-weight: bold; margin: 0; line-height: 1.4; }
    .header .title { font-size: 14pt; font-weight: bold; color: #1565c0; margin: 4px 0 0 0; }
    .header hr { border: none; border-top: 1px solid #000; margin: 4px 0 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
    td.preserve-ws { white-space: pre-wrap; }
    th { background: #f5f5f5; font-weight: bold; }
    .footer { margin-top: 10px; text-align: right; font-size: 10pt; }
    .footer .name { font-weight: bold; }
    .footer .date { font-size: 9pt; color: #333; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <p class="line">T.C.</p>
    ${district ? `<p class="line">${escapeHtml(district.toUpperCase())} KAYMAKAMLIĞI</p>` : ''}
    <p class="line">${escapeHtml(school)}</p>
    <p class="title">${escapeHtml(docTitle)}</p>
    <hr/>
  </div>
  <table>
    <thead>
      <tr><th rowspan="${hasAfternoon ? 2 : 1}" style="padding:4px 6px;">TARİH</th><th rowspan="${hasAfternoon ? 2 : 1}" style="padding:4px 6px;">GÜN</th>${areaHeaders}</tr>
      ${hasAfternoon ? `<tr>${subHeaders}</tr>` : ''}
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <p class="footer">
    <span class="name">${escapeHtml(aylikData.principal_name || principalName || '_________________________')}</span><br/>
    ${imzaTarihStr ? `<span class="date">${escapeHtml(imzaTarihStr)}</span>` : ''}
  </p>
  <script>
    try { history.replaceState({}, '', location.origin + '/'); } catch(e){}
    window.print();
    window.close();
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Pop-up engellendi. Yazdırmak için tarayıcı ayarlarını kontrol edin.');
      return;
    }
    w.document.write(html);
    w.document.close();
    try { w.history.replaceState({}, '', window.location.origin + '/'); } catch (_) {}
  };

  const bosLessonCols = useMemo(() => {
    if (!bosDersData) return [] as number[];
    return bosDersData.lesson_columns?.length
      ? bosDersData.lesson_columns
      : Array.from({ length: bosDersData.max_lessons }, (_, i) => i + 1);
  }, [bosDersData]);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DutyPageHeader
        icon={FileSignature}
        title="Tebliğ"
        description="Haftalık, aylık nöbet çizelgesi ve boş ders görevlendirme tebliği. Metinleri düzenleyip yazdırabilirsiniz."
        color="purple"
        actions={
          <Button onClick={handleSaveAll} disabled={saving}>
            <Save className="size-4 mr-2" />
            Tümünü Kaydet
          </Button>
        }
      />

      {/* Haftalık Nöbet Çizelgesi */}
      <Card className="border-l-4 border-l-violet-500 dark:border-l-violet-400">
        <CardHeader className="pb-2 bg-violet-50/50 dark:bg-violet-950/20 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-base text-violet-800 dark:text-violet-200">
            <CalendarRange className="size-4 text-violet-600 dark:text-violet-400" />
            Haftalık Nöbet Çizelgesi
          </CardTitle>
          <CardDescription>
            Hafta seçin, başlık ve tabloyu düzenleyip yazdırın. Okul adı ve müdür imzası otomatik gelir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="haftalik-baslik">Başlık</Label>
              <Input
                id="haftalik-baslik"
                value={haftalikBaslik}
                onChange={(e) => setHaftalikBaslik(e.target.value)}
                placeholder={DEFAULT_HAFTALIK_BASLIK}
                className="w-64"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="haftalik-week">Hafta (Pazartesi)</Label>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Input
                  id="haftalik-week"
                  type="date"
                  value={haftalikWeekStart}
                  onChange={(e) => {
                    setHaftalikWeekStart(getMondayOfWeek(e.target.value));
                    setHaftalikEditedCells({});
                    setHaftalikEditedAreaNames({});
                  }}
                  className="w-44"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="haftalik-date-range">Tarih aralığı (yazdırmada görünür)</Label>
              <Input
                id="haftalik-date-range"
                value={haftalikDateRange}
                onChange={(e) => setHaftalikDateRange(e.target.value)}
                placeholder="Örn. 23 Şubat 2026 - 27 Şubat 2026"
                className="w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchHaftalikCizelge} disabled={haftalikLoading}>
              {haftalikLoading ? 'Yükleniyor…' : 'Yenile'}
            </Button>
            {haftalikData && (
              <Button size="sm" onClick={handlePrintHaftalik}>
                <Printer className="size-4 mr-2" />
                Yazdır
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSaveHaftalik} disabled={saving}>
              <Save className="size-4 mr-2" />
              Kaydet
            </Button>
          </div>

          <details className="group rounded-lg border border-border/50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              NÖBETÇİ ÖĞRETMENLERİN GÖREVLERİ metnini özelleştir
            </summary>
            <textarea
              value={haftalikDutyDutiesText}
              onChange={(e) => setHaftalikDutyDutiesText(e.target.value)}
              className="mt-3 w-full h-28 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono whitespace-pre-wrap resize-y"
              placeholder="1- Günlük vakit çizelgesini uygulamak.\n2- Öğretmenlerin derslere..."
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-muted-foreground">Her satır bir madde. Yazdırmada kullanılır.</p>
          </details>

          <p className="text-xs text-muted-foreground">
            Başlık formatı: T.C. → İlçe KAYMAKAMLIĞI → Okul adı → HAFTALIK NÖBET ÇİZELGESİ. Müdür ve ilçe Nöbet → Yerler → Okul Ayarlarından gelir.
          </p>
          <p className="text-xs text-muted-foreground">
            Yazdırırken tarayıcı penceresinde &quot;Üst bilgi ve alt bilgi&quot;yi kapatırsanız kağıtta sadece belge görünür.
          </p>

          {haftalikData && haftalikData.areas.length > 0 && (
            <div className="table-x-scroll rounded-lg border">
              <p className="px-3 py-2 text-xs text-muted-foreground border-b">
                Tablo hücrelerine tıklayarak düzenleyebilirsiniz. {haftalikData.education_mode === 'double' && '(İkili eğitim: SABAH / ÖĞLEN)'}
              </p>
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  {haftalikData.education_mode === 'double' && haftalikData.days.some((d) => d.morning || d.afternoon) ? (
                    <>
                      <tr className="bg-muted">
                        <th rowSpan={2} className="px-3 py-2 text-left border-b align-middle">Gün</th>
                        {haftalikData.areas.map((a) => (
                          <th key={a} colSpan={2} className="px-2 py-1 border-b text-center">
                            <input
                              type="text"
                              value={haftalikEditedAreaNames[a] ?? a}
                              onChange={(e) => setHaftalikEditedAreaNames((prev) => ({ ...prev, [a]: e.target.value }))}
                              className="w-full min-w-[80px] px-2 py-1 text-center text-sm font-medium border rounded bg-muted/80"
                            />
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted">
                        {haftalikData.areas.flatMap((a) => [
                          <th key={`${a}-s`} className="px-2 py-1 border-b text-center text-xs">SABAH</th>,
                          <th key={`${a}-o`} className="px-2 py-1 border-b text-center text-xs">ÖĞLEN</th>,
                        ])}
                      </tr>
                    </>
                  ) : (
                    <tr className="bg-muted">
                      <th className="px-3 py-2 text-left border-b">Gün</th>
                      {haftalikData.areas.map((a) => (
                        <th key={a} className="px-2 py-1 border-b text-center">
                          <input
                            type="text"
                            value={haftalikEditedAreaNames[a] ?? a}
                            onChange={(e) => setHaftalikEditedAreaNames((prev) => ({ ...prev, [a]: e.target.value }))}
                            className="w-full min-w-[100px] px-2 py-1 text-center text-sm font-medium border rounded bg-muted/80"
                          />
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {haftalikData.days.map((d) => (
                    <tr key={d.date} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{d.day_name}</td>
                      {haftalikData.education_mode === 'double' && (d.morning || d.afternoon) ? (
                        haftalikData.areas.flatMap((a) => {
                          const keyM = `${d.date}:${a}:morning`;
                          const keyO = `${d.date}:${a}:afternoon`;
                          const valM = haftalikEditedCells[keyM] ?? (d.morning?.[a] ?? '');
                          const valO = haftalikEditedCells[keyO] ?? (d.afternoon?.[a] ?? '');
                          const lineM = (valM.match(/\n/g) || []).length + 1;
                          const lineO = (valO.match(/\n/g) || []).length + 1;
                          return [
                            <td key={`${a}-s`} className="px-2 py-1 text-center align-top">
                              <textarea
                                value={valM}
                                onChange={(e) => setHaftalikEditedCells((prev) => ({ ...prev, [keyM]: e.target.value }))}
                                rows={Math.min(3, Math.max(1, lineM))}
                                className="w-full min-w-[70px] px-2 py-1 text-center text-xs border rounded bg-background focus:ring-2 focus:ring-primary/20 resize-none whitespace-pre-wrap"
                              />
                            </td>,
                            <td key={`${a}-o`} className="px-2 py-1 text-center align-top">
                              <textarea
                                value={valO}
                                onChange={(e) => setHaftalikEditedCells((prev) => ({ ...prev, [keyO]: e.target.value }))}
                                rows={Math.min(3, Math.max(1, lineO))}
                                className="w-full min-w-[70px] px-2 py-1 text-center text-xs border rounded bg-background focus:ring-2 focus:ring-primary/20 resize-none whitespace-pre-wrap"
                              />
                            </td>,
                          ];
                        })
                      ) : (
                        haftalikData.areas.map((a) => {
                          const key = `${d.date}:${a}`;
                          const val = haftalikEditedCells[key] ?? (d.row[a] || '');
                          const lineCount = (val.match(/\n/g) || []).length + 1;
                          return (
                            <td key={a} className="px-2 py-1 text-center align-top">
                              <textarea
                                value={val}
                                onChange={(e) => setHaftalikEditedCells((prev) => ({ ...prev, [key]: e.target.value }))}
                                rows={Math.min(4, Math.max(1, lineCount))}
                                className="w-full min-w-[80px] px-2 py-1 text-center text-sm border rounded bg-background focus:ring-2 focus:ring-primary/20 resize-none"
                              />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {haftalikData && haftalikData.areas.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu hafta için nöbet planı bulunmuyor.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Aylık Nöbet Tebliği */}
      <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
        <CardHeader className="pb-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-base text-blue-800 dark:text-blue-200">
            <CalendarRange className="size-4 text-blue-600 dark:text-blue-400" />
            Aylık Nöbet Tebliği
          </CardTitle>
          <CardDescription>
            Ay/yıl veya başlangıç–bitiş tarihi seçin (en fazla 93 gün). İmza tarihi isteğe bağlıdır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {aylikData && (
            <div className="rounded-lg border border-border/60 bg-muted/30 py-4 px-4 text-center">
              <p className="text-sm font-bold">T.C.</p>
              {(aylikData.school_district ?? schoolDistrict) && (
                <p className="text-sm font-bold">{(aylikData.school_district ?? schoolDistrict)!.toUpperCase()} KAYMAKAMLIĞI</p>
              )}
              <p className="text-sm font-bold">{aylikData.school_name ?? schoolName}</p>
              <p className="mt-1 text-sm font-bold text-primary">
                {formatAylikDocTitle(aylikData, MONTH_NAMES)}
              </p>
              <hr className="my-2 border-border" />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="aylik-month">Ay</Label>
              <select
                id="aylik-month"
                value={parseInt(aylikFrom.slice(5, 7), 10)}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  const y = parseInt(aylikFrom.slice(0, 4), 10);
                  setAylikFrom(`${y}-${String(m).padStart(2, '0')}-01`);
                  setAylikTo(toYMD(new Date(y, m, 0)));
                }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-36"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name.charAt(0) + name.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aylik-year">Yıl</Label>
              <Input
                id="aylik-year"
                type="number"
                min={2024}
                max={2030}
                value={parseInt(aylikFrom.slice(0, 4), 10)}
                onChange={(e) => {
                  const y = Number(e.target.value) || new Date().getFullYear();
                  const m = parseInt(aylikFrom.slice(5, 7), 10);
                  setAylikFrom(`${y}-${String(m).padStart(2, '0')}-01`);
                  setAylikTo(toYMD(new Date(y, m, 0)));
                }}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aylik-from">Başlangıç</Label>
              <Input
                id="aylik-from"
                type="date"
                value={aylikFrom}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (v > aylikTo) {
                    toast.error('Başlangıç bitişten sonra olamaz.');
                    return;
                  }
                  setAylikFrom(v);
                }}
                className="w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aylik-to">Bitiş</Label>
              <Input
                id="aylik-to"
                type="date"
                value={aylikTo}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (v < aylikFrom) {
                    toast.error('Bitiş başlangıçtan önce olamaz.');
                    return;
                  }
                  setAylikTo(v);
                }}
                className="w-44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aylik-imza-tarihi">İmza tarihi (opsiyonel)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="aylik-imza-tarihi"
                  type="date"
                  value={aylikImzaTarihi}
                  onChange={(e) => setAylikImzaTarihi(e.target.value)}
                  className="w-44"
                />
                {aylikImzaTarihi ? (
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setAylikImzaTarihi('')}>
                    Temizle
                  </Button>
                ) : null}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAylikCizelge} disabled={aylikLoading}>
              {aylikLoading ? 'Yükleniyor…' : 'Yenile'}
            </Button>
            {aylikData && (
              <Button size="sm" onClick={handlePrintAylik}>
                <Printer className="size-4 mr-2" />
                Yazdır
              </Button>
            )}
          </div>
          {aylikData && aylikData.areas.length > 0 && (
            <div className="table-x-scroll rounded-xl border border-border/60 shadow-sm">
              <p className="px-4 py-2.5 text-xs text-muted-foreground border-b bg-muted/40">
                {aylikData.education_mode === 'double' ? 'SABAH / ÖĞLEN sütunları' : 'Tekli eğitim'}
              </p>
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  {aylikData.education_mode === 'double' ? (
                    <>
                      <tr className="bg-muted/60">
                        <th rowSpan={2} className="px-3 py-2.5 border-b border-r font-semibold text-left align-middle text-xs uppercase tracking-wide text-muted-foreground">TARİH</th>
                        <th rowSpan={2} className="px-3 py-2.5 border-b border-r font-semibold text-left align-middle text-xs uppercase tracking-wide text-muted-foreground">GÜN</th>
                        {aylikData.areas.map((a) => (
                          <th key={a} colSpan={2} className="px-2 py-2 border-b font-semibold text-center text-xs">{a}</th>
                        ))}
                      </tr>
                      <tr className="bg-muted/60">
                        {aylikData.areas.flatMap((a) => [
                          <th key={`${a}-s`} className="px-2 py-1.5 border-b border-r last:border-r-0 font-medium text-center text-[10px] text-muted-foreground">SABAH</th>,
                          <th key={`${a}-o`} className="px-2 py-1.5 border-b font-medium text-center text-[10px] text-muted-foreground">ÖĞLEN</th>,
                        ])}
                      </tr>
                    </>
                  ) : (
                    <tr className="bg-muted/60">
                      <th className="px-3 py-2.5 border-b border-r font-semibold text-left text-xs uppercase tracking-wide text-muted-foreground">TARİH</th>
                      <th className="px-3 py-2.5 border-b border-r font-semibold text-left text-xs uppercase tracking-wide text-muted-foreground">GÜN</th>
                      {aylikData.areas.map((a) => (
                        <th key={a} className="px-2 py-2 border-b font-semibold text-center text-xs">{a}</th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {aylikData.dates.map((d, idx) => (
                    <tr key={d.date} className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} [&>td:last-child]:border-r-0`}>
                      <td className="px-3 py-2 border-b border-r font-medium text-muted-foreground">{new Date(d.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-3 py-2 border-b border-r font-medium">{d.day_name}</td>
                      {aylikData.areas.flatMap((a) =>
                        aylikData.education_mode === 'double' ? (
                          [
                            <td key={`${a}-s`} className="px-2 py-2 border-b border-r text-center text-xs align-top whitespace-pre-wrap min-w-[70px]">{d.morning[a] || '—'}</td>,
                            <td key={`${a}-o`} className="px-2 py-2 border-b border-r text-center text-xs align-top whitespace-pre-wrap min-w-[70px]">{d.afternoon[a] || '—'}</td>,
                          ]
                        ) : (
                          [<td key={a} className="px-2 py-2 border-b border-r text-center text-xs align-top whitespace-pre-wrap min-w-[70px]">{d.morning[a] || '—'}</td>]
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {aylikData && aylikData.areas.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu ay için nöbet planı bulunmuyor.
            </p>
          )}
          {aylikData && (
            <div className="mt-6 flex justify-end gap-8 border-t pt-4">
              <div className="text-right">
                <p className="font-semibold">{aylikData.principal_name || principalName || '—'}</p>
                {aylikImzaTarihi ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(aylikImzaTarihi + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nöbetçi Öğretmen Boş Ders Görevlendirme */}
      <Card className="border-l-4 border-l-amber-500 dark:border-l-amber-400">
        <CardHeader className="pb-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
            <BookOpen className="size-4 text-amber-600 dark:text-amber-400" />
            Nöbetçi Öğretmen Boş Ders Görevlendirme
          </CardTitle>
          <CardDescription>
            Gün seçilince o güne ait gelmeyen ve yerine görevlendirilen öğretmenler otomatik doldurulur. Metinleri düzenleyip MEB formatında yazdırabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm font-medium">Belge imza bilgileri (haftalık çizelgede de kullanılır)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="principal-name">Müdür adı</Label>
                <Input
                  id="principal-name"
                  value={principalName ?? ''}
                  onChange={(e) => setPrincipalName(e.target.value?.trim() || null)}
                  placeholder="Örn. Ahmet Yılmaz"
                  className="mt-1 max-w-xs"
                />
              </div>
              <div>
                <Label htmlFor="deputy-principal">Nöbetçi müdür yardımcısı adı</Label>
                <Input
                  id="deputy-principal"
                  value={deputyPrincipalName ?? ''}
                  onChange={(e) => setDeputyPrincipalName(e.target.value || null)}
                  placeholder="Örn. Ahmet Yılmaz"
                  className="mt-1 max-w-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Konu metni</Label>
              <Input
                value={bosDersKonu}
                onChange={(e) => setBosDersKonu(e.target.value)}
                placeholder="Örn. Nöbet Görevi"
                className="mt-1 max-w-xs"
              />
            </div>
            <div>
              <Label>{'Paragraf metni ({{gun_adi}}, {{okul_adi}} vb. kullanılabilir)'}</Label>
              <textarea
                value={bosDersParagraf}
                onChange={(e) => setBosDersParagraf(e.target.value)}
                className="mt-1 w-full h-28 rounded-lg border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap resize-y"
                placeholder="Ana paragraf metni..."
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {BOS_DERS_PLACEHOLDERS.map((p) => (
                  <span key={p.key} className="mr-3">
                    <code className="bg-muted px-1 rounded">{p.key}</code>
                  </span>
                ))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveBosDers} disabled={saving}>
                <Save className="size-4 mr-2" />
                Metinleri Kaydet
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="bos-ders-date">Tarih seçin</Label>
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Input
                  id="bos-ders-date"
                  type="date"
                  value={bosDersDate}
                  onChange={(e) => setBosDersDate(e.target.value)}
                  className="w-44"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBosDersTeblig} disabled={bosDersLoading}>
              {bosDersLoading ? 'Yükleniyor…' : 'Yenile'}
            </Button>
            {bosDersData && (
              <Button size="sm" onClick={handlePrintBosDers}>
                <Printer className="size-4 mr-2" />
                Yazdır
              </Button>
            )}
          </div>

          {bosDersLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : bosDersData ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {bosDersData.date_label ?? bosDersData.day_name} — Gelmeyen Öğretmenler
                </h4>
                <div className="table-x-scroll rounded-lg border">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left px-3 py-2 border-b">Adı Soyadı</th>
                        {bosLessonCols.map((n) => (
                          <th key={n} className="px-2 py-2 border-b text-center">
                            {n}.Ders
                          </th>
                        ))}
                        <th className="text-left px-3 py-2 border-b">Mazeret</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bosDersData.gelmeyenler.length === 0 ? (
                        <tr>
                          <td colSpan={bosLessonCols.length + 2} className="px-3 py-4 text-center text-muted-foreground">
                            Bu tarihte gelmeyen öğretmen bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        bosDersData.gelmeyenler.map((r) => (
                          <tr key={r.teacher_id} className="border-b last:border-0">
                            <td className="px-3 py-2">{r.teacher_name}</td>
                            {bosLessonCols.map((n) => (
                              <td key={n} className="px-2 py-2 text-center">
                                {r.lessons[n] ?? '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2">{r.absent_type ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Yerine Görevlendirilen Öğretmenler</h4>
                <div className="table-x-scroll rounded-lg border">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left px-3 py-2 border-b">Adı Soyadı</th>
                        {bosLessonCols.map((n) => (
                          <th key={n} className="px-2 py-2 border-b text-center">
                            {n}.Ders
                          </th>
                        ))}
                        <th className="text-left px-3 py-2 border-b">İmza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bosDersData.gorevlendirilenler.length === 0 ? (
                        <tr>
                          <td colSpan={bosLessonCols.length + 2} className="px-3 py-4 text-center text-muted-foreground">
                            Bu tarihte yerine görevlendirilen öğretmen bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        bosDersData.gorevlendirilenler.map((r) => (
                          <tr key={r.teacher_id} className="border-b last:border-0">
                            <td className="px-3 py-2">{r.teacher_name}</td>
                            {bosLessonCols.map((n) => (
                              <td key={n} className="px-2 py-2 text-center">
                                {r.lessons[n] ?? '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2"> </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tarih seçin ve veriler yüklenecektir.
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={printRef} className="hidden print:block" aria-hidden="true" />
    </div>
  );
}
