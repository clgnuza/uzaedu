import { cn } from '@/lib/utils';

export function HaberSourceFootnote({ className }: { className?: string }) {
  return (
    <aside
      role="note"
      className={cn(
        'rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground sm:px-4 sm:py-3 sm:text-xs dark:bg-muted/10',
        className,
      )}
    >
      <span className="font-semibold text-foreground/85">Kaynak ve kullanım:</span>{' '}
      Başlık ve kısa metinler, Millî Eğitim Bakanlığı ile il millî eğitim müdürlüklerinin internette herkese açık sayfalarından otomatik olarak toplanır; her kayıt ilgili resmî adrese bağlantı verir. Tam metin, görsel ve ekler yalnızca kaynak sitededir. Bu ekran yalnızca bilgilendirme ve ulaşım kolaylığı sunan bir dizindir, resmî yayıncının yerini tutmaz.
    </aside>
  );
}
