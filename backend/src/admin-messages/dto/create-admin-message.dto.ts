import { IsArray, IsString, IsOptional, ArrayMinSize, IsUUID } from 'class-validator';

export class CreateAdminMessageDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'En az bir okul seçilmelidir.' })
  @IsUUID('4', { each: true })
  school_ids: string[];

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  image_url?: string;
}
