import { seasonLine } from './seasonStats'
import type { CoachStyle, MarketDeal, Player, SeasonAwards, Team } from './types'
import { NBA_RULES } from './rules'
import { CBASimulator } from './cba'

const SPONSORS = [
  'Harbor Bank', 'Northline', 'Red Cedar', 'Glasshouse', 'Summit Rail', 'Copper Kettle',
  'Brightwater', 'Fieldstone', 'Lumen Fuel', 'Oak & Iron', 'Marlow', 'Kinship',
  'Paperplane', 'Westwind', 'Cobalt', 'Hearth', 'Silverline', 'Driftwood',
  'Amberjack', 'Pine State', 'Lowland', 'Vantage', 'Commonwealth', 'Nighthawk',
  'Riverbed', 'Halcyon', 'Broadstreet', 'Kindling', 'Atlas Grocery', 'Second Shift'
]

export function marketTier(team: Team): MarketDeal {
  if (team.owner.goalWins >= 50) return 'national'
  if (team.owner.goalWins <= 30) return 'local'
  return 'partner'
}

export function sponsorAnnual(tier: MarketDeal): number {
  if (tier === 'national') return NBA_RULES.SPONSOR_NATIONAL
  if (tier === 'local') return NBA_RULES.SPONSOR_LOCAL
  return NBA_RULES.SPONSOR_PARTNER
}

export function tvCheck(team: Team): number {
  const tier = team.finances.tvDeal ?? 'partner'
  const scale = tier === 'national' ? NBA_RULES.TV_NATIONAL : tier === 'local' ? NBA_RULES.TV_LOCAL : 1
  return Math.round(NBA_RULES.TV_SHARE * scale)
}

export function ensureCommercials(team: Team, index = 0): void {
  const tier = team.finances.tvDeal ?? marketTier(team)
  team.finances.tvDeal = tier
  if (!team.finances.sponsor) {
    team.finances.sponsor = { name: SPONSORS[index % SPONSORS.length], annual: sponsorAnnual(tier) }
  }
}

export function bookGameMoney(team: Team, home: boolean, won: boolean) {
  const gate = home ? (won ? NBA_RULES.HOME_GATE_WIN : NBA_RULES.HOME_GATE_LOSS) : NBA_RULES.AWAY_GATE
  const tv = tvCheck(team)
  const payroll = Math.round(CBASimulator.capHit(team) / NBA_RULES.SEASON_GAMES)
  team.finances.cash += gate + tv - payroll
  team.finances.seasonRevenue += gate + tv
  team.finances.seasonExpenses += payroll
}

export function coachMakeBoost(style: CoachStyle | undefined, side: 'offense' | 'defense'): number {
  if (style === 'tactician' && side === 'offense') return 0.004
  if (style === 'disciplinarian' && side === 'defense') return 0.004
  return 0
}

export function coachFatigueFactor(style: CoachStyle | undefined): number {
  return style === 'disciplinarian' ? 0.92 : 1
}

function mvpScore(player: Player, team: Team): number {
  const line = seasonLine(player.careerStats['season'])
  if (line.gp < 1) return player.overallRating / 10
  const games = team.wins + team.losses
  const win = games === 0 ? 0.5 : team.wins / games
  return line.pts + line.reb * 0.4 + line.ast * 0.5 + line.stl + line.blk * 1.2 + win * 8
}

function isReserve(team: Team, player: Player): boolean {
  const chart = team.depthChart[player.position] || []
  const index = chart.indexOf(player.id)
  return index > 0
}

export interface AwardCandidate {
  player: Player
  team: Team
  mvp: number
  defense: number
  reserve: boolean
}

export function awardRace(teams: Team[]): AwardCandidate[] {
  return teams.flatMap(team => team.roster.map(player => {
    const line = seasonLine(player.careerStats['season'])
    return {
      player,
      team,
      mvp: mvpScore(player, team),
      defense: line.stl + line.blk * 1.4 + line.dreb * 0.25,
      reserve: isReserve(team, player)
    }
  }))
}

export function pickAwards(teams: Team[]): SeasonAwards {
  const pool = awardRace(teams)
  const ranked = [...pool].sort((a, b) => b.mvp - a.mvp)
  const mvp = ranked[0]?.player
  const defense = [...pool].sort((a, b) => b.defense - a.defense)
  const rookies = pool.filter(item => item.player.experience === 0)
  const royPool = rookies.length ? rookies : pool
  const roy = [...royPool].sort((a, b) => mvpScore(b.player, b.team) - mvpScore(a.player, a.team))[0]?.player
  const reserves = pool.filter(item => isReserve(item.team, item.player) && seasonLine(item.player.careerStats['season']).gp >= 20)
  const sixth = [...reserves].sort((a, b) => seasonLine(b.player.careerStats['season']).pts - seasonLine(a.player.careerStats['season']).pts)[0]?.player
  const jumps = pool.flatMap(item => {
    const current = seasonLine(item.player.careerStats['season'])
    const priorKey = Object.keys(item.player.careerStats).find(key => key.startsWith('s'))
    const prior = priorKey ? item.player.careerStats[priorKey] : undefined
    if (!prior?.games || prior.games < 40 || current.gp < 40) return []
    return [{ id: item.player.id, jump: current.pts - prior.points / prior.games }]
  }).sort((a, b) => b.jump - a.jump)

  return {
    mvpId: mvp?.id ?? '',
    dpoyId: defense[0]?.player.id ?? mvp?.id ?? '',
    royId: roy && seasonLine(roy.careerStats['season']).gp >= 10 ? roy.id : null,
    sixthId: sixth?.id ?? null,
    mipId: jumps[0] && jumps[0].jump >= 1 ? jumps[0].id : null,
    allNbaIds: ranked.slice(0, 15).map(item => item.player.id)
  }
}

export function pickAllStars(teams: Team[], conference: 'East' | 'West'): string[] {
  return teams
    .filter(team => team.conference === conference)
    .flatMap(team => team.roster.map(player => ({ player, team })))
    .sort((a, b) => mvpScore(b.player, b.team) - mvpScore(a.player, a.team))
    .slice(0, 12)
    .map(item => item.player.id)
}

export function findPlayer(teams: Team[], id: string | null | undefined): Player | undefined {
  if (!id) return undefined
  for (const team of teams) {
    const player = team.roster.find(item => item.id === id)
    if (player) return player
  }
  return undefined
}

export function luxuryTaxBill(team: Team): number {
  const hit = CBASimulator.capHit(team)
  if (hit <= NBA_RULES.LUXURY_TAX) return 0
  return Math.round((hit - NBA_RULES.LUXURY_TAX) * 1.5)
}
