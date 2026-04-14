import { IsString, IsOptional, IsArray, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SubjectEntryDto {
  @IsString() @MaxLength(255)
  subjectName: string;

  @IsOptional() @IsString()
  sessionId?: string | null;
}

export class CreateSorumlulukStudentDto {
  @IsString() @MaxLength(255)
  studentName: string;

  @IsOptional() @IsString() @MaxLength(50)
  studentNumber?: string;

  @IsOptional() @IsString() @MaxLength(50)
  className?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SubjectEntryDto)
  subjects?: SubjectEntryDto[];

  @IsOptional() @IsString()
  notes?: string;
}
