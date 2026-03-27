import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamDutyPreference } from './entities/exam-duty-preference.entity';
import { UpdateExamDutyPreferencesDto } from './dto/update-exam-duty-preferences.dto';
import { EXAM_DUTY_CATEGORIES } from './entities/exam-duty.entity';

function padHHmm(s: string): string {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

@Injectable()
export class ExamDutyPreferencesService {
  constructor(
    @InjectRepository(ExamDutyPreference)
    private readonly prefRepo: Repository<ExamDutyPreference>,
  ) {}

  async getForUser(userId: string): Promise<ExamDutyPreference[]> {
    return this.prefRepo.find({
      where: { userId },
      order: { categorySlug: 'ASC' },
    });
  }

  /** Tüm kategorileri varsayılan ile döndür (yoksa boş) */
  async getForUserWithDefaults(userId: string): Promise<{ slug: string; pref_publish: boolean; pref_deadline: boolean; pref_approval_day: boolean; pref_exam_minus_1d: boolean; pref_exam_plus_1d: boolean; pref_exam_day_morning: boolean; pref_exam_day_morning_time: string | null }[]> {
    const existing = await this.getForUser(userId);
    const bySlug = new Map(existing.map((p) => [p.categorySlug, p]));

    return EXAM_DUTY_CATEGORIES.map((slug) => {
      const p = bySlug.get(slug);
      return {
        slug,
        pref_publish: p?.prefPublish ?? true,
        pref_deadline: p?.prefDeadline ?? true,
        pref_approval_day: p?.prefApprovalDay ?? true,
        pref_exam_minus_1d: p?.prefExamMinus1d ?? true,
        pref_exam_plus_1d: p?.prefExamPlus1d ?? true,
        pref_exam_day_morning: p?.prefExamDayMorning ?? true,
        pref_exam_day_morning_time: p?.prefExamDayMorningTime ?? null,
      };
    });
  }

  async update(userId: string, dto: UpdateExamDutyPreferencesDto): Promise<ExamDutyPreference[]> {
    for (const cat of dto.categories) {
      await this.prefRepo.upsert(
        {
          userId,
          categorySlug: cat.slug,
          prefPublish: cat.pref_publish ?? true,
          prefDeadline: cat.pref_deadline ?? true,
          prefApprovalDay: cat.pref_approval_day ?? true,
          prefExamMinus1d: cat.pref_exam_minus_1d ?? true,
          prefExamPlus1d: cat.pref_exam_plus_1d ?? true,
          prefExamDayMorning: cat.pref_exam_day_morning ?? true,
          prefExamDayMorningTime:
            cat.pref_exam_day_morning_time === undefined || cat.pref_exam_day_morning_time === null
              ? null
              : padHHmm(cat.pref_exam_day_morning_time),
        },
        { conflictPaths: ['userId', 'categorySlug'] },
      );
    }
    return this.getForUser(userId);
  }
}
