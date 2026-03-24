import { IsUUID, IsOptional, IsDateString, IsString, MaxLength } from 'class-validator';

export class CreateAgendaReminderDto {
  @IsOptional()
  @IsUUID()
  noteId?: string | null;

  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @IsDateString()
  remindAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  repeatRule?: string | null;

  @IsOptional()
  @IsDateString()
  silentUntil?: string | null;
}
