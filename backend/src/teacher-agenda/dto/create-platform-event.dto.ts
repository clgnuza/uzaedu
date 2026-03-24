import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateAgendaPlatformEventDto {
  @IsString()
  @MaxLength(512)
  title: string;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsDateString()
  eventAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  segment?: string | null;
}
