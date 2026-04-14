import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateSorumlulukGroupDto {
  @IsString() @MaxLength(255)
  title: string;

  @IsOptional() @IsString() @MaxLength(50)
  academicYear?: string;

  @IsOptional() @IsIn(['sorumluluk', 'beceri'])
  examType?: 'sorumluluk' | 'beceri';

  @IsOptional() @IsString()
  notes?: string;
}
