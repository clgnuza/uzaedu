import { IsString, MinLength, IsOptional } from 'class-validator';

export class EscalateTicketDto {
  @IsString()
  @MinLength(1, { message: 'Eskalasyon sebebi zorunludur.' })
  reason: string;

  @IsOptional()
  @IsString()
  extra_info?: string;
}
