const STORAGE_KEY = 'optik_scan_sessions_v1';

export type OptikMcAnswer = { question: number; label: string; choice: number };

export type OptikScanSession = {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: string;
  kind: 'mc' | 'open';
  answers?: OptikMcAnswer[];
  mcConfidence?: number;
  mcAmbiguous?: number[];
  anchorScore?: number;
  keyText?: string;
  studentText?: string;
  grade?: { score: number; max_score: number; confidence: number };
  gradeMode?: string;
};

function readAll(): OptikScanSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OptikScanSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: OptikScanSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 80)));
}

export function listOptikScanSessions(): OptikScanSession[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOptikScanSession(id: string): OptikScanSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function saveOptikScanSession(session: OptikScanSession) {
  const items = readAll().filter((s) => s.id !== session.id);
  writeAll([session, ...items]);
}

export function deleteOptikScanSession(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearOptikScanSessions() {
  writeAll([]);
}

export function newSessionId() {
  return `optik_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatMcAnswersText(answers: Record<number, string>): string {
  return Object.entries(answers)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([q, lbl]) => `${q}\t${lbl}`)
    .join('\n');
}
