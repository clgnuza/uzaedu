-- BİLSEM Coğrafya BYF-1 — yillik_plan_icerik (2025-2026), curriculum_model = bilsem
-- UTF-8: cd backend && node tools/run-sql-utf8.cjs migrations/seed-yillik-plan-bilsem-cografya-byf-2025-2026.sql

DELETE FROM yillik_plan_icerik
WHERE subject_code = 'bilsem_cografya'
  AND academic_year = '2025-2026'
  AND curriculum_model = 'bilsem'
  AND ana_grup = 'GENEL_YETENEK'
  AND alt_grup = 'BYF-1';

INSERT INTO yillik_plan_icerik (
  id,
  subject_code,
  subject_label,
  grade,
  ana_grup,
  alt_grup,
  section,
  academic_year,
  week_order,
  unite,
  konu,
  kazanimlar,
  ders_saati,
  belirli_gun_haftalar,
  surec_bilesenleri,
  olcme_degerlendirme,
  sosyal_duygusal,
  degerler,
  okuryazarlik_becerileri,
  zenginlestirme,
  okul_temelli_planlama,
  sort_order,
  curriculum_model,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'bilsem_cografya',
  'Coğrafya',
  NULL,
  'GENEL_YETENEK',
  'BYF-1',
  NULL,
  '2025-2026',
  x.wo,
  LEFT(NULLIF(TRIM(x.u), ''), 256),
  LEFT(NULLIF(TRIM(x.k), ''), 512),
  x.kaz::text,
  COALESCE(x.ds, 2),
  LEFT(NULLIF(TRIM(x.bel), ''), 256),
  x.sur::text,
  'Kontrol listesi, ürün değerlendirmesi',
  NULLIF(TRIM(x.sd), '')::text,
  NULLIF(TRIM(x.deg), '')::text,
  NULLIF(TRIM(x.okr), '')::text,
  NULL,
  NULL,
  x.wo,
  'bilsem',
  NOW(),
  NOW()
FROM (
VALUES
  (1, $z00u$COĞRAFYANIN DOĞASI$z00u$, $z00k$Coğrafi Bilgilere Ulaşma Yolları; Niçin Coğrafya Öğrenmeliyiz?$z00k$, $z00kaz$COĞ.BYF.1.1. Coğrafi bilgiye ulaşmak için coğrafi sorular sorabilme.
COĞ.BYF.1.2. Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin bireysel ve toplumsal faydalarını çözümleyebilme.$z00kaz$, $z00s$a) Merak ettiği coğrafi olay, olgu ve mekânlara ait coğrafi bilgiyi tanımlar.
b) Merak ettiği coğrafi olay, olgu ve mekânlara ait coğrafi bilgiyi toplamak için sorular sorar.

a) Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin faydalarını belirler.
b) Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin bireysel ve toplumsal faydaları arasındaki ilişkileri belirler.$z00s$, $z00b$$z00b$, $z00sd$Benlik Becerileri
1. Öz farkındalık becerisi
2. Öz düzenleme becerisi
3. Öz yansıtma becerisi

Sosyal Yaşam Becerileri
1. İletişim becerisi
2. İş birliği becerisi
3. Sosyal farkındalık becerisi

Ortak/Birleşik Beceriler
1. Uyum becerisi
2. Esneklik becerisi
3. Sorumlu karar verme becerisi$z00sd$, $z00d$BİLSEM Coğrafya Dersi Çerçeve Öğretim Programı'nda Türkiye Yüzyılı Maarif Modeli kapsamındaki çatı değerlere ve kişisel hayat açısından önemli görülen değerlere yer verilmiştir. Çatı değerler diğer bütün değerler ile yoğun kesişim noktaları olan saygı, sorumluluk ve adalet değerleridir. Kişisel hayat açısından önemli olan değerler ise tasarruf, sabır, mahremiyet, mütevazılık, sağlıklı yaşam, çalışkanlık, sevgi, dostluk, özgürlük, dürüstlük, vatanseverlik, yardımseverlik, aile bütünlüğü, temizlik, duyarlılık, estetik ve merhamettir. Erdem-Değer-Eylem Modeli'nde yer alan değerlere içerik ile uyumlu olacak şekilde öğrenme öğretme süreçlerinde yer verilmiştir.$z00d$, $z00o$1. Bilgi okuryazarlığı becerisi
2. Dijital okuryazarlık becerisi
3. Görsel okuryazarlık becerisi
4. Kültür okuryazarlığı becerisi
5. Sanat okuryazarlığı becerisi
6. Veri okuryazarlığı becerisi
7. Vatandaşlık okuryazarlığı becerisi
8. Sürdürülebilirlik okuryazarlığı becerisi
9. Finansal okuryazarlık becerisi
10. Sistem okuryazarlığı
11. Çevre ve iklim okuryazarlığı
12. Sağlık okuryazarlığı$z00o$, 2),
  (2, $z01u$COĞRAFYA İLE MATEMATİĞİN BULUŞMASI$z01u$, $z01k$Dünyanın Şekli; Dünyanın Hareketleri$z01k$, $z01kaz$COĞ.BYF.2.1. Dünya'nın şekli ve hareketlerine ilişkin bilgileri çözümleyebilme.$z01kaz$, $z01s$a) Dünya'nın günlük ve yıllık hareketinin sonuçlarını belirler.
b) Dünya'nın günlük ve yıllık hareketinin sonuçları ile bunların dünya yaşamındaki ilişkileri belirler.$z01s$, $z01b$$z01b$, $z01sd$$z01sd$, $z01d$$z01d$, $z01o$$z01o$, 2),
  (3, $z02u$$z02u$, $z02k$Dünyanın Şekli; Dünyanın Hareketleri$z02k$, $z02kaz$COĞ.BYF.2.2. Dünya'nın şekli ve hareketlerinin etkilerine yönelik çıkarım yapabilme.$z02kaz$, $z02s$a) Dünya'nın şekli ve hareketlerinin etkilerine yönelik varsayımda bulunur.
b) Dünya'nın şekli ile günlük ve yıllık hareketlerinin kapsamındaki örüntüleri listeler.
c) Dünya'nın şekli ve hareketlerinden yola çıkarak günlük ve yıllık hareketi karşılaştırır.
ç) Dünya'nın şekli ve hareketlerinin etkilerine yönelik önerme sunar.
d) Dünya'nın şekli ve hareketlerinin etkilerini değerlendirir.$z02s$, $z02b$$z02b$, $z02sd$$z02sd$, $z02d$$z02d$, $z02o$$z02o$, 2),
  (4, $z03u$MEKANSAL BİLGİ TEKNOLOJİLERİ$z03u$, $z03k$Coğrafi Bilgi Toplamada CBS'nin Kullanılması$z03k$, $z03kaz$COĞ.BYF.3.1. CBS kullanarak coğrafi bilgi toplayabilme.$z03kaz$, $z03s$a) CBS arayüzünü oluşturan bileşenleri belirler.
b) CBS arayüzünü oluşturan bileşenleri kullanarak coğrafi bilgileri bulur.$z03s$, $z03b$$z03b$, $z03sd$$z03sd$, $z03d$$z03d$, $z03o$$z03o$, 2),
  (5, $z04u$$z04u$, $z04k$CBS Kullanarak Harita Oluşturma$z04k$, $z04kaz$COĞ.BYF.3.2. CBS kullanarak harita oluşturabilme.$z04kaz$, $z04s$a) CBS'de oluşturacağı haritanın amacını belirler.
b) CBS'de harita oluşturmak için gerekli olan yöntem, araç gereci seçer ve kullanır.
c) CBS'de oluşturacağı haritaya ekleyeceği verileri toplar.
ç) CBS'de oluşturacağı haritaya uygun harita türü, ölçek, coğrafi koordinat sistemi ve projeksiyon türünden kullanacaklarını belirler.
d) CBS'de oluşturacağı haritaya verileri işler ve haritanın bileşenlerini oluşturur.
e) CBS'de oluşturduğu haritayı amacına uygun biçimde kullanır.
f) CBS'de oluşturduğu haritayı ihtiyaç duyduğunda tekrar kullanır.$z04s$, $z04b$$z04b$, $z04sd$$z04sd$, $z04d$$z04d$, $z04o$$z04o$, 2),
  (6, $z05u$DOĞAL SİSTEMLER VE SÜREÇLER: KLİMATOLOJİ$z05u$, $z05k$Hava durumu; İklim; Küresel iklim değişikliği$z05k$, $z05kaz$COĞ.BYF.4.1. Hava durumu ve iklim kavramlarını karşılaştırabilme.
COĞ.BYF.4.2. İklim sistemlerini ve iklim bileşenlerini düzenleyebilme.$z05kaz$, $z05s$a) Hava durumu ve iklim kavramlarına ilişkin özellikleri belirler.
b) Hava durumu ve iklim kavramlarının benzerliklerini listeler.
c) Hava durumu ve iklim kavramları arasındaki farklılıkları listeler.

a) İklim sistemlerinin ve bileşenlerini sınıflandırır.
b) İklim sistemlerinin ve bileşenlerini görselleştirir.
c) İklim sistemlerinin ve bileşenlerini birleştirir.
ç) Elde ettiği bilgilerin coğrafi sorgulama açısından yeterliliğini değerlendirir.$z05s$, $z05b$$z05b$, $z05sd$$z05sd$, $z05d$$z05d$, $z05o$$z05o$, 2),
  (7, $z06u$$z06u$, $z06k$Hava durumu; İklim; Küresel iklim değişikliği$z06k$, $z06kaz$COĞ.BYF.4.3. İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliği neden ve sonuçlarıyla çözümleyebilme.$z06kaz$, $z06s$a) İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliğe neden olan unsurları belirler.
b) İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliğe neden olan unsurlar arasındaki ilişkileri belirler.$z06s$, $z06b$$z06b$, $z06sd$$z06sd$, $z06d$$z06d$, $z06o$$z06o$, 2),
  (8, $z07u$DOĞAL SİSTEMLER VE SÜREÇLER: JEOMORFOLOJİ$z07u$, $z07k$Kayaçlar; Levha Tektoniği$z07k$, $z07kaz$COĞ.BYF.5.1. Kayaçların genel özelliklerini ve türlerini gözleme dayalı tahmin edebilme.$z07kaz$, $z07s$a) Kayaçların genel özelliklerini ve türlerini önceki deneyimi ile ilişkilendirir.
b) Kayaçların genel özellikleri ve türleri ile ilgili çıkarımda bulunur.
c) Kayaçların genel özellikleri ve türlerine ilişkin yargıda bulunur.$z07s$, $z07b$Cumhuriyet Bayramı$z07b$, $z07sd$$z07sd$, $z07d$$z07d$, $z07o$$z07o$, 2),
  (9, $z08u$$z08u$, $z08k$Levha tektoniği ve yeryüzü şekilleri$z08k$, $z08kaz$COĞ.BYF.5.2. Yerkürenin tektonik yapısını çözümleyebilme.$z08kaz$, $z08s$a) Levha tektoniğine neden olan süreçleri belirler.
b) Yeryüzü şekilleri ile levha tektoniği arasındaki ilişkiyi belirler.$z08s$, $z08b$1. dönem ara tatili: 10–14 Kasım$z08b$, $z08sd$$z08sd$, $z08d$$z08d$, $z08o$$z08o$, 2),
  (10, $z09u$DOĞAL SİSTEMLER VE SÜREÇLER: BİYOCOĞRAFYA$z09u$, $z09k$Canlı Türlerinin Çeşitliliği$z09k$, $z09kaz$COĞ.BYF.6.1. Yakın çevresindeki gözlem ve saha çalışmasında biyoçeşitlilik üzerine uygulama yapabilme.$z09kaz$, $z09s$a) Gözlem ve çalışma sahasında çalışma planına ve iş akışına uyar.
b) Gözlem ve çalışma sahasında bitki ve hayvan türlerini ayırt eder.
c) Gözlem ve çalışma sahasında uygun veri araçları ile bilgi toplar.
ç) Gözlem ve çalışma sahasında harita kullanır.
d) Gözlem ve çalışma sahasında çevreye duyarlı olur.$z09s$, $z09b$$z09b$, $z09sd$Benlik Becerileri
1. Öz farkındalık becerisi
2. Öz düzenleme becerisi
3. Öz yansıtma becerisi

Sosyal Yaşam Becerileri
1. İletişim becerisi
2. İş birliği becerisi
3. Sosyal farkındalık becerisi

Ortak/Birleşik Beceriler
1. Uyum becerisi
2. Esneklik becerisi
3. Sorumlu karar verme becerisi$z09sd$, $z09d$BİLSEM Coğrafya Dersi Çerçeve Öğretim Programında, Türkiye Yüzyılı Maarif Modeli kapsamındaki çatı değerlere ve kişisel hayat açısından önemli görülen değerlere yer verilmiştir. Çatı değerler diğer bütün değerler ile yoğun kesişim noktaları olan saygı, sorumluluk ve adalet değerleridir. Kişisel hayat açısından önemli olan değerler ise tasarruf, sabır, mahremiyet, mütevazılık, sağlıklı yaşam, çalışkanlık, sevgi, dostluk, özgürlük, dürüstlük, vatanseverlik, yardımseverlik, aile bütünlüğü, temizlik, duyarlılık, estetik ve merhamettir. Erdem Değer Eylem Modeli'nde yer alan değerlere içerik ile uyumlu olacak şekilde öğrenme öğretme süreçlerinde yer verilmiştir.$z09d$, $z09o$1. Bilgi okuryazarlığı becerisi
2. Dijital okuryazarlık becerisi
3. Görsel okuryazarlık becerisi
4. Kültür okuryazarlığı becerisi
5. Sanat okuryazarlığı becerisi
6. Veri okuryazarlığı becerisi
7. Vatandaşlık okuryazarlığı becerisi
8. Sürdürülebilirlik okuryazarlığı becerisi
9. Finansal okuryazarlık becerisi
10. Sistem okuryazarlığı
11. Çevre ve iklim okuryazarlığı
12. Sağlık okuryazarlığı$z09o$, 2),
  (11, $z10u$$z10u$, $z10k$Canlı Türlerinin Çeşitliliği$z10k$, $z10kaz$COĞ.BYF.6.2. Yakın çevresindeki gözlem ve saha çalışmasında biyoçeşitlilik üzerine elde edilen bilgileri düzenleyebilme.$z10kaz$, $z10s$a) Gözlem ve çalışma sahasından elde ettiği verileri sınıflandırır.
b) Gözlem ve çalışma sahasından elde ettiği verileri görselleştirir.
c) Gözlem ve çalışma sahasından elde ettiği bilgileri birleştirir.$z10s$, $z10b$$z10b$, $z10sd$$z10sd$, $z10d$$z10d$, $z10o$$z10o$, 2),
  (12, $z11u$BEŞERİ SİSTEMLER VE SÜREÇLER$z11u$, $z11k$Nüfus ve Nüfus Özellikleri; Göç ve Göçün Mekânsal Etkileri$z11k$, $z11kaz$COĞ.BYF.7.1. Nüfusun değişim ve sürekliliğini neden ve sonuçlarıyla yorumlayabilme.$z11kaz$, $z11s$a) Nüfusun değişim ve sürekliliğine neden olan unsurları inceler.
b) Nüfusun değişim ve sürekliliğinin etkilediği unsurları inceler.
c) Nüfusun değişim ve sürekliliğinin etkilerinin niteliğini sorgular.
ç) Nüfusun değişim ve sürekliliğinin nedenlerini ve sonuçlarını bağlamından kopmadan yeniden ifade eder.$z11s$, $z11b$$z11b$, $z11sd$$z11sd$, $z11d$$z11d$, $z11o$$z11o$, 2),
  (13, $z12u$$z12u$, $z12k$Nüfus ve Nüfus Özellikleri; Göç ve Göçün Mekânsal Etkileri$z12k$, $z12kaz$COĞ.BYF.7.2. Göçün mekânsal etkileriyle ilgili coğrafi bilgi toplayabilme.$z12kaz$, $z12s$a) Göç ve göçle ilgili bilgi toplayacağı araçları belirler.
b) Belirlediği araçları kullanarak göç ve göçle ilgili bilgi bulur.
c) Göç ve göçle ilgili topladığı bilgileri doğrular.
ç) Göç ve göçle ilgili ulaştığı bilgileri kaydeder.$z12s$, $z12b$$z12b$, $z12sd$$z12sd$, $z12d$$z12d$, $z12o$$z12o$, 2),
  (14, $z13u$EKONOMİK FAALİYETLER VE ETKİLERİ$z13u$, $z13k$Dünyadaki Ulaşım Sistemlerinin Gelişim Süreci; Dünyadaki Turizm Faaliyetleri; Küresel Ticaret$z13k$, $z13kaz$COĞ.BYF.8.1. Dünyadaki ulaşım sistemlerinin gelişimine neden olan süreçleri yorumlayabilme.
COĞ.BYF.8.2. Küresel ticaret ile ilgili tablo, grafik, şekil ve diyagramları okuma ve yorumlayabilme.
COĞ.BYF.8.3. Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramları okuma ve yorumlayabilme.$z13kaz$, $z13s$a) Dünyadaki ulaşım sistemlerinin gelişimine neden olan unsurları inceler.
b) Dünyadaki ulaşım sistemlerindeki gelişimin etkilediği unsurları inceler.
c) Dünyadaki ulaşım sistemlerinin gelişim sürecinin etkilerinin niteliğini sorgular.
ç) Dünyadaki ulaşım sistemlerinin gelişim sürecinin nedenlerini ve sonuçlarını bağlamından kopmadan yeniden ifade eder.

a) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagram temsillerini bileşenleri ile tanır ve anlamlandırır.
b) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramları çözümler.
c) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramdan sonuç çıkarır.
ç) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramdan elde ettiği sonuçları karşılaştırır.

a) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagram temsillerini bileşenleri ile tanır ve anlamlandırır.
b) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramları çözümler.
c) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramdan sonuç çıkarır.
ç) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramdan elde ettiği sonuçları karşılaştırır.$z13s$, $z13b$$z13b$, $z13sd$$z13sd$, $z13d$$z13d$, $z13o$$z13o$, 2),
  (15, $z14u$SÜRDÜRÜLEBİLİR ORTAM$z14u$, $z14k$Gezegen Sınırı ve Bu Sınırın Zorlanması Sonucu Oluşan Çevre Sorunları; Doğal Kaynakların Sürdürülebilir Kullanımı$z14k$, $z14kaz$COĞ.BYF.9.1. Gezegen sınırı ve bu sınırın zorlanması sonucu oluşan çevre sorunlarını sorgulayabilme.$z14kaz$, $z14s$a) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında sorular sorar.
b) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında bilgi toplar.
c) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkiler hakkındaki bilgileri düzenler.
ç) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında düzenlediği bilgileri çözümler.
d) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında çözümlediği coğrafi sonuçlara ulaşır ve paylaşır.$z14s$, $z14b$$z14b$, $z14sd$$z14sd$, $z14d$$z14d$, $z14o$$z14o$, 2),
  (16, $z15u$$z15u$, $z15k$Sürdürülebilir ve sürdürülebilir olmayan sistemler; doğal kaynaklar$z15k$, $z15kaz$COĞ.BYF.9.2. Doğal kaynaklar içinde sürdürülebilir ve sürdürülebilir olmayan sistemleri karşılaştırabilme.$z15kaz$, $z15s$a) Sürdürülebilir ve sürdürülebilir olmayan sistemleri karşılaştırır.
b) Belirlenen özelliklere ilişkin benzerlikleri listeler.
c) Belirlenen özelliklere ilişkin farklılıkları listeler.$z15s$, $z15b$$z15b$, $z15sd$$z15sd$, $z15d$$z15d$, $z15o$$z15o$, 2),
  (17, $z16u$AFETLER VE AFET YÖNETİMİ$z16u$, $z16k$Afetler; Afet Bilinci ve Afet Riski Azaltma$z16k$, $z16kaz$COĞ.BYF.10.1. Afetler ile ilgili temel kavramlar arasındaki karşılıklı ilişkileri sorgulayabilme ve araştırabilme.$z16kaz$, $z16s$a) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili soru sorar.
b) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili bilgi toplar.
c) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile topladığı bilgileri düzenler.
ç) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili düzenlediği bilgileri çözümler.
d) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili çözümlediği bilgileri paylaşır.$z16s$, $z16b$$z16b$, $z16sd$$z16sd$, $z16d$$z16d$, $z16o$$z16o$, 2),
  (18, $z17u$$z17u$, $z17k$Afetler; önleme ve müdahale mekanizmaları$z17k$, $z17kaz$COĞ.BYF.10.2. Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkileri, farklılıkları, benzerlikleri ve riskleri değerlendirebilme.$z17kaz$, $z17s$a) Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkilere, farklılıklara, benzerliklere ve risklere ilişkin ölçüt belirler.
b) Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkilere, farklılıklara, benzerliklere ve risklere ilişkin ölçme yapar.
c) Ölçme sonuçlarını belirlediği ölçütlerle karşılaştırır.
ç) Karşılaştırmalarına ilişkin yargıda bulunur.$z17s$, $z17b$Yarıyıl tatili: 19 Ocak – 30 Ocak$z17b$, $z17sd$$z17sd$, $z17d$$z17d$, $z17o$$z17o$, 2),
  (19, $z18u$COĞRAFYANIN DOĞASI$z18u$, $z18k$Coğrafi Bilgilere Ulaşma Yolları; Niçin Coğrafya Öğrenmeliyiz?$z18k$, $z18kaz$COĞ.BYF.1.1. Coğrafi bilgiye ulaşmak için coğrafi sorular sorabilme.
COĞ.BYF.1.2. Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin bireysel ve toplumsal faydalarını çözümleyebilme.$z18kaz$, $z18s$a) Merak ettiği coğrafi olay, olgu ve mekânlara ait coğrafi bilgiyi tanımlar.
b) Merak ettiği coğrafi olay, olgu ve mekânlara ait coğrafi bilgiyi toplamak için sorular sorar.

a) Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin faydalarını belirler.
b) Mekânsal düşünme yaklaşımını kullanarak coğrafya öğrenmenin bireysel ve toplumsal faydaları arasındaki ilişkileri belirler.$z18s$, $z18b$$z18b$, $z18sd$Benlik Becerileri
1. Öz farkındalık becerisi
2. Öz düzenleme becerisi
3. Öz yansıtma becerisi

Sosyal Yaşam Becerileri
1. İletişim becerisi
2. İş birliği becerisi
3. Sosyal farkındalık becerisi

Ortak/Birleşik Beceriler
1. Uyum becerisi
2. Esneklik becerisi
3. Sorumlu karar verme becerisi$z18sd$, $z18d$BİLSEM Coğrafya Dersi Çerçeve Öğretim Programında, Türkiye Yüzyılı Maarif Modeli kapsamındaki çatı değerlere ve kişisel hayat açısından önemli görülen değerlere yer verilmiştir. Çatı değerler diğer bütün değerler ile yoğun kesişim noktaları olan saygı, sorumluluk ve adalet değerleridir. Kişisel hayat açısından önemli olan değerler ise tasarruf, sabır, mahremiyet, mütevazılık, sağlıklı yaşam, çalışkanlık, sevgi, dostluk, özgürlük, dürüstlük, vatanseverlik, yardımseverlik, aile bütünlüğü, temizlik, duyarlılık, estetik ve merhamettir. Erdem Değer Eylem Modeli'nde yer alan değerlere içerik ile uyumlu olacak şekilde öğrenme öğretme süreçlerinde yer verilmiştir.$z18d$, $z18o$1. Bilgi okuryazarlığı becerisi
2. Dijital okuryazarlık becerisi
3. Görsel okuryazarlık becerisi
4. Kültür okuryazarlığı becerisi
5. Sanat okuryazarlığı becerisi
6. Veri okuryazarlığı becerisi
7. Vatandaşlık okuryazarlığı becerisi
8. Sürdürülebilirlik okuryazarlığı becerisi
9. Finansal okuryazarlık becerisi
10. Sistem okuryazarlığı
11. Çevre ve iklim okuryazarlığı
12. Sağlık okuryazarlığı$z18o$, 2),
  (20, $z19u$COĞRAFYA İLE MATEMATİĞİN BULUŞMASI$z19u$, $z19k$Dünyanın Şekli; Dünyanın Hareketleri$z19k$, $z19kaz$COĞ.BYF.2.1. Dünya'nın şekli ve hareketlerine ilişkin bilgileri çözümleyebilme.$z19kaz$, $z19s$a) Dünya'nın günlük ve yıllık hareketinin sonuçlarını belirler.
b) Dünya'nın günlük ve yıllık hareketinin sonuçları ile bunların dünya yaşamındaki ilişkileri belirler.$z19s$, $z19b$$z19b$, $z19sd$$z19sd$, $z19d$$z19d$, $z19o$$z19o$, 2),
  (21, $z20u$$z20u$, $z20k$Dünyanın Şekli; Dünyanın Hareketleri$z20k$, $z20kaz$COĞ.BYF.2.2. Dünya'nın şekli ve hareketlerinin etkilerine yönelik çıkarım yapabilme.$z20kaz$, $z20s$a) Dünya'nın şekli ve hareketlerinin etkilerine yönelik varsayımda bulunur.
b) Dünya'nın şekli ile günlük ve yıllık hareketlerinin kapsamındaki örüntüleri listeler.
c) Dünya'nın şekli ve hareketlerinden yola çıkarak günlük ve yıllık hareketi karşılaştırır.
ç) Dünya'nın şekli ve hareketlerinin etkilerine yönelik önerme sunar.
d) Dünya'nın şekli ve hareketlerinin etkilerini değerlendirir.$z20s$, $z20b$$z20b$, $z20sd$$z20sd$, $z20d$$z20d$, $z20o$$z20o$, 2),
  (22, $z21u$MEKANSAL BİLGİ TEKNOLOJİLERİ$z21u$, $z21k$Coğrafi Bilgi Toplamada CBS'nin Kullanılması$z21k$, $z21kaz$COĞ.BYF.3.1. CBS kullanarak coğrafi bilgi toplayabilme.$z21kaz$, $z21s$a) CBS arayüzünü oluşturan bileşenleri belirler.
b) CBS arayüzünü oluşturan bileşenleri kullanarak coğrafi bilgileri bulur.$z21s$, $z21b$$z21b$, $z21sd$$z21sd$, $z21d$$z21d$, $z21o$$z21o$, 2),
  (23, $z22u$$z22u$, $z22k$CBS Kullanarak Harita Oluşturma$z22k$, $z22kaz$COĞ.BYF.3.2. CBS kullanarak harita oluşturabilme.$z22kaz$, $z22s$b) CBS'de harita oluşturmak için gerekli olan yöntem, araç gereci seçer ve kullanır.
c) CBS'de oluşturacağı haritaya ekleyeceği verileri toplar.
ç) CBS'de oluşturacağı haritaya uygun harita türü, ölçek, coğrafi koordinat sistemi ve projeksiyon türünden kullanacaklarını belirler.
d) CBS'de oluşturacağı haritaya verileri işler ve haritanın bileşenlerini oluşturur.
e) CBS'de oluşturduğu haritayı amacına uygun biçimde kullanır.
f) CBS'de oluşturduğu haritayı ihtiyaç duyduğunda tekrar kullanır.$z22s$, $z22b$$z22b$, $z22sd$$z22sd$, $z22d$$z22d$, $z22o$$z22o$, 2),
  (24, $z23u$DOĞAL SİSTEMLER VE SÜREÇLER: KLİMATOLOJİ$z23u$, $z23k$Hava durumu; İklim; Küresel iklim değişikliği$z23k$, $z23kaz$COĞ.BYF.4.1. Hava durumu ve iklim kavramlarını karşılaştırabilme.
COĞ.BYF.4.2. İklim sistemlerini ve iklim bileşenlerini düzenleyebilme.$z23kaz$, $z23s$a) Hava durumu ve iklim kavramlarına ilişkin özellikleri belirler.
b) Hava durumu ve iklim kavramlarının benzerliklerini listeler.
c) Hava durumu ve iklim kavramları arasındaki farklılıkları listeler.

a) İklim sistemlerinin ve bileşenlerini sınıflandırır.
b) İklim sistemlerinin ve bileşenlerini görselleştirir.
c) İklim sistemlerinin ve bileşenlerini birleştirir.
ç) Elde ettiği bilgilerin coğrafi sorgulama açısından yeterliliğini değerlendirir.$z23s$, $z23b$$z23b$, $z23sd$$z23sd$, $z23d$$z23d$, $z23o$$z23o$, 2),
  (25, $z24u$$z24u$, $z24k$Hava durumu; İklim; Küresel iklim değişikliği$z24k$, $z24kaz$COĞ.BYF.4.3. İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliği neden ve sonuçlarıyla çözümleyebilme.$z24kaz$, $z24s$a) İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliğe neden olan unsurları belirler.
b) İklim sistemleri ve süreçlerinde meydana gelen değişim ve sürekliliğe neden olan unsurlar arasındaki ilişkileri belirler.$z24s$, $z24b$2. dönem ara tatili: 16–20 Mart$z24b$, $z24sd$$z24sd$, $z24d$BİLSEM Coğrafya Dersi Çerçeve Öğretim Programında, Türkiye Yüzyılı Maarif Modeli kapsamındaki çatı değerlere ve kişisel hayat açısından önemli görülen değerlere yer verilmiştir. Çatı değerler diğer bütün değerler ile yoğun kesişim noktaları olan saygı, sorumluluk ve adalet değerleridir. Kişisel hayat açısından önemli olan değerler ise tasarruf, sabır, mahremiyet, mütevazılık, sağlıklı yaşam, çalışkanlık, sevgi, dostluk, özgürlük, dürüstlük, vatanseverlik, yardımseverlik, aile bütünlüğü, temizlik, duyarlılık, estetik ve merhamettir. Erdem Değer Eylem Modeli'nde yer alan değerlere içerik ile uyumlu olacak şekilde öğrenme öğretme süreçlerinde yer verilmiştir.$z24d$, $z24o$$z24o$, 2),
  (26, $z25u$DOĞAL SİSTEMLER VE SÜREÇLER: JEOMORFOLOJİ$z25u$, $z25k$Kayaçlar; Levha Tektoniği$z25k$, $z25kaz$COĞ.BYF.5.1. Kayaçların genel özelliklerini ve türlerini gözleme dayalı tahmin edebilme.$z25kaz$, $z25s$a) Kayaçların genel özelliklerini ve türlerini önceki deneyimi ile ilişkilendirir.
b) Kayaçların genel özellikleri ve türleri ile ilgili çıkarımda bulunur.
c) Kayaçların genel özellikleri ve türlerine ilişkin yargıda bulunur.$z25s$, $z25b$$z25b$, $z25sd$$z25sd$, $z25d$$z25d$, $z25o$$z25o$, 2),
  (27, $z26u$DOĞAL SİSTEMLER VE SÜREÇLER: JEOMORFOLOJİ$z26u$, $z26k$Kayaçlar; Levha Tektoniği$z26k$, $z26kaz$COĞ.BYF.5.2. Yerkürenin tektonik yapısını çözümleyebilme.$z26kaz$, $z26s$a) Levha tektoniğine neden olan süreçleri belirler.
b) Yeryüzü şekilleri ile levha tektoniği arasındaki ilişkiyi belirler.$z26s$, $z26b$$z26b$, $z26sd$Benlik Becerileri
1. Öz farkındalık becerisi
2. Öz düzenleme becerisi
3. Öz yansıtma becerisi

Sosyal Yaşam Becerileri
1. İletişim becerisi
2. İş birliği becerisi
3. Sosyal farkındalık becerisi

Ortak/Birleşik Beceriler
1. Uyum becerisi
2. Esneklik becerisi
3. Sorumlu karar verme becerisi$z26sd$, $z26d$$z26d$, $z26o$1. Bilgi okuryazarlığı becerisi
2. Dijital okuryazarlık becerisi
3. Görsel okuryazarlık becerisi
4. Kültür okuryazarlığı becerisi
5. Sanat okuryazarlığı becerisi
6. Veri okuryazarlığı becerisi
7. Vatandaşlık okuryazarlığı becerisi
8. Sürdürülebilirlik okuryazarlığı becerisi
9. Finansal okuryazarlık becerisi
10. Sistem okuryazarlığı
11. Çevre ve iklim okuryazarlığı
12. Sağlık okuryazarlığı$z26o$, 2),
  (28, $z27u$DOĞAL SİSTEMLER VE SÜREÇLER: BİYOCOĞRAFYA$z27u$, $z27k$Canlı Türlerinin Çeşitliliği$z27k$, $z27kaz$COĞ.BYF.6.1. Yakın çevresindeki gözlem ve saha çalışmasında biyoçeşitlilik üzerine uygulama yapabilme.$z27kaz$, $z27s$a) Gözlem ve çalışma sahasında çalışma planına ve iş akışına uyar.
b) Gözlem ve çalışma sahasında bitki ve hayvan türlerini ayırt eder.
c) Gözlem ve çalışma sahasında uygun veri araçları ile bilgi toplar.
ç) Gözlem ve çalışma sahasında harita kullanır.
d) Gözlem ve çalışma sahasında çevreye duyarlı olur.$z27s$, $z27b$Ulusal Egemenlik ve Çocuk Bayramı$z27b$, $z27sd$$z27sd$, $z27d$$z27d$, $z27o$$z27o$, 2),
  (29, $z28u$$z28u$, $z28k$Canlı Türlerinin Çeşitliliği$z28k$, $z28kaz$COĞ.BYF.6.2. Yakın çevresindeki gözlem ve saha çalışmasında biyoçeşitlilik üzerine elde edilen bilgileri düzenleyebilme.$z28kaz$, $z28s$a) Gözlem ve çalışma sahasından elde ettiği verileri sınıflandırır.
b) Gözlem ve çalışma sahasından elde ettiği verileri görselleştirir.
c) Gözlem ve çalışma sahasından elde ettiği bilgileri birleştirir.$z28s$, $z28b$$z28b$, $z28sd$$z28sd$, $z28d$$z28d$, $z28o$$z28o$, 2),
  (30, $z29u$BEŞERİ SİSTEMLER VE SÜREÇLER$z29u$, $z29k$Nüfus ve Nüfus Özellikleri; Göç ve Göçün Mekânsal Etkileri$z29k$, $z29kaz$COĞ.BYF.7.1. Nüfusun değişim ve sürekliliğini neden ve sonuçlarıyla yorumlayabilme.$z29kaz$, $z29s$a) Nüfusun değişim ve sürekliliğine neden olan unsurları inceler.
b) Nüfusun değişim ve sürekliliğinin etkilediği unsurları inceler.
c) Nüfusun değişim ve sürekliliğinin etkilerinin niteliğini sorgular.
ç) Nüfusun değişim ve sürekliliğinin nedenlerini ve sonuçlarını bağlamından kopmadan yeniden ifade eder.$z29s$, $z29b$Emek ve Dayanışma Günü$z29b$, $z29sd$$z29sd$, $z29d$$z29d$, $z29o$$z29o$, 2),
  (31, $z30u$$z30u$, $z30k$Nüfus ve Nüfus Özellikleri; Göç ve Göçün Mekânsal Etkileri$z30k$, $z30kaz$COĞ.BYF.7.2. Göçün mekânsal etkileriyle ilgili coğrafi bilgi toplayabilme.$z30kaz$, $z30s$a) Göç ve göçle ilgili bilgi toplayacağı araçları belirler.
b) Belirlediği araçları kullanarak göç ve göçle ilgili bilgi bulur.
c) Göç ve göçle ilgili topladığı bilgileri doğrular.
ç) Göç ve göçle ilgili ulaştığı bilgileri kaydeder.$z30s$, $z30b$$z30b$, $z30sd$$z30sd$, $z30d$$z30d$, $z30o$$z30o$, 2),
  (32, $z31u$EKONOMİK FAALİYETLER VE ETKİLERİ$z31u$, $z31k$Dünyadaki Ulaşım Sistemlerinin Gelişim Süreci; Dünyadaki Turizm Faaliyetleri; Küresel Ticaret$z31k$, $z31kaz$COĞ.BYF.8.1. Dünyadaki ulaşım sistemlerinin gelişimine neden olan süreçleri yorumlayabilme.
COĞ.BYF.8.2. Küresel ticaret ile ilgili tablo, grafik, şekil ve diyagramları okuma ve yorumlayabilme.
COĞ.BYF.8.3. Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramları okuma ve yorumlayabilme.$z31kaz$, $z31s$a) Dünyadaki ulaşım sistemlerinin gelişimine neden olan unsurları inceler.
b) Dünyadaki ulaşım sistemlerindeki gelişimin etkilediği unsurları inceler.
c) Dünyadaki ulaşım sistemlerinin gelişim sürecinin etkilerinin niteliğini sorgular.
ç) Dünyadaki ulaşım sistemlerinin gelişim sürecinin nedenlerini ve sonuçlarını bağlamından kopmadan yeniden ifade eder.

a) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagram temsillerini bileşenleri ile tanır ve anlamlandırır.
b) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramları çözümler.
c) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramdan sonuç çıkarır.
ç) Küresel ticaretle ilgili tablo, grafik, şekil ve diyagramdan elde ettiği sonuçları karşılaştırır.

a) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagram temsillerini bileşenleri ile tanır ve anlamlandırır.
b) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramları çözümler.
c) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramdan sonuç çıkarır.
ç) Dünyadaki turizm faaliyetleriyle ilgili tablo, grafik, şekil ve diyagramdan elde ettiği sonuçları karşılaştırır.$z31s$, $z31b$$z31b$, $z31sd$$z31sd$, $z31d$$z31d$, $z31o$$z31o$, 2),
  (33, $z32u$SÜRDÜRÜLEBİLİR ORTAM$z32u$, $z32k$Gezegen Sınırı ve Bu Sınırın Zorlanması Sonucu Oluşan Çevre Sorunları; Doğal Kaynakların Sürdürülebilir Kullanımı$z32k$, $z32kaz$COĞ.BYF.9.1. Gezegen sınırı ve bu sınırın zorlanması sonucu oluşan çevre sorunlarını sorgulayabilme.$z32kaz$, $z32s$a) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında sorular sorar.
b) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında bilgi toplar.
c) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkiler hakkındaki bilgileri düzenler.
ç) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında düzenlediği bilgileri çözümler.
d) Yaşadığı gezegenin sınırını oluşturan bileşenleri ve bu bileşenler üzerindeki beşerî etkileri hakkında çözümlediği coğrafi sonuçlara ulaşır ve paylaşır.$z32s$, $z32b$Atatürk'ü Anma, Gençlik ve Spor Bayramı$z32b$, $z32sd$$z32sd$, $z32d$$z32d$, $z32o$$z32o$, 2),
  (34, $z33u$$z33u$, $z33k$Sürdürülebilir ve sürdürülebilir olmayan sistemler; doğal kaynaklar$z33k$, $z33kaz$COĞ.BYF.9.2. Doğal kaynaklar içinde sürdürülebilir ve sürdürülebilir olmayan sistemleri karşılaştırabilme.$z33kaz$, $z33s$a) Sürdürülebilir ve sürdürülebilir olmayan sistemleri karşılaştırır.
b) Belirlenen özelliklere ilişkin benzerlikleri listeler.
c) Belirlenen özelliklere ilişkin farklılıkları listeler.$z33s$, $z33b$$z33b$, $z33sd$$z33sd$, $z33d$$z33d$, $z33o$$z33o$, 2),
  (35, $z34u$AFETLER VE AFET YÖNETİMİ$z34u$, $z34k$Afetler; Afet Bilinci ve Afet Riski Azaltma$z34k$, $z34kaz$COĞ.BYF.10.1. Afetler ile ilgili temel kavramlar arasındaki karşılıklı ilişkileri sorgulayabilme ve araştırabilme.$z34kaz$, $z34s$a) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili soru sorar.
b) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili bilgi toplar.$z34s$, $z34b$$z34b$, $z34sd$$z34sd$, $z34d$$z34d$, $z34o$$z34o$, 2),
  (36, $z35u$$z35u$, $z35k$Afetler; risk, tehlike, güvenlik, dayanıklılık, toplumsal kapasite$z35k$, $z35kaz$COĞ.BYF.10.1. Afetler ile ilgili temel kavramlar arasındaki karşılıklı ilişkileri sorgulayabilme ve araştırabilme.$z35kaz$, $z35s$c) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile topladığı bilgileri düzenler.
ç) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili düzenlediği bilgileri çözümler.
d) Yerel ve küresel ölçekte ortaya çıkan afet riski, tehlike, güvenlik açığı, dayanıklılık ve toplumsal kapasite arasındaki karşılıklı ilişkiler ile ilgili çözümlediği bilgileri paylaşır.$z35s$, $z35b$$z35b$, $z35sd$$z35sd$, $z35d$$z35d$, $z35o$$z35o$, 2),
  (37, $z36u$$z36u$, $z36k$Tehlikeler; önleme ve müdahale mekanizmaları$z36k$, $z36kaz$COĞ.BYF.10.2. Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkileri, farklılıkları, benzerlikleri ve riskleri değerlendirebilme.$z36kaz$, $z36s$a) Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkilere, farklılıklara, benzerliklere ve risklere ilişkin ölçüt belirler.
b) Farklı tehlikeler ile önleme ve müdahale mekanizmaları arasındaki ilişkilere, farklılıklara, benzerliklere ve risklere ilişkin ölçme yapar.
c) Ölçme sonuçlarını belirlediği ölçütlerle karşılaştırır.
ç) Karşılaştırmalarına ilişkin yargıda bulunur.$z36s$, $z36b$$z36b$, $z36sd$$z36sd$, $z36d$$z36d$, $z36o$$z36o$, 2),
  (38, $z37u$SOSYAL ETKİNLİK$z37u$, $z37k$Sosyal etkinlik haftası$z37k$, $z37kaz$Eğitim öğretim yılı sonu sosyal etkinlikleri.$z37kaz$, $z37s$Okul/kurum planına göre sosyal etkinliklerin yürütülmesi.$z37s$, $z37b$Eğitim öğretim dönemi sonu$z37b$, $z37sd$$z37sd$, $z37d$$z37d$, $z37o$$z37o$, 0)
) AS x(wo, u, k, kaz, sur, bel, sd, deg, okr, ds);
