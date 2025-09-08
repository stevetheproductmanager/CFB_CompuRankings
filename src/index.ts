import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import {
  initCFBD, getFbsTeams, getSeasonGames, getSeasonAdvanced, getSPRatings, getTalent,
  getPPATeams, getReturningProduction, getRatingsElo, getRatingsSrs, getBettingLines, getCalendar,
  toArray
} from './cfbd';
import { updateElo } from './elo';
import { computeDominanceMetrics } from './metrics';
import type {
  TeamInfo, Game, AdvancedSeasonTeam, SPRating, TalentRow, RatingsExternal,
  PPATeam, ReturningProduction, BettingLine, RatingRow
} from './types';

const PORT = Number(process.env.PORT || 5057);
const DEFAULT_YEAR = Number(process.env.SEASON_YEAR || new Date().getFullYear());
const CFBD_API_KEY = process.env.CFBD_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', express.static(path.join(__dirname, '..', 'public')));

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function zscores(values: Array<number | null | undefined>): number[] {
  const clean = values.map(v => (typeof v === 'number' && isFinite(v) ? v : null));
  const valid = clean.filter((v): v is number => v !== null);
  const mean = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
  const variance = valid.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, valid.length);
  const sd = Math.sqrt(variance) || 1;
  return clean.map(v => (v === null ? 0 : (v - mean) / sd));
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function readJSON<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
function writeJSON(file: string, data: any) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function filesForYear(year: number) { return fs.readdirSync(DATA_DIR).filter(f => f.includes(String(year))); }
function availableYears(): number[] {
  const names = fs.readdirSync(DATA_DIR);
  const years = new Set<number>();
  names.forEach(n => { const m = n.match(/(\d{4})/); if (m) years.add(Number(m[1])); });
  return Array.from(years).sort();
}
function availableWeeks(year: number): number[] {
  const names = filesForYear(year);
  const weeks = new Set<number>();
  names.forEach(n => { const m = n.match(new RegExp(`advanced-${year}-wk(\\d+)`)); if (m) weeks.add(Number(m[1])); });
  return Array.from(weeks).sort((a, b) => a - b);
}

// -------- INGEST (STEP 1) --------
async function ingest(year: number, endWeek?: number) {
  if (!CFBD_API_KEY) throw new Error('CFBD_API_KEY is required');
  initCFBD({ apiKey: CFBD_API_KEY });

  const rawTeams = toArray(await getFbsTeams(year));
  const teams: TeamInfo[] = rawTeams.map((t: any) => ({
    id: t.id, school: t.school, mascot: t.mascot ?? null, conference: t.conference ?? null,
    classification: t.classification ?? null, logos: t.logos ?? null, abbreviation: t.abbreviation ?? null
  }));
  writeJSON(path.join(DATA_DIR, `teams-${year}.json`), teams);

  const rawGames = toArray(await getSeasonGames(year));
  const games: Game[] = rawGames
    .filter((g: any) => g.homePoints != null && g.awayPoints != null)
    .map((g: any) => ({
      id: g.id, season: g.season, week: g.week ?? null, seasonType: g.seasonType ?? null, startDate: g.startDate ?? null,
      neutralSite: g.neutralSite ?? null, conferenceGame: g.conferenceGame ?? null, venue: g.venue ?? null,
      homeTeam: g.homeTeam, homeConference: g.homeConference ?? null, homePoints: g.homePoints,
      awayTeam: g.awayTeam, awayConference: g.awayConference ?? null, awayPoints: g.awayPoints,
    }));
  writeJSON(path.join(DATA_DIR, `games-${year}.json`), games);

  const advRaw = toArray(await getSeasonAdvanced(year, true, undefined, endWeek));
  const adv: AdvancedSeasonTeam[] = advRaw.map((row: any) => ({
    season: row.season, team: row.team, conference: row.conference ?? null,
    offense: { successRate: row.offense?.successRate ?? null, ppa: row.offense?.ppa ?? null },
    defense: { successRate: row.defense?.successRate ?? null, ppa: row.defense?.ppa ?? null },
  }));
  writeJSON(path.join(DATA_DIR, `advanced-${year}${endWeek ? `-wk${endWeek}` : ''}.json`), adv);

  const ppaTeamsRaw = toArray(await getPPATeams(year, endWeek));
  const ppaTeams = ppaTeamsRaw.map((r: any) => ({
    season: r.season ?? year, team: r.team ?? r.school, conference: r.conference ?? null,
    off_overall: r.off_overall ?? r.offense?.overall ?? null,
    def_overall: r.def_overall ?? r.defense?.overall ?? null,
  }));
  writeJSON(path.join(DATA_DIR, `ppa-teams-${year}${endWeek ? `-wk${endWeek}` : ''}.json`), ppaTeams);

  const spRaw = toArray(await getSPRatings(year));
  const sp: SPRating[] = spRaw.map((r: any) => ({
    team: r.team ?? r.school ?? r.name, rating: r.rating ?? r.overall ?? null,
    offense: r.offense ?? null, defense: r.defense ?? null, specialTeams: r.specialTeams ?? r.st ?? null
  }));
  writeJSON(path.join(DATA_DIR, `sp-${year}.json`), sp);

  const talentRaw = toArray(await getTalent(year));
  const talent: TalentRow[] = talentRaw.map((r: any) => ({ school: r.school ?? r.team, talent: r.talent ?? null }));
  writeJSON(path.join(DATA_DIR, `talent-${year}.json`), talent);

  const retRaw = toArray(await getReturningProduction(year));
  const ret = retRaw.map((r: any) => ({ team: r.team ?? r.school, percent_ppa: r.percent_ppa ?? r.totalPPA ?? null }));
  writeJSON(path.join(DATA_DIR, `returning-${year}.json`), ret);

  const linesRaw = toArray(await getBettingLines(year));
  const lines = linesRaw.map((x: any) => ({
    gameId: x.gameId ?? x.id ?? null,
    spread: x.spread ?? x.formattedSpread ?? x.homeSpread ?? x.awaySpread ?? null,
    provider: x.provider ?? x.providerName ?? null,
    overUnder: x.overUnder ?? x.total ?? null
  }));
  writeJSON(path.join(DATA_DIR, `lines-${year}${endWeek ? `-wk${endWeek}` : ''}.json`), lines);

  const eloExtRaw = toArray(await getRatingsElo(year));
  const eloExt = eloExtRaw.map((r: any) => ({ team: r.team ?? r.school, elo: r.rating ?? r.elo ?? null }));
  writeJSON(path.join(DATA_DIR, `elo-ext-${year}.json`), eloExt);

  const srsExtRaw = toArray(await getRatingsSrs(year));
  const srsExt = srsExtRaw.map((r: any) => ({ team: r.team ?? r.school, srs: r.rating ?? r.srs ?? null }));
  writeJSON(path.join(DATA_DIR, `srs-ext-${year}.json`), srsExt);

  const cal = toArray(await getCalendar(year));
  writeJSON(path.join(DATA_DIR, `calendar-${year}.json`), cal);

  const meta = {
    year, endWeek: endWeek ?? null, ingestedAt: new Date().toISOString(),
    datasets: {
      teams: teams.length, games: games.length, advanced: adv.length, ppaTeams: ppaTeams.length,
      sp: sp.length, talent: talent.length, returning: ret.length, lines: lines.length,
      eloExt: eloExt.length, srsExt: srsExt.length
    }
  };
  writeJSON(path.join(DATA_DIR, `ingest-meta-${year}${endWeek ? `-wk${endWeek}` : ''}.json`), meta);
  return meta;
}

// -------- ELO + scoring helpers --------
function runElo(teams: TeamInfo[], games: Game[], throughWeek?: number, k=20, hfa=65, fcsWeight=0.6) {
  const fbsTeams = new Set(teams.map(t => t.school));
  const state = new Map<string, number>();
  const getRating = (team: string) => state.get(team) ?? 1500;
  const setRating = (team: string, r: number) => state.set(team, r);
  teams.forEach(t => setRating(t.school, getRating(t.school)));

  const gSorted = games
    .filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek))
    .sort((a, b) => {
      const aw = a.week ?? 0, bw = b.week ?? 0;
      if (aw !== bw) return aw - bw;
      const ad = a.startDate ? Date.parse(a.startDate) : 0;
      const bd = b.startDate ? Date.parse(b.startDate) : 0;
      return ad - bd;
    });

  for (const g of gSorted) {
    const home = { rating: getRating(g.homeTeam) };
    const away = { rating: getRating(g.awayTeam) };
    const isFbsVsFcs = !(fbsTeams.has(g.homeTeam) && fbsTeams.has(g.awayTeam));
    updateElo(home, away, g.homePoints ?? 0, g.awayPoints ?? 0, g.neutralSite ?? false, isFbsVsFcs, { k, hfa, fcsWeight });
    setRating(g.homeTeam, home.rating);
    setRating(g.awayTeam, away.rating);
  }
  return state;
}

function computePlayQuality(teams: TeamInfo[], adv: AdvancedSeasonTeam[]) {
  const off = new Map<string, number>();
  const def = new Map<string, number>();
  teams.forEach(t => {
    const row = adv.find(a => a.team === t.school);
    off.set(t.school, row?.offense?.ppa ?? 0);
    def.set(t.school, row?.defense?.ppa ?? 0);
  });
  const net = teams.map(t => (off.get(t.school) ?? 0) - (def.get(t.school) ?? 0));
  return net;
}

// Hardened: basic record & scoring stats per team (FBS-safe)
function computeBasicStats(teams: TeamInfo[], games: Game[], throughWeek?: number) {
  type B = {
    games: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
    winPct: number;
    avgMargin: number;
  };
  const out = new Map<string, B>();
  const fbs = new Set(teams.map(t => t.school));
  teams.forEach(t => out.set(t.school, { games:0, wins:0, losses:0, pointsFor:0, pointsAgainst:0, pointDiff:0, winPct:0, avgMargin:0 }));

  const upto = games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek));
  for (const g of upto) {
    if (g.homePoints == null || g.awayPoints == null) continue;
    const hp = g.homePoints as number;
    const ap = g.awayPoints as number;
    const margin = hp - ap;

    const homeIsFBS = fbs.has(g.homeTeam);
    const awayIsFBS = fbs.has(g.awayTeam);

    if (homeIsFBS && awayIsFBS) {
      const bh = out.get(g.homeTeam)!;
      const ba = out.get(g.awayTeam)!;

      bh.games++; ba.games++;
      bh.pointsFor += hp;  bh.pointsAgainst += ap;
      ba.pointsFor += ap;  ba.pointsAgainst += hp;
      bh.pointDiff += (hp - ap);
      ba.pointDiff += (ap - hp);

      if (hp > ap) { bh.wins++; ba.losses++; }
      else if (ap > hp) { ba.wins++; bh.losses++; }
      // ties ignored
      continue;
    }

    if (homeIsFBS && !awayIsFBS) {
      const bh = out.get(g.homeTeam)!;
      bh.games++;
      bh.pointsFor += hp;  bh.pointsAgainst += ap;
      bh.pointDiff += (hp - ap);
      if (margin > 0) bh.wins++; else if (margin < 0) bh.losses++;
      continue;
    }

    if (!homeIsFBS && awayIsFBS) {
      const ba = out.get(g.awayTeam)!;
      ba.games++;
      ba.pointsFor += ap;  ba.pointsAgainst += hp;
      ba.pointDiff += (ap - hp);
      if (margin < 0) ba.wins++; else if (margin > 0) ba.losses++;
      continue;
    }

    // both FCS -> ignore entirely
  }

  out.forEach((b) => {
    const g = Math.max(1, b.games);
    b.winPct = b.wins / g;
    b.avgMargin = b.pointDiff / g;
  });

  return out;
}

// SoS (z-scored)
function computeSoS(teams: TeamInfo[], games: Game[], ratings: Map<string, number>, throughWeek?: number) {
  const fbs = new Set(teams.map(t => t.school));
  const opps = new Map<string, number[]>();
  const played = games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek));
  for (const g of played) {
    if (fbs.has(g.homeTeam) && fbs.has(g.awayTeam)) {
      const helo = ratings.get(g.awayTeam) ?? 1500;
      const aelo = ratings.get(g.homeTeam) ?? 1500;
      if (!opps.has(g.homeTeam)) opps.set(g.homeTeam, []);
      if (!opps.has(g.awayTeam)) opps.set(g.awayTeam, []);
      opps.get(g.homeTeam)!.push(helo);
      opps.get(g.awayTeam)!.push(aelo);
    }
  }
  const avg = teams.map(t => {
    const arr = opps.get(t.school) ?? [];
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  });
  return zscores(avg);
}

// SoS Avg Elo (raw)
function computeSoSAvgElo(teams: TeamInfo[], games: Game[], ratings: Map<string, number>, throughWeek?: number) {
  const fbs = new Set(teams.map(t => t.school));
  const opps = new Map<string, number[]>();
  const played = games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek));
  for (const g of played) {
    if (fbs.has(g.homeTeam) && fbs.has(g.awayTeam)) {
      const helo = ratings.get(g.awayTeam) ?? 1500;
      const aelo = ratings.get(g.homeTeam) ?? 1500;
      if (!opps.has(g.homeTeam)) opps.set(g.homeTeam, []);
      if (!opps.has(g.awayTeam)) opps.set(g.awayTeam, []);
      opps.get(g.homeTeam)!.push(helo);
      opps.get(g.awayTeam)!.push(aelo);
    }
  }
  const out = new Map<string, number>();
  teams.forEach(t => {
    const arr = opps.get(t.school) ?? [];
    out.set(t.school, arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0);
  });
  return out;
}

// Prior (SP + Talent)
function computePrior(teams: TeamInfo[], sp: SPRating[], talent: TalentRow[]) {
  const spBy = new Map(sp.map(s => [s.team, s.rating ?? null]));
  const talentBy = new Map(talent.map(t => [t.school, t.talent ?? null]));
  const spVals = teams.map(t => spBy.get(t.school) ?? null);
  const talentVals = teams.map(t => talentBy.get(t.school) ?? null);
  const zSP = zscores(spVals);
  const zTalent = zscores(talentVals);
  return teams.map((_t, i) => (zSP[i] + zTalent[i]) / 2);
}

// Opponent-adjusted net PPA (simple iterative smoothing)
function computePPAAdjusted(teams: TeamInfo[], ppaTeams: PPATeam[], games: Game[], throughWeek?: number, passes=2) {
  const by = new Map(ppaTeams.map(r => [r.team, r]));
  const off = new Map<string, number>();
  const def = new Map<string, number>();
  teams.forEach(t => {
    const r = by.get(t.school);
    off.set(t.school, (r && typeof r.off_overall === 'number') ? r.off_overall : 0);
    def.set(t.school, (r && typeof r.def_overall === 'number') ? r.def_overall : 0);
  });

  const opps = new Map<string, string[]>();
  const played = games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek));
  for (const g of played) {
    if (!opps.has(g.homeTeam)) opps.set(g.homeTeam, []);
    if (!opps.has(g.awayTeam)) opps.set(g.awayTeam, []);
    opps.get(g.homeTeam)!.push(g.awayTeam);
    opps.get(g.awayTeam)!.push(g.homeTeam);
  }

  let curOff = new Map(off), curDef = new Map(def);
  for (let p = 0; p < passes; p++) {
    const next = new Map<string, number>();
    for (const t of teams) {
      const o = opps.get(t.school) ?? [];
      if (!o.length) { next.set(t.school, (curOff.get(t.school) ?? 0) - (curDef.get(t.school) ?? 0)); continue; }
      const avgOppDef = o.reduce((a, opp) => a + (curDef.get(opp) ?? 0), 0) / o.length;
      const avgOppOff = o.reduce((a, opp) => a + (curOff.get(opp) ?? 0), 0) / o.length;
      const adjOff = (curOff.get(t.school) ?? 0) - avgOppDef;
      const adjDef = -((curDef.get(t.school) ?? 0) - avgOppOff);
      next.set(t.school, adjOff + adjDef);
    }
    // re-center to zero mean each pass
    const vals = teams.map(t => next.get(t.school) ?? 0);
    const m = vals.reduce((a,b)=>a+b,0)/Math.max(1, vals.length);
    teams.forEach(t => next.set(t.school, (next.get(t.school) ?? 0) - m));
    if (p === passes - 1) return teams.map(t => next.get(t.school) ?? 0);
  }
  return teams.map(t => (curOff.get(t.school) ?? 0) - (curDef.get(t.school) ?? 0));
}

// Market from lines (avg implied margin by team)
function computeMarketFromLines(teams: TeamInfo[], games: Game[], lines: any[]) {
  const mp = new Map<string, number[]>();
  const byGame = new Map<number, any>();
  for (const l of lines) {
    const gid = l.gameId ?? 0; if (!gid) continue;
    byGame.set(gid, l);
  }
  for (const g of games) {
    const l = byGame.get(g.id);
    if (!l || typeof l.spread !== 'number') continue;
    const homeImpl = -l.spread;
    const awayImpl = l.spread;
    mp.set(g.homeTeam, (mp.get(g.homeTeam) ?? []).concat([homeImpl]));
    mp.set(g.awayTeam, (mp.get(g.awayTeam) ?? []).concat([awayImpl]));
  }
  return teams.map(t => {
    const arr = mp.get(t.school) ?? [];
    if (!arr.length) return null;
    return arr.reduce((a,b)=>a+b,0)/arr.length;
  });
}

// Résumé metrics (hardened to ignore FCS-only updates)
function computeResumeMetrics(teams: TeamInfo[], games: Game[], ranks: Map<string, number>, throughWeek?: number) {
  const ONE_SCORE = 8;              // <= 8 pts
  const BAD_LOSS_RANK = 80;
  const out = new Map<string, {
    qw25:number, qw50:number, badL:number,
    t25w:number, t25l:number, t50w:number, t50l:number,
    oneW:number, oneL:number
  }>();
  const upTo = games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek));
  const fbs = new Set(teams.map(t => t.school));
  for (const t of teams) out.set(t.school, { qw25:0, qw50:0, badL:0, t25w:0, t25l:0, t50w:0, t50l:0, oneW:0, oneL:0 });

  for (const g of upTo) {
    if (g.homePoints == null || g.awayPoints == null) continue;
    const hr = ranks.get(g.homeTeam) ?? 999, ar = ranks.get(g.awayTeam) ?? 999;
    const margin = (g.homePoints as number) - (g.awayPoints as number);
    const oneScore = Math.abs(margin) <= ONE_SCORE;

    const winner = margin > 0 ? g.homeTeam : (margin < 0 ? g.awayTeam : null);
    const loser  = margin > 0 ? g.awayTeam : (margin < 0 ? g.homeTeam : null);

    if (winner && fbs.has(winner)) {
      const w = out.get(winner)!;
      if ((winner === g.homeTeam && ar <= 25) || (winner === g.awayTeam && hr <= 25)) w.qw25++;
      if ((winner === g.homeTeam && ar <= 50) || (winner === g.awayTeam && hr <= 50)) w.qw50++;
      if (oneScore) w.oneW++;
    }

    if (loser && fbs.has(loser)) {
      const l = out.get(loser)!;
      if ((loser === g.homeTeam && ar <= 25) || (loser === g.awayTeam && hr <= 25)) l.t25l++;
      if ((loser === g.homeTeam && ar <= 50) || (loser === g.awayTeam && hr <= 50)) l.t50l++;
      if ((loser === g.homeTeam && ar >  25) || (loser === g.awayTeam && hr >  25)) l.t25w++;
      if ((loser === g.homeTeam && ar >  50) || (loser === g.awayTeam && hr >  50)) l.t50w++;
      if (oneScore) l.oneL++;
      if ((loser === g.homeTeam && ar > BAD_LOSS_RANK) || (loser === g.awayTeam && hr > BAD_LOSS_RANK)) l.badL++;
    }
  }
  return out;
}

// -------- RANK (STEP 2) --------
function pickLatestWeekFile(prefix: string, year: number) {
  const names = fs.readdirSync(DATA_DIR).filter(n => n.startsWith(`${prefix}-${year}`));
  const weeks = names
    .map(n => {
      const m = n.match(/wk(\d+)/);
      return m ? Number(m[1]) : null;
    })
    .filter((v): v is number => v != null);

  // If no -wkN files exist, fall back to non-week file (prefix-year.json)
  const wk = weeks.length ? Math.max(...weeks) : null;
  const fallback = path.join(DATA_DIR, `${prefix}-${year}.json`);
  const resolvedPath = wk != null
    ? path.join(DATA_DIR, `${prefix}-${year}-wk${wk}.json`)
    : fallback;

  return { path: resolvedPath, week: wk };
}


function rankFromCache(params: {
  year: number; throughWeek?: number;
  wElo?: number; wPlay?: number; wPrior?: number; sosWeight?: number; k?: number; hfa?: number; fcsWeight?: number;
  wPPA?: number; wMarket?: number; wReturn?: number; wExt?: number;
  wMov?: number; wOff?: number; wDef?: number;
}) {
  const {
    year, throughWeek,
    wElo=0.5, wPlay=0.25, wPrior=0.1, sosWeight=0.15, k=20, hfa=65, fcsWeight=0.6,
    wPPA=0.1, wMarket=0.03, wReturn=0.02, wExt=0.0,
    wMov=0.08, wOff=0.07, wDef=0.07
  } = params;

  const teamsPath = path.join(DATA_DIR, `teams-${year}.json`);
  const gamesPath = path.join(DATA_DIR, `games-${year}.json`);

  let advPath = path.join(DATA_DIR, `advanced-${year}${throughWeek ? `-wk${throughWeek}` : ''}.json`);
  if (!fs.existsSync(advPath)) { const auto = pickLatestWeekFile('advanced', year); advPath = auto.path; }

  const ppaMeta = throughWeek && fs.existsSync(path.join(DATA_DIR, `ppa-teams-${year}-wk${throughWeek}.json`))
    ? { path: path.join(DATA_DIR, `ppa-teams-${year}-wk${throughWeek}.json`) }
    : pickLatestWeekFile('ppa-teams', year);
  const linesMeta = throughWeek && fs.existsSync(path.join(DATA_DIR, `lines-${year}-wk${throughWeek}.json`))
    ? { path: path.join(DATA_DIR, `lines-${year}-wk${throughWeek}.json`) }
    : pickLatestWeekFile('lines', year);

  const spPath = path.join(DATA_DIR, `sp-${year}.json`);
  const talentPath = path.join(DATA_DIR, `talent-${year}.json`);
  const retPath = path.join(DATA_DIR, `returning-${year}.json`);
  const eloExtPath = path.join(DATA_DIR, `elo-ext-${year}.json`);
  const srsExtPath = path.join(DATA_DIR, `srs-ext-${year}.json`);

  if (!fs.existsSync(teamsPath) || !fs.existsSync(gamesPath)) throw new Error('Run /api/ingest first');
  if (!fs.existsSync(advPath)) throw new Error(`Missing ${path.basename(advPath)} — ingest advanced first`);

  const teams: TeamInfo[] = readJSON(teamsPath);
  const games: Game[] = readJSON(gamesPath);
  const adv: AdvancedSeasonTeam[] = readJSON(advPath);
  const sp: SPRating[] = fs.existsSync(spPath) ? readJSON(spPath) : [];
  const talent: TalentRow[] = fs.existsSync(talentPath) ? readJSON(talentPath) : [];
  const ppaTeams: PPATeam[] = fs.existsSync(ppaMeta.path) ? readJSON(ppaMeta.path) : [];
  const lines: BettingLine[] = fs.existsSync(linesMeta.path) ? readJSON(linesMeta.path) : [];
  const ret: ReturningProduction[] = fs.existsSync(retPath) ? readJSON(retPath) : [];
  const eloExt: RatingsExternal[] = fs.existsSync(eloExtPath) ? readJSON(eloExtPath) : [];
  const srsExt: RatingsExternal[] = fs.existsSync(srsExtPath) ? readJSON(srsExtPath) : [];

  const eloMap = runElo(teams, games, throughWeek, k, hfa, fcsWeight);
  const eloArray = teams.map(t => eloMap.get(t.school) ?? 1500);
  const zElo = zscores(eloArray);

  const playQuality = computePlayQuality(teams, adv);
  const zPlay = zscores(playQuality);

  const prior = computePrior(teams, sp, talent);
  const zPrior = zscores(prior);

  const zSoS = computeSoS(teams, games, eloMap, throughWeek);

  // Extras (now with opponent-adjusted PPA)
  const ppaAdjVals = computePPAAdjusted(teams, ppaTeams, games, throughWeek, 2);
  const zPPA = zscores(ppaAdjVals);
  const marketVals = computeMarketFromLines(
    teams,
    games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek)),
    lines
  );
  const zMarket = zscores(marketVals);
  const retVals = teams.map(t => {
    const r = ret.find(x => x.team === t.school);
    return r && typeof r.percent_ppa === 'number' ? r.percent_ppa : null;
  });
  const zReturn = zscores(retVals);
  const extBy = new Map<string, number>();
  eloExt.forEach(e => { if (typeof e.elo === 'number') extBy.set(e.team, (extBy.get(e.team) ?? 0) + e.elo); });
  srsExt.forEach(s => { if (typeof s.srs === 'number') extBy.set(s.team, (extBy.get(s.team) ?? 0) + s.srs); });
  const extVals = teams.map(t => extBy.get(t.school) ?? null);
  const zExt = zscores(extVals);

  // --- Dominance metrics (MOV / OffDom / DefDom)
  const ppaByTeam = new Map<string, { off: number; def: number }>();
  for (const r of ppaTeams as any[]) {
    const tname = (r as any).team || (r as any).school || (r as any).name;
    const off = Number((r as any).off_overall ?? (r as any).offense?.overall ?? (r as any).off?.overall ?? 0) || 0;
    const def = Number((r as any).def_overall ?? (r as any).defense?.overall ?? (r as any).def?.overall ?? 0) || 0;
    if (tname) ppaByTeam.set(tname, { off, def });
  }
  const eloByTeam = new Map<string, number>(teams.map((t, i) => [t.school, eloArray[i] ?? 1500]));
  const dom = computeDominanceMetrics({
    games: games.filter(g => (throughWeek == null ? true : (g.week ?? 0) <= throughWeek)),
    ppaByTeam,
    eloByTeam,
    fcsWeight
  });

  const basic = computeBasicStats(teams, games, throughWeek);
  const sosAvgEloMap = computeSoSAvgElo(teams, games, eloMap, throughWeek);

  // Blend
  const baseSum = (wElo + wPlay + wPrior) || 1;
  const a = wElo / baseSum, b = wPlay / baseSum, c = wPrior / baseSum;

  const extrasSum = (wPPA + wMarket + wReturn + wExt + wMov + wOff + wDef) || 1;
  const p = wPPA / extrasSum, m = wMarket / extrasSum, r = wReturn / extrasSum, e = wExt / extrasSum;
  const mv = wMov / extrasSum, offw = wOff / extrasSum, defw = wDef / extrasSum;
  const extrasWeight = (wPPA + wMarket + wReturn + wExt + wMov + wOff + wDef);

  const sosW = clamp(sosWeight, -0.5, 0.5);

  const rows: RatingRow[] = teams.map((t, i) => {
    const contrE = a * zElo[i];
    const contrP = b * zPlay[i];
    const contrR = c * zPrior[i];
    const contrPPA = p * zPPA[i] * extrasWeight;
    const contrMkt = m * zMarket[i] * extrasWeight;
    const contrRet = r * zReturn[i] * extrasWeight;
    const contrExt = e * zExt[i] * extrasWeight;
    const contrMov = mv * (dom.zMov.get(t.school) ?? 0) * extrasWeight;
    const contrOff = offw * (dom.zOff.get(t.school) ?? 0) * extrasWeight;
    const contrDef = defw * (dom.zDef.get(t.school) ?? 0) * extrasWeight;

    const preSoS = contrE + contrP + contrR + contrPPA + contrMkt + contrRet + contrExt + contrMov + contrOff + contrDef;
    const contrSoS = preSoS * sosW * zSoS[i];
    const score = preSoS + contrSoS;

    const bstat = basic.get(t.school)!;
    const sosAvgElo = sosAvgEloMap.get(t.school) ?? null;

    return {
      team: t.school,
      conference: t.conference ?? undefined,
      logo: t.logos && t.logos.length ? t.logos[0] : null,

      elo: eloArray[i],
      playQuality: playQuality[i],
      prior: prior[i],
      score,

      wins: bstat?.wins ?? 0, losses: bstat?.losses ?? 0,
      pointsFor: bstat?.pointsFor ?? 0, pointsAgainst: bstat?.pointsAgainst ?? 0,
      pointDiff: bstat?.pointDiff ?? 0, winPct: bstat?.winPct ?? 0, avgMargin: bstat?.avgMargin ?? 0,
      sosAvgElo,

      contr: {
        elo: contrE, play: contrP, prior: contrR,
        ppa: contrPPA, market: contrMkt, returning: contrRet, ext: contrExt,
        mov: contrMov, off: contrOff, def: contrDef,
        sos: contrSoS, preSoS
      },
      z: {
        elo: zElo[i], play: zPlay[i], prior: zPrior[i], ppa: zPPA[i], market: zMarket[i],
        returning: zReturn[i], ext: zExt[i], sos: zSoS[i],
        mov: dom.zMov.get(t.school) ?? 0, off: dom.zOff.get(t.school) ?? 0, def: dom.zDef.get(t.school) ?? 0
      },

      extras: {
        ppa: ppaAdjVals[i], market: marketVals[i], returning: retVals[i], ext: extVals[i],
        mov: dom.movAdj.get(t.school) ?? null, offDom: dom.offDom.get(t.school) ?? null, defDom: dom.defDom.get(t.school) ?? null
      }
    };
  });

  // sort & ranks
  rows.sort((x, y) => y.score - x.score);
  const withRank = rows.map((r, idx) => ({ rank: idx + 1, ...r }));

  // résumé metrics (need ranks)
  const rankMap = new Map(withRank.map(r => [r.team, r.rank!]));
  const resume = computeResumeMetrics(teams, games, rankMap, throughWeek);
  withRank.forEach(r => {
    const re = resume.get(r.team) || { qw25:0, qw50:0, badL:0, t25w:0, t25l:0, t50w:0, t50l:0, oneW:0, oneL:0 };
    r.qualityWins25 = re.qw25; r.qualityWins50 = re.qw50; r.badLosses = re.badL;
    r.top25Wins = re.t25w; r.top25Losses = re.t25l; r.top50Wins = re.t50w; r.top50Losses = re.t50l;
    r.oneScoreWins = re.oneW; r.oneScoreLosses = re.oneL;
  });

  const meta = {
    year,
    throughWeek: throughWeek ?? null,
    maxWeek: Math.max(0, ...games.map(g => g.week ?? 0)),
    teamsCount: teams.length,
    used: {
      sp: fs.existsSync(spPath),
      talent: fs.existsSync(talentPath),
      returning: fs.existsSync(retPath),
      ppaTeams: fs.existsSync(ppaMeta.path),
      lines: fs.existsSync(linesMeta.path),
      eloExt: fs.existsSync(eloExtPath),
      srsExt: fs.existsSync(srsExtPath)
    }
  };
  writeJSON(path.join(DATA_DIR, `rankings-${year}${throughWeek ? `-wk${throughWeek}` : ''}.json`), withRank);
  writeJSON(path.join(DATA_DIR, `meta-${year}${throughWeek ? `-wk${throughWeek}` : ''}.json`), meta);
  return { meta, teams, games, rankings: withRank };
} 

function deltaRankings(params: {
  year: number;
  week: number;
  wElo:number; wPlay:number; wPrior:number; sosWeight:number; k:number; hfa:number; fcsWeight:number;
  wPPA:number; wMarket:number; wReturn:number; wExt:number; wMov:number; wOff:number; wDef:number;
}) {
  const { year, week, wElo, wPlay, wPrior, sosWeight, k, hfa, fcsWeight, wPPA, wMarket, wReturn, wExt, wMov, wOff, wDef } = params;

  // new: validate week
  if (!Number.isFinite(week)) throw new Error('Delta requires a valid week number');
  if (week <= 1) throw new Error('Delta requires week >= 2');

  const cur = rankFromCache({ year, throughWeek: week,     wElo, wPlay, wPrior, sosWeight, k, hfa, fcsWeight, wPPA, wMarket, wReturn, wExt, wMov, wOff, wDef });
  const prev = rankFromCache({ year, throughWeek: week - 1, wElo, wPlay, wPrior, sosWeight, k, hfa, fcsWeight, wPPA, wMarket, wReturn, wExt, wMov, wOff, wDef });

  const prevPos = new Map<string, { rank:number, score:number }>();
  prev.rankings.forEach((r: any) => prevPos.set(r.team, { rank: r.rank, score: r.score }));

  const merged = cur.rankings.map((r: any) => {
    const p = prevPos.get(r.team);
    const deltaRank = p ? (p.rank - r.rank) : 0;
    const deltaScore = p ? (r.score - p.score) : null;
    return { ...r, deltaRank, deltaScore };
  });

  // new: do NOT touch cur.games/cur.teams here; frontend doesn’t need them from this endpoint
  return { meta: { ...cur.meta, week, deltaFrom: week - 1 }, rankings: merged };
}

// ---------------- API ----------------
app.get('/api/ingest', async (req, res) => {
  try {
    const year = Number(req.query.year || DEFAULT_YEAR);
    const endWeek = req.query.endWeek != null ? Number(req.query.endWeek) : undefined;
    const result = await ingest(year, endWeek);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.get('/api/cache-info', (req, res) => {
  try {
    const yr = req.query.year ? Number(req.query.year) : undefined;
    const files = fs.readdirSync(DATA_DIR).filter(f => yr ? f.includes(String(yr)) : true).map(name => {
      const p = path.join(DATA_DIR, name); const st = fs.statSync(p);
      return { name, bytes: st.size, mtime: st.mtime.toISOString() };
    });
    const years = availableYears();
    const weeks = yr ? availableWeeks(yr) : undefined;
    res.json({ years, year: yr, weeks, files });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.delete('/api/clear-cache', (req, res) => {
  try {
    const yr = req.query.year ? Number(req.query.year) : undefined;
    const names = fs.readdirSync(DATA_DIR);
    let count = 0;
    for (const name of names) { if (!yr || name.includes(String(yr))) { fs.unlinkSync(path.join(DATA_DIR, name)); count++; } }
    res.json({ deleted: count });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.get('/api/file', (req, res) => {
  try {
    const kind = String(req.query.kind || '');
    const year = Number(req.query.year || DEFAULT_YEAR);
    const week = req.query.week != null ? Number(req.query.week) : undefined;
    let file: string;
    if (kind === 'teams') file = path.join(DATA_DIR, `teams-${year}.json`);
    else if (kind === 'games') file = path.join(DATA_DIR, `games-${year}.json`);
    else if (kind === 'advanced') file = week != null ? path.join(DATA_DIR, `advanced-${year}-wk${week}.json`) : path.join(DATA_DIR, `advanced-${year}.json`);
    else if (kind === 'ppa') file = week != null ? path.join(DATA_DIR, `ppa-teams-${year}-wk${week}.json`) : path.join(DATA_DIR, `ppa-teams-${year}.json`);
    else if (kind === 'lines') file = week != null ? path.join(DATA_DIR, `lines-${year}-wk${week}.json`) : path.join(DATA_DIR, `lines-${year}.json`);
    else if (kind === 'sp') file = path.join(DATA_DIR, `sp-${year}.json`);
    else if (kind === 'talent') file = path.join(DATA_DIR, `talent-${year}.json`);
    else if (kind === 'returning') file = path.join(DATA_DIR, `returning-${year}.json`);
    else if (kind === 'elo-ext') file = path.join(DATA_DIR, `elo-ext-${year}.json`);
    else if (kind === 'srs-ext') file = path.join(DATA_DIR, `srs-ext-${year}.json`);
    else if (kind === 'calendar') file = path.join(DATA_DIR, `calendar-${year}.json`);
    else if (kind === 'rankings') file = week != null ? path.join(DATA_DIR, `rankings-${year}-wk${week}.json`) : path.join(DATA_DIR, `rankings-${year}.json`);
    else if (kind === 'meta') file = week != null ? path.join(DATA_DIR, `meta-${year}-wk${week}.json`) : path.join(DATA_DIR, `meta-${year}.json`);
    else throw new Error('Unknown kind');
    if (!fs.existsSync(file)) throw new Error(`No file ${path.basename(file)}`);
    const data = readJSON<any[]>(file);
    res.json({ kind, year, length: Array.isArray(data)? data.length : 0, data });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.get('/api/rank-from-cache', (req, res) => {
  try {
    const year = Number(req.query.year || DEFAULT_YEAR);
    const throughWeek = req.query.throughWeek != null ? Number(req.query.throughWeek) : undefined;
    const wElo = req.query.wElo != null ? Number(req.query.wElo) : 0.5;
    const wPlay = req.query.wPlay != null ? Number(req.query.wPlay) : 0.25;
    const wPrior = req.query.wPrior != null ? Number(req.query.wPrior) : 0.10;
    const sosWeight = req.query.sosWeight != null ? Number(req.query.sosWeight) : 0.15;
    const k = req.query.k != null ? Number(req.query.k) : 20;
    const hfa = req.query.hfa != null ? Number(req.query.hfa) : 65;
    const fcsWeight = req.query.fcsWeight != null ? Number(req.query.fcsWeight) : 0.6;
    const wPPA = req.query.wPPA != null ? Number(req.query.wPPA) : 0.10;
    const wMarket = req.query.wMarket != null ? Number(req.query.wMarket) : 0.03;
    const wReturn = req.query.wReturn != null ? Number(req.query.wReturn) : 0.02;
    const wExt = req.query.wExt != null ? Number(req.query.wExt) : 0.0;
    const wMov = req.query.wMov != null ? Number(req.query.wMov) : 0.08;
    const wOff = req.query.wOff != null ? Number(req.query.wOff) : 0.07;
    const wDef = req.query.wDef != null ? Number(req.query.wDef) : 0.07;
    const result = rankFromCache({
      year, throughWeek, wElo, wPlay, wPrior, sosWeight, k, hfa, fcsWeight, wPPA, wMarket, wReturn, wExt, wMov, wOff, wDef
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.get('/api/rank-delta', (req, res) => {
  try {
    const year = Number(req.query.year || DEFAULT_YEAR);
    const week = Number(req.query.week);
    const wElo = req.query.wElo != null ? Number(req.query.wElo) : 0.5;
    const wPlay = req.query.wPlay != null ? Number(req.query.wPlay) : 0.25;
    const wPrior = req.query.wPrior != null ? Number(req.query.wPrior) : 0.10;
    const sosWeight = req.query.sosWeight != null ? Number(req.query.sosWeight) : 0.15;
    const k = req.query.k != null ? Number(req.query.k) : 20;
    const hfa = req.query.hfa != null ? Number(req.query.hfa) : 65;
    const fcsWeight = req.query.fcsWeight != null ? Number(req.query.fcsWeight) : 0.6;
    const wPPA = req.query.wPPA != null ? Number(req.query.wPPA) : 0.10;
    const wMarket = req.query.wMarket != null ? Number(req.query.wMarket) : 0.03;
    const wReturn = req.query.wReturn != null ? Number(req.query.wReturn) : 0.02;
    const wExt = req.query.wExt != null ? Number(req.query.wExt) : 0.0;
    const wMov = req.query.wMov != null ? Number(req.query.wMov) : 0.08;
    const wOff = req.query.wOff != null ? Number(req.query.wOff) : 0.07;
    const wDef = req.query.wDef != null ? Number(req.query.wDef) : 0.07;
    const result = deltaRankings({
      year, week, wElo, wPlay, wPrior, sosWeight, k, hfa, fcsWeight, wPPA, wMarket, wReturn, wExt, wMov, wOff, wDef
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message || 'Unknown' }); }
});

app.get('/api/rankings', (req, res) => {
  const year = Number(req.query.year || DEFAULT_YEAR);
  const throughWeek = req.query.throughWeek != null ? Number(req.query.throughWeek) : undefined;
  const file = path.join(DATA_DIR, `rankings-${year}${throughWeek ? `-wk${throughWeek}` : ''}.json`);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.status(404).json({ error: 'No rankings yet — run /api/rank-from-cache' });
});

app.listen(PORT, () => console.log(`Two-step server v1.7 http://localhost:${PORT}`));
