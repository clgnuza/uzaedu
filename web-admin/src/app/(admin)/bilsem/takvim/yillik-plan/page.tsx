'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Plus, Trash2, Printer } from 'lucide-react';
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
    window.print();
  }, []);

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return (
    <div className="yillik-calisma-plani space-y-6 print:space-y-0">
      <div className="print:hidden rounded-xl bg-muted/30 p-4">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>BİLSEM yıllık çalışma planı</ToolbarPageTitle>
            <ToolbarIconHints
              compact
              items={[
                { label: 'Öğretim yılı', icon: Calendar },
                { label: 'Yazdır', icon: Printer },
                { label: 'Satır ekle', icon: Plus },
              ]}
              summary={`${academicYear} eğitim-öğretim yılı BİLSEM yıllık çalışma programı.${canEdit ? ' Düzenleyip yazdırabilirsiniz.' : ' Görüntüleyip yazdırabilirsiniz.'}`}
            />
          </ToolbarHeading>
          <ToolbarActions>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground shrink-0">Öğr. yılı</Label>
              <Input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-24"
                placeholder="2025-2026"
                readOnly={!canEdit}
              />
            </div>
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={addRow} title="Yeni satır ekle">
                  <Plus className="mr-1.5 size-4" />
                  Ekle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllRows}
                  disabled={rows.length === 0}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  title="Tüm satırları sil"
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Temizle
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} title="Yazdır">
              <Printer className="mr-1.5 size-4" />
              Yazdır
            </Button>
          </ToolbarActions>
        </Toolbar>
      </div>

      <Card className="yillik-calisma-document overflow-hidden border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900 print:border print:border-black print:bg-white print:shadow-none">
        <CardContent className="p-0">
          <div className="border-b border-slate-200 bg-white px-8 py-6 dark:border-slate-700 dark:bg-slate-900 print:border-b print:border-black print:bg-white print:py-8">
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
                  placeholder="Kurum adı (örn: Akşehir BİLSEM Müdürlüğü)"
                />
              </p>
              <div className="mx-auto mt-4 h-px w-48 bg-slate-300 print:bg-black" />
              <p className="mt-3 text-base font-bold text-black print:text-base">
                {academicYear} EĞİTİM-ÖĞRETİM YILI YILLIK ÇALIŞMA PROGRAMI
              </p>
            </div>
          </div>

          <div className="table-x-scroll rounded-lg border-2 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900 print:border print:border-black">
            <table className="yillik-plani-table w-full min-w-[640px] table-fixed border-collapse text-black print:text-black">
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '45%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: canEdit ? '12%' : '17%' }} />
                {canEdit && <col style={{ width: '40px' }} />}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-700 print:border-b-2 print:border-black print:bg-slate-200">
                  <th className="border border-slate-400 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-800 dark:border-slate-500 dark:text-slate-100 print:border print:border-black print:py-2 print:text-black">Aylar</th>
                  <th className="border border-slate-400 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-800 dark:border-slate-500 dark:text-slate-100 print:border print:border-black print:py-2 print:text-black">Yapılacak Çalışmalar</th>
                  <th className="border border-slate-400 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-800 dark:border-slate-500 dark:text-slate-100 print:border print:border-black print:py-2 print:text-black">Tarih</th>
                  <th className="border border-slate-400 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-800 dark:border-slate-500 dark:text-slate-100 print:border print:border-black print:py-2 print:text-black">Düşünceler</th>
                  {canEdit && <th className="w-10 px-2 py-3 print:hidden" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-slate-300 transition-colors hover:bg-slate-100/80 dark:border-slate-600 dark:hover:bg-slate-800/50 print:border-b print:border-black',
                      row.month ? 'bg-slate-100 dark:bg-slate-800/70 print:bg-slate-100' : idx % 2 === 1 && 'bg-slate-50/80 dark:bg-slate-900/40 print:bg-white',
                    )}
                  >
                    <td className="wrap-break-word border-r border-slate-300 px-3 py-2.5 align-top dark:border-slate-600 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.month}
                        onChange={(e) => updateRow(row.id, 'month', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Ay"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-slate-300 px-3 py-2.5 align-top dark:border-slate-600 print:border print:border-black print:py-2 print:text-sm">
                      <textarea
                        value={row.task}
                        onChange={(e) => updateRow(row.id, 'task', e.target.value)}
                        readOnly={!canEdit}
                        rows={2}
                        className={cn(
                          'yillik-plani-input w-full resize-y border-0 bg-transparent text-black shadow-none focus-visible:ring-0 print:min-h-0 print:resize-none print:text-sm',
                          !canEdit && 'cursor-default resize-none overflow-hidden'
                        )}
                        placeholder="Yapılacak iş"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-slate-300 px-3 py-2.5 align-top dark:border-slate-600 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.date}
                        onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Tarih"
                      />
                    </td>
                    <td className="wrap-break-word border-r border-slate-300 px-3 py-2.5 align-top dark:border-slate-600 print:border print:border-black print:py-2 print:text-sm">
                      <Input
                        value={row.responsible}
                        onChange={(e) => updateRow(row.id, 'responsible', e.target.value)}
                        readOnly={!canEdit}
                        className="yillik-plani-input min-h-[32px] w-full border-0 bg-transparent px-1 py-0.5 text-sm text-black shadow-none focus-visible:ring-0 print:min-h-0 print:text-sm"
                        placeholder="Sorumlu"
                      />
                    </td>
                    {canEdit && (
                      <td className="border-l border-slate-300 px-2 py-2 align-top dark:border-slate-600 print:hidden">
                        <Button
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

          <div className="border-t-2 border-slate-300 bg-white px-8 py-8 dark:border-slate-600 dark:bg-slate-900 print:border-t-2 print:border-black print:bg-white print:py-10">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm font-bold text-black print:text-sm">Uygundur.</p>
                <p className="mt-6 text-sm text-black print:mt-8 print:text-sm">{dateStr}</p>
                <Input
                  value={mudurAdi}
                  onChange={(e) => setMudurAdi(e.target.value)}
                  readOnly={!canEdit}
                  className="yillik-plani-input mt-3 w-48 border-0 border-b-2 border-black bg-transparent text-center text-sm font-semibold text-black shadow-none focus-visible:ring-0 print:mt-4 print:border-b-2 print:border-black print:text-sm"
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
