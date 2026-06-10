import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { scoresForStudentCriterion } from '../lib/eval-score-utils';

export type EvalPrintCriterion = {
  id: string;
  name: string;
  maxScore: number;
  scoreType?: 'numeric' | 'sign';
  subjectId?: string | null;
};

export type EvalPrintStudent = { id: string; name: string };

export type EvalPrintScore = {
  id: string;
  criterionId: string;
  studentId: string;
  score: number;
  noteDate: string;
  note?: string | null;
  createdAt?: string;
  criterion?: EvalPrintCriterion;
};

export type EvalPrintStudentNote = {
  id: string;
  studentId: string;
  noteType: string;
  noteDate: string;
  description?: string | null;
};

export type EvalPrintInput = {
  schoolName: string;
  teacherName: string;
  listLabel: string;
  classLabel: string;
  subjectLabel: string;
  printedAt: string;
  students: EvalPrintStudent[];
  criteria: EvalPrintCriterion[];
  scores: EvalPrintScore[];
  notes: EvalPrintStudentNote[];
};

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatScoreValue(c: EvalPrintCriterion, score: number): string {
  if ((c.scoreType ?? 'numeric') === 'sign') {
    if (score === 1) return '+';
    if (score === -1) return '−';
    return '·';
  }
  return String(score);
}

function formatScoreStatus(c: EvalPrintCriterion, score: number): string {
  if ((c.scoreType ?? 'numeric') === 'sign') {
    if (score === 1) return 'Olumlu (+)';
    if (score === -1) return 'Olumsuz (−)';
    return 'Nötr (·)';
  }
  return `${score} / ${c.maxScore}`;
}

function formatRecordDate(noteDate: string): string {
  const d = new Date(noteDate);
  if (Number.isNaN(d.getTime())) return noteDate || '—';
  return format(d, 'd MMM yyyy', { locale: tr });
}

function formatSystemAt(createdAt?: string): string {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'd.MM.yyyy HH:mm', { locale: tr });
}

function buildMatrixCell(
  c: EvalPrintCriterion,
  chain: Array<Pick<EvalPrintScore, 'score' | 'noteDate' | 'createdAt'> & { note?: string | null }>,
): string {
  if (chain.length === 0) {
    return `<td class="cell e"><div class="cell-empty">—</div><span class="badge no">Kayıt yok</span></td>`;
  }

  const latest = chain[0]!;
  const rows = chain
    .map((sc, idx) => {
      const n = chain.length - idx;
      const isLatest = idx === 0;
      const val = formatScoreValue(c, sc.score);
      const status = formatScoreStatus(c, sc.score);
      const note = sc.note ? `<div class="hist-note">${escapeHtml(sc.note)}</div>` : '';
      return `<div class="hist-row${isLatest ? ' hist-latest' : ''}">
        <div class="hist-meta">
          <span class="hist-n">#${n}</span>
          ${isLatest ? '<span class="badge latest">Son</span>' : ''}
        </div>
        <div class="hist-main">
          <span class="hist-val">${escapeHtml(val)}</span>
          <span class="hist-st">${escapeHtml(status)}</span>
        </div>
        <div class="hist-date">Kayıt: ${escapeHtml(formatRecordDate(sc.noteDate))}</div>
        <div class="hist-sys">Sistem: ${escapeHtml(formatSystemAt(sc.createdAt))}</div>
        ${note}
      </div>`;
    })
    .join('');

  return `<td class="cell g">
    <div class="cell-top">
      <span class="m">${escapeHtml(formatScoreValue(c, latest.score))}</span>
      <span class="cell-cnt">${chain.length} kayıt</span>
    </div>
    <div class="hist">${rows}</div>
  </td>`;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  @page { margin: 12mm 10mm; size: A4 landscape; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
    font-size: 9px;
    line-height: 1.4;
    color: #0f172a;
    margin: 0;
    padding: 0;
  }
  .doc { max-width: 100%; }
  .hero {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #c7d2fe;
    margin-bottom: 12px;
  }
  .hero-top {
    background: linear-gradient(135deg, #047857 0%, #0d9488 45%, #0891b2 100%);
    color: #fff;
    padding: 14px 16px 12px;
  }
  .hero-brand { font-size: 7.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.88; }
  .hero h1 { margin: 5px 0 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .hero-sub { margin-top: 3px; font-size: 9.5px; opacity: 0.92; }
  .hero-meta {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px 12px;
    padding: 9px 16px 10px;
    background: #ecfdf5;
    font-size: 8px;
  }
  .hero-meta b {
    display: block;
    color: #047857;
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1px;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin-bottom: 12px;
  }
  .kpi {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 7px 9px;
    background: #f8fafc;
  }
  .kpi .n { font-size: 15px; font-weight: 800; color: #0f766e; line-height: 1.1; }
  .kpi .l { font-size: 7px; color: #64748b; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    align-items: center;
    margin-bottom: 10px;
    padding: 7px 10px;
    border-radius: 8px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    font-size: 7.5px;
    color: #92400e;
  }
  .lg { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
  .lg i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .lg.g i { background: #a7f3d0; border: 1px solid #34d399; }
  .lg.e i { background: #fde68a; border: 1px solid #fbbf24; }
  section { margin-bottom: 14px; page-break-inside: avoid; }
  section h2 {
    font-size: 10.5px;
    font-weight: 800;
    color: #0f766e;
    margin: 0 0 7px;
    padding-bottom: 4px;
    border-bottom: 2px solid #99f6e4;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  section h2 .cnt {
    font-size: 7.5px;
    font-weight: 700;
    background: #ccfbf1;
    color: #0f766e;
    padding: 2px 7px;
    border-radius: 999px;
  }
  .wrap { overflow-x: auto; }
  table.matrix { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
  table.matrix th, table.matrix td {
    border: 1px solid #cbd5e1;
    padding: 4px 5px;
    vertical-align: top;
    word-wrap: break-word;
  }
  table.matrix thead th {
    background: #0f766e !important;
    color: #fff !important;
    font-weight: 700;
  }
  th.ch { min-width: 52px; }
  th.ch .cn { font-size: 7.5px; line-height: 1.2; }
  th.ch .ct { font-size: 6.5px; opacity: 0.9; font-weight: 500; margin-top: 2px; }
  th.rowh {
    background: #ecfdf5 !important;
    color: #134e4a !important;
    text-align: left;
    width: 84px;
    font-size: 7.5px;
    font-weight: 700;
  }
  table.matrix tbody tr:nth-child(even) td:not(.rowh) { background: #f8fafc; }
  td.cell.g { background: #d1fae5 !important; }
  td.cell.e { background: #fef9c3 !important; }
  .cell-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid #6ee7b7;
  }
  td.e .cell-top { border-bottom-color: #fcd34d; }
  td .m { font-size: 12px; font-weight: 800; color: #065f46; line-height: 1.1; }
  td.e .m { color: #92400e; }
  .cell-empty { font-size: 11px; font-weight: 800; text-align: center; color: #92400e; }
  .cell-cnt {
    font-size: 6px;
    font-weight: 700;
    color: #0f766e;
    background: #ecfdf5;
    border: 1px solid #99f6e4;
    border-radius: 999px;
    padding: 1px 5px;
    white-space: nowrap;
  }
  .hist { display: flex; flex-direction: column; gap: 3px; }
  .hist-row {
    border: 1px solid #a7f3d0;
    border-radius: 4px;
    padding: 3px 4px;
    background: rgba(255,255,255,0.55);
  }
  .hist-row.hist-latest {
    border-color: #059669;
    background: #ecfdf5;
    box-shadow: 0 0 0 1px rgba(5,150,105,0.15);
  }
  .hist-meta { display: flex; align-items: center; gap: 3px; margin-bottom: 2px; }
  .hist-n { font-size: 6px; font-weight: 800; color: #64748b; }
  .hist-main { display: flex; align-items: center; gap: 4px; margin-bottom: 1px; }
  .hist-val { font-size: 10px; font-weight: 800; color: #065f46; min-width: 14px; }
  .hist-st { font-size: 6.5px; font-weight: 600; color: #334155; }
  .hist-date, .hist-sys { font-size: 6px; color: #64748b; line-height: 1.35; }
  .hist-note {
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px dashed #94a3b8;
    font-size: 6px;
    color: #334155;
    line-height: 1.35;
    font-style: italic;
  }
  .badge {
    display: inline-block;
    font-size: 5.5px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .badge.latest { background: #059669; color: #fff; }
  .badge.ok { background: #059669; color: #fff; }
  .badge.no { background: #d97706; color: #fff; margin-top: 3px; }
  table.log { width: 100%; border-collapse: collapse; font-size: 7.5px; }
  table.log th, table.log td {
    border: 1px solid #cbd5e1;
    padding: 4px 5px;
    vertical-align: top;
    text-align: left;
  }
  table.log thead th { background: #0f766e !important; color: #fff !important; font-weight: 700; font-size: 7px; }
  table.log tbody tr:nth-child(even) td { background: #f8fafc; }
  table.log .log-latest td { background: #ecfdf5 !important; font-weight: 600; }
  table.log .log-val { font-weight: 800; text-align: center; white-space: nowrap; }
  table.log .log-pos { color: #047857; font-weight: 700; }
  table.log .log-neg { color: #b91c1c; font-weight: 700; }
  table.notes { width: 100%; border-collapse: collapse; font-size: 8px; }
  table.notes th, table.notes td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
  table.notes thead th { background: #1e40af !important; color: #fff !important; font-weight: 700; font-size: 7.5px; }
  table.notes tbody tr:nth-child(even) td { background: #f8fafc; }
  .np { color: #047857; font-weight: 800; text-align: center; background: #ecfdf5 !important; }
  .nn { color: #b91c1c; font-weight: 800; text-align: center; background: #fef2f2 !important; }
  .desc { font-size: 7px; color: #475569; max-width: 220px; line-height: 1.35; }
  .footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 7px;
    color: #64748b;
    text-align: center;
  }
  .hint {
    margin-top: 8px;
    padding: 7px 9px;
    border-radius: 6px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    font-size: 7px;
    color: #1e40af;
  }
  table.summary {
    width: 100%;
    border-collapse: collapse;
    font-size: 8px;
  }
  table.summary th, table.summary td {
    border: 1px solid #cbd5e1;
    padding: 6px 7px;
    vertical-align: middle;
    text-align: center;
  }
  table.summary thead th {
    background: #134e4a !important;
    color: #fff !important;
    font-weight: 700;
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  table.summary th.stu {
    text-align: left;
    min-width: 88px;
  }
  table.summary tbody tr:nth-child(even) td { background: #f8fafc; }
  table.summary tfoot td {
    background: #ecfdf5 !important;
    font-weight: 800;
    border-top: 2px solid #0f766e;
  }
  table.summary .big {
    font-size: 12px;
    font-weight: 900;
    line-height: 1.1;
    display: block;
  }
  table.summary .sub { font-size: 6px; color: #64748b; font-weight: 600; margin-top: 1px; }
  table.summary .pos .big { color: #047857; }
  table.summary .neg .big { color: #b91c1c; }
  table.summary .net-pos { background: #d1fae5 !important; }
  table.summary .net-neg { background: #fee2e2 !important; }
  table.summary .net-zero { background: #f1f5f9 !important; }
  table.summary .net-pos .big { color: #047857; }
  table.summary .net-neg .big { color: #b91c1c; }
  table.summary .violet .big { color: #6d28d9; }
  table.summary .teal .big { color: #0f766e; }
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-top: 10px;
  }
  .scard {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px 8px;
    background: #fff;
    text-align: center;
  }
  .scard .nm { font-size: 7px; font-weight: 700; color: #334155; margin-bottom: 4px; text-align: left; }
  .scard .row { display: flex; justify-content: space-around; gap: 4px; }
  .scard .cell { flex: 1; }
  .scard .cell b { display: block; font-size: 13px; font-weight: 900; line-height: 1; }
  .scard .cell span { font-size: 6px; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .scard .p b { color: #047857; }
  .scard .n b { color: #b91c1c; }
  .scard .t b { color: #0f766e; }
`;

export function buildEvalPrintHtml(input: EvalPrintInput): string {
  const { students, criteria, scores, notes } = input;

  let filledCells = 0;
  let totalScoreRecords = 0;
  for (const s of students) {
    for (const c of criteria) {
      const chain = scoresForStudentCriterion(scores, s.id, c.id);
      if (chain.length > 0) filledCells += 1;
      totalScoreRecords += chain.length;
    }
  }
  const noteStudents = students.filter((s) =>
    notes.some((n) => n.studentId === s.id && (n.noteType === 'positive' || n.noteType === 'negative')),
  ).length;

  const headTop = criteria
    .map(
      (c) =>
        `<th class="ch" scope="col"><div class="cn">${escapeHtml(c.name)}</div><div class="ct">${(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}</div></th>`,
    )
    .join('');

  const bodyRows = students
    .map((s) => {
      const cells = criteria.map((c) => buildMatrixCell(c, scoresForStudentCriterion(scores, s.id, c.id))).join('');
      return `<tr><th class="rowh" scope="row">${escapeHtml(s.name)}</th>${cells}</tr>`;
    })
    .join('');

  const scoreLogRows = students
    .flatMap((s) =>
      criteria.flatMap((c) => {
        const chain = scoresForStudentCriterion(scores, s.id, c.id);
        return chain.map((sc, idx) => ({ s, c, sc, idx, total: chain.length }));
      }),
    )
    .sort((a, b) => {
      const nameCmp = a.s.name.localeCompare(b.s.name, 'tr');
      if (nameCmp !== 0) return nameCmp;
      const critCmp = a.c.name.localeCompare(b.c.name, 'tr');
      if (critCmp !== 0) return critCmp;
      const d = (b.sc.noteDate ?? '').localeCompare(a.sc.noteDate ?? '');
      if (d !== 0) return d;
      return (b.sc.createdAt ?? '').localeCompare(a.sc.createdAt ?? '');
    })
    .map(({ s, c, sc, idx, total }) => {
      const n = total - idx;
      const isLatest = idx === 0;
      const val = formatScoreValue(c, sc.score);
      const status = formatScoreStatus(c, sc.score);
      const note = sc.note ? escapeHtml(sc.note) : '—';
      return `<tr class="${isLatest ? 'log-latest' : ''}">
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(c.name)}</td>
        <td class="log-val">${n}/${total}</td>
        <td>${escapeHtml(formatRecordDate(sc.noteDate))}</td>
        <td class="log-val">${escapeHtml(val)}</td>
        <td>${escapeHtml(status)}${isLatest ? ' <span class="badge latest">Son</span>' : ''}</td>
        <td>${note}</td>
        <td>${escapeHtml(formatSystemAt(sc.createdAt))}</td>
      </tr>`;
    })
    .join('');

  const noteLogRows = students
    .flatMap((s) =>
      notes
        .filter((n) => n.studentId === s.id && (n.noteType === 'positive' || n.noteType === 'negative'))
        .map((n) => ({ s, n })),
    )
    .sort((a, b) => {
      const nameCmp = a.s.name.localeCompare(b.s.name, 'tr');
      if (nameCmp !== 0) return nameCmp;
      return (b.n.noteDate ?? '').localeCompare(a.n.noteDate ?? '');
    })
    .map(({ s, n }) => {
      const isPos = n.noteType === 'positive';
      const typeLabel = isPos ? 'Olumlu (+)' : 'Olumsuz (−)';
      const desc = n.description ? escapeHtml(n.description) : '—';
      return `<tr>
        <td>${escapeHtml(s.name)}</td>
        <td class="${isPos ? 'log-pos' : 'log-neg'}">${typeLabel}</td>
        <td>${escapeHtml(formatRecordDate(n.noteDate))}</td>
        <td class="desc">${desc}</td>
      </tr>`;
    })
    .join('');

  const noteSummaryRows = students
    .map((s) => {
      const sn = notes.filter((n) => n.studentId === s.id && (n.noteType === 'positive' || n.noteType === 'negative'));
      const pos = sn.filter((n) => n.noteType === 'positive').length;
      const neg = sn.filter((n) => n.noteType === 'negative').length;
      return `<tr><td>${escapeHtml(s.name)}</td><td class="np">${pos}</td><td class="nn">${neg}</td><td>${pos + neg}</td></tr>`;
    })
    .join('');

  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  type StudentTotals = {
    name: string;
    pos: number;
    neg: number;
    noteNet: number;
    scoreRecords: number;
    filledCriteria: number;
    signNet: number;
    numericSum: number;
  };

  const studentTotals: StudentTotals[] = students.map((s) => {
    const sn = notes.filter((n) => n.studentId === s.id && (n.noteType === 'positive' || n.noteType === 'negative'));
    const pos = sn.filter((n) => n.noteType === 'positive').length;
    const neg = sn.filter((n) => n.noteType === 'negative').length;

    let scoreRecords = 0;
    let filledCriteria = 0;
    let signNet = 0;
    let numericSum = 0;

    for (const c of criteria) {
      const chain = scoresForStudentCriterion(scores, s.id, c.id);
      if (chain.length > 0) filledCriteria += 1;
      for (const sc of chain) {
        scoreRecords += 1;
        const crit = criteriaById.get(sc.criterionId) ?? sc.criterion;
        if ((crit?.scoreType ?? 'numeric') === 'sign') signNet += sc.score;
        else numericSum += sc.score;
      }
    }

  return {
      name: s.name,
      pos,
      neg,
      noteNet: pos - neg,
      scoreRecords,
      filledCriteria,
      signNet,
      numericSum,
    };
  });

  const grand = studentTotals.reduce(
    (a, r) => ({
      pos: a.pos + r.pos,
      neg: a.neg + r.neg,
      noteNet: a.noteNet + r.noteNet,
      scoreRecords: a.scoreRecords + r.scoreRecords,
      filledCriteria: a.filledCriteria + r.filledCriteria,
      signNet: a.signNet + r.signNet,
      numericSum: a.numericSum + r.numericSum,
    }),
    { pos: 0, neg: 0, noteNet: 0, scoreRecords: 0, filledCriteria: 0, signNet: 0, numericSum: 0 },
  );

  const formatNet = (n: number) => (n > 0 ? `+${n}` : String(n));

  const netClass = (n: number) => (n > 0 ? 'net-pos' : n < 0 ? 'net-neg' : 'net-zero');

  const studentSummaryTableRows = studentTotals
    .map((r) => {
      const signLabel = formatNet(r.signNet);
      const noteNetLabel = formatNet(r.noteNet);
      return `<tr>
        <th class="stu" scope="row">${escapeHtml(r.name)}</th>
        <td class="pos"><span class="big">${r.pos}</span><span class="sub">olumlu</span></td>
        <td class="neg"><span class="big">${r.neg}</span><span class="sub">olumsuz</span></td>
        <td class="${netClass(r.noteNet)}"><span class="big">${noteNetLabel}</span><span class="sub">not farkı</span></td>
        <td class="violet"><span class="big">${r.scoreRecords}</span><span class="sub">kayıt</span></td>
        <td class="teal"><span class="big">${r.filledCriteria}/${criteria.length}</span><span class="sub">dolu kriter</span></td>
        <td class="${netClass(r.signNet)}"><span class="big">${signLabel}</span><span class="sub">+/− puan</span></td>
        <td class="violet"><span class="big">${r.numericSum}</span><span class="sub">sayısal Σ</span></td>
      </tr>`;
    })
    .join('');

  const studentSummaryCards = studentTotals
    .map(
      (r) => `<div class="scard">
      <div class="nm">${escapeHtml(r.name)}</div>
      <div class="row">
        <div class="cell p"><b>${r.pos}</b><span>+ not</span></div>
        <div class="cell n"><b>${r.neg}</b><span>− not</span></div>
        <div class="cell t"><b>${formatNet(r.noteNet)}</b><span>net</span></div>
      </div>
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Değerlendirme raporu</title><style>${PRINT_STYLES}</style></head><body>
<div class="doc">
  <div class="hero">
    <div class="hero-top">
      <div class="hero-brand">Öğretmen Pro · Değerlendirme</div>
      <h1>Öğrenci değerlendirme raporu</h1>
      <div class="hero-sub">Kriter puanları ve hızlı not özeti</div>
    </div>
    <div class="hero-meta">
      <div><b>Okul</b> ${escapeHtml(input.schoolName)}</div>
      <div><b>Öğretmen</b> ${escapeHtml(input.teacherName)}</div>
      <div><b>Liste</b> ${escapeHtml(input.listLabel)}</div>
      <div><b>Şube / sınıf</b> ${escapeHtml(input.classLabel)}</div>
      <div><b>Ders filtresi</b> ${escapeHtml(input.subjectLabel)}</div>
      <div><b>Yazdırma</b> ${escapeHtml(input.printedAt)}</div>
      <div><b>Öğrenci</b> ${students.length} kişi</div>
      <div><b>Kriter</b> ${criteria.length} sütun</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="n">${students.length}</div><div class="l">Öğrenci</div></div>
    <div class="kpi"><div class="n">${criteria.length}</div><div class="l">Kriter</div></div>
    <div class="kpi"><div class="n">${filledCells}</div><div class="l">Dolu hücre</div></div>
    <div class="kpi"><div class="n">${totalScoreRecords}</div><div class="l">Toplam kayıt</div></div>
  </div>

  <div class="legend">
    <span class="lg g"><i></i> En az bir kayıt</span>
    <span class="lg e"><i></i> Kayıt yok</span>
    <span>Matris hücrelerinde tüm tarihler yeniden eskiye; «Son» en güncel kayıttır. Ayrıntılar aşağıdaki kayıt tablosunda.</span>
  </div>

  <section>
    <h2>Değerlendirme matrisi <span class="cnt">${students.length} × ${criteria.length}</span></h2>
    <div class="wrap">
      <table class="matrix">
        <thead><tr><th class="rowh" scope="col">Öğrenci</th>${headTop}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>Tüm kriter kayıtları <span class="cnt">${totalScoreRecords} kayıt</span></h2>
    ${
      scoreLogRows
        ? `<div class="wrap"><table class="log">
      <thead><tr>
        <th>Öğrenci</th><th>Kriter</th><th>Sıra</th><th>Kayıt tarihi</th><th>Puan</th><th>Durum</th><th>Not</th><th>Sistem</th>
      </tr></thead>
      <tbody>${scoreLogRows}</tbody>
    </table></div>`
        : '<p style="font-size:8px;color:#64748b;font-style:italic">Seçili öğrenci ve kriterlerde kayıt yok.</p>'
    }
  </section>

  <section>
    <h2>+ / − hızlı notlar <span class="cnt">${noteStudents} öğrenci</span></h2>
    <table class="notes" style="margin-bottom:10px">
      <thead><tr><th>Öğrenci</th><th>Olumlu</th><th>Olumsuz</th><th>Toplam</th></tr></thead>
      <tbody>${noteSummaryRows}</tbody>
    </table>
    ${
      noteLogRows
        ? `<div class="wrap"><table class="log">
      <thead><tr><th>Öğrenci</th><th>Tür</th><th>Tarih</th><th>Açıklama</th></tr></thead>
      <tbody>${noteLogRows}</tbody>
    </table></div>`
        : ''
    }
  </section>

  <section>
    <h2>Öğrenci özet toplamları <span class="cnt">${students.length} öğrenci</span></h2>
    <p style="font-size:7.5px;color:#64748b;margin:0 0 8px">Her öğrenci için hızlı not (+/−) sayıları, not farkı, kriter kayıt sayısı ve puan toplamları.</p>
    <div class="wrap">
      <table class="summary">
        <thead>
          <tr>
            <th class="stu">Öğrenci</th>
            <th>+ Not</th>
            <th>− Not</th>
            <th>Not net</th>
            <th>Kriter kayıt</th>
            <th>Dolu kriter</th>
            <th>+/− net</th>
            <th>Sayısal Σ</th>
          </tr>
        </thead>
        <tbody>${studentSummaryTableRows}</tbody>
        <tfoot>
          <tr>
            <th class="stu" scope="row">TOPLAM</th>
            <td class="pos"><span class="big">${grand.pos}</span></td>
            <td class="neg"><span class="big">${grand.neg}</span></td>
            <td class="${netClass(grand.noteNet)}"><span class="big">${formatNet(grand.noteNet)}</span></td>
            <td class="violet"><span class="big">${grand.scoreRecords}</span></td>
            <td class="teal"><span class="big">${grand.filledCriteria}</span></td>
            <td class="${netClass(grand.signNet)}"><span class="big">${formatNet(grand.signNet)}</span></td>
            <td class="violet"><span class="big">${grand.numericSum}</span></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="summary-cards">${studentSummaryCards}</div>
  </section>

  <div class="hint">Renkli hücreler için yazdırma penceresinde «Arka plan grafikleri» seçeneğini açın. PDF için hedef olarak «PDF olarak kaydet» kullanın.</div>
  <div class="footer">Bu rapor ${escapeHtml(input.printedAt)} tarihinde oluşturulmuştur.</div>
</div>
</body></html>`;
}

export function openEvalPrintWindow(html: string): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return w;
}
