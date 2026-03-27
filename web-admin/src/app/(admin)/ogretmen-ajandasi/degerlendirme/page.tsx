'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Target,
  ChevronLeft,
  Users,
  List,
  Printer,
  ThumbsUp,
  ThumbsDown,
  X,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Info,
  Download,
  Trash2,
  Plus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Criterion = { id: string; name: string; maxScore: number; scoreType?: 'numeric' | 'sign'; description?: string | null };
type StudentList = { id: string; name: string; studentIds: string[] };
type Student = { id: string; name: string };
type Score = { id: string; criterionId: string; studentId: string; score: number; noteDate: string; criterion?: Criterion };
type StudentNote = { id: string; studentId: string; noteType: string; noteDate: string; description?: string | null; createdAt?: string };

const SAMPLE_CRITERIA: Criterion[] = [
  { id: 'demo-c1', name: 'Derse Katılım', maxScore: 5, scoreType: 'numeric' },
  { id: 'demo-c2', name: 'Ödev Teslimi', maxScore: 5, scoreType: 'sign' },
  { id: 'demo-c3', name: 'Sınav Başarısı', maxScore: 10, scoreType: 'numeric' },
];
const SAMPLE_STUDENTS: Student[] = [
  { id: 'demo-s1', name: 'Elif Kaya' },
  { id: 'demo-s2', name: 'Mehmet Demir' },
  { id: 'demo-s3', name: 'Zeynep Yılmaz' },
  { id: 'demo-s4', name: 'Ahmet Öztürk' },
  { id: 'demo-s5', name: 'Ayşe Çelik' },
];
const SAMPLE_LISTS: StudentList[] = [
  { id: 'demo-l1', name: '7-A Sınıfı', studentIds: ['demo-s1', 'demo-s2', 'demo-s3', 'demo-s4', 'demo-s5'] },
];
const SAMPLE_SCORES: Score[] = [
  { id: 'demo-sc1', criterionId: 'demo-c1', studentId: 'demo-s1', score: 4, noteDate: '', criterion: SAMPLE_CRITERIA[0] },
  { id: 'demo-sc2', criterionId: 'demo-c1', studentId: 'demo-s2', score: 3, noteDate: '', criterion: SAMPLE_CRITERIA[0] },
  { id: 'demo-sc3', criterionId: 'demo-c2', studentId: 'demo-s1', score: 5, noteDate: '', criterion: SAMPLE_CRITERIA[1] },
];
const SAMPLE_STUDENT_NOTES: StudentNote[] = [
  { id: 'demo-n1', studentId: 'demo-s1', noteType: 'positive', noteDate: '2025-03-14', description: 'Derse aktif katılım' },
  { id: 'demo-n2', studentId: 'demo-s1', noteType: 'positive', noteDate: '2025-03-10' },
  { id: 'demo-n3', studentId: 'demo-s1', noteType: 'negative', noteDate: '2025-03-08', description: 'Ödev eksik' },
  { id: 'demo-n4', studentId: 'demo-s2', noteType: 'negative', noteDate: '2025-03-12' },
];

export default function DegerlendirmePage() {
  const { me, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [lists, setLists] = useState<StudentList[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [studentNotes, setStudentNotes] = useState<StudentNote[]>([]);
  const [notesDetailStudent, setNotesDetailStudent] = useState<Student | null>(null);
  const [studentDetailStudent, setStudentDetailStudent] = useState<Student | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [criterionModalOpen, setCriterionModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [scoreModal, setScoreModal] = useState<{ student: Student; criterion: Criterion } | null>(null);
  const [showDemo, setShowDemo] = useState(true);
  const [demoNotesAdded, setDemoNotesAdded] = useState<StudentNote[]>([]);
  const [demoCriteriaAdded, setDemoCriteriaAdded] = useState<Criterion[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const listId = selectedListId?.startsWith('demo-') ? undefined : selectedListId;
    try {
      const res = await apiFetch<{ criteria: Criterion[]; lists: StudentList[]; students: Student[]; scores: Score[]; studentNotes?: StudentNote[] }>(
        `/teacher-agenda/evaluation${listId ? `?listId=${listId}` : ''}`,
        { token },
      );
      setCriteria(res.criteria ?? []);
      setLists(res.lists ?? []);
      setStudents(res.students ?? []);
      setScores(res.scores ?? []);
      setStudentNotes(res.studentNotes ?? []);
    } catch {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, selectedListId]);

  const useDemo = showDemo && criteria.length === 0 && lists.length === 0 && students.length === 0;
  const displayCriteria = useDemo ? [...SAMPLE_CRITERIA, ...demoCriteriaAdded] : criteria;
  const displayLists = useDemo ? SAMPLE_LISTS : lists;
  const displayStudentsResolved = useDemo ? SAMPLE_STUDENTS : students;
  const displayScores = useDemo ? SAMPLE_SCORES : scores;
  const displayStudentNotes = useDemo ? [...SAMPLE_STUDENT_NOTES, ...demoNotesAdded] : studentNotes;
  const getNotesForStudent = (studentId: string) => displayStudentNotes.filter((n) => n.studentId === studentId);
  const filteredStudents = studentSearch.trim()
    ? displayStudentsResolved.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
    : displayStudentsResolved;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getScore = (studentId: string, criterionId: string) =>
    displayScores.find((s) => s.studentId === studentId && s.criterionId === criterionId);

  const handleAddScore = async (studentId: string, criterionId: string, score: number) => {
    if (studentId.startsWith('demo-') || criterionId.startsWith('demo-')) { toast.info('Örnek veri düzenlenemez'); return; }
    if (!token) return;
    try {
      await apiFetch('/teacher-agenda/evaluation/scores', {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, criterionId, score, noteDate: today }),
      });
      toast.success('Puan eklendi');
      setScoreModal(null);
      fetchData();
    } catch {
      toast.error('Eklenemedi');
    }
  };

  const handleQuickNote = async (studentId: string, studentName: string, noteType: 'positive' | 'negative', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (studentId.startsWith('demo-')) {
      setDemoNotesAdded((prev) => [{ id: `demo-n-${Date.now()}`, studentId, noteType, noteDate: today }, ...prev]);
      toast.success(`${studentName}: ${noteType === 'positive' ? 'Olumlu' : 'Olumsuz'} not eklendi`);
      return;
    }
    if (!token) return;
    try {
      const created = await apiFetch<StudentNote>('/teacher-agenda/student-notes', {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, noteType, noteDate: today }),
      });
      toast.success(`${studentName}: ${noteType === 'positive' ? 'Olumlu' : 'Olumsuz'} not eklendi`);
      setStudentNotes((prev) => [{ ...created, studentId, noteType, noteDate: today }, ...prev]);
      fetchData();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message) : '';
      toast.error(msg || 'Eklenemedi');
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    if (criterionId.startsWith('demo-')) { toast.info('Örnek veri silinemez'); return; }
    if (!token) return;
    try {
      await apiFetch(`/teacher-agenda/evaluation/criteria/${criterionId}`, { method: 'DELETE', token });
      toast.success('Kriter silindi');
      setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
      setDemoCriteriaAdded((prev) => prev.filter((c) => c.id !== criterionId));
    } catch {
      toast.error('Silinemedi');
    }
  };

  const handlePrint = () => {
    const rows = displayStudentsResolved.map((s) => {
      const row = [s.name];
      displayCriteria.forEach((c) => {
        const sc = getScore(s.id, c.id);
        if (!sc) row.push('-');
        else if ((c.scoreType ?? 'numeric') === 'sign') row.push(sc.score === 1 ? '+' : sc.score === -1 ? '−' : '·');
        else row.push(String(sc.score));
      });
      return `<tr><td>${row.join('</td><td>')}</td></tr>`;
    }).join('');
    const headers = ['Öğrenci', ...displayCriteria.map((c) => c.name)].map((h) => `<th>${h}</th>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Öğrenci Değerlendirme</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}@media print{body{padding:0}}</style></head><body><h1>Öğrenci Değerlendirme – ${format(new Date(), 'd MMMM yyyy', { locale: tr })}</h1><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Pop-up engellendi'); return; }
    w.document.write(html);
    w.document.close();
    w.print();
  };

  if (!me || me.role !== 'teacher') {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6 pb-24 sm:pb-0">
      <Toolbar>
        <ToolbarHeading>
          <Link href="/ogretmen-ajandasi" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ChevronLeft className="size-4" />
            Öğretmen Ajandası
          </Link>
          <ToolbarPageTitle className="text-xl sm:text-2xl font-bold tracking-tight">Öğrenci Değerlendirme</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Kriterler', icon: Target },
              { label: 'Listeler', icon: List },
              { label: 'Yazdır', icon: Printer },
              { label: 'Hızlı not', icon: ThumbsUp },
            ]}
            summary="Başarı kriterleri, liste yönetimi ve hızlı +/- not verme."
          />
        </ToolbarHeading>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setCriterionModalOpen(true)} className="rounded-xl">
            <Target className="size-4 mr-1" />
            Kriter Ekle
          </Button>
          <Button variant="outline" size="sm" onClick={() => setListModalOpen(true)} className="rounded-xl">
            <List className="size-4 mr-1" />
            Liste Ekle
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl">
            <Printer className="size-4 mr-1" />
            Yazdır
          </Button>
        </div>
      </Toolbar>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kriterler</span>
        {displayCriteria.map((c, i) => (
          <span
            key={c.id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium group',
              i % 3 === 0 && 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
              i % 3 === 1 && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
              i % 3 === 2 && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
            )}
          >
            {c.name}
            <span className="text-xs opacity-80">
              {(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}
            </span>
            {!c.id.startsWith('demo-') && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteCriterion(c.id); }}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100"
                title="Kriteri sil"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setCriterionModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
          title="Yeni kriter ekle"
        >
          <Plus className="size-4" />
          Kriter Ekle
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Liste</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedListId(null)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-all',
              !selectedListId ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/80 hover:bg-muted',
            )}
          >
            Tüm Öğrenciler
          </button>
          {displayLists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedListId(l.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                selectedListId === l.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/80 hover:bg-muted',
              )}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Target className="size-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium">Yükleniyor...</p>
        </div>
      ) : (
        <Card className="overflow-hidden border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 bg-muted/20">
            <CardTitle className="text-base font-semibold">Değerlendirme Tablosu</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Öğrenci ara..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-40 sm:w-48 pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-sm"
                />
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {filteredStudents.length} / {displayStudentsResolved.length} öğrenci
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 table-x-scroll">
            {useDemo && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-2.5 mx-4 mt-2 text-sm text-muted-foreground flex items-center justify-between">
                <span className="font-medium text-primary">Örnek veriler gösteriliyor.</span>
                <Button variant="ghost" size="sm" onClick={() => setShowDemo(false)}>Gizle</Button>
              </div>
            )}
            {displayStudentsResolved.length === 0 ? (
              <div className="py-20 text-center">
                <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground mb-1">Öğrenci yok</p>
                <p className="text-sm text-muted-foreground mb-4">Liste seçin veya yeni liste oluşturun.</p>
                <Button size="sm" onClick={() => setListModalOpen(true)} className="rounded-xl">
                  <List className="size-4 mr-1" />
                  Liste Ekle
                </Button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>
                {studentSearch} ile eşleşen öğrenci bulunamadı.
              </p>
              </div>
            ) : (
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="text-left px-4 py-3.5 font-semibold sticky left-0 bg-muted/50 z-10 rounded-tl-lg">Öğrenci</th>
                    <th className="text-center px-2 py-3.5 min-w-[100px]">+ / − Notlar</th>
                    {displayCriteria.map((c) => (
                      <th key={c.id} className="text-center px-2 py-3.5 min-w-[64px] font-medium group/cell">
                        <div className="flex items-center justify-center gap-1">
                          {c.name}
                          {!c.id.startsWith('demo-') && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCriterion(c.id); }}
                              className="p-1 rounded opacity-0 group-hover/cell:opacity-100 hover:bg-destructive/20 text-destructive"
                              title="Kriteri sil"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="text-center px-2 py-3.5 min-w-[64px]">
                      <button
                        type="button"
                        onClick={() => setCriterionModalOpen(true)}
                        className="inline-flex items-center justify-center size-9 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                        title="Yeni kriter ekle"
                      >
                        <Plus className="size-4" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => (
                    <tr key={s.id} className={cn(
                      'border-b border-border transition-colors group/row',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                      'hover:bg-muted/40',
                    )}>
                      <td
                        className={cn(
                          'px-4 py-3.5 font-medium sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:text-primary hover:underline',
                          idx % 2 === 0 ? 'bg-background group-hover/row:bg-muted/40' : 'bg-muted/20 group-hover/row:bg-muted/40',
                        )}
                        onClick={() => setStudentDetailStudent(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setStudentDetailStudent(s)}
                      >
                        {s.name}
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleQuickNote(s.id, s.name, 'positive', e)}
                              className="p-2 rounded-xl hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                              title="Olumlu not ekle"
                            >
                              <ThumbsUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickNote(s.id, s.name, 'negative', e)}
                              className="p-2 rounded-xl hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                              title="Olumsuz not ekle"
                            >
                              <ThumbsDown className="size-4" />
                          </button>
                          </div>
                          {(() => {
                            const notes = getNotesForStudent(s.id);
                            const pos = notes.filter((n) => n.noteType === 'positive').length;
                            const neg = notes.filter((n) => n.noteType === 'negative').length;
                            if (notes.length === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setNotesDetailStudent(s)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium bg-muted/60 hover:bg-muted transition-colors"
                                title="Detayları görüntüle"
                              >
                                <span className="text-emerald-600 dark:text-emerald-400">+{pos}</span>
                                <span className="text-red-600 dark:text-red-400">−{neg}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                      {displayCriteria.map((c) => {
                        const sc = getScore(s.id, c.id);
                        return (
                          <td
                            key={c.id}
                            className="px-2 py-3.5 text-center cursor-pointer group"
                            onClick={() => setScoreModal({ student: s, criterion: c })}
                            title={`${s.name} – ${c.name}: Puan ver`}
                          >
                            {sc ? (
                              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary font-semibold group-hover:bg-primary/25 transition-colors">
                                {(c.scoreType ?? 'numeric') === 'sign'
                                  ? (sc.score === 1 ? '+' : sc.score === -1 ? '−' : '·')
                                  : sc.score}
                              </span>
                            ) : (
                              <span className="inline-flex size-9 items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-xs group-hover:border-primary/40 group-hover:text-primary/70 transition-colors">
                                +
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-3.5" />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {criterionModalOpen && (
        <CriterionModal
          onClose={() => setCriterionModalOpen(false)}
          onSuccess={(created) => {
            setCriterionModalOpen(false);
            if (created) {
              if (useDemo) setDemoCriteriaAdded((prev) => [...prev, created]);
              else setCriteria((prev) => [...prev, created]);
            } else fetchData();
          }}
          token={token}
        />
      )}
      {listModalOpen && (
        <ListModal
          token={token}
          onClose={() => setListModalOpen(false)}
          onSuccess={() => { setListModalOpen(false); fetchData(); }}
        />
      )}
      {studentDetailStudent && (
        <StudentDetailModal
          student={studentDetailStudent}
          notes={getNotesForStudent(studentDetailStudent.id)}
          scores={displayScores.filter((sc) => sc.studentId === studentDetailStudent.id)}
          onClose={() => setStudentDetailStudent(null)}
          onAddNote={(type) => handleQuickNote(studentDetailStudent.id, studentDetailStudent.name, type)}
        />
      )}
      {notesDetailStudent && (
        <StudentNotesDetailModal
          student={notesDetailStudent}
          notes={getNotesForStudent(notesDetailStudent.id)}
          onClose={() => setNotesDetailStudent(null)}
          onAddNote={async (type) => { await handleQuickNote(notesDetailStudent.id, notesDetailStudent.name, type); fetchData(); }}
        />
      )}
      {scoreModal && (
        <ScoreModal
          student={scoreModal.student}
          criterion={scoreModal.criterion}
          currentScore={getScore(scoreModal.student.id, scoreModal.criterion.id)?.score}
          onClose={() => setScoreModal(null)}
          onSubmit={(score) => handleAddScore(scoreModal.student.id, scoreModal.criterion.id, score)}
        />
      )}
    </div>
  );
}

function StudentDetailModal({
  student,
  notes,
  scores,
  onClose,
  onAddNote,
}: {
  student: Student;
  notes: StudentNote[];
  scores: Score[];
  onClose: () => void;
  onAddNote: (type: 'positive' | 'negative') => void;
}) {
  type TimelineItem = { type: 'note'; date: string; noteType: string; description?: string } | { type: 'score'; date: string; criterionName: string; score: number; scoreType?: 'numeric' | 'sign' };
  const items: TimelineItem[] = [
    ...notes.map((n) => ({ type: 'note' as const, date: n.noteDate, noteType: n.noteType, description: n.description ?? undefined })),
    ...scores.map((s) => ({ type: 'score' as const, date: s.noteDate, criterionName: s.criterion?.name ?? '-', score: s.score, scoreType: s.criterion?.scoreType })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const pos = notes.filter((n) => n.noteType === 'positive').length;
  const neg = notes.filter((n) => n.noteType === 'negative').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">
              +{pos} olumlu, −{neg} olumsuz · {scores.length} kriter puanı
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 p-4 border-b border-border">
          <Button size="sm" onClick={() => onAddNote('positive')} className="rounded-xl flex-1">
            <ThumbsUp className="size-4 mr-1" />
            + Ekle
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAddNote('negative')} className="rounded-xl flex-1">
            <ThumbsDown className="size-4 mr-1" />
            − Ekle
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Tüm veriler (tarihe göre)</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz veri yok.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-4 py-3 border',
                    it.type === 'note'
                      ? it.noteType === 'positive'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                      : 'bg-violet-500/5 border-violet-500/20',
                  )}
                >
                  {it.type === 'note' ? (
                    <>
                      <span className={cn('shrink-0 font-bold', it.noteType === 'positive' ? 'text-emerald-600' : 'text-red-600')}>
                        {it.noteType === 'positive' ? '+' : '−'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.date ? format(new Date(it.date), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                        {it.description && <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 font-bold text-violet-600">
                        {it.scoreType === 'sign' ? (it.score === 1 ? '+' : it.score === -1 ? '−' : '·') : it.score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{it.criterionName}</p>
                        <p className="text-xs text-muted-foreground">{it.date ? format(new Date(it.date), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentNotesDetailModal({
  student,
  notes,
  onClose,
  onAddNote,
}: {
  student: Student;
  notes: StudentNote[];
  onClose: () => void;
  onAddNote: (type: 'positive' | 'negative') => void;
}) {
  const pos = notes.filter((n) => n.noteType === 'positive');
  const neg = notes.filter((n) => n.noteType === 'negative');
  const sorted = [...notes].sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? ''));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="text-sm text-muted-foreground">
              +{pos.length} olumlu, −{neg.length} olumsuz
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 p-4 border-b border-border">
          <Button size="sm" onClick={() => onAddNote('positive')} className="rounded-xl flex-1">
            <ThumbsUp className="size-4 mr-1" />
            + Ekle
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAddNote('negative')} className="rounded-xl flex-1">
            <ThumbsDown className="size-4 mr-1" />
            − Ekle
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz not yok.</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-4 py-3 border',
                    n.noteType === 'positive' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20',
                  )}
                >
                  <span className={cn('shrink-0 font-bold', n.noteType === 'positive' ? 'text-emerald-600' : 'text-red-600')}>
                    {n.noteType === 'positive' ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.noteDate ? format(new Date(n.noteDate), 'd MMM yyyy', { locale: tr }) : '-'}</p>
                    {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreModal({
  student,
  criterion,
  currentScore,
  onClose,
  onSubmit,
}: {
  student: Student;
  criterion: Criterion;
  currentScore?: number;
  onClose: () => void;
  onSubmit: (score: number) => void;
}) {
  const isSign = (criterion.scoreType ?? 'numeric') === 'sign';
  const [score, setScore] = useState<number>(
    currentScore ?? (isSign ? 0 : 0),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{isSign ? 'Değerlendir' : 'Puan Ver'}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="rounded-xl bg-muted/50 px-4 py-2.5 mb-4">
          <p className="font-medium">{student.name}</p>
          <p className="text-sm text-muted-foreground">{criterion.name}</p>
        </div>
        {isSign ? (
          <div className="flex gap-2 mb-5">
            {[
              { v: 1, label: '+', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30' },
              { v: 0, label: '·', cls: 'bg-muted hover:bg-muted/80' },
              { v: -1, label: '−', cls: 'bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30' },
            ].map(({ v, label, cls }) => (
              <button
                key={v}
                type="button"
                onClick={() => setScore(v)}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold transition-all',
                  cls,
                  score === v && 'ring-2 ring-offset-2 ring-primary scale-105',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap mb-5">
            {Array.from({ length: criterion.maxScore + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={cn(
                  'size-11 rounded-xl font-semibold transition-all',
                  score === i ? 'bg-primary text-primary-foreground scale-105 shadow-md' : 'bg-muted hover:bg-muted/80',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">İptal</Button>
          <Button onClick={() => onSubmit(score)} className="rounded-xl">Kaydet</Button>
        </div>
      </div>
    </div>
  );
}

function CriterionModal({ onClose, onSuccess, token }: { onClose: () => void; onSuccess: (created?: Criterion) => void; token: string | null }) {
  const [name, setName] = useState('');
  const [maxScore, setMaxScore] = useState(5);
  const [scoreType, setScoreType] = useState<'numeric' | 'sign'>('numeric');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    try {
      const created = await apiFetch<Criterion>('/teacher-agenda/evaluation/criteria', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim(), maxScore, scoreType }),
      });
      toast.success('Kriter eklendi');
      onSuccess(created);
    } catch {
      toast.error('Eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Başarı Kriteri Ekle</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kriter Adı *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5"
              placeholder="örn: Derse Katılım"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Değerlendirme türü</label>
            <div className="flex gap-2 mt-1">
              <label className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors',
                scoreType === 'numeric' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
              )}>
                <input type="radio" name="scoreType" value="numeric" checked={scoreType === 'numeric'} onChange={() => setScoreType('numeric')} className="sr-only" />
                <span className="font-medium">Puan (0–max)</span>
              </label>
              <label className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors',
                scoreType === 'sign' ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted/50',
              )}>
                <input type="radio" name="scoreType" value="sign" checked={scoreType === 'sign'} onChange={() => setScoreType('sign')} className="sr-only" />
                <span className="font-medium">+ / −</span>
              </label>
            </div>
          </div>
          {scoreType === 'numeric' && (
            <div>
              <label className="block text-sm font-medium mb-1">Maksimum Puan</label>
              <select
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5"
              >
                {[1, 2, 3, 4, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">İptal</Button>
            <Button type="submit" disabled={loading || !name.trim()} className="rounded-xl">Kaydet</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ListModal({ token, onClose, onSuccess }: { token: string | null; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ students: Student[] }>('/teacher-agenda/evaluation', { token })
      .then((r) => setStudents(r.students ?? []))
      .catch(() => setStudents([]));
  }, [token]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(students.map((s) => s.id)));
  const selectNone = () => setSelectedIds(new Set());

  const matchByName = (excelName: string): Student | null => {
    const n = String(excelName ?? '').trim();
    if (!n) return null;
    const lower = n.toLowerCase();
    const exact = students.find((s) => s.name.toLowerCase() === lower);
    if (exact) return exact;
    const partial = students.find((s) => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase()));
    return partial ?? null;
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) throw new Error('Dosya okunamadı');
        const wb = XLSX.read(data, { type: 'binary' });
        const first = wb.SheetNames[0];
        if (!first) throw new Error('Boş dosya');
        const ws = wb.Sheets[first];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][];
        const names: string[] = [];
        const header = rows[0]?.map((c) => String(c ?? '').toLowerCase()) ?? [];
        const nameColIdx = header.findIndex((h) => /ad|soyad|isim|öğrenci|name/i.test(h));
        const colIdx = nameColIdx >= 0 ? nameColIdx : 0;
        for (let i = nameColIdx >= 0 ? 1 : 0; i < rows.length; i++) {
          const cell = rows[i]?.[colIdx];
          const val = typeof cell === 'number' ? String(cell) : String(cell ?? '').trim();
          if (val) names.push(val);
        }
        const matched = new Set<string>();
        const unmatched: string[] = [];
        for (const n of names) {
          const s = matchByName(n);
          if (s) matched.add(s.id);
          else unmatched.push(n);
        }
        setSelectedIds((prev) => {
          const next = new Set(prev);
          matched.forEach((id) => next.add(id));
          return next;
        });
        if (unmatched.length > 0) {
          setExcelError(`${unmatched.length} öğrenci eşleşmedi: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '...' : ''}`);
        } else {
          toast.success(`${matched.size} öğrenci listeye eklendi`);
        }
      } catch (err) {
        setExcelError(err instanceof Error ? err.message : 'Excel okunamadı');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Ad Soyad'], ['Ahmet Yılmaz'], ['Ayşe Demir'], ['Mehmet Kaya']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Öğrenciler');
    XLSX.writeFile(wb, 'ogrenci_listesi_ornek.xlsx');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/teacher-agenda/evaluation/lists', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: name.trim(), studentIds: Array.from(selectedIds) }),
      });
      toast.success('Liste eklendi');
      onSuccess();
    } catch {
      toast.error('Eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] p-6 flex flex-col border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Öğrenci Listesi Ekle</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex gap-2">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">Excel ile toplu ekleme</p>
            <p>İlk sütunda &quot;Ad Soyad&quot; başlığı ve altında öğrenci adları olan .xlsx dosyası yükleyebilirsiniz. Öğrenci adları sistemdeki kayıtlarla eşleştirilir.</p>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
            <FileSpreadsheet className="size-4 mr-1.5" />
            Excel Yükle
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={downloadSample} className="rounded-xl text-muted-foreground">
            <Download className="size-4 mr-1.5" />
            Örnek İndir
          </Button>
        </div>
        {excelError && (
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{excelError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Liste Adı *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5"
              placeholder="örn: Proje Grubu, 7-A Sınıfı"
              required
            />
          </div>
          <div className="flex-1 overflow-y-auto mb-4 max-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Öğrenciler ({selectedIds.size} seçili)</label>
              <div className="flex gap-1">
                <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">Tümünü seç</button>
                <span className="text-muted-foreground">|</span>
                <button type="button" onClick={selectNone} className="text-xs text-muted-foreground hover:underline">Kaldır</button>
              </div>
            </div>
            <div className="space-y-0.5 rounded-xl border border-border overflow-hidden">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 px-3 py-2.5 transition-colors">
                  {selectedIds.has(s.id) ? <CheckSquare className="size-4 text-primary shrink-0" /> : <Square className="size-4 text-muted-foreground shrink-0" />}
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggle(s.id)} className="sr-only" />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
              {students.length === 0 && <p className="text-sm text-muted-foreground px-3 py-4">Okulda öğrenci kaydı yok. Önce öğrenci ekleyin.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">İptal</Button>
            <Button type="submit" disabled={loading || !name.trim()} className="rounded-xl">
              Kaydet {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
