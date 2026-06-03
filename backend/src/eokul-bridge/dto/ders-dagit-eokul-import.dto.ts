import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class DersDagitEokulImportDto {
  @IsUUID()
  studio_id!: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  file_base64!: string;

  @IsOptional()
  @IsIn(['csv', 'xlsx', 'grid_xlsx', 'auto'])
  format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';

  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_elective_groups?: boolean;
}
