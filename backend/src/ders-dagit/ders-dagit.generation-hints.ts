export type GenerationViolationLink = { text: string; href?: string };

const RULE_KEYWORDS: Array<{ re: RegExp; href: string }> = [
  { re: /derslik|room/i, href: '/ders-dagit/stüdyo/derslikler' },
  { re: /bina|geçiş|building/i, href: '/ders-dagit/stüdyo/kurallar' },
  { re: /öğretmen|teacher|çalışma günü|hafta/i, href: '/ders-dagit/stüdyo/ogretmenler' },
  { re: /min .* gün|dağılım/i, href: '/ders-dagit/stüdyo/atamalar' },
  { re: /yerleşmedi|saat/i, href: '/ders-dagit/stüdyo/atamalar' },
  { re: /müzik|beden|meb|teori|pratik/i, href: '/ders-dagit/stüdyo/kurallar' },
  { re: /sabit slot/i, href: '/ders-dagit/stüdyo/atamalar' },
];

export function linkGenerationViolations(violations: string[]): GenerationViolationLink[] {
  return violations.map((text) => {
    const hit = RULE_KEYWORDS.find((k) => k.re.test(text));
    return { text, href: hit?.href ?? '/ders-dagit/stüdyo/kurallar' };
  });
}
