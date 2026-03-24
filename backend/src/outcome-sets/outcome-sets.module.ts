import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutcomeSet } from './entities/outcome-set.entity';
import { OutcomeItem } from './entities/outcome-item.entity';
import { OutcomeSetsService } from './outcome-sets.service';
import { OutcomeSetsController } from './outcome-sets.controller';
import { YillikPlanIcerikModule } from '../yillik-plan-icerik/yillik-plan-icerik.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutcomeSet, OutcomeItem]),
    YillikPlanIcerikModule,
  ],
  controllers: [OutcomeSetsController],
  providers: [OutcomeSetsService],
  exports: [OutcomeSetsService],
})
export class OutcomeSetsModule {}
