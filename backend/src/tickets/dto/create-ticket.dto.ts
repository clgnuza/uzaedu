import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  @IsIn(['SCHOOL_SUPPORT', 'PLATFORM_SUPPORT'])
  target_type: 'SCHOOL_SUPPORT' | 'PLATFORM_SUPPORT';

  @IsUUID()
  module_id: string;

  @IsString()
  @IsIn(['BUG', 'QUESTION', 'REQUEST', 'IMPROVEMENT'])
  issue_type: 'BUG' | 'QUESTION' | 'REQUEST' | 'IMPROVEMENT';

  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';

  @IsString()
  @MinLength(1, { message: 'Konu zorunludur.' })
  @MaxLength(512)
  subject: string;

  @IsString()
  @MinLength(1, { message: 'Açıklama zorunludur.' })
  description: string;

  /** R2 key + filename. key=storage_key; size_bytes/mime_type opsiyonel. */
  @IsOptional()
  @IsArray()
  attachments?: Array<{ key: string; filename: string; mime_type?: string; size_bytes?: number }> = [];
}
