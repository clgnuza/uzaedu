'use client';

import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function ForgotPasswordGateDialog({
  open,
  onOpenChange,
  continueHref,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continueHref: string;
  role: 'teacher' | 'school';
}) {
  const isSchool = role === 'school';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Şifre sıfırlama"
        descriptionId="forgot-gate-desc"
        className="sm:max-w-md"
      >
        <p id="forgot-gate-desc" className="text-sm leading-relaxed text-muted-foreground">
          {isSchool ? (
            <>
              <strong className="text-foreground">Sosyal giriş</strong> (Google / Apple vb.) ile oluşturulan hesaplarda e-posta şifresi
              yoktur; <strong className="text-foreground">şifre sıfırlama uygulanmaz</strong>. Giriş için kayıtta kullandığınız yöntemi
              kullanın. Okul hesabınız yalnızca kurumsal e-posta ve şifreyle tanımlıysa aşağıdan şifre sıfırlama sayfasına
              geçebilirsiniz.
            </>
          ) : (
            <>
              <strong className="text-foreground">Google, Apple veya SMS</strong> ile kayıtlı hesaplarda şifre sıfırlama yoktur; aynı
              yöntemle giriş yapın. <strong className="text-foreground">E-posta ve şifre</strong> ile kayıt olduysanız şifre sıfırlama
              adımlarına devam edebilirsiniz.
            </>
          )}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Kapat
          </button>
          <Link
            href={continueHref}
            onClick={() => onOpenChange(false)}
            className={
              isSchool
                ? 'inline-flex items-center justify-center rounded-xl bg-linear-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-amber-500/20'
                : 'inline-flex items-center justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-violet-500/25'
            }
          >
            E-posta + şifre hesabım — devam
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
