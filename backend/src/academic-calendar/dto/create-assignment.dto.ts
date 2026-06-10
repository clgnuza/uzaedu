import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBelirliGunHaftaGorevDto {
  @IsUUID()
  item_id!: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  user_ids?: string[];

  @IsOptional()
  @IsString()
  teacher_branch?: string;

  @IsOptional()
  @IsBoolean()
  all_teachers?: boolean;

  @IsOptional()
  @IsString()
  gorev_tipi?: 'sorumlu' | 'yardimci';
}
