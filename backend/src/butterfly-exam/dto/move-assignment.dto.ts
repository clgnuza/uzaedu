import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveButterflyAssignmentDto {
  @IsUUID()
  room_id: string;

  @IsInt()
  @Min(0)
  seat_index: number;
}
