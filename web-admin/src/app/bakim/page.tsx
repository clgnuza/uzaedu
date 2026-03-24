import { fetchWebExtrasPublic } from '@/lib/web-extras-public';

export default async function BakimPage() {
  const extras = await fetchWebExtrasPublic();
  const html = extras?.maintenance_message_html?.trim() || '<p>Bakım çalışması yapılıyor. Lütfen daha sonra tekrar deneyin.</p>';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-foreground">
      <div
        className="prose prose-sm max-w-lg text-center dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
