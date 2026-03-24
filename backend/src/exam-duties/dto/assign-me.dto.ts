import { IsOptional, IsDateString } from 'class-validator';

/** Görev çıktı işaretlerken çok günlü sınavda hangi güne sabah bildirimi alınacağı. */
export class AssignMeDto {
  /** Sadece bu günde sabah bildirimi al. YYYY-MM-DD. Boş = aralıktaki her gün. */
  @IsOptional()
  @IsDateString()
  preferred_exam_date?: string | null;
}
