'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Zap, Users, Award } from 'lucide-react';

const BADGES = [
  { Icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30', stroke: 'stroke-blue-200 dark:stroke-blue-950' },
  { Icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', stroke: 'stroke-amber-200 dark:stroke-amber-950' },
  { Icon: Users, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30', stroke: 'stroke-green-200 dark:stroke-green-950' },
  { Icon: Award, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30', stroke: 'stroke-violet-200 dark:stroke-violet-950' },
];

export function CommunityBadges() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Topluluk rozetleri</CardTitle>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-wrap gap-3 lg:gap-4">
          {BADGES.map(({ Icon, color, bg }, i) => (
            <div
              key={i}
              className={`flex items-center justify-center size-[50px] rounded-xl border ${bg} border-border`}
            >
              <Icon className={`size-6 ${color}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
