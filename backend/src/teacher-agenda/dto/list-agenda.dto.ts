import { IsOptional, IsString, IsDateString, IsUUID, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAgendaNotesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['PERSONAL', 'SCHOOL', 'PLATFORM'])
  source?: string;

  @IsOptional()
  @IsUUID()
  /** Duyuru TV ile eşleşen ajanda notu (tags: duyuru_ann + duyuru kimliği) */
  announcementId?: string;

  @IsOptional()
  includeArchived?: boolean;
}

export class ListAgendaTasksDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['pending', 'completed', 'overdue', 'postponed'])
  status?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: string;
}

export class ListCalendarDto {
  @IsString()
  @IsDateString()
  start: string;

  @IsString()
  @IsDateString()
  end: string;

  @IsOptional()
  @IsIn(['PERSONAL', 'SCHOOL', 'PLATFORM'])
  source?: string;
}
