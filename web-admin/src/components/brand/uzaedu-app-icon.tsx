import Image from 'next/image';
import { cn } from '@/lib/utils';
import { PWA_SEAL_CENTER_LOGO } from '@/lib/pwa-assets';

type Props = {
  className?: string;
  size?: number;
};

/** PWA marka ikonu — seal halka merkez logosu */
export function UzaeduAppIcon({ className, size = 64 }: Props) {
  return (
    <Image
      src={PWA_SEAL_CENTER_LOGO}
      alt="Uzaedu"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-[22%] object-contain drop-shadow-[0_8px_24px_rgba(220,38,38,0.35)]', className)}
      unoptimized
    />
  );
}
