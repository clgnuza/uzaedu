import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListExtraLessonParamsDto {
  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;

  @IsOptional()
  @IsString()
  semester_code?: string;
}
