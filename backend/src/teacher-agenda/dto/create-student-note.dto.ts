import { IsString, IsOptional, IsUUID, IsIn, IsArray, MaxLength } from 'class-validator';

export class CreateAgendaStudentNoteDto {
  @IsUUID()
  studentId: string;

  @IsIn(['positive', 'negative', 'observation'])
  noteType: 'positive' | 'negative' | 'observation';

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @IsString()
  noteDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | null;

  @IsOptional()
  @IsIn(['private', 'school_admin', 'selected_teachers', 'all_school'])
  privacyLevel?: 'private' | 'school_admin' | 'selected_teachers' | 'all_school';
}
