// src/metrics.ts
import type { Game } from './types';

export type DominanceInput = {
  games: Game[]; // use your shared Game type
  ppaByTeam: Map<string, { off: number; def: number }>;
  eloByTeam: Map<string, number>;
  fcsTeams?: Set<string>;
  fcsWeight?: number;
};

export type DominanceOutputs = {
  movAdj: Map<string, number>;
  offDom: Map<string, number>;
  defDom: Map<string, number>;
  zMov: Map<string, number>;
  zOff: Map<string, number>;
  zDef: Map<string, number>;
};

function logCapMargin(margin: number, cap = 28): number {
  const m = Math.max(-cap, Math.min(cap, margin));
  const s = Math.sign(m);
  return s * Math.log1p(Math.abs(m));
}

function zscoresMap(map: Map<string, number>): Map<string, number> {
  const vals = Array.from(map.values());
  if (!vals.length) return new Map();
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd =
    Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1)) || 1;
  const out = new Map<string, number>();
  map.forEach((v, k) => out.set(k, (v - mean) / sd));
  return out;
}

export function computeDominanceMetrics(input: DominanceInput): DominanceOutputs {
  const { games, ppaByTeam, eloByTeam } = input;

  const movSum = new Map<string, number>();
  const movCnt = new Map<string, number>();
  const offSum = new Map<string, number>();
  const offCnt = new Map<string, number>();
  const defSum = new Map<string, number>();
  const defCnt = new Map<string, number>();

  const add = (map: Map<string, number>, key: string, v: number) =>
    map.set(key, (map.get(key) ?? 0) + v);
  const addCnt = (map: Map<string, number>, key: string) =>
    map.set(key, (map.get(key) ?? 0) + 1);

  for (const g of games) {
    const hasPts = g.homePoints != null && g.awayPoints != null;
    const h = g.homeTeam,
      a = g.awayTeam;

    // MOV (log-capped, opponent-strength scaled)
    if (hasPts) {
      const marginH = (g.homePoints as number) - (g.awayPoints as number);
      const marginA = -marginH;
      const oppEloForH = eloByTeam.get(a) ?? 1500;
      const oppEloForA = eloByTeam.get(h) ?? 1500;
      const fH = Math.pow(oppEloForH / 1500, 0.25);
      const fA = Math.pow(oppEloForA / 1500, 0.25);
      const movH = logCapMargin(marginH) * fH;
      const movA = logCapMargin(marginA) * fA;
      add(movSum, h, movH);
      add(movSum, a, movA);
      addCnt(movCnt, h);
      addCnt(movCnt, a);
    }

    // Offensive dominance: team OFF vs opponent DEF allowed
    const hOff = ppaByTeam.get(h)?.off ?? 0;
    const aOff = ppaByTeam.get(a)?.off ?? 0;
    const hDefAllowed = ppaByTeam.get(h)?.def ?? 0;
    const aDefAllowed = ppaByTeam.get(a)?.def ?? 0;

    const offH = hOff - aDefAllowed;
    const offA = aOff - hDefAllowed;
    add(offSum, h, offH);
    add(offSum, a, offA);
    addCnt(offCnt, h);
    addCnt(offCnt, a);

    // Defensive dominance: opponent OFF minus team DEF allowed (higher = better defense)
    const defH = (ppaByTeam.get(a)?.off ?? 0) - hDefAllowed;
    const defA = (ppaByTeam.get(h)?.off ?? 0) - aDefAllowed;
    add(defSum, h, defH);
    add(defSum, a, defA);
    addCnt(defCnt, h);
    addCnt(defCnt, a);
  }

  // Averages
  const movAdj = new Map<string, number>();
  const offDom = new Map<string, number>();
  const defDom = new Map<string, number>();
  const allTeams = new Set<string>([
    ...movCnt.keys(),
    ...offCnt.keys(),
    ...defCnt.keys(),
    ...ppaByTeam.keys(),
    ...eloByTeam.keys(),
  ]);
  const avg = (sum: Map<string, number>, cnt: Map<string, number>, k: string) =>
    (sum.get(k) ?? 0) / Math.max(1, cnt.get(k) ?? 0);

  for (const t of allTeams) {
    movAdj.set(t, avg(movSum, movCnt, t));
    offDom.set(t, avg(offSum, offCnt, t));
    defDom.set(t, avg(defSum, defCnt, t));
  }

  const zMov = zscoresMap(movAdj);
  const zOff = zscoresMap(offDom);
  const zDef = zscoresMap(defDom);

  return { movAdj, offDom, defDom, zMov, zOff, zDef };
}
