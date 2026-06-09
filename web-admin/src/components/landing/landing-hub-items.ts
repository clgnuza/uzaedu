import {
  ScanLine,
  Calculator,
  Shield,
  Sparkles,
  Monitor,
  Tv,
  FileText,
  CalendarClock,
  Target,
  Star,
  Bug,
  ClipboardCheck,
  MessageSquare,
  Package,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

export type LandingHubItem = {
  label: string;
  slug: string;
  href: string;
  icon: LucideIcon;
  description: string;
  detail: string;
  tags: [string, string, string];
};

export const LANDING_HUB_ITEMS: LandingHubItem[] = [
  { label: 'Nöbet', slug: 'nobet', href: '/login?redirect=%2Fduty', icon: Shield, description: 'Nöbet planlama, dağıtım, takas ve günlük nöbet akışını tek yerden yönetin.', detail: 'Haftalık planları dengeleyin, görevli listelerini düzenleyin ve okul içi nöbet sürecini daha kontrollü ilerletin.', tags: ['Planlama', 'Takas', 'Günlük akış'] },
  { label: 'Duyuru TV', slug: 'duyuru-tv', href: '/login?redirect=%2Ftv', icon: Tv, description: 'Okul ekranları için duyuru, video, akış ve otomatik bilgi kartlarını hazırlayın.', detail: 'Kampüs ekranlarını modern bir yayın merkezine dönüştürün; haber, afiş, video ve canlı bilgi kartlarını tek panelden yönetin.', tags: ['Canlı yayın', 'Duyuru akışı', 'Okul ekranı'] },
  { label: 'Ek Ders', slug: 'ek-ders', href: '/login?redirect=%2Fhesaplamalar', icon: Calculator, description: 'Ek ders hesaplama, parametre yönetimi ve bordro kontrollerini hızlandırın.', detail: 'Hesaplamaları sadeleştirir, parametreleri merkezi yönetir ve kontrol süreçlerinde zaman kazandırır.', tags: ['Hızlı hesap', 'Parametre', 'Kontrol'] },
  { label: 'Evrak & Plan', slug: 'evrak-plan', href: '/login?redirect=%2Fdocument-templates', icon: FileText, description: 'Hazır şablonlar ile plan, tutanak ve resmi evrak üretimini kolaylaştırın.', detail: 'Şablonları kurumsal düzenle kullanın; yıllık planlardan resmi yazılara kadar düzenli ve hızlı belge üretin.', tags: ['Şablonlar', 'Resmi evrak', 'Planlama'] },
  { label: 'Doğrudan temin', slug: 'dogrudan-temin', href: '/login?redirect=%2Fdogrudan-temin', icon: Package, description: 'Temin dosyaları, teklifler, bütçe blokları ve ödemeleri yasal çerçevede yürütün.', detail: '22/a–22/g süreçleri, belge üretimi ve komisyon adımlarını tek modülde toplar; rapor ve arşivle izlenebilirlik sağlar.', tags: ['Teklif', 'Bütçe', 'Rapor'] },
  { label: 'Kazanım', slug: 'kazanim-takip', href: '/login?redirect=%2Fkazanim-takip', icon: Target, description: 'Kazanım takibi, plan içerikleri ve ders ilerlemesini görünür hale getirin.', detail: 'Ders akışındaki hedefleri görünür kılar; öğretmenlere planlama ve ilerleme takibinde net bir zemin sunar.', tags: ['Hedef takibi', 'Ders akışı', 'İlerleme'] },
  { label: 'Optik Okuma', slug: 'optik-okuma', href: '/login?redirect=%2Foptik-formlar', icon: ScanLine, description: 'Optik form üretin, okutun ve sonuçları hızlıca raporlayın.', detail: 'Form tasarımından sonuç yorumuna kadar ölçme sürecini sadeleştiren hızlı bir optik okuma deneyimi sunar.', tags: ['Form üret', 'Oku', 'Raporla'] },
  { label: 'Akıllı Tahta', slug: 'akilli-tahta', href: '/login?redirect=%2Fakilli-tahta', icon: Monitor, description: 'Akıllı tahta oturumları, cihaz yönetimi ve sınıf içi akışı merkezden yönetin.', detail: 'Cihaz erişimi, oturum kurgusu ve sınıf içi kullanım adımlarını tek merkezde toplar.', tags: ['Cihaz', 'Oturum', 'Sınıf içi'] },
  { label: 'Ajanda', slug: 'ogretmen-ajandasi', href: '/login?redirect=%2Fogretmen-ajandasi', icon: CalendarClock, description: 'Öğretmen ajandası ile not, görüşme, etkinlik ve takip kayıtlarını düzenleyin.', detail: 'Günlük okul temposunu daha düzenli hale getirir; görüşme, not ve takip adımlarını tek ekranda toplar.', tags: ['Notlar', 'Görüşmeler', 'Takip'] },
  { label: 'Ders Dağıt', slug: 'ders-dagit', href: '/login?redirect=%2Fders-dagit', icon: LayoutGrid, description: 'Ders programı üretimi, öğretmen atamaları ve stüdyo kurallarıyla dağıtımı yönetin.', detail: 'Program stüdyosu, yerleşim motoru ve yayın akışı ile haftalık çizelgeyi kurallara uygun üretir ve okula yayınlar.', tags: ['Program', 'Atama', 'Stüdyo'] },
  { label: 'Bilsem', slug: 'bilsem', href: '/login?redirect=%2Fbilsem%2Ftakvim', icon: Sparkles, description: 'Bilsem takvimi, planlar ve ilgili okul süreçlerini tek ekranda yürütün.', detail: 'Bilsem özelindeki takvim ve içerik akışını düzenler; öğretim planını daha görünür kılar.', tags: ['Takvim', 'Plan', 'Özel süreç'] },
  { label: 'Okul Değerl.', slug: 'okul-degerlendirme', href: '/okul-degerlendirmeleri', icon: Star, description: 'Okul değerlendirme sayfasını inceleyin, görünürlüğü ve geri bildirimleri takip edin.', detail: 'Okul algısını, yorumları ve görünürlük etkisini daha anlaşılır hale getirir.', tags: ['Geri bildirim', 'Görünürlük', 'Analiz'] },
  { label: 'Kertenkele', slug: 'kelebek-sinav', href: '/login?redirect=%2Fkelebek-sinav', icon: Bug, description: 'Kelebek sınav yerleşimi, salon düzeni ve planlama adımlarını otomatikleştirin.', detail: 'Sınav organizasyonunu daha kontrollü hale getirir; salon, dağılım ve yerleşim süreçlerini hızlandırır.', tags: ['Yerleşim', 'Salon planı', 'Otomasyon'] },
  { label: 'Sorumluluk', slug: 'sorumluluk-sinav', href: '/login?redirect=%2Fsorumluluk-sinav', icon: ClipboardCheck, description: 'Sorumluluk ve beceri sınavı programlama ile görevlendirme süreçlerini yönetin.', detail: 'Programlama, görev paylaşımı ve sınav adımlarını daha düzenli ve izlenebilir hale getirir.', tags: ['Programlama', 'Görev', 'Sınav süreci'] },
  { label: 'Mesaj Merkezi', slug: 'mesaj-merkezi', href: '/login?redirect=%2Fmesaj-merkezi', icon: MessageSquare, description: 'Veli ve öğretmenlere toplu bilgilendirme, maaş, devamsızlık ve bordro mesajları gönderin.', detail: 'İletişim yoğunluğunu azaltır; toplu duyuru ve bilgilendirme süreçlerini tek merkezden yönetmenizi sağlar.', tags: ['Toplu mesaj', 'Veli iletişimi', 'Bildirim'] },
];
