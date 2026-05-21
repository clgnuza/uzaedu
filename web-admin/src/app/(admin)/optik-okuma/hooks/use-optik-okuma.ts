'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOptikErrorMessage, optikToast } from '@/lib/optik-toast';
import { useAuth } from '@/hooks/use-auth';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';
import { downloadOptikFormPdf } from '@/lib/optik-form-templates';
import { compressImageBase64ForOcr } from '@/lib/optik-image-prep';
import {
  getCachedScanLayout,
  loadCachedScanLayout,
  setCachedScanLayout,
} from '@/lib/optik-layout-cache';
import {
  ensureOptikScanLayout,
  fetchOptikRubrics,
  fetchOptikStatus,
  fetchOptikTemplates,
  isOptikMcTemplate,
  postOptikGrade,
  postOptikOcr,
  type GradeMode,
  type OptikRubricTemplate,
  type OptikStatus,
} from '@/lib/optik-api';
import { decodeOmrBurst, decodeOmrFromBase64 } from '@/lib/optik-omr-decode';
import { postOptikScanResult } from '@/lib/optik-reports-api';
import {
  deleteOptikScanSession,
  formatMcAnswersText,
  listOptikScanSessions,
  newSessionId,
  saveOptikScanSession,
  type OptikScanSession,
} from '@/lib/optik-scan-sessions';
import type { OptikScanMeta } from '../components/OptikScanMetaBar';
import { loadOptikCameraSettings, type OptikCameraSettings } from '@/lib/optik-camera-settings';

const GRADE_MODES: { value: GradeMode; label: string }[] = [
  { value: 'CONTENT', label: 'İçerik' },
  { value: 'LANGUAGE', label: 'Dil' },
  { value: 'CONTENT_LANGUAGE', label: 'İçerik + Dil' },
  { value: 'MATH_FINAL', label: 'Matematik (sonuç)' },
  { value: 'MATH_STEPS', label: 'Matematik (adım)' },
];

export function useOptikOkuma() {
  const { token, role } = useAuth();
  const [status, setStatus] = useState<OptikStatus | null>(null);
  const [templates, setTemplates] = useState<OptikFormTemplate[]>([]);
  const [rubrics, setRubrics] = useState<OptikRubricTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<OptikScanSession[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraKind, setCameraKind] = useState<'mc' | 'key' | 'student'>('mc');
  const [cameraSettings, setCameraSettings] = useState<OptikCameraSettings>(() =>
    loadOptikCameraSettings(),
  );
  const [busy, setBusy] = useState(false);
  const [mcScanning, setMcScanning] = useState(false);
  const [mcAnswers, setMcAnswers] = useState<Record<number, string>>({});
  const [mcAmbiguous, setMcAmbiguous] = useState<number[]>([]);
  const [mcConfidence, setMcConfidence] = useState<number | null>(null);
  const [mcAnchorScore, setMcAnchorScore] = useState<number | null>(null);
  const [keyText, setKeyText] = useState('');
  const [studentText, setStudentText] = useState('');
  const [gradeMode, setGradeMode] = useState<GradeMode>('CONTENT');
  const [maxScore, setMaxScore] = useState(10);
  const [lastGrade, setLastGrade] = useState<{ score: number; max_score: number; confidence: number } | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState(0.95);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<OptikScanMeta>({
    classId: '',
    className: '',
    subjectId: '',
    subjectName: '',
    studentId: '',
    studentLabel: '',
  });

  const layoutCache = useMemo(
    () => ({
      get: (id: string) => getCachedScanLayout(id) ?? loadCachedScanLayout(id),
      set: setCachedScanLayout,
    }),
    [],
  );

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );
  const isMc = selected ? isOptikMcTemplate(selected) : true;

  const refreshSessions = useCallback(() => {
    setSessions(listOptikScanSessions());
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [st, tpl, rub] = await Promise.all([
        fetchOptikStatus(token),
        fetchOptikTemplates(token),
        fetchOptikRubrics(token).catch(() => [] as OptikRubricTemplate[]),
      ]);
      setStatus(st);
      setTemplates(tpl);
      setRubrics(rub);
      if (!templateId && tpl[0]) setTemplateId(tpl[0].id);
    } catch (e) {
      optikToast.error(e, 'load');
    } finally {
      setLoading(false);
    }
  }, [token, templateId]);

  useEffect(() => {
    void load();
    refreshSessions();
  }, [load, refreshSessions]);

  useEffect(() => {
    if (!token || !templateId) return;
    if (layoutCache.get(templateId)) return;
    void ensureOptikScanLayout(token, templateId, layoutCache).catch((e) =>
      optikToast.warn('Form düzeni', getOptikErrorMessage(e, 'Şablon yüklenemedi')),
    );
  }, [token, templateId, layoutCache]);

  const persistScan = useCallback(
    async (
      kind: 'mc' | 'open',
      extra: {
        answers?: Array<{ question: number; label: string }>;
        ambiguous_count?: number;
        confidence?: number;
        anchor_score?: number;
        grade_score?: number;
        grade_max_score?: number;
        grade_mode?: string;
      },
    ) => {
      if (!token || !selected) return;
      try {
        await postOptikScanResult(token, {
          template_id: selected.id,
          template_name: selected.name,
          kind,
          exam_type: selected.examType,
          class_id: scanMeta.classId || undefined,
          class_name: scanMeta.className || undefined,
          subject_id: scanMeta.subjectId || undefined,
          subject_name: scanMeta.subjectName || undefined,
          student_id: scanMeta.studentId || undefined,
          student_label: scanMeta.studentLabel || undefined,
          ...extra,
        });
      } catch {
        /* rapor sunucuya yazılamazsa yerel oturum yeter */
      }
    },
    [token, selected, scanMeta],
  );

  const openCamera = useCallback(
    (kind: 'mc' | 'key' | 'student') => {
      setCameraKind(kind);
      if (token && selected) {
        void ensureOptikScanLayout(token, selected.id, layoutCache).catch((e) =>
          optikToast.warn('Form düzeni', getOptikErrorMessage(e, 'Şablon yüklenemedi')),
        );
      }
      setCameraOpen(true);
    },
    [token, selected, layoutCache],
  );

  const runMcDecode = useCallback(
    async (input: string | string[]) => {
      if (!token || !selected) return;
      setBusy(true);
      setMcScanning(true);
      try {
        const layout = await ensureOptikScanLayout(token, selected.id, layoutCache);
        const frames = Array.isArray(input) ? input : [input];
        const decoded =
          frames.length > 1
            ? await decodeOmrBurst(frames, layout)
            : await decodeOmrFromBase64(frames[0]!, layout);
        setMcAnswers(decoded.answers);
        setMcAmbiguous(decoded.perQuestion.filter((p) => p.ambiguous).map((p) => p.question));
        setMcConfidence(decoded.confidence);
        setMcAnchorScore(decoded.anchor_score ?? null);
        const answerRows = Object.entries(decoded.answers).map(([q, label]) => ({
          question: Number(q),
          label,
          choice: 0,
        }));
        const sessionId = newSessionId();
        setActiveSessionId(sessionId);
        saveOptikScanSession({
          id: sessionId,
          templateId: selected.id,
          templateName: selected.name,
          createdAt: new Date().toISOString(),
          kind: 'mc',
          answers: answerRows,
          mcConfidence: decoded.confidence,
          mcAmbiguous: decoded.perQuestion.filter((p) => p.ambiguous).map((p) => p.question),
          anchorScore: decoded.anchor_score,
        });
        refreshSessions();
        setCameraOpen(false);
        void persistScan('mc', {
          answers: answerRows,
          ambiguous_count: decoded.perQuestion.filter((p) => p.ambiguous).length,
          confidence: decoded.confidence,
          anchor_score: decoded.anchor_score,
        });
        if (decoded.needs_rescan) optikToast.rescan('mc');
        else optikToast.success('Tarama tamam', `${Object.keys(decoded.answers).length} soru`);
      } catch (e) {
        optikToast.error(e, 'scan');
      } finally {
        setBusy(false);
        setMcScanning(false);
      }
    },
    [token, selected, layoutCache, refreshSessions, persistScan],
  );

  const setMcAnswer = useCallback((question: number, label: string) => {
    setMcAnswers((prev) => {
      const next = { ...prev, [question]: label };
      setMcAmbiguous((amb) => amb.filter((q) => q !== question));
      return next;
    });
  }, []);

  const copyMcAnswers = useCallback(async () => {
    const text = formatMcAnswersText(mcAnswers);
    try {
      await navigator.clipboard.writeText(text);
      optikToast.success('Kopyalandı');
    } catch {
      optikToast.errorMsg('Kopyalanamadı', 'Panoya erişim izni gerekebilir');
    }
  }, [mcAnswers]);

  const runOcr = useCallback(
    async (kind: 'KEY' | 'STUDENT', b64: string) => {
      if (!token) return;
      setBusy(true);
      try {
        const compressed = await compressImageBase64ForOcr(b64);
        const res = await postOptikOcr(token, compressed, { kind });
        if (kind === 'KEY') setKeyText(res.text);
        else {
          setStudentText(res.text);
          setOcrConfidence(res.confidence);
        }
        if (res.needs_rescan) optikToast.rescan('ocr');
        else optikToast.success(kind === 'KEY' ? 'Anahtar okundu' : 'Cevap okundu');
      } catch (e) {
        optikToast.error(e, 'ocr');
      } finally {
        setBusy(false);
        setCameraOpen(false);
      }
    },
    [token],
  );

  const runGrade = useCallback(async () => {
    if (!token || !selected) return;
    setBusy(true);
    try {
      const grade = await postOptikGrade(token, {
        template_id: selected.id,
        question_id: 'q1',
        mode: gradeMode,
        max_score: maxScore,
        key_text: keyText,
        student_text: studentText,
        ocr_confidence: ocrConfidence,
        subject: selected.subjectHint ?? undefined,
      });
      setLastGrade({
        score: grade.score,
        max_score: grade.max_score,
        confidence: grade.confidence,
      });
      const sessionId = newSessionId();
      setActiveSessionId(sessionId);
      saveOptikScanSession({
        id: sessionId,
        templateId: selected.id,
        templateName: selected.name,
        createdAt: new Date().toISOString(),
        kind: 'open',
        keyText,
        studentText,
        gradeMode,
        grade: {
          score: grade.score,
          max_score: grade.max_score,
          confidence: grade.confidence,
        },
      });
      refreshSessions();
      void persistScan('open', {
        grade_score: grade.score,
        grade_max_score: grade.max_score,
        grade_mode: gradeMode,
        confidence: grade.confidence,
      });
      if (grade.needs_rescan) optikToast.rescan('grade');
      else optikToast.success('Puanlandı', `${grade.score}/${grade.max_score}`);
    } catch (e) {
      optikToast.error(e, 'grade');
    } finally {
      setBusy(false);
    }
  }, [
    token,
    selected,
    gradeMode,
    maxScore,
    keyText,
    studentText,
    ocrConfidence,
    refreshSessions,
    persistScan,
    gradeMode,
  ]);

  const downloadPdf = useCallback(
    async (prependBlank = 0) => {
      if (!selected || !token) return;
      setDownloadingPdf(true);
      try {
        await downloadOptikFormPdf(token, selected, prependBlank);
        optikToast.success(prependBlank ? 'Yazılı+form' : 'PDF', 'İndirildi');
      } catch (e) {
        optikToast.error(e, 'pdf');
      } finally {
        setDownloadingPdf(false);
      }
    },
    [selected, token],
  );

  const restoreSession = useCallback((s: OptikScanSession) => {
    setTemplateId(s.templateId);
    setActiveSessionId(s.id);
    if (s.kind === 'mc' && s.answers) {
      const map: Record<number, string> = {};
      for (const a of s.answers) map[a.question] = a.label;
      setMcAnswers(map);
      setMcAmbiguous(s.mcAmbiguous ?? []);
      setMcConfidence(s.mcConfidence ?? null);
      setMcAnchorScore(s.anchorScore ?? null);
      optikToast.success('MC yüklendi');
    } else {
      setKeyText(s.keyText ?? '');
      setStudentText(s.studentText ?? '');
      if (s.gradeMode) setGradeMode(s.gradeMode as GradeMode);
      if (s.grade) setLastGrade(s.grade);
      optikToast.success('Açık uçlu yüklendi');
    }
  }, []);

  const applyRubric = useCallback((r: OptikRubricTemplate) => {
    if (r.mode) setGradeMode(r.mode as GradeMode);
    const total = r.criteria?.reduce((s, c) => s + (c.max_points ?? 0), 0);
    if (total && total > 0) setMaxScore(total);
    optikToast.success('Rubrik', r.name);
  }, []);

  const resetWorkflow = useCallback(() => {
    setMcAnswers({});
    setMcAmbiguous([]);
    setMcConfidence(null);
    setMcAnchorScore(null);
    setKeyText('');
    setStudentText('');
    setLastGrade(null);
    setActiveSessionId(null);
  }, []);

  const openStep = useMemo(() => {
    if (!keyText) return 1;
    if (!studentText) return 2;
    return 3;
  }, [keyText, studentText]);

  return {
    token,
    role,
    status,
    templates,
    rubrics,
    templateId,
    setTemplateId,
    loading,
    sessions,
    refreshSessions,
    cameraOpen,
    setCameraOpen,
    cameraKind,
    cameraSettings,
    setCameraSettings,
    busy,
    mcScanning,
    mcAnswers,
    mcAmbiguous,
    mcConfidence,
    mcAnchorScore,
    keyText,
    setKeyText,
    studentText,
    setStudentText,
    gradeMode,
    setGradeMode,
    maxScore,
    setMaxScore,
    lastGrade,
    ocrConfidence,
    downloadingPdf,
    activeSessionId,
    selected,
    isMc,
    GRADE_MODES,
    load,
    openCamera,
    runMcDecode,
    runOcr,
    runGrade,
    setMcAnswer,
    copyMcAnswers,
    downloadPdf,
    restoreSession,
    applyRubric,
    resetWorkflow,
    deleteSession: (id: string) => {
      deleteOptikScanSession(id);
      if (activeSessionId === id) setActiveSessionId(null);
      refreshSessions();
    },
    openStep,
    scanMeta,
    setScanMeta,
  };
}
