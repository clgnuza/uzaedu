'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';

const TEMPLATE_COLUMNS = [
  'name',
  'type',
  'segment',
  'city',
  'district',
  'website_url',
  'phone',
  'about_description',
  'status',
  'teacher_limit',
] as const;

const TYPE_VALUES = ['ilkokul', 'ortaokul', 'lise'];
const SEGMENT_VALUES = ['devlet', 'ozel'];
const STATUS_VALUES = ['deneme', 'aktif', 'askida'];

type ParsedRow = Record<string, string | number>;

function downloadTemplate() {
  const headers = [
    'name',
    'type',
    'segment',
    'city',
    'district',
    'website_url',
    'phone',
    'about_description',
    'status',
    'teacher_limit',
  ];
  const example = [
    'Örnek İlkokulu',
    'ilkokul',
    'devlet',
    'Ankara',
    'Çankaya',
    'https://okul.meb.gov.tr',
    '0312 555 00 00',
    'Okulumuz hakkında kısa bilgi...',
    'aktif',
    '100',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Okullar');
  XLSX.writeFile(wb, 'okul_sablonu.xlsx');
}

function parseExcelToRows(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject(new Error('Dosya okunamadı'));
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, defval: '' });
        if (!json.length) return resolve([]);
        const headers = json[0].map((h) => String(h).trim().toLowerCase().replace(/\s/g, '_'));
        const rows: ParsedRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] ?? [];
          const obj: ParsedRow = {};
          headers.forEach((h, j) => {
            const v = row[j];
            obj[h] = v != null && v !== '' ? (typeof v === 'number' ? v : String(v).trim()) : '';
          });
          if (obj.name) rows.push(obj);
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsBinaryString(file);
  });
}

function getVal(r: ParsedRow, ...keys: string[]): string | number {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== '') return v;
  }
  return '';
}

function mapToApiSchools(rows: ParsedRow[]): Array<{
  name: string;
  type: string;
  segment: string;
  city?: string | null;
  district?: string | null;
  website_url?: string | null;
  phone?: string | null;
  about_description?: string | null;
  status?: string;
  teacher_limit?: number;
}> {
  return rows.map((r) => {
    const type = String(getVal(r, 'type', 'tür')).toLowerCase() || 'lise';
    const segment = String(getVal(r, 'segment')).toLowerCase() || 'devlet';
    const status = String(getVal(r, 'status', 'durum')).toLowerCase() || 'deneme';
    return {
      name: String(getVal(r, 'name', 'okul_adi', 'okul adı')).trim(),
      type: TYPE_VALUES.includes(type) ? type : 'lise',
      segment: SEGMENT_VALUES.includes(segment) ? segment : 'devlet',
      city: String(getVal(r, 'city', 'il')).trim() || null,
      district: String(getVal(r, 'district', 'ilce', 'ilçe')).trim() || null,
      website_url: String(getVal(r, 'website_url', 'web_sitesi', 'website')).trim() || null,
      phone: String(getVal(r, 'phone', 'telefon')).trim() || null,
      about_description: String(getVal(r, 'about_description', 'detay', 'okulumuz_hakkinda')).trim() || null,
      status: STATUS_VALUES.includes(status) ? status : 'deneme',
      teacher_limit: (() => {
        const v = getVal(r, 'teacher_limit', 'ogretmen_limiti', 'limit');
        return typeof v === 'number' ? v : parseInt(String(v), 10) || 100;
      })(),
    };
  });
}

export function SchoolBulkImport({
  token,
  onSuccess,
  onCancel,
}: {
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
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
      const parsed = await parseExcelToRows(file);
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
      const schools = mapToApiSchools(rows);
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
          onClick={downloadTemplate}
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
        Şablondaki sütunlar: name, type (ilkokul/ortaokul/lise), segment (devlet/ozel), city, district, website_url,
        phone, about_description, status (deneme/aktif/askida), teacher_limit
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
