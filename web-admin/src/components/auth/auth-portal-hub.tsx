import Link from 'next/link';
import { GraduationCap, Building2, KeyRound, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function qs(redirectQuery?: string) {
  return redirectQuery?.startsWith('?') ? redirectQuery : redirectQuery ? `?${redirectQuery}` : '';
}

type Flow = 'login' | 'register' | 'forgot';

const copy: Record<
  Flow,
  { title: string; subtitle: string; teacherCta: string; schoolCta: string; teacherHint: string; schoolHint: string }
> = {
  login: {
    title: 'Nasıl giriş yapıyorsunuz?',
    subtitle: 'Öğretmen veya okul yöneticisi — doğru sayfayı seçin.',
    teacherCta: 'Öğretmen girişi',
    schoolCta: 'Okul yöneticisi girişi',
    teacherHint: 'E-posta + şifre, doğrulama kodu; Google / Apple / SMS',
    schoolHint: 'Kurumsal (@okul) e-posta + şifre + kod',
  },
  register: {
    title: 'Hesap türünü seçin',
    subtitle: 'Öğretmen kaydı ile okul yöneticisi kaydı farklıdır.',
    teacherCta: 'Öğretmen kaydı',
    schoolCta: 'Okul yöneticisi kaydı',
    teacherHint: 'Kişisel e-posta; isteğe bağlı okul bağlantısı',
    schoolHint: 'Kurum kodu + kurumsal e-posta alan adı',
  },
  forgot: {
    title: 'Şifre sıfırlama',
    subtitle: 'Öğretmen ve okul yöneticisi hesapları için aynı adımlar geçerlidir.',
    teacherCta: 'E-posta ile sıfırla',
    schoolCta: 'Aynı form',
    teacherHint: '6 haneli kod + yeni şifre',
    schoolHint: 'Kurumsal adresinize kod gider',
  },
};

export function AuthPortalHub({ flow, redirectQuery }: { flow: Flow; redirectQuery?: string }) {
  const q = qs(redirectQuery);
  const c = copy[flow];

  if (flow === 'forgot') {
    return (
      <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/35 sm:mb-3 sm:size-12">
            <KeyRound className="size-5 sm:size-6" strokeWidth={2.25} />
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg md:text-xl">{c.title}</h2>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-sm">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/login${q}`}
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-linear-to-r from-violet-600 to-indigo-600 px-4 text-xs font-bold text-white shadow-md shadow-violet-500/30"
          >
            Giriş
          </Link>
          <Link
            href={`/register${q}`}
            className="inline-flex min-h-9 items-center justify-center rounded-full border-2 border-amber-400/60 bg-linear-to-r from-amber-500/15 to-orange-500/10 px-4 text-xs font-bold text-amber-900 dark:text-amber-100"
          >
            Kayıt
          </Link>
        </div>
      </div>
    );
  }

  const teacherHref = flow === 'login' ? `/login/ogretmen${q}` : `/register/ogretmen${q}`;
  const schoolHref = flow === 'login' ? `/login/okul${q}` : `/register/okul${q}`;

  return (
    <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
      <div className="text-center">
        <h2 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg md:text-xl">{c.title}</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-1 sm:text-sm">{c.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Link
          href={teacherHref}
          className={cn(
            'group relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border-2 border-violet-400/50 bg-linear-to-br from-violet-500/20 via-fuchsia-500/10 to-card p-3 shadow-lg shadow-violet-500/15 transition active:scale-[0.99] sm:gap-2 sm:p-4',
            'hover:border-violet-500 hover:shadow-violet-500/25 dark:from-violet-500/25 dark:via-fuchsia-500/15',
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 text-white shadow-md sm:size-11">
            <GraduationCap className="size-5 sm:size-6" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-extrabold text-foreground sm:text-base">{c.teacherCta}</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground sm:text-xs">{c.teacherHint}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-300 sm:text-xs">
            Devam <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          href={schoolHref}
          className={cn(
            'group relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border-2 border-amber-400/55 bg-linear-to-br from-amber-400/25 via-orange-500/15 to-card p-3 shadow-lg shadow-amber-500/15 transition active:scale-[0.99] sm:gap-2 sm:p-4',
            'hover:border-amber-500 hover:shadow-amber-500/25 dark:from-amber-500/20 dark:via-orange-500/12',
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md sm:size-11">
            <Building2 className="size-5 sm:size-6" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-extrabold text-foreground sm:text-base">{c.schoolCta}</span>
          <span className="text-[10px] leading-relaxed text-muted-foreground sm:text-xs">{c.schoolHint}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-200 sm:text-xs">
            Devam <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
