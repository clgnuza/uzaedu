export function subjectColor(subject: string): { bg: string; border: string; text: string } {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    bg: `hsl(${hue} 55% 94%)`,
    border: `hsl(${hue} 45% 72%)`,
    text: `hsl(${hue} 35% 28%)`,
  };
}
