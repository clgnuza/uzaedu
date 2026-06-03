const KURUM_BOTH = ['ilkOgretim', 'ortaOgretim'] as const;

const OGR_BILGI_FIELDS = [
  { id: 'sinif', label: 'Sınıf' },
  { id: 'ogrenciNo', label: 'Öğrenci no' },
  { id: 'adSoyad', label: 'Ad soyad' },
  { id: 'tcKimlikNo', label: 'T.C. kimlik no', source: 'api02001' },
  { id: 'adi', label: 'Adı', source: 'api02001' },
  { id: 'soyadi', label: 'Soyadı', source: 'api02001' },
  { id: 'dogumTarihi', label: 'Doğum tarihi', source: 'api02001' },
  { id: 'durumu', label: 'Durumu', source: 'api02001' },
  { id: 'velisiKim', label: 'Velisi kim', source: 'api02001' },
  { id: 'smsBilgilendirme', label: 'SMS bilgilendirme', source: 'api02001' },
  { id: 'yabanciDil', label: 'Yabancı dil', source: 'api02001' },
  { id: 'sinifSube', label: 'Sınıf şube', source: 'api02001' },
] as const;

const NUFUS_FIELDS = [
  { id: 'cinsiyet', label: 'Cinsiyet', jsonKey: 'cinsiyet' },
  { id: 'dogumTarihi', label: 'Doğum tarihi', jsonKey: 'dogumTarihi' },
  { id: 'dogumYeri', label: 'Doğum yeri', jsonKey: 'dogumYeri' },
  { id: 'anaAdi', label: 'Ana adı', jsonKey: 'anaAdi' },
  { id: 'babaAdi', label: 'Baba adı', jsonKey: 'babaAdi' },
  { id: 'medeniHali', label: 'Medeni hali', jsonKey: 'medeniHali' },
  { id: 'kanGrubu', label: 'Kan grubu', jsonKey: 'kanGrubu' },
  { id: 'din', label: 'Din', jsonKey: 'din' },
  { id: 'uyruk', label: 'Uyruk', jsonKey: 'uyruk' },
] as const;

const GENEL_FIELDS = [
  { id: 'yatiliDurumu', label: 'Yatılı durumu', labelMatch: 'Yatılı' },
  { id: 'servisDurumu', label: 'Servis', labelMatch: 'Servis' },
  { id: 'tasimaliDurumu', label: 'Taşımalı', labelMatch: 'Taşımalı' },
  { id: 'bursDurumu', label: 'Burs', labelMatch: 'Burs' },
] as const;

const OZEL_FIELDS = [
  { id: 'surekliHastalik', label: 'Sürekli hastalık', labelMatch: 'Sürekli' },
  { id: 'engelDurumu', label: 'Engel durumu', labelMatch: 'Engel' },
  { id: 'kronikHastalik', label: 'Kronik hastalık', labelMatch: 'Kronik' },
  { id: 'alerji', label: 'Alerji', labelMatch: 'Alerji' },
] as const;

const VELI_FIELDS = [
  { id: 'anneAdiSoyadi', label: 'Anne adı soyadı' },
  { id: 'anneCepTelefonu', label: 'Anne cep telefonu' },
  { id: 'anneEvTelefonu', label: 'Anne ev telefonu' },
  { id: 'anneIsTelefonu', label: 'Anne iş telefonu' },
  { id: 'anneEposta', label: 'Anne e-posta' },
  { id: 'anneMeslek', label: 'Anne meslek' },
  { id: 'babaAdiSoyadi', label: 'Baba adı soyadı' },
  { id: 'babaCepTelefonu', label: 'Baba cep telefonu' },
  { id: 'babaEvTelefonu', label: 'Baba ev telefonu' },
  { id: 'babaIsTelefonu', label: 'Baba iş telefonu' },
  { id: 'babaEposta', label: 'Baba e-posta' },
  { id: 'babaMeslek', label: 'Baba meslek' },
] as const;

function fieldsForKurum<T extends readonly { id: string; label: string }[]>(fields: T) {
  return Object.fromEntries(KURUM_BOTH.map((k) => [k, [...fields]]));
}

export const EOKUL_BRIDGE_OGR_DOSYA_GROUPS = [
  {
    id: 'ogrenciBilgileri',
    label: 'Öğrenci bilgileri',
    fieldsByKurum: fieldsForKurum(OGR_BILGI_FIELDS),
  },
  {
    id: 'nufusBilgileri',
    label: 'Nüfus bilgileri',
    fieldsByKurum: fieldsForKurum(NUFUS_FIELDS),
  },
  {
    id: 'ogrenciGenelBilgileri',
    label: 'Öğrenci genel bilgileri',
    fieldsByKurum: fieldsForKurum(GENEL_FIELDS),
  },
  {
    id: 'ogrenciOzelBilgileri',
    label: 'Öğrenci özel bilgileri',
    fieldsByKurum: fieldsForKurum(OZEL_FIELDS),
  },
  {
    id: 'veliBilgileri',
    label: 'Veli bilgileri',
    fieldsByKurum: fieldsForKurum(VELI_FIELDS),
  },
  {
    id: 'ogrenciResmi',
    label: 'Öğrenci resmi (ZIP)',
    fieldsByKurum: fieldsForKurum([
      { id: 'jpgIndir', label: 'JPEG dosyaları (ZIP)' },
    ]),
  },
] as const;
