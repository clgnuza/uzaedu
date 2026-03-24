import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const ABSENCE_TYPES = ['raporlu', 'izinli', 'gelmeyen'] as const;
export type AbsenceTypeDto = (typeof ABSENCE_TYPES)[number];

export class CreateDutyAbsenceDto {
  @IsUUID()
  user_id: string;

  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsIn(ABSENCE_TYPES)
  absence_type: AbsenceTypeDto;

  @IsOptional()
  @IsString()
  note?: string | null;
}
