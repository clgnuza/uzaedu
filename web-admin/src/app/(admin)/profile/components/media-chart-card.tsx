'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DATA = [
  { ay: 'Oca', deger: 42 },
  { ay: 'Şub', deger: 38 },
  { ay: 'Mar', deger: 55 },
  { ay: 'Nis', deger: 48 },
  { ay: 'May', deger: 62 },
  { ay: 'Haz', deger: 58 },
  { ay: 'Tem', deger: 65 },
  { ay: 'Ağu', deger: 52 },
  { ay: 'Eyl', deger: 70 },
  { ay: 'Eki', deger: 68 },
  { ay: 'Kas', deger: 75 },
  { ay: 'Ara', deger: 82 },
];

export function MediaChartCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Medya / aktivite özeti</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[250px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 250 }}>
            <AreaChart data={DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="ay" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}
              />
              <Area
                type="monotone"
                dataKey="deger"
                name="Değer"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
