import { IsString, IsOptional, IsUUID, IsIn, MaxLength, Matches } from 'class-validator';

export class UpdateAgendaTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  dueTime?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly'])
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsUUID()
  studentId?: string | null;

  @IsOptional()
  @IsString()
  linkedModule?: string | null;

  @IsOptional()
  @IsString()
  linkedEntityId?: string | null;

  /** Gönderilirse: gönderilmemiş hatırlatıcılar silinir; boş string ise temizlenir */
  @IsOptional()
  @IsString()
  remindAt?: string | null;

  /**
   * Takvimdeki bir tekrar günü için: bu tarih son tekrar olur, tekrar kapatılır, son tarih bu güne çekilir.
   * yyyy-AA-gg; görevin mevcut tekrar ızgarasında olmalıdır.
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'repeatEndOccurrenceDate yyyy-AA-gg olmalıdır.' })
  repeatEndOccurrenceDate?: string;
}
