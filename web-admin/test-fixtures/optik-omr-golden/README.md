# Optik OMR altın görüntü seti

## Sentetik (CI)

`npm run test:optik-golden` — 10 omr-v4 senaryosu (`src/lib/optik-omr-golden-cases.ts`).

## Gerçek foto ekleme

1. `scripts/generate-optik-golden-ppm.ts` ile referans PPM üretin veya telefon fotoğrafını PPM’e çevirin.
2. `manifest.json` içine kayıt ekleyin:

```json
{
  "cases": [
    {
      "id": "okul-2025-01",
      "template": { "questionCount": 25, "choiceCount": 4 },
      "expected": { "1": "A", "2": "B" },
      "maxFalsePositives": 0
    }
  ]
}
```

3. Aynı `id` ile `okul-2025-01.ppm` dosyasını bu klasöre koyun.

PPM üretmek: `npx tsx scripts/generate-optik-golden-ppm.ts`
