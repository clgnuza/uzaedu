import {
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
  ValidateNested,
  Matches,
  IsBoolean,
  IsIn,
  ValidateIf,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AVATAR_KEYS } from '../avatar-keys';

/** Yolluk ekranı / resmî formlar için öğretmen kimlik ve kadro bilgisi */
export class YollukTeacherDefaultsDto {
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @Matches(/^[0-9]{0,11}$/, { message: 'T.C. kimlik yalnızca rakam (en fazla 11).' })
  tc_kimlik?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const s = String(value).replace(/\s/g, '').toUpperCase().slice(0, 34);
    return s === '' ? undefined : s;
  })
  @IsString()
  @MaxLength(34)
  @Matches(/^[A-Z0-9]+$/, { message: 'IBAN yalnızca harf ve rakam (boşluksuz, en fazla 34).' })
  iban?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 15) return undefined;
    return Math.floor(n);
  })
  @IsInt()
  @Min(1)
  @Max(15)
  kadro_derecesi?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  kadro_kademesi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pdf_unvan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adres_il?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adres_ilce?: string;
}

/** Evrak formunda varsayılan değerler */
export class EvrakDefaultsDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  okul_adi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mudur_adi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ogretim_yili?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sinif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  zumreler?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  zumre_ogretmenleri?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  onay_tarihi?: string;

  /** Öğretmen unvanı / branş – imza alanında isim altında (örn. "Coğrafya Öğretmeni") */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ogretmen_unvani?: string;

  /** Raporlarda «Düzenleyen» için imza adı (örn. Müdür Yardımcısının adı). Boşsa display_name kullanılır. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  duzenleyen_adi?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => YollukTeacherDefaultsDto)
  yolluk_teacher?: YollukTeacherDefaultsDto;
}

export class UpdateMeDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const t = value.trim().replace(/\s+/g, ' ').slice(0, 255);
    return t === '' ? null : t;
  })
  @IsString()
  @MaxLength(255)
  @Matches(/^[^<>]*$/, { message: 'Görünen ad < veya > içeremez.' })
  display_name?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EvrakDefaultsDto)
  evrak_defaults?: EvrakDefaultsDto;

  /** Öğretmen: okul ataması (il/ilçe/okul seçimi ile) */
  @IsOptional()
  school_id?: string | null;

  /** Öğretmen: görevlendirme ile başka okulda çalışma durumu */
  @IsOptional()
  @IsBoolean()
  teacher_assignment_active?: boolean;

  /** Öğretmen: görevlendirme okulu */
  @IsOptional()
  teacher_assignment_school_id?: string | null;

  /** Öğretmen: branş (örn. Coğrafya, Matematik) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  teacher_branch?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const t = value.trim().replace(/\s+/g, ' ').slice(0, 32);
    return t === '' ? null : t;
  })
  @IsString()
  @MaxLength(32)
  teacher_phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const t = value.trim().slice(0, 64);
    return t === '' ? null : t;
  })
  @IsString()
  @MaxLength(64)
  teacher_title?: string | null;

  /** Aynı okuldaki diğer öğretmenlere tam ad gösterilmesin */
  @IsOptional()
  @IsBoolean()
  teacher_public_name_masked?: boolean;

  /** E-posta+şifre girişinde e-posta OTP (öğretmen / okul yöneticisi / süperadmin / moderatör) */
  @IsOptional()
  @IsBoolean()
  login_otp_required?: boolean;

  /** WebAuthn / biyometrik giriş (öğretmen / okul yöneticisi / süperadmin / moderatör) */
  @IsOptional()
  @IsBoolean()
  passkey_login_enabled?: boolean;

  /** Hazır profil görseli (null = sıfırla) */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'string') return value.trim();
    return value;
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...AVATAR_KEYS], { message: 'Geçersiz profil görseli.' })
  avatar_key?: string | null;

  /** Öğretmen / okul yöneticisi: nöbet günü hatırlatması */
  @IsOptional()
  @IsBoolean()
  duty_reminder_enabled?: boolean;

  /** TSİ HH:mm */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Saat HH:mm (TSİ) formatında olmalıdır.' })
  duty_reminder_time_tr?: string;
}
