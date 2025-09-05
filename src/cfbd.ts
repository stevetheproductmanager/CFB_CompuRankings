import axios from 'axios';
const BASES = ['https://apinext.collegefootballdata.com', 'https://api.collegefootballdata.com'];

export interface CFBDConfig { apiKey: string; }
let AUTH = '';
export function initCFBD(cfg: CFBDConfig) { AUTH = `Bearer ${cfg.apiKey}`; }

/** Normalize CFBD responses to a plain array regardless of wrapping shape. */
export function toArray<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];
  for (const key of ['data', 'items', 'results', 'teams', 'games', 'lines']) {
    const val = (data as any)[key];
    if (Array.isArray(val)) return val as T[];
  }
  // sometimes the response is an object keyed by ids; take values
  const vals = Object.values(data);
  if (vals.length && vals.every(v => typeof v === 'object')) return vals as T[];
  return [];
}

async function getAny<T>(paths: string[], params: Record<string, any> = {}): Promise<T> {
  let lastErr: any = null;
  for (const base of BASES) {
    for (const path of paths) {
      try {
        const url = `${base}${path}`;
        const res = await axios.get<T>(url, { headers: { 'Authorization': AUTH }, params, timeout: 25000 });
        return res.data as T;
      } catch (e: any) { lastErr = e; }
    }
  }
  throw lastErr || new Error('CFBD request failed');
}

export async function getFbsTeams(year: number) {
  return await getAny<any[]>(['/teams/fbs','/teams'], { year, classification: 'fbs' });
}
export async function getSeasonGames(year: number) {
  return await getAny<any[]>(['/games'], { year, classification: 'fbs', seasonType: 'regular' });
}
export async function getSeasonAdvanced(year: number, excludeGarbageTime = true, startWeek?: number, endWeek?: number) {
  const params: any = { year };
  if (excludeGarbageTime) params.excludeGarbageTime = true;
  if (typeof startWeek === 'number') params.startWeek = startWeek;
  if (typeof endWeek === 'number') params.endWeek = endWeek;
  try {
    return await getAny<any[]>(['/stats/season/advanced'], params);
  } catch {
    delete params.startWeek; delete params.endWeek;
    return await getAny<any[]>(['/stats/season/advanced'], params);
  }
}
export async function getSPRatings(year: number) { try { return await getAny<any[]>(['/ratings/sp'], { year }); } catch { return []; } }
export async function getTalent(year: number) { try { return await getAny<any[]>(['/talent'], { year }); } catch { return []; } }

export async function getPPATeams(year: number, week?: number) {
  const params: any = { year }; if (typeof week === 'number') params.week = week;
  try { return await getAny<any[]>(['/ppa/teams'], params); } catch { return []; }
}
export async function getReturningProduction(year: number) {
  try { return await getAny<any[]>(['/stats/season/returning','/stats/season/returningProduction','/returning/production'], { year }); } catch { return []; }
}
export async function getRatingsElo(year: number) { try { return await getAny<any[]>(['/ratings/elo'], { year }); } catch { return []; } }
export async function getRatingsSrs(year: number) { try { return await getAny<any[]>(['/ratings/srs'], { year }); } catch { return []; } }
export async function getBettingLines(year: number, week?: number) {
  const params: any = { year, seasonType: 'regular' }; if (typeof week === 'number') params.week = week;
  try { return await getAny<any[]>(['/lines'], params); } catch { return []; }
}
export async function getDrives(year: number, week?: number) {
  const params: any = { year }; if (typeof week === 'number') params.week = week;
  try { return await getAny<any[]>(['/drives'], params); } catch { return []; }
}
export async function getCalendar(year: number) { try { return await getAny<any[]>(['/calendar'], { year, seasonType: 'regular' }); } catch { return []; } }
