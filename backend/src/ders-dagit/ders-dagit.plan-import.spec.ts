import { aggregatePlanImportRows, mergePlanImportRows, subjectsFromPlanRows } from './ders-dagit.plan-import';

describe('aggregatePlanImportRows', () => {
  it('counts unique day+lesson slots per class and subject', () => {
    const entries = [
      { class_section: '10-A', subject: 'MATEMATİK', day_of_week: 1, lesson_num: 1, user_id: 't1' },
      { class_section: '10-A', subject: 'MATEMATİK', day_of_week: 1, lesson_num: 1, user_id: 't2' },
      { class_section: '10-A', subject: 'MATEMATİK', day_of_week: 2, lesson_num: 2, user_id: 't1' },
      { class_section: '10-A', subject: 'FİZİK', day_of_week: 1, lesson_num: 3, user_id: 't1' },
    ];
    const { rows } = aggregatePlanImportRows(entries);
    const mat = rows.find((r) => r.subject === 'MATEMATİK');
    const fiz = rows.find((r) => r.subject === 'FİZİK');
    expect(mat?.weekly_hours).toBe(2);
    expect(mat?.teacher_ids.sort()).toEqual(['t1', 't2'].sort());
    expect(fiz?.weekly_hours).toBe(1);
  });

  it('merges alias section labels into one bucket', () => {
    const entries = [
      { class_section: '9/A', subject: 'TÜRK DİLİ', day_of_week: 1, lesson_num: 1 },
      { class_section: 'AMP - 9/A (SAĞLIK)', subject: 'TÜRK DİLİ', day_of_week: 2, lesson_num: 1 },
    ];
    const { rows } = aggregatePlanImportRows(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.weekly_hours).toBe(2);
  });
});

describe('subjectsFromPlanRows', () => {
  it('merges class_hours for section aliases', () => {
    const rows = mergePlanImportRows([
      { subject: 'MATEMATİK', subject_raw: 'MATEMATİK', section: '9/A', weekly_hours: 3, teacher_ids: [] },
      { subject: 'MATEMATİK', subject_raw: 'MATEMATİK', section: 'AMP - 9/A (SAĞLIK)', weekly_hours: 2, teacher_ids: [] },
    ]);
    const subs = subjectsFromPlanRows(rows);
    expect(subs).toHaveLength(1);
    const hours = Object.values(subs[0]!.class_hours);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(5);
    expect(Object.keys(subs[0]!.class_hours)).toHaveLength(1);
  });
});
