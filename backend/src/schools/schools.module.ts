import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { SchoolsService } from './schools.service';
import { SchoolsController } from './schools.controller';
import { MebbisKurumlistesiService } from './mebbis-kurumlistesi.service';

@Module({
  imports: [TypeOrmModule.forFeature([School])],
  controllers: [SchoolsController],
  providers: [SchoolsService, MebbisKurumlistesiService],
  exports: [SchoolsService, TypeOrmModule],
})
export class SchoolsModule {}
