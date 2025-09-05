export interface EloTeamState { rating: number; }
export interface EloOptions { base?: number; k?: number; hfa?: number; fcsWeight?: number; }
const DEFAULTS: Required<EloOptions> = { base: 1500, k: 20, hfa: 65, fcsWeight: 0.6 };
function expectedScore(a: number, b: number) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
export function marginMultiplier(margin: number): number {
  const mm = Math.log(Math.abs(margin) + 1);
  return Math.min(2.5, mm);
}
export function updateElo(
  home: EloTeamState, away: EloTeamState, homePoints: number, awayPoints: number,
  neutralSite: boolean | null | undefined, isFbsVsFcs: boolean, opts?: EloOptions
) {
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  const homeAdj = home.rating + (neutralSite ? 0 : cfg.hfa);
  const awayAdj = away.rating;
  const homeExp = expectedScore(homeAdj, awayAdj);
  const awayExp = 1 - homeExp;
  const margin = (homePoints ?? 0) - (awayPoints ?? 0);
  const homeActual = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  const awayActual = 1 - homeActual;
  const mm = marginMultiplier(margin === 0 ? 1 : Math.abs(margin));
  const weight = isFbsVsFcs ? cfg.fcsWeight : 1.0;
  const deltaHome = cfg.k * mm * (homeActual - homeExp) * weight;
  const deltaAway = cfg.k * mm * (awayActual - awayExp) * weight;
  home.rating += deltaHome; away.rating += deltaAway;
}
