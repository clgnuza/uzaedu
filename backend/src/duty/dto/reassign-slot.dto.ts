import { IsUUID } from 'class-validator';

export class ReassignSlotDto {
  @IsUUID()
  duty_slot_id: string;

  @IsUUID()
  new_user_id: string;
}
