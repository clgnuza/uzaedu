import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkCalendar } from './entities/work-calendar.entity';
import { WorkCalendarService } from './work-calendar.service';
import { WorkCalendarController } from './work-calendar.controller';
import { WorkCalendarGptService } from './work-calendar-gpt.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkCalendar])],
  controllers: [WorkCalendarController],
  providers: [WorkCalendarService, WorkCalendarGptService],
  exports: [WorkCalendarService],
})
export class WorkCalendarModule {}
