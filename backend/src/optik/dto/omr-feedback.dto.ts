import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OmrCorrectionItemDto {
  @IsNumber()
  question!: number;

  @IsString()
  detected_label!: string;

  @IsString()
  corrected_label!: string;
}

export class SubmitOmrFeedbackDto {
  @IsUUID()
  template_id!: string;

  @IsOptional()
  @IsUUID()
  scan_result_id?: string;

  @IsOptional()
  @IsString()
  student_code?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OmrCorrectionItemDto)
  corrections!: OmrCorrectionItemDto[];
}
