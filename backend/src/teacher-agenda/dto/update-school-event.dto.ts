import { IsString, IsOptional, IsBoolean, IsDateString, IsArray, IsUUID, MaxLength } from 'class-validator';

export class UpdateAgendaSchoolEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  eventAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  targetAudience?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetTeacherIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetBranches?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(512)
  attachmentUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  important?: boolean;
}
