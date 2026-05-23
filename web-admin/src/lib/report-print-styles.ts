/** Yazdır önizleme penceresi — report-print.css ile senkron tutun */
export const REPORT_PRINT_INLINE_CSS = `@media screen {
  body { margin: 0; padding: 1.5rem; font-family: system-ui, 'Segoe UI', sans-serif; font-size: 11pt; color: #111; background: #fff; }
}
.report-print-root { max-width: 210mm; margin: 0 auto; }
.report-print-header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #333; padding-bottom: 1rem; }
.report-print-tc { font-size: 9pt; font-weight: 600; margin: 0 0 0.15rem; }
.report-print-meb { font-size: 8pt; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 0.5rem; color: #444; }
.report-print-header h1 { font-size: 14pt; margin: 0.25rem 0; }
.report-print-header h2 { font-size: 12pt; margin: 0.5rem 0 0; font-weight: 700; }
.report-print-sub { color: #444; margin-top: 0.35rem; }
.report-print-cover-body { min-height: 40vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.report-print-date { margin-top: 2rem; font-size: 10pt; }
.report-print-approval { line-height: 1.5; margin: 2rem 0; }
.report-print-signatures p { margin: 1.5rem 0; }
.report-print-footer { margin-top: 3rem; padding-top: 0.75rem; border-top: 1px solid #ccc; font-size: 9pt; color: #555; text-align: center; }
@media print {
  body.print-bw, body.print-bw * { color: #000 !important; background: #fff !important; box-shadow: none !important; -webkit-print-color-adjust: economy; print-color-adjust: economy; }
  body.print-color { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
