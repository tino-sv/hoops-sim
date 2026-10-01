/**
 * Pro league rules, rounded to the 2025-26 NBA CBA.
 * A college mod should replace this object (no cap, different roster and schedule)
 * instead of hardcoding numbers in the sim.
 */
export const NBA_RULES = {
  SALARY_CAP: 140_600_000,
  LUXURY_TAX: 170_814_000,
  FIRST_APRON: 178_132_000,
  SECOND_APRON: 188_910_000,
  MINIMUM_SALARY: 1_150_000,
  MAX_SALARY: 60_000_000,
  MLE: 12_800_000,
  TAXPAYER_MLE: 5_000_000,
  BAE: 4_700_000,
  ROSTER_MIN: 14,
  ROSTER_MAX: 15,
  /** Standard roster plus one pick per draft round, until opening day. */
  OFFSEASON_ROSTER_MAX: 17,
  DRAFT_ROUNDS: 2,
  SCOUTING_TOKENS: 8,
  PLAYOFF_SPOTS_PER_CONFERENCE: 8,
  PLAYOFF_WINS_TO_ADVANCE: 4,
  SEASON_GAMES: 82,
  TEAM_COUNT: 30,
  HOME_GATE_WIN: 1_400_000,
  HOME_GATE_LOSS: 1_050_000,
  AWAY_GATE: 180_000,
  TV_SHARE: 2_100_000,
  TV_LOCAL: 0.7,
  TV_NATIONAL: 1.4,
  /** Cash to buy the next tier up. Local to national pays both. A downgrade is free and does not refund this. */
  TV_BUYOUT_PARTNER: 25_000_000,
  TV_BUYOUT_NATIONAL: 45_000_000,
  SPONSOR_LOCAL: 7_000_000,
  SPONSOR_PARTNER: 12_000_000,
  SPONSOR_NATIONAL: 18_000_000,
  CUP_PURSE: 2_000_000,
  /** Cash for a new home uniform. It does not hit the cap. */
  JERSEY_ORDER: 2_000_000,
  /** Cash to move the club to an open city. Division and conference stay. */
  RELOCATION_FEE: 35_000_000,
  SCHEMA_VERSION: 3
} as const

export const CBA_CONSTANTS = {
  SALARY_CAP: NBA_RULES.SALARY_CAP,
  LUXURY_TAX: NBA_RULES.LUXURY_TAX,
  FIRST_APRON: NBA_RULES.FIRST_APRON,
  SECOND_APRON: NBA_RULES.SECOND_APRON,
  MINIMUM_SALARY: NBA_RULES.MINIMUM_SALARY,
  MAX_SALARY: NBA_RULES.MAX_SALARY,
  MLE: NBA_RULES.MLE,
  TAXPAYER_MLE: NBA_RULES.TAXPAYER_MLE,
  BAE: NBA_RULES.BAE,
  ROSTER_MIN: NBA_RULES.ROSTER_MIN,
  ROSTER_MAX: NBA_RULES.ROSTER_MAX,
  OFFSEASON_ROSTER_MAX: NBA_RULES.OFFSEASON_ROSTER_MAX,
  ROOKIE_SCALE_BASE: 3_200_000
}
