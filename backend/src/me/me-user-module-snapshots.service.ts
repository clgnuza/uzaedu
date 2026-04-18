import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MARKET_MODULE_KEYS, type MarketModuleKey } from '../app-config/market-policy.defaults';
import { DutyPreference } from '../duty/entities/duty-preference.entity';
import { DutyAbsence } from '../duty/entities/duty-absence.entity';
import { DutySwapRequest } from '../duty/entities/duty-swap-request.entity';
import { MessagingUserPreference } from '../messaging/entities/messaging-user-preference.entity';
import { DocumentGeneration } from '../document-templates/entities/document-generation.entity';
import { OptikFormTemplate } from '../optik/entities/optik-form-template.entity';
import { OptikUsageLog } from '../optik/entities/optik-usage-log.entity';
import { SmartBoardDeviceSchedule } from '../smart-board/entities/smart-board-device-schedule.entity';
import { BilsemCalendarAssignment } from '../bilsem/entities/bilsem-calendar-assignment.entity';
import { BilsemGeneratedPlan } from '../bilsem/entities/bilsem-generated-plan.entity';
import { ButterflyModuleTeacher } from '../butterfly-exam/entities/butterfly-module-teacher.entity';
import { ButterflyExamProctor } from '../butterfly-exam/entities/butterfly-exam-proctor.entity';
import { SorumlulukSessionProctor } from '../sorumluluk-exam/entities/sorumluluk-session-proctor.entity';

function jsonSafe(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v, (_, val) => (val instanceof Date ? val.toISOString() : val)));
}

const EXPORT_SET = new Set<string>(MARKET_MODULE_KEYS);

@Injectable()
export class MeUserModuleSnapshotsService {
  constructor(
    @InjectRepository(DutyPreference) private readonly dutyPrefRepo: Repository<DutyPreference>,
    @InjectRepository(DutyAbsence) private readonly dutyAbsRepo: Repository<DutyAbsence>,
    @InjectRepository(DutySwapRequest) private readonly dutySwapRepo: Repository<DutySwapRequest>,
    @InjectRepository(MessagingUserPreference) private readonly msgPrefRepo: Repository<MessagingUserPreference>,
    @InjectRepository(DocumentGeneration) private readonly docGenRepo: Repository<DocumentGeneration>,
    @InjectRepository(OptikFormTemplate) private readonly optikTplRepo: Repository<OptikFormTemplate>,
    @InjectRepository(OptikUsageLog) private readonly optikLogRepo: Repository<OptikUsageLog>,
    @InjectRepository(SmartBoardDeviceSchedule) private readonly sbSchedRepo: Repository<SmartBoardDeviceSchedule>,
    @InjectRepository(BilsemCalendarAssignment) private readonly bilsemAssignRepo: Repository<BilsemCalendarAssignment>,
    @InjectRepository(BilsemGeneratedPlan) private readonly bilsemPlanRepo: Repository<BilsemGeneratedPlan>,
    @InjectRepository(ButterflyModuleTeacher) private readonly bfModTeacherRepo: Repository<ButterflyModuleTeacher>,
    @InjectRepository(ButterflyExamProctor) private readonly bfProctorRepo: Repository<ButterflyExamProctor>,
    @InjectRepository(SorumlulukSessionProctor) private readonly sorProctorRepo: Repository<SorumlulukSessionProctor>,
  ) {}

  isExportableModule(key: string): key is MarketModuleKey {
    return EXPORT_SET.has(key);
  }

  /** Kullanıcıya bağlı satırlar; okul geneli / sunucu geneli modüller `unavailable` döner. */
  async snapshot(userId: string, key: MarketModuleKey): Promise<Record<string, unknown>> {
    const base = { snapshot_user_id: userId };

    switch (key) {
      case 'duty': {
        const [duty_preferences, duty_absences, duty_swap_requests] = await Promise.all([
          this.dutyPrefRepo.find({ where: { user_id: userId }, order: { date: 'ASC' } }),
          this.dutyAbsRepo.find({ where: { user_id: userId }, order: { date_from: 'ASC' } }),
          this.dutySwapRepo.find({
            where: [{ requested_by_user_id: userId }, { proposed_user_id: userId }],
            order: { created_at: 'ASC' },
          }),
        ]);
        return {
          ...base,
          duty_preferences: jsonSafe(duty_preferences),
          duty_absences: jsonSafe(duty_absences),
          duty_swap_requests: jsonSafe(duty_swap_requests),
        };
      }
      case 'messaging': {
        const messaging_user_preferences = await this.msgPrefRepo.find({
          where: { userId },
          order: { schoolId: 'ASC' },
        });
        return { ...base, messaging_user_preferences: jsonSafe(messaging_user_preferences) };
      }
      case 'document': {
        const document_generations = await this.docGenRepo.find({
          where: { userId },
          order: { id: 'DESC' },
        });
        return { ...base, document_generations: jsonSafe(document_generations) };
      }
      case 'optical': {
        const [optik_form_templates, optik_usage_logs] = await Promise.all([
          this.optikTplRepo.find({ where: { createdByUserId: userId }, order: { name: 'ASC' } }),
          this.optikLogRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        ]);
        return { ...base, optik_form_templates: jsonSafe(optik_form_templates), optik_usage_logs: jsonSafe(optik_usage_logs) };
      }
      case 'smart_board': {
        const smart_board_device_schedules = await this.sbSchedRepo.find({
          where: { user_id: userId },
          order: { device_id: 'ASC', day_of_week: 'ASC', lesson_num: 'ASC' },
        });
        return { ...base, smart_board_device_schedules: jsonSafe(smart_board_device_schedules) };
      }
      case 'bilsem': {
        const [bilsem_calendar_assignments, bilsem_generated_plans] = await Promise.all([
          this.bilsemAssignRepo.find({ where: { userId }, order: { createdAt: 'ASC' } }),
          this.bilsemPlanRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        ]);
        return {
          ...base,
          bilsem_calendar_assignments: jsonSafe(bilsem_calendar_assignments),
          bilsem_generated_plans: jsonSafe(bilsem_generated_plans),
        };
      }
      case 'butterfly_exam': {
        const [butterfly_module_teachers, butterfly_exam_proctors] = await Promise.all([
          this.bfModTeacherRepo.find({ where: { userId }, order: { schoolId: 'ASC' } }),
          this.bfProctorRepo.find({ where: { userId }, order: { planId: 'ASC' } }),
        ]);
        return {
          ...base,
          butterfly_module_teachers: jsonSafe(butterfly_module_teachers),
          butterfly_exam_proctors: jsonSafe(butterfly_exam_proctors),
        };
      }
      case 'sorumluluk_sinav': {
        const sorumluluk_session_proctors = await this.sorProctorRepo.find({
          where: { userId },
          order: { sessionId: 'ASC', sortOrder: 'ASC' },
        });
        return { ...base, sorumluluk_session_proctors: jsonSafe(sorumluluk_session_proctors) };
      }
      case 'tv':
      case 'extra_lesson':
      case 'outcome':
      case 'school_reviews':
        return {
          unavailable: true,
          scope: 'school_or_shared',
          hint_tr:
            'Bu modül verileri çoğunlukla okul paylaşımlı sunucu kayıtlarında tutulur; kişisel yedekte yalnızca yer tutucu bulunur. İlgili modül sayfalarından okul yöneticisi dışa aktarımı kullanın.',
        };
      default:
        return { unavailable: true, hint_tr: 'Bu modül için kullanıcı bazlı dışa aktarım tanımlı değil.' };
    }
  }
}
