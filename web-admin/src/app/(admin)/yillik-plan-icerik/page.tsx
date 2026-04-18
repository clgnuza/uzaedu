'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, createFetchTimeoutSignal, isAbortError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen, Sparkles, Check, Circle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { filterBilsemCatalogSubjects } from '@/lib/bilsem-catalog-subjects';
import { BILSEM_ALT_GRUPLAR, BILSEM_ANA_GRUPLAR } from '@/lib/bilsem-groups';

type PlanSummaryRow = {
  subject_code: string;
  subject_label: string;
  grade: number | null;
  ana_grup?: string | null;
  alt_grup?: string | null;
  academic_year: string;
  week_count: number;
};

type YillikPlanIcerikItem = {
  id: string;
  subject_code: string;
  subject_label: string;
  grade: number | null;
  ana_grup?: string | null;
  alt_grup?: string | null;
  section: string | null;
  academic_year: string;
  week_order: number;
  hafta_label?: string | null;
  ay?: string | null;
  unite: string | null;
  konu: string | null;
  kazanimlar: string | null;
  ders_saati: number;
  belirli_gun_haftalar?: string | null;
  surec_bilesenleri?: string | null;
  olcme_degerlendirme?: string | null;
  sosyal_duygusal?: string | null;
  degerler?: string | null;
  okuryazarlik_becerileri?: string | null;
  zenginlestirme?: string | null;
  okul_temelli_planlama?: string | null;
  sort_order: number | null;
};

function getAcademicYears(): string[] {
  const years: string[] = [];
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = -1; i < 5; i++) {
    const y = startYear + i;
    years.push(`${y}-${y + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

const SECTIONS = [
  { value: 'ders', label: 'Ders' },
  { value: 'secmeli', label: 'Seçmeli' },
  { value: 'iho', label: 'İHO' },
];

/** Öğretim yılı ay sırası (Eylül → Haziran) */
const AYLAR_ORDER = [
  'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
];

const LISE_SCHOOL_PROFILES = [
  { value: 'anadolu', label: 'Anadolu Lisesi' },
  { value: 'fen', label: 'Fen Lisesi' },
  { value: 'sosyal', label: 'Sosyal Bilimler L.' },
  { value: 'aihl', label: 'Anadolu İmam Hatip L.' },
] as const;

function getBaseSubjectCode(code: string): string {
  return code
    .replace(/_maarif_(al|fl|sbl)$/i, '')
    .replace(/_maarif$/i, '')
    .trim();
}

function getSchoolProfileForSubjectCode(code: string): string | null {
  if (/_maarif_sbl$/i.test(code)) return 'sosyal';
  if (/_maarif_fl$/i.test(code)) return 'fen';
  if (/_maarif_al$/i.test(code)) return 'anadolu';
  if (/^(kuran_kerim_maarif|temel_dini_bilgiler_maarif)$/i.test(code)) return 'aihl';
  return null;
}

function filterSubjectsForSchoolProfile(
  items: Array<{ code: string; label: string }>,
  grade: string,
  schoolProfile: string,
): Array<{ code: string; label: string }> {
  const gradeNum = parseInt(grade, 10);
  const cleaned = items.filter((s) => {
    if (!s?.code?.trim()) return false;
    if (s.code.startsWith('bilsem_')) return false;
    if (/^\d+_sinif$/i.test(s.code)) return false;
    if (s.code === 'bircestirilmis_sinif') return false;
    return true;
  });
  if (!Number.isFinite(gradeNum) || gradeNum < 9 || gradeNum > 12) return cleaned;

  const isRejectedForProfile = (code: string) => {
    if (schoolProfile === 'anadolu') {
      return /_maarif_(fl|sbl)$/i.test(code) || ['kuran_kerim_maarif', 'temel_dini_bilgiler_maarif'].includes(code);
    }
    if (schoolProfile === 'fen') {
      return /_maarif_(al|sbl)$/i.test(code) || ['gorsel_sanatlar', 'gorsel_sanatlar_maarif', 'muzik', 'muzik_maarif', 'kuran_kerim_maarif', 'temel_dini_bilgiler_maarif'].includes(code);
    }
    if (schoolProfile === 'sosyal') {
      return /_maarif_(al|fl)$/i.test(code) || ['bilgisayar_bilimi', 'kuran_kerim_maarif', 'temel_dini_bilgiler_maarif'].includes(code);
    }
    if (schoolProfile === 'aihl') {
      return /_maarif_(al|fl|sbl)$/i.test(code) || ['bilgisayar_bilimi'].includes(code);
    }
    return false;
  };

  const getRank = (code: string) => {
    if (schoolProfile === 'anadolu' && /_maarif_al$/i.test(code)) return 5;
    if (schoolProfile === 'fen' && /_maarif_fl$/i.test(code)) return 5;
    if (schoolProfile === 'sosyal' && /_maarif_sbl$/i.test(code)) return 5;
    if (schoolProfile === 'aihl' && ['kuran_kerim_maarif', 'temel_dini_bilgiler_maarif'].includes(code)) return 5;
    if (/_maarif$/i.test(code)) return 4;
    if (!/_maarif_/i.test(code)) return 3;
    return 1;
  };

  const byBase = new Map<string, { code: string; label: string }>();
  for (const item of cleaned) {
    if (isRejectedForProfile(item.code)) continue;
    const baseCode = getBaseSubjectCode(item.code);
    const prev = byBase.get(baseCode);
    if (!prev || getRank(item.code) > getRank(prev.code)) {
      byBase.set(baseCode, item);
    }
  }
  return [...byBase.values()].sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function getAySortIndex(ay: string): number {
  const idx = AYLAR_ORDER.indexOf(ay.toUpperCase());
  return idx >= 0 ? idx : 999;
}

function SmartTextCell({
  value,
  previewChars = 120,
  placeholder = '—',
}: {
  value: unknown;
  previewChars?: number;
  placeholder?: string;
}) {
  const text = String(value ?? '').trim();
  if (!text || text === '—') {
    return <span className="text-muted-foreground/70">{placeholder}</span>;
  }

  const isLong = text.length > previewChars || text.includes('\n');
  if (!isLong) {
    return <span className="whitespace-pre-wrap wrap-break-word leading-5">{text}</span>;
  }

  const preview = `${text.slice(0, previewChars).trimEnd()}…`;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none whitespace-pre-wrap wrap-break-word leading-5 text-foreground/90">
        {preview}
        <span className="ml-1 text-[10px] uppercase tracking-wide text-primary group-open:hidden">devam</span>
        <span className="ml-1 hidden text-[10px] uppercase tracking-wide text-primary group-open:inline">kapat</span>
      </summary>
      <div className="mt-1 max-h-44 overflow-auto rounded-md border border-border/60 bg-background p-2 whitespace-pre-wrap wrap-break-word text-xs leading-5">
        {text}
      </div>
    </details>
  );
}

function EditorTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const applyWrap = (prefix: string, suffix = '') => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const src = value ?? '';
    const selected = src.slice(start, end);
    const next = `${src.slice(0, start)}${prefix}${selected}${suffix}${src.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium">{label}</label>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => applyWrap('• ')} className="rounded border border-input px-2 py-0.5 text-xs hover:bg-muted">Madde</button>
          <button type="button" onClick={() => applyWrap('**', '**')} className="rounded border border-input px-2 py-0.5 text-xs hover:bg-muted">Kalın</button>
          <button type="button" onClick={() => applyWrap('_', '_')} className="rounded border border-input px-2 py-0.5 text-xs hover:bg-muted">İtalik</button>
          <button type="button" onClick={() => applyWrap('\n')} className="rounded border border-input px-2 py-0.5 text-xs hover:bg-muted">Satır</button>
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full min-h-[104px] resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6"
        placeholder={placeholder}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">{value.length} karakter</p>
    </div>
  );
}

function DersAyGroupedTable({
  items,
  onEdit,
  onDelete,
  isBilsem = false,
}: {
  items: YillikPlanIcerikItem[];
  onEdit: (item: YillikPlanIcerikItem) => void;
  onDelete: (id: string) => void;
  isBilsem?: boolean;
}) {
  const byDers = items.reduce<Record<string, YillikPlanIcerikItem[]>>((acc, item) => {
    const i = item as Record<string, unknown>;
    const code = i.subject_code ?? i.subjectCode ?? '';
    const label = i.subject_label ?? i.subjectLabel ?? '';
    const year = i.academic_year ?? i.academicYear ?? '';
    const grade = i.grade ?? 0;
    const anaGrup = i.ana_grup ?? i.anaGrup ?? '';
    const altGrup = i.alt_grup ?? i.altGrup ?? '';
    const key = isBilsem ? `${code}|${label}|${anaGrup}|${altGrup}|${year}` : `${code}|${label}|${grade}|${year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDersKeys = Object.keys(byDers).sort((a, b) => {
    const partsA = a.split('|');
    const partsB = b.split('|');
    const labelA = partsA[1] ?? '';
    const labelB = partsB[1] ?? '';
    if (labelA !== labelB) return labelA.localeCompare(labelB);
    if (isBilsem) {
      const agA = partsA[2] ?? '';
      const agB = partsB[2] ?? '';
      return agA.localeCompare(agB) || (partsA[3] ?? '').localeCompare(partsB[3] ?? '');
    }
    return (parseInt(partsA[2], 10) || 0) - (parseInt(partsB[2], 10) || 0);
  });

  return (
    <div className="space-y-8">
      {sortedDersKeys.map((dersKey) => {
        const dersItems = Array.isArray(byDers[dersKey]) ? byDers[dersKey] : [];
        const [, subjectLabel] = dersKey.split('|');
        const byAy = dersItems.reduce<Record<string, YillikPlanIcerikItem[]>>((acc, item) => {
          const i = item as Record<string, unknown>;
          const ay = typeof i.ay === 'string' && i.ay.trim() ? i.ay.trim().toUpperCase() : '_';
          if (!acc[ay]) acc[ay] = [];
          acc[ay].push(item);
          return acc;
        }, {});
        const sortedAylar = Object.keys(byAy).sort((a, b) => {
          if (a === '_') return 1;
          if (b === '_') return -1;
          return getAySortIndex(a) - getAySortIndex(b);
        });

        const first = dersItems[0] as Record<string, unknown>;
        const groupLabel = isBilsem
          ? `${first?.ana_grup ?? first?.anaGrup ?? '—'}${(first?.alt_grup ?? first?.altGrup) ? ` / ${first.alt_grup ?? first.altGrup}` : ''}`
          : `${first?.grade ?? '—'}. Sınıf`;
        return (
          <div key={dersKey} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="bg-primary/10 px-4 py-3 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {subjectLabel} — {groupLabel}
                {first ? ` • ${first.academic_year ?? first.academicYear ?? ''}` : ''}
              </h2>
            </div>
            <div className="divide-y divide-border">
              {sortedAylar.map((ayLabel) => {
                const rawRows = byAy[ayLabel];
                const rows = Array.isArray(rawRows)
                  ? [...rawRows].sort((a, b) => {
                      const woA = (a as Record<string, unknown>).week_order ?? (a as Record<string, unknown>).weekOrder ?? 0;
                      const woB = (b as Record<string, unknown>).week_order ?? (b as Record<string, unknown>).weekOrder ?? 0;
                      return (woA as number) - (woB as number);
                    })
                  : [];
                const displayAy = ayLabel === '_' ? 'Hafta (takvim atanmamış)' : ayLabel;
                return (
                  <div key={ayLabel}>
                    <div className="bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
                      {displayAy}
                    </div>
                    <div className="table-x-scroll rounded-xl border border-border/70 bg-background shadow-sm">
                      <table className="evrak-admin-table w-full text-sm">
                        <thead>
                          <tr>
                            <th className="min-w-[110px] text-xs">Hafta</th>
                            <th className="min-w-[100px] text-xs">Ünite/Tema</th>
                            <th className="w-12 text-xs">Saat</th>
                            <th className="min-w-[140px] text-xs">Konu</th>
                            <th className="min-w-[180px] text-xs">Öğrenme Çıktıları</th>
                            <th className="min-w-[100px] text-xs">Süreç Bileş.</th>
                            <th className="min-w-[90px] text-xs">Ölçme</th>
                            <th className="min-w-[80px] text-xs">Sos.-Duyg.</th>
                            <th className="min-w-[70px] text-xs">Değerler</th>
                            <th className="min-w-[80px] text-xs">Okuryaz.</th>
                            <th className="min-w-[90px] text-xs">Belirli Gün</th>
                            <th className="min-w-[80px] text-xs">Farklıl.</th>
                            <th className="min-w-[80px] text-xs">Okul Plan.</th>
                            <th className="text-right w-20 text-xs">İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((item) => {
                            const i = item as Record<string, unknown>;
                            const cell = (snake: string, camel: string) =>
                              String(i[snake] ?? i[camel] ?? '—');
                            const konu = (i.konu as string) || '—';
                            const kazanimlar = (i.kazanimlar as string) || '—';
                            const haftaLabel = (i.hafta_label ?? (i.haftaLabel as string)) as string | null;
                            return (
                              <tr key={item.id}>
                                <td className="px-2 py-1.5 align-top whitespace-nowrap text-muted-foreground text-xs">
                                  {String(haftaLabel || `${i.week_order ?? i.weekOrder}. Hafta`)}
                                </td>
                                <td className="px-2 py-2 max-w-[130px] align-top text-xs">
                                  <SmartTextCell value={String(i.unite ?? i.Unite ?? '').trim() || '—'} previewChars={90} />
                                </td>
                                <td className="px-2 py-1.5 align-top text-xs">
                                  {Number(i.ders_saati ?? i.dersSaati ?? 0) || 0}
                                </td>
                        <td className="px-2 py-2 max-w-[170px] align-top text-xs">
                          <SmartTextCell value={konu} previewChars={120} />
                        </td>
                        <td className="px-2 py-2 max-w-[260px] align-top text-xs">
                          <SmartTextCell value={kazanimlar} previewChars={180} />
                        </td>
                        <td className="px-2 py-2 max-w-[130px] text-xs">
                          <SmartTextCell value={cell('surec_bilesenleri', 'surecBilesenleri')} previewChars={100} />
                        </td>
                        <td className="px-2 py-2 max-w-[120px] text-xs">
                          <SmartTextCell value={cell('olcme_degerlendirme', 'olcmeDegerlendirme')} previewChars={95} />
                        </td>
                        <td className="px-2 py-2 max-w-[120px] text-xs">
                          <SmartTextCell value={cell('sosyal_duygusal', 'sosyalDuygusal')} previewChars={95} />
                        </td>
                        <td className="px-2 py-2 max-w-[110px] text-xs">
                          <SmartTextCell value={cell('degerler', 'degerler')} previewChars={90} />
                        </td>
                        <td className="px-2 py-2 max-w-[120px] text-xs">
                          <SmartTextCell value={cell('okuryazarlik_becerileri', 'okuryazarlikBecerileri')} previewChars={95} />
                        </td>
                        <td className="px-2 py-2 max-w-[120px] text-xs">
                          <SmartTextCell value={cell('belirli_gun_haftalar', 'belirliGunHaftalar')} previewChars={95} />
                        </td>
                        <td className="px-2 py-2 max-w-[120px] text-xs">
                          <SmartTextCell value={cell('zenginlestirme', 'zenginlestirme')} previewChars={95} />
                        </td>
                        <td className="px-2 py-2 max-w-[130px] text-xs">
                          <SmartTextCell value={cell('okul_temelli_planlama', 'okulTemelliPlanlama')} previewChars={100} />
                        </td>
                        <td className="px-2 py-1.5 text-right align-top">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              title="Düzenle"
                              className="rounded p-1.5 hover:bg-muted"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              title="Sil"
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type YillikPlanIcerikPageProps = { curriculumModel?: 'bilsem' | null };

export default function YillikPlanIcerikPage(props?: YillikPlanIcerikPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me, loading: authLoading } = useAuth();
  const isBilsem = props?.curriculumModel === 'bilsem';
  const [items, setItems] = useState<YillikPlanIcerikItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    subject_code: '',
    grade: '',
    ana_grup: '',
    alt_grup: '',
    academic_year: '',
  });

  useEffect(() => {
    const s = searchParams.get('subject_code') ?? '';
    const g = searchParams.get('grade') ?? '';
    const ag = searchParams.get('ana_grup') ?? '';
    const alt = searchParams.get('alt_grup') ?? '';
    const a = searchParams.get('academic_year') ?? '';
    if (s || g || ag || a) {
      setFilters({ subject_code: s, grade: g, ana_grup: ag, alt_grup: alt, academic_year: a });
    }
  }, [searchParams]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<YillikPlanIcerikItem | null>(null);
  const [form, setForm] = useState({
    subject_code: '',
    subject_label: '',
    grade: '',
    ana_grup: '',
    alt_grup: '',
    section: '',
    academic_year: '',
    week_order: '',
    unite: '',
    konu: '',
    kazanimlar: '',
    ders_saati: '2',
    belirli_gun_haftalar: '',
    surec_bilesenleri: '',
    olcme_degerlendirme: '',
    sosyal_duygusal: '',
    degerler: '',
    okuryazarlik_becerileri: '',
    zenginlestirme: '',
    okul_temelli_planlama: '',
    sort_order: '',
  });
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<{ code: string; label: string }[]>([]);
  const [gptGenerating, setGptGenerating] = useState(false);
  const [gptDraft, setGptDraft] = useState<{
    items: Array<{
      week_order: number;
      unite: string;
      konu: string;
      kazanimlar: string;
      ders_saati: number;
      belirli_gun_haftalar?: string;
      surec_bilesenleri?: string;
      olcme_degerlendirme?: string;
      sosyal_duygusal?: string;
      degerler?: string;
      okuryazarlik_becerileri?: string;
      zenginlestirme?: string;
      okul_temelli_planlama?: string;
    }>;
    warnings: string[];
    source?: 'gpt' | 'tymm' | 'meb_fallback' | 'excel_parse' | 'paste_json' | 'paste_csv' | 'paste_gpt';
    quality?: {
      total_weeks: number;
      filled_weeks: number;
      placeholder_weeks: number;
      official_gain_count?: number;
      covered_gain_count?: number;
      coverage_percent?: number;
    };
    can_save?: boolean;
    save_status?: 'ok' | 'warning' | 'blocked';
    save_block_reason?: string;
  } | null>(null);
  const [gptError, setGptError] = useState<string | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummaryRow[]>([]);
  const [tabloAltiNot, setTabloAltiNot] = useState<string>('');
  const [tabloAltiNotSaving, setTabloAltiNotSaving] = useState(false);
  const [workCalendarEmptyForYear, setWorkCalendarEmptyForYear] = useState<string | null>(null);
  const [schoolProfile, setSchoolProfile] = useState<string>('anadolu');
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const listRequestKeyRef = useRef<string>('');
  const summaryRequestKeyRef = useRef<string>('');

  /** Bilsem: getDersSaati(subject, grade) için kademe; plan satırına yazılmaz, varsayılan 4. */
  const [bilsemPlanGrade, setBilsemPlanGrade] = useState('4');
  const [pastePayload, setPastePayload] = useState('');
  const [pasteMode, setPasteMode] = useState<'structured' | 'gpt'>('structured');

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const withCurriculumParams = useCallback(
    (params: URLSearchParams) => {
      if (isBilsem) params.set('curriculum_model', 'bilsem');
      return params;
    },
    [isBilsem],
  );

  const fetchList = useCallback(async () => {
    if (!token || !canManage) return;
    const params = new URLSearchParams();
    if (filters.subject_code) params.set('subject_code', filters.subject_code);
    if (isBilsem) {
      if (filters.ana_grup) params.set('ana_grup', filters.ana_grup);
      if (filters.alt_grup !== undefined && filters.alt_grup !== '') params.set('alt_grup', filters.alt_grup);
    } else if (filters.grade) {
      params.set('grade', filters.grade);
    }
    if (filters.academic_year) params.set('academic_year', filters.academic_year);
    withCurriculumParams(params);
    const requestKey = `${token}:${params.toString()}`;
    if (listRequestKeyRef.current === requestKey) return;
    listRequestKeyRef.current = requestKey;
    setLoading(true);
    try {
      const res = await apiFetch<{ items: YillikPlanIcerikItem[] }>(
        `/yillik-plan-icerik?${params}`,
        { token }
      );
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      if (listRequestKeyRef.current === requestKey) listRequestKeyRef.current = '';
      setLoading(false);
    }
  }, [token, canManage, filters, withCurriculumParams, isBilsem]);

  const fetchSubjects = useCallback(
    async (grade?: number, section?: string) => {
      if (!token || !canManage) return;
      try {
        const p = new URLSearchParams();
        if (grade) p.set('grade', String(grade));
        if (section) p.set('section', section);
        if (isBilsem) p.set('curriculum_model', 'bilsem');
        const res = await apiFetch<{
          items: Array<{ code: string; label: string; ana_grup?: string | null }>;
        }>(`/document-templates/subjects?${p}`, { token });
        const raw = res.items ?? [];
        setSubjects(isBilsem ? filterBilsemCatalogSubjects(raw) : raw);
      } catch {
        setSubjects([]);
      }
    },
    [token, canManage, isBilsem]
  );

  const fetchPlanSummary = useCallback(async () => {
    if (!token || !canManage) return;
    const sp = new URLSearchParams();
    withCurriculumParams(sp);
    const q = sp.toString();
    const requestKey = `${token}:${q}`;
    if (summaryRequestKeyRef.current === requestKey) return;
    summaryRequestKeyRef.current = requestKey;
    try {
      const res = await apiFetch<{
        items: PlanSummaryRow[];
      }>(`/yillik-plan-icerik/summary${q ? `?${q}` : ''}`, { token });
      setPlanSummary(res.items ?? []);
    } catch {
      setPlanSummary([]);
    } finally {
      if (summaryRequestKeyRef.current === requestKey) summaryRequestKeyRef.current = '';
    }
  }, [token, canManage, withCurriculumParams]);

  const fetchTabloAltiNot = useCallback(async () => {
    if (!token || !canManage || !filters.subject_code || !filters.academic_year) return;
    if (isBilsem && !filters.ana_grup) return;
    if (!isBilsem && !filters.grade) return;
    try {
      const params = new URLSearchParams({
        subject_code: filters.subject_code,
        academic_year: filters.academic_year,
      });
      if (isBilsem) {
        params.set('ana_grup', filters.ana_grup);
        if (filters.alt_grup) params.set('alt_grup', filters.alt_grup);
      } else {
        params.set('grade', filters.grade);
      }
      withCurriculumParams(params);
      const res = await apiFetch<{ tablo_alti_not: string | null }>(
        `/yillik-plan-icerik/meta?${params}`,
        { token }
      );
      setTabloAltiNot(res.tablo_alti_not ?? '');
    } catch {
      setTabloAltiNot('');
    }
  }, [token, canManage, filters.subject_code, filters.grade, filters.ana_grup, filters.alt_grup, filters.academic_year, withCurriculumParams, isBilsem]);

  const fetchWorkCalendarCheck = useCallback(
    async (year: string) => {
      if (!token || !canManage || !year) {
        setWorkCalendarEmptyForYear(null);
        return;
      }
      try {
        const res = await apiFetch<{ items: unknown[] }>(
          `/work-calendar?academic_year=${encodeURIComponent(year)}`,
          { token }
        );
        const items = res.items ?? [];
        setWorkCalendarEmptyForYear(items.length === 0 ? year : null);
      } catch {
        setWorkCalendarEmptyForYear(null);
      }
    },
    [token, canManage]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!canManage) {
      router.replace('/403');
      return;
    }
    fetchList();
    fetchPlanSummary();
  }, [authLoading, canManage, router, fetchList, fetchPlanSummary]);

  useEffect(() => {
    const hasGroup = isBilsem ? filters.ana_grup : filters.grade;
    if (filters.subject_code && hasGroup && filters.academic_year) {
      fetchTabloAltiNot();
    } else {
      setTabloAltiNot('');
    }
  }, [filters.subject_code, filters.grade, filters.ana_grup, filters.academic_year, fetchTabloAltiNot, isBilsem]);

  useEffect(() => {
    if (filters.academic_year) {
      fetchWorkCalendarCheck(filters.academic_year);
    } else {
      setWorkCalendarEmptyForYear(null);
    }
  }, [filters.academic_year, fetchWorkCalendarCheck]);

  useEffect(() => {
    const gradeForSubjects = showForm ? form.grade : filters.grade;
    const g = gradeForSubjects ? parseInt(gradeForSubjects, 10) : undefined;
    const sec = showForm ? form.section : 'ders';
    if (isBilsem) {
      fetchSubjects(undefined, sec || undefined);
    } else if (g && g >= 1 && g <= 12) {
      fetchSubjects(g, sec || undefined);
    } else {
      setSubjects([]);
    }
  }, [filters.grade, form.grade, form.section, showForm, fetchSubjects, isBilsem]);

  useEffect(() => {
    if (!showForm) return;
    requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [showForm]);

  const isOperationInProgress = saving || gptGenerating || tabloAltiNotSaving;
  useEffect(() => {
    if (!isOperationInProgress) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOperationInProgress]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      subject_code: filters.subject_code || '',
      subject_label: subjects.find((s) => s.code === filters.subject_code)?.label || '',
      grade: filters.grade || '',
      ana_grup: filters.ana_grup || '',
      alt_grup: filters.alt_grup || '',
      section: 'ders',
      academic_year: filters.academic_year || getAcademicYears()[0] || '',
      week_order: '',
      unite: '',
      konu: '',
      kazanimlar: '',
      ders_saati: '2',
      belirli_gun_haftalar: '',
      surec_bilesenleri: '',
      olcme_degerlendirme: '',
      sosyal_duygusal: '',
      degerler: '',
      okuryazarlik_becerileri: '',
      zenginlestirme: '',
      okul_temelli_planlama: '',
      sort_order: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: YillikPlanIcerikItem) => {
    const i = item as Record<string, unknown>;
    setEditing(item);
    setForm({
      subject_code: (i.subject_code ?? i.subjectCode) as string,
      subject_label: (i.subject_label ?? i.subjectLabel) as string,
      grade: String(i.grade ?? ''),
      ana_grup: String(i.ana_grup ?? i.anaGrup ?? ''),
      alt_grup: String(i.alt_grup ?? i.altGrup ?? ''),
      section: (i.section as string) ?? 'ders',
      academic_year: (i.academic_year ?? i.academicYear) as string,
      week_order: String(i.week_order ?? i.weekOrder ?? ''),
      unite: (i.unite as string) ?? '',
      konu: (i.konu as string) ?? '',
      kazanimlar: (i.kazanimlar as string) ?? '',
      ders_saati: String(i.ders_saati ?? i.dersSaati ?? 2),
      belirli_gun_haftalar: String(i.belirli_gun_haftalar ?? i.belirliGunHaftalar ?? ''),
      surec_bilesenleri: String(i.surec_bilesenleri ?? i.surecBilesenleri ?? ''),
      olcme_degerlendirme: String(i.olcme_degerlendirme ?? i.olcmeDegerlendirme ?? ''),
      sosyal_duygusal: String(i.sosyal_duygusal ?? i.sosyalDuygusal ?? ''),
      degerler: String(i.degerler ?? ''),
      okuryazarlik_becerileri: String(i.okuryazarlik_becerileri ?? i.okuryazarlikBecerileri ?? ''),
      zenginlestirme: String(i.zenginlestirme ?? ''),
      okul_temelli_planlama: String(i.okul_temelli_planlama ?? i.okulTemelliPlanlama ?? ''),
      sort_order: i.sort_order != null || i.sortOrder != null ? String(i.sort_order ?? i.sortOrder) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.subject_code.trim() || !form.subject_label.trim()) {
      toast.error('Ders kodu ve etiketi zorunludur.');
      return;
    }
    if (isBilsem) {
      if (!form.ana_grup?.trim() || !form.academic_year.trim() || !form.week_order.trim()) {
        toast.error('Ana grup, öğretim yılı ve hafta sırası zorunludur.');
        return;
      }
    } else if (!form.grade || !form.academic_year.trim() || !form.week_order.trim()) {
      toast.error('Sınıf, öğretim yılı ve hafta sırası zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        subject_code: form.subject_code.trim(),
        subject_label: form.subject_label.trim(),
        section: form.section || undefined,
        academic_year: form.academic_year.trim(),
        week_order: parseInt(form.week_order, 10),
        unite: form.unite.trim() || undefined,
        konu: form.konu.trim() || undefined,
        kazanimlar: form.kazanimlar.trim() || undefined,
        ders_saati: parseInt(form.ders_saati, 10) || 0,
      };
      if (isBilsem) {
        body.ana_grup = form.ana_grup.trim();
        body.alt_grup = form.alt_grup?.trim() || undefined;
        body.curriculum_model = 'bilsem';
      } else {
        body.grade = parseInt(form.grade, 10);
      }
      Object.assign(body, {
        belirli_gun_haftalar: form.belirli_gun_haftalar?.trim() || undefined,
        surec_bilesenleri: form.surec_bilesenleri?.trim() || undefined,
        olcme_degerlendirme: form.olcme_degerlendirme?.trim() || undefined,
        sosyal_duygusal: form.sosyal_duygusal?.trim() || undefined,
        degerler: form.degerler?.trim() || undefined,
        okuryazarlik_becerileri: form.okuryazarlik_becerileri?.trim() || undefined,
        zenginlestirme: form.zenginlestirme?.trim() || undefined,
        okul_temelli_planlama: form.okul_temelli_planlama?.trim() || undefined,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
      });
      if (editing) {
        await apiFetch(`/yillik-plan-icerik/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Kayıt güncellendi');
      } else {
        await apiFetch('/yillik-plan-icerik', { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Kayıt eklendi');
      }
      setShowForm(false);
      fetchList();
      fetchPlanSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/yillik-plan-icerik/${id}`, { method: 'DELETE', token });
      toast.success('Kayıt silindi');
      fetchList();
      fetchPlanSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const hasGroupFilter = isBilsem ? filters.ana_grup : filters.grade;
  const isLiseGrade = !isBilsem && (() => {
    const gradeNum = parseInt(filters.grade, 10);
    return Number.isFinite(gradeNum) && gradeNum >= 9 && gradeNum <= 12;
  })();
  const visibleFilterSubjects = isBilsem
    ? subjects
    : filterSubjectsForSchoolProfile(subjects, filters.grade, schoolProfile);
  const visibleFormSubjects = isBilsem
    ? subjects
    : filterSubjectsForSchoolProfile(subjects, showForm ? form.grade : filters.grade, schoolProfile);
  const canBulkDelete =
    filters.subject_code && hasGroupFilter && filters.academic_year && items.length > 0;
  const selectedSubjectLabel =
    visibleFilterSubjects.find((s) => s.code === filters.subject_code)?.label ||
    subjects.find((s) => s.code === filters.subject_code)?.label ||
    planSummary.find((s) => s.subject_code === filters.subject_code)?.subject_label ||
    filters.subject_code;
  const selectedGroupLabel = isBilsem
    ? [filters.ana_grup, filters.alt_grup].filter(Boolean).join(' / ')
    : filters.grade
      ? `${filters.grade}. Sınıf`
      : '';
  const selectedSchoolProfileLabel =
    !isBilsem && isLiseGrade
      ? LISE_SCHOOL_PROFILES.find((p) => p.value === schoolProfile)?.label ?? ''
      : '';
  const selectedSummary = [
    selectedGroupLabel,
    selectedSchoolProfileLabel,
    selectedSubjectLabel,
    filters.academic_year,
  ]
    .filter(Boolean)
    .join(' · ');
  const importBilsemAnaLabel =
    BILSEM_ANA_GRUPLAR.find((g) => g.value === filters.ana_grup)?.label ?? (filters.ana_grup?.trim() || '—');
  const importBilsemAltLabel = filters.alt_grup?.trim()
    ? BILSEM_ALT_GRUPLAR.find((g) => g.value === filters.alt_grup)?.label ?? filters.alt_grup
    : '—';
  const hasRequiredSelection = Boolean(filters.subject_code && hasGroupFilter && filters.academic_year);
  const activePlanCount = planSummary.length;
  const totalWeekCount = items.length;
  const pendingSubjectCount =
    hasGroupFilter && filters.academic_year && visibleFilterSubjects.length > 0
      ? visibleFilterSubjects.filter((s) => {
          const doneSet = new Set(
            planSummary
              .filter((p) => {
                if (isBilsem) {
                  return (p.ana_grup ?? '') === filters.ana_grup && (p.alt_grup ?? '') === filters.alt_grup && p.academic_year === filters.academic_year;
                }
                return String(p.grade) === filters.grade && p.academic_year === filters.academic_year;
              })
              .map((p) => (p.subject_code ?? '').toLowerCase().trim())
          );
          return !doneSet.has((s.code ?? '').toLowerCase().trim());
        }).length
      : 0;
  const handleBulkDelete = async () => {
    if (!token || !canBulkDelete) return;
    if (
      !confirm(
        `Bu ders için tüm plan içeriği (${items.length} kayıt) silinecek. Devam edilsin mi?`
      )
    )
      return;
    try {
      const bulkBody = isBilsem
        ? {
            subject_code: filters.subject_code,
            ana_grup: filters.ana_grup,
            alt_grup: filters.alt_grup || undefined,
            academic_year: filters.academic_year,
            curriculum_model: 'bilsem',
          }
        : {
            subject_code: filters.subject_code,
            grade: parseInt(filters.grade, 10),
            academic_year: filters.academic_year,
          };
      const res = await apiFetch<{ deleted: number }>('/yillik-plan-icerik/bulk-delete', {
        method: 'POST',
        token,
        body: JSON.stringify(bulkBody),
      });
      toast.success(`${res.deleted ?? 0} kayıt silindi.`);
      fetchList();
      fetchPlanSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu silme başarısız.');
    }
  };

  const deletePlanFromSummary = async (s: PlanSummaryRow) => {
    if (!token) return;
    const wc = s.week_count ?? 0;
    if (
      !confirm(
        `${s.subject_label} — ${wc} haftalık plan silinsin mi? (${s.academic_year})`,
      )
    ) {
      return;
    }
    try {
      const bulkBody = isBilsem
        ? {
            subject_code: s.subject_code,
            ana_grup: String(s.ana_grup ?? '').trim(),
            academic_year: s.academic_year,
            curriculum_model: 'bilsem' as const,
            alt_grup: s.alt_grup != null && String(s.alt_grup).trim() !== '' ? String(s.alt_grup).trim() : '',
          }
        : {
            subject_code: s.subject_code,
            grade: s.grade != null ? Number(s.grade) : undefined,
            academic_year: s.academic_year,
          };
      if (isBilsem && !bulkBody.ana_grup) {
        toast.error('Ana grup eksik; silinemedi.');
        return;
      }
      if (!isBilsem && (!bulkBody.grade || bulkBody.grade < 1 || bulkBody.grade > 12)) {
        toast.error('Sınıf eksik; silinemedi.');
        return;
      }
      const res = await apiFetch<{ deleted: number }>('/yillik-plan-icerik/bulk-delete', {
        method: 'POST',
        token,
        body: JSON.stringify(bulkBody),
      });
      toast.success(`${res.deleted ?? 0} kayıt silindi.`);
      fetchList();
      fetchPlanSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const canImportPlan =
    filters.subject_code &&
    filters.academic_year &&
    subjects.some((s) => s.code === filters.subject_code) &&
    (isBilsem ? !!filters.ana_grup : !!filters.grade);

  useEffect(() => {
    if (isBilsem || !filters.subject_code) return;
    if (!visibleFilterSubjects.some((s) => s.code === filters.subject_code)) {
      setFilters((f) => ({ ...f, subject_code: '' }));
    }
  }, [filters.subject_code, visibleFilterSubjects, isBilsem]);

  const handlePreviewPaste = async () => {
    if (!token || !canImportPlan) return;
    const raw = pastePayload.trim();
    if (!raw) {
      toast.error(pasteMode === 'gpt' ? 'Tam plan metnini yapıştırın.' : 'JSON veya CSV yapıştırın.');
      return;
    }
    const subject = subjects.find((s) => s.code === filters.subject_code);
    if (!subject) {
      toast.error('Ders seçin.');
      return;
    }
    const gradeNum = parseInt(isBilsem ? bilsemPlanGrade : filters.grade, 10);
    if (!Number.isFinite(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      toast.error(isBilsem ? 'Ders saati için referans düzey 1–12 seçin.' : 'Sınıf seçin.');
      return;
    }
    setGptGenerating(true);
    setGptDraft(null);
    setGptError(null);
    try {
      const res = await apiFetch<{
        items: Array<{
          week_order: number;
          unite: string;
          konu: string;
          kazanimlar: string;
          ders_saati: number;
          belirli_gun_haftalar?: string;
          surec_bilesenleri?: string;
          olcme_degerlendirme?: string;
          sosyal_duygusal?: string;
          degerler?: string;
          okuryazarlik_becerileri?: string;
          zenginlestirme?: string;
          okul_temelli_planlama?: string;
        }>;
        warnings?: string[];
        source?: 'gpt' | 'tymm' | 'meb_fallback' | 'excel_parse' | 'paste_json' | 'paste_csv' | 'paste_gpt';
        quality?: {
          total_weeks: number;
          filled_weeks: number;
          placeholder_weeks: number;
          official_gain_count?: number;
          covered_gain_count?: number;
          coverage_percent?: number;
        };
        can_save?: boolean;
        save_status?: 'ok' | 'warning' | 'blocked';
        save_block_reason?: string;
      }>('/yillik-plan-icerik/preview-draft-from-paste', {
        method: 'POST',
        token,
        signal: createFetchTimeoutSignal(pasteMode === 'gpt' ? 480_000 : 300_000),
        body: JSON.stringify({
          subject_code: filters.subject_code,
          subject_label: subject.label,
          grade: gradeNum,
          section: 'ders',
          academic_year: filters.academic_year,
          payload: raw,
          paste_mode: pasteMode,
          ...(pasteMode === 'gpt' && isBilsem
            ? {
                curriculum_model: 'bilsem',
                ana_grup: filters.ana_grup.trim(),
                alt_grup: filters.alt_grup?.trim() ? filters.alt_grup.trim() : undefined,
              }
            : {}),
          ...(pasteMode === 'gpt' ? { school_profile: schoolProfile || undefined } : {}),
        }),
      });
      setGptDraft({
        items: res.items ?? [],
        warnings: res.warnings ?? [],
        source: res.source,
        quality: res.quality,
        can_save: res.can_save,
        save_status: res.save_status,
        save_block_reason: res.save_block_reason,
      });
      toast.success(
        pasteMode === 'gpt'
          ? `GPT: ${res.items?.length ?? 0} hafta önizlendi.`
          : `${res.items?.length ?? 0} hafta önizlendi.`,
      );
    } catch (err) {
      if (isAbortError(err)) {
        const msg =
          pasteMode === 'gpt'
            ? 'GPT önizlemesi zaman aşımı (8 dk). Metni kısaltıp tekrar deneyin veya bir süre sonra yeniden deneyin.'
            : 'Önizleme zaman aşımı (5 dk). Veriyi küçültüp tekrar deneyin.';
        setGptError(msg);
        toast.error(msg);
      } else {
        const msg = err instanceof Error ? err.message : 'Yapıştırma önizlenemedi.';
        setGptError(msg);
        toast.error(msg);
      }
    } finally {
      setGptGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!token || !gptDraft) return;
    if (gptDraft.can_save === false) {
      toast.error(gptDraft.save_block_reason || 'Taslak kalite kontrolünden geçmedi.');
      return;
    }
    const subject = subjects.find((s) => s.code === filters.subject_code);
    if (!subject) return;
    if (isBilsem && !String(filters.ana_grup ?? '').trim()) {
      toast.error('Bilsem kaydı için ana grup seçin.');
      return;
    }
    const planGradeNum = parseInt(isBilsem ? bilsemPlanGrade : filters.grade, 10);
    if (!Number.isFinite(planGradeNum) || planGradeNum < 1 || planGradeNum > 12) {
      toast.error(isBilsem ? 'Ders saati için referans düzey 1–12 seçin.' : 'Sınıf seçin.');
      return;
    }
    if (
      items.length > 0 &&
      !confirm(
        'Bu ders için mevcut plan içeriği silinip yerine içe aktarılan taslak kaydedilecek. Devam edilsin mi?'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/yillik-plan-icerik/save-draft', {
        method: 'POST',
        token,
        body: JSON.stringify({
          subject_code: filters.subject_code,
          subject_label: subject.label,
          grade: planGradeNum,
          plan_grade: isBilsem ? planGradeNum : undefined,
          section: 'ders',
          academic_year: filters.academic_year,
          items: gptDraft.items,
          ...(isBilsem
            ? {
                curriculum_model: 'bilsem',
                ana_grup: filters.ana_grup.trim(),
                alt_grup: filters.alt_grup?.trim() ? filters.alt_grup.trim() : null,
              }
            : {}),
        }),
      });
      toast.success(`${gptDraft.items.length} haftalık plan kaydedildi.`);
      setGptDraft(null);
      fetchList();
      fetchPlanSummary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }
  if (!canManage) return null;

  const academicYears = getAcademicYears();

  return (
    <div className="space-y-8">
      {workCalendarEmptyForYear && (
        <Alert variant="warning">
          <strong>Çalışma Takvimi boş.</strong> {workCalendarEmptyForYear} öğretim yılı için hafta tanımı yok.
          Yıllık plan içeriği ve evrak üretimi için önce{' '}
          <Link
            href={isBilsem ? '/bilsem-sablon?tab=calisma-takvimi' : '/document-templates?tab=calisma-takvimi'}
            className="font-medium underline underline-offset-2 hover:text-primary"
          >
            Çalışma Takvimi
          </Link>{' '}
          sekmesinden haftaları ekleyin; tatiller bu takvimden okunur.
        </Alert>
      )}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-linear-to-br from-primary/8 via-background to-muted/40 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
                {isBilsem ? 'Bilsem — Yıllık Plan İçerikleri' : 'Yıllık Plan İçerikleri'}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {isBilsem
                  ? 'Bilsem için haftalık plan satırlarını tek ekrandan yönetin; grup, ders ve yıl bazında hızlıca filtreleyin.'
                  : 'Sınıf, ders ve öğretim yılına göre planları seçin; taslak oluşturun, eksik dersleri görün ve kayıtları tek ekrandan yönetin.'}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-5" />
              Yeni Kayıt
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planlı Ders</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{activePlanCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Açık Plan</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{totalWeekCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eksik Ders</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{pendingSubjectCount}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              {isBilsem ? 'Grup bazlı düzen' : 'Sınıf bazlı düzen'}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Ay bazlı görünüm
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              JSON / CSV / GPT tam metin + takvim
            </span>
            {selectedSummary && (
              <span className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                Seçim: {selectedSummary}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          {canImportPlan && (
            <div className="min-w-0 flex-1 rounded-2xl border border-primary/25 bg-primary/5 p-6 shadow-sm md:p-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-semibold text-primary md:text-lg">
                  <Sparkles className="size-5 shrink-0" />
                  Plan içe aktarma
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setPasteMode('structured')}
                    className={`rounded-lg border px-3 py-2 ${pasteMode === 'structured' ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-border bg-background'}`}
                  >
                    JSON / CSV / kazanım
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasteMode('gpt')}
                    className={`rounded-lg border px-3 py-2 ${pasteMode === 'gpt' ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-border bg-background'}`}
                  >
                    GPT (tam metin)
                  </button>
                </div>
              </div>

              {isBilsem ? (
                <div className="mb-5 grid gap-3 rounded-xl border border-border/80 bg-background/90 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ana grup</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{importBilsemAnaLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alt grup</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{importBilsemAltLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ders</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{selectedSubjectLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Öğretim yılı</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{filters.academic_year || '—'}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-5 grid gap-3 rounded-xl border border-border/80 bg-background/90 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sınıf</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {filters.grade ? `${filters.grade}. sınıf` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ders</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{selectedSubjectLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Öğretim yılı</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{filters.academic_year || '—'}</p>
                  </div>
                </div>
              )}

              {isBilsem && (
                <div className="mb-4 max-w-xl">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Haftalık ders saati için referans düzeyi (1–12)
                  </label>
                  <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">Plan kaydında düzey yok.</strong> Bu seçim yalnızca MEB
                    ders-saat tablosundan bu dersin haftalık saatinin hangi kademe aralığına göre
                    okunacağını belirler (önizleme, GPT, doğrulama). Buraya saat sayısı girilmez. Kademeye göre saat
                    değişmeyen derslerde varsayılan <strong className="text-foreground">4</strong> çoğu zaman yeter;
                    örneğin matematikte 5–8 ile 9–12 farklıysa uygun düzeyi seçin.
                  </p>
                  <select
                    value={bilsemPlanGrade}
                    onChange={(e) => setBilsemPlanGrade(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                    title="MEB ders saati tablosu için kademe (1–12)"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={String(g)}>
                        {g}. düzey
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="mb-4 text-sm leading-6 text-muted-foreground">
                {pasteMode === 'gpt' ? (
                  <>
                    Yukarıdaki seçimle tam metin GPT ile gider; çıktı{' '}
                    <strong className="text-foreground">çalışma takvimine</strong> oturtulur. Sunucuda{' '}
                    <strong className="text-foreground">OPENAI_API_KEY</strong> tanımlı olmalıdır.
                  </>
                ) : (
                  <>
                    Tarih gerekmez; tatil ve ara tatiller{' '}
                    <strong className="text-foreground">çalışma takvimi</strong> kayıtlarından okunur. Haftalık satır:{' '}
                    <code className="rounded bg-muted px-1 text-xs">week_order</code> 1–36.{' '}
                    <code className="rounded bg-muted px-1 text-xs">{`{ "mode":"kazanim_plan", "scope":"full_year"|"term1"|"term2", "kazanimlar":[...] }`}</code>{' '}
                    ile kazanımlar haftalara dağıtılır (GPT kullanılmaz).
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreviewPaste()}
                  disabled={
                    gptGenerating ||
                    !pastePayload.trim() ||
                    (pasteMode === 'gpt' && pastePayload.trim().length < 30)
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {gptGenerating
                    ? pasteMode === 'gpt'
                      ? 'GPT çalışıyor…'
                      : 'Önizleniyor…'
                    : pasteMode === 'gpt'
                      ? 'GPT önizle'
                      : 'Önizle ve takvime oturt'}
                </button>
              </div>
              <textarea
                value={pastePayload}
                onChange={(e) => setPastePayload(e.target.value)}
                rows={14}
                placeholder={
                  pasteMode === 'gpt'
                    ? 'Yıllık müfredat tablosunu veya Word’dan kopyalanmış plan metnini yapıştırın (en az ~30 karakter). Hafta, ünite ve kazanımlar çıkarılır.'
                    : `Haftalık CSV ör: hafta;ünite;konu;kazanimlar;ders_saati\nveya JSON: { "mode":"kazanim_plan", "scope":"full_year", "default_unite":"1. Ünite", "kazanimlar":["K1...","K2..."] }`
                }
                className="mt-4 min-h-[280px] w-full resize-y rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm leading-relaxed"
              />
            </div>
          )}

          {canBulkDelete && (
            <div className="shrink-0 rounded-2xl border border-destructive/30 bg-destructive/8 p-5 xl:max-w-sm xl:self-start">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch">
                <div>
                  <p className="text-sm font-semibold text-destructive">Toplu Temizlik</p>
                  <p className="mt-1 text-xs text-muted-foreground">{items.length} kayıt seçili plan altında silinir.</p>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="size-4" />
                  Tümünü Sil
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {gptError && (
        <Alert variant="error" message={gptError} className="max-w-2xl" />
      )}

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-5" />
            Plan İçerikleri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Filtreler</p>
                <p className="text-xs text-muted-foreground">
                  Görüntülemek istediğiniz planı seçin. Sonuçlar öğretim yılına göre aylar halinde sıralanır.
                </p>
              </div>
              {selectedSummary && (
                <div className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-xs font-medium text-primary">
                  Aktif seçim: {selectedSummary}
                </div>
              )}
            </div>
            <div
              className={`mt-4 grid gap-3 md:grid-cols-2 ${isBilsem ? 'xl:grid-cols-4' : 'xl:grid-cols-5'}`}
            >
              {isBilsem ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Ana grup</label>
                    <select
                      value={filters.ana_grup}
                      onChange={(e) => setFilters((f) => ({ ...f, ana_grup: e.target.value, subject_code: '' }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Tüm ana gruplar</option>
                      {BILSEM_ANA_GRUPLAR.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Alt grup</label>
                    <select
                      value={filters.alt_grup}
                      onChange={(e) => setFilters((f) => ({ ...f, alt_grup: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Tüm alt gruplar</option>
                      {BILSEM_ALT_GRUPLAR.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Sınıf</label>
                  <select
                    value={filters.grade}
                    onChange={(e) => setFilters((f) => ({ ...f, grade: e.target.value, subject_code: '' }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Tüm sınıflar</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        {g}. Sınıf
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isBilsem && isLiseGrade && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Okul profili</label>
                  <select
                    value={schoolProfile}
                    onChange={(e) => setSchoolProfile(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {LISE_SCHOOL_PROFILES.map((profile) => (
                      <option key={profile.value} value={profile.value}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Ders</label>
                <select
                  value={filters.subject_code}
                  onChange={(e) => setFilters((f) => ({ ...f, subject_code: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Tüm dersler</option>
                  {visibleFilterSubjects.length
                    ? visibleFilterSubjects.map((s, i) => (
                        <option key={`${s.code}-${i}`} value={s.code}>
                          {s.label}
                        </option>
                      ))
                    : null}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Öğretim yılı</label>
                <select
                  value={filters.academic_year}
                  onChange={(e) => setFilters((f) => ({ ...f, academic_year: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Tüm yıllar</option>
                  {academicYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!hasGroupFilter && (
              <p className="mt-3 text-xs text-muted-foreground">
                {isBilsem ? 'Ders listesinin daralması için önce ana grup seçin.' : 'Ders listesinin daralması için önce sınıf seçin.'}
              </p>
            )}
            <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Hızlı başlangıç</p>
                  <p className="text-xs text-muted-foreground">
                    {hasRequiredSelection
                      ? `${selectedSummary} için işlem seçin.`
                      : isBilsem
                        ? 'Önce ana grup, ders ve öğretim yılı seçin.'
                        : 'Önce sınıf, ders ve öğretim yılı seçin.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openCreate}
                    disabled={!hasRequiredSelection}
                    className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    Manuel Kayıt
                  </button>
                </div>
              </div>
            </div>
          </div>
          {(planSummary.length > 0 || (hasGroupFilter && filters.academic_year)) && (
            <div className="space-y-4">
              {planSummary.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <p className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                    Yapılan planlar — sıralı liste (tıklayarak filtreleyebilirsiniz)
                  </p>
                  <div className="max-h-[240px] overflow-y-auto">
                    <table className="evrak-admin-table w-full text-sm">
                      <thead>
                        <tr>
                          <th className="w-10 text-left text-xs">Durum</th>
                          <th className="text-left text-xs">Ders</th>
                          <th className="text-left text-xs">{isBilsem ? 'Ana / Alt grup' : 'Sınıf'}</th>
                          <th className="text-left text-xs">Öğretim Yılı</th>
                          <th className="text-left text-xs">Hafta</th>
                          <th className="w-12 text-right text-xs">Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...planSummary]
                          .sort((a, b) => {
                            const y = (b.academic_year ?? '').localeCompare(a.academic_year ?? '');
                            if (y !== 0) return y;
                            const lb = (a.subject_label ?? '').localeCompare(b.subject_label ?? '');
                            if (lb !== 0) return lb;
                            if (isBilsem) {
                              return ((a.ana_grup ?? '') + (a.alt_grup ?? '')).localeCompare((b.ana_grup ?? '') + (b.alt_grup ?? ''));
                            }
                            return (a.grade ?? 0) - (b.grade ?? 0);
                          })
                          .map((s, idx) => {
                            const groupMatch = isBilsem
                              ? filters.ana_grup === (s.ana_grup ?? '') && filters.alt_grup === (s.alt_grup ?? '')
                              : filters.grade === String(s.grade ?? '');
                            const isActive =
                              filters.subject_code === s.subject_code &&
                              groupMatch &&
                              filters.academic_year === s.academic_year;
                            const groupLabel = isBilsem
                              ? `${s.ana_grup ?? '—'}${s.alt_grup ? ` / ${s.alt_grup}` : ''}`
                              : `${s.grade ?? '—'}. Sınıf`;
                            return (
                              <tr
                                key={`${s.subject_code}-${isBilsem ? s.ana_grup + (s.alt_grup ?? '') : s.grade}-${s.academic_year}-${idx}`}
                                className={isActive ? 'bg-primary/10' : 'hover:bg-muted/50 cursor-pointer'}
                                onClick={() => {
                                  if (!isBilsem) {
                                    const nextProfile = getSchoolProfileForSubjectCode(s.subject_code);
                                    if (nextProfile) setSchoolProfile(nextProfile);
                                  }
                                  setFilters({
                                    subject_code: s.subject_code,
                                    grade: isBilsem ? '' : String(s.grade ?? ''),
                                    ana_grup: isBilsem ? (s.ana_grup ?? '') : '',
                                    alt_grup: isBilsem ? (s.alt_grup ?? '') : '',
                                    academic_year: s.academic_year,
                                  });
                                }}
                              >
                                <td className="px-3 py-2">
                                  <Check className="size-4 text-green-600 dark:text-green-400" />
                                </td>
                                <td className="px-3 py-2 font-medium">{s.subject_label}</td>
                                <td className="px-3 py-2">{groupLabel}</td>
                                <td className="px-3 py-2">{s.academic_year}</td>
                                <td className="px-3 py-2 text-muted-foreground">{s.week_count} hafta</td>
                                <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    title="Bu planı sil"
                                    onClick={() => void deletePlanFromSummary(s)}
                                    className="inline-flex rounded p-1.5 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {hasGroupFilter && filters.academic_year && visibleFilterSubjects.length > 0 && (() => {
                const doneSet = new Set(
                  planSummary
                    .filter((p) => {
                      if (isBilsem) return (p.ana_grup ?? '') === filters.ana_grup && (p.alt_grup ?? '') === filters.alt_grup && p.academic_year === filters.academic_year;
                      return String(p.grade) === filters.grade && p.academic_year === filters.academic_year;
                    })
                    .map((p) => (p.subject_code ?? '').toLowerCase().trim())
                );
                const notDone = visibleFilterSubjects.filter((s) => !doneSet.has((s.code ?? '').toLowerCase().trim()));
                const groupLabel = isBilsem ? `${filters.ana_grup}${filters.alt_grup ? ` / ${filters.alt_grup}` : ''}` : `${filters.grade}. Sınıf`;
                const scopeSchoolProfileLabel =
                  !isBilsem && isLiseGrade
                    ? LISE_SCHOOL_PROFILES.find((p) => p.value === schoolProfile)?.label ?? null
                    : null;
                return notDone.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 overflow-hidden">
                    <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-3 border-b border-amber-200 dark:border-amber-900/50">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Plan oluşturulmayan dersler
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                        <span className="text-muted-foreground dark:text-amber-200/70">Seçili kapsam:</span>
                        <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-white/60 px-2 py-0.5 font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
                          {groupLabel}
                        </span>
                        {scopeSchoolProfileLabel && (
                          <>
                            <span className="text-muted-foreground" aria-hidden>
                              ·
                            </span>
                            <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-white/60 px-2 py-0.5 font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
                              {scopeSchoolProfileLabel}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-white/60 px-2 py-0.5 font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
                          {filters.academic_year}
                        </span>
                        <span className="text-muted-foreground dark:text-amber-200/70">öğretim yılı</span>
                      </p>
                      <p className="mt-1.5 text-[11px] text-amber-800/75 dark:text-amber-200/70">
                        Henüz plan kaydı yok — <span className="font-medium">Seç</span>; içe aktarma üstteki JSON/CSV
                        alanından.
                      </p>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto">
                      <ul className="divide-y divide-border">
                        {notDone.map((s, i) => (
                          <li
                            key={`${s.code}-${i}`}
                            className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-muted-foreground"
                          >
                            <div className="flex items-center gap-2">
                              <Circle className="size-4 shrink-0 text-amber-500" />
                              {s.label}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setFilters((f) => ({ ...f, subject_code: s.code }))}
                                className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-muted"
                              >
                                Seç
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner className="size-8" />
            </div>
          ) : gptDraft ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-5" />
                    Plan önizleme
                    {gptDraft.source && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {gptDraft.source === 'tymm'
                          ? 'Kaynak: TYMM'
                          : gptDraft.source === 'meb_fallback'
                            ? 'Kaynak: MEB Fallback'
                            : gptDraft.source === 'excel_parse'
                              ? 'Kaynak: Excel (sıra korundu)'
                              : gptDraft.source === 'paste_json'
                                ? 'Kaynak: Yapıştırılan JSON'
                                : gptDraft.source === 'paste_csv'
                                  ? 'Kaynak: Yapıştırılan CSV'
                                  : 'Kaynak: içe aktarma'}
                      </span>
                    )}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kaydetmeden önce içerikleri kontrol edin.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving || gptDraft.can_save === false}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGptDraft(null)}
                    className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
                  >
                    İptal
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {gptDraft.warnings.length > 0 && (
                  <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">
                    {gptDraft.warnings.slice(0, 3).join(' • ')}
                    {gptDraft.warnings.length > 3 && ` (+${gptDraft.warnings.length - 3} uyarı)`}
                  </p>
                )}
                {gptDraft.save_block_reason && (
                  <p
                    className={`mb-4 text-xs ${gptDraft.can_save === false ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}
                  >
                    {gptDraft.save_block_reason}
                  </p>
                )}
                {gptDraft.quality && (
                  <div className="mb-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1">
                      Hafta: {gptDraft.quality.total_weeks}
                    </span>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
                      Dolu: {gptDraft.quality.filled_weeks}
                    </span>
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-400">
                      Placeholder: {gptDraft.quality.placeholder_weeks}
                    </span>
                    {typeof gptDraft.quality.coverage_percent === 'number' && (
                      <span className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-primary">
                        Kazanım kapsama: %{gptDraft.quality.coverage_percent}
                      </span>
                    )}
                  </div>
                )}
                <div className="table-x-scroll rounded-xl border border-border/70 bg-background shadow-sm">
                  <table className="evrak-admin-table w-full text-sm">
                    <thead>
                      <tr>
                        <th className="w-14 text-xs">Hafta</th>
                        <th className="min-w-[110px] text-xs">Ünite/Tema</th>
                        <th className="w-12 text-xs">Saat</th>
                        <th className="min-w-[100px] text-xs">Konu</th>
                        <th className="min-w-[140px] text-xs">Öğrenme Çıktıları</th>
                        <th className="min-w-[80px] text-xs">Süreç Bileş.</th>
                        <th className="min-w-[70px] text-xs">Ölçme</th>
                        <th className="min-w-[70px] text-xs">Sos.-Duyg.</th>
                        <th className="min-w-[60px] text-xs">Değerler</th>
                        <th className="min-w-[70px] text-xs">Okuryaz.</th>
                        <th className="min-w-[80px] text-xs">Belirli Gün</th>
                        <th className="min-w-[70px] text-xs">Farklıl.</th>
                        <th className="min-w-[70px] text-xs">Okul Plan.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gptDraft.items.slice(0, 12).map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1.5">{row.week_order}</td>
                          <td className="px-2 py-2 max-w-[150px] align-top text-xs">
                            <SmartTextCell value={row.unite || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-1.5">{row.ders_saati ?? 2}</td>
                          <td className="px-2 py-2 max-w-[150px] align-top text-xs">
                            <SmartTextCell value={row.konu || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-2 max-w-[220px] align-top text-xs">
                            <SmartTextCell value={row.kazanimlar || '—'} previewChars={170} />
                          </td>
                          <td className="px-2 py-2 max-w-[120px] align-top text-xs">
                            <SmartTextCell value={row.surec_bilesenleri || '—'} previewChars={95} />
                          </td>
                          <td className="px-2 py-2 max-w-[110px] align-top text-xs">
                            <SmartTextCell value={row.olcme_degerlendirme || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-2 max-w-[110px] align-top text-xs">
                            <SmartTextCell value={row.sosyal_duygusal || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-2 max-w-[100px] align-top text-xs">
                            <SmartTextCell value={row.degerler || '—'} previewChars={80} />
                          </td>
                          <td className="px-2 py-2 max-w-[110px] align-top text-xs">
                            <SmartTextCell value={row.okuryazarlik_becerileri || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-2 max-w-[120px] align-top text-xs">
                            <SmartTextCell value={row.belirli_gun_haftalar || '—'} previewChars={95} />
                          </td>
                          <td className="px-2 py-2 max-w-[110px] align-top text-xs">
                            <SmartTextCell value={row.zenginlestirme || '—'} previewChars={90} />
                          </td>
                          <td className="px-2 py-2 max-w-[120px] align-top text-xs">
                            <SmartTextCell value={row.okul_temelli_planlama || '—'} previewChars={95} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {gptDraft.items.length > 12 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    İlk 12 hafta gösteriliyor. Toplam {gptDraft.items.length} hafta.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : !items.length ? (
            <EmptyState
              icon={<BookOpen className="size-10 text-muted-foreground" />}
              title="Henüz kayıt yok"
              description={
                isBilsem
                  ? 'Ana grup, ders ve öğretim yılı seçerek plan içeriklerini ekleyin. Kazanım modülü bu veriyi kullanacak.'
                  : 'Ders, sınıf ve öğretim yılı seçerek plan içeriklerini ekleyin. Kazanım modülü bu veriyi kullanacak.'
              }
            />
          ) : (
            <>
              <DersAyGroupedTable
                items={items}
                onEdit={openEdit}
                onDelete={handleDelete}
                isBilsem={isBilsem}
              />
              {filters.subject_code && hasGroupFilter && filters.academic_year && (
                <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Plan altı not <span className="text-muted-foreground font-normal">(yıllık plan evrakında tablonun altında küçük yazı; hafta ile ilişkili değil)</span>
                  </label>
                  <textarea
                    value={tabloAltiNot}
                    onChange={(e) => setTabloAltiNot(e.target.value)}
                    placeholder="Örn: * Okul temelli planlama; zümre öğretmenler kurulu kararıyla..."
                    rows={3}
                    className="w-full min-h-[96px] resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        setTabloAltiNotSaving(true);
                        try {
                          await apiFetch('/yillik-plan-icerik/meta', {
                            method: 'PATCH',
                            token,
                            body: JSON.stringify({
                              subject_code: filters.subject_code,
                              academic_year: filters.academic_year,
                              tablo_alti_not: tabloAltiNot.trim() || null,
                              ...(isBilsem
                                ? { ana_grup: filters.ana_grup, alt_grup: filters.alt_grup || undefined, curriculum_model: 'bilsem' }
                                : { grade: parseInt(filters.grade, 10) }),
                            }),
                          });
                          toast.success('Plan altı not kaydedildi');
                          fetchTabloAltiNot();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
                        } finally {
                          setTabloAltiNotSaving(false);
                        }
                      }}
                      disabled={tabloAltiNotSaving}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {tabloAltiNotSaving ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div ref={formCardRef}>
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 bg-muted/20">
            <div>
              <CardTitle>{editing ? 'Kayıt Düzenle' : 'Yeni Kayıt Ekle'}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu form tek haftalık manuel kayıt içindir. Tüm planı tek seferde yüklemek için üstteki JSON/CSV içe aktarma alanını kullanın.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              İptal
            </button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {isBilsem ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ana Grup *</label>
                    <select
                      value={form.ana_grup}
                      onChange={(e) => setForm((f) => ({ ...f, ana_grup: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Seçin</option>
                      {BILSEM_ANA_GRUPLAR.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Alt Grup</label>
                    <select
                      value={form.alt_grup}
                      onChange={(e) => setForm((f) => ({ ...f, alt_grup: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Seçin (opsiyonel)</option>
                      {BILSEM_ALT_GRUPLAR.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">Sınıf *</label>
                  <select
                    value={form.grade}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        grade: e.target.value,
                        subject_code: '',
                        subject_label: '',
                      }));
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Seçin</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        {g}. Sınıf
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Bölüm</label>
                <select
                  value={form.section}
                  onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ders *</label>
                {visibleFormSubjects.length > 0 ? (
                  <select
                    value={form.subject_code}
                    onChange={(e) => {
                      const sel = visibleFormSubjects.find((s) => s.code === e.target.value);
                      setForm((f) => ({
                        ...f,
                        subject_code: sel?.code ?? '',
                        subject_label: sel?.label ?? '',
                      }));
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Seçin</option>
                    {visibleFormSubjects.map((s, i) => (
                      <option key={`${s.code}-${i}`} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={form.subject_code}
                      onChange={(e) => setForm((f) => ({ ...f, subject_code: e.target.value }))}
                      placeholder="Ders kodu"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={form.subject_label}
                      onChange={(e) => setForm((f) => ({ ...f, subject_label: e.target.value }))}
                      placeholder="Ders etiketi"
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Öğretim Yılı *</label>
                <select
                  value={form.academic_year}
                  onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seçin</option>
                  {academicYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Hafta Sırası (1-38) *</label>
                <input
                  type="number"
                  min={1}
                  max={38}
                  value={form.week_order}
                  onChange={(e) => setForm((f) => ({ ...f, week_order: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ders Saati</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.ders_saati}
                  onChange={(e) => setForm((f) => ({ ...f, ders_saati: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
            <EditorTextarea
              label="Ünite/Tema"
              value={form.unite}
              onChange={(next) => setForm((f) => ({ ...f, unite: next }))}
              placeholder="Ünite veya tema adı"
              rows={3}
            />
            <EditorTextarea
              label="Konu"
              value={form.konu}
              onChange={(next) => setForm((f) => ({ ...f, konu: next }))}
              placeholder="Konu başlığı"
              rows={3}
            />
            </div>
            <EditorTextarea
              label="Öğrenme Çıktıları (Kazanımlar)"
              value={form.kazanimlar}
              onChange={(next) => setForm((f) => ({ ...f, kazanimlar: next }))}
              placeholder="COĞ.9.1.1. formatında veya madde madde"
              rows={6}
            />
            <div className="grid gap-4 xl:grid-cols-2">
            <EditorTextarea
              label="Belirli Gün ve Haftalar"
              value={form.belirli_gun_haftalar}
              onChange={(next) => setForm((f) => ({ ...f, belirli_gun_haftalar: next }))}
              placeholder="Örn: 15 Temmuz Demokrasi ve Millî Birlik Günü"
              rows={3}
            />
            <EditorTextarea
              label="Süreç Bileşenleri"
              value={form.surec_bilesenleri}
              onChange={(next) => setForm((f) => ({ ...f, surec_bilesenleri: next }))}
              placeholder="DB1.1, SDB1.2 vb."
              rows={3}
            />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
            <EditorTextarea
              label="Ölçme ve Değerlendirme"
              value={form.olcme_degerlendirme}
              onChange={(next) => setForm((f) => ({ ...f, olcme_degerlendirme: next }))}
              placeholder="Ölçme ve değerlendirme yöntemleri"
              rows={4}
            />
            <EditorTextarea
              label="Sosyal-Duygusal Öğrenme Becerileri"
              value={form.sosyal_duygusal}
              onChange={(next) => setForm((f) => ({ ...f, sosyal_duygusal: next }))}
              placeholder="Sosyal-duygusal beceriler"
              rows={3}
            />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
            <EditorTextarea
              label="Değerler"
              value={form.degerler}
              onChange={(next) => setForm((f) => ({ ...f, degerler: next }))}
              placeholder="Değerler"
              rows={3}
            />
            <EditorTextarea
              label="Okuryazarlık Becerileri"
              value={form.okuryazarlik_becerileri}
              onChange={(next) => setForm((f) => ({ ...f, okuryazarlik_becerileri: next }))}
              placeholder="Okuryazarlık becerileri"
              rows={3}
            />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
            <EditorTextarea
              label="Farklılaştırma"
              value={form.zenginlestirme}
              onChange={(next) => setForm((f) => ({ ...f, zenginlestirme: next }))}
              placeholder="Farklılaştırma çalışmaları"
              rows={3}
            />
            <EditorTextarea
              label="Okul Temelli Planlama"
              value={form.okul_temelli_planlama}
              onChange={(next) => setForm((f) => ({ ...f, okul_temelli_planlama: next }))}
              placeholder="Okul temelli planlama"
              rows={4}
            />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? '…' : editing ? 'Güncelle' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                İptal
              </button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
