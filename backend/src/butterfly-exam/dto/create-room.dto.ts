import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateButterflyRoomDto {
  @IsUUID()
  building_id: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsIn(['single', 'pair'])
  seat_layout?: 'single' | 'pair';

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
