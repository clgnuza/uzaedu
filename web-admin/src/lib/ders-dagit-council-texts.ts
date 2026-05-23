/** Zümre kurulu tutanağı — varsayılan metinler (backend ile senkron) */

export const DEFAULT_COUNCIL_MEETING_TOPIC =
  'Haftalık ders dağıtım programının görüşülmesi, incelenmesi ve onaylanması';

export const DEFAULT_COUNCIL_MEETING_PLACE = 'Okul Öğretmenler Odası';

export const DEFAULT_COUNCIL_AGENDA = `1. Açılış ve yoklama
2. Haftalık ders dağıtım programının görüşülmesi
3. Dilek ve temenniler`;

export const DEFAULT_COUNCIL_APPROVAL_TEXT = `Karar 1: {{ogretim_yili}} Eğitim-Öğretim Yılında {{okul_adi}} bünyesinde uygulanacak haftalık ders dağıtım programı, öğretim programı ve Millî Eğitim Bakanlığı mevzuatına uygun olarak hazırlanmış olup Zümre Öğretmenler Kurulunca incelenmiş ve oy çokluğu ile kabul edilmiştir.

Karar 2: Hazırlanan haftalık ders programının Öğretmenler Kurulunda görüşülmesi ve Okul Müdürünün onayına sunulması; onay sonrası ilgili öğretmenlere yazılı olarak tebliğ edilmesi kararlaştırılmıştır.

Karar 3: Programın uygulanmasında aksaklık yaşanmaması için sorumlu öğretmen ve idarecilerin görevlendirilmesine; değişiklik taleplerinin yazılı olarak okul idaresine iletilmesine karar verilmiştir.`;

export const COUNCIL_PLACEHOLDERS = [
  { key: '{{okul_adi}}', desc: 'Okul adı' },
  { key: '{{ogretim_yili}}', desc: 'Öğretim yılı' },
  { key: '{{program_adi}}', desc: 'Program adı' },
  { key: '{{tarih}}', desc: 'Tutanak tarihi' },
  { key: '{{mudur_adi}}', desc: 'Okul müdürü' },
] as const;

export const COUNCIL_SETUP_STORAGE_KEY = (studioId: string) => `dd-council-texts-v1-${studioId}`;
