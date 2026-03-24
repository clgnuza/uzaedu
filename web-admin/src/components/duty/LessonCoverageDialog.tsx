'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Circle,
  Loader2,
  UserCheck,
  Zap,
  X,
  BookOpen,
  ChevronDown,
} from 'lucide-react';

interface CoverageUser {
  user_id: string;
  display_name: string | null;
  email: string;
}

interface CoverageItem {
  id: string;
  lesson_num: number;
  covered_by_user_id: string | null;
  covered_by: CoverageUser | null;
  suggestions: (CoverageUser & { free_lesson_count: number })[];
}

interface CoverageStatus {
  duty_slot_id: string;
  absent_teacher: CoverageUser;
  date: string;
  coverages: CoverageItem[];
  all_assigned: boolean;
  pending_count: number;
}

interface Props {
  dutySlotId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

export default function LessonCoverageDialog({ dutySlotId, onClose, onDone }: Props) {
  const { token } = useAuth();
  const [status, setStatus] = useState<CoverageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [assigningLesson, setAssigningLesson] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!dutySlotId || !token) return;
    setLoading(true);
    try {
      const data = await apiFetch<CoverageStatus>(`/duty/coverage?duty_slot_id=${dutySlotId}`, { token });
      setStatus(data);
    } catch {
      toast.error('Coverage durumu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [dutySlotId]);

  useEffect(() => {
    if (dutySlotId) fetchStatus();
  }, [dutySlotId, fetchStatus]);

  const handleAutoAssign = async () => {
    if (!dutySlotId || !token) return;
    setAutoLoading(true);
    try {
      const result = await apiFetch<{ assigned: number[]; pending_count: number; message?: string }>(
        '/duty/coverage/auto-assign',
        { method: 'POST', body: JSON.stringify({ duty_slot_id: dutySlotId }), token },
      );
      if (result.assigned && result.assigned.length > 0) {
        toast.success(`${result.assigned.length} ders saati otomatik atandı.`);
      } else {
        toast.info(result.message ?? 'Uygun öğretmen bulunamadı.');
      }
      await fetchStatus();
      if (result.pending_count === 0) onDone?.();
    } catch {
      toast.error('Otomatik atama başarısız.');
    } finally {
      setAutoLoading(false);
    }
  };

  const handleAssign = async (lessonNum: number, userId: string) => {
    if (!dutySlotId || !token) return;
    setAssigningLesson(lessonNum);
    setOpenDropdown(null);
    try {
      await apiFetch('/duty/coverage/assign', {
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: dutySlotId, lesson_num: lessonNum, user_id: userId }),
        token,
      });
      toast.success(`${lessonNum}. ders atandı.`);
      await fetchStatus();
    } catch {
      toast.error('Atama başarısız.');
    } finally {
      setAssigningLesson(null);
    }
  };

  const handleRemove = async (coverageId: string, lessonNum: number) => {
    if (!token) return;
    setAssigningLesson(lessonNum);
    try {
      await apiFetch(`/duty/coverage/${coverageId}`, { method: 'DELETE', token });
      toast.success(`${lessonNum}. ders ataması kaldırıldı.`);
      await fetchStatus();
    } catch {
      toast.error('Atama kaldırılamadı.');
    } finally {
      setAssigningLesson(null);
    }
  };

  if (!dutySlotId) return null;

  const dateLabel = status?.date
    ? new Date(status.date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-orange-500" />
              Ders Saati Bazlı Görevlendirme
            </h2>
            {status && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-medium text-gray-700">{status.absent_teacher.display_name ?? status.absent_teacher.email}</span>
                {dateLabel ? ` · ${dateLabel}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}

          {!loading && status && status.coverages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Circle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Bu öğretmen için ders programı yüklü değil.</p>
              <p className="text-xs mt-1">Ders programı yüklenirse boş saatler otomatik hesaplanır.</p>
            </div>
          )}

          {!loading && status && status.coverages.length > 0 && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <div className="flex-1">
                  <span className="font-medium text-amber-800">
                    {status.coverages.length} boş ders saati
                  </span>
                  <span className="text-amber-600 ml-2">
                    · {status.coverages.length - status.pending_count} atandı,{' '}
                    <span className={status.pending_count > 0 ? 'text-red-600 font-medium' : ''}>
                      {status.pending_count} bekliyor
                    </span>
                  </span>
                </div>
                {status.all_assigned && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                )}
              </div>

              {/* Coverage rows */}
              {status.coverages.map((cov) => {
                const isBusy = assigningLesson === cov.lesson_num;
                const isOpen = openDropdown === cov.lesson_num;

                return (
                  <div
                    key={cov.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      cov.covered_by_user_id
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Lesson badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            cov.covered_by_user_id
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cov.lesson_num}
                        </span>
                        <span className="text-xs text-gray-500">{cov.lesson_num}. ders</span>
                      </div>

                      {/* Assigned / picker */}
                      <div className="flex-1 min-w-0">
                        {cov.covered_by ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {cov.covered_by.display_name ?? cov.covered_by.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Atanmadı</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {cov.covered_by && (
                          <button
                            onClick={() => handleRemove(cov.id, cov.lesson_num)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                            title="Atamayı kaldır"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {/* Dropdown picker */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(isOpen ? null : cov.lesson_num)}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
                          >
                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            {cov.covered_by ? 'Değiştir' : 'Ata'}
                            <ChevronDown className="w-3 h-3" />
                          </button>

                          {isOpen && (
                            <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-xl shadow-lg w-56 py-1 max-h-52 overflow-y-auto">
                              {cov.suggestions.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-500">
                                  Bu saatte boş nöbetçi bulunamadı.
                                </div>
                              )}
                              {cov.suggestions.map((s) => (
                                <button
                                  key={s.user_id}
                                  onClick={() => handleAssign(cov.lesson_num, s.user_id)}
                                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between group"
                                >
                                  <span className="truncate text-gray-800">
                                    {s.display_name ?? s.email}
                                  </span>
                                  <span className="text-xs text-green-600 ml-2 shrink-0">
                                    {s.free_lesson_count > 0 ? `${s.free_lesson_count} boş` : 'boş'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Kapat
          </button>

          <div className="flex items-center gap-2">
            {status && status.pending_count > 0 && (
              <button
                onClick={handleAutoAssign}
                disabled={autoLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {autoLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Tümünü Otomatik Ata
              </button>
            )}
            {status?.all_assigned && (
              <button
                onClick={() => { onDone?.(); onClose(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Tamamlandı
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
