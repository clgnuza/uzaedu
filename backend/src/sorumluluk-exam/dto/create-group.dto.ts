import { IsString, IsOptional, IsIn, IsInt, IsBoolean, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SorumlulukProctorRulesDto {
  @IsOptional() @IsInt() @Min(1)
  studentThreshold?: number;

  @IsOptional() @IsInt() @Min(1)
  komisyonPerSession?: number;

  @IsOptional() @IsInt() @Min(0)
  gozcuPerRoom?: number;

  @IsOptional() @IsBoolean()
  useSmartRules?: boolean;
}

export class CreateSorumlulukGroupDto {
  @IsString() @MaxLength(255)
  title: string;

  @IsOptional() @IsString() @MaxLength(50)
  academicYear?: string;

  @IsOptional() @IsIn(['sorumluluk', 'beceri'])
  examType?: 'sorumluluk' | 'beceri';

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @ValidateNested() @Type(() => SorumlulukProctorRulesDto)
  proctorRules?: SorumlulukProctorRulesDto;
}
