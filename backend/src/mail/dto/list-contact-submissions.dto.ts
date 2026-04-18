import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContactSubmissionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** 'all' = tümü */
  @IsOptional()
  @IsIn(['all', 'new', 'replied', 'archived'])
  status?: 'all' | 'new' | 'replied' | 'archived' = 'all';
}
