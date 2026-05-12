/**
 * 6245 özet motoru — backend ile aynı dosya mantığı; CI/yerel doğrulama.
 * Çalıştır: npx ts-node -r tsconfig-paths/register backend/tools/test-yolluk-engine.ts
 */
import { computeGecici, computeSurekli, computeYolluk, mergeDereceRates } from '../src/yolluk/yolluk-calculator.engine';

const defaultDaily = 80;
const rates = {
  default_daily_tl: defaultDaily,
  derece_daily_tl: mergeDereceRates(defaultDaily, null),
  km_daily_fraction: 0.05,
  memur_fixed_multiplier: 20,
  aile_per_multiplier: 10,
  aile_fixed_cap_multiplier: 40,
  rules_version: 'test',
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const g120 = computeGecici(rates, {
  kind: 'gecici',
  mission_days: 120,
  yol_masrafi_tl: 100,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 0,
  taksi_tl: 0,
});
assert(g120.total_tl === 8900, `gecici 120 gün: beklenen 8900, gelen ${g120.total_tl}`);

const s = computeSurekli(rates, {
  kind: 'surekli',
  mesafe_km: 100,
  aile_ferdi_sayisi: 2,
  ydm_km_mode: 'tam',
  tasit_ucreti_tl: 0,
});
assert(s.total_tl === 1600 + 1600 + 400, `surekli: beklenen 3600, gelen ${s.total_tl}`);

const sy = computeSurekli(rates, {
  kind: 'surekli',
  mesafe_km: 100,
  aile_ferdi_sayisi: 2,
  ydm_km_mode: 'yarim',
  tasit_ucreti_tl: 0,
});
assert(sy.total_tl === 3400, `surekli YDM yarım: beklenen 3400, gelen ${sy.total_tl}`);

const gD5 = computeGecici(rates, {
  kind: 'gecici',
  mission_days: 120,
  derece: 5,
  yol_masrafi_tl: 100,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 0,
  taksi_tl: 0,
});
assert(gD5.effective_daily_tl === 62, `derece 5 gündelik 62, gelen ${gD5.effective_daily_tl}`);
assert(gD5.total_tl === 6920, `gecici derece 5: beklenen 6920, gelen ${gD5.total_tl}`);

const u = computeYolluk(rates, {
  kind: 'gecici',
  mission_days: 0,
  yol_masrafi_tl: 0,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 0,
  taksi_tl: 0,
});
assert(u.total_tl === 0, 'sıfır gün');

console.log('yolluk engine OK');
