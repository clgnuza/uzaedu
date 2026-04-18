import { IsOptional, IsString, MaxLength } from 'class-validator';

/** POST placement-scores/sync-from-feed isteğe bağlı gövdesi */
export class PlacementSyncFeedDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  update_scope?: string;
}
