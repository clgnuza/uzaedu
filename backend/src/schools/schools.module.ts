import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';
import { MebbisKurumlistesiService } from './mebbis-kurumlistesi.service';
import { SchoolPlacementScoresSyncService } from './school-placement-scores-sync.service';
import { PlacementGptExtractService } from './placement-gpt-extract.service';

@Module({
  imports: [TypeOrmModule.forFeature([School])],
  controllers: [SchoolsController],
  providers: [SchoolsService, MebbisKurumlistesiService, SchoolPlacementScoresSyncService, PlacementGptExtractService],
  exports: [SchoolsService, TypeOrmModule],
})
export class SchoolsModule {}
