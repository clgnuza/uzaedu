import { IsString, IsIn, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @IsIn(['PUBLIC', 'INTERNAL_NOTE'])
  message_type: 'PUBLIC' | 'INTERNAL_NOTE';

  @IsString()
  @MinLength(1, { message: 'Mesaj içeriği zorunludur.' })
  body: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<{ key: string; filename: string; mime_type?: string; size_bytes?: number }> = [];
}
