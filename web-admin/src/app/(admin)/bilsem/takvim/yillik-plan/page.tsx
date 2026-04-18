'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Printer, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PlanRow = {
  id: string;
  month: string;
  task: string;
  date: string;
  responsible: string;
};

const DEFAULT_ROWS: PlanRow[] = [
  { id: '1', month: 'AĞUSTOS 2025', task: 'Elektrik su, baca, kalorifer ve kanalizasyon kontrolü ve bakımı.', date: '01-05 Ağustos 2025', responsible: 'Mdr. Yrd.' },
  { id: '2', month: '', task: 'Kurumdaki birimlerin ve ortak kullanım alanlarının eğitim-öğretime hazır hale getirilmesi.', date: '01-05 Ağustos 2025', responsible: 'Mdr. Yrd.' },
  { id: '3', month: '', task: 'Personel görev dağılımlarının yapılması. (Müdür Yardımcısı, Memur, Hizmetliler)', date: '26 Ağustos 2025', responsible: 'Müdür' },
  { id: '4', month: '', task: 'Öğretmen ihtiyacının belirlenmesi atama yada görevlendirmelerin yapılması', date: '26 Ağustos 2025', responsible: 'Müdür' },
  { id: '5', month: '', task: 'Destek, BYF, ÖYG ve PROJE EĞİTİMİ Programlarının hazırlanması.', date: '31 Ağustos 2025', responsible: 'Öğretmenler' },
  { id: '6', month: '', task: 'Kayıt yenileme işlemleri', date: '19 Ağustos/05 Eylül 2025', responsible: 'Mdr. Yrd.' },
  { id: '7', month: 'EYLÜL 2025', task: 'Öğretmenlerin Mesleki Çalışmaları', date: '1-5 Eylül 2025', responsible: 'Öğretmenler' },
  { id: '8', month: '', task: 'Velilere yönelik bilgilendirme toplantısı', date: '9 Eylül 2025', responsible: 'PDR' },
  { id: '9', month: '', task: 'İlköğretim Haftası', date: '08-12 Eylül 2025', responsible: 'Öğretmenler' },
  { id: '10', month: '', task: '2025-2026 1. Dönem Eğitim Öğretimin Başlaması', date: '8 Eylül 2025', responsible: 'Öğretmenler' },
  { id: '11', month: '', task: '15 Temmuz Demokrasi ve Milli Birlik Günü', date: '19-23 Eylül 2025', responsible: 'Öğretmenler' },
  { id: '12', month: '', task: '2025-2026 Stratejik Eylem Planının Hazırlanması', date: '26-30 Eylül 2025', responsible: 'Mdr.Yrd. Komisyon' },
  { id: '13', month: 'EKİM 2025', task: 'Kurumla ilgili istatistik bilgilerin hazırlanması. (MEBİS)', date: '3 Ekim 2025', responsible: 'Müdür' },
  { id: '14', month: '', task: 'Stratejik Planın gözden geçirilmesi, Eylem Planının teslim edilmesi', date: '14 Ekim 2025', responsible: 'Mdr.Yrd. Komisyon' },
  { id: '15', month: '', task: 'Cumhuriyet Bayramı', date: '29 Ekim 2025', responsible: 'Öğretmenler' },
  { id: '16', month: 'KASIM 2025', task: 'Atatürk Haftası-10 Kasım programı', date: '10-16 Kasım 2025', responsible: 'Öğretmenler' },
  { id: '17', month: '', task: 'Birinci Dönem Ara Tatili', date: '10-15 Kasım 2025', responsible: '' },
  { id: '18', month: '', task: 'Öğretmenler Günü ve Öğretmenler Haftası', date: '22-28 Kasım 2025', responsible: 'Öğretmenler' },
  { id: '19', month: 'ARALIK 2025', task: 'Sayım komisyonunca taşınırların sayımlarının yapılması.', date: '01-10 Aralık 2025', responsible: 'VHKİ' },
  { id: '20', month: 'OCAK 2026', task: 'Yılbaşı Tatili', date: '1 Ocak 2026', responsible: '' },
  { id: '21', month: '', task: 'Birinci Dönem Sonu Yarıyıl Tatili', date: '16 Ocak 2026', responsible: '' },
  { id: '22', month: 'ŞUBAT 2026', task: 'İkinci yarıyılın başlaması', date: '2 Şubat 2026', responsible: '' },
  { id: '23', month: '', task: 'Öğretmenler Kurulunun Yapılması', date: '3 Şubat 2026', responsible: 'Müdür' },
  { id: '24', month: 'MART 2026', task: '1-7 Mart Deprem Haftası', date: '1-7 Mart 2026', responsible: 'Öğretmenler' },
  { id: '25', month: '', task: 'İstiklal Marşının Kabulü ve Mehmet Akif Ersoy\'u Anma Günü', date: '12 Mart 2026', responsible: 'Öğretmenler' },
  { id: '26', month: 'NİSAN 2026', task: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', date: '23 Nisan 2026', responsible: 'Öğretmenler' },
  { id: '27', month: 'MAYIS 2026', task: '19 Mayıs Atatürk\'ü Anma Gençlik ve Spor Bayramı', date: '19 Mayıs 2026', responsible: 'Öğretmenler' },
  { id: '28', month: 'HAZİRAN 2026', task: 'Eğitim Dönemi Sonu', date: '26 Haziran 2026', responsible: '' },
  { id: '29', month: 'TEMMUZ-AĞUSTOS 2026', task: 'Öğretmenlerin tatile girmesi.', date: '1 Temmuz 2026', responsible: '' },
  { id: '30', month: '', task: '30 Ağustos Zafer Bayramı.', date: '30 Ağustos 2026', responsible: '' },
];

function getDefaultAcademicYear(): string {
  const now = new Date();
  return now.getMonth() >= 8 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
}

const YILLIK_PRINT_PAGE_STYLE_ID = 'bilsem-yillik-plan-print-atpage';
const YILLIK_PRINT_PAGE_CSS = `@media print {
  @page { size: A4 portrait; margin: 3mm 4.5mm; }
  html, body { height: auto !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

function ensureYillikPrintPageStyle() {
  if (document.getElementById(YILLIK_PRINT_PAGE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = YILLIK_PRINT_PAGE_STYLE_ID;
  style.textContent = YILLIK_PRINT_PAGE_CSS;
  document.head.appendChild(style);
}

function removeYillikPrintPageStyle() {
  document.getElementById(YILLIK_PRINT_PAGE_STYLE_ID)?.remove();
}

export default function BilsemYillikPlanPage() {
  const { me } = useAuth();
  const isSchoolAdmin = me?.role === 'school_admin';
  const canEdit = isSchoolAdmin;
  const [kaymakamlik, setKaymakamlik] = useState('');
  const [kurumAdi, setKurumAdi] = useState('');
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear);
  const [mudurAdi, setMudurAdi] = useState('');
  const [rows, setRows] = useState<PlanRow[]>(DEFAULT_ROWS);

  useEffect(() => {
    if (!me) return;
    const school = me.school;
    const defaults = me.evrak_defaults;
    if (school?.district) {
      setKaymakamlik((k) => k || `${school.district} KAYMAKAMLIĞI`);
    }
    if (school?.name) {
      setKurumAdi((k) => k || school.name);
    }
    if (defaults?.ogretim_yili) {
      const oy = defaults.ogretim_yili;
      setAcademicYear((a) => a || oy);
    }
    if (defaults?.mudur_adi || school?.principalName) {
      setMudurAdi((m) => m || (defaults?.mudur_adi ?? school?.principalName ?? ''));
    }
  }, [me]);

  useEffect(() => {
    const onBefore = () => ensureYillikPrintPageStyle();
    const onAfter = () => removeYillikPrintPageStyle();
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      removeYillikPrintPageStyle();
    };
  }, []);

  const addRow = useCallback(() => {
    setRows((r) => [...r, { id: crypto.randomUUID(), month: '', task: '', date: '', responsible: '' }]);
    toast.success('Satır eklendi');
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success('Satır kaldırıldı');
  }, []);

  const clearAllRows = useCallback(() => {
    if (!confirm('Tüm içerik silinecek. Emin misiniz?')) return;
    setRows([]);
    toast.success('İçerik temizlendi');
  }, []);

  const updateRow = useCallback((id: string, field: keyof PlanRow, value: string) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }, []);

  const handlePrint = useCallback(() => {
    ensureYillikPrintPageStyle();
    window.print();
  }, []);

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return (
    <div className="yillik-calisma-plani space-y-3 px-0.5 sm:space-y-5 sm:px-0 print:space-y-0">
      <div className="print:hidden overflow-hidden rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/60 shadow-sm ring-1 ring-violet-500/10 dark:border-violet-800/45 dark:from-violet-950/45 dark:via-zinc-950 dark:to-fuchsia-950/25 dark:ring-violet-500/15 sm:rounded-2xl">
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 sm:size-12 sm:rounded-2xl"
              aria-hidden
            >
              <ClipboardList className="size-5 sm:size-6" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-foreground sm:text-lg">Bilsem yıllık çalışma planı</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-sm sm:leading-normal">
                {academicYear} · Kurum bilgisi ve tablo; yazdırmada yalnızca belge.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <div className="col-span-2 flex items-center gap-2 rounded-lg border border-violet-200/60 bg-white/80 px-2 py-1.5 dark:border-violet-800/50 dark:bg-zinc-900/60 sm:col-span-1 sm:rounded-xl sm:px-3 sm:py-2">
              <Label htmlFor="bilsem-ycp-yil" className="shrink-0 text-[10px] font-medium text-muted-foreground sm:text-xs">
                Öğr. yılı
              </Label>
              <Input
                id="bilsem-ycp-yil"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="h-8 min-w-0 flex-1 border-violet-200/80 text-xs sm:w-[6.5rem] sm:flex-none sm:text-sm dark:border-violet-800/60"
                placeholder="2025-2026"
                readOnly={!canEdit}
              />
            </div>
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  title="Yeni satır ekle"
                  className="h-8 border-violet-200/80 bg-white/90 text-xs dark:border-violet-800/50 dark:bg-zinc-900/60 sm:h-9 sm:text-sm"
                >
                  <Plus className="mr-1 size-3.5 sm:mr-1.5 sm:size-4" />
                  Ekle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllRows}
                  disabled={rows.length === 0}
                  className="h-8 border-violet-200/80 bg-white/90 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-violet-800/50 dark:bg-zinc-900/60 sm:h-9 sm:text-sm"
                  title="Tüm satırları sil"
                >
                  <Trash2 className="mr-1 size-3.5 sm:mr-1.5 sm:size-4" />
                  Sil
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              title="Yazdır"
              className="col-span-2 h-8 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-fuchsia-700 sm:col-span-1 sm:h-9 sm:text-sm"
            >
              <Printer className="mr-1 size-3.5 sm:mr-1.5 sm:size-4" />
              Yazdır
            </Button>
          </div>
        </div>
      </div>

      <Card
        className={cn(
          'yillik-calisma-document overflow-hidden border-violet-200/50 bg-white shadow-md dark:border-violet-800/40 dark:bg-zinc-950',
          'print:border print:border-black print:bg-white print:shadow-none',
        )}
      >
        <CardContent className="p-0">
          <div className="yillik-print-header border-b border-violet-100/80 bg-gradient-to-b from-violet-50/40 to-white px-3 py-4 dark:border-violet-900/35 dark:from-violet-950/30 dark:to-zinc-950 sm:px-4 sm:py-5 print:border-b print:border-black print:bg-white print:from-transparent print:to-transparent">
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium tracking-[0.3em] text-black print:text-sm">T.C.</p>
              <p className="text-base font-semibold text-black print:text-base print:font-bold">
                <Input
                  value={kaymakamlik}
                  onChange={(e) => setKaymakamlik(e.target.value)}
                  readOnly={!canEdit}
                  className="yillik-plani-input border-0 bg-transparent text-center text-base font-semibold text-black shadow-none focus-visible:ring-0 print:text-base"
                  placeholder="Kaymakamlık (örn: Akşehir KAYMAKAMLIĞI)"
                />
              </p>
              <p className="text-lg font-bold text-black print:text-lg">
                <Input
                  value={kurumAdi}
                  onChange={(e) => setKurumAdi(e.target.value)}
                  readOnly={!canEdit}
                  className="yillik-plani-input border-0 bg-transparent text-center text-lg font-bold text-black shadow-none focus-visible:ring-0 print:text-lg"
                  placeholder="Kurum adı (örn: Akşehir Bilsem Müdürlüğü)"
                />
              </p>
              <div className="mx-auto mt-4 h-px w-48 bg-violet-200 print:bg-black dark:bg-violet-800/50" />
              <p className="mt-3 text-base font-bold text-black print:text-base">
                {academicYear} EĞİTİM-ÖĞRETİM YILI YILLIK ÇALIŞMA PROGRAMI
              </p>
            </div>
          </div>

          <div className="table-x-scroll -mx-px overflow-x-auto rounded-lg border-2 border-violet-200/50 bg-white dark:border-violet-800/45 dark:bg-zinc-950 print:mx-0 print:overflow-visible print:rounded-none print:border print:border-black">
            <table
              className={cn(
                'yillik-plani-table w-full min-w-[520px] table-fixed border-collapse text-[11px] text-black sm:min-w-[640px] sm:text-sm print:min-w-0 print:table-auto print:text-black',
              )}
            >
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '45%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: canEdit ? '12%' : '17%' }} />
                {canEdit && <col style={{ width: '40px' }} />}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-violet-300/70 bg-violet-100/90 dark:border-violet-700 dark:bg-violet-950/50 print:border-b-2 print:border-black print:bg-slate-200">
                  <th className="border border-violet-200/80 px-2 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-violet-950 dark:border-violet-800 dark:text-violet-100 print:border print:border-black print:py-2 print:text-black">
                    Aylar
                  </th>
                  <th className="border border-violet-200/80 px-2 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-violet-950 dark:border-violet-800 dark:text-violet-100 print:border print:border-black print:py-2 print:text-black">
                    Yapılacak Çalışmalar
                  </th>
                  <th className="border border-violet-200/80 px-2 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-violet-950 dark:border-violet-800 dark:text-violet-100 print:border print:border-black print:py-2 print:text-black">
                    Tarih
                  </th>
                  <th className="border border-violet-200/80 px-2 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-violet-950 dark:border-violet-800 dark:text-violet-100 print:border print:border-black print:py-2 print:text-black">
                    Düşünceler
                  </th>
                  {canEdit && <th className="w-10 px-2 py-2.5 print:hidden" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-violet-100/90 transition-colors hover:bg-violet-50/40 dark:border-violet-900/40 dark:hover:bg-violet-950/20 print:border-b print:border-black',
                      row.month
                        ? 'bg-violet-50/70 dark:bg-violet-950/35 print:bg-slate-100'
                        : idx % 2 === 1 && 'bg-fuchsia-50/25 dark:bg-fuchsia-950/15 print:bg-white',
                    )}
                  >
                    <td className="wrap-break-word border-r border-violet-100/90 px-2 py-2 align-top dark:border-violet-900/35 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.month}
                        onChange={(e) => updateRow(row.id, 'month', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Ay"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-violet-100/90 px-2 py-2 align-top dark:border-violet-900/35 print:border print:border-black print:py-2 print:text-sm">
                      <textarea
                        value={row.task}
                        onChange={(e) => updateRow(row.id, 'task', e.target.value)}
                        readOnly={!canEdit}
                        rows={2}
                        className={cn(
                          'yillik-plani-input w-full resize-y border-0 bg-transparent text-black shadow-none focus-visible:ring-0 print:min-h-0 print:resize-none print:text-sm',
                          !canEdit && 'cursor-default resize-none overflow-hidden',
                        )}
                        placeholder="Yapılacak iş"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-violet-100/90 px-2 py-2 align-top dark:border-violet-900/35 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.date}
                        onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Tarih"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-violet-100/90 px-2 py-2 align-top dark:border-violet-900/35 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.responsible}
                        onChange={(e) => updateRow(row.id, 'responsible', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Sorumlu"
                      />
                    </td>
                    {canEdit && (
                      <td className="border-l border-violet-100/90 px-1 py-1 align-top dark:border-violet-900/35 print:hidden">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(row.id)}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Satırı kaldır"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="yillik-print-footer border-t-2 border-violet-100/90 bg-gradient-to-b from-white to-violet-50/30 px-4 py-6 dark:border-violet-900/40 dark:from-zinc-950 dark:to-violet-950/20 print:border-t-2 print:border-black print:bg-white print:from-transparent print:to-transparent">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm font-bold text-black print:text-sm">Uygundur.</p>
                <p className="mt-6 text-sm text-black print:mt-8 print:text-sm">{dateStr}</p>
                <Input
                  value={mudurAdi}
                  onChange={(e) => setMudurAdi(e.target.value)}
                  readOnly={!canEdit}
                  className="yillik-plani-input mt-3 w-48 max-w-full border-0 border-b-2 border-black bg-transparent text-center text-sm font-semibold text-black shadow-none focus-visible:ring-0 print:mt-4 print:border-b-2 print:border-black print:text-sm"
                />
                <p className="mt-2 text-xs font-medium text-black print:text-xs">Bilim ve Sanat Merkezi Müdürü</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
