export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export type Conference = 'East' | 'West';
export type Division = 'Atlantic' | 'Central' | 'Southeast' | 'Northwest' | 'Pacific' | 'Southwest';
export type CoachStyle = 'players-coach' | 'tactician' | 'disciplinarian';
export type CoachPedigree = 'former-star' | 'video-room' | 'college-mentor' | 'european-tactician';
export type CoachSignature = 'seven-seconds' | 'lockdown' | 'players-friend';
export type SeasonPhase = 'regular' | 'offseason';
export type OffseasonStep = 'draft' | 'free-agency';

export interface TechnicalAttributes {
  closeShot: number;       // 1-100
  midRange: number;        // 1-100
  threePoint: number;      // 1-100
  freeThrow: number;       // 1-100
  finishing: number;       // 1-100
  ballHandling: number;    // 1-100
  passingVision: number;   // 1-100
  passingAccuracy: number; // 1-100
  screenSetting: number;   // 1-100
  perimeterDefense: number;// 1-100
  interiorDefense: number; // 1-100
  helpDefense: number;     // 1-100
  steal: number;           // 1-100
  block: number;           // 1-100
  offRebound: number;      // 1-100
  defRebound: number;      // 1-100
}

export interface PhysicalAttributes {
  speed: number;        // 1-100
  acceleration: number; // 1-100
  strength: number;     // 1-100
  agility: number;      // 1-100
  vertical: number;     // 1-100
  stamina: number;      // 1-100
}

export interface MentalAttributes {
  iq: number;           // Basketball IQ / Decision Making (1-100)
  composure: number;    // Clutchness, under pressure (1-100)
  workRate: number;     // Hustle, energy (1-100)
  teamwork: number;     // Passing willingness, role adherence (1-100)
  leadership: number;   // Team booster, floor general (1-100)
}

export interface PlayerAttributes {
  technical: TechnicalAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
}

export interface PlayerPersonality {
  ego: number;                 // Ambition / Usage desire (1-100)
  loyalty: number;             // Likelihood to stay for less money (1-100)
  greed: number;               // Focus on salary size (1-100)
  morale: number;              // Current satisfaction (0-100)
  chemistry: number;           // Chemistry with teammates (0-100)
  usageExpectation: number;    // Desired Usage Rate (USG%)
}

export type OptionType = 'none' | 'player' | 'team' | 'non-guaranteed';
export type BirdRights = 'none' | 'non-bird' | 'early-bird' | 'full-bird';

export interface PlayerContract {
  salaries: number[];         // Salary for each year of contract remaining (e.g. [12000000, 12600000])
  option: OptionType;         // Option on the final year of the contract
  yearsServed: number;        // Consecutive years with this current team (for Bird Rights calculation)
  birdRights: BirdRights;     // Bird rights tier
  agentType: 'hardball' | 'reasonable' | 'ring-chaser' | 'team-first';
}

export interface Injury {
  description: string;
  daysRemaining: number;
}

export interface BoxScoreStats {
  minutes: number;
  points: number;
  assists: number;
  rebounds: number;
  offRebounds: number;
  defRebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  tpm: number; // 3PM
  tpa: number; // 3PA
  ftm: number;
  fta: number;
  plusMinus: number;
  games?: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  position: Position;
  attributes: PlayerAttributes;
  personality: PlayerPersonality;
  contract: PlayerContract;
  injury: Injury | null;
  fatigue: number;            // 0 (fully rested) to 100 (exhausted)
  morale: number;             // Current morale state (0-100)
  overallRating: number;      // Calculated overall rating (1-99)
  potential: number;          // Ceiling the offseason development roll can reach
  careerStats: Record<string, BoxScoreStats>; // Season index -> Cumulative Stats
  traits: string[];
  /** Seasons already played in the league. Zero is a rookie. */
  experience: number;
}

export interface CapExceptions {
  mle: boolean;
  biAnnual: boolean;
}

export type OffensiveStyle = 'pace-and-space' | 'pick-and-roll' | 'motion' | 'post-up' | 'isolation';
export type OffensiveRole = 'initiator' | 'secondary-initiator' | 'screen-setter' | 'spot-up' | 'rim-runner';
export type DefensiveCoverage = 'drop' | 'blitz' | 'switch-everything' | 'zone-23' | 'zone-32';
export type DoubleTeamTrigger = 'always' | 'late-clock' | 'never';
export type OverplayType = 'force-left' | 'force-right' | 'none';

export interface TeamTactics {
  tempo: 'slow' | 'balanced' | 'fast';
  offensiveStyle: OffensiveStyle;
  offensiveRoles: Record<string, OffensiveRole>; // Player ID -> Role
  defensiveCoverage: DefensiveCoverage;
  doubleTeamTrigger: DoubleTeamTrigger;
  targetOverplay: Record<string, OverplayType>;  // Opponent Player ID -> Overplay Type
}

export type MarketDeal = 'local' | 'partner' | 'national'

export interface SponsorDeal {
  name: string
  annual: number
}

export interface TeamFinances {
  salaryCap: number;
  /** Active salaries plus dead cap. This is the number the apron rules use. */
  salariesTotal: number;
  luxuryTaxApron1: number;
  luxuryTaxApron2: number;
  deadCap: number;
  /** Set when a team uses the full mid-level or the bi-annual. Null if uncapped. */
  hardCap: number | null;
  exceptions: CapExceptions;
  /** Cash outside the cap. Gate receipts land here. Payroll leaves here. */
  cash: number;
  seasonRevenue: number;
  seasonExpenses: number;
  /** Local, partner, or national. Scales the TV check on every game. */
  tvDeal?: MarketDeal;
  /** Paid in cash when the offseason opens. It does not hit the cap. */
  sponsor?: SponsorDeal;
  /** Monthly cash book. Missing on older saves until the league loads. */
  books?: MonthBook[];
  lastBookMonth?: string;
}

export interface MonthBook {
  month: string;
  gate: number;
  tv: number;
  merch: number;
  sponsor: number;
  stadium: number;
  salary: number;
  staff: number;
  fine: number;
  other: number;
}

export interface Coach {
  name: string;
  style: CoachStyle;
  age: number;
  origin: string;
  formerPlayer: boolean;
  /** 1-99. How often the offense finishes. */
  offense: number;
  /** 1-99. How hard shots are contested. */
  defense: number;
  /** 1-99. Young players take a win better. */
  teaching: number;
  /** 1-99. How the room handles a loss, a diva, and a fragile player. */
  manManagement: number;
  /** Where the coach came from. Sets the ratings and how the room treats him. */
  pedigree: CoachPedigree;
  /** Up to two. Each one helps the team and costs something. */
  signatures: CoachSignature[];
  /** 1-99. How quickly players give him the room. */
  respect: number;
}

export interface Owner {
  name: string;
  goalWins: number;
  patience: number;
}

export interface SeasonAwards {
  mvpId: string;
  dpoyId: string;
  royId: string | null;
  sixthId: string | null;
  mipId: string | null;
  allNbaIds: string[];
}

export interface AllStarWeekend {
  announced: boolean;
  eastIds: string[];
  westIds: string[];
}

export interface Team {
  id: string;
  name: string;
  city: string;
  conference: Conference;
  division: Division;
  color: string;
  /** Second uniform color. Missing on older saves until the league loads. */
  trim?: string;
  coach: Coach;
  owner: Owner;
  roster: Player[];
  depthChart: Record<Position, string[]>; // Position -> Ordered array of Player IDs
  tactics: TeamTactics;
  finances: TeamFinances;
  wins: number;
  losses: number;
  pointDiff: number;
  cupWins: number;
  cupLosses: number;
  history: {
    season: number;
    wins: number;
    losses: number;
  }[];
}

export interface OfficeNote {
  id: string;
  sender: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
}

export type WireRole = 'journalist' | 'team' | 'fan' | 'player' | 'show';

export interface WirePost {
  id: string;
  handle: string;
  name: string;
  role: WireRole;
  body: string;
  date: string;
}

export interface DraftPick {
  round: number;
  pick: number;
  teamId: string;
  prospectId?: string;
  playerName?: string;
}

export interface LiveMatchStats {
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

export interface DraftProspect {
  id: string;
  name: string;
  age: number;
  position: Position;
  school: string;
  projectedRange: 'Top 3' | 'Lottery' | 'First Round' | 'Second Round';
  overallRating: number;
  potentialRating: number;
  scouted: boolean;
  strengths: string[];
  weaknesses: string[];
  hiddenAttributes?: PlayerAttributes; // Generated at creation, revealed on scouting
}
