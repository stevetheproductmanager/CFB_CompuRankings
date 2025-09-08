export interface TeamInfo {
  id?: number;
  school: string;
  mascot?: string | null;
  conference?: string | null;
  classification?: string | null;
  logos?: string[] | null;
  abbreviation?: string | null;
}

export interface Game {
  id: number;
  season: number;
  week?: number | null;
  seasonType?: string | null;
  startDate?: string | null;
  neutralSite?: boolean | null;
  conferenceGame?: boolean | null;
  venue?: string | null;
  homeTeam: string;
  homeConference?: string | null;
  homePoints?: number | null;
  awayTeam: string;
  awayConference?: string | null;
  awayPoints?: number | null;
}

export interface AdvancedSeasonTeam {
  season: number;
  team: string;
  conference?: string | null;
  offense?: { successRate?: number | null; ppa?: number | null } | null;
  defense?: { successRate?: number | null; ppa?: number | null } | null;
}

export interface SPRating {
  team: string;
  rating?: number | null;
  offense?: number | null;
  defense?: number | null;
  specialTeams?: number | null;
}

export interface TalentRow {
  school: string;
  talent?: number | null;
}

export interface RatingsExternal {
  team: string;
  elo?: number | null;
  srs?: number | null;
}

export interface PPATeam {
  season?: number;
  team: string;
  conference?: string | null;
  off_overall?: number | null;
  def_overall?: number | null;
  offense?: { overall?: number | null } | null;
  defense?: { overall?: number | null } | null;
}

export interface ReturningProduction {
  team: string;
  percent_ppa?: number | null;
}

export interface BettingLine {
  gameId?: number | null;
  spread?: number | null;
  provider?: string | null;
  overUnder?: number | null;
  homeSpread?: number | null;
  awaySpread?: number | null;
}

export interface RatingRow {
  team: string;
  conference?: string;
  logo?: string | null;

  elo: number | null;
  playQuality: number | null;
  prior: number | null;

  score: number;

  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winPct: number;
  avgMargin: number;
  sosAvgElo?: number | null;

  qualityWins25?: number;
  qualityWins50?: number;
  badLosses?: number;
  top25Wins?: number;
  top25Losses?: number;
  top50Wins?: number;
  top50Losses?: number;
  oneScoreWins?: number;
  oneScoreLosses?: number;

  contr?: {
    elo: number;
    play: number;
    prior: number;
    ppa: number;
    market: number;
    returning: number;
    ext: number;
    mov?: number;
    off?: number;
    def?: number;
    sos: number;
    preSoS: number;
  };

  z?: {
    elo: number;
    play: number;
    prior: number;
    ppa: number;
    market: number;
    returning: number;
    ext: number;
    sos: number;
    mov?: number;
    off?: number;
    def?: number;
  };

  rank?: number;
  deltaRank?: number;
  deltaScore?: number | null;

  extras?: {
    ppa?: number | null;
    market?: number | null;
    returning?: number | null;
    ext?: number | null;
    mov?: number | null;
    offDom?: number | null;
    defDom?: number | null;
  };
}
