'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { optikToast } from '@/lib/optik-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { fetchOptikTemplates, isOptikMcTemplate } from '@/lib/optik-api';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { createExamSession, fetchExamSessions, type ExamSession } from '@/lib/optik-sessions-api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OptikPageShell } from '@/components/optik/OptikPageShell';
import { OptikQuickNav, OPTIK_OKUMA_QUICK_NAV } from '@/components/optik/OptikQuickNav';
import { OptikSessionBadge } from '@/components/optik/OptikSessionBadge';
import { OptikTeacherGuide } from '@/components/optik/OptikTeacherGuide';
import { filterMcTemplatesBySubject } from '@/lib/optik-session-summary';
import { ClipboardList, Plus, ScanLine } from 'lucide-react';

type SchoolClass = { id: string; name: string };
type SchoolSubject = { id: string; name: string };

type ButterflyPlan = { id: string; title: string };

export default function OptikOturumlarPage() {
  const { token, role, me } = useAuth();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, null);
  const router = useRouter();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [templates, setTemplates] = useState<OptikFormTemplate[]>([]);
  const [bPlans, setBPlans] = useState<ButterflyPlan[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [scoringMode, setScoringMode] = useState<'standard' | 'penalty_4_1'>('standard');
  const [butterflyPlanId, setButterflyPlanId] = useState('');

  const mcTemplatesAll = useMemo(() => templates.filter(isOptikMcTemplate), [templates]);
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;
  const mcTemplates = useMemo(
    () => filterMcTemplatesBySubject(mcTemplatesAll, subjectId, subjectName),
    [mcTemplatesAll, subjectId, subjectName],
  );
  const selectedTpl = mcTemplates.find((t) => t.id === templateId) ?? null;

  useEffect(() => {
    if (!templateId && mcTemplates[0]) {
      setTemplateId(mcTemplates[0].id);
      setQuestionCount(mcTemplates[0].questionCount ?? 20);
      return;
    }
    if (templateId && !mcTemplates.some((t) => t.id === templateId) && mcTemplates[0]) {
      setTemplateId(mcTemplates[0].id);
      setQuestionCount(mcTemplates[0].questionCount ?? 20);
    }
  }, [mcTemplates, templateId]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sess, tpl, cls, sub, bp] = await Promise.all([
        fetchExamSessions(token),
        fetchOptikTemplates(token),
        apiFetch<SchoolClass[]>('/classes-subjects/classes', { token }).catch(() => []),
        apiFetch<SchoolSubject[]>('/classes-subjects/subjects', { token }).catch(() => []),
        apiFetch<ButterflyPlan[]>(`/butterfly-exam/plans${schoolQ}`, { token }).catch(() => []),
      ]);
      setSessions(sess);
      setTemplates(tpl);
      setClasses(cls);
      setSubjects(sub);
      setBPlans(bp.filter((p) => (p as { rules?: { planType?: string } }).rules?.planType !== 'period'));
    } catch (e) {
      optikToast.error(e, 'load');
    } finally {
      setLoading(false);
    }
  }, [token, templateId, schoolQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!token || !selectedTpl || !title.trim()) {
      optikToast.validation('Başlık ve şablon gerekli');
      return;
    }
    setCreating(true);
    try {
      const cls = classes.find((c) => c.id === classId);
      const sub = subjects.find((s) => s.id === subjectId);
      const res = await createExamSession(token, {
        title: title.trim(),
        template_id: selectedTpl.id,
        template_name: selectedTpl.name,
        class_id: classId || undefined,
        class_name: cls?.name,
        subject_id: subjectId || undefined,
        subject_name: sub?.name,
        question_count: questionCount,
        choice_count: selectedTpl.choiceCount ?? 5,
        scoring_mode: scoringMode,
        butterfly_plan_id: butterflyPlanId || undefined,
      });
      optikToast.success('Oturum oluşturuldu');
      router.push(`/optik-oturumlar/${res.id}`);
    } catch (e) {
      optikToast.error(e, 'session');
    } finally {
      setCreating(false);
    }
  };

  if (role && role !== 'teacher' && role !== 'school_admin') {
    return (
      <div className="p-4">
        <Alert variant="error">Bu sayfa öğretmen veya okul yöneticisi içindir.</Alert>
      </div>
    );
  }

  return (
    <OptikPageShell>
      <header
        className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 md:rounded-2xl md:px-3 md:py-2.5"
        title="Sınav oturumları"
      >
        <ClipboardList className="size-5 shrink-0 text-violet-600" />
        <h1 className="text-base font-bold md:text-lg">Oturumlar</h1>
      </header>

      <OptikQuickNav
        items={OPTIK_OKUMA_QUICK_NAV.filter((i) => i.href !== '/optik-oturumlar')}
      />
      <OptikTeacherGuide activeStep={1} />

      <section className="rounded-xl border bg-card p-2.5 shadow-sm md:rounded-2xl md:p-3">
        <h2
          className="mb-2 flex items-center gap-1.5 text-xs font-semibold md:text-sm"
          title="Yeni sınav oturumu"
        >
          <Plus className="size-4" />
          Yeni
        </h2>
        <div className="space-y-2 md:grid md:grid-cols-2 md:gap-x-3 md:space-y-0 [&>*]:md:col-span-2">
          <Input
            className="h-10 rounded-xl"
            placeholder="Örn: 8-A Matematik 1. Yazılı"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {subjectId ? (
            <p
              className="text-[10px] text-muted-foreground"
              title={`${subjectName} + genel şablonlar`}
            >
              Şablon {mcTemplates.length}/{mcTemplatesAll.length}
            </p>
          ) : null}
          <Select value={templateId} onValueChange={(id) => {
            setTemplateId(id);
            const t = mcTemplates.find((x) => x.id === id);
            if (t) setQuestionCount(t.questionCount ?? 20);
          }}>
            <SelectTrigger className="h-10 rounded-xl text-xs">
              <SelectValue placeholder="MC şablon" />
            </SelectTrigger>
            <SelectContent>
              {mcTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <Select value={classId || '_'} onValueChange={(v) => setClassId(v === '_' ? '' : v)}>
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="Sınıf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Sınıf yok</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={subjectId || '_'}
              onValueChange={(v) => {
                setSubjectId(v === '_' ? '' : v);
              }}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="Ders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Ders yok</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={butterflyPlanId || '_'} onValueChange={(v) => setButterflyPlanId(v === '_' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl text-xs">
              <SelectValue placeholder="Kelebek planı (isteğe bağlı)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Kelebek planı yok</SelectItem>
              {bPlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={1}
              max={200}
              className="h-9 rounded-xl text-xs"
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 20)}
            />
            <Select value={scoringMode} onValueChange={(v) => setScoringMode(v as 'standard' | 'penalty_4_1')}>
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standart net</SelectItem>
                <SelectItem value="penalty_4_1">4 yanlış 1 doğru</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="h-10 w-full rounded-xl md:col-span-2"
            disabled={creating || !title.trim() || !templateId}
            onClick={() => void onCreate()}
          >
            {creating ? (
              <LoadingSpinner className="size-5" />
            ) : (
              <>
                <Plus className="mr-1 size-4" />
                Oluştur
              </>
            )}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner className="size-8 text-violet-600" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Henüz oturum yok.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/optik-oturumlar/${s.id}`}
                title={[s.templateName, s.className, s.subjectName].filter(Boolean).join(' · ')}
                className="flex gap-2 rounded-xl border bg-card px-2.5 py-2.5 shadow-sm transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 md:rounded-2xl md:px-3 md:py-3"
              >
                <ScanLine className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate text-sm font-semibold">{s.title}</p>
                    <OptikSessionBadge session={s} />
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {s.templateName}
                    {s.className ? ` · ${s.className}` : ''}
                  </p>
                  {(s.mcScanCount ?? 0) > 0 ? (
                    <p className="text-[9px] text-muted-foreground">{s.mcScanCount} tarama</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OptikPageShell>
  );
}
