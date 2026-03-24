/**
 * Her sınav kategorisi için örnek duyuru şablonları.
 * Formda "Örnek Yükle" ile bu içerik kullanılabilir.
 */

export type ExamDutyFormFields = {
  title: string;
  summary: string;
  body: string;
  source_url: string;
  application_url?: string;
  application_start: string;
  application_end: string;
  application_approval_end: string;
  result_date: string;
  exam_date: string;
  exam_date_end: string;
};

/** Kategori bazlı örnek duyurular (tarih alanları boş) */
export const EXAM_DUTY_SAMPLES: Record<string, ExamDutyFormFields> = {
  meb: {
    title: '2025-2026 Eğitim Öğretim Yılı Okul Sınavlarında Gözetmen ve Salon Başkanı Görevlendirmesi',
    summary: 'Ortaöğretim kurumlarında yapılacak yazılı sınavlarda gözetmen ve salon başkanı başvuruları.',
    body: `Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği kapsamında, 2025-2026 eğitim öğretim yılında ortaöğretim kurumlarında yapılacak yazılı sınavlarda gözetmen ve salon başkanı görevlendirmesi yapılacaktır.

Başvuru koşulları:
• Öğretmen olarak görev yapanlar
• Sınavda sorumlu olduğu ders dışındaki sınavlarda gözetmenlik yapabilecekler

Detaylı bilgi ve başvuru için yukarıdaki kaynak bağlantısını kullanınız.`,
    source_url: 'https://personel.meb.gov.tr',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  },
  osym: {
    title: '2026-YKS Gözetmen ve Salon Başkanı Başvuruları',
    summary: 'Yükseköğretim Kurumları Sınavı (YKS) gözetmen ve salon başkanı görevlendirme başvuruları açıldı.',
    body: `Ölçme, Seçme ve Yerleştirme Merkezi (ÖSYM) Başkanlığı tarafından 2026 yılında yapılacak Yükseköğretim Kurumları Sınavı (YKS) kapsamında gözetmen ve salon başkanı görevlendirmesi yapılacaktır.

Başvuru kriterleri:
• Kamu personeli olarak görev yapan öğretmenler
• Sınav merkezi sınav komisyonu onayı

Temel Alan Yeterlilik Testi (TYT), Alan Yeterlilik Testleri (AYT) ve Yabancı Dil Testi (YDT) oturumları için ayrı görevlendirme yapılacaktır.`,
    source_url: 'https://www.osym.gov.tr',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  },
  aof: {
    title: '2025-2026 Güz Dönemi Açıköğretim Fakültesi Sınav Görevlendirmesi',
    summary: 'Anadolu Üniversitesi Açıköğretim Fakültesi ara sınav ve final sınavları gözetmen başvuruları.',
    body: `Anadolu Üniversitesi Açıköğretim Fakültesi 2025-2026 güz dönemi ara sınav ve dönem sonu sınavlarında gözetmen olarak görev almak isteyen öğretmenlerin başvuruları alınacaktır.

Görev türleri:
• Ara sınav gözetmenliği
• Dönem sonu (final) sınavı gözetmenliği
• Salon başkanlığı

Sınavlar ülke genelinde eş zamanlı yapılmaktadır. Başvuru yapan öğretmenlere e-posta ile bilgilendirme yapılacaktır.`,
    source_url: 'https://www.anadolu.edu.tr/aof',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  },
  ataaof: {
    title: 'ATA-AÖF 2025-2026 Güz Dönemi Sınav Gözetmeni Başvuruları',
    summary: 'Atatürk Üniversitesi Açıköğretim Fakültesi sınav görevlendirmesi başvuruları.',
    body: `Atatürk Üniversitesi Açıköğretim Fakültesi (ATA-AÖF) 2025-2026 eğitim öğretim yılı güz dönemi ara ve dönem sonu sınavlarında gözetmen olarak görev almak isteyen öğretmenlerin başvuruları alınmaktadır.

Sınav merkezleri:
• Erzurum ve diğer illerdeki sınav merkezleri
• Başvuru sırasında tercih edilen merkez dikkate alınacaktır

Başvuru şartları ve takvim detayları için resmi duyuru sayfasını inceleyiniz.`,
    source_url: 'https://ataaof.atauni.edu.tr',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  },
  auzef: {
    title: 'İstanbul Üniversitesi Açık ve Uzaktan Eğitim Fakültesi Sınav Görevlendirmesi',
    summary: 'İÜ AUZEF ara ve final sınavlarında gözetmen başvuruları.',
    body: `İstanbul Üniversitesi Açık ve Uzaktan Eğitim Fakültesi (AUZEF) 2025-2026 güz dönemi sınavlarında gözetmen ve salon başkanı görevlendirmesi yapılacaktır.

Başvuru bilgileri:
• Ara sınav ve final sınavları için ayrı görevlendirme
• İstanbul ve anlaşmalı diğer illerdeki sınav merkezleri
• Öğretmen ve akademik personel başvurabilir

Detaylı duyuru ve başvuru takvimi için resmi web sitesini takip ediniz.`,
    source_url: 'https://auzef.istanbul.edu.tr',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  },
};
