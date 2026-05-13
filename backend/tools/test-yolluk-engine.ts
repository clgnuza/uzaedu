/**
 * 6245 özet motoru — backend ile aynı dosya mantığı; CI/yerel doğrulama.
 * Çalıştır: npx ts-node -r tsconfig-paths/register backend/tools/test-yolluk-engine.ts
 */
import {
  computeDenetim,
  computeGecici,
  computeSurekli,
  computeYolluk,
  mergeDereceRates,
} from '../src/yolluk/yolluk-calculator.engine';

const defaultDaily = 80;
const dereceTest80 = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i + 1), 80])) as Record<string, number>;
const rates = {
  default_daily_tl: defaultDaily,
  derece_daily_tl: mergeDereceRates(defaultDaily, dereceTest80),
  ek_gosterge_daily_tl: {} as Record<string, number>,
  denetim_mission_day_cap: 30,
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
assert(s.total_tl === 3840, `surekli: beklenen 3840 (satır toplamları), gelen ${s.total_tl}`);

const sy = computeSurekli(rates, {
  kind: 'surekli',
  mesafe_km: 100,
  aile_ferdi_sayisi: 2,
  ydm_km_mode: 'yarim',
  tasit_ucreti_tl: 0,
});
assert(sy.total_tl === 3640, `surekli YDM yarım: beklenen 3640, gelen ${sy.total_tl}`);

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
assert(gD5.effective_daily_tl === 80, `derece 5 gündelik 80, gelen ${gD5.effective_daily_tl}`);
assert(gD5.total_tl === 8900, `gecici derece 5: beklenen 8900, gelen ${gD5.total_tl}`);

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

const bild = computeGecici(rates, {
  kind: 'gecici',
  mission_days: 0,
  yol_masrafi_tl: 300,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 0,
  taksi_tl: 0,
  derece: 4,
  bildirim: {
    kapsam: 'yurtici',
    rows: [{ gun_sayisi: 1, yevmiye_kodu: 3, tasit_ucret_tl: 300, doviz_cinsi_tl: 0, yer: 'A — B', tarih: '2026-12-01' }],
  },
});
assert(bild.gecici_bildirim?.rows?.length === 1, 'bildirim row');
assert(Math.abs(bild.total_tl - 653.33) < 0.02, `bildirim toplam: gelen ${bild.total_tl}`);

const dn = computeDenetim(rates, {
  kind: 'denetim',
  mission_days: 45,
  yol_masrafi_tl: 0,
  konaklama_tl: 0,
  diger_tl: 0,
  tasit_ucreti_tl: 0,
  taksi_tl: 0,
});
assert(dn.kind === 'denetim', 'denetim kind');
assert(dn.total_tl === 30 * 80, `denetim cap 30 gün: beklenen ${30 * 80}, gelen ${dn.total_tl}`);

console.log('yolluk engine OK');
