import {
  aggregateBordroRows,
  BordroTable,
  cellToTc,
  readBordroTable,
  rowPersonName,
  resolveColumns,
  XRow,
} from './bordro-excel';

export type BordroCompareRow = {
  tc: string;
  name: string;
  mebbisHours: number;
  kbsHours: number;
  delta: number;
  status: 'ok' | 'mismatch' | 'mebbis_only' | 'kbs_only';
};

export type BordroCompareResult = {
  rows: BordroCompareRow[];
  summary: { ok: number; mismatch: number; mebbisOnly: number; kbsOnly: number };
  toleranceHours: number;
};

function hoursMapFromTable(table: BordroTable): Map<string, { name: string; hours: number }> {
  const groups = aggregateBordroRows(table);
  const out = new Map<string, { name: string; hours: number }>();
  for (const [, g] of groups) {
    if (!g.tc) continue;
    out.set(g.tc, { name: g.name, hours: g.totalHours });
  }
  return out;
}

export function compareMebbisKbsBuffers(
  mebbisBuf: Buffer,
  kbsBuf: Buffer,
  toleranceHours = 0.01,
): BordroCompareResult {
  const mebbisTable = readBordroTable(mebbisBuf, 'puantaj');
  const kbsTable = readBordroTable(kbsBuf, 'ek_bordro');
  return compareMebbisKbsTables(mebbisTable, kbsTable, toleranceHours);
}

export function compareMebbisKbsRows(
  mebbisHeaders: string[],
  mebbisRows: XRow[],
  kbsHeaders: string[],
  kbsRows: XRow[],
  toleranceHours = 0.01,
): BordroCompareResult {
  const mebbisTable: BordroTable = {
    rows: mebbisRows,
    headers: mebbisHeaders,
    format: 'generic',
    sheetName: 'mebbis',
  };
  const kbsTable: BordroTable = {
    rows: kbsRows,
    headers: kbsHeaders,
    format: 'generic',
    sheetName: 'kbs',
  };
  return compareMebbisKbsTables(mebbisTable, kbsTable, toleranceHours);
}

function compareMebbisKbsTables(
  mebbisTable: BordroTable,
  kbsTable: BordroTable,
  toleranceHours: number,
): BordroCompareResult {
  const mebbis = hoursMapFromTable(mebbisTable);
  const kbs = hoursMapFromTable(kbsTable);
  const allTc = new Set([...mebbis.keys(), ...kbs.keys()]);
  const rows: BordroCompareRow[] = [];

  for (const tc of allTc) {
    const m = mebbis.get(tc);
    const k = kbs.get(tc);
    const mebbisHours = m?.hours ?? 0;
    const kbsHours = k?.hours ?? 0;
    const name = m?.name || k?.name || tc;
    const delta = Math.round((mebbisHours - kbsHours) * 100) / 100;
    let status: BordroCompareRow['status'] = 'ok';
    if (!m) status = 'kbs_only';
    else if (!k) status = 'mebbis_only';
    else if (Math.abs(delta) > toleranceHours) status = 'mismatch';
    rows.push({ tc, name, mebbisHours, kbsHours, delta, status });
  }

  rows.sort((a, b) => {
    const order = { mismatch: 0, mebbis_only: 1, kbs_only: 2, ok: 3 };
    return order[a.status] - order[b.status] || Math.abs(b.delta) - Math.abs(a.delta);
  });

  return {
    rows,
    summary: {
      ok: rows.filter((r) => r.status === 'ok').length,
      mismatch: rows.filter((r) => r.status === 'mismatch').length,
      mebbisOnly: rows.filter((r) => r.status === 'mebbis_only').length,
      kbsOnly: rows.filter((r) => r.status === 'kbs_only').length,
    },
    toleranceHours,
  };
}

export type TcAuditRow = {
  name: string;
  tc?: string;
  inExcel: boolean;
  inSchoolDb: boolean;
  dbPhone?: string;
};

export function auditBordroTcAgainstSchool(
  table: BordroTable,
  dbTeachers: Array<{ name: string; tc: string; phone: string }>,
): { rows: TcAuditRow[]; missingInDb: number; missingInExcel: number } {
  const cols = resolveColumns(table.headers);
  const excelTc = new Set<string>();
  const excelNames = new Map<string, string>();

  for (const r of table.rows) {
    const tc = cols.tc ? cellToTc(r[cols.tc]) : null;
    const name = rowPersonName(r, cols, table.headers);
    if (tc) {
      excelTc.add(tc);
      excelNames.set(tc, name);
    }
  }

  const dbByTc = new Map(dbTeachers.map((t) => [t.tc?.trim(), t]));
  const rows: TcAuditRow[] = [];

  for (const tc of excelTc) {
    const db = dbByTc.get(tc);
    rows.push({
      name: excelNames.get(tc) || db?.name || tc,
      tc,
      inExcel: true,
      inSchoolDb: !!db,
      dbPhone: db?.phone,
    });
  }

  for (const db of dbTeachers) {
    const tc = db.tc?.trim();
    if (!tc || excelTc.has(tc)) continue;
    rows.push({
      name: db.name,
      tc,
      inExcel: false,
      inSchoolDb: true,
      dbPhone: db.phone,
    });
  }

  return {
    rows,
    missingInDb: rows.filter((r) => r.inExcel && !r.inSchoolDb).length,
    missingInExcel: rows.filter((r) => !r.inExcel && r.inSchoolDb).length,
  };
}
