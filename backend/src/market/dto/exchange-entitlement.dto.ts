import { IsIn, IsInt, Max, Min } from 'class-validator';

export class ExchangeEntitlementDto {
  @IsIn(['yillik_plan_uretim', 'evrak_uretim'])
  kind!: 'yillik_plan_uretim' | 'evrak_uretim';

  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;
}
