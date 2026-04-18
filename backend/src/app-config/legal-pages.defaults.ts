/**
 * Varsayılan yasal sayfa içerikleri (gövde HTML — sayfadaki H1 başlık alanı ayrı: title).
 * Kamu: GET /content/legal-pages. Superadmin: Web ve mobil ayarlar → Gizlilik / Şartlar / Çerez.
 *
 * Not: Veritabanında `legal_pages_config` zaten doluysa bu varsayılanlar tek başına uygulanmaz;
 * içeriği yenilemek için superadmin’den ilgili sekmelerde düzenleyip kaydedin veya DB’deki anahtarı kaldırın.
 */
export const DEFAULT_LEGAL_PAGES = {
  privacy: {
    title: 'Aydınlatma Metni ve Gizlilik Politikası',
    meta_description:
      'Uzaedu Öğretmen KVKK kapsamında kişisel verilerin işlenmesi, amaçlar, haklarınız ve iletişim bilgileri.',
    body_html: `
<h2>1. Giriş</h2>
<p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca veri sorumlusu sıfatıyla Uzaedu Öğretmen (&quot;Platform&quot;) üzerinden sunulan hizmetler kapsamında kişisel verilerinizin nasıl işlendiğini açıklar. Platformu kullanarak veya hesap oluşturarak bu politikayı okuduğunuzu varsayarız.</p>

<h2>2. Veri sorumlusu ve iletişim</h2>
<p>Kişisel verileriniz, Platformu işleten veri sorumlusu tarafından işlenmektedir. KVKK kapsamındaki talepleriniz ve sorularınız için Platform üzerindeki iletişim kanallarını veya yöneticinizin bildirdiği resmi e-posta adresini kullanabilirsiniz.</p>

<h2>3. İşlenen kişisel veri kategorileri</h2>
<ul>
<li><strong>Kimlik ve iletişim:</strong> E-posta adresi, ad veya tercih ettiğiniz görünen ad; telefon numarası (sosyal veya SMS ile giriş tercih edildiğinde).</li>
<li><strong>Hesap ve örgüt:</strong> Kullanıcı rolü (ör. öğretmen, okul yöneticisi), okul bağlantısı, üyelik ve onay durumu.</li>
<li><strong>Kullanım:</strong> Oturum ve güvenlik kayıtları, bildirim tercihleri, modül kullanımına ilişkin teknik kayıtlar.</li>
<li><strong>Cihaz ve teknik:</strong> Push bildirimi için cihaz tokenı; güvenlik ve hata analizi için sınırlı teknik log (ör. IP, zaman damgası).</li>
<li><strong>İçerik:</strong> Platforma sizin tarafınızdan girilen duyuru, evrak, nöbet ve diğer modül verileri; bu verilerde üçüncü kişilere ait kişisel veriler bulunabilir, bunların doğruluğu ve hukuki dayanağı sizin sorumluluğunuzdadır.</li>
</ul>

<h2>4. Kişisel verilerin işlenme amaçları</h2>
<ul>
<li>Hesabın oluşturulması, kimlik doğrulama ve yetkilendirme</li>
<li>Öğretmen ve okul yönetimi modüllerinin sunulması (duyuru, nöbet, evrak, kazanım vb.)</li>
<li>Bildirim, e-posta ve mobil push ile bilgilendirme</li>
<li>Güvenlik, dolandırıcılığın önlenmesi, denetim ve yasal yükümlülüklerin yerine getirilmesi</li>
<li>Hizmet kalitesinin ölçülmesi ve geliştirilmesi (anonimleştirilmiş veya toplulaştırılmış verilerle sınırlı olmak üzere)</li>
</ul>

<h2>5. Hukuki sebepler</h2>
<p>Veri işleme faaliyetleri; sözleşmenin kurulması veya ifası, veri sorumlusunun meşru menfaati, açık rızanız veya kanunda öngörülen diğer hukuki sebeplere dayanabilir. Pazarlama iletişimi için ayrıca açık rızanız alınır.</p>

<h2>6. Kişisel verilerin aktarılması</h2>
<p>Hizmetin gerektirdiği ölçüde; barındırma, e-posta gönderimi, kimlik doğrulama (ör. Firebase), analitik veya ödeme altyapısı gibi iş ortaklarına ve kanunen yetkili kamu kurumlarına aktarım yapılabilir. Aktarımda KVKK ve ilgili mevzuata uygunluk sağlanır; yurt dışına aktarım söz konusuysa KVKK&apos;daki şartlar aranır.</p>

<h2>7. Saklama süreleri</h2>
<p>Kişisel veriler, işleme amacının gerektirdiği süre boyunca ve yasal zamanaşımı / saklama yükümlülükleri çerçevesinde saklanır. Hesabınızın kapatılması halinde, politikamızda ve teknik altyapıda tanımlandığı şekilde silme veya anonimleştirme uygulanır. Denetim ve güvenlik logları makul sürelerle sınırlı tutulur.</p>

<h2>8. İlgili kişinin hakları (KVKK md. 11)</h2>
<p>KVKK&apos;nın 11. maddesi kapsamında; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içi/yurt dışı aktarılan üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, otomatik işleme sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.</p>
<p>Haklarınızı kullanmak için Platform içindeki hesap ve gizlilik ayarlarını kullanabilir veya veri sorumlusuna başvuruda bulunabilirsiniz.</p>

<h2>9. Veri güvenliği</h2>
<p>Teknik ve idari tedbirlerle verilerinizin gizliliği, bütünlüğü ve erişilebilirliği korunur; şifreli iletim, erişim kontrolleri ve güncel güvenlik uygulamaları kullanılır.</p>

<h2>10. Politikadaki değişiklikler</h2>
<p>Bu metin güncellendiğinde yayın tarihi sayfa üzerinde güncellenir. Önemli değişikliklerde uygun kanallarla bilgilendirme yapılabilir.</p>
`.trim(),
  },
  terms: {
    title: 'Kullanım Şartları',
    meta_description:
      'Uzaedu Öğretmen hizmetinin kullanımına ilişkin kurallar, hesap yükümlülükleri ve sorumluluklar.',
    body_html: `
<h2>1. Taraflar ve kabul</h2>
<p>Bu Kullanım Şartları (&quot;Şartlar&quot;), Uzaedu Öğretmen web yönetim arayüzü ve bağlı mobil uygulama dahil Platform hizmetlerinin kullanımına ilişkindir. Hesap oluşturarak veya hizmeti kullanarak Şartları okuduğunuzu ve bağlı olduğunuzu kabul edersiniz.</p>

<h2>2. Hizmetin tanımı</h2>
<p>Platform; öğretmen ve okul yöneticilerine yönelik duyuru, nöbet, evrak, içerik ve iletişim araçları sunar. Özellikler modül ve lisanslara göre değişebilir. Hizmet &quot;olduğu gibi&quot; sunulur; kesintisiz veya hatasız çalışma garanti edilmez.</p>

<h2>3. Hesap ve güvenlik</h2>
<ul>
<li>Kayıt bilgilerinin doğru ve güncel olması kullanıcı sorumluluğundadır.</li>
<li>Şifre ve cihaz güvenliği sizin sorumluluğunuzdadır; hesabınız üzerinden yapılan işlemler size atfedilir.</li>
<li>Yetkisiz erişim şüphesinde derhal şifrenizi değiştirmeniz ve bildirmeniz gerekir.</li>
</ul>

<h2>4. Kabul edilebilir kullanım</h2>
<ul>
<li>Platformu yasalara, genel ahlaka ve bu Şartlara aykırı amaçlarla kullanamazsınız.</li>
<li>Başkalarının haklarını ihlal eden, yanıltıcı, zararlı veya müstehcen içerik yükleyemez veya paylaşamazsınız.</li>
<li>Otomatik tarama, kötüye kullanım veya sistemi aşırı yükleyecek şekilde erişim yasaktır.</li>
</ul>

<h2>5. İçerik ve üçüncü kişiler</h2>
<p>Platforma eklediğiniz içeriklerin hukuka uygunluğundan ve gerekli izinlerin alınmasından siz sorumlusunuz. Öğrenci ve veli verileri gibi özel nitelikli veya hassas veriler için ilgili mevzuata uygunluğu sağlamanız esastır.</p>

<h2>6. Fikri mülkiyet</h2>
<p>Platform yazılımı, tasarımı ve markasına ilişkin haklar saklıdır. İzinsiz kopyalama, tersine mühendislik veya ticari kullanım yasaktır.</p>

<h2>7. Ücretlendirme</h2>
<p>Ücretli modül veya abonelikler söz konusuysa fiyatlandırma ve ödeme koşulları ayrıca bildirilir. Ücretsiz kullanımda dahi Şartlar geçerlidir.</p>

<h2>8. Hizmetin değiştirilmesi ve fesih</h2>
<p>Platform özellikleri güncellenebilir veya kaldırılabilir. Şartlara aykırı kullanımda hesabınız askıya alınabilir veya sonlandırılabilir. Hesap kapatma seçenekleri Platform üzerinden veya destek kanalıyla sunulur.</p>

<h2>9. Sorumluluğun sınırı</h2>
<p>Platform, dolaylı veya dolaysız zararlardan, veri kaybından veya üçüncü taraf hizmetlerinden kaynaklanan zararlardan, yasal çerçevede izin verilen azami ölçüde sorumlu tutulamaz.</p>

<h2>10. Uygulanacak hukuk ve uyuşmazlık</h2>
<p>Uyuşmazlıklarda Türkiye Cumhuriyeti kanunları uygulanır; yetkili mahkeme ve icra daireleri Türkiye&apos;deki yasal düzenlemelere tabidir.</p>

<h2>11. İletişim</h2>
<p>Şartlarla ilgili sorularınız için Platformda belirtilen iletişim kanallarını kullanınız.</p>
`.trim(),
  },
  cookies: {
    title: 'Çerez Politikası',
    meta_description:
      'Uzaedu Öğretmen platformunda kullanılan çerez ve benzeri teknolojiler, amaçları ve tercihlerinizi nasıl yönetebileceğiniz.',
    body_html: `
<h2>1. Çerez ve benzeri teknolojiler</h2>
<p>Çerezler, ziyaret ettiğiniz site tarafından tarayıcınıza veya cihazınıza kaydedilen küçük metin dosyalarıdır. Benzer şekilde yerel depolama ve piksel gibi teknolojiler de tercih ve güvenlik için kullanılabilir.</p>

<h2>2. Hangi amaçlarla kullanıyoruz?</h2>
<ul>
<li><strong>Zorunlu:</strong> Oturumun sürdürülmesi, güvenlik ve kimlik doğrulama (ör. giriş sonrası oturum çerezi).</li>
<li><strong>Tercih / işlevsel:</strong> Dil, tema veya çerez tercihinizin hatırlanması.</li>
<li><strong>Ölçüm ve iyileştirme:</strong> Açık rızanız varsa anonim veya toplulaştırılmış kullanım istatistikleri (ör. ziyaret sayıları).</li>
<li><strong>Pazarlama:</strong> Açık rızanız ve ayarlarınız dahilinde hedefli içerik veya yeniden pazarlama çerezleri.</li>
</ul>

<h2>3. Birinci ve üçüncü taraf çerezler</h2>
<p>Bazı çerezler doğrudan Platforma aittir; kimlik doğrulama veya analitik için Google, Firebase veya benzeri hizmet sağlayıcıların çerezleri de devreye girebilir. Bu sağlayıcıların gizlilik politikalarını incelemeniz önerilir.</p>

<h2>4. Saklama süresi</h2>
<p>Çerezler, amaçlarına göre oturum süresiyle sınırlı veya belirli bir tarihe kadar saklanabilir. Tarayıcı ayarlarınızdan veya Platformdaki çerez tercih ekranından rızanızı geri çekebilirsiniz.</p>

<h2>5. Tercihlerinizi yönetme</h2>
<p>Tarayıcı ayarlarından çerezleri silebilir, engelleyebilir veya site bazında yönetebilirsiniz. Zorunlu çerezleri kapatmanızın oturum açma veya güvenlik işlevlerini etkileyebileceğini unutmayın. Platformda &quot;Çerez tercihleri&quot; veya benzeri bağlantı üzerinden rıza ayarlarınızı güncelleyebilirsiniz.</p>

<h2>6. Bu politika ile alttaki bildirim</h2>
<p>Tam metin bu sayfada yer alır. Ekranın altında gösterilen kısa çerez bildirimi, tercihlerinizi yönetmeniz için özet niteliğindedir; ayrıntılar için bu Çerez Politikası ve <strong>Gizlilik</strong> metnimize başvurunuz.</p>

<h2>7. Güncellemeler</h2>
<p>Politika değiştiğinde sayfadaki güncelleme tarihi yenilenir; önemli değişikliklerde ek bilgilendirme yapılabilir.</p>

<h2>8. İletişim</h2>
<p>Çerezlere ilişkin talepleriniz için Platform iletişim kanallarını kullanabilirsiniz.</p>
`.trim(),
  },
} as const;
