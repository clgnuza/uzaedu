'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DATA = [
  { name: 'Dersler', value: 44, color: 'var(--chart-1)' },
  { name: 'Duyurular', value: 32, color: 'var(--chart-2)' },
  { name: 'Ödevler', value: 18, color: 'var(--chart-3)' },
  { name: 'Raporlar', value: 12, color: 'var(--chart-4)' },
  { name: 'Diğer', value: 8, color: 'var(--chart-5)' },
];

export function ContributionsChartCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Katkı dağılımı</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center px-3 py-2">
        <div className="h-[200px] w-full max-w-[280px] min-w-[200px]">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 280, height: 200 }}>
            <PieChart>
              <Pie
                data={DATA}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}
                formatter={(value: number | undefined) => [`${value ?? 0}`, 'Adet']}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
