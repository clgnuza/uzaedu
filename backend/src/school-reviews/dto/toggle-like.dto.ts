import { IsOptional, IsString, Matches } from 'class-validator';

/** POST .../like – Anonim beğeni için. Frontend localStorage'dan gönderir. */
export class ToggleLikeDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9-]{20,64}$/i, { message: 'Geçersiz anonymous_id formatı.' })
  anonymous_id?: string;
}
