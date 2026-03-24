/** Varsayılan yasal sayfa içerikleri (HTML parça — h1 yok, gövde). */
export const DEFAULT_LEGAL_PAGES = {
  privacy: {
    title: 'Gizlilik Politikası',
    meta_description: 'Öğretmen Pro gizlilik politikası ve KVKK aydınlatma metni',
    body_html: `
<h2 class="text-xl font-semibold text-foreground mt-8">1. Giriş</h2>
<p class="text-muted-foreground">Öğretmen Pro (&quot;Platform&quot;) olarak kişisel verilerinizin güvenliği bizim için önemlidir. Bu Gizlilik Politikası, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında verilerinizin nasıl toplandığı, işlendiği ve korunduğunu açıklamaktadır.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">2. Veri Sorumlusu</h2>
<p class="text-muted-foreground">Kişisel verilerinizin işlenmesinden Öğretmen Pro platformunu işleten şirket sorumludur. İletişim için: kvkk@ogretmenpro.com</p>
<h2 class="text-xl font-semibold text-foreground mt-6">3. Toplanan Veriler</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li><strong class="text-foreground">Kimlik ve iletişim:</strong> E-posta, görünen ad, telefon (sosyal giriş için)</li>
<li><strong class="text-foreground">Hesap bilgileri:</strong> Rol, okul bağlantısı, durum</li>
<li><strong class="text-foreground">Kullanım verisi:</strong> Giriş/çıkış, duyuru okunma, bildirim tercihleri</li>
<li><strong class="text-foreground">Teknik veri:</strong> Cihaz tokenı (push bildirimleri için), IP (log)</li>
<li><strong class="text-foreground">Dışa aktarma yedekleri:</strong> İndirdiğiniz JSON dosyaları kişisel veri içerir; dosyayı nerede sakladığınız (bilgisayar, Google Drive vb.) ve bulut sağlayıcı koşulları size bağlıdır.</li>
</ul>
<h2 class="text-xl font-semibold text-foreground mt-6">4. Veri İşleme Amaçları</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li>Hesap oluşturma ve kimlik doğrulama</li>
<li>Okul duyuruları, nöbet, evrak ve diğer modülleri sunma</li>
<li>Bildirim ve push mesajları gönderme</li>
<li>Güvenlik, denetim ve yasal yükümlülüklerin yerine getirilmesi</li>
</ul>
<h2 class="text-xl font-semibold text-foreground mt-6">5. Hukuki Sebepler</h2>
<p class="text-muted-foreground">Verileriniz hizmet sözleşmesinin ifası, meşru menfaat ve açık rızanız kapsamında işlenmektedir.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">6. Saklama Süresi</h2>
<p class="text-muted-foreground">Aktif hesaplar için hizmet süresi boyunca; hesap kapatıldığında hesap kimliği anonimleştirilir ve öğretmen ajandasındaki verileriniz sistemden silinir. Denetim (audit) logları yaklaşık 90 gün sonra otomatik silinir. Yasal zorunluluklar için gereken süreler saklıdır.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">7. Haklarınız (KVKK Madde 11)</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
<li>İşlenmişse buna ilişkin bilgi talep etme</li>
<li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
<li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
<li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
<li>Silme veya yok etme talep etme</li>
<li>Otomatik sistemler vasıtasıyla analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz</li>
<li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde tazminat talep etme</li>
</ul>
<p class="text-muted-foreground mt-2">Bu haklarınızı kullanmak için <strong class="text-foreground">Profil</strong> veya <strong class="text-foreground">Ayarlar</strong> üzerinden veri indirme / hesap kapatma işlemlerini kullanabilir veya kvkk@ogretmenpro.com adresine yazarak başvurabilirsiniz.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">8. Veri Güvenliği</h2>
<p class="text-muted-foreground">Verileriniz şifreleme (HTTPS, bcrypt), erişim kontrolü ve denetim logları ile korunmaktadır. Web oturumunda erişim jetonu mümkün olduğunda httpOnly çerez ile taşınır (tarayıcı betiklerinden okunamaz).</p>
<h2 class="text-xl font-semibold text-foreground mt-6">9. Değişiklikler</h2>
<p class="text-muted-foreground">Bu politika güncellendiğinde sayfa sonundaki tarih değiştirilir. Önemli değişikliklerde e-posta veya uygulama içi bildirim ile bilgilendirilirsiniz.</p>
`.trim(),
  },
  terms: {
    title: 'Kullanım Şartları',
    meta_description: 'Öğretmen Pro kullanım şartları ve hizmet sözleşmesi',
    body_html: `
<h2 class="text-xl font-semibold text-foreground mt-8">1. Kabul ve Kapsam</h2>
<p class="text-muted-foreground">Öğretmen Pro platformuna kayıt olarak veya hizmetleri kullanarak bu Kullanım Şartlarını kabul etmiş sayılırsınız. Bu şartlar, web admin, mobil uygulama ve ilgili tüm hizmetleri kapsar.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">2. Hizmet Tanımı</h2>
<p class="text-muted-foreground">Öğretmen Pro, öğretmenler ve okul yöneticileri için duyuru, nöbet, evrak, kazanım takibi, Duyuru TV ve benzeri modüller sunan bir eğitim yönetim platformudur. Hizmetler &quot;olduğu gibi&quot; sunulur; kesintisiz çalışma garanti edilmez.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">3. Hesap Sorumlulukları</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li>Kayıt bilgilerinizin doğru ve güncel olmasından siz sorumlusunuz.</li>
<li>Hesap güvenliğinizi (şifre, cihaz) sizin korumanız gerekir.</li>
<li>Hesabınız üzerinden yapılan işlemlerden sorumlusunuz.</li>
</ul>
<h2 class="text-xl font-semibold text-foreground mt-6">4. Yasak Davranışlar</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li>Başka kullanıcı hesaplarına yetkisiz erişim</li>
<li>Yanıltıcı, zararlı veya yasalara aykırı içerik paylaşımı</li>
<li>Sistem güvenliğini tehdit eden eylemler</li>
<li>Otomatik araçlarla (bot vb.) aşırı istek gönderme</li>
</ul>
<h2 class="text-xl font-semibold text-foreground mt-6">5. Fikri Mülkiyet</h2>
<p class="text-muted-foreground">Platform, yazılım ve içeriğin fikri mülkiyet hakları Öğretmen Pro&apos;a aittir. İzinsiz kopyalama, dağıtma veya ticari kullanım yasaktır.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">6. Fesih</h2>
<p class="text-muted-foreground">Kurallara aykırı kullanımda hesabınız askıya alınabilir veya sonlandırılabilir. Hesap silme talebinizi Profil bölümünden veya destek üzerinden iletebilirsiniz.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">7. Sorumluluk Sınırı</h2>
<p class="text-muted-foreground">Platform, dolaylı veya dolaysız zararlardan sorumlu tutulamaz. Maksimum sorumluluk kullanıcının ödediği ücretle sınırlıdır (ücretsiz hizmetlerde bu da geçerlidir).</p>
<h2 class="text-xl font-semibold text-foreground mt-6">8. İletişim</h2>
<p class="text-muted-foreground">Sorularınız için: kvkk@ogretmenpro.com</p>
`.trim(),
  },
  cookies: {
    title: 'Çerez Politikası',
    meta_description: 'Öğretmen Pro çerez kullanımı ve tercihleri',
    body_html: `
<h2 class="text-xl font-semibold text-foreground mt-8">1. Çerez Nedir?</h2>
<p class="text-muted-foreground">Çerezler, web sitelerinin cihazınıza kaydettiği küçük metin dosyalarıdır. Oturum, tercih ve güvenlik amaçlı kullanılır.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">2. Kullandığımız Çerezler</h2>
<ul class="list-disc pl-6 text-muted-foreground space-y-2">
<li><strong class="text-foreground">Zorunlu:</strong> Oturum (token), güvenlik. Hizmetin çalışması için gereklidir.</li>
<li><strong class="text-foreground">Tercih:</strong> Tema (açık/koyu mod). İsteğe bağlıdır.</li>
<li><strong class="text-foreground">Analitik:</strong> (Kullanılıyorsa) Anonim kullanım istatistikleri.</li>
</ul>
<h2 class="text-xl font-semibold text-foreground mt-6">3. Yönetim</h2>
<p class="text-muted-foreground">Tarayıcı ayarlarından çerezleri silebilir veya devre dışı bırakabilirsiniz. Zorunlu çerezler kapalıysa giriş yapılamayabilir.</p>
<h2 class="text-xl font-semibold text-foreground mt-6">4. İletişim</h2>
<p class="text-muted-foreground">Sorularınız için: kvkk@ogretmenpro.com</p>
`.trim(),
  },
} as const;
