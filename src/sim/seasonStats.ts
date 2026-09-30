import type { BoxScoreStats } from './types'

export interface SeasonLine {
  gp: number
  min: number
  pts: number
  reb: number
  oreb: number
  dreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  plusMinus: number
  fgPct: number
  tpPct: number
  ftPct: number
  efgPct: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
}

export function seasonLine(stats: BoxScoreStats | undefined): SeasonLine {
  const gp = stats?.games || 0
  const per = (value: number) => (gp > 0 ? value / gp : 0)
  const rate = (made: number, attempts: number) => (attempts > 0 ? (made / attempts) * 100 : 0)
  const fgm = stats?.fgm ?? 0
  const fga = stats?.fga ?? 0
  const tpm = stats?.tpm ?? 0
  const tpa = stats?.tpa ?? 0
  const ftm = stats?.ftm ?? 0
  const fta = stats?.fta ?? 0
  return {
    gp,
    min: per(stats?.minutes ?? 0),
    pts: per(stats?.points ?? 0),
    reb: per(stats?.rebounds ?? 0),
    oreb: per(stats?.offRebounds ?? 0),
    dreb: per(stats?.defRebounds ?? 0),
    ast: per(stats?.assists ?? 0),
    stl: per(stats?.steals ?? 0),
    blk: per(stats?.blocks ?? 0),
    tov: per(stats?.turnovers ?? 0),
    pf: per(stats?.fouls ?? 0),
    plusMinus: per(stats?.plusMinus ?? 0),
    fgPct: rate(fgm, fga),
    tpPct: rate(tpm, tpa),
    ftPct: rate(ftm, fta),
    efgPct: fga > 0 ? ((fgm + 0.5 * tpm) / fga) * 100 : 0,
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta
  }
}

export function madeAttempts(made: number, attempts: number): string {
  return `${made}-${attempts}`
}
