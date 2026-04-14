import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm/dist/interfaces/typeorm-options.interface';
import { env } from './config/env';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeModule } from './me/me.module';
import { SchoolsModule } from './schools/schools.module';
import { SeedModule } from './seed/seed.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { NewsModule } from './news/news.module';
import { ExamDutiesModule } from './exam-duties/exam-duties.module';
import { StatsModule } from './stats/stats.module';
import { TvDevicesModule } from './tv-devices/tv-devices.module';
import { AuditModule } from './audit/audit.module';
import { AppConfigModule } from './app-config/app-config.module';
import { DeployModule } from './deploy/deploy.module';
import { UploadModule } from './upload/upload.module';
import { AdminMessagesModule } from './admin-messages/admin-messages.module';
import { SchoolReviewsModule } from './school-reviews/school-reviews.module';
import { ClassesSubjectsModule } from './classes-subjects/classes-subjects.module';
import { ExtraLessonParamsModule } from './extra-lesson-params/extra-lesson-params.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';
import { WorkCalendarModule } from './work-calendar/work-calendar.module';
import { YillikPlanIcerikModule } from './yillik-plan-icerik/yillik-plan-icerik.module';
import { OutcomeSetsModule } from './outcome-sets/outcome-sets.module';
import { DutyModule } from './duty/duty.module';
import { TeacherTimetableModule } from './teacher-timetable/teacher-timetable.module';
import { ContentModule } from './content/content.module';
import { SiteMapModule } from './site-map/site-map.module';
import { AcademicCalendarModule } from './academic-calendar/academic-calendar.module';
import { OptikModule } from './optik/optik.module';
import { SmartBoardModule } from './smart-board/smart-board.module';
import { TicketsModule } from './tickets/tickets.module';
import { MailModule } from './mail/mail.module';
import { StudentsModule } from './students/students.module';
import { TeacherAgendaModule } from './teacher-agenda/teacher-agenda.module';
import { BilsemModule } from './bilsem/bilsem.module';
import { ButterflyExamModule } from './butterfly-exam/butterfly-exam.module';
import { SorumlulukExamModule } from './sorumluluk-exam/sorumluluk-exam.module';
import { MessagingModule } from './messaging/messaging.module';
import { MarketModule } from './market/market.module';
import { AdsModule } from './ads/ads.module';
import { TeacherInviteModule } from './teacher-invite/teacher-invite.module';
import { Utf8JsonCharsetInterceptor } from './common/interceptors/utf8-json-charset.interceptor';

function getTypeOrmConfig(): TypeOrmModuleOptions {
  const common = {
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: env.nodeEnv === 'local' && env.typeormSync,
    logging: env.debug,
  };
  if (env.useSqlite) {
    return { type: 'better-sqlite3', database: 'data/ogretmenpro.sqlite', ...common } as TypeOrmModuleOptions;
  }
  return {
    type: 'postgres',
    host: env.db.host,
    port: env.db.port,
    username: env.db.username,
    password: env.db.password,
    database: env.db.database,
    extra: {
      max: Math.max(2, env.db.poolMax),
      idleTimeoutMillis: env.db.poolIdleMs,
      connectionTimeoutMillis: env.db.poolConnectionTimeoutMs,
      options: '-c client_encoding=UTF8',
    },
    ...common,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 1000 },
      { name: 'auth', ttl: 60000, limit: 30 },
      { name: 'public', ttl: 60000, limit: 120 },
    ]),
    TypeOrmModule.forRoot(getTypeOrmConfig()),
    AuthModule,
    UsersModule,
    MeModule,
    SchoolsModule,
    SeedModule,
    HealthModule,
    NotificationsModule,
    AnnouncementsModule,
    NewsModule,
    ExamDutiesModule,
    StatsModule,
    TvDevicesModule,
    AuditModule,
    AppConfigModule,
    DeployModule,
    UploadModule,
    AdminMessagesModule,
    SchoolReviewsModule,
    ClassesSubjectsModule,
    ExtraLessonParamsModule,
    DocumentTemplatesModule,
    WorkCalendarModule,
    YillikPlanIcerikModule,
    OutcomeSetsModule,
    DutyModule,
    TeacherTimetableModule,
    ContentModule,
    SiteMapModule,
    AcademicCalendarModule,
    OptikModule,
    SmartBoardModule,
    TicketsModule,
    MailModule,
    StudentsModule,
    TeacherAgendaModule,
    BilsemModule,
    ButterflyExamModule,
    SorumlulukExamModule,
    MessagingModule,
    MarketModule,
    AdsModule,
    TeacherInviteModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: Utf8JsonCharsetInterceptor },
  ],
})
export class AppModule {}
