'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  OPTIK_EXAM_TYPES,
  OPTIK_FORM_PRESETS,
  type OptikFormTemplate,
  slugifyOptikFormName,
} from '@/lib/optik-form-templates';

export type OptikFormEditorPayload = {
  name: string;
  slug: string;
  questionCount: number;
  choiceCount: number;
  examType: string;
  gradeLevel: string | null;
  subjectHint: string | null;
  description: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: OptikFormTemplate | null;
  saving: boolean;
  onSave: (payload: OptikFormEditorPayload) => Promise<void>;
};

export function OptikFormTemplateEditorDialog({ open, onOpenChange, initial, saving, onSave }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [choiceCount, setChoiceCount] = useState(5);
  const [examType, setExamType] = useState('genel');
  const [gradeLevel, setGradeLevel] = useState('');
  const [subjectHint, setSubjectHint] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSlug(initial?.slug ?? '');
    setSlugTouched(!!initial);
    setQuestionCount(initial?.questionCount ?? 20);
    setChoiceCount(initial?.choiceCount ?? 5);
    setExamType(initial?.examType ?? 'genel');
    setGradeLevel(initial?.gradeLevel ?? '');
    setSubjectHint(initial?.subjectHint ?? '');
    setDescription(initial?.description ?? '');
  }, [open, initial]);

  useEffect(() => {
    if (!slugTouched && name) setSlug(slugifyOptikFormName(name));
  }, [name, slugTouched]);

  const applyPreset = (p: (typeof OPTIK_FORM_PRESETS)[number]) => {
    setName(p.name);
    setSlug(p.slug);
    setSlugTouched(true);
    setQuestionCount(p.questionCount);
    setChoiceCount(p.choiceCount);
    setExamType(p.examType);
    setGradeLevel(p.gradeLevel ?? '');
    setSubjectHint(p.subjectHint ?? '');
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim() || slugifyOptikFormName(trimmedName);
    if (!trimmedName) return;
    await onSave({
      name: trimmedName,
      slug: trimmedSlug,
      questionCount: Math.min(200, Math.max(1, questionCount)),
      choiceCount: Math.min(6, Math.max(2, choiceCount)),
      examType,
      gradeLevel: gradeLevel.trim() || null,
      subjectHint: subjectHint.trim() || null,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Form şablonunu düzenle' : 'Özel form şablonu'}</DialogTitle>
        </DialogHeader>
        {!initial && (
          <div className="flex flex-wrap gap-1">
            {OPTIK_FORM_PRESETS.map((p) => (
              <Button key={p.slug} type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => applyPreset(p)}>
                {p.name}
              </Button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="optik-name">Ad</Label>
            <Input id="optik-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="optik-slug">Slug</Label>
            <Input
              id="optik-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="optik-q">Soru</Label>
              <Input
                id="optik-q"
                type="number"
                min={1}
                max={200}
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="optik-c">Şık</Label>
              <Input
                id="optik-c"
                type="number"
                min={2}
                max={6}
                value={choiceCount}
                onChange={(e) => setChoiceCount(parseInt(e.target.value, 10) || 2)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="optik-exam">Sınav türü</Label>
            <select
              id="optik-exam"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              {OPTIK_EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="optik-grade">Sınıf</Label>
              <Input id="optik-grade" placeholder="6-12, LGS…" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="optik-subject">Ders</Label>
              <Input id="optik-subject" placeholder="Matematik…" value={subjectHint} onChange={(e) => setSubjectHint(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="optik-desc">Açıklama</Label>
            <Input id="optik-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleSubmit()}>
            {saving ? <LoadingSpinner className="size-4" /> : initial ? 'Kaydet' : 'Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
