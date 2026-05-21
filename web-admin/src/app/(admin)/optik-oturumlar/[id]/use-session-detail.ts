'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { optikToast } from '@/lib/optik-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  ensureOptikScanLayout,
  fetchOptikStatus,
  postOptikOcr,
  type OptikStatus,
} from '@/lib/optik-api';
import { compressImageBase64ForOcr } from '@/lib/optik-image-prep';
import {
  clearAllOptikLayoutCache,
  getCachedScanLayout,
  loadCachedScanLayout,
  setCachedScanLayout,
} from '@/lib/optik-layout-cache';
import { preloadOptikOpenCv } from '@/lib/optik-omr-decode';
import { buildMcScanReview, type McScanReviewPayload } from '@/lib/optik-mc-scan-review';
import {
  answerKeyFilledCount,
  mergeAnswerKeys,
  omrRecordToAnswerKey,
  parseAnswerKeyText,
} from '@/lib/optik-answer-key-parse';
import { answerKeyToNumberMap } from '@/lib/optik-omr-overlay';
import type { OptikCameraOverlayConfig } from '@/app/(admin)/optik-okuma/components/OptikCameraCapture';
import {
  enqueueOfflineScan,
  flushOfflineQueue,
  listOfflineScans,
} from '@/lib/optik-offline-queue';
import {
  deleteExamSession,
  downloadSessionExport,
  downloadSessionPdf,
  type OptikSessionPdfType,
  fetchExamSession,
  patchSessionStatus,
  fetchOutcomeInsights,
  fetchSessionReport,
  patchExamAnswerKey,
  patchOpenQuestions,
  patchQuestionOutcomes,
  patchSessionLinks,
  postGradeSessionOpen,
  postManualOpenScores,
  postSessionScan,
  type ExamSession,
  type OpenQuestionDef,
  type OutcomeInsights,
  type QuestionOutcomeMeta,
  type SessionReport,
  type SessionScanPayload,
} from '@/lib/optik-sessions-api';
import {
  manualScoresFromOpenGrades,
  pickActiveStudentId,
  reportStudentIdsForClass,
} from '@/lib/optik-session-report-load';

type ClassStudent = { id: string; name: string };

export function useSessionDetail() {
  const { token, role, me } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = String(params?.id ?? '');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [status, setStatus] = useState<OptikStatus | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'key' | 'scan' | 'open' | 'links' | 'results'>('key');
  const [outcomeInsights, setOutcomeInsights] = useState<OutcomeInsights | null>(null);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestionDef[]>([]);
  const [savingOpen, setSavingOpen] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [manualScores, setManualScores] = useState<Record<string, { score: number; max: number }>>({});
  const [ocrQuestionId, setOcrQuestionId] = useState<string | null>(null);
  const [openKeyOcrQuestionId, setOpenKeyOcrQuestionId] = useState<string | null>(null);
  const [cameraPurpose, setCameraPurpose] = useState<
    'mc_student' | 'mc_key' | 'mc_key_ocr' | 'open_student' | 'open_key'
  >('mc_student');
  const [answerKey, setAnswerKey] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentStudentId, setCurrentStudentId] = useState('');
  const [mcAnswers, setMcAnswers] = useState<Record<number, string>>({});
  const [mcAmbiguous, setMcAmbiguous] = useState<number[]>([]);
  const [mcReview, setMcReview] = useState<McScanReviewPayload | null>(null);
  const [mcReviewPurpose, setMcReviewPurpose] = useState<'student' | 'key'>('student');
  const [lastScore, setLastScore] = useState<{ correct: number; wrong: number; blank: number; net: number } | null>(
    null,
  );
  const [offlineCount, setOfflineCount] = useState(0);
  const [batchMode, setBatchMode] = useState(false);
  const studentsRef = useRef<ClassStudent[]>([]);

  const layoutCache = useMemo(
    () => ({
      get: (id: string) => getCachedScanLayout(id) ?? loadCachedScanLayout(id),
      set: setCachedScanLayout,
    }),
    [],
  );

  const scannedIds = useMemo(
    () => new Set((report?.matrix ?? []).map((m) => m.student_id).filter(Boolean)),
    [report],
  );

  const nextStudent = useMemo(() => {
    if (!batchMode) return null;
    return students.find((s) => !scannedIds.has(s.id)) ?? null;
  }, [batchMode, students, scannedIds]);

  const mcScannedCount = useMemo(
    () => students.filter((s) => scannedIds.has(s.id)).length,
    [students, scannedIds],
  );

  const batchProgressPct = useMemo(() => {
    if (!students.length) return 0;
    return Math.round((mcScannedCount / students.length) * 100);
  }, [students.length, mcScannedCount]);

  const refreshOffline = useCallback(() => {
    setOfflineCount(listOfflineScans(sessionId).length);
  }, [sessionId]);

  const loadInsights = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const ins = await fetchOutcomeInsights(token, sessionId);
      setOutcomeInsights(ins);
    } catch {
      setOutcomeInsights(null);
    }
  }, [token, sessionId]);

  const loadReport = useCallback(
    async (studentIdsOverride?: string[]): Promise<SessionReport | null> => {
      if (!token || !sessionId) return null;
      const ids =
        studentIdsOverride !== undefined
          ? studentIdsOverride
          : studentsRef.current.map((s) => s.id);
      const rep = await fetchSessionReport(
        token,
        sessionId,
        ids.length ? ids : undefined,
      );
      setReport(rep);
      return rep;
    },
    [token, sessionId],
  );

  const load = useCallback(async () => {
    if (!token || !sessionId) return;
    setLoading(true);
    setStudents([]);
    studentsRef.current = [];
    setReport(null);
    try {
      const preferStudent = searchParams.get('student') ?? undefined;
      const [sess, st] = await Promise.all([
        fetchExamSession(token, sessionId),
        fetchOptikStatus(token).catch(() => null),
      ]);
      setSession(sess);
      setStatus(st);
      setAnswerKey(sess.answerKey ?? {});
      setOpenQuestions(sess.openQuestions ?? []);
      const manual: Record<string, { score: number; max: number }> = {};
      for (const q of sess.openQuestions ?? []) {
        manual[q.id] = { score: 0, max: q.max_score };
      }
      setManualScores(manual);

      let list: ClassStudent[] = [];
      if (sess.classId) {
        list = await apiFetch<ClassStudent[]>(
          `/classes-subjects/classes/${sess.classId}/students`,
          { token },
        ).catch(() => []);
      }
      setStudents(list);
      studentsRef.current = list;

      const activeStudentId = pickActiveStudentId(list, preferStudent);
      if (activeStudentId) setCurrentStudentId(activeStudentId);

      const reportStudentIds = reportStudentIdsForClass(sess.classId, list) ?? [];
      const rep = await loadReport(reportStudentIds);

      if (rep?.open_matrix?.length && activeStudentId) {
        const row = rep.open_matrix.find((m) => m.student_id === activeStudentId);
        if (row?.open_grades?.length) {
          setManualScores(manualScoresFromOpenGrades(manual, row.open_grades));
        }
      }

      void loadInsights();
      refreshOffline();
    } catch (e) {
      optikToast.error(e, 'load');
    } finally {
      setLoading(false);
    }
  }, [token, sessionId, loadReport, loadInsights, refreshOffline, searchParams]);

  useEffect(() => {
    clearAllOptikLayoutCache();
    void load();
  }, [load]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'key' || t === 'scan' || t === 'open' || t === 'links' || t === 'results') {
      setTab(t);
    }
    const sid = searchParams.get('student');
    if (sid) setCurrentStudentId(sid);
  }, [searchParams]);

  const goToMcScan = useCallback(
    (studentId: string, opts?: { batch?: boolean }) => {
      setCurrentStudentId(studentId);
      if (opts?.batch) setBatchMode(true);
      setTab('scan');
      const q = new URLSearchParams();
      q.set('tab', 'scan');
      q.set('student', studentId);
      router.replace(`/optik-oturumlar/${sessionId}?${q.toString()}`, { scroll: false });
    },
    [router, sessionId],
  );

  const missingStudentIds = report?.missing_student_ids ?? [];

  const startBatchMissing = useCallback(() => {
    const first = students.find((s) => missingStudentIds.includes(s.id));
    if (!first) {
      optikToast.info('Eksik yok', 'Tüm öğrenciler taranmış');
      return;
    }
    goToMcScan(first.id, { batch: true });
  }, [students, missingStudentIds, goToMcScan]);

  useEffect(() => {
    if (batchMode && nextStudent) setCurrentStudentId(nextStudent.id);
  }, [batchMode, nextStudent]);

  useEffect(() => {
    if (!session?.openQuestions?.length) return;
    const defaults: Record<string, { score: number; max: number }> = {};
    for (const q of session.openQuestions) {
      defaults[q.id] = { score: 0, max: q.max_score };
    }
    if (!currentStudentId || !report?.open_matrix?.length) {
      setManualScores(defaults);
      return;
    }
    const row = report.open_matrix.find((m) => m.student_id === currentStudentId);
    if (row?.open_grades?.length) {
      setManualScores(manualScoresFromOpenGrades(defaults, row.open_grades));
    } else {
      setManualScores(defaults);
    }
  }, [currentStudentId, report?.open_matrix, session?.openQuestions]);

  const saveAnswerKey = useCallback(async () => {
    if (!token || !sessionId) return;
    setSavingKey(true);
    try {
      const updated = await patchExamAnswerKey(token, sessionId, answerKey, session?.scoringMode);
      setSession(updated);
      setAnswerKey(updated.answerKey ?? {});
      optikToast.success('Anahtar kaydedildi');
      await loadReport();
    } catch (e) {
      optikToast.error(e, 'key');
    } finally {
      setSavingKey(false);
    }
  }, [token, sessionId, answerKey, session?.scoringMode, loadReport]);

  const submitScan = useCallback(
    async (payload: SessionScanPayload) => {
      if (!token) return;
      try {
        const res = await postSessionScan(token, sessionId, payload);
        if (res.scoring) setLastScore(res.scoring);
        else if (res.netScore != null) {
          setLastScore({
            correct: res.correctCount ?? 0,
            wrong: res.wrongCount ?? 0,
            blank: res.blankCount ?? 0,
            net: res.netScore,
          });
        }
        optikToast.success(
          'Kaydedildi',
          res.scoring
            ? `Net ${res.scoring.net} · D${res.scoring.correct} Y${res.scoring.wrong}`
            : undefined,
        );
        setMcAnswers({});
        setMcAmbiguous([]);
        const rep = await loadReport();
        if (batchMode && rep && students.length) {
          const done = new Set(rep.matrix.map((m) => m.student_id).filter(Boolean) as string[]);
          const next = students.find((s) => !done.has(s.id));
          if (next) setCurrentStudentId(next.id);
        }
      } catch (e) {
        const offline = !navigator.onLine;
        const retryable =
          offline ||
          (e instanceof Error &&
            /failed|fetch|network|bağlantı|connection/i.test(e.message));
        if (retryable) {
          enqueueOfflineScan(sessionId, payload);
          refreshOffline();
          optikToast.offlineQueued();
        } else {
          optikToast.error(e, 'save');
        }
      }
    },
    [token, sessionId, loadReport, batchMode, students, refreshOffline],
  );

  const applyAnswerKey = useCallback((patch: Record<string, string>, replace = false) => {
    setAnswerKey((prev) => (replace ? patch : mergeAnswerKeys(prev, patch)));
  }, []);

  const commitMcKeyReview = useCallback(
    (review: McScanReviewPayload) => {
      if (!session) return;
      const patch = omrRecordToAnswerKey(review.decoded.answers, session.questionCount);
      const n = Object.keys(patch).length;
      if (n === 0) {
        optikToast.warn('Anahtar boş', 'En az bir şık seçin');
        return;
      }
      applyAnswerKey(patch, false);
      setMcReview(null);
      if (review.decoded.needs_rescan) optikToast.rescan('mc', `${review.ambiguous.length} belirsiz`);
      else optikToast.success('Anahtar kaydedildi', `${n} şık`);
    },
    [session, applyAnswerKey],
  );

  const commitMcStudentReview = useCallback(
    async (review: McScanReviewPayload) => {
      if (!token || !session) return;
      if (students.length > 0 && !currentStudentId) {
        optikToast.validation('Öğrenci seçin');
        return;
      }
      setBusy(true);
      try {
        const map = review.decoded.answers;
        setMcAnswers(map);
        setMcAmbiguous(review.ambiguous);
        setMcReview(null);

        const student = students.find((s) => s.id === currentStudentId);
        const answerRows = Object.entries(map)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([q, label]) => ({ question: Number(q), label }));

        const payload: SessionScanPayload = {
          template_id: session.templateId,
          template_name: session.templateName,
          kind: 'mc',
          student_id: currentStudentId || undefined,
          student_label: student?.name ?? undefined,
          answers: answerRows,
          ambiguous_count: review.ambiguous.length,
          confidence: review.decoded.confidence,
          anchor_score: review.decoded.anchor_score,
        };

        if (navigator.onLine) await submitScan(payload);
        else {
          enqueueOfflineScan(sessionId, payload);
          refreshOffline();
          optikToast.offlineQueued();
        }
        optikToast.success('Tarama kaydedildi', `${answerRows.length} soru`);
      } catch (e) {
        optikToast.error(e, 'save');
      } finally {
        setBusy(false);
      }
    },
    [token, session, students, currentStudentId, submitScan, sessionId, refreshOffline],
  );

  const runMcKeyScan = useCallback(
    async (frames: string | string[]) => {
      if (!token || !session) return;
      const arr = Array.isArray(frames) ? frames : [frames];
      setBusy(true);
      try {
        const layout = await ensureOptikScanLayout(token, session.templateId, layoutCache);
        const review = await buildMcScanReview(
          arr,
          layout,
          {
            maxQuestion: session.questionCount,
            choiceCount: session.choiceCount,
            mode: 'key',
          },
        );
        setCameraOpen(false);
        setMcReviewPurpose('key');
        setMcReview(review);
      } catch (e) {
        optikToast.error(e, 'scan');
      } finally {
        setBusy(false);
      }
    },
    [token, session, layoutCache],
  );

  const runMcKeyOcr = useCallback(
    async (b64: string | string[]) => {
      if (!token) return;
      const raw = Array.isArray(b64) ? b64[0]! : b64;
      setBusy(true);
      try {
        const compressed = await compressImageBase64ForOcr(raw);
        const res = await postOptikOcr(token, compressed, { kind: 'KEY' });
        const patch = parseAnswerKeyText(res.text, session?.questionCount ?? 20);
        const n = Object.keys(patch).length;
        if (n === 0) {
          optikToast.warn('Anahtar okunamadı', 'Yapıştır veya optik tara deneyin');
          return;
        }
        applyAnswerKey(patch, false);
        setCameraOpen(false);
        optikToast.success('OCR anahtar', `${n} soru`);
      } catch (e) {
        optikToast.error(e, 'ocr');
      } finally {
        setBusy(false);
      }
    },
    [token, session?.questionCount, applyAnswerKey],
  );

  const runMcDecode = useCallback(
    async (frames: string | string[]) => {
      if (!token || !session) return;
      if (students.length > 0 && !currentStudentId) {
        optikToast.validation('Öğrenci seçin');
        return;
      }
      const arr = Array.isArray(frames) ? frames : [frames];
      setBusy(true);
      try {
        const layout = await ensureOptikScanLayout(token, session.templateId, layoutCache);
        const review = await buildMcScanReview(
          arr,
          layout,
          {
            maxQuestion: session.questionCount,
            choiceCount: session.choiceCount,
            mode: 'student',
          },
          answerKey,
        );
        setCameraOpen(false);
        setMcReviewPurpose('student');
        setMcReview(review);
      } catch (e) {
        optikToast.error(e, 'scan');
      } finally {
        setBusy(false);
      }
    },
    [token, session, layoutCache, students, currentStudentId, answerKey],
  );

  const retryMcScan = useCallback(() => {
    setMcReview(null);
    setCameraOpen(true);
  }, []);

  const syncOffline = useCallback(async () => {
    if (!token) return;
    const { ok, fail } = await flushOfflineQueue(token, (sid, body) => postSessionScan(token, sid, body));
    refreshOffline();
    if (ok) optikToast.success('Senkron', `${ok} tarama`);
    if (fail) optikToast.errorMsg('Senkron hatası', `${fail} tarama gönderilemedi`);
    await loadReport();
  }, [token, refreshOffline, loadReport]);

  const setKeyCell = useCallback((q: number, label: string) => {
    setAnswerKey((prev) => {
      const next = { ...prev };
      if (label) next[String(q)] = label;
      else delete next[String(q)];
      return next;
    });
  }, []);

  const saveSessionLinks = useCallback(
    async (butterflyPlanId: string | null, outcomePlanKey: string | null) => {
      if (!token) return;
      try {
        const updated = await patchSessionLinks(token, sessionId, {
          butterfly_plan_id: butterflyPlanId,
          outcome_plan_key: outcomePlanKey,
        });
        setSession(updated);
        optikToast.success('Bağlantılar kaydedildi');
      } catch (e) {
        optikToast.error(e, 'save');
      }
    },
    [token, sessionId],
  );

  const saveQuestionOutcomes = useCallback(
    async (q: Record<string, QuestionOutcomeMeta>) => {
      if (!token) return;
      try {
        const updated = await patchQuestionOutcomes(token, sessionId, q);
        setSession(updated);
        optikToast.success('Kazanımlar kaydedildi');
        await loadInsights();
      } catch (e) {
        optikToast.error(e, 'save');
      }
    },
    [token, sessionId, loadInsights],
  );

  const removeSession = useCallback(async () => {
    if (!token || !confirm('Oturum ve tüm taramalar silinsin mi?')) return;
    try {
      await deleteExamSession(token, sessionId);
      optikToast.success('Oturum silindi');
      router.push('/optik-oturumlar');
    } catch (e) {
      optikToast.error(e, 'session');
    }
  }, [token, sessionId, router]);

  const closeSession = useCallback(async () => {
    if (!token) return;
    try {
      const updated = await patchSessionStatus(token, sessionId, 'closed');
      setSession(updated);
      optikToast.success('Oturum kapatıldı');
    } catch (e) {
      optikToast.error(e, 'session');
    }
  }, [token, sessionId]);

  const exportCsv = useCallback(async () => {
    if (!token) return;
    try {
      await downloadSessionExport(token, sessionId, 'csv');
    } catch (e) {
      optikToast.error(e, 'export');
    }
  }, [token, sessionId]);

  const saveOpenQuestions = useCallback(async () => {
    if (!token) return;
    setSavingOpen(true);
    try {
      const updated = await patchOpenQuestions(token, sessionId, openQuestions);
      setSession(updated);
      setOpenQuestions(updated.openQuestions ?? []);
      optikToast.success('Açık sorular kaydedildi');
    } catch (e) {
      optikToast.error(e, 'save');
    } finally {
      setSavingOpen(false);
    }
  }, [token, sessionId, openQuestions]);

  const openOcr = useCallback((questionId: string) => {
    setOcrQuestionId(questionId);
    setCameraPurpose('open_student');
    setCameraOpen(true);
  }, []);

  const openKeyOcr = useCallback((questionId: string) => {
    setOpenKeyOcrQuestionId(questionId);
    setCameraPurpose('open_key');
    setCameraOpen(true);
  }, []);

  const runOpenKeyOcrCapture = useCallback(
    async (b64: string | string[]) => {
      if (!token || !openKeyOcrQuestionId) return;
      const raw = Array.isArray(b64) ? b64[0]! : b64;
      setBusy(true);
      try {
        const compressed = await compressImageBase64ForOcr(raw);
        const res = await postOptikOcr(token, compressed, { kind: 'KEY' });
        setOpenQuestions((prev) =>
          prev.map((q) => (q.id === openKeyOcrQuestionId ? { ...q, key_text: res.text } : q)),
        );
        setCameraOpen(false);
        optikToast.success('Rubrik okundu', 'Kaydetmeyi unutmayın');
      } catch (e) {
        optikToast.error(e, 'ocr');
      } finally {
        setBusy(false);
        setOpenKeyOcrQuestionId(null);
      }
    },
    [token, openKeyOcrQuestionId],
  );

  const runOpenOcr = useCallback(
    async (b64: string | string[]) => {
      if (!token || !ocrQuestionId) return;
      const raw = Array.isArray(b64) ? b64[0]! : b64;
      setBusy(true);
      try {
        const compressed = await compressImageBase64ForOcr(raw);
        const res = await postOptikOcr(token, compressed, { kind: 'STUDENT' });
        setOpenAnswers((prev) => ({ ...prev, [ocrQuestionId]: res.text }));
        setCameraOpen(false);
        optikToast.success('Cevap okundu');
      } catch (e) {
        optikToast.error(e, 'ocr');
      } finally {
        setBusy(false);
        setOcrQuestionId(null);
      }
    },
    [token, ocrQuestionId],
  );

  const gradeOpenAi = useCallback(async () => {
    if (!token || !currentStudentId) {
      optikToast.validation('Öğrenci seçin');
      return;
    }
    const missingKey = openQuestions.filter((q) => !(q.key_text?.trim()));
    if (missingKey.length > 0) {
      optikToast.validation('Açık sorular için rubrik (Anahtar sekmesi)');
      setTab('key');
      return;
    }
    setBusy(true);
    try {
      const student = students.find((s) => s.id === currentStudentId);
      const res = await postGradeSessionOpen(token, sessionId, {
        student_id: currentStudentId,
        student_label: student?.name,
        key_text: openQuestions[0]?.key_text ?? '',
        items: openQuestions.map((q) => ({
          question_id: q.id,
          student_text: openAnswers[q.id] ?? '',
          mode: q.mode,
          max_score: q.max_score,
        })),
      });
      optikToast.success('Puanlandı', `${res.grade_score}/${res.grade_max_score}`);
      setOpenAnswers({});
      await loadReport();
    } catch (e) {
      optikToast.error(e, 'grade');
    } finally {
      setBusy(false);
    }
  }, [token, sessionId, currentStudentId, students, openQuestions, openAnswers, loadReport]);

  const saveManualOpen = useCallback(async () => {
    if (!token || !currentStudentId) {
      optikToast.validation('Öğrenci seçin');
      return;
    }
    setBusy(true);
    try {
      const student = students.find((s) => s.id === currentStudentId);
      await postManualOpenScores(token, sessionId, {
        student_id: currentStudentId,
        student_label: student?.name,
        grades: openQuestions.map((q) => ({
          question_id: q.id,
          score: manualScores[q.id]?.score ?? 0,
          max_score: manualScores[q.id]?.max ?? q.max_score,
        })),
      });
      optikToast.success('Puanlar kaydedildi');
      await loadReport();
    } catch (e) {
      optikToast.error(e, 'save');
    } finally {
      setBusy(false);
    }
  }, [token, sessionId, currentStudentId, students, openQuestions, manualScores, loadReport]);

  const exportEokul = useCallback(async () => {
    if (!token) return;
    try {
      await downloadSessionExport(token, sessionId, 'eokul');
    } catch (e) {
      optikToast.error(e, 'export');
    }
  }, [token, sessionId]);

  const downloadPdf = useCallback(
    async (type: OptikSessionPdfType, studentId?: string) => {
      if (!token) return;
      try {
        await downloadSessionPdf(token, sessionId, type, { studentId });
        optikToast.success('PDF', 'İndirildi');
      } catch (e) {
        optikToast.error(e, 'pdf');
      }
    },
    [token, sessionId],
  );

  const omrCameraOverlay = useMemo((): OptikCameraOverlayConfig | null => {
    if (!session || !cameraOpen) return null;
    if (cameraPurpose !== 'mc_student' && cameraPurpose !== 'mc_key') return null;
    const layout = layoutCache.get(session.templateId);
    if (!layout) return null;
    const keyNum =
      cameraPurpose === 'mc_student' ? answerKeyToNumberMap(answerKey) : undefined;
    return {
      layout,
      maxQuestion: session.questionCount,
      mode: cameraPurpose === 'mc_key' ? 'key' : 'student',
      answerKey: keyNum && Object.keys(keyNum).length > 0 ? keyNum : undefined,
    };
  }, [session, cameraOpen, cameraPurpose, layoutCache, answerKey]);

  return {
    token,
    role,
    schoolIdParam: me?.school_id ?? null,
    sessionId,
    session,
    outcomeInsights,
    loadInsights,
    saveSessionLinks,
    saveQuestionOutcomes,
    report,
    status,
    students,
    loading,
    tab,
    setTab,
    answerKey,
    setKeyCell,
    saveAnswerKey,
    savingKey,
    busy,
    cameraOpen,
    setCameraOpen,
    currentStudentId,
    setCurrentStudentId,
    mcAnswers,
    mcAmbiguous,
    setMcAnswer: (q: number, label: string) => {
      setMcAnswers((prev) => ({ ...prev, [q]: label }));
      setMcAmbiguous((a) => a.filter((x) => x !== q));
    },
    lastScore,
    offlineCount,
    batchMode,
    setBatchMode,
    nextStudent,
    scannedIds,
    runMcDecode,
    runOpenOcr,
    runOpenKeyOcrCapture,
    cameraPurpose,
    openQuestions,
    setOpenQuestions,
    saveOpenQuestions,
    savingOpen,
    openAnswers,
    setOpenAnswer: (id: string, text: string) => setOpenAnswers((p) => ({ ...p, [id]: text })),
    manualScores,
    setManualScore: (id: string, score: number, max: number) =>
      setManualScores((p) => ({ ...p, [id]: { score, max } })),
    openOcr,
    openKeyOcr,
    gradeOpenAi,
    saveManualOpen,
    applyAnswerKey,
    runMcKeyScan,
    runMcKeyOcr,
    openMcScan: () => {
      void preloadOptikOpenCv();
      setCameraPurpose('mc_student');
      setCameraOpen(true);
    },
    openMcKeyScan: () => {
      void preloadOptikOpenCv();
      setCameraPurpose('mc_key');
      setCameraOpen(true);
    },
    openMcKeyOcr: () => {
      setCameraPurpose('mc_key_ocr');
      setCameraOpen(true);
    },
    keyFilledCount: session ? answerKeyFilledCount(answerKey, session.questionCount) : 0,
    syncOffline,
    load,
    exportCsv,
    exportEokul,
    downloadPdf,
    missingCount: report?.summary.missing_count ?? 0,
    missingStudentIds,
    goToMcScan,
    startBatchMissing,
    mcScannedCount,
    batchProgressPct,
    omrCameraOverlay,
    mcReview,
    setMcReview,
    mcReviewPurpose,
    commitMcStudentReview,
    commitMcKeyReview,
    retryMcScan,
    removeSession,
    closeSession,
  };
}
