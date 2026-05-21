import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptikExamSession } from './entities/optik-exam-session.entity';
import { OptikScanResult } from './entities/optik-scan-result.entity';
import { CreateExamSessionDto, UpdateAnswerKeyDto, UpdateOpenQuestionsDto } from './dto/create-exam-session.dto';
import { UpdateQuestionOutcomesDto, UpdateSessionLinksDto } from './dto/update-session-links.dto';
import { CreateOptikScanResultDto } from './dto/create-scan-result.dto';
import {
  GradeSessionOpenDto,
  ManualOpenScoresDto,
} from './dto/grade-session-open.dto';
import { GradeRequestDto } from './dto/grade-request.dto';
import { OptikService } from './optik.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import {
  itemAnalysisFromScans,
  normalizeKeyRecord,
  scoreMcAnswers,
  studentAnswersToRecord,
} from './optik-scoring.util';
import { countAnswerKeyFilled, isAnswerKeyReady } from './optik-session-summary.util';
import { OptikReportPdfService } from './optik-report-pdf.service';
import type { OptikSessionPdfType } from './optik-report-pdf.types';

@Injectable()
export class OptikSessionsService {
  constructor(
    @InjectRepository(OptikExamSession)
    private readonly sessionRepo: Repository<OptikExamSession>,
    @InjectRepository(OptikScanResult)
    private readonly scanRepo: Repository<OptikScanResult>,
    private readonly optik: OptikService,
    private readonly reportPdf: OptikReportPdfService,
  ) {}

  private assertSessionAccess(session: OptikExamSession, userId: string, schoolId: string | null, role: string) {
    if (role === UserRole.school_admin && schoolId && session.schoolId === schoolId) return;
    if (session.userId === userId) return;
    throw new ForbiddenException('Bu oturuma erişim yetkiniz yok.');
  }

  async createSession(
    dto: CreateExamSessionDto,
    userId: string,
    schoolId: string | null,
  ): Promise<OptikExamSession> {
    const ent = this.sessionRepo.create({
      userId,
      schoolId,
      title: dto.title.trim(),
      templateId: dto.template_id,
      templateName: dto.template_name,
      examType: dto.exam_type ?? null,
      classId: dto.class_id ?? null,
      className: dto.class_name ?? null,
      subjectId: dto.subject_id ?? null,
      subjectName: dto.subject_name ?? null,
      questionCount: dto.question_count ?? 20,
      choiceCount: dto.choice_count ?? 5,
      answerKey: {},
      scoringMode: dto.scoring_mode ?? 'standard',
      status: 'active',
      openQuestions: [],
      examDate: dto.exam_date ?? null,
      butterflyPlanId: dto.butterfly_plan_id ?? null,
      outcomePlanKey: dto.outcome_plan_key ?? null,
      questionOutcomes: {},
    });
    return this.sessionRepo.save(ent);
  }

  async listSessions(
    userId: string,
    schoolId: string | null,
    role: string,
    butterflyPlanId?: string,
  ): Promise<
    Array<
      OptikExamSession & {
        mcScanCount: number;
        scanCount: number;
        keyFilledCount: number;
        keyReady: boolean;
      }
    >
  > {
    const baseWhere =
      role === UserRole.school_admin && schoolId
        ? { schoolId }
        : { userId };
    const where = butterflyPlanId
      ? { ...baseWhere, butterflyPlanId }
      : baseWhere;
    const rows = await this.sessionRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const raw = await this.scanRepo
      .createQueryBuilder('s')
      .select('s.sessionId', 'sessionId')
      .addSelect('s.kind', 'kind')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.sessionId IN (:...ids)', { ids })
      .groupBy('s.sessionId')
      .addGroupBy('s.kind')
      .getRawMany<{ sessionId: string; kind: string; cnt: string }>();

    const mcBySession = new Map<string, number>();
    const totalBySession = new Map<string, number>();
    for (const r of raw) {
      const c = parseInt(r.cnt, 10) || 0;
      totalBySession.set(r.sessionId, (totalBySession.get(r.sessionId) ?? 0) + c);
      if (r.kind === 'mc') mcBySession.set(r.sessionId, c);
    }

    return rows.map((s) => {
      const key = s.answerKey ?? {};
      return Object.assign(s, {
        mcScanCount: mcBySession.get(s.id) ?? 0,
        scanCount: totalBySession.get(s.id) ?? 0,
        keyFilledCount: countAnswerKeyFilled(key, s.questionCount),
        keyReady: isAnswerKeyReady(key, s.questionCount),
      });
    });
  }

  async findByButterflyPlan(
    planId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession[]> {
    const sessions = await this.listSessions(userId, schoolId, role, planId);
    return sessions;
  }

  async updateSessionLinks(
    id: string,
    dto: UpdateSessionLinksDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession> {
    const s = await this.getSession(id, userId, schoolId, role);
    if (dto.butterfly_plan_id !== undefined) {
      s.butterflyPlanId = dto.butterfly_plan_id || null;
    }
    if (dto.outcome_plan_key !== undefined) {
      s.outcomePlanKey = dto.outcome_plan_key || null;
    }
    return this.sessionRepo.save(s);
  }

  async updateQuestionOutcomes(
    id: string,
    dto: UpdateQuestionOutcomesDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession> {
    const s = await this.getSession(id, userId, schoolId, role);
    s.questionOutcomes = dto.question_outcomes;
    return this.sessionRepo.save(s);
  }

  async deleteSession(
    id: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<{ success: boolean }> {
    const s = await this.getSession(id, userId, schoolId, role);
    await this.scanRepo.delete({ sessionId: s.id });
    await this.sessionRepo.delete(s.id);
    return { success: true };
  }

  async updateSessionStatus(
    id: string,
    status: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession> {
    const s = await this.getSession(id, userId, schoolId, role);
    if (!['active', 'closed', 'archived'].includes(status)) {
      throw new BadRequestException('Geçersiz durum');
    }
    s.status = status;
    return this.sessionRepo.save(s);
  }

  async getOutcomeInsights(
    sessionId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ) {
    const report = await this.getSessionReport(sessionId, userId, schoolId, role);
    const outcomes = report.session.question_outcomes ?? {};
    const itemMap = new Map(report.item_analysis.map((i) => [i.question, i]));

    const weak_outcomes = Object.entries(outcomes)
      .map(([qStr, meta]) => {
        const q = Number(qStr);
        const item = itemMap.get(q);
        if (!item) return null;
        return {
          question: q,
          label: meta.label,
          konu: meta.konu ?? null,
          week_order: meta.week_order ?? null,
          correct_pct: item.correct_pct,
          top_wrong: item.top_wrong_choice,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.correct_pct - b.correct_pct);

    return {
      session_id: sessionId,
      outcome_plan_key: report.session.outcome_plan_key ?? null,
      butterfly_plan_id: report.session.butterfly_plan_id ?? null,
      weak_outcomes: weak_outcomes.slice(0, 15),
      unmapped_questions: report.item_analysis
        .filter((i) => !outcomes[String(i.question)])
        .map((i) => ({ question: i.question, correct_pct: i.correct_pct })),
    };
  }

  async getSession(id: string, userId: string, schoolId: string | null, role: string): Promise<OptikExamSession> {
    const s = await this.sessionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Sınav oturumu bulunamadı.');
    this.assertSessionAccess(s, userId, schoolId, role);
    return s;
  }

  async updateAnswerKey(
    id: string,
    dto: UpdateAnswerKeyDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession> {
    const s = await this.getSession(id, userId, schoolId, role);
    s.answerKey = dto.answer_key;
    if (dto.scoring_mode) s.scoringMode = dto.scoring_mode;
    return this.sessionRepo.save(s);
  }

  async updateOpenQuestions(
    id: string,
    dto: UpdateOpenQuestionsDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikExamSession> {
    const s = await this.getSession(id, userId, schoolId, role);
    s.openQuestions = dto.open_questions.map((q, i) => ({
      id: q.id || `oq${i + 1}`,
      title: q.title.trim(),
      max_score: q.max_score,
      mode: q.mode,
      key_text: q.key_text?.trim() || undefined,
    }));
    return this.sessionRepo.save(s);
  }

  private async upsertOpenScan(
    session: OptikExamSession,
    userId: string,
    schoolId: string | null,
    studentId: string,
    studentLabel: string | null,
    openGrades: Array<{ question_id: string; score: number; max_score: number }>,
    gradeMode: string | null,
  ): Promise<OptikScanResult> {
    const gradeScore = openGrades.reduce((a, g) => a + g.score, 0);
    const gradeMaxScore = openGrades.reduce((a, g) => a + g.max_score, 0);
    const dup = await this.scanRepo.findOne({
      where: { sessionId: session.id, studentId, kind: 'open' },
    });
    const payload = {
      userId,
      schoolId,
      sessionId: session.id,
      templateId: session.templateId,
      templateName: session.templateName,
      examType: session.examType,
      kind: 'open' as const,
      classId: session.classId,
      className: session.className,
      subjectId: session.subjectId,
      subjectName: session.subjectName,
      studentId,
      studentLabel,
      answers: [] as Array<{ question: number; label: string }>,
      answerCount: 0,
      ambiguousCount: 0,
      confidence: null,
      anchorScore: null,
      gradeScore,
      gradeMaxScore,
      gradeMode,
      correctCount: null,
      wrongCount: null,
      blankCount: null,
      netScore: null,
      openGrades,
    };
    if (dup) {
      await this.scanRepo.update(dup.id, payload);
      return (await this.scanRepo.findOne({ where: { id: dup.id } }))!;
    }
    return this.scanRepo.save(this.scanRepo.create(payload));
  }

  async gradeSessionOpen(
    sessionId: string,
    dto: GradeSessionOpenDto,
    user: User,
    schoolId: string | null,
    role: string,
  ) {
    const session = await this.getSession(sessionId, user.id, schoolId, role);
    if (!session.openQuestions.length) {
      throw new BadRequestException('Bu oturumda açık uçlu soru tanımlı değil.');
    }
    const qMap = new Map(session.openQuestions.map((q) => [q.id, q]));
    const requests: GradeRequestDto[] = [];
    for (const item of dto.items) {
      const def = qMap.get(item.question_id);
      if (!def) continue;
      const keyText =
        (def?.key_text?.trim() || '') ||
        (dto.key_text?.trim() || '') ||
        '';
      if (!keyText) continue;
      requests.push({
        template_id: session.templateId,
        question_id: item.question_id,
        mode: (item.mode ?? def?.mode ?? 'CONTENT') as GradeRequestDto['mode'],
        max_score: item.max_score ?? def?.max_score ?? 10,
        key_text: keyText,
        student_text: item.student_text,
        ocr_confidence: dto.ocr_confidence ?? 0.9,
        subject: session.subjectName ?? undefined,
      });
    }
    if (!requests.length) {
      throw new BadRequestException(
        'Açık uçlu puanlama için soru tanımında rubrik/anahtar metni (key_text) gerekli.',
      );
    }
    const { results } = await this.optik.gradeBatch(requests, user, schoolId, {
      userId: user.id,
      schoolId,
      role,
    });
    const openGrades = results.map((r) => ({
      question_id: r.question_id,
      score: r.score,
      max_score: r.max_score,
    }));
    const saved = await this.upsertOpenScan(
      session,
      user.id,
      schoolId,
      dto.student_id,
      dto.student_label ?? null,
      openGrades,
      requests[0]?.mode ?? null,
    );
    return { scan_id: saved.id, open_grades: openGrades, results, grade_score: saved.gradeScore, grade_max_score: saved.gradeMaxScore };
  }

  async saveManualOpenScores(
    sessionId: string,
    dto: ManualOpenScoresDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ) {
    const session = await this.getSession(sessionId, userId, schoolId, role);
    const openGrades = dto.grades.map((g) => ({
      question_id: g.question_id,
      score: Math.min(g.score, g.max_score),
      max_score: g.max_score,
    }));
    const saved = await this.upsertOpenScan(
      session,
      userId,
      schoolId,
      dto.student_id,
      dto.student_label ?? null,
      openGrades,
      'MANUAL',
    );
    return { scan_id: saved.id, open_grades: openGrades, grade_score: saved.gradeScore, grade_max_score: saved.gradeMaxScore };
  }

  async createSessionScan(
    sessionId: string,
    dto: CreateOptikScanResultDto,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<OptikScanResult & { scoring?: ReturnType<typeof scoreMcAnswers> }> {
    const session = await this.getSession(sessionId, userId, schoolId, role);
    if (dto.kind === 'mc' && session.classId && !dto.student_id) {
      throw new BadRequestException('Sınıf oturumunda öğrenci seçimi zorunludur.');
    }
    const answers = dto.answers ?? [];
    let correctCount: number | null = null;
    let wrongCount: number | null = null;
    let blankCount: number | null = null;
    let netScore: number | null = null;
    let scoring: ReturnType<typeof scoreMcAnswers> | undefined;

    const key = normalizeKeyRecord(session.answerKey, session.questionCount);
    const hasKey = Object.keys(key).length > 0;

    if (dto.kind === 'mc' && hasKey) {
      const student = studentAnswersToRecord(answers, session.questionCount);
      scoring = scoreMcAnswers(student, key, session.questionCount, session.scoringMode);
      correctCount = scoring.correct;
      wrongCount = scoring.wrong;
      blankCount = scoring.blank;
      netScore = scoring.net;
    }

    const dup = dto.student_id
      ? await this.scanRepo.findOne({
          where: { sessionId, studentId: dto.student_id, kind: dto.kind },
        })
      : null;

    const ent = this.scanRepo.create({
      userId,
      schoolId,
      sessionId,
      templateId: dto.template_id || session.templateId,
      templateName: dto.template_name || session.templateName,
      examType: dto.exam_type ?? session.examType,
      kind: dto.kind,
      classId: dto.class_id ?? session.classId,
      className: dto.class_name ?? session.className,
      subjectId: dto.subject_id ?? session.subjectId,
      subjectName: dto.subject_name ?? session.subjectName,
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
      correctCount: dto.correct_count ?? correctCount,
      wrongCount: dto.wrong_count ?? wrongCount,
      blankCount: dto.blank_count ?? blankCount,
      netScore: dto.net_score ?? netScore,
      openGrades: null,
    });

    if (dup) {
      await this.scanRepo.delete(dup.id);
    }

    const saved = await this.scanRepo.save(ent);
    return Object.assign(saved, { scoring });
  }

  async getSessionReport(
    sessionId: string,
    userId: string,
    schoolId: string | null,
    role: string,
    classStudentIds?: string[],
  ) {
    const session = await this.getSession(sessionId, userId, schoolId, role);
    const scans = await this.scanRepo.find({
      where: { sessionId },
      order: { scannedAt: 'ASC' },
    });

    const key = normalizeKeyRecord(session.answerKey, session.questionCount);
    const mcScans = scans.filter((s) => s.kind === 'mc');
    const nets = mcScans.filter((s) => s.netScore != null).map((s) => s.netScore as number);
    const avgNet =
      nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : null;

    const openScans = scans.filter((s) => s.kind === 'open');
    const mcStudentIds = new Set(mcScans.map((s) => s.studentId).filter(Boolean) as string[]);
    const openStudentIds = new Set(openScans.map((s) => s.studentId).filter(Boolean) as string[]);
    const hasMcKey = Object.keys(key).length > 0;
    const hasOpen = session.openQuestions.length > 0;
    const missing_students = (classStudentIds ?? []).filter((id) => {
      if (hasMcKey && !mcStudentIds.has(id)) return true;
      if (hasOpen && !openStudentIds.has(id)) return true;
      if (!hasMcKey && !hasOpen) return !mcStudentIds.has(id) && !openStudentIds.has(id);
      return false;
    });

    const matrix = mcScans.map((s) => ({
      scan_id: s.id,
      student_id: s.studentId,
      student_label: s.studentLabel,
      correct: s.correctCount,
      wrong: s.wrongCount,
      blank: s.blankCount,
      net: s.netScore,
      answers: s.answers,
      scanned_at: s.scannedAt.toISOString(),
    }));

    matrix.sort((a, b) => (b.net ?? 0) - (a.net ?? 0));

    const open_matrix = openScans.map((s) => ({
      scan_id: s.id,
      student_id: s.studentId,
      student_label: s.studentLabel,
      grade_score: s.gradeScore,
      grade_max_score: s.gradeMaxScore,
      open_grades: s.openGrades ?? [],
      scanned_at: s.scannedAt.toISOString(),
    }));

    const byStudent = new Map<string, { student_id: string | null; student_label: string | null }>();
    for (const s of scans) {
      if (!s.studentId) continue;
      byStudent.set(s.studentId, { student_id: s.studentId, student_label: s.studentLabel });
    }
    const combined_matrix = [...byStudent.values()].map(({ student_id, student_label }) => {
      const mc = mcScans.find((s) => s.studentId === student_id);
      const op = openScans.find((s) => s.studentId === student_id);
      const mcNet = mc?.netScore ?? null;
      const openScore = op?.gradeScore ?? null;
      const openMax = op?.gradeMaxScore ?? null;
      const openPct =
        openScore != null && openMax && openMax > 0
          ? Math.round((openScore / openMax) * 100)
          : null;
      return {
        student_id,
        student_label,
        correct: mc?.correctCount ?? null,
        wrong: mc?.wrongCount ?? null,
        blank: mc?.blankCount ?? null,
        net: mcNet,
        answers: mc?.answers ?? [],
        open_score: openScore,
        open_max: openMax,
        open_pct: openPct,
        open_grades: op?.openGrades ?? [],
      };
    });
    combined_matrix.sort((a, b) => (b.net ?? 0) - (a.net ?? 0));

    const item_analysis =
      Object.keys(key).length > 0
        ? itemAnalysisFromScans(mcScans, key, session.questionCount)
        : [];

    const hardest = [...item_analysis].sort((a, b) => a.correct_pct - b.correct_pct).slice(0, 5);

    return {
      session: {
        id: session.id,
        title: session.title,
        template_name: session.templateName,
        class_name: session.className,
        subject_name: session.subjectName,
        question_count: session.questionCount,
        choice_count: session.choiceCount,
        scoring_mode: session.scoringMode,
        answer_key: session.answerKey,
        status: session.status,
        exam_date: session.examDate,
        open_questions: session.openQuestions,
        butterfly_plan_id: session.butterflyPlanId,
        outcome_plan_key: session.outcomePlanKey,
        question_outcomes: session.questionOutcomes ?? {},
      },
      summary: {
        scanned_count: scans.length,
        mc_count: mcScans.length,
        open_count: openScans.length,
        avg_net: avgNet,
        max_net: session.questionCount,
        missing_count: missing_students.length,
      },
      matrix,
      open_matrix,
      combined_matrix,
      item_analysis,
      hardest_questions: hardest,
      missing_student_ids: missing_students,
      scans: scans.map((s) => ({
        id: s.id,
        student_id: s.studentId,
        student_label: s.studentLabel,
        kind: s.kind,
        net: s.netScore,
        grade_score: s.gradeScore,
        grade_max_score: s.gradeMaxScore,
        open_grades: s.openGrades,
        scanned_at: s.scannedAt.toISOString(),
      })),
    };
  }

  async exportSessionCsv(
    sessionId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<string> {
    const report = await this.getSessionReport(sessionId, userId, schoolId, role);
    const hasOpen = (report.session.open_questions?.length ?? 0) > 0;
    const lines: string[] = [
      'Öğrenci No/Ad',
      'Doğru',
      'Yanlış',
      'Boş',
      'Net',
      ...Array.from({ length: report.session.question_count }, (_, i) => `S${i + 1}`),
      ...(hasOpen ? ['Açık Puan', 'Açık Max'] : []),
    ];
    const rows: string[] = [lines.join('\t')];

    const exportRows = report.combined_matrix?.length ? report.combined_matrix : report.matrix;
    for (const m of exportRows) {
      const cols = [
        m.student_label ?? '',
        String(m.correct ?? ''),
        String(m.wrong ?? ''),
        String(m.blank ?? ''),
        String(m.net ?? ''),
      ];
      for (let q = 1; q <= report.session.question_count; q++) {
        const a = (m.answers ?? []).find((x) => x.question === q);
        cols.push(a?.label ?? '');
      }
      if (hasOpen) {
        cols.push(String('open_score' in m ? (m.open_score ?? '') : ''));
        cols.push(String('open_max' in m ? (m.open_max ?? '') : ''));
      }
      rows.push(cols.join('\t'));
    }
    return rows.join('\n');
  }

  async exportEokulCsv(
    sessionId: string,
    userId: string,
    schoolId: string | null,
    role: string,
  ): Promise<string> {
    const report = await this.getSessionReport(sessionId, userId, schoolId, role);
    const rows = ['OgrenciNo;AdSoyad;Puan;Aciklama'];
    for (const m of report.matrix) {
      const net = m.net ?? 0;
      const max = report.session.question_count;
      const pct = max > 0 ? Math.round((net / max) * 100) : 0;
      rows.push(`${m.student_label ?? ''};${m.student_label ?? ''};${pct};Optik net ${net}/${max}`);
    }
    return rows.join('\n');
  }

  async exportSessionPdf(
    sessionId: string,
    type: OptikSessionPdfType,
    userId: string,
    schoolId: string | null,
    role: string,
    studentId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const allowed: OptikSessionPdfType[] = [
      'class_list',
      'summary',
      'item_analysis',
      'outcome',
      'student',
    ];
    if (!allowed.includes(type)) {
      throw new BadRequestException('Geçersiz PDF türü');
    }
    if (type === 'student' && !studentId) {
      throw new BadRequestException('student_id gerekli');
    }

    const report = await this.getSessionReport(sessionId, userId, schoolId, role);
    if (type === 'student') {
      const inCombined = report.combined_matrix.some((m) => m.student_id === studentId);
      const inMatrix = report.matrix.some((m) => m.student_id === studentId);
      if (!inCombined && !inMatrix) {
        throw new NotFoundException('Öğrenci bulunamadı');
      }
    }

    const insights =
      type === 'outcome'
        ? await this.getOutcomeInsights(sessionId, userId, schoolId, role)
        : null;

    const branding = await this.reportPdf.resolveBranding(schoolId);
    const buffer = await this.reportPdf.buildSession(type, report, insights, branding, studentId);
    const filename = this.reportPdf.sessionFilename(type, report.session.title, studentId, report);
    return { buffer, filename };
  }
}
