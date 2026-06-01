import { buildWeeklyHoursFromAssignments } from './class-section-canonical';
import { checkAssignmentCapacity } from './ders-dagit.assignment-capacity';

describe('buildWeeklyHoursFromAssignments', () => {
  it('does not double-count alias sections or duplicate subject rows', () => {
    const hours = buildWeeklyHoursFromAssignments([
      { subject_name: 'Matematik', class_sections: ['12/A'], weekly_hours: 5 },
      { subject_name: 'Matematik', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 5 },
      { subject_name: 'Türk Dili', class_sections: ['12/A'], weekly_hours: 4 },
      { subject_name: 'Türk Dili', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 4 },
      { subject_name: 'Fizik', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 3 },
    ]);
    const keys = Object.keys(hours);
    expect(keys).toHaveLength(1);
    expect(hours[keys[0]!]).toBe(12);
  });

  it('capacity check stays at or under 50 for 10/day profile', () => {
    const assignments = Array.from({ length: 9 }, (_, i) => ({
      id: `a${i}`,
      subject_name: `Ders ${i}`,
      class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)', '12/A'],
      weekly_hours: 5,
      biweekly: false,
      teacher_ids: ['t1'],
    }));
    const warnings = checkAssignmentCapacity({
      class_profiles: [
        {
          id: 'p1',
          name: '12',
          class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'],
          max_lessons_per_day: 10,
          max_weekly_lessons: 50,
        },
      ],
      teachers: [{ id: 't1', name: 'Öğretmen', mandatory_weekly_hours: 40, max_extra_weekly_hours: 10 }],
      existing_assignments: assignments,
      proposed: {
        class_sections: ['12/A'],
        subject_name: 'Ek',
        weekly_hours: 1,
        biweekly: false,
        teacher_ids: ['t1'],
      },
    });
    const over = warnings.filter((w) => w.code === 'CLASS_OVER_CAPACITY' || w.code === 'CLASS_OVER_MAX');
    expect(over).toHaveLength(0);
  });
});
