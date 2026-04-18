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
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AVATAR_KEYS } from '../avatar-keys';

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
  @MaxLength(32)
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

  /** Öğretmen: branş (örn. Coğrafya, Matematik) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  teacher_branch?: string | null;

  /** Aynı okuldaki diğer öğretmenlere tam ad gösterilmesin */
  @IsOptional()
  @IsBoolean()
  teacher_public_name_masked?: boolean;

  /** E-posta+şifre girişinde e-posta OTP (öğretmen / okul yöneticisi / süperadmin / moderatör) */
  @IsOptional()
  @IsBoolean()
  login_otp_required?: boolean;

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
