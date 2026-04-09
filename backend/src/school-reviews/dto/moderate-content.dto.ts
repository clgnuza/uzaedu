import { IsIn } from 'class-validator';

/** PATCH .../moderation — onay veya gizle */
export class ModerateContentDto {
  @IsIn(['approved', 'hidden'])
  status!: 'approved' | 'hidden';
}
