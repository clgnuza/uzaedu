'use client';

import { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { SCHOOL_TYPE_ORDER } from '@/lib/school-labels';
import {
  downloadSchoolExcelTemplate,
  parseExcelToSchoolRows,
  mapRowsToBulkApiSchools,
  type ParsedSchoolRow,
} from '@/lib/school-excel-import';

export function SchoolBulkImport({
  token,
  onSuccess,
  onCancel,
}: {
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<ParsedSchoolRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const parsed = await parseExcelToSchoolRows(file);
      setRows(parsed);
      if (parsed.length === 0) toast.warning('Dosyada geçerli satır bulunamadı');
      else toast.success(`${parsed.length} okul yüklendi, önizlemeyi kontrol edin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel okunamadı');
      toast.error('Dosya okunamadı');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleImport = async () => {
    if (!token || rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const schools = mapRowsToBulkApiSchools(rows);
      const res = await apiFetch<{ created: number; ids: string[]; errors?: { row: number; message: string }[] }>(
        '/schools/bulk',
        {
          method: 'POST',
          token,
          body: JSON.stringify({ schools }),
        },
      );
      if (res.errors?.length) {
        toast.warning(`${res.created} okul eklendi, ${res.errors.length} satırda hata`);
        setError(res.errors.map((e) => `Satır ${e.row}: ${e.message}`).join('\n'));
      } else {
        toast.success(`${res.created} okul eklendi`);
        onSuccess();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İçe aktarma başarısız');
      toast.error('İçe aktarma başarısız');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert message={error} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadSchoolExcelTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <Download className="size-4" />
          Excel şablonu indir
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20">
          <Upload className="size-4" />
          {uploading ? 'Yükleniyor…' : 'Excel seç'}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Sütunlar (isteğe bağlı alanlar boş bırakılabilir): name, type (
        {SCHOOL_TYPE_ORDER.join('/')}), segment
        (devlet/ozel), city, district, institution_code, address, website_url, phone, fax, institutional_email,
        principal_name, about_description, status (deneme/aktif/askida), teacher_limit
      </p>
      {rows.length > 0 && (
        <>
          <div className="max-h-60 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="px-3 py-2 font-semibold">Okul adı</th>
                  <th className="px-3 py-2 font-semibold">Tür</th>
                  <th className="px-3 py-2 font-semibold">Segment</th>
                  <th className="px-3 py-2 font-semibold hidden sm:table-cell">İl / İlçe</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2">{r.type || '—'}</td>
                    <td className="px-3 py-2">{r.segment || '—'}</td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {[r.city, r.district].filter(Boolean).join(' / ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 && (
            <p className="text-xs text-muted-foreground">
              İlk 20 satır gösteriliyor. Toplam {rows.length} okul içe aktarılacak.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <FileSpreadsheet className="size-4" />
              {importing ? 'İçe aktarılıyor…' : `${rows.length} okulu içe aktar`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
