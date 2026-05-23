import type { ReportPrintMode } from '@/lib/ders-dagit-report-settings';
import type { StudioReportSettings } from '@/lib/ders-dagit-report-settings';
import { reportHeaderLine } from '@/lib/ders-dagit-report-settings';

import { REPORT_PRINT_INLINE_CSS } from '@/lib/report-print-styles';

export function openReportPrintPreview(htmlBody: string, mode: ReportPrintMode) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) {
    throw new Error('Pop-up engellendi; önizleme penceresi açılamadı.');
  }
  const bodyClass = mode === 'bw' ? 'print-bw' : 'print-color';
  const css = REPORT_PRINT_INLINE_CSS;
  w.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Yazdır önizleme</title>
  <style>${css}</style>
</head>
<body class="${bodyClass}">
  <div class="report-print-root">${htmlBody}</div>
  <script>
    window.onload = function() { window.print(); };
  <\/script>
</body>
</html>`);
  w.document.close();
}

export function buildCoverPreviewHtml(
  settings: StudioReportSettings,
  fallbacks: { schoolName?: string; academicYear?: string | null; programName?: string },
): string {
  const header = reportHeaderLine(settings, fallbacks);
  const title = settings.texts.title?.trim() || 'HAFTALIK DERS PROGRAMI';
  const sub = settings.texts.subtitle?.trim() || fallbacks.programName || '';
  const addr = settings.meta.address?.trim();
  const phone = settings.meta.phone?.trim();
  const principal = settings.meta.principal_name?.trim();
  const footer = settings.texts.footer_note?.trim();
  return `
    <header class="report-print-header">
      <p class="report-print-tc">T.C.</p>
      <p class="report-print-meb">Millî Eğitim Bakanlığı</p>
      <h1>${escapeHtml(header)}</h1>
      <h2>${escapeHtml(title)}</h2>
      ${sub ? `<p class="report-print-sub">${escapeHtml(sub)}</p>` : ''}
      ${addr ? `<p>${escapeHtml(addr)}</p>` : ''}
      ${phone ? `<p>Tel: ${escapeHtml(phone)}</p>` : ''}
      ${principal ? `<p>Müdür: ${escapeHtml(principal)}</p>` : ''}
    </header>
    <div class="report-print-cover-body">
      <p>Bu belge okul ders dağıtım programının resmi çıktısıdır.</p>
      <p class="report-print-date">Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
    </div>
    ${footer ? `<footer class="report-print-footer">${escapeHtml(footer)}</footer>` : ''}
  `;
}

export function buildApprovalPreviewHtml(settings: StudioReportSettings): string {
  const approval =
    settings.texts.approval_text?.trim() ||
    'Karar: Okulda uygulanacak ders dağıtım programı kurulca incelenmiş ve onaylanmıştır.';
  const principalLabel = settings.texts.principal_signature_label?.trim() || 'Okul Müdürü';
  const principal = settings.meta.principal_name?.trim();
  const footer = settings.texts.footer_note?.trim();
  return `
    <header class="report-print-header">
      <h1>ZÜMRE ÖĞRETMENLER KURULU — ONAY BLOĞU</h1>
    </header>
    <p class="report-print-approval">${escapeHtml(approval)}</p>
    <div class="report-print-signatures">
      <p>${escapeHtml(principalLabel)}: ${principal ? escapeHtml(principal) : '_________________________'}</p>
      <p>Zümre Başkanı: _________________________</p>
      <p>İnsan Kaynakları / İdareci: _________________________</p>
    </div>
    ${footer ? `<footer class="report-print-footer">${escapeHtml(footer)}</footer>` : ''}
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
