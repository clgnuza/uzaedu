import { buildWeeklyHoursFromAssignments } from '../src/ders-dagit/class-section-canonical';
import { checkAssignmentCapacity } from '../src/ders-dagit/ders-dagit.assignment-capacity';

const hours = buildWeeklyHoursFromAssignments([
  { subject_name: 'Matematik', class_sections: ['12/A'], weekly_hours: 5 },
  { subject_name: 'Matematik', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 5 },
  { subject_name: 'Türk Dili', class_sections: ['12/A'], weekly_hours: 4 },
  { subject_name: 'Türk Dili', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 4 },
  { subject_name: 'Fizik', class_sections: ['AMP - 12/A (SAĞLIK HİZMETLERİ ALANI)'], weekly_hours: 3 },
]);
const keys = Object.keys(hours);
const total = keys.length === 1 ? hours[keys[0]!] : -1;
console.log('alias_dedup_ok', total === 12, 'total', total, 'keys', keys.length);

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
  teachers: [{ id: 't1', name: 'O', mandatory_weekly_hours: 40, max_extra_weekly_hours: 10 }],
  existing_assignments: assignments,
  proposed: {
    class_sections: ['12/A'],
    subject_name: 'Ek',
    weekly_hours: 1,
    biweekly: false,
    teacher_ids: ['t1'],
  },
});
const over = warnings.filter((w) => w.code.startsWith('CLASS_OVER'));
console.log('capacity_ok', over.length === 0, 'over_count', over.length);
if (over.length) console.log(over.map((w) => w.message).join('\n'));
process.exit(total === 12 && over.length === 0 ? 0 : 1);
