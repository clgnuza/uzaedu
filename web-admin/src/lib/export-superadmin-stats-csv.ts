import type { StatsResponse } from '@/lib/stats-response';
import { SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';

function esc(s: string) {
  const q = s.includes(',') || s.includes('"') || s.includes('\n');
  const t = s.replace(/"/g, '""');
  return q ? `"${t}"` : t;
}

export function downloadSuperadminStatsCsv(stats: StatsResponse, filename = 'platform-ozet.csv') {
  const sa = stats.superadmin;
  const lines: string[] = [];
  lines.push('Bölüm,Anahtar,Değer');
  lines.push(`Özet,okul_sayısı,${stats.schools}`);
  lines.push(`Özet,kullanıcı_sayısı,${stats.users}`);
  lines.push(`Özet,duyuru_sayısı,${stats.announcements}`);
  if (sa) {
    lines.push(`Kota,eşik_oranı,${sa.teacher_quota_near_ratio ?? 0.9}`);
    lines.push(`Kota,kota_dolu_okul,${sa.schools_teacher_quota_full}`);
    lines.push(`Kota,kota_yakin_okul,${sa.schools_teacher_quota_near}`);
    Object.entries(sa.users_by_role).forEach(([k, v]) => lines.push(`Rol,${esc(k)},${v}`));
    Object.entries(sa.users_by_status).forEach(([k, v]) => lines.push(`Durum,${esc(k)},${v}`));
    lines.push(`Öğretmen,onay_bekleyen,${sa.teachers_pending_approval}`);
    sa.module_school_counts.forEach((m) => {
      const label = SCHOOL_MODULE_LABELS[m.key as SchoolModuleKey] ?? m.key;
      lines.push(`Modül,${esc(label)},${m.count}`);
    });
    stats.chart.forEach((c) => lines.push(`Duyuru_aylik,${esc(c.month)},${c.count}`));
    if (sa.users_registration_chart) {
      sa.users_registration_chart.forEach((c) => lines.push(`Kayit_aylik,${esc(c.month)},${c.count}`));
    }
  }
  const bom = '\ufeff';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
