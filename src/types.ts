export interface TeamInfo {
  id?: number; school: string; mascot?: string | null; conference?: string | null;
  classification?: string | null; logos?: string[] | null; abbreviation?: string | null;
}

export interface Game {
  id: number; season: number; week?: number | null; seasonType?: string | null; startDate?: string | null;
  neutralSite?: boolean | null; conferenceGame?: boolean | null; venue?: string | null;
  homeTeam: string; homeConference?: string | null; homePoints?: number | null;
  awayTeam: string; awayConference?: string | null; awayPoints?: number | null;
}

export interface AdvancedSeasonTeam {
  season: number; team: string; conference?: string | null;
  offense?: { successRate?: number | null; ppa?: number | null } | null;
  defense?: { successRate?: number | null; ppa?: number | null } | null;
}

export interface SPRating { team: string; rating?: number | null; offense?: number | null; defense?: number | null; specialTeams?: number | null; }
export interface TalentRow { school: string; talent: number | null; year: number; }
export interface RatingsExternal { team: string; elo?: number | null; srs?: number | null; }

export interface PPATeam {
  season: number; team: string; conference?: string | null;
  off_overall?: number | null; def_overall?: number | null;
}

export interface ReturningProduction {
  season: number; team: string; conference?: string | null;
  percent_ppa?: number | null; offense_percent_ppa?: number | null; defense_percent_ppa?: number | null;
}

export interface BettingLine {
  season: number; week?: number | null; gameId?: number | null; homeTeam: string; awayTeam: string;
  spread?: number | null; provider?: string | null; overUnder?: number | null;
}

export interface RatingRow {
  team: string; conference?: string | null; logo?: string | null;

  // core
  elo: number; playQuality: number | null; prior: number | null; score: number;

  // record & basic scoring
  wins?: number; losses?: number; pointsFor?: number; pointsAgainst?: number; pointDiff?: number;
  winPct?: number; avgMargin?: number; sosAvgElo?: number | null;

  // résumé metrics
  qualityWins25?: number; qualityWins50?: number; badLosses?: number;
  recTop25W?: number; recTop25L?: number;
  recTop50W?: number; recTop50L?: number;
  oneScoreW?: number; oneScoreL?: number;

  // explainability
  contr?: {
    elo: number; play: number; prior: number; ppa: number; market: number; returning: number; ext: number; sos: number; preSoS: number;
  };
  z?: {
    elo: number; play: number; prior: number; ppa: number; market: number; returning: number; ext: number; sos: number;
  };

  // ranking decorations
  rank?: number; deltaRank?: number; deltaScore?: number | null;

  // extras raw values
  extras?: { ppa?: number | null; market?: number | null; returning?: number | null; ext?: number | null; };
}
