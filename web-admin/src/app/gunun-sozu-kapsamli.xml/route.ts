import { NextResponse } from 'next/server';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Uzaedu Öğretmen — Günün Sözü (Kapsamlı Örnek)</title>
    <link>https://uzaedu.com</link>
    <description>TV Günün Sözü barı için kapsamlı örnek RSS. item/title=söz, item/description=yazar.</description>
    <language>tr-TR</language>
    <item><title>Eğitimdir ki bir milleti ya hür, bağımsız, şanlı, yüksek bir topluluk halinde yaşatır ya da esaret ve sefalete terk eder.</title><description>Mustafa Kemal Atatürk</description></item>
    <item><title>Öğretmen bir kandile benzer; kendini tüketerek başkalarına ışık verir.</title><description>Mustafa Kemal Atatürk</description></item>
    <item><title>Yarınlar, yorgun ve bezgin kimseler değil; rahatını terk edebilen gayretli insanlara aittir.</title><description>Cevdet Aydın</description></item>
    <item><title>Başarı, küçük çabaların her gün tekrarıdır.</title><description>Robert Collier</description></item>
    <item><title>Çocuklara verilebilecek en güzel şey zamandır; en kıymetli yatırım ise eğitimdir.</title><description>Anonim</description></item>
    <item><title>Yapabildiğimiz her şeyi yapsaydık, buna kendimiz bile şaşardık.</title><description>Thomas Edison</description></item>
    <item><title>Bir işi doğru yapmak, onu hızlı yapmaktan önemlidir.</title><description>Peter Drucker</description></item>
    <item><title>Disiplin, hedefler ile başarı arasındaki köprüdür.</title><description>Jim Rohn</description></item>
    <item><title>Öğrenmek, insanın kendi sınırlarını her gün yeniden keşfetmesidir.</title><description>Albert Einstein</description></item>
    <item><title>Bugün attığın küçük bir adım, yarının büyük farkını oluşturur.</title><description>Anonim</description></item>
    <item><title>Okul, yalnız bilgi verilen yer değil; karakter inşa edilen yerdir.</title><description>John Dewey</description></item>
    <item><title>İyi bir öğretmen, öğrencisinin içinde saklı cevheri görendir.</title><description>Maria Montessori</description></item>
    <item><title>Zor olanı başarmak zaman alır; imkansız sanılan ise biraz daha fazla.</title><description>George Santayana</description></item>
    <item><title>Her çocuk özeldir; önemli olan ona açılacak doğru kapıyı bulmaktır.</title><description>Lev Vygotsky</description></item>
    <item><title>Azim, yeteneğin ulaşamadığı yere ulaşır.</title><description>Angela Duckworth</description></item>
    <item><title>Bilgi paylaşıldıkça artar, umut yayıldıkça güçlenir.</title><description>Anonim</description></item>
    <item><title>Bir öğrenciyi değiştiren öğretmen, bir toplumu değiştirir.</title><description>Haim Ginott</description></item>
    <item><title>Sabır, eğitimin sessiz kahramanıdır.</title><description>Anonim</description></item>
    <item><title>Hata yapmak öğrenmenin cezası değil, parçasıdır.</title><description>Ken Robinson</description></item>
    <item><title>En büyük başarı, vazgeçmeyi aklından geçirdiğin anda bir adım daha atabilmektir.</title><description>Anonim</description></item>
    <item><title>Dersin konusu unutulur; öğretmenin dokunuşu kalır.</title><description>Anonim</description></item>
    <item><title>Planlı emek, tesadüfi başarıdan her zaman daha güçlüdür.</title><description>Brian Tracy</description></item>
    <item><title>Gençlere güvenen bir toplum, geleceğe güvenle yürür.</title><description>Hasan Ali Yücel</description></item>
    <item><title>İlham bekleme; çalışmaya başla, ilham yolda sana yetişir.</title><description>Jack London</description></item>
    <item><title>Bugünün öğrencileri, yarının ülkesidir.</title><description>Anonim</description></item>
  </channel>
</rss>
`;

export const dynamic = 'force-static';

export async function GET() {
  return new NextResponse(XML, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
