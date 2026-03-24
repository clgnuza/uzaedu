import { IsString, IsOptional, IsUUID, IsIn, MaxLength } from 'class-validator';

export class UpdateAgendaTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  dueTime?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly'])
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsUUID()
  studentId?: string | null;

  @IsOptional()
  @IsString()
  linkedModule?: string | null;

  @IsOptional()
  @IsString()
  linkedEntityId?: string | null;
}
