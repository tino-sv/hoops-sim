import { playerOrigin } from './players'
import { seasonLine } from './seasonStats'
import type { Coach, CoachPedigree, CoachSignature, CoachStyle, MarketDeal, MonthBook, Player, SeasonAwards, Team, WirePost } from './types'
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

const TV_RANK: Record<MarketDeal, number> = { local: 0, partner: 1, national: 2 }

export function tvCheck(team: Team): number {
  return tvCheckFor(team.finances.tvDeal ?? 'partner')
}

export function tvCheckFor(tier: MarketDeal): number {
  const scale = tier === 'national' ? NBA_RULES.TV_NATIONAL : tier === 'local' ? NBA_RULES.TV_LOCAL : 1
  return Math.round(NBA_RULES.TV_SHARE * scale)
}

export function tvUpgradeCost(from: MarketDeal, to: MarketDeal): number {
  const steps = TV_RANK[to] - TV_RANK[from]
  if (steps <= 0) return 0
  if (steps === 2) return NBA_RULES.TV_BUYOUT_PARTNER + NBA_RULES.TV_BUYOUT_NATIONAL
  return to === 'national' ? NBA_RULES.TV_BUYOUT_NATIONAL : NBA_RULES.TV_BUYOUT_PARTNER
}

export function ensureCommercials(team: Team, index = 0): void {
  const tier = team.finances.tvDeal ?? marketTier(team)
  team.finances.tvDeal = tier
  if (!team.finances.sponsor) {
    team.finances.sponsor = { name: SPONSORS[index % SPONSORS.length], annual: sponsorAnnual(tier) }
  }
}

function handleFor(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

export function gamePosts(args: {
  user: Team
  opponent: Team
  userScore: number
  oppScore: number
  date: string
}): Omit<WirePost, 'id'>[] {
  const { user, opponent, userScore, oppScore, date } = args
  const won = userScore > oppScore
  const margin = Math.abs(userScore - oppScore)
  const star = [...user.roster].sort((a, b) => b.overallRating - a.overallRating)[0]
  const line = `${user.city} ${userScore}, ${opponent.city} ${oppScore}`
  const journalist = won
    ? margin >= 15
      ? `${user.city} ran ${opponent.city} out of the gym. ${line}.`
      : `${user.city} got the win. ${line}.`
    : `${user.city} dropped this one. ${line}. ${user.coach.name} will hear about it.`
  const show = won
    ? `Tape from ${user.city}. ${line}.`
    : `${user.coach.name}'s group had no answer for ${opponent.city}. ${line}.`
  const player = won ? `Job done. ${line}.` : `That one is on us. ${line}.`
  const crowd: Omit<WirePost, 'id'> = margin <= 6
    ? {
        handle: 'section114',
        name: 'Section 114',
        role: 'fan',
        body: won ? `Hands were shaking. ${line}.` : `I am not watching the fourth of that again. ${line}.`,
        date
      }
    : {
        handle: handleFor(user.name),
        name: `${user.city} ${user.name}`,
        role: 'team',
        body: `Final. ${line}.`,
        date
      }
  return [
    { handle: handleFor(star.name), name: star.name, role: 'player', body: player, date },
    { handle: 'hooptape', name: 'Hoop Tape', role: 'show', body: show, date },
    { handle: handleFor(user.city) + 'desk', name: `${user.city} Desk`, role: 'journalist', body: journalist, date },
    crowd
  ]
}

const BOOK_KINDS = ['gate', 'tv', 'merch', 'sponsor', 'stadium', 'salary', 'staff', 'fine', 'jersey', 'move', 'buyout', 'tax', 'cup', 'other'] as const
type BookKind = typeof BOOK_KINDS[number]

export function emptyMonth(month: string): MonthBook {
  return { month, gate: 0, tv: 0, merch: 0, sponsor: 0, stadium: 0, salary: 0, staff: 0, fine: 0, jersey: 0, move: 0, buyout: 0, tax: 0, cup: 0, other: 0 }
}

export function monthKey(date: string): string {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : 'preseason'
}

function monthRow(team: Team, month: string): MonthBook {
  if (!team.finances.books) team.finances.books = []
  let row = team.finances.books.find(book => book.month === month)
  if (!row) {
    row = emptyMonth(month)
    team.finances.books.push(row)
    team.finances.books.sort((a, b) => a.month.localeCompare(b.month))
  }
  return row
}

/** One cash line. Positive is income. The year totals move with it. */
export function postCash(team: Team, kind: BookKind, amount: number, month: string) {
  if (!amount) return
  const row = monthRow(team, month)
  row[kind] = (row[kind] ?? 0) + amount
  team.finances.cash += amount
  if (amount > 0) team.finances.seasonRevenue += amount
  else team.finances.seasonExpenses += -amount
}

export function gateReceipt(home: boolean, won: boolean): number {
  if (!home) return NBA_RULES.AWAY_GATE
  return won ? NBA_RULES.HOME_GATE_WIN : NBA_RULES.HOME_GATE_LOSS
}

export function televisionIncome(team: Team): number {
  return tvCheck(team)
}

export function playerPayroll(team: Team): number {
  return Math.round(CBASimulator.capHit(team) / NBA_RULES.SEASON_GAMES)
}

export function merchIncome(team: Team): number {
  const tier = team.finances.tvDeal ?? 'partner'
  const base = tier === 'national' ? NBA_RULES.MERCH_NATIONAL : tier === 'local' ? NBA_RULES.MERCH_LOCAL : NBA_RULES.MERCH_PARTNER
  const played = team.wins + team.losses
  const winRate = played === 0 ? 0.5 : team.wins / played
  return Math.round(base * (0.8 + winRate * 0.4))
}

export function stadiumCost(): number {
  return NBA_RULES.STADIUM_UPKEEP
}

export function staffPayroll(): number {
  return NBA_RULES.STAFF_PAYROLL
}

export function levyFine(team: Team, amount: number, month: string) {
  postCash(team, 'fine', -Math.abs(amount), month)
}

/** Shirts, the building, and the staff. Once per calendar month, not once per game. */
export function closeMonth(team: Team, month: string) {
  postCash(team, 'merch', merchIncome(team), month)
  postCash(team, 'stadium', -stadiumCost(), month)
  postCash(team, 'staff', -staffPayroll(), month)
}

export function bookGameMoney(team: Team, home: boolean, won: boolean, date = 'preseason') {
  const month = monthKey(date)
  if (team.finances.lastBookMonth !== month) {
    closeMonth(team, month)
    team.finances.lastBookMonth = month
  }
  postCash(team, 'gate', gateReceipt(home, won), month)
  postCash(team, 'tv', televisionIncome(team), month)
  postCash(team, 'salary', -playerPayroll(team), month)
}

export function yearBooks(team: Team): MonthBook {
  const total = emptyMonth('year')
  for (const book of team.finances.books ?? []) {
    for (const kind of BOOK_KINDS) total[kind] += book[kind] ?? 0
  }
  return total
}

export interface PedigreePreset {
  label: string
  note: string
  style: CoachStyle
  offense: number
  defense: number
  teaching: number
  manManagement: number
  formerPlayer: boolean
  respect: number
}

export const PEDIGREE_PRESETS: Record<CoachPedigree, PedigreePreset> = {
  'former-star': {
    label: 'Former star',
    note: 'Veterans listen. Young players feel the gap after a loss.',
    style: 'players-coach',
    offense: 62,
    defense: 62,
    teaching: 62,
    manManagement: 88,
    formerPlayer: true,
    respect: 86
  },
  'video-room': {
    label: 'Video room',
    note: 'The offense finishes a little more often. Veteran leaders want results.',
    style: 'tactician',
    offense: 88,
    defense: 76,
    teaching: 48,
    manManagement: 48,
    formerPlayer: false,
    respect: 42
  },
  'college-mentor': {
    label: 'College mentor',
    note: 'Young players leave a win higher. The team fouls less, and late games are thinner.',
    style: 'players-coach',
    offense: 62,
    defense: 62,
    teaching: 88,
    manManagement: 76,
    formerPlayer: false,
    respect: 70
  },
  'european-tactician': {
    label: 'European tactician',
    note: 'The ball moves. A diva shoots worse until the room buys in.',
    style: 'tactician',
    offense: 88,
    defense: 76,
    teaching: 62,
    manManagement: 62,
    formerPlayer: false,
    respect: 58
  }
}

export interface SignaturePreset {
  id: CoachSignature
  label: string
  effect: string
}

export const SIGNATURE_PRESETS: SignaturePreset[] = [
  { id: 'seven-seconds', label: 'Seven seconds or less', effect: 'Transition finishes more often. Half-court turnovers rise, and the roster tires faster.' },
  { id: 'lockdown', label: 'Lockdown architect', effect: 'Shots are contested harder. The team fouls more.' },
  { id: 'players-friend', label: "Player's best friend", effect: 'A loss costs about half as much morale.' }
]

export function skillWord(value: number): string {
  if (value >= 82) return 'Elite'
  if (value >= 74) return 'Sharp'
  if (value >= 60) return 'Solid'
  return 'Developing'
}

export function styleWord(style: CoachStyle | undefined): string {
  if (style === 'tactician') return 'Tactician'
  if (style === 'disciplinarian') return 'Disciplinarian'
  return "Players' coach"
}

export function pedigreeForStyle(style: CoachStyle | undefined): CoachPedigree {
  if (style === 'tactician') return 'video-room'
  if (style === 'disciplinarian') return 'college-mentor'
  return 'former-star'
}

export function clampSignatures(list: CoachSignature[] | undefined): CoachSignature[] {
  const allowed = new Set(SIGNATURE_PRESETS.map(item => item.id))
  const picked: CoachSignature[] = []
  for (const id of list ?? []) {
    if (!allowed.has(id) || picked.includes(id)) continue
    picked.push(id)
    if (picked.length === 2) break
  }
  return picked
}

export function hasSignature(coach: Coach | undefined, id: CoachSignature): boolean {
  return !!coach?.signatures?.includes(id)
}

export function rollCoach(name: string, style: CoachStyle, index = 0): Coach {
  const lean = style === 'tactician'
    ? { offense: 76, defense: 58, teaching: 62, manManagement: 54 }
    : style === 'disciplinarian'
      ? { offense: 56, defense: 78, teaching: 66, manManagement: 46 }
      : { offense: 64, defense: 60, teaching: 72, manManagement: 76 }
  const pedigree = pedigreeForStyle(style)
  return {
    name,
    style,
    age: 41 + (index * 3) % 22,
    origin: playerOrigin(name),
    formerPlayer: index % 3 !== 0,
    pedigree,
    signatures: [],
    respect: PEDIGREE_PRESETS[pedigree].respect,
    ...lean
  }
}

export function ensureCoach(team: Team, index = 0) {
  const coach = team.coach
  if (!coach?.name) return
  if (typeof coach.age !== 'number' || !coach.origin || typeof coach.offense !== 'number') {
    const rolled = rollCoach(coach.name, coach.style ?? 'players-coach', index)
    team.coach = { ...rolled, name: coach.name, style: coach.style ?? rolled.style }
  }
  const current = team.coach
  if (!current.pedigree) current.pedigree = pedigreeForStyle(current.style)
  current.signatures = clampSignatures(current.signatures)
  if (typeof current.respect !== 'number') current.respect = PEDIGREE_PRESETS[current.pedigree].respect
}

export interface CoachTrait {
  name: string
  effect: string
}

export function coachTraits(coach: Partial<Coach>): CoachTrait[] {
  const list: CoachTrait[] = []
  const pedigree = coach.pedigree ? PEDIGREE_PRESETS[coach.pedigree] : null
  if (pedigree) list.push({ name: pedigree.label, effect: pedigree.note })
  for (const id of clampSignatures(coach.signatures)) {
    const signature = SIGNATURE_PRESETS.find(item => item.id === id)
    if (signature) list.push({ name: signature.label, effect: signature.effect })
  }
  if (coach.formerPlayer) list.push({ name: 'Former pro', effect: 'A loss sits lighter in the room.' })
  if ((coach.offense ?? 0) >= 75) list.push({ name: 'Shot doctor', effect: 'The offense finishes a little more often.' })
  if ((coach.defense ?? 0) >= 75) list.push({ name: 'Defensive mind', effect: 'Shots are contested a little harder.' })
  if ((coach.teaching ?? 0) >= 75) list.push({ name: 'Developer', effect: 'Young players leave a win in a better mood.' })
  if ((coach.manManagement ?? 0) >= 75) list.push({ name: 'Locker room', effect: 'Divas and fragile players take a loss better.' })
  if ((coach.manManagement ?? 60) <= 42) list.push({ name: 'Cold', effect: 'The room feels a loss more.' })
  return list
}

export function coachMakeBoost(coach: Coach | undefined, side: 'offense' | 'defense'): number {
  if (!coach) return 0
  let boost = 0
  if (coach.style === 'tactician' && side === 'offense') boost += 0.004
  if (coach.style === 'disciplinarian' && side === 'defense') boost += 0.004
  if (side === 'defense' && hasSignature(coach, 'lockdown')) boost += 0.006
  const skill = side === 'offense' ? coach.offense ?? 60 : coach.defense ?? 60
  boost += (skill - 60) * 0.00005
  return boost
}

export function coachShotAdjust(coach: Coach | undefined, shot: {
  fastBreak: boolean
  quarter: number
  secondsRemaining: number
  shooterIsDiva: boolean
  roomMorale: number
}): number {
  if (!coach) return 0
  let make = 0
  if (coach.pedigree === 'video-room' || coach.pedigree === 'european-tactician') make += 0.003
  if (coach.pedigree === 'european-tactician' && shot.shooterIsDiva && shot.roomMorale < 72) make -= 0.01
  if (coach.pedigree === 'college-mentor' && shot.quarter >= 4 && shot.secondsRemaining < 120) make -= 0.008
  if (hasSignature(coach, 'seven-seconds') && shot.fastBreak) make += 0.03
  return make
}

export function coachTurnoverBump(coach: Coach | undefined, fastBreak: boolean): number {
  if (fastBreak || !hasSignature(coach, 'seven-seconds')) return 0
  return 0.008
}

export function coachFoulMultiplier(coach: Coach | undefined): number {
  let factor = 1
  if (coach?.pedigree === 'college-mentor') factor *= 0.92
  if (hasSignature(coach, 'lockdown')) factor *= 1.1
  return factor
}

export function coachFatigueFactor(coach: Coach | undefined): number {
  let factor = coach?.style === 'disciplinarian' ? 0.92 : 1
  if (hasSignature(coach, 'seven-seconds')) factor *= 1.12
  return factor
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
