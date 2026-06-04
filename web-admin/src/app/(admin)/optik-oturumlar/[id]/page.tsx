'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { OptikSessionPdfType } from '@/lib/optik-sessions-api';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OptikCameraCapture } from '@/app/(admin)/optik-okuma/components/OptikCameraCapture';
import { OptikMcScanReviewDialog } from '@/app/(admin)/optik-okuma/components/OptikMcScanReviewDialog';
import { OptikCameraSettingsPanel } from '@/app/(admin)/optik-okuma/components/OptikCameraSettingsPanel';
import { OptikMcPanel } from '@/app/(admin)/optik-okuma/components/OptikMcPanel';
import { OptikNativeScanPanel } from '@/components/optik/OptikNativeScanPanel';
import { OptikPwaInstallHint } from '@/components/optik/OptikPwaInstallHint';
import { openOptikNativeScan } from '@/lib/optik-native-deeplink';
import { useOptikScanSurface } from '@/hooks/use-optik-scan-surface';
import { McAnswerKeyPanel } from './components/McAnswerKeyPanel';
import { OpenAnswerKeysEditor } from './components/OpenAnswerKeysEditor';
import { OpenGradePanel } from './components/OpenGradePanel';
import { SessionMatrixFull } from './components/SessionMatrixFull';
import { SessionIntegrations } from './components/SessionIntegrations';
import { OptikPageShell } from '@/components/optik/OptikPageShell';
import { OptikStatusBanner } from '@/components/optik/OptikStatusBanner';
import { OptikTeacherGuide } from '@/components/optik/OptikTeacherGuide';
import { useSessionDetail } from './use-session-detail';
import {
  ArrowLeft,
  Camera,
  CloudUpload,
  Download,
  FileText,
  KeyRound,
  Link2,
  ListChecks,
  PenLine,
  ScanLine,
  Table2,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export default function OptikOturumDetayPage() {
  const d = useSessionDetail();
  const { isNative, isPwa, enablePwaCamera } = useOptikScanSurface();
  const [pdfKind, setPdfKind] = useState<OptikSessionPdfType>('class_list');
  const currentStudent = d.students.find((s) => s.id === d.currentStudentId);
  const nativeBase = d.session
    ? {
        templateId: d.session.templateId,
        templateName: d.session.templateName,
        sessionId: d.sessionId,
        classId: d.session.classId ?? undefined,
        className: d.session.className ?? undefined,
        subjectId: d.session.subjectId ?? undefined,
        subjectName: d.session.subjectName ?? undefined,
        studentId: d.currentStudentId || undefined,
        studentLabel: currentStudent?.name,
      }
    : null;

  if (d.loading && !d.session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner className="size-8 text-violet-600" />
      </div>
    );
  }

  if (!d.session) {
    return (
      <div className="p-4">
        <Alert variant="error">Oturum bulunamadı.</Alert>
        <Link href="/optik-oturumlar" className="mt-2 inline-block text-sm text-primary hover:underline">
          Listeye dön
        </Link>
      </div>
    );
  }

  const keyFilled =
    d.keyFilledCount >= Math.min(5, d.session.questionCount) ||
    d.keyFilledCount >= Math.ceil(d.session.questionCount * 0.8);
  const tabs: Array<{ id: typeof d.tab; icon: LucideIcon; short: string; title: string }> = [
    { id: 'key', icon: KeyRound, short: 'Anahtar', title: 'Cevap anahtarı' },
    { id: 'scan', icon: ScanLine, short: 'MC', title: 'Optik tarama' },
    { id: 'open', icon: PenLine, short: 'Açık', title: 'Açık uçlu' },
    { id: 'links', icon: Link2, short: 'Bağ', title: 'Kelebek / kazanım' },
    { id: 'results', icon: Table2, short: 'Sonuç', title: 'Matris ve export' },
  ];
  const guideStep: 1 | 2 | 3 | 4 =
    d.tab === 'key' ? 2 : d.tab === 'results' ? 4 : 3;

  return (
    <OptikPageShell>
      <header className="rounded-xl border bg-card px-2.5 py-2 md:rounded-2xl md:p-3">
        <Link
          href="/optik-oturumlar"
          title="Oturum listesi"
          className="mb-1.5 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="truncate text-base font-bold md:text-lg">{d.session.title}</h1>
        <p className="truncate text-[10px] text-muted-foreground">
          {d.session.templateName}
          {d.session.className ? ` · ${d.session.className}` : ''}
        </p>
        {d.report ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              title="Tarama sayısı"
              className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:text-violet-200"
            >
              <ScanLine className="size-3" />
              {d.report.summary.scanned_count}
            </span>
            {d.report.summary.avg_net != null ? (
              <span
                title="Ortalama net"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold"
              >
                <TrendingUp className="size-3" />
                {d.report.summary.avg_net}
              </span>
            ) : null}
            {d.missingCount > 0 ? (
              <span
                title="Eksik öğrenci"
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
              >
                <Users className="size-3" />
                {d.missingCount}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-2 flex gap-1">
          {d.session.status !== 'closed' ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Oturumu kapat"
              className="size-8 rounded-lg"
              onClick={() => void d.closeSession()}
            >
              <XCircle className="size-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Oturumu sil"
            className="size-8 rounded-lg text-destructive"
            onClick={() => void d.removeSession()}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {d.offlineCount > 0 ? (
        <Alert variant="warning" className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px]">
          <CloudUpload className="size-4 shrink-0" />
          <span className="flex-1">{d.offlineCount} kuyruk</span>
          <Button variant="link" size="sm" className="h-auto p-0 text-[11px]" onClick={() => void d.syncOffline()}>
            Sync
          </Button>
        </Alert>
      ) : null}

      <OptikStatusBanner status={d.status} />
      <OptikPwaInstallHint />
      <OptikTeacherGuide activeStep={guideStep} />

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              title={t.title}
              className={cn(
                'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors',
                d.tab === t.id ? 'bg-card text-violet-700 shadow-sm' : 'text-muted-foreground',
              )}
              onClick={() => d.setTab(t.id)}
            >
              <Icon className="size-4" />
              <span className="text-[9px] font-semibold">{t.short}</span>
            </button>
          );
        })}
      </div>

      {d.tab === 'key' ? (
        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold" title="MC şık + açık rubrik">
              <KeyRound className="size-4" />
              Anahtar
            </h2>
            {!keyFilled ? (
              <p
                className="mb-2 text-[10px] text-amber-700 dark:text-amber-300"
                title="MC tarama için anahtar gerekli"
              >
                En az {Math.min(5, d.session.questionCount)} soru
              </p>
            ) : null}
            {isNative && nativeBase ? (
              <OptikNativeScanPanel
                ready={!!d.status?.ready}
                base={nativeBase}
                onEnablePwaCamera={enablePwaCamera}
                actions={[
                  { mode: 'mc_key', label: 'Optik formdan anahtar oku' },
                  { mode: 'open_key', label: 'Anahtar kağıdı OCR' },
                ]}
              />
            ) : null}
            <McAnswerKeyPanel
              questionCount={d.session.questionCount}
              choiceCount={d.session.choiceCount}
              answerKey={d.answerKey}
              onSet={d.setKeyCell}
              onApplyKey={d.applyAnswerKey}
              onSave={() => void d.saveAnswerKey()}
              saving={d.savingKey}
              busy={d.busy}
              ready={!!d.status?.ready}
              hideCameraModes={isNative}
              onScanOmr={() => d.openMcKeyScan()}
              onScanOcr={() => d.openMcKeyOcr()}
            />
          </section>
          <section className="rounded-2xl border border-cyan-500/20 bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">Açık uçlu rubrikleri</h2>
            <OpenAnswerKeysEditor
              questions={d.openQuestions}
              onChange={d.setOpenQuestions}
              onSave={() => void d.saveOpenQuestions()}
              saving={d.savingOpen}
              busy={d.busy}
              onOcrKey={d.openKeyOcr}
            />
          </section>
        </div>
      ) : null}

      {d.tab === 'scan' ? (
        <div className="space-y-3">
          {isPwa ? <OptikCameraSettingsPanel /> : null}
          {!keyFilled ? (
            <Alert variant="warning" className="rounded-xl px-2.5 py-2 text-[11px]">
              <KeyRound className="mr-1 inline size-3.5" />
              Önce anahtar
            </Alert>
          ) : null}

          {d.students.length > 0 ? (
            <div className="rounded-2xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  Tarama {d.mcScannedCount}/{d.students.length}
                </span>
                <label className="flex shrink-0 items-center gap-1.5 text-[10px]">
                  <input
                    type="checkbox"
                    checked={d.batchMode}
                    onChange={(e) => d.setBatchMode(e.target.checked)}
                  />
                  Toplu sıra
                </label>
              </div>
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all"
                  style={{ width: `${d.batchProgressPct}%` }}
                />
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Users className="size-4" />
                  Öğrenci
                </span>
              </div>
              <Select value={d.currentStudentId || '_'} onValueChange={(v) => d.setCurrentStudentId(v === '_' ? '' : v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Öğrenci seç" />
                </SelectTrigger>
                <SelectContent>
                  {d.students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {d.scannedIds.has(s.id) ? ' ✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {d.batchMode && d.nextStudent ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Sıradaki: {d.nextStudent.name}
                </p>
              ) : null}
            </div>
          ) : null}

          {isNative && nativeBase ? (
            <OptikNativeScanPanel
              ready={!!d.status?.ready && keyFilled}
              base={nativeBase}
              onEnablePwaCamera={enablePwaCamera}
              actions={[
                {
                  mode: 'mc_student',
                  label: 'Öğrenci optik formu tara',
                  disabled: !d.currentStudentId && d.students.length > 0,
                },
              ]}
            />
          ) : (
            <OptikMcPanel
              ready={!!d.status?.ready && keyFilled}
              busy={d.busy}
              answers={d.mcAnswers}
              ambiguous={d.mcAmbiguous}
              confidence={null}
              anchorScore={null}
              choiceCount={d.session.choiceCount}
              onScan={() => d.openMcScan()}
              onCopy={() => {}}
              onReset={() => {}}
              onSetAnswer={d.setMcAnswer}
            />
          )}

          {d.lastScore ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Net {d.lastScore.net} · D {d.lastScore.correct} · Y {d.lastScore.wrong} · B {d.lastScore.blank}
            </div>
          ) : null}

          {isPwa ? (
            <Button
              className="h-12 w-full gap-2 rounded-xl"
              variant="outline"
              disabled={!d.mcAnswers || Object.keys(d.mcAnswers).length === 0 || d.busy}
              onClick={() => d.openMcScan()}
            >
              <Camera className="size-5" />
              Yeniden tara
            </Button>
          ) : null}
        </div>
      ) : null}

      {d.tab === 'open' ? (
        <div className="space-y-3">
          {d.students.length > 0 ? (
            <div className="rounded-2xl border bg-card p-3">
              <Select value={d.currentStudentId || '_'} onValueChange={(v) => d.setCurrentStudentId(v === '_' ? '' : v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Öğrenci" />
                </SelectTrigger>
                <SelectContent>
                  {d.students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {isNative && nativeBase ? (
            <OptikNativeScanPanel
              ready={!!d.status?.ready}
              base={nativeBase}
              onEnablePwaCamera={enablePwaCamera}
              actions={[
                { mode: 'open_student', label: 'Öğrenci cevabı tara (OCR)' },
                { mode: 'open_key', label: 'Rubrik / anahtar tara' },
              ]}
            />
          ) : null}
          <section className="rounded-2xl border border-cyan-500/20 bg-card p-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <PenLine className="size-4 text-cyan-600" />
              Öğrenci tarama & puan
            </h2>
            <OpenGradePanel
              questions={d.openQuestions}
              answers={d.openAnswers}
              onAnswer={d.setOpenAnswer}
              manualScores={d.manualScores}
              onManualScore={d.setManualScore}
              busy={d.busy}
              ready={!!d.status?.ready}
              onOcrQuestion={d.openOcr}
              onGradeAi={() => void d.gradeOpenAi()}
              onSaveManual={() => void d.saveManualOpen()}
              onGoDefineKeys={() => d.setTab('key')}
            />
          </section>
        </div>
      ) : null}

      {d.tab === 'links' ? (
        <SessionIntegrations
          token={d.token}
          role={d.role}
          schoolIdParam={d.schoolIdParam}
          sessionId={d.sessionId}
          questionCount={d.session.questionCount}
          butterflyPlanId={d.session.butterflyPlanId}
          outcomePlanKey={d.session.outcomePlanKey}
          questionOutcomes={d.session.questionOutcomes ?? {}}
          insights={d.outcomeInsights}
          onLinksSaved={(b, k) => void d.saveSessionLinks(b, k)}
          onOutcomesSaved={(q) => void d.saveQuestionOutcomes(q)}
          onRefreshInsights={() => void d.loadInsights()}
          onOutcomePdf={() => void d.downloadPdf('outcome')}
        />
      ) : null}

      {d.tab === 'results' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void d.exportCsv()}>
              <Download className="mr-1 size-3.5" />
              Excel/TSV
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void d.exportEokul()}>
              <Download className="mr-1 size-3.5" />
              e-Okul
            </Button>
            <Select value={pdfKind} onValueChange={(v) => setPdfKind(v as OptikSessionPdfType)}>
              <SelectTrigger className="h-8 w-[132px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class_list">Sınıf cetveli</SelectItem>
                <SelectItem value="summary">Oturum özet</SelectItem>
                <SelectItem value="item_analysis">Madde analizi</SelectItem>
                <SelectItem value="outcome">Kazanım</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => void d.downloadPdf(pdfKind)}
            >
              <FileText className="mr-1 size-3.5" />
              PDF
            </Button>
            <Link
              href={`/optik-raporlar?session_id=${d.sessionId}`}
              className="inline-flex h-8 items-center rounded-xl border px-3 text-xs font-medium"
            >
              <ListChecks className="mr-1 size-3.5" />
              Genel rapor
            </Link>
          </div>

          {d.report?.hardest_questions?.length ? (
            <section className="rounded-2xl border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold">En zor sorular</h3>
              <ul className="space-y-1 text-[11px]">
                {d.report.hardest_questions.map((h) => (
                  <li key={h.question} className="flex justify-between">
                    <span>S{h.question}</span>
                    <span>%{Math.round(h.correct_pct)} doğru</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {d.missingCount > 0 && d.students.length > 0 ? (
            <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                  Eksik tarama ({d.missingCount})
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg text-[10px]"
                  onClick={() => {
                    if (isNative && nativeBase && d.nextStudent) {
                      openOptikNativeScan({
                        ...nativeBase,
                        mode: 'mc_student',
                        batch: true,
                        studentId: d.nextStudent.id,
                        studentLabel: d.nextStudent.name,
                      });
                    } else {
                      d.startBatchMissing();
                    }
                  }}
                >
                  Eksikleri tara
                </Button>
              </div>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-[11px]">
                {d.students
                  .filter((s) => d.missingStudentIds.includes(s.id))
                  .map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => {
                          if (isNative && nativeBase) {
                            openOptikNativeScan({
                              ...nativeBase,
                              mode: 'mc_student',
                              batch: true,
                              studentId: s.id,
                              studentLabel: s.name,
                            });
                          } else {
                            d.goToMcScan(s.id, { batch: true });
                          }
                        }}
                      >
                        {s.name} → MC tara
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {d.report ? (
            <section className="rounded-2xl border bg-card p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <Table2 className="size-4" />
                Tam matris (şıklar + açık uçlu)
              </h3>
              <SessionMatrixFull
                report={d.report}
                onStudentPdf={(id) => void d.downloadPdf('student', id)}
              />
            </section>
          ) : null}
        </div>
      ) : null}

      {isPwa ? (
        <>
          <OptikCameraCapture
            open={d.cameraOpen}
            onClose={() => d.setCameraOpen(false)}
            busy={d.busy}
            burstFrames={
              d.cameraPurpose === 'mc_student' || d.cameraPurpose === 'mc_key' ? undefined : 1
            }
            mode={
              d.cameraPurpose === 'mc_student' || d.cameraPurpose === 'mc_key'
                ? 'mc'
                : 'student'
            }
            omrOverlay={d.omrCameraOverlay}
            onCapture={async (b64) => {
              if (d.cameraPurpose === 'mc_student') await d.runMcDecode(b64);
              else if (d.cameraPurpose === 'mc_key') await d.runMcKeyScan(b64);
              else if (d.cameraPurpose === 'mc_key_ocr') await d.runMcKeyOcr(b64);
              else if (d.cameraPurpose === 'open_key') await d.runOpenKeyOcrCapture(b64);
              else await d.runOpenOcr(b64);
            }}
          />
          <OptikMcScanReviewDialog
            open={!!d.mcReview}
            review={d.mcReview}
            onClose={() => d.setMcReview(null)}
            onRetry={d.retryMcScan}
            onConfirm={(r) => {
              if (d.mcReviewPurpose === 'key') d.commitMcKeyReview(r);
              else void d.commitMcStudentReview(r);
            }}
          />
        </>
      ) : null}
    </OptikPageShell>
  );
}
