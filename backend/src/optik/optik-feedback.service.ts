import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptikOmrFeedback } from './entities/optik-omr-feedback.entity';
import { SubmitOmrFeedbackDto } from './dto/omr-feedback.dto';

@Injectable()
export class OptikFeedbackService {
  constructor(
    @InjectRepository(OptikOmrFeedback)
    private readonly repo: Repository<OptikOmrFeedback>,
  ) {}

  async submitFeedback(userId: string, dto: SubmitOmrFeedbackDto): Promise<{ saved: number }> {
    const rows = dto.corrections
      .filter((c) => c.detected_label !== c.corrected_label)
      .map((c) =>
        this.repo.create({
          templateId: dto.template_id,
          scanResultId: dto.scan_result_id ?? null,
          userId,
          question: c.question,
          detectedLabel: c.detected_label,
          correctedLabel: c.corrected_label,
          studentCode: dto.student_code ?? null,
        }),
      );
    if (rows.length === 0) return { saved: 0 };
    await this.repo.save(rows);
    return { saved: rows.length };
  }
}
