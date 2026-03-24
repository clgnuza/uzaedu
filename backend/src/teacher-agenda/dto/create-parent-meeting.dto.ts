import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateAgendaParentMeetingDto {
  @IsUUID()
  studentId: string;

  @IsString()
  meetingDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  meetingType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  subject?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  followUpDate?: string | null;
}
