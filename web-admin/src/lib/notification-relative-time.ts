/** Kilit ekranı / iOS tarzı göreli zaman */
export function formatNotificationRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'şimdi';
  if (diffMins < 60) return `${diffMins} dk. önce`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} sa. önce`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
