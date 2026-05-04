/**
 * Varsayılan yasal sayfa içerikleri (gövde HTML — sayfadaki H1 başlık alanı ayrı: title).
 * Kamu: GET /content/legal-pages. Superadmin: Web ve mobil ayarlar → Gizlilik / Şartlar / Çerez.
 *
 * Not: Veritabanında `legal_pages_config` doluysa gövde alanları DB’den gelir; `LEGAL_PAGE_DEFAULTS_GENERATION`
 * içinde sürümü artırılan sayfalar ise DB’deki `defaults_generation` eşleşene kadar kod varsayılanına döner.
 */
/** DB’deki `defaults_generation` bu değerle aynı değilse ilgili sayfa `DEFAULT_LEGAL_PAGES` ile sunulur; admin kaydı sürümü günceller. */
export const LEGAL_PAGE_DEFAULTS_GENERATION: Partial<Record<'privacy' | 'terms' | 'cookies', number>> = {
  privacy: 2,
  terms: 2,
  cookies: 2,
};

export const DEFAULT_LEGAL_PAGES = {
  privacy: {
    title: 'Aydınlatma Metni ve Gizlilik Politikası',
    meta_description:
      'Uzaedu Öğretmen: KVKK, Kurul rehberleri ve 2026 uygulamaları; veri kategorileri, amaçlar, aktarım, saklama, haklar, çerezler ve iletişim.',
    body_html: `
<h2>1. Giriş ve kapsam</h2>
<p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) ve Kişisel Verileri Koruma Kurulu (&quot;Kurul&quot;) karar ve rehberleri doğrultusunda; Uzaedu Öğretmen web yönetim arayüzü ve bağlı mobil uygulama dahil (&quot;Platform&quot;) kapsamında kişisel verilerinizin nasıl işlendiğini aydınlatır. Platformu kullanmak veya hesap oluşturmak bu metnin tarafınıza sunulduğu anlamına gelir. <strong>Kullanım Şartları</strong> ile birlikte okunmalıdır. Çerez ve benzeri izleme teknolojileri için <strong>Çerez Politikası</strong> geçerlidir.</p>

<h2>2. Veri sorumlusu, veri işleyen ve iletişim</h2>
<p>Kişisel verileriniz başlıca Platformu işleten <strong>veri sorumlusu</strong> tarafından işlenir. Bulut, ileti, kimlik doğrulama, ödeme veya analitik gibi hizmetlerde sınırlı ölçüde <strong>veri işleyen</strong> sıfatıyla çalışan tedarikçiler yer alabilir; bunlarla sözleşme ve teknik tedbirlerle güvenlik sağlanır. Okul tarafından yürütülen süreçlerde (ör. öğrenci/veli verisi) okul ayrıca veri sorumlusu veya birlikte sorumlu olabilir.</p>
<p>KVKK md. 11 kapsamındaki başvurularınız ve gizlilik sorularınız için: <a href="mailto:uzaeduapp@gmail.com">uzaeduapp@gmail.com</a> — ayrıca Platform içi destek/hesap kanalları ve sözleşme kapsamında bildirilen okul iletişimleri kullanılabilir.</p>

<h2>3. İşlenen kişisel veri kategorileri</h2>
<ul>
<li><strong>Kimlik ve iletişim:</strong> Ad, görünen ad; e-posta; telefon (SMS veya üçüncü taraf ile oturum tercih edildiğinde).</li>
<li><strong>Hesap ve örgüt:</strong> Rol (ör. öğretmen, okul yöneticisi, moderatör), okul bağlantısı, onay ve yetki durumu, modül/lisans bilgisi.</li>
<li><strong>Eğitim ve okul işleri (modüllere göre):</strong> Sınıf/ders/öğrenci listeleri, nöbet ve görev planları, akademik takvim, yıllık plan ve evrak süreçleri, kazanım takibi, sınav ve yerleşim (Kertenkele Sınav), optik formlar, Bilsem takvim ve plan verileri, sorumluluk/beceri sınavı süreçleri, mesaj merkezi kapsamında veli/öğretmen iletişimine konu metinler ve ilgili kişi bilgileri, okul değerlendirme yanıtları, haber ve yayın içerikleri; bu verilerde üçüncü kişilere ait kişisel veriler bulunabilir.</li>
<li><strong>Finans ve bordro (yalnız ilgili modül açıksa):</strong> Ek ders, maaş, KBS ve benzeri akışlarda iletim veya hesaplama için girilen veya yüklenen veriler; hukuki dayanak ve doğruluk ilgili kullanıcı ve okul sorumluluğundadır.</li>
<li><strong>Pazar yeri ve jeton:</strong> Market/reklamla jeton akışlarında işlem, tercih ve ödül gösterimi için gerekli kayıtlar.</li>
<li><strong>Kullanım ve güvenlik:</strong> Oturum ve erişim kayıtları, bildirim tercihleri, destek talepleri, moderasyon ve kötüye kullanım önleme kayıtları.</li>
<li><strong>Cihaz ve teknik:</strong> Mobil push için cihaz tokenı; güvenlik ve hata giderme için sınırlı teknik log (ör. IP, zaman damgası, tarayıcı/uygulama sürümü).</li>
<li><strong>Özel nitelikli kişisel veriler:</strong> Platformun işleyişi için zorunlu olmadıkça işlenmez; okul süreçlerinde işlenmesi halinde ilgili mevzuat ve açık rıza / diğer hukuki şartlar uygulanır.</li>
</ul>

<h2>4. İşlenme amaçları</h2>
<ul>
<li>Hesap oluşturma, kimlik doğrulama, rol tabanlı yetkilendirme</li>
<li>Okul ve öğretmen modüllerinin işletilmesi (duyuru TV, akıllı tahta, ders programı, nöbet, evrak/yıllık plan, ajanda, sınav ve optik, mesaj merkezi, hesaplamalar vb.)</li>
<li>Bildirim, e-posta ve mobil push ile bilgilendirme</li>
<li>Tercihlerin hatırlanması, hizmet güvenliği, dolandırıcılığın önlenmesi, denetim izi</li>
<li>Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurumlara bilgi verilmesi</li>
<li>Hizmet kalitesinin ölçülmesi ve geliştirilmesi (mümkün olduğunca anonimleştirilmiş veya toplulaştırılmış verilerle; aksi halde açık rıza veya meşru menfaat ölçülülük çerçevesinde)</li>
</ul>

<h2>5. Hukuki sebepler</h2>
<p>İşleme; KVKK md. 5 ve 6 kapsamında sözleşmenin kurulması/ifası, hukuki yükümlülük, veri sorumlusunun meşru menfaati (güvenlik, dolandırıcılık önleme, sınırlı ve ölçülü iyileştirme) veya — analitik, pazarlama iletişimi, bazı çerezler veya özel nitelikli veri için — <strong>açık rıza</strong> ile yapılabilir. Rıza gerektiren işlemlerde rızanızı dilediğiniz zaman geri çekebilirsiniz; geri çekme, geri çekmeden önceki işlemin hukuka uygunluğunu etkilemez.</p>

<h2>6. Yurt içi ve yurt dışı aktarım</h2>
<p>Hizmetin gerektirdiği ölçüde; bulut barındırma, e-posta/SMS/WhatsApp veya benzeri ileti kanalları, kimlik doğrulama (ör. Firebase), analitik, ödeme ve reklam altyapısı sağlayıcılarına ve kanunen yetkili kamu kurumlarına aktarım yapılabilir. <strong>Yurt dışına aktarımda</strong> KVKK md. 9 ve Kurul kararları uyarınca yeterlilik kararı, standart sözleşme şartları, bağlayıcı kurumsal kurallar veya yazılı açık rıza gibi şartlardan uygun olanlar aranır; sağlayıcıların güncel gizlilik dokümanlarına yönlendirme yapılabilir.</p>

<h2>7. Saklama süreleri</h2>
<p>Veriler, işleme amacının gerektirdiği süre ile yasal zamanaşımı ve saklama yükümlülükleri kadar tutulur. Hesap kapatma veya silme talebinde, teknik ve hukuki sınırlar çerçevesinde silme, anonimleştirme veya maskeleme uygulanır. Güvenlik ve denetim logları makul ve asgari süreyle sınırlıdır.</p>

<h2>8. İlgili kişinin hakları (KVKK md. 11)</h2>
<p>Verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içi/yurt dışı aktarılanları bilme, eksik veya yanlışsa düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, otomatik sistemler ile işlenmesi sonucu aleyhinize bir sonuca itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.</p>
<p>Bu hakları yukarıdaki e-posta, Platform içi kanallar veya veri sorumlusuna yazılı başvuru ile kullanabilirsiniz. Şikâyetlerinizi Kurul&apos;a iletme hakkınız saklıdır.</p>

<h2>9. Otomatik işlem ve profilleme</h2>
<p>Platform, temel eğitim ve idari işlevler için sizi hukuki sonuçlar doğrultusunda önemli ölçüde etkileyen <strong>otomatik karar veya profilleme</strong> aracı olarak konumlandırılmamıştır. Pazarlama, ölçüm veya yapay zekâ destekli taslaklar yalnızca açık rıza veya ayarlarınız ve hizmetin teknik gereği dahilinde kullanılır.</p>

<h2>10. Veri güvenliği ve ihlal bildirimi</h2>
<p>Şifreli iletim, erişim kontrolleri, ayrıcalık yönetimi ve güncel güvenlik uygulamaları ile verilerin gizliliği, bütünlüğü ve erişilebilirliği korunur. Kişisel veri ihlali halinde KVKK ve ilgili düzenlemeler çerçevesinde Kurul ve etkilenen kişilere bildirim ile gerekli teknik ve idari tedbirler değerlendirilir.</p>

<h2>11. Politikadaki değişiklikler</h2>
<p>Metin güncellendiğinde Platform üzerinde yayımlanır; önemli değişikliklerde ek bilgilendirme yapılabilir.</p>
`.trim(),
  },
  terms: {
    title: 'Kullanım Şartları',
    meta_description:
      'Uzaedu Öğretmen: 2026 itibarıyla hesap, lisans, içerik ve veri sorumluluğu, üçüncü taraf hizmetler, ücret/jeton, fesih ve uyuşmazlık — güncel kullanım şartları.',
    body_html: `
<h2>1. Taraflar ve kabul</h2>
<p>Bu Kullanım Şartları (&quot;Şartlar&quot;), Uzaedu Öğretmen web yönetim arayüzü ve bağlı mobil uygulama dahil (&quot;Platform&quot;) hizmetinin kullanımına ilişkindir. 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun (&quot;6563 sayılı Kanun&quot;), Mesafeli Sözleşmeler Yönetmeliği ve 6102 sayılı Türk Borçlar Kanunu çerçevesinde ön bilgilendirme ve sözleşme unsurları, Platformda sunulan ekranlar ve — varsa — ayrı sözleşmelerle birlikte değerlendirilir. Kişisel veriler için <strong>Aydınlatma Metni / Gizlilik Politikası</strong> ve <strong>Çerez Politikası</strong> geçerlidir. Hesap oluşturarak veya hizmeti kullanarak Şartları okuduğunuzu ve bağlı kaldığınızı kabul edersiniz.</p>

<h2>2. Hizmetin tanımı ve &quot;olduğu gibi&quot; sunum</h2>
<p>Platform; okul ve öğretmenlere yönelik dijital araçlar sunar (ör. bildirimler, sınav görevleri ve hesaplamaları, kazanım takibi, akademik takvim, evrak ve yıllık plan, ajanda, haber/yayın, nöbet ve görevler, ders programı, duyuru TV, akıllı tahta, Bilsem, optik formlar, Kertenkele Sınav, mesaj merkezi entegrasyonları, sınav/planlama modülleri, okul değerlendirme, market/jeton, destek talepleri). Modül ve özellikler <strong>okul lisansı</strong> ve yapılandırmaya göre değişir; tüm özellikler her kullanıcıda açık olmayabilir. Hizmet &quot;olduğu gibi&quot; sunulur; <strong>kesintisiz, hatasız veya belirli bir performansta</strong> çalışacağına dair zımni veya açık garanti verilmez (yasal zorunlu istisnalar saklıdır).</p>

<h2>3. Yaş, yetki ve hesap</h2>
<p>Platform okul süreçlerine yöneliktir. Hesap açma ve kullanım, okul politikaları ve mevzuata uygun şekilde <strong>yetkili kişiler</strong> tarafından yapılmalıdır. Yanlış veya yanıltıcı kayıt bilgisi verilemez. Hesap paylaşımı, başkasının adına yetkisiz işlem veya rol ihlali yasaktır.</p>

<h2>4. Roller ve içerik / veri sorumluluğu</h2>
<p>Okul yöneticileri ve yetkilileri, okul adına işlenen öğrenci, veli ve personel verilerinin <strong>mevzuata ve okul içi politikaya</strong> uygunluğundan; öğretmen ve diğer kullanıcılar ise kendi hesapları ve kendi verdikleri içerik ölçüsünden sorumludur. Öğrenciye ilişkin özel nitelikli veya hassas veriler, veli iletişimi ve mesaj içeriklerinde <strong>6698 sayılı KVKK</strong>, ilgili Kurul kararları ve <strong>Millî Eğitim mevzuatı</strong> ile uyum kullanıcıların yükümlülüğüdür. Platform; güvenlik, hukuka aykırılığın önlenmesi ve hizmet bütünlüğü için sınırlı moderasyon ve teknik tedbirler uygulayabilir; içerik üreticisi olarak okul/kullanıcı sorumluluğu ortadan kalkmaz.</p>

<h2>5. Hesap güvenliği</h2>
<ul>
<li>Kayıt bilgilerinin doğru ve güncel tutulması kullanıcı sorumluluğundadır.</li>
<li>Şifre, çok faktörlü doğrulama ve cihaz güvenliği size aittir; hesabınız üzerinden yapılan işlemler size atfedilir.</li>
<li>Yetkisiz erişim şüphesinde derhal şifre değişikliği ve bildirim yapılması gerekir.</li>
</ul>

<h2>6. Kabul edilebilir kullanım</h2>
<ul>
<li>Platform yalnızca yasalara, genel ahlaka ve Şartlara uygun amaçlarla kullanılabilir.</li>
<li>Başkalarının kişisel verilerini, fikri mülkiyet veya ticari sırlarını ihlal eden; yanıltıcı, zararlı, müstehcen veya taciz içerik yüklenemez veya iletilemez.</li>
<li>Otomatik tarama, kötüye kullanım, güvenlik testi veya sistemi aşırı yükleyecek erişim yasaktır.</li>
<li>Mesaj ve iletişim modülleri izinli alıcılara ve meşru okul iletişimi için kullanılmalıdır; spam, toplu izinsiz ileti veya reklam amaçlı kötüye kullanım yasaktır.</li>
<li>Yapay zekâ veya otomasyonla üretilen taslaklar — varsa — yalnızca yardımcı araçtır; hukuki ve pedagojik doğrulama kullanıcıya aittir.</li>
</ul>

<h2>7. Üçüncü taraf hizmetler</h2>
<p>Kimlik doğrulama, bulut barındırma, analitik, ödeme, reklam, harita veya mesaj (SMS/WhatsApp vb.) sağlayıcıları kendi sözleşme ve gizlilik koşullarına tabidir. Üçüncü tarafın kesintisi, politika değişikliği veya veri işleme biçiminden doğan zararlarda Platform sorumluluğu, <strong>yasal düzenlemenin izin verdiği azami ölçüde</strong> sınırlıdır.</p>

<h2>8. Fikri mülkiyet</h2>
<p>Platform yazılımı, arayüz bileşenleri, marka ve dokümantasyona ilişkin haklar saklıdır. Lisans kapsamı dışında kopyalama, dağıtma, tersine mühendislik veya kaynak koddan yararlanma yasaktır. Kullanıcıların yüklediği içerikte mülkiyet kullanıcıya aittir; Platforma gerekli kullanım için sınırlı lisans verdiğiniz varsayılır (hizmetin işletilmesi için).</p>

<h2>9. Ücretlendirme, jeton ve cayma</h2>
<p>Ücretli modül, abonelik, market veya jeton işlemlerinde fiyat, vergi, ödeme yöntemi, cayma ve iade — 6563 sayılı Kanun ve tüketici mevzuatı çerçevesinde — ilgili ekran, ön bilgi ve varsa mesafeli sözleşmede belirtilir. Kurumsal / okul faturalaması için ayrı düzenlemeler geçerli olabilir. Ücretsiz kullanımda dahi Şartlar yürürlüktedir.</p>

<h2>10. Hizmetin değiştirilmesi, askıya alma ve fesih</h2>
<p>Özellikler güncellenebilir, askıya alınabilir veya kaldırılabilir. Şart ihlali, güvenlik riski veya yasal zorunluluk halinde hesap veya erişim geçici veya kalıcı olarak kısıtlanabilir. Hesap kapatma ve veri talepleri için destek kanalları kullanılabilir.</p>

<h2>11. Mücbir sebep</h2>
<p>Doğal afet, savaş, grev, internet omurga kesintisi, kamu otoritesi kararı veya makul kontrol dışındaki olaylar nedeniyle hizmetin geçici durması halinde, yasal çerçevede sorumluluk sınırlı tutulabilir.</p>

<h2>12. Sorumluluğun sınırı</h2>
<p>Platform; dolaylı zarar, kâr kaybı, veri kaybı, üçüncü taraf hizmetleri veya kullanıcı içeriklerinden doğan uyuşmazlıklarda, yasal düzenlemenin izin verdiği azami ölçüde sorumlu tutulamaz. Okullar ve kullanıcılar, kendi veri işleme ve içerik faaliyetlerinde bağımsız veya birlikte sorumluluk çerçevesinde yükümlü olabilir.</p>

<h2>13. Uygulanacak hukuk ve uyuşmazlık</h2>
<p>Uyuşmazlıklarda Türkiye Cumhuriyeti kanunları uygulanır; yetkili mahkeme ve icra daireleri Türkiye mevzuatına tabidir. Tüketici sıfatıyla işlem yapanlar için kanunda öngörülen zorunlu hükümler saklıdır.</p>

<h2>14. Şartlarda değişiklik</h2>
<p>Şartlar güncellendiğinde Platform üzerinde yayımlanır; önemli değişikliklerde ek bildirim yapılabilir. Değişiklik sonrası kullanım, güncellenmiş Şartların kabulü sayılabilir; mevzuatın gerektirdiği hallerde ayrıca onay alınır.</p>

<h2>15. İletişim</h2>
<p>Şartlarla ilgili sorularınız için: <a href="mailto:uzaeduapp@gmail.com">uzaeduapp@gmail.com</a></p>
`.trim(),
  },
  cookies: {
    title: 'Çerez Politikası',
    meta_description:
      'Uzaedu Öğretmen: çerez ve benzeri teknolojiler, zorunlu/tercih/analitik/pazarlama, rıza ve geri çekme, üçüncü taraflar; KVKK ve Kişisel Verileri Koruma Kurulu rehberleri (2026).',
    body_html: `
<h2>1. Çerez ve benzeri teknolojiler</h2>
<p>Çerezler, ziyaret ettiğiniz site tarafından tarayıcınıza veya cihazınıza kaydedilen küçük metin dosyalarıdır. Platform; yerel depolama (localStorage), oturum depolaması (sessionStorage), benzeri depolama API&apos;leri, piksel, etiket ve SDK tabanlı tanımlayıcılar gibi <strong>çerezle eşdeğer</strong> teknolojiler de kullanabilir. Bu Politika; 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;), Kişisel Verileri Koruma Kurulu (&quot;Kurul&quot;) karar ve rehberleri ile güncel uygulama ve AB düzenlemelerinden (ör. ePrivacy yaklaşımı) esinlenen şeffaflık ilkeleri doğrultusunda hazırlanmıştır. Zorunlu olmayan çerez ve eşdeğer teknolojiler için, Kurul&apos;un açık rıza beklentisi ve KVKK m. 5/2-ç kapsamında <strong>açık rıza</strong> esas alınır; rıza vermeniz veya reddetmeniz, hizmete erişiminizi eşit şartlarda engellemeyecek şekilde tasarlanır (zorunlu kategoriler hariç).</p>

<h2>2. Çerez türleri ve hukuki dayanak</h2>
<ul>
<li><strong>Zorunlu (kesinlikle gerekli):</strong> Oturumun sürdürülmesi, güvenli giriş, kimlik doğrulama, yük dengeleme, CSRF ve kötüye kullanım önleme. Dayanak: KVKK md. 5 ve 6 kapsamında sözleşmenin ifası, hukuki yükümlülük veya — ölçülü biçimde — veri sorumlusunun meşru menfaati; bu teknolojiler olmadan temel işlevler çalışmayabilir.</li>
<li><strong>Tercih / işlevsel:</strong> Dil, tema, çerez tercihi kaydı ve benzeri arayüz ayarları. Mümkün olduğunda rıza veya ayarınıza bağlı; aksi halde meşru menfaat veya sözleşme ifası ile sınırlı kullanım.</li>
<li><strong>Ölçüm, analitik ve performans:</strong> Trafik, hata ve ürün iyileştirme. Kişisel veri içerebilecek ölçümlerde <strong>açık rıza</strong> tercih edilir; anonim veya toplulaştırılmış istatistiklerde teknik zorunluluklar ayrıca değerlendirilir.</li>
<li><strong>Pazarlama, reklam ve hedefleme:</strong> Yeniden pazarlama, ilgi alanına dayalı reklam veya ölçümle bağlantılı reklam sağlayıcı tanımlayıcıları. Yalnızca <strong>açık rızanız</strong> ve ilgili ayarlarınız (ör. web tarafında çerez onayı, mobilde ilgili izin/UMP akışları) varken kullanılır; rıza yoksa bu amaçlı çerez yerleştirilmez veya sınırlı (ör. kişiselleştirilmemiş) mod tercih edilir.</li>
</ul>

<h2>3. Birinci ve üçüncü taraf</h2>
<p>Bazı çerezler Platforma (birinci taraf) aittir. Kimlik doğrulama (ör. Firebase), barındırma, analitik, ödeme, reklam ağları veya içerik dağıtımı için <strong>üçüncü taraf</strong> çerez veya SDK&apos;lar devreye girebilir. Bu sağlayıcılar kendi gizlilik ve çerez politikalarına tabidir; veri işleyen / aracı veya yurt dışı aktarım söz konusuysa <strong>Aydınlatma Metni</strong> ve sözleşmeler kapsamında bilgilendirilirsiniz. Reklam ortakları için, geçerliyse sektör standartları (ör. TCF veya sağlayıcıya özgü onay çözümleri) ile uyumlu yapılandırma hedeflenir.</p>

<h2>4. Saklama süreleri</h2>
<p>Çerezler amaçlarına göre <strong>oturum süresiyle</strong> sınırlı veya <strong>sabit süre</strong> (ör. oturum çerezi, tercih kaydı, analitik penceresi) ile saklanır. Süreler mümkün olduğunca kısa ve amaçla orantılı tutulur. Rızanızı &quot;Çerez tercihleri&quot; veya eşdeğer panelden geri çektiğinizde yeni yerleştirme durdurulur; mevcut kayıtları silmek için tarayıcı veya cihaz ayarlarınızı kullanabilirsiniz.</p>

<h2>5. Tercihlerinizi yönetme ve geri çekme</h2>
<p>Platform üzerindeki çerez bildirimi ve <strong>Çerez tercihleri</strong> bağlantısı ile kategorilere göre onayınızı verebilir veya güncelleyebilirsiniz. Rızanızı vermek kadar <strong>geri çekmenin de en az o kadar kolay</strong> olması hedeflenir. Tarayıcı veya işletim sistemi ayarlarından çerezleri engellemek veya silmek de mümkündür; zorunlu çerezleri kapatmanız oturum veya güvenlik işlevlerini etkileyebilir.</p>

<h2>6. Mobil uygulama</h2>
<p>Mobil uygulamada klasik çerez yerine SDK, reklam tanımlayıcıları ve push bildirim token&apos;ı gibi teknolojiler kullanılabilir. Ayrıntılar <strong>Aydınlatma Metni / Gizlilik Politikası</strong> ve uygulama içi izin ekranlarında yer alır.</p>

<h2>7. İlgili kişi hakları</h2>
<p>Çerez ve izleme yoluyla işlenen kişisel veriler için KVKK m. 11 kapsamındaki haklarınız (bilgi, düzeltme, silme, itiraz vb.) saklıdır; ayrıntılar Gizlilik metninde açıklanmıştır.</p>

<h2>8. Bu politika ile bildirim şeridi</h2>
<p>Ekranda gösterilen kısa çerez bildirimi özet niteliğindedir; bağlayıcı ve güncel açıklama bu sayfadadır. Çelişki halinde bu Politika ve yayınlanan <strong>Gizlilik</strong> metni önceliklidir.</p>

<h2>9. Güncellemeler</h2>
<p>Politika veya uygulama değiştiğinde metin güncellenir; önemli değişikliklerde ek bilgilendirme yapılabilir.</p>

<h2>10. İletişim</h2>
<p>Çerezler, tercih kayıtları ve bu Politika hakkında soru ve talepleriniz için: <a href="mailto:uzaeduapp@gmail.com">uzaeduapp@gmail.com</a></p>
`.trim(),
  },
} as const;
