import { NextResponse } from 'next/server';

/** TV Günün Sözü bar — örnek RSS. TV ayarlarına tam URL: …/gunun-sozu.xml */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Öğretmen Pro — Günün Sözü</title>
    <link>https://ogretmenpro.com</link>
    <description>TV Günün Sözü bar. item/title = söz, item/description = yazar.</description>
    <language>tr-TR</language>
    <item>
      <title>Eğitim, bir milletin kurtuluş reçetesidir.</title>
      <description>Mustafa Kemal Atatürk</description>
    </item>
    <item>
      <title>Öğretmek, öğrenmektir.</title>
      <description>Mevlana Celaleddin Rumi</description>
    </item>
    <item>
      <title>Çocuklarınızın sizden aldığı eğitim, onların geleceğidir.</title>
      <description>Mustafa Kemal Atatürk</description>
    </item>
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
