'use client';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'] as const;

type Entry = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

export function ProgramGridPreview({ entries, maxLesson = 8 }: { entries: Entry[]; maxLesson?: number }) {
  const byKey = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = `${e.day_of_week}-${e.lesson_num}`;
    const arr = byKey.get(k) ?? [];
    arr.push(e);
    byKey.set(k, arr);
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border p-2 text-left">Saat</th>
            {DAYS.map((d, i) => (
              <th key={d} className="border border-border p-2">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxLesson }, (_, li) => li + 1).map((lesson) => (
            <tr key={lesson}>
              <td className="border border-border bg-muted/30 p-2 font-medium">{lesson}</td>
              {DAYS.map((_, di) => {
                const cells = byKey.get(`${di + 1}-${lesson}`) ?? [];
                return (
                  <td key={di} className="border border-border p-1 align-top">
                    {cells.map((c, idx) => (
                      <div key={idx} className="mb-0.5 rounded bg-primary/10 px-1 py-0.5 leading-tight">
                        <span className="font-medium">{c.class_section}</span>
                        <br />
                        <span className="text-muted-foreground">{c.subject}</span>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
