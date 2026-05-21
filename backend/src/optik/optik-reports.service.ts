import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptikScanResult } from './entities/optik-scan-result.entity';
import { CreateOptikScanResultDto } from './dto/create-scan-result.dto';
import { UserRole } from '../types/enums';
import { OptikReportPdfService } from './optik-report-pdf.service';
import type { PeriodReportForPdf } from './optik-report-pdf.types';

export type OptikReportQuery = {
  from?: string;
  to?: string;
  class_id?: string;
  subject_id?: string;
  template_id?: string;
  exam_type?: string;
  kind?: string;
  session_id?: string;
};

@Injectable()
export class OptikReportsService {
  constructor(
    @InjectRepository(OptikScanResult)
    private readonly scanRepo: Repository<OptikScanResult>,
    private readonly reportPdf: OptikReportPdfService,
  ) {}

  private scopeWhere(
    userId: string,
    schoolId: string | null,
    role: string,
  ): { userId?: string; schoolId?: string } {
    if (role === UserRole.school_admin && schoolId) {
      return { schoolId };
    }
    if (role === UserRole.teacher) {
      return { userId };
    }
    throw new ForbiddenException('Rapor için yetkiniz yok.');
  }

  private parseRange(from?: string, to?: string): { start?: Date; end?: Date } {
    const start = from ? new Date(from) : undefined;
    const end = to ? new Date(to) : undefined;
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async createScanResult(
    dto: CreateOptikScanResultDto,
    userId: string,
    schoolId: string | null,
  ): Promise<OptikScanResult> {
    const answers = dto.answers ?? [];
    const ent = this.scanRepo.create({
      userId,
      schoolId,
      templateId: dto.template_id,
      templateName: dto.template_name,
      examType: dto.exam_type ?? null,
      kind: dto.kind,
      classId: dto.class_id ?? null,
      className: dto.class_name ?? null,
      subjectId: dto.subject_id ?? null,
      subjectName: dto.subject_name ?? null,
      sessionId: dto.session_id ?? null,
      studentId: dto.student_id ?? null,
      studentLabel: dto.student_label ?? null,
      answers,
      answerCount: answers.length,
      ambiguousCount: dto.ambiguous_count ?? 0,
      confidence: dto.confidence ?? null,
      anchorScore: dto.anchor_score ?? null,
      gradeScore: dto.grade_score ?? null,
      gradeMaxScore: dto.grade_max_score ?? null,
      gradeMode: dto.grade_mode ?? null,
      correctCount: dto.correct_count ?? null,
      wrongCount: dto.wrong_count ?? null,
      blankCount: dto.blank_count ?? null,
      netScore: dto.net_score ?? null,
      openGrades: dto.open_grades ?? null,
    });
    return this.scanRepo.save(ent);
  }

  private async fetchFiltered(
    userId: string,
    schoolId: string | null,
    role: string,
    q: OptikReportQuery,
  ): Promise<OptikScanResult[]> {
    const scope = this.scopeWhere(userId, schoolId, role);
    const { start, end } = this.parseRange(q.from, q.to);
    const qb = this.scanRepo.createQueryBuilder('s').orderBy('s.scanned_at', 'DESC');

    if (scope.schoolId) qb.andWhere('s.school_id = :schoolId', { schoolId: scope.schoolId });
    if (scope.userId) qb.andWhere('s.user_id = :userId', { userId: scope.userId });

    if (start && end) qb.andWhere('s.scanned_at BETWEEN :start AND :end', { start, end });
    else if (start) qb.andWhere('s.scanned_at >= :start', { start });
    else if (end) qb.andWhere('s.scanned_at <= :end', { end });

    if (q.class_id) qb.andWhere('s.class_id = :classId', { classId: q.class_id });
    if (q.subject_id) qb.andWhere('s.subject_id = :subjectId', { subjectId: q.subject_id });
    if (q.template_id) qb.andWhere('s.template_id = :templateId', { templateId: q.template_id });
    if (q.exam_type) qb.andWhere('s.exam_type = :examType', { examType: q.exam_type });
    if (q.kind) qb.andWhere('s.kind = :kind', { kind: q.kind });
    if (q.session_id) qb.andWhere('s.session_id = :sessionId', { sessionId: q.session_id });

    return qb.getMany();
  }

  async getFullReport(
    userId: string,
    schoolId: string | null,
    role: string,
    q: OptikReportQuery,
  ) {
    const rows = await this.fetchFiltered(userId, schoolId, role, q);

    const mcRows = rows.filter((r) => r.kind === 'mc');
    const openRows = rows.filter((r) => r.kind === 'open');

    const summary = {
      total_scans: rows.length,
      mc_scans: mcRows.length,
      open_scans: openRows.length,
      total_answers: mcRows.reduce((s, r) => s + r.answerCount, 0),
      avg_confidence:
        mcRows.length > 0
          ? Math.round(
              (mcRows.reduce((s, r) => s + (r.confidence ?? 0), 0) / mcRows.length) * 100,
            ) / 100
          : null,
      ambiguous_total: mcRows.reduce((s, r) => s + r.ambiguousCount, 0),
      ambiguous_rate:
        mcRows.length > 0
          ? Math.round(
              (mcRows.reduce((s, r) => s + r.ambiguousCount, 0) /
                Math.max(1, mcRows.reduce((s, r) => s + r.answerCount, 0))) *
                1000,
            ) / 1000
          : null,
      avg_grade_pct:
        openRows.filter((r) => r.gradeMaxScore && r.gradeMaxScore > 0).length > 0
          ? Math.round(
              (openRows
                .filter((r) => r.gradeMaxScore && r.gradeMaxScore > 0)
                .reduce((s, r) => s + ((r.gradeScore ?? 0) / (r.gradeMaxScore ?? 1)) * 100, 0) /
                openRows.filter((r) => r.gradeMaxScore && r.gradeMaxScore > 0).length) *
                10,
            ) / 10
          : null,
      avg_net:
        mcRows.filter((r) => r.netScore != null).length > 0
          ? Math.round(
              (mcRows
                .filter((r) => r.netScore != null)
                .reduce((s, r) => s + (r.netScore as number), 0) /
                mcRows.filter((r) => r.netScore != null).length) *
                100,
            ) / 100
          : null,
      mc_with_net: mcRows.filter((r) => r.netScore != null).length,
    };

    const byClassMap = new Map<
      string,
      { class_id: string | null; class_name: string; scans: number; answers: number; ambiguous: number }
    >();
    for (const r of rows) {
      const key = r.classId ?? '__none__';
      const name = r.className?.trim() || 'Sınıf belirtilmedi';
      if (!byClassMap.has(key)) {
        byClassMap.set(key, {
          class_id: r.classId,
          class_name: name,
          scans: 0,
          answers: 0,
          ambiguous: 0,
        });
      }
      const v = byClassMap.get(key)!;
      v.scans += 1;
      v.answers += r.answerCount;
      v.ambiguous += r.ambiguousCount;
    }
    const by_class = [...byClassMap.values()]
      .map((c) => ({
        ...c,
        ambiguous_rate: c.answers > 0 ? Math.round((c.ambiguous / c.answers) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.scans - a.scans);

    const bySubjectMap = new Map<
      string,
      { subject_id: string | null; subject_name: string; scans: number; answers: number }
    >();
    for (const r of rows) {
      const key = r.subjectId ?? '__none__';
      const name = r.subjectName?.trim() || 'Ders belirtilmedi';
      if (!bySubjectMap.has(key)) {
        bySubjectMap.set(key, { subject_id: r.subjectId, subject_name: name, scans: 0, answers: 0 });
      }
      const v = bySubjectMap.get(key)!;
      v.scans += 1;
      v.answers += r.answerCount;
    }
    const by_subject = [...bySubjectMap.values()].sort((a, b) => b.scans - a.scans);

    const byTemplateMap = new Map<
      string,
      {
        template_id: string;
        template_name: string;
        exam_type: string | null;
        scans: number;
        kind_mc: number;
        kind_open: number;
      }
    >();
    for (const r of rows) {
      if (!byTemplateMap.has(r.templateId)) {
        byTemplateMap.set(r.templateId, {
          template_id: r.templateId,
          template_name: r.templateName,
          exam_type: r.examType,
          scans: 0,
          kind_mc: 0,
          kind_open: 0,
        });
      }
      const v = byTemplateMap.get(r.templateId)!;
      v.scans += 1;
      if (r.kind === 'mc') v.kind_mc += 1;
      else v.kind_open += 1;
    }
    const by_template = [...byTemplateMap.values()].sort((a, b) => b.scans - a.scans);

    const byDayMap = new Map<string, { date: string; scans: number; mc: number; open: number }>();
    for (const r of rows) {
      const d = r.scannedAt.toISOString().slice(0, 10);
      if (!byDayMap.has(d)) byDayMap.set(d, { date: d, scans: 0, mc: 0, open: 0 });
      const v = byDayMap.get(d)!;
      v.scans += 1;
      if (r.kind === 'mc') v.mc += 1;
      else v.open += 1;
    }
    const by_day = [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const choiceMap = new Map<number, Map<string, number>>();
    for (const r of mcRows) {
      for (const a of r.answers ?? []) {
        const q = a.question;
        if (!choiceMap.has(q)) choiceMap.set(q, new Map());
        const cm = choiceMap.get(q)!;
        const lbl = (a.label || '').toUpperCase() || '?';
        cm.set(lbl, (cm.get(lbl) ?? 0) + 1);
      }
    }
    const choice_distribution = [...choiceMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([question, m]) => ({
        question,
        total: [...m.values()].reduce((s, n) => s + n, 0),
        choices: Object.fromEntries([...m.entries()].sort(([a], [b]) => a.localeCompare(b))),
      }));

    const recent = rows.slice(0, 50).map((r) => ({
      id: r.id,
      scanned_at: r.scannedAt.toISOString(),
      kind: r.kind,
      template_name: r.templateName,
      class_name: r.className,
      subject_name: r.subjectName,
      student_label: r.studentLabel,
      answer_count: r.answerCount,
      ambiguous_count: r.ambiguousCount,
      confidence: r.confidence,
      grade_score: r.gradeScore,
      grade_max_score: r.gradeMaxScore,
      net_score: r.netScore,
      correct_count: r.correctCount,
      wrong_count: r.wrongCount,
      blank_count: r.blankCount,
      student_id: r.studentId,
      session_id: r.sessionId,
    }));

    return {
      summary,
      by_class,
      by_subject,
      by_template,
      by_day,
      choice_distribution,
      recent,
    };
  }

  async listScanDetails(
    userId: string,
    schoolId: string | null,
    role: string,
    q: OptikReportQuery & { limit?: number; offset?: number },
  ) {
    const rows = await this.fetchFiltered(userId, schoolId, role, q);
    const limit = Math.min(100, Math.max(1, q.limit ?? 30));
    const offset = Math.max(0, q.offset ?? 0);
    const slice = rows.slice(offset, offset + limit);
    return {
      total: rows.length,
      items: slice.map((r) => ({
        id: r.id,
        scanned_at: r.scannedAt.toISOString(),
        kind: r.kind,
        template_id: r.templateId,
        template_name: r.templateName,
        exam_type: r.examType,
        class_id: r.classId,
        class_name: r.className,
        subject_id: r.subjectId,
        subject_name: r.subjectName,
        student_label: r.studentLabel,
        answers: r.answers,
        answer_count: r.answerCount,
        ambiguous_count: r.ambiguousCount,
        confidence: r.confidence,
        anchor_score: r.anchorScore,
        grade_score: r.gradeScore,
        grade_max_score: r.gradeMaxScore,
        grade_mode: r.gradeMode,
      })),
    };
  }

  async exportPeriodPdf(
    userId: string,
    schoolId: string | null,
    role: string,
    q: OptikReportQuery,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.getFullReport(userId, schoolId, role, q);
    const branding = await this.reportPdf.resolveBranding(schoolId);
    const buffer = await this.reportPdf.buildPeriod(
      data as PeriodReportForPdf,
      branding,
      q.from,
      q.to,
    );
    return {
      buffer,
      filename: this.reportPdf.periodFilename(q.from, q.to),
    };
  }

  async deleteScanResult(id: string, userId: string, schoolId: string | null, role: string) {
    const row = await this.scanRepo.findOne({ where: { id } });
    if (!row) return { success: true };
    if (role === UserRole.teacher && row.userId !== userId) {
      throw new ForbiddenException('Bu kaydı silemezsiniz.');
    }
    if (role === UserRole.school_admin && schoolId && row.schoolId !== schoolId) {
      throw new ForbiddenException('Bu kaydı silemezsiniz.');
    }
    await this.scanRepo.delete(id);
    return { success: true };
  }
}
