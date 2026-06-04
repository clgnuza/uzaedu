'use client';

import { Alert } from '@/components/ui/alert';
import { OptikPwaShareBridge } from './components/OptikPwaShareBridge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OptikPageShell } from '@/components/optik/OptikPageShell';
import { OptikQuickNav, OPTIK_OKUMA_QUICK_NAV } from '@/components/optik/OptikQuickNav';
import { OptikStatusBanner } from '@/components/optik/OptikStatusBanner';
import { OptikFreeScanNotice } from '@/components/optik/OptikTeacherGuide';
import { OptikNativeScanPanel } from '@/components/optik/OptikNativeScanPanel';
import { OptikPwaInstallHint } from '@/components/optik/OptikPwaInstallHint';
import { OptikCameraCapture } from './components/OptikCameraCapture';
import { OptikMcScanReviewDialog } from './components/OptikMcScanReviewDialog';
import { OptikMcPanel } from './components/OptikMcPanel';
import { OptikOkumaHero } from './components/OptikOkumaHero';
import { OptikOpenPanel } from './components/OptikOpenPanel';
import { OptikScanMetaBar } from './components/OptikScanMetaBar';
import { OptikCameraSettingsPanel } from './components/OptikCameraSettingsPanel';
import { OptikScanTips } from './components/OptikScanTips';
import { OptikAnswerKeyHint } from './components/OptikAnswerKeyHint';
import { OptikSessionList } from './components/OptikSessionList';
import { OptikTemplateStrip } from './components/OptikTemplateStrip';
import { useOptikOkuma } from './hooks/use-optik-okuma';
import { useOptikScanSurface } from '@/hooks/use-optik-scan-surface';

export default function OptikOkumaPage() {
  const o = useOptikOkuma();
  const { isNative, isPwa, enablePwaCamera } = useOptikScanSurface();
  const sidebar = isPwa ? (
    <>
      <OptikCameraSettingsPanel onSettingsChange={o.setCameraSettings} />
      <OptikScanTips />
    </>
  ) : (
    <OptikScanTips />
  );
  const nativeBase = o.selected
    ? {
        templateId: o.selected.id,
        templateName: o.selected.name,
        classId: o.scanMeta.classId || undefined,
        className: o.scanMeta.className || undefined,
        subjectId: o.scanMeta.subjectId || undefined,
        subjectName: o.scanMeta.subjectName || undefined,
        studentId: o.scanMeta.studentId || undefined,
        studentLabel: o.scanMeta.studentLabel || undefined,
      }
    : null;

  if (o.role && o.role !== 'teacher') {
    return (
      <div className="p-4">
        <Alert variant="error">Optik okuma yalnızca öğretmen hesabıyla kullanılabilir.</Alert>
      </div>
    );
  }

  return (
    <OptikPageShell sidebar={sidebar}>
      <OptikPwaShareBridge runMcDecode={o.runMcDecode} hasTemplate={!!o.selected} />
      <OptikOkumaHero
        ready={!!o.status?.ready}
        status={o.status}
        loading={o.loading}
        onRefresh={() => void o.load()}
      />

      <OptikQuickNav items={OPTIK_OKUMA_QUICK_NAV} />
      <OptikPwaInstallHint />
      <OptikFreeScanNotice />
      <OptikStatusBanner status={o.status} />

      {o.loading && o.templates.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner className="size-8 text-fuchsia-600" />
        </div>
      ) : (
        <>
          <OptikTemplateStrip
            templates={o.templates}
            selectedId={o.templateId}
            onSelect={o.setTemplateId}
            onDownload={() => void o.downloadPdf(0)}
            onDownloadYazili={() => void o.downloadPdf(1)}
            downloading={o.downloadingPdf}
          />

          <OptikScanMetaBar token={o.token} value={o.scanMeta} onChange={o.setScanMeta} />

          <div className="space-y-2 lg:hidden">{sidebar}</div>

          {o.selected && o.isMc ? (
            <>
              <OptikAnswerKeyHint
                hasMcAnswers={Object.keys(o.mcAnswers).length > 0}
                answerCount={Object.keys(o.mcAnswers).length}
              />
              {isNative && nativeBase ? (
                <OptikNativeScanPanel
                  ready={!!o.status?.ready}
                  base={nativeBase}
                  onEnablePwaCamera={enablePwaCamera}
                  actions={[{ mode: 'mc_student', label: 'Optik form tara (MC)' }]}
                />
              ) : (
                <OptikMcPanel
                  ready={!!o.status?.ready}
                  busy={o.busy}
                  answers={o.mcAnswers}
                  ambiguous={o.mcAmbiguous}
                  confidence={o.mcConfidence}
                  anchorScore={o.mcAnchorScore}
                  choiceCount={o.selected.choiceCount ?? 5}
                  mcBurstFrames={o.cameraSettings.mcBurstFrames}
                  onScan={() => o.openCamera('mc')}
                  onCopy={() => void o.copyMcAnswers()}
                  onReset={o.resetWorkflow}
                  onSetAnswer={o.setMcAnswer}
                />
              )}
            </>
          ) : null}

          {o.selected && !o.isMc ? (
            isNative && nativeBase ? (
              <OptikNativeScanPanel
                ready={!!o.status?.ready}
                base={nativeBase}
                onEnablePwaCamera={enablePwaCamera}
                actions={[
                  { mode: 'open_key', label: 'Anahtar / rubrik tara' },
                  { mode: 'open_student', label: 'Öğrenci cevabı tara' },
                ]}
              />
            ) : (
              <OptikOpenPanel
                ready={!!o.status?.ready}
                busy={o.busy}
                openStep={o.openStep}
                keyText={o.keyText}
                studentText={o.studentText}
                gradeMode={o.gradeMode}
                maxScore={o.maxScore}
                lastGrade={o.lastGrade}
                ocrConfidence={o.ocrConfidence}
                rubrics={o.rubrics}
                gradeModes={o.GRADE_MODES}
                onOpenKey={() => o.openCamera('key')}
                onOpenStudent={() => o.openCamera('student')}
                onGradeMode={o.setGradeMode}
                onMaxScore={o.setMaxScore}
                onGrade={() => void o.runGrade()}
                onApplyRubric={o.applyRubric}
                onEditKey={o.setKeyText}
                onEditStudent={o.setStudentText}
              />
            )
          ) : null}

          <OptikSessionList
            sessions={o.sessions}
            activeId={o.activeSessionId}
            onRestore={o.restoreSession}
            onDelete={o.deleteSession}
          />
        </>
      )}

      {isPwa ? (
        <>
          <OptikCameraCapture
            open={o.cameraOpen}
            onClose={() => o.setCameraOpen(false)}
            busy={o.busy || o.mcScanning}
            burstFrames={o.cameraKind === 'mc' ? undefined : 1}
            cameraSettings={o.cameraSettings}
            mode={o.cameraKind}
            omrOverlay={o.omrCameraOverlay}
            onCapture={async (b64) => {
              if (o.cameraKind === 'mc') await o.runMcDecode(b64);
              else
                await o.runOcr(
                  o.cameraKind === 'key' ? 'KEY' : 'STUDENT',
                  Array.isArray(b64) ? b64[0]! : b64,
                );
            }}
          />
          <OptikMcScanReviewDialog
            open={!!o.mcReview}
            review={o.mcReview}
            onClose={() => o.setMcReview(null)}
            onRetry={o.retryMcScan}
            onConfirm={(r) => void o.commitMcReview(r)}
          />
        </>
      ) : null}
    </OptikPageShell>
  );
}
