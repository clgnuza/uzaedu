async function uzaDownloadCsv(filename, headerRow, dataRows) {
  const sep = ';';
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = [headerRow, ...dataRows].map((r) => r.map(q).join(sep));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
    return { ok: true };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}
