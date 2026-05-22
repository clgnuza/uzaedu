import { DersDagitShell } from '@/components/ders-dagit/DersDagitShell';

export default function DersDagitLayout({ children }: { children: React.ReactNode }) {
  return <DersDagitShell>{children}</DersDagitShell>;
}
