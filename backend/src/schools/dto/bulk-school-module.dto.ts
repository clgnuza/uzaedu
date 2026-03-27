import { IsBoolean, IsIn, IsString } from 'class-validator';
import { MARKET_MODULE_KEYS } from '../../app-config/market-policy.defaults';

const MODULE_KEYS = [...MARKET_MODULE_KEYS] as string[];

export class BulkSchoolModuleDto {
  @IsString()
  @IsIn(MODULE_KEYS)
  module_key!: string;

  @IsBoolean()
  enable!: boolean;
}
