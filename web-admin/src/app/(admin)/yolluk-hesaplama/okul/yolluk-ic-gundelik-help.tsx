'use client';

import type { ReactNode } from 'react';
import { GECICI_IC_GUNDELIK_ONCELIK_OKUL } from './yolluk-gecici-options';

function HelpBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{title}</p>
      <div className="mt-1.5 space-y-1.5 text-[12px] leading-snug text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </div>
  );
}

export function KadroDerecesiInfoContent() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold leading-tight text-foreground">Kadro derecesi (H cetveli)</p>
      <HelpBlock title="Bu alan ne işe yarar?">
        <p>
          Personelinizin <strong>H cetveli</strong> kapsamındaki 1–15 arası kadro derecesine karşılık gelen günlük (TL)
          tutarını seçmenizi sağlar. Yukarıda seçtiğiniz <strong>mali yıla</strong> göre tutarlar listede gösterilir; bu
          liste kurumunuza tanımlı güncel yolluk çizelgesinden gelir.
        </p>
      </HelpBlock>
      <HelpBlock title="Ne zaman seçmelisiniz?">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Elle gündelik (TL)</strong> alanı boş veya 0 iken ve ek gösterge bandı kullanmayacaksanız dereceyi
            seçin.
          </li>
          <li>
            «<strong>— Yedek gündelik —</strong>» seçerseniz bu alan devre dışı kalır; sıradaki uygun kaynak (yedek veya
            diğer seçimleriniz) geçerlidir.
          </li>
        </ul>
      </HelpBlock>
      <HelpBlock title="Öncelik sırası">
        <p>{GECICI_IC_GUNDELIK_ONCELIK_OKUL}</p>
      </HelpBlock>
    </div>
  );
}

export function EkGostergeInfoContent() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold leading-tight text-foreground">Ek gösterge bandı</p>
      <HelpBlock title="Bu alan ne işe yarar?">
        <p>
          Unvan / ek gösterge durumuna karşılık gelen <strong>bant kodu</strong> (ör. A0, B1…) ve o banda bağlı günlük
          tutarı seçmenizi sağlar. Kodlar ve TL değerleri <strong>okulunuza tanımlı yolluk çizelgesinden</strong> gelir;
          listede eksik satır veya «?» tutar görürseniz kurum mali işler veya destek hattı ile görüşün.
        </p>
      </HelpBlock>
      <HelpBlock title="Ne zaman seçmelisiniz?">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Kurumunuzda kullanılan ek gösterge karşılığı, kadro derecesinden <strong>farklı</strong> bir günlük üretiyorsa
            uygun bandı seçin.
          </li>
          <li>
            <strong>Elle gündelik</strong> girmediyseniz ve listede size uygun band varsa burayı kullanın.
          </li>
        </ul>
      </HelpBlock>
      <HelpBlock title="Nasıl seçilir?">
        <p>
          Açılır listeden bandı seçin. «<strong>— Derece / yedek —</strong>» ile ek göstergeyi kapatıp kadro derecesi
          veya yedek akışına dönebilirsiniz.
        </p>
      </HelpBlock>
      <HelpBlock title="Öncelik sırası">
        <p>{GECICI_IC_GUNDELIK_ONCELIK_OKUL}</p>
      </HelpBlock>
    </div>
  );
}

export function ElleGundelikInfoContent() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold leading-tight text-foreground">Elle gündelik (TL)</p>
      <HelpBlock title="Bu alan ne işe yarar?">
        <p>
          Geçici yollukta tabloda kullanılacak <strong>günlük matrahı</strong> TL olarak elle yazmanızı sağlar.{' '}
          <strong>0’dan büyük</strong> bir değer girdiğinizde bu tutar geçerli olur; aynı kayıtta kadro derecesi ve ek
          gösterge seçimi <strong>bu hesapta kullanılmaz</strong>.
        </p>
      </HelpBlock>
      <HelpBlock title="Ne zaman kullanılır?">
        <ul className="list-disc space-y-1 pl-4">
          <li>Listede derece veya bandınız yoksa ya da mali işlerin onayladığı net tutarı birebir yazmak gerekiyorsa.</li>
          <li>Geçici düzeltme veya özel bir görev günü için farklı günlük gerekiyorsa.</li>
        </ul>
      </HelpBlock>
      <HelpBlock title="Nasıl girilir?">
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>0</strong> veya boş → elle gündelik yok sayılır; kadro / ek gösterge / yedek sırası işler.
          </li>
          <li>
            <strong>0’dan büyük</strong> değer → her zaman <strong>önce</strong> bu tutar kullanılır.
          </li>
        </ul>
      </HelpBlock>
      <HelpBlock title="Öncelik sırası">
        <p>{GECICI_IC_GUNDELIK_ONCELIK_OKUL}</p>
      </HelpBlock>
    </div>
  );
}
