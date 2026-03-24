import { redirect } from 'next/navigation';

/** Ders programı artık sol menüde bağımsız. Eski linkleri yeni route'a yönlendir. */
export default function DutyDersProgramiRedirect() {
  redirect('/ders-programi');
}
