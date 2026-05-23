'use client';

type Props = {
  schoolName?: string | null;
  academicYear?: string | null;
  programName?: string | null;
  viewLabel: string;
  entityLabel?: string | null;
};

export function TimetablePrintHeader({
  schoolName,
  academicYear,
  programName,
  viewLabel,
  entityLabel,
}: Props) {
  return (
    <header className="timetable-print-header mb-3 hidden border-b border-border pb-2 text-center print:block">
      <p className="text-[9pt] font-semibold">T.C.</p>
      <p className="text-[8pt] uppercase tracking-wide text-muted-foreground">Millî Eğitim Bakanlığı</p>
      {schoolName && <p className="text-[11pt] font-semibold">{schoolName}</p>}
      <h1 className="text-[12pt] font-bold">
        {viewLabel}
        {entityLabel ? ` — ${entityLabel}` : ''}
      </h1>
      <p className="text-[9pt] text-muted-foreground">
        {[programName, academicYear].filter(Boolean).join(' · ')}
      </p>
    </header>
  );
}
