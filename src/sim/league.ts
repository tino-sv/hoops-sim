import { isGlue, settleTeamMorale } from './badges'
import { birdFromYears, CBASimulator, type OfferVerdict } from './cba'
import { MatchEngine } from './matchEngine'
import { bookGameMoney, clampSignatures, ensureCoach, ensureCommercials, findPlayer, gamePosts, levyFine, monthKey, PEDIGREE_PRESETS, pedigreeForStyle, pickAllStars, pickAwards, postCash, rollCoach, SIGNATURE_PRESETS, luxuryTaxBill, tvCheck, tvUpgradeCost } from './office'
import { createPlayer, createProspect, healPlayer, hurtPlayer, playerFromProspect } from './players'
import { deriveTraits, developPlayer } from './ratings'
import { NBA_RULES } from './rules'
import { addToDepthChart, rebuildDepthChart, waivePlayer } from './roster'
import { buildSeason, type ScheduleTeam } from './schedule'
import type { AllStarWeekend, BoxScoreStats, CoachPedigree, CoachSignature, CoachStyle, Conference, Division, DraftPick, DraftProspect, MarketDeal, OfficeNote, OffseasonStep, Player, Position, SeasonAwards, SeasonPhase, Team, TeamTactics, WirePost } from './types'
import { POSITIONS } from './types'

const TEAM_TEMPLATES: { city: string; name: string; color: string; conference: Conference; division: Division; coach: string; owner: string }[] = [
  { city: 'Boston', name: 'Shamrocks', color: '#008348', conference: 'East', division: 'Atlantic', coach: 'Alex Ward', owner: 'Helen Cho' },
  { city: 'New York', name: 'Skyscrapers', color: '#F58426', conference: 'East', division: 'Atlantic', coach: 'Marcus Hale', owner: 'Diane Voss' },
  { city: 'Philadelphia', name: 'Phantoms', color: '#006BB6', conference: 'East', division: 'Atlantic', coach: 'Andre Pell', owner: 'Ruth Keene' },
  { city: 'Toronto', name: 'Dinos', color: '#E31837', conference: 'East', division: 'Atlantic', coach: 'Samir Patel', owner: 'Nora Lind' },
  { city: 'Brooklyn', name: 'Bridges', color: '#000000', conference: 'East', division: 'Atlantic', coach: 'Chris Adeyemi', owner: 'Paul Okonkwo' },
  { city: 'Chicago', name: 'Wind', color: '#CE1141', conference: 'East', division: 'Central', coach: 'Elena Brooks', owner: 'Frank Iverson' },
  { city: 'Milwaukee', name: 'Stags', color: '#00471B', conference: 'East', division: 'Central', coach: 'Owen Hart', owner: 'Maya Solis' },
  { city: 'Detroit', name: 'Motors', color: '#1D42BA', conference: 'East', division: 'Central', coach: 'Luis Ortega', owner: 'Beth Calder' },
  { city: 'Cleveland', name: 'Rocks', color: '#860038', conference: 'East', division: 'Central', coach: 'Nina Petrova', owner: 'George Lam' },
  { city: 'Indianapolis', name: 'Steam', color: '#002D62', conference: 'East', division: 'Central', coach: 'Theo Marsh', owner: 'Alice Nguyen' },
  { city: 'Miami', name: 'Heatwave', color: '#98002E', conference: 'East', division: 'Southeast', coach: 'Camila Reyes', owner: 'Victor Lang' },
  { city: 'Atlanta', name: 'Embers', color: '#E03A3E', conference: 'East', division: 'Southeast', coach: 'Jordan Ellis', owner: 'Priya Shah' },
  { city: 'Charlotte', name: 'Queens', color: '#1D1160', conference: 'East', division: 'Southeast', coach: 'Miles Grant', owner: 'Hannah Crowe' },
  { city: 'Orlando', name: 'Surf', color: '#0077C0', conference: 'East', division: 'Southeast', coach: 'Devin Cole', owner: 'Sofia Marin' },
  { city: 'Washington', name: 'Monuments', color: '#002B5C', conference: 'East', division: 'Southeast', coach: 'Amina Diallo', owner: 'Robert Chen' },
  { city: 'Denver', name: 'Peaks', color: '#0E2240', conference: 'West', division: 'Northwest', coach: 'Caleb Frost', owner: 'June Harlow' },
  { city: 'Seattle', name: 'Jetstreams', color: '#006241', conference: 'West', division: 'Northwest', coach: 'Naomi Park', owner: 'Erik Soren' },
  { city: 'Minneapolis', name: 'Lakes', color: '#0C2340', conference: 'West', division: 'Northwest', coach: 'Wes Gallagher', owner: 'Linda Berg' },
  { city: 'Portland', name: 'Pines', color: '#E03A3E', conference: 'West', division: 'Northwest', coach: 'Isaac Romero', owner: 'Claire Dunn' },
  { city: 'Salt Lake', name: 'Granite', color: '#002B5C', conference: 'West', division: 'Northwest', coach: 'Noah Briggs', owner: 'Esther Cole' },
  { city: 'Los Angeles', name: 'Breakers', color: '#552583', conference: 'West', division: 'Pacific', coach: 'Malik Benton', owner: 'Grace Yoo' },
  { city: 'Golden State', name: 'Waves', color: '#1D428A', conference: 'West', division: 'Pacific', coach: 'Riley Santos', owner: 'Howard Peck' },
  { city: 'Phoenix', name: 'Flares', color: '#E56020', conference: 'West', division: 'Pacific', coach: 'Diego Alvarez', owner: 'Kim Tran' },
  { city: 'Sacramento', name: 'Rivers', color: '#5A2D81', conference: 'West', division: 'Pacific', coach: 'Jonah Blake', owner: 'Patricia Ng' },
  { city: 'Las Vegas', name: 'Neon', color: '#000000', conference: 'West', division: 'Pacific', coach: 'Felix Moore', owner: 'Asha Bennett' },
  { city: 'Dallas', name: 'Stallions', color: '#00538C', conference: 'West', division: 'Southwest', coach: 'Grant Wheeler', owner: 'Monica Ruiz' },
  { city: 'Houston', name: 'Gulf', color: '#CE1141', conference: 'West', division: 'Southwest', coach: 'Tanya Okada', owner: 'Bill Mercer' },
  { city: 'San Antonio', name: 'Bells', color: '#C4CED4', conference: 'West', division: 'Southwest', coach: 'Mateo Cruz', owner: 'Irene Vasquez' },
  { city: 'New Orleans', name: 'Bayou', color: '#0C2340', conference: 'West', division: 'Southwest', coach: 'Lucien Baptiste', owner: 'Marie Landry' },
  { city: 'Oklahoma City', name: 'Range', color: '#007AC1', conference: 'West', division: 'Southwest', coach: 'Seth Walker', owner: 'Dana Iqbal' }
]

const COACH_STYLES: CoachStyle[] = ['players-coach', 'tactician', 'disciplinarian']
const DIVISIONS: Division[] = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest']

export type PlayoffRoundName = 'first' | 'semi' | 'conf' | 'final'

export interface PlayoffSeries {
  id: string
  round: PlayoffRoundName
  conference: Conference | 'Finals'
  highId: string
  lowId: string
  highSeed: number
  lowSeed: number
  highWins: number
  lowWins: number
  winnerId: string | null
  playedIds: string[]
}

export function playoffRoundLabel(round: PlayoffRoundName): string {
  if (round === 'first') return 'First round'
  if (round === 'semi') return 'Conference semifinals'
  if (round === 'conf') return 'Conference finals'
  return 'Finals'
}

export interface ScheduledMatch {
  id: string
  round: number
  date: string
  homeTeamId: string
  awayTeamId: string
  cup: boolean
  cupKnockout?: 'quarter' | 'semi' | 'final'
  exhibition?: boolean
  playoff?: boolean
  playoffSeriesId?: string
  simulated: boolean
  scoreHome?: number
  scoreAway?: number
  winnerId?: string
  playByPlaySummary?: string
}

type TeamQuality = 'contender' | 'middle' | 'rebuild'

const GOAL_WINS: Record<TeamQuality, number> = { contender: 50, middle: 40, rebuild: 30 }

function outlookFor(index: number): TeamQuality {
  if (index % 5 === 0) return 'contender'
  if (index % 5 === 4) return 'rebuild'
  return 'middle'
}

export interface HiredCoach {
  name: string
  style: CoachStyle
  tempo: TeamTactics['tempo']
  offense: TeamTactics['offensiveStyle']
  coverage: TeamTactics['defensiveCoverage']
  age?: number
  origin?: string
  formerPlayer?: boolean
  offenseSkill?: number
  defenseSkill?: number
  teaching?: number
  manManagement?: number
  pedigree?: CoachPedigree
  signatures?: CoachSignature[]
}

export interface CareerChoice {
  id: string
  city: string
  name: string
  color: string
  conference: Conference
  division: Division
  outlook: TeamQuality
  goalWins: number
  coach: string
  owner: string
}

export function careerChoices(): CareerChoice[] {
  return TEAM_TEMPLATES.map((template, index) => {
    const outlook = outlookFor(index)
    return {
      id: `team_${index + 1}`,
      city: template.city,
      name: template.name,
      color: template.color,
      conference: template.conference,
      division: template.division,
      outlook,
      goalWins: GOAL_WINS[outlook],
      coach: template.coach,
      owner: template.owner
    }
  })
}

export const OPEN_MARKETS = [
  'Montreal', 'Pittsburgh', 'Baltimore', 'Cincinnati',
  'Vancouver', 'San Diego', 'Austin', 'Kansas City'
]

const DEFAULT_TRIM = '#E8E4D9'
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function deny(reason: string): OfferVerdict {
  return { allowed: false, exceptionUsed: 'None', reason, consumes: null, setsHardCap: null }
}

function between(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export class LeagueManager {
  teams: Team[] = []
  schedule: ScheduledMatch[] = []
  currentRound = 1
  totalRounds = 44
  season = 2026
  phase: SeasonPhase = 'regular'
  offseasonStep: OffseasonStep | null = null
  seasonComplete = false
  userTeamId = 'team_1'
  matchEngine = new MatchEngine()
  freeAgents: Player[] = []
  draftProspects: DraftProspect[] = []
  scoutingTokens = NBA_RULES.SCOUTING_TOKENS
  draftOrder: DraftPick[] = []
  draftIndex = 0
  news: OfficeNote[] = []
  wire: WirePost[] = []
  allStarRound = 40
  allStarDate = ''
  allStarDone = false
  allStar: AllStarWeekend = { announced: false, eastIds: [], westIds: [] }
  cupResolved = false
  cupChampionId: string | null = null
  awards: SeasonAwards | null = null
  playoffSeries: PlayoffSeries[] = []
  championId: string | null = null
  /** Last night injuries were counted down. */
  injuryDate = ''

  constructor() {
    if (this.loadFromLocalStorage()) return
    if (typeof window === 'undefined') this.initializeLeague()
  }

  userTeam(): Team {
    return this.teams.find(team => team.id === this.userTeamId) ?? this.teams[0]
  }

  currentPick(): DraftPick | null {
    return this.draftOrder[this.draftIndex] ?? null
  }

  private note(sender: string, subject: string, body: string) {
    this.news.unshift({
      id: 'n_' + Math.random().toString(36).slice(2, 8),
      sender,
      subject,
      body,
      date: this.phase === 'offseason' ? `Offseason ${this.season}` : `Season ${this.season}`,
      read: false
    })
    this.news = this.news.slice(0, 12)
  }

  private publish(post: Omit<WirePost, 'id'>) {
    this.wire.unshift({ id: 'w_' + Math.random().toString(36).slice(2, 8), ...post })
    this.wire = this.wire.slice(0, 40)
  }

  private reactToGame(home: Team, away: Team, homeScore: number, awayScore: number, date: string) {
    const user = home.id === this.userTeamId ? home : away.id === this.userTeamId ? away : null
    if (!user) return
    const opponent = user === home ? away : home
    const posts = gamePosts({
      user,
      opponent,
      userScore: user === home ? homeScore : awayScore,
      oppScore: user === home ? awayScore : homeScore,
      date
    })
    for (let i = posts.length - 1; i >= 0; i--) this.publish(posts[i])
  }

  private takenNames(): Set<string> {
    const used = new Set<string>()
    for (const team of this.teams) for (const player of team.roster) used.add(player.name)
    for (const player of this.freeAgents) used.add(player.name)
    for (const prospect of this.draftProspects) used.add(prospect.name)
    return used
  }

  saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage || this.teams.length === 0) return
    window.localStorage.setItem('hoops_sim_league_data', JSON.stringify({
      schemaVersion: NBA_RULES.SCHEMA_VERSION,
      teams: this.teams,
      schedule: this.schedule,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      season: this.season,
      phase: this.phase,
      offseasonStep: this.offseasonStep,
      seasonComplete: this.seasonComplete,
      userTeamId: this.userTeamId,
      freeAgents: this.freeAgents,
      draftProspects: this.draftProspects,
      scoutingTokens: this.scoutingTokens,
      draftOrder: this.draftOrder,
      draftIndex: this.draftIndex,
      news: this.news,
      wire: this.wire,
      allStarRound: this.allStarRound,
      allStarDate: this.allStarDate,
      allStarDone: this.allStarDone,
      allStar: this.allStar,
      cupResolved: this.cupResolved,
      cupChampionId: this.cupChampionId,
      awards: this.awards,
      playoffSeries: this.playoffSeries,
      championId: this.championId,
      injuryDate: this.injuryDate
    }))
  }

  loadFromLocalStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const saved = window.localStorage.getItem('hoops_sim_league_data')
    if (!saved) return false
    try {
      const data = JSON.parse(saved)
      if (data.schemaVersion !== NBA_RULES.SCHEMA_VERSION) return false
      if (!Array.isArray(data.teams) || data.teams.length === 0 || !data.userTeamId) return false
      this.teams = data.teams
      this.schedule = data.schedule
      this.currentRound = data.currentRound
      this.totalRounds = data.totalRounds
      this.season = data.season
      this.phase = data.phase
      this.offseasonStep = data.offseasonStep
      this.seasonComplete = data.seasonComplete
      this.userTeamId = data.userTeamId
      this.freeAgents = data.freeAgents
      this.draftProspects = data.draftProspects
      this.scoutingTokens = data.scoutingTokens
      this.draftOrder = data.draftOrder
      this.draftIndex = data.draftIndex
      this.news = data.news
      this.wire = Array.isArray(data.wire) ? data.wire : []
      this.allStarRound = data.allStarRound ?? 40
      this.allStarDate = data.allStarDate ?? ''
      this.allStarDone = data.allStarDone ?? false
      this.allStar = data.allStar ?? { announced: false, eastIds: [], westIds: [] }
      this.cupResolved = data.cupResolved ?? false
      this.cupChampionId = data.cupChampionId ?? null
      this.awards = data.awards ?? null
      this.playoffSeries = data.playoffSeries ?? []
      this.championId = data.championId ?? null
      this.injuryDate = data.injuryDate ?? ''
      const refreshBadges = (player: Player) => {
        if (!player.attributes || !player.personality) return
        player.traits = deriveTraits(player.attributes, player.position, player.personality)
      }
      this.teams.forEach((team, index) => {
        ensureCommercials(team, index)
        ensureCoach(team, index)
        if (!team.finances.books) team.finances.books = []
        if (!team.trim) team.trim = DEFAULT_TRIM
      })
      for (const team of this.teams) for (const player of team.roster) refreshBadges(player)
      for (const player of this.freeAgents) refreshBadges(player)
      return true
    } catch (error) {
      console.error('Error loading league data from localStorage:', error)
      return false
    }
  }

  clearLocalStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('hoops_sim_league_data')
    }
  }

  initializeLeague(teamId?: string, coach?: HiredCoach): void {
    const names = new Set<string>()
    this.teams = TEAM_TEMPLATES.map((template, index) => this.buildTeam(template, index, names))
    this.userTeamId = this.teams.find(team => team.id === teamId)?.id ?? this.teams[0].id
    if (coach?.name.trim()) {
      const hired = this.userTeam()
      const rolled = rollCoach(coach.name.trim(), coach.style, 0)
      const pedigree = coach.pedigree ?? rolled.pedigree
      const preset = PEDIGREE_PRESETS[pedigree]
      const locked = !!coach.pedigree
      hired.coach = {
        ...rolled,
        name: coach.name.trim(),
        style: locked ? preset.style : coach.style,
        age: coach.age ?? rolled.age,
        origin: coach.origin?.trim() || rolled.origin,
        formerPlayer: locked ? preset.formerPlayer : (coach.formerPlayer ?? rolled.formerPlayer),
        offense: locked ? preset.offense : (coach.offenseSkill ?? rolled.offense),
        defense: locked ? preset.defense : (coach.defenseSkill ?? rolled.defense),
        teaching: locked ? preset.teaching : (coach.teaching ?? rolled.teaching),
        manManagement: locked ? preset.manManagement : (coach.manManagement ?? rolled.manManagement),
        pedigree,
        signatures: clampSignatures(coach.signatures),
        respect: preset.respect
      }
      hired.tactics = {
        ...hired.tactics,
        tempo: coach.tempo,
        offensiveStyle: coach.offense,
        defensiveCoverage: coach.coverage
      }
    }
    this.generateSchedule()
    this.generateFreeAgents(names)
    this.generateDraftProspects(names)
    this.scoutingTokens = NBA_RULES.SCOUTING_TOKENS
    this.phase = 'regular'
    this.offseasonStep = null
    this.seasonComplete = false
    this.currentRound = 1
    this.season = 2026
    this.draftOrder = []
    this.draftIndex = 0
    this.news = []
    this.wire = []
    const user = this.userTeam()
    this.note(
      'Owner',
      `${user.owner.goalWins} wins`,
      `${user.owner.name} wants ${user.owner.goalWins} wins. Patience starts at ${user.owner.patience}. Cash is separate from the cap. ${user.coach.name} (${user.coach.style}) runs the bench.`
    )
    const opened = `Season ${this.season}`
    this.publish({
      handle: 'laneandcourt',
      name: 'Lane & Court',
      role: 'show',
      body: `${user.city} hired ${user.coach.name}. ${user.owner.name} still wants ${user.owner.goalWins} wins.`,
      date: opened
    })
    this.publish({
      handle: 'section114',
      name: 'Section 114',
      role: 'fan',
      body: `New coach, same building. Let's see if ${user.coach.name} can get us to ${user.owner.goalWins}.`,
      date: opened
    })
    this.saveToLocalStorage()
  }

  private qualityFor(index: number): TeamQuality {
    return outlookFor(index)
  }

  private buildTeam(
    template: (typeof TEAM_TEMPLATES)[number],
    index: number,
    names: Set<string>
  ): Team {
    const quality = this.qualityFor(index)
    const starPosition = POSITIONS[index % POSITIONS.length]
    const roster: Player[] = []

    for (const position of POSITIONS) {
      for (let depth = 0; depth < 3; depth++) {
        const franchise = position === starPosition && depth === 0
        const target = this.targetOverall(quality, depth, franchise)
        const age = this.targetAge(quality, franchise, depth)
        const years = franchise ? between(3, 4) : depth === 2 ? between(1, 2) : between(2, 4)
        roster.push(createPlayer({
          position,
          targetOverall: target,
          age,
          years,
          usedNames: names
        }))
      }
    }

    const ratio = quality === 'contender'
      ? 1.16 + Math.random() * 0.06
      : quality === 'rebuild'
        ? 0.86 + Math.random() * 0.06
        : 1.03 + Math.random() * 0.05
    CBASimulator.scaleContracts(roster, Math.round(NBA_RULES.SALARY_CAP * ratio))

    const team: Team = {
      id: 'team_' + (index + 1),
      name: template.name,
      city: template.city,
      conference: template.conference,
      division: template.division,
      color: template.color,
      trim: DEFAULT_TRIM,
      coach: rollCoach(template.coach, COACH_STYLES[index % COACH_STYLES.length], index),
      owner: {
        name: template.owner,
        goalWins: GOAL_WINS[quality],
        patience: 70
      },
      roster,
      depthChart: { PG: [], SG: [], SF: [], PF: [], C: [] },
      tactics: this.defaultTactics(roster, index),
      finances: {
        salaryCap: NBA_RULES.SALARY_CAP,
        salariesTotal: 0,
        luxuryTaxApron1: NBA_RULES.FIRST_APRON,
        luxuryTaxApron2: NBA_RULES.SECOND_APRON,
        deadCap: 0,
        hardCap: null,
        exceptions: CBASimulator.freshExceptions(),
        cash: 40_000_000,
        seasonRevenue: 0,
        seasonExpenses: 0
      },
      wins: 0,
      losses: 0,
      pointDiff: 0,
      cupWins: 0,
      cupLosses: 0,
      history: []
    }
    rebuildDepthChart(team)
    CBASimulator.updateTeamFinances(team)
    ensureCommercials(team, index)
    return team
  }

  private targetOverall(quality: TeamQuality, depth: number, franchise: boolean): number {
    if (franchise) {
      if (quality === 'contender') return between(97, 99)
      if (quality === 'rebuild') return between(74, 80)
      return between(86, 90)
    }
    if (depth === 0) {
      if (quality === 'contender') return between(78, 83)
      if (quality === 'rebuild') return between(70, 75)
      return between(76, 81)
    }
    if (depth === 1) return quality === 'rebuild' ? between(64, 69) : between(70, 75)
    return quality === 'rebuild' ? between(58, 63) : between(62, 68)
  }

  private targetAge(quality: TeamQuality, franchise: boolean, depth: number): number {
    if (franchise) {
      if (quality === 'rebuild') return between(20, 23)
      if (quality === 'contender') return between(27, 32)
      return between(24, 29)
    }
    if (quality === 'rebuild') return between(20, 26)
    if (depth === 2) return between(23, 34)
    return between(23, 30)
  }

  private defaultTactics(roster: Player[], index: number): TeamTactics {
    const styles: TeamTactics['offensiveStyle'][] = ['pace-and-space', 'pick-and-roll', 'motion', 'post-up', 'isolation']
    const tactics: TeamTactics = {
      tempo: 'balanced',
      offensiveStyle: styles[index % styles.length],
      offensiveRoles: {},
      defensiveCoverage: 'drop',
      doubleTeamTrigger: 'late-clock',
      targetOverplay: {}
    }
    const star = [...roster].sort((a, b) => b.overallRating - a.overallRating)[0]
    const big = roster.find(player => player.position === 'C') ?? roster[0]
    const shooter = [...roster].sort((a, b) => b.attributes.technical.threePoint - a.attributes.technical.threePoint)[0]
    tactics.offensiveRoles[star.id] = 'initiator'
    tactics.offensiveRoles[big.id] = 'screen-setter'
    if (shooter.id !== star.id) tactics.offensiveRoles[shooter.id] = 'spot-up'
    return tactics
  }

  private generateFreeAgents(names: Set<string>): void {
    this.freeAgents = []
    const plan: { overall: [number, number]; age: [number, number]; count: number }[] = [
      { overall: [76, 82], age: [25, 31], count: 4 },
      { overall: [70, 76], age: [24, 32], count: 10 },
      { overall: [62, 69], age: [23, 35], count: 14 }
    ]
    let positionIndex = 0
    for (const group of plan) {
      for (let i = 0; i < group.count; i++) {
        const position = POSITIONS[positionIndex % POSITIONS.length]
        positionIndex++
        const player = createPlayer({
          position,
          targetOverall: between(group.overall[0], group.overall[1]),
          age: between(group.age[0], group.age[1]),
          years: 1,
          usedNames: names
        })
        player.contract.yearsServed = 0
        player.contract.birdRights = 'none'
        player.contract.option = 'none'
        player.contract.salaries = player.contract.salaries.slice(0, 1)
        this.freeAgents.push(player)
      }
    }
  }

  private generateDraftProspects(names: Set<string>): void {
    const plan: { overall: [number, number]; count: number }[] = [
      { overall: [80, 86], count: 2 },
      { overall: [74, 78], count: 3 },
      { overall: [70, 73], count: 10 },
      { overall: [64, 69], count: 20 },
      { overall: [58, 63], count: 25 }
    ]
    this.draftProspects = []
    let positionIndex = 0
    for (const group of plan) {
      for (let i = 0; i < group.count; i++) {
        const position = POSITIONS[positionIndex % POSITIONS.length]
        positionIndex++
        this.draftProspects.push(createProspect(
          position,
          between(group.overall[0], group.overall[1]),
          names
        ))
      }
    }
  }

  scoutProspect(prospectId: string): boolean {
    if (this.scoutingTokens <= 0) return false
    const prospect = this.draftProspects.find(item => item.id === prospectId)
    if (!prospect || prospect.scouted) return false
    prospect.scouted = true
    this.scoutingTokens--
    this.saveToLocalStorage()
    return true
  }

  private generateSchedule(): void {
    const slots: ScheduleTeam[] = []
    for (const division of DIVISIONS) {
      this.teams.filter(team => team.division === division).forEach((team, slot) => {
        slots.push({ id: team.id, conference: team.conference, division: team.division, slot })
      })
    }
    const built = buildSeason(slots, this.season)
    this.schedule = built.matches.map(match => ({ ...match, simulated: false }))
    this.totalRounds = built.rounds
    this.allStarRound = built.allStarRound
    this.allStarDate = built.allStarDate
    this.allStarDone = false
    this.allStar = { announced: false, eastIds: [], westIds: [] }
    this.cupResolved = false
    this.cupChampionId = null
    this.awards = null
    this.playoffSeries = []
    this.championId = null
  }

  userCupGame(): ScheduledMatch | null {
    return this.schedule.find(match =>
      match.cupKnockout && !match.simulated && (match.homeTeamId === this.userTeamId || match.awayTeamId === this.userTeamId)
    ) ?? null
  }

  continueCup(): void {
    this.maybeCup()
    this.saveToLocalStorage()
  }

  simUserCup(): void {
    const game = this.userCupGame()
    if (!game) return
    this.simKnockout(game)
    this.maybeCup()
    this.saveToLocalStorage()
  }

  setCoach(coach: HiredCoach): void {
    const team = this.userTeam()
    const rolled = rollCoach(coach.name.trim() || team.coach.name, coach.style, 0)
    const pedigree = coach.pedigree ?? team.coach.pedigree ?? pedigreeForStyle(coach.style)
    const preset = PEDIGREE_PRESETS[pedigree]
    const signatures = clampSignatures(coach.signatures ?? team.coach.signatures)
    team.coach = {
      ...rolled,
      name: coach.name.trim() || team.coach.name,
      style: preset.style,
      age: coach.age ?? team.coach.age ?? rolled.age,
      origin: coach.origin?.trim() || team.coach.origin || rolled.origin,
      formerPlayer: preset.formerPlayer,
      offense: preset.offense,
      defense: preset.defense,
      teaching: preset.teaching,
      manManagement: preset.manManagement,
      pedigree,
      signatures,
      respect: preset.respect
    }
    const { tempo, offense, coverage } = coach
    const marks = signatures.map(id => SIGNATURE_PRESETS.find(item => item.id === id)?.label).filter((label): label is string => !!label)
    this.note('Front Office', 'Coach updated', `${team.coach.name} (${PEDIGREE_PRESETS[pedigree].label}) is the head coach. Style: ${preset.style}.${marks.length ? ` ${marks.join(', ')}.` : ''}`)
    this.saveToLocalStorage()
  }

  setTvDeal(tier: MarketDeal): OfferVerdict {
    const team = this.userTeam()
    const current = team.finances.tvDeal ?? 'partner'
    if (current === tier) return deny('That deal is already signed.')
    const cost = tvUpgradeCost(current, tier)
    if (team.finances.cash < cost) {
      return deny(`The buyout is $${(cost / 1_000_000).toFixed(0)}M. You have $${(team.finances.cash / 1_000_000).toFixed(1)}M.`)
    }
    if (cost > 0) postCash(team, 'buyout', -cost, team.finances.lastBookMonth ?? 'preseason')
    team.finances.tvDeal = tier
    const check = tvCheck(team)
    this.note(
      'Front Office',
      cost > 0 ? 'TV deal bought up' : 'TV deal dropped',
      `${current} is now ${tier}. Each game pays $${(check / 1_000_000).toFixed(1)}M.${cost > 0 ? ` The buyout was $${(cost / 1_000_000).toFixed(0)}M, and it does not come back if you drop the tier.` : ' Dropping a tier does not refund the buyout.'}`
    )
    this.saveToLocalStorage()
    return { allowed: true, exceptionUsed: 'TV', reason: `The ${tier} deal is signed.`, consumes: null, setsHardCap: null }
  }

  setJersey(color: string, trim: string): OfferVerdict {
    const team = this.userTeam()
    if (!HEX_COLOR.test(color) || !HEX_COLOR.test(trim)) return deny('Pick a home color and a trim.')
    if (team.color.toLowerCase() === color.toLowerCase() && (team.trim ?? DEFAULT_TRIM).toLowerCase() === trim.toLowerCase()) {
      return deny('Those are already the home colors.')
    }
    const cost = NBA_RULES.JERSEY_ORDER
    if (team.finances.cash < cost) {
      return deny(`The uniform order is $${(cost / 1_000_000).toFixed(0)}M. You have $${(team.finances.cash / 1_000_000).toFixed(1)}M.`)
    }
    postCash(team, 'jersey', -cost, team.finances.lastBookMonth ?? 'preseason')
    team.color = color
    team.trim = trim
    this.note('Front Office', 'New uniforms', `Home is ${color} with ${trim} trim. The order was $${(cost / 1_000_000).toFixed(0)}M, and it does not hit the cap.`)
    this.publish({
      handle: team.name.toLowerCase().replace(/[^a-z]/g, ''),
      name: `${team.city} ${team.name}`,
      role: 'team',
      body: `New home uniforms. ${team.city} wears them next game.`,
      date: `Season ${this.season}`
    })
    this.saveToLocalStorage()
    return { allowed: true, exceptionUsed: 'Jersey', reason: 'The uniform order is in.', consumes: null, setsHardCap: null }
  }

  setHomeCity(city: string): OfferVerdict {
    const team = this.userTeam()
    const next = city.trim()
    if (next === team.city) return deny('You already play there.')
    if (!OPEN_MARKETS.includes(next)) return deny('That city is not an open market.')
    if (this.teams.some(other => other.id !== team.id && other.city === next)) return deny('Another club already plays there.')
    const cost = NBA_RULES.RELOCATION_FEE
    if (team.finances.cash < cost) {
      return deny(`The move costs $${(cost / 1_000_000).toFixed(0)}M. You have $${(team.finances.cash / 1_000_000).toFixed(1)}M.`)
    }
    const from = team.city
    postCash(team, 'move', -cost, team.finances.lastBookMonth ?? 'preseason')
    team.city = next
    this.note(
      'Owner',
      `Moving to ${next}`,
      `${team.owner.name} approved the move from ${from}. The ${team.division} does not change. The fee was $${(cost / 1_000_000).toFixed(0)}M, and it does not hit the cap.`
    )
    const date = `Season ${this.season}`
    this.publish({
      handle: 'section114',
      name: 'Section 114',
      role: 'fan',
      body: `They are leaving ${from}. I bought these seats.`,
      date
    })
    this.publish({
      handle: next.toLowerCase().replace(/[^a-z]/g, '') + 'desk',
      name: `${next} Desk`,
      role: 'journalist',
      body: `${team.name} are moving from ${from} to ${next}. They stay in the ${team.division}.`,
      date
    })
    this.saveToLocalStorage()
    return { allowed: true, exceptionUsed: 'Move', reason: `${team.name} now play in ${next}.`, consumes: null, setsHardCap: null }
  }

  simulateRegularSeason(): { wins: number, losses: number } {
    let guard = 0
    while (this.phase === 'regular' && !this.seasonComplete && guard++ < 250) {
      const cup = this.userCupGame()
      if (cup) {
        this.simKnockout(cup)
        this.maybeCup()
        continue
      }
      const round = this.currentRound
      this.simulateRound(null, undefined, false)
      if (!this.seasonComplete && this.currentRound === round && !this.userCupGame()) break
    }
    this.saveToLocalStorage()
    const team = this.userTeam()
    return { wins: team.wins, losses: team.losses }
  }

  simulateRound(userTeamId: string | null = null, onUserGameDone?: (res: any) => void, save = true): void {
    if (this.phase !== 'regular' || this.seasonComplete) return
    if (userTeamId && this.userCupGame()) return

    const roundMatches = this.schedule.filter(match => match.round === this.currentRound && !match.simulated)
    this.healTo(roundMatches[0]?.date ?? '')
    roundMatches.forEach(match => {
      const home = this.teams.find(team => team.id === match.homeTeamId)!
      const away = this.teams.find(team => team.id === match.awayTeamId)!
      const result = this.matchEngine.simulateMatch(home, away)
      match.simulated = true
      match.scoreHome = result.teamAScore
      match.scoreAway = result.teamBScore
      match.winnerId = result.winnerId
      match.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1]?.log
      this.applyMatchResults(home, away, result, match.cup, match.date)
      this.bookGate(home, away, result.winnerId === home.id, match.cup, match.date, result.teamAScore, result.teamBScore)
      this.reactToGame(home, away, result.teamAScore, result.teamBScore, match.date)
      if (userTeamId && (home.id === userTeamId || away.id === userTeamId) && onUserGameDone) {
        onUserGameDone(result)
      }
    })

    this.maybeAllStar()
    this.maybeCup()
    if (this.currentRound >= this.totalRounds) {
      this.seasonComplete = true
      this.handAwards()
      this.openPlayoffs()
    } else this.currentRound++
    this.touchOwner()
    if (save) this.saveToLocalStorage()
  }

  bookWatchedGame(matchId: string, homeWon: boolean, minutes?: { home: Record<string, number>; away: Record<string, number> }) {
    const match = this.schedule.find(item => item.id === matchId)
    if (!match) return
    const home = this.teams.find(team => team.id === match.homeTeamId)
    const away = this.teams.find(team => team.id === match.awayTeamId)
    if (!home || !away) return
    this.healTo(match.date)
    if (minutes) {
      this.recordInjuries(home, player => minutes.home[player.id] ?? 0, match.date)
      this.recordInjuries(away, player => minutes.away[player.id] ?? 0, match.date)
    }
    this.bookGate(home, away, homeWon, match.cup, match.date, match.scoreHome ?? 0, match.scoreAway ?? 0)
    this.reactToGame(home, away, match.scoreHome ?? 0, match.scoreAway ?? 0, match.date)
    this.leakDemands(home, match.date)
    this.leakDemands(away, match.date)
  }

  private healTo(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    if (!this.injuryDate) {
      this.injuryDate = date
      return
    }
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${this.injuryDate}T00:00:00Z`)) / 86_400_000)
    if (days <= 0) return
    for (const team of this.teams) {
      for (const player of team.roster) healPlayer(player, days)
    }
    this.injuryDate = date
  }

  private recordInjuries(team: Team, minutesOf: (player: Player) => number, date: string) {
    for (const player of team.roster) {
      const hurt = hurtPlayer(player, minutesOf(player))
      if (!hurt || team.id !== this.userTeamId) continue
      const days = hurt.daysRemaining === 1 ? '1 day' : `${hurt.daysRemaining} days`
      this.publish({
        handle: 'laneandcourt',
        name: 'Lane & Court',
        role: 'show',
        body: `${player.name} is out with a ${hurt.description.toLowerCase()}. ${days}.`,
        date
      })
    }
  }

  private glueJoined(team: Team, player: Player) {
    if (!isGlue(player)) return
    for (const mate of team.roster) mate.morale = Math.min(100, mate.morale + 1)
    if (team.id !== this.userTeamId) return
    this.note('Locker room', `${player.name} fits`, `${player.name} is the kind of teammate who holds a room together.`)
  }

  private glueLeft(team: Team, player: Player) {
    if (!isGlue(player)) return
    for (const mate of team.roster) mate.morale = Math.max(0, mate.morale - 2)
    if (team.id !== this.userTeamId) return
    this.note('Locker room', `${player.name} is gone`, `${player.name} held the room together. Morale slipped.`)
  }

  private leakDemands(team: Team, date: string) {
    if (team.id !== this.userTeamId) return
    const leaks = team.roster.filter(player => player.tradeLeak)
    if (!leaks.length) return
    for (const player of leaks) player.tradeLeak = false
    const extra = leaks.length > 1 ? ` ${leaks.length - 1} other${leaks.length > 2 ? 's' : ''} too.` : ''
    this.publish({
      handle: leaks[0].name.toLowerCase().replace(/[^a-z]+/g, '') || 'player',
      name: leaks[0].name,
      role: 'player',
      body: `${leaks[0].name} is not getting the minutes he was promised. He wants out.${extra}`,
      date
    })
  }

  private settlePlayed(team: Team, minutesOf: (player: Player) => number, won: boolean, date: string) {
    settleTeamMorale(team.roster, minutesOf, won, team.coach, team)
    this.leakDemands(team, date)
  }

  private bookGate(home: Team, away: Team, homeWon: boolean, cup: boolean, date: string, homeScore: number, awayScore: number) {
    bookGameMoney(home, true, homeWon, date)
    bookGameMoney(away, false, !homeWon, date)
    if (Math.abs(homeScore - awayScore) >= 25) {
      levyFine(homeWon ? away : home, NBA_RULES.BLOWOUT_FINE, monthKey(date))
    }
    if (!cup) return
    if (homeWon) {
      home.cupWins++
      away.cupLosses++
    } else {
      away.cupWins++
      home.cupLosses++
    }
  }

  private touchOwner() {
    const team = this.userTeam()
    const played = team.wins + team.losses
    if (played === 0 || played % 8 !== 0) return
    const pace = Math.round((team.wins / played) * NBA_RULES.SEASON_GAMES)
    const gap = team.owner.goalWins - pace
    if (gap >= 8) team.owner.patience = Math.max(0, team.owner.patience - 4)
    else if (gap <= -4) team.owner.patience = Math.min(100, team.owner.patience + 2)
    if (team.owner.patience <= 30 && gap >= 8) {
      this.note('Owner', 'This is not the season I paid for', `${team.owner.name} wanted ${team.owner.goalWins} wins. The pace is ${pace}. Patience is ${team.owner.patience}.`)
    }
  }

  private maybeAllStar() {
    if (this.allStarDone || this.currentRound < this.allStarRound) return
    const eastIds = pickAllStars(this.teams, 'East')
    const westIds = pickAllStars(this.teams, 'West')
    this.allStar = { announced: true, eastIds, westIds }
    this.allStarDone = true
    for (const id of [...eastIds, ...westIds]) {
      const player = findPlayer(this.teams, id)
      if (player) player.morale = Math.min(100, player.morale + 4)
    }
    const yours = [...eastIds, ...westIds]
      .map(id => findPlayer(this.teams, id))
      .filter(player => player && this.userTeam().roster.some(rosterPlayer => rosterPlayer.id === player.id))
      .map(player => player!.name)
    this.note(
      'League office',
      'All-Star weekend',
      `The break is ${this.allStarDate}. Twelve from the East, twelve from the West.${yours.length ? ` From your team: ${yours.join(', ')}.` : ' Nobody from your roster made it.'}`
    )
  }

  private handAwards() {
    if (this.awards) return
    this.awards = pickAwards(this.teams)
    const nameOf = (id: string | null) => findPlayer(this.teams, id)?.name ?? 'Nobody'
    this.note(
      'League office',
      'Awards night',
      `MVP ${nameOf(this.awards.mvpId)}. Defensive player ${nameOf(this.awards.dpoyId)}. Rookie ${nameOf(this.awards.royId)}. Sixth man ${nameOf(this.awards.sixthId)}.${this.awards.mipId ? ` Most improved ${nameOf(this.awards.mipId)}.` : ''}`
    )
  }

  private cupRank(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
      const teamA = this.teams.find(team => team.id === a)!
      const teamB = this.teams.find(team => team.id === b)!
      if (teamA.cupWins !== teamB.cupWins) return teamB.cupWins - teamA.cupWins
      if (teamA.cupLosses !== teamB.cupLosses) return teamA.cupLosses - teamB.cupLosses
      return teamB.wins - teamA.wins
    })
  }

  private addCupGame(stage: 'quarter' | 'semi' | 'final', homeId: string, awayId: string) {
    this.schedule.push({
      id: `cup_${stage}_${homeId}_${awayId}`,
      round: 0,
      date: this.allStarDate,
      homeTeamId: homeId,
      awayTeamId: awayId,
      cup: true,
      cupKnockout: stage,
      exhibition: stage === 'final',
      simulated: false
    })
  }

  private seedCup(stage: 'quarter' | 'semi' | 'final') {
    if (stage === 'quarter') {
      for (const conference of ['East', 'West'] as const) {
        const clubs = this.teams.filter(team => team.conference === conference)
        const winners: string[] = []
        for (const division of DIVISIONS) {
          const ids = clubs.filter(team => team.division === division).map(team => team.id)
          if (ids.length) winners.push(this.cupRank(ids)[0])
        }
        const wildcard = this.cupRank(clubs.map(team => team.id).filter(id => !winners.includes(id)))[0]
        const seeds = this.cupRank([...winners, wildcard])
        this.addCupGame('quarter', seeds[0], seeds[3])
        this.addCupGame('quarter', seeds[1], seeds[2])
      }
      return
    }
    if (stage === 'semi') {
      for (const conference of ['East', 'West'] as const) {
        const winners = this.schedule
          .filter(match => match.cupKnockout === 'quarter' && match.winnerId)
          .map(match => match.winnerId!)
          .filter(id => this.teams.find(team => team.id === id)?.conference === conference)
        if (winners.length < 2) return
        const seeds = this.cupRank(winners)
        this.addCupGame('semi', seeds[0], seeds[1])
      }
      return
    }
    const winners = this.schedule.filter(match => match.cupKnockout === 'semi' && match.winnerId).map(match => match.winnerId!)
    if (winners.length < 2) return
    const seeds = this.cupRank(winners)
    this.addCupGame('final', seeds[0], seeds[1])
  }

  private simKnockout(match: ScheduledMatch) {
    const home = this.teams.find(team => team.id === match.homeTeamId)
    const away = this.teams.find(team => team.id === match.awayTeamId)
    if (!home || !away) return
    const result = this.matchEngine.simulateMatch(home, away)
    match.simulated = true
    match.scoreHome = result.teamAScore
    match.scoreAway = result.teamBScore
    match.winnerId = result.winnerId
    match.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1]?.log
    this.healTo(match.date)
    const minutes = (side: 'A' | 'B') => (player: Player) => (side === 'A' ? result.playerStatsA : result.playerStatsB)[player.id]?.minutes ?? 0
    this.recordInjuries(home, minutes('A'), match.date)
    this.recordInjuries(away, minutes('B'), match.date)
    if (match.exhibition) {
      this.settlePlayed(home, minutes('A'), result.winnerId === home.id, match.date)
      this.settlePlayed(away, minutes('B'), result.winnerId === away.id, match.date)
      return
    }
    this.bookGate(home, away, result.winnerId === home.id, true, match.date, result.teamAScore, result.teamBScore)
    this.reactToGame(home, away, result.teamAScore, result.teamBScore, match.date)
  }

  private maybeCup() {
    if (this.cupResolved) return
    const group = this.schedule.filter(match => match.cup && !match.cupKnockout)
    if (group.length === 0 || group.some(match => !match.simulated)) return
    if (!this.schedule.some(match => match.cupKnockout)) {
      this.seedCup('quarter')
      const yours = this.userCupGame()
      this.note(
        'League office',
        'Cup quarterfinals',
        yours
          ? `Group games are done. You are in. Elimination games pay the gate and do not change the regular-season record.`
          : 'Group games are done. Your team missed the elimination round.'
      )
    }
    const stages = ['quarter', 'semi', 'final'] as const
    for (const stage of stages) {
      const games = this.schedule.filter(match => match.cupKnockout === stage)
      if (games.length === 0) return
      for (const game of games) {
        if (game.simulated) continue
        if (game.homeTeamId === this.userTeamId || game.awayTeamId === this.userTeamId) return
        this.simKnockout(game)
      }
      if (games.some(game => !game.simulated)) return
      if (stage === 'final') {
        const final = games[0]
        this.cupChampionId = final?.winnerId ?? null
        this.cupResolved = true
        const winner = this.teams.find(team => team.id === this.cupChampionId)
        if (winner) {
          postCash(winner, 'cup', NBA_RULES.CUP_PURSE, winner.finances.lastBookMonth ?? 'cup')
          this.note('League office', 'Cup champion', `${winner.city} ${winner.name} won the Cup. $${(NBA_RULES.CUP_PURSE / 1_000_000).toFixed(0)}M goes to the team, not the cap.`)
        }
        return
      }
      const next = stage === 'quarter' ? 'semi' : 'final'
      if (!this.schedule.some(match => match.cupKnockout === next)) this.seedCup(next)
    }
  }

  private playoffGamesOpen(): ScheduledMatch[] {
    return this.schedule.filter(match => match.playoff && !match.simulated)
  }

  private playoffRoundNow(): PlayoffRoundName | null {
    if (this.playoffSeries.length === 0) return null
    return this.playoffSeries[this.playoffSeries.length - 1].round
  }

  private playoffSeed(teamId: string): number {
    for (const series of this.playoffSeries) {
      if (series.round !== 'first') continue
      if (series.highId === teamId) return series.highSeed
      if (series.lowId === teamId) return series.lowSeed
    }
    return NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE
  }

  private schedulePlayoffGame(series: PlayoffSeries) {
    const gameNumber = series.highWins + series.lowWins + 1
    if (series.winnerId || gameNumber > 7) return
    const highHosts = gameNumber === 1 || gameNumber === 2 || gameNumber === 5 || gameNumber === 7
    this.schedule.push({
      id: `${series.id}_g${gameNumber}`,
      round: 0,
      date: `Playoffs ${playoffRoundLabel(series.round)} Game ${gameNumber}`,
      homeTeamId: highHosts ? series.highId : series.lowId,
      awayTeamId: highHosts ? series.lowId : series.highId,
      cup: false,
      playoff: true,
      playoffSeriesId: series.id,
      simulated: false
    })
  }

  private addPlayoffSeries(
    round: PlayoffRoundName,
    conference: Conference | 'Finals',
    high: Team,
    low: Team,
    highSeed: number,
    lowSeed: number
  ) {
    const series: PlayoffSeries = {
      id: `po_${round}_${high.id}_${low.id}`,
      round,
      conference,
      highId: high.id,
      lowId: low.id,
      highSeed,
      lowSeed,
      highWins: 0,
      lowWins: 0,
      winnerId: null,
      playedIds: []
    }
    this.playoffSeries.push(series)
    this.schedulePlayoffGame(series)
  }

  private higherSeed(a: Team, b: Team): [Team, Team] {
    return this.bestFirst(a, b) <= 0 ? [a, b] : [b, a]
  }

  private seedPlayoffRound(round: PlayoffRoundName) {
    if (round === 'first') {
      for (const conference of ['East', 'West'] as const) {
        const table = this.teams.filter(team => team.conference === conference).sort((a, b) => this.bestFirst(a, b)).slice(0, NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE)
        const pairs: [number, number][] = [[0, 7], [3, 4], [1, 6], [2, 5]]
        for (const [highIndex, lowIndex] of pairs) {
          this.addPlayoffSeries(round, conference, table[highIndex], table[lowIndex], highIndex + 1, lowIndex + 1)
        }
      }
      const mine = this.playoffSeries.find(series => series.highId === this.userTeamId || series.lowId === this.userTeamId)
      const user = this.userTeam()
      if (mine) {
        const seed = mine.highId === user.id ? mine.highSeed : mine.lowSeed
        this.note('League office', 'Playoffs', `You are the ${seed} seed in the ${user.conference}. Best of seven. The higher seed hosts games 1, 2, 5, and 7.`)
      } else {
        this.note('League office', 'Playoffs', 'The top 8 in each conference are in. Your team is out. The bracket still has to finish before the draft.')
      }
      return
    }

    if (round === 'final') {
      const east = this.playoffSeries.find(series => series.round === 'conf' && series.conference === 'East')
      const west = this.playoffSeries.find(series => series.round === 'conf' && series.conference === 'West')
      const eastTeam = this.teams.find(team => team.id === east?.winnerId)
      const westTeam = this.teams.find(team => team.id === west?.winnerId)
      if (!eastTeam || !westTeam) return
      const [high, low] = this.higherSeed(eastTeam, westTeam)
      this.addPlayoffSeries('final', 'Finals', high, low, this.playoffSeed(high.id), this.playoffSeed(low.id))
      this.note('League office', 'Finals', `${high.city} ${high.name} have home court against ${low.city} ${low.name}.`)
      return
    }

    const previous = round === 'semi' ? 'first' : 'semi'
    for (const conference of ['East', 'West'] as const) {
      const done = this.playoffSeries.filter(series => series.round === previous && series.conference === conference)
      for (let index = 0; index < done.length; index += 2) {
        const first = this.teams.find(team => team.id === done[index]?.winnerId)
        const second = this.teams.find(team => team.id === done[index + 1]?.winnerId)
        if (!first || !second) return
        const [high, low] = this.higherSeed(first, second)
        this.addPlayoffSeries(round, conference, high, low, this.playoffSeed(high.id), this.playoffSeed(low.id))
      }
    }
  }

  private crownChampion() {
    const winner = this.teams.find(team => team.id === this.championId)
    if (!winner) return
    const userIn = this.playoffSeries.some(series => series.highId === this.userTeamId || series.lowId === this.userTeamId)
    if (winner.id === this.userTeamId) {
      this.note('League office', 'Champions', `${winner.city} ${winner.name} won the championship.`)
      return
    }
    this.note(
      'League office',
      'Champions',
      `${winner.city} ${winner.name} won the championship. ${userIn ? 'Your season ended earlier in the bracket.' : 'You did not make the playoffs.'}`
    )
  }

  private queuePlayoffGames() {
    if (this.championId) return
    if (this.playoffGamesOpen().length > 0) return
    if (this.playoffSeries.length === 0) {
      this.seedPlayoffRound('first')
      return
    }
    const round = this.playoffRoundNow()
    if (!round) return
    const live = this.playoffSeries.filter(series => series.round === round && !series.winnerId)
    if (live.length > 0) {
      for (const series of live) this.schedulePlayoffGame(series)
      return
    }
    if (round === 'final') {
      this.championId = this.playoffSeries.find(series => series.round === 'final')?.winnerId ?? null
      this.crownChampion()
      return
    }
    const next: PlayoffRoundName = round === 'first' ? 'semi' : round === 'semi' ? 'conf' : 'final'
    this.seedPlayoffRound(next)
  }

  private recordSeriesGame(match: ScheduledMatch) {
    const series = this.playoffSeries.find(item => item.id === match.playoffSeriesId)
    if (!series || !match.winnerId || series.playedIds.includes(match.id)) return
    series.playedIds.push(match.id)
    if (match.winnerId === series.highId) series.highWins++
    else series.lowWins++
    if (series.highWins >= NBA_RULES.PLAYOFF_WINS_TO_ADVANCE) series.winnerId = series.highId
    else if (series.lowWins >= NBA_RULES.PLAYOFF_WINS_TO_ADVANCE) series.winnerId = series.lowId
    if (!series.winnerId) return
    if (series.highId !== this.userTeamId && series.lowId !== this.userTeamId) return
    const userWins = series.highId === this.userTeamId ? series.highWins : series.lowWins
    const oppWins = series.highId === this.userTeamId ? series.lowWins : series.highWins
    const won = series.winnerId === this.userTeamId
    this.note('League office', won ? 'Series win' : 'Season over', won ? `You won the series ${userWins}-${oppWins}.` : `You lost the series ${userWins}-${oppWins}.`)
  }

  private simPlayoffGame(match: ScheduledMatch) {
    if (match.simulated) return
    const home = this.teams.find(team => team.id === match.homeTeamId)
    const away = this.teams.find(team => team.id === match.awayTeamId)
    if (!home || !away) return
    const result = this.matchEngine.simulateMatch(home, away)
    match.simulated = true
    match.scoreHome = result.teamAScore
    match.scoreAway = result.teamBScore
    match.winnerId = result.winnerId
    match.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1]?.log
    this.healTo(match.date)
    this.bookGate(home, away, result.winnerId === home.id, false, match.date, result.teamAScore, result.teamBScore)
    this.reactToGame(home, away, result.teamAScore, result.teamBScore, match.date)
    this.settlePlayed(home, player => result.playerStatsA[player.id]?.minutes ?? 0, result.winnerId === home.id, match.date)
    this.settlePlayed(away, player => result.playerStatsB[player.id]?.minutes ?? 0, result.winnerId === away.id, match.date)
    this.recordInjuries(home, player => result.playerStatsA[player.id]?.minutes ?? 0, match.date)
    this.recordInjuries(away, player => result.playerStatsB[player.id]?.minutes ?? 0, match.date)
    this.recordSeriesGame(match)
  }

  openPlayoffs(): void {
    if (!this.seasonComplete || this.championId || this.playoffSeries.length > 0) return
    this.queuePlayoffGames()
  }

  userPlayoffGame(): ScheduledMatch | null {
    return this.schedule.find(match =>
      match.playoff && !match.simulated && (match.homeTeamId === this.userTeamId || match.awayTeamId === this.userTeamId)
    ) ?? null
  }

  playoffNight(simUser = false): void {
    if (!this.seasonComplete || this.phase !== 'regular' || this.championId) return
    this.queuePlayoffGames()
    for (const game of this.playoffGamesOpen()) {
      if (!simUser && (game.homeTeamId === this.userTeamId || game.awayTeamId === this.userTeamId)) continue
      this.simPlayoffGame(game)
    }
    this.saveToLocalStorage()
  }

  finishWatchedPlayoff(matchId: string): void {
    const match = this.schedule.find(item => item.id === matchId)
    if (match?.playoff && match.winnerId) this.recordSeriesGame(match)
    for (const game of this.playoffGamesOpen()) {
      if (game.homeTeamId === this.userTeamId || game.awayTeamId === this.userTeamId) continue
      this.simPlayoffGame(game)
    }
    this.saveToLocalStorage()
  }

  simulatePlayoffs(): string | null {
    let guard = 0
    while (!this.championId && this.seasonComplete && guard++ < 40) {
      this.queuePlayoffGames()
      if (this.championId) break
      const open = this.playoffGamesOpen()
      if (open.length === 0) break
      for (const game of open) this.simPlayoffGame(game)
    }
    if (!this.championId) this.queuePlayoffGames()
    this.saveToLocalStorage()
    return this.championId
  }

  private applyMatchResults(home: Team, away: Team, res: any, _cup = false, date = ''): void {
    if (res.winnerId === home.id) {
      home.wins++
      away.losses++
    } else {
      away.wins++
      home.losses++
    }

    home.pointDiff += (res.teamAScore - res.teamBScore)
    away.pointDiff += (res.teamBScore - res.teamAScore)

    const updateStats = (team: Team, playerStats: Record<string, BoxScoreStats>) => {
      team.roster.forEach(player => {
        const stats = playerStats[player.id]
        if (!stats) return
        if (!player.careerStats['season']) {
          player.careerStats['season'] = {
            minutes: 0, points: 0, assists: 0, rebounds: 0, offRebounds: 0, defRebounds: 0,
            steals: 0, blocks: 0, turnovers: 0, fouls: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0,
            ftm: 0, fta: 0, plusMinus: 0, games: 0
          }
        }
        const season = player.careerStats['season']
        if (stats.minutes > 0) season.games = (season.games || 0) + 1
        season.minutes += stats.minutes
        season.points += stats.points
        season.assists += stats.assists
        season.rebounds += stats.rebounds
        season.offRebounds += stats.offRebounds
        season.defRebounds += stats.defRebounds
        season.steals += stats.steals
        season.blocks += stats.blocks
        season.turnovers += stats.turnovers
        season.fouls += stats.fouls
        season.fgm += stats.fgm
        season.fga += stats.fga
        season.tpm += stats.tpm
        season.tpa += stats.tpa
        season.ftm += stats.ftm
        season.fta += stats.fta
        season.plusMinus += stats.plusMinus
      })
    }

    updateStats(home, res.playerStatsA)
    updateStats(away, res.playerStatsB)
    const night = date || `Season ${this.season}`
    this.settlePlayed(home, player => res.playerStatsA[player.id]?.minutes ?? 0, res.winnerId === home.id, night)
    this.settlePlayed(away, player => res.playerStatsB[player.id]?.minutes ?? 0, res.winnerId === away.id, night)
    this.recordInjuries(home, player => res.playerStatsA[player.id]?.minutes ?? 0, night)
    this.recordInjuries(away, player => res.playerStatsB[player.id]?.minutes ?? 0, night)
  }

  enterOffseason(): OfferVerdict {
    if (this.phase !== 'regular' || !this.seasonComplete) {
      return deny('The season is still going. Offseason starts after the last game.')
    }
    if (this.playoffSeries.length > 0 && !this.championId) {
      return deny('The playoffs are still going. Crown a champion before the offseason.')
    }

    if (!this.awards) this.handAwards()

    const user = this.userTeam()
    let userTax = 0
    for (const team of this.teams) {
      const tax = luxuryTaxBill(team)
      if (tax > 0) {
        postCash(team, 'tax', -tax, team.finances.lastBookMonth ?? 'offseason')
        if (team.id === user.id) userTax = tax
      }
      const met = team.wins >= team.owner.goalWins
      team.owner.patience = Math.max(0, Math.min(100, team.owner.patience + (met ? 8 : -15)))
    }
    for (const team of this.teams) {
      const annual = team.finances.sponsor?.annual ?? 0
      if (annual <= 0) continue
      postCash(team, 'sponsor', annual, 'offseason')
    }
    const sponsor = user.finances.sponsor
    if (sponsor) {
      this.note('Front Office', `${sponsor.name} paid`, `${sponsor.name} sent $${(sponsor.annual / 1_000_000).toFixed(0)}M. That is cash, not cap room. The TV deal stays ${user.finances.tvDeal}.`)
    }
    const metGoal = user.wins >= user.owner.goalWins
    const taxLine = userTax > 0 ? ` Luxury tax is $${(userTax / 1_000_000).toFixed(1)}M.` : ''
    const risk = user.owner.patience < 25 ? ' The job is at risk.' : ''
    this.note(
      'Owner',
      metGoal ? `${user.owner.name} is pleased` : `${user.owner.name} wanted more`,
      `The goal was ${user.owner.goalWins} wins. You finished ${user.wins}-${user.losses}. Patience is ${user.owner.patience}.${taxLine}${risk}`
    )

    for (const team of this.teams) {
      team.finances.deadCap = 0
      team.finances.hardCap = null
      team.finances.exceptions = CBASimulator.freshExceptions()
    }

    const movers: { name: string; delta: number }[] = []
    const ageGroup = (player: Player) => {
      player.age++
      player.experience = (player.experience ?? 0) + 1
      const delta = developPlayer(player)
      if (delta !== 0) movers.push({ name: player.name, delta })
    }
    for (const team of this.teams) for (const player of team.roster) ageGroup(player)
    for (const player of this.freeAgents) ageGroup(player)
    for (const prospect of this.draftProspects) prospect.age++

    let expired = 0
    for (const team of this.teams) {
      const staying: Player[] = []
      const contender = team.wins > team.losses
      for (const player of team.roster) {
        const decision = this.resolveContract(player, contender)
        if (decision === 'stay') staying.push(player)
        else {
          expired++
          this.toFreeAgent(player)
        }
      }
      team.roster = staying
      rebuildDepthChart(team)
      CBASimulator.updateTeamFinances(team)
    }

    const risers = movers.filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3)
    const fallers = movers.filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)
    this.note(
      'Front Office',
      `${this.season} is over`,
      `${expired} contracts came off the books. ${risers.length ? `Biggest jumps: ${risers.map(item => `${item.name} (${item.delta > 0 ? '+' : ''}${item.delta})`).join(', ')}.` : ''} ${fallers.length ? `Decline: ${fallers.map(item => `${item.name} (${item.delta})`).join(', ')}.` : ''} Draft order is set. Your pick comes up when you are on the clock.`
    )

    this.phase = 'offseason'
    this.offseasonStep = 'draft'
    this.buildDraftOrder()
    this.simDraftUntilUserOrEnd()
    this.saveToLocalStorage()
    return { allowed: true, exceptionUsed: 'Offseason', reason: 'Offseason is open.', consumes: null, setsHardCap: null }
  }

  private resolveContract(player: Player, contender: boolean): 'stay' | 'leave' {
    const upcoming = player.contract.salaries.slice(1)
    if (upcoming.length === 0) return 'leave'

    const optionYear = upcoming.length === 1 && player.contract.option !== 'none'
    if (optionYear) {
      const demand = CBASimulator.getPlayerSalaryDemand(player, { isContender: contender })
      const salary = upcoming[0]
      if (player.contract.option === 'team' && salary > demand * 1.15) return 'leave'
      if (player.contract.option === 'player' && salary < demand * 0.9) return 'leave'
      if (player.contract.option === 'non-guaranteed' && salary > demand) return 'leave'
      player.contract.option = 'none'
    }

    player.contract.salaries = upcoming
    player.contract.yearsServed += 1
    player.contract.birdRights = birdFromYears(player.contract.yearsServed)
    return 'stay'
  }

  private toFreeAgent(player: Player) {
    player.contract.salaries = [NBA_RULES.MINIMUM_SALARY]
    player.contract.option = 'none'
    player.contract.yearsServed = 0
    player.contract.birdRights = 'none'
    this.freeAgents.push(player)
  }

  private bestFirst(a: Team, b: Team): number {
    const gamesA = a.wins + a.losses
    const gamesB = b.wins + b.losses
    const pctA = gamesA === 0 ? 0 : a.wins / gamesA
    const pctB = gamesB === 0 ? 0 : b.wins / gamesB
    if (pctA !== pctB) return pctB - pctA
    if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff
    return a.city.localeCompare(b.city)
  }

  private buildDraftOrder() {
    const missed: Team[] = []
    const made: Team[] = []
    for (const conference of ['East', 'West'] as const) {
      const table = this.teams.filter(team => team.conference === conference).sort((a, b) => this.bestFirst(a, b))
      made.push(...table.slice(0, NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE))
      missed.push(...table.slice(NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE))
    }
    const worstFirst = (a: Team, b: Team) => this.bestFirst(b, a)
    missed.sort(worstFirst)
    made.sort(worstFirst)

    const weights = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 14, 8, 5]
    const weightTotal = missed.reduce((sum, _team, index) => sum + (weights[index] ?? 0), 0)
    let ticket = Math.random() * weightTotal
    let winner = missed[0]
    for (let i = 0; i < missed.length; i++) {
      ticket -= weights[i] ?? 0
      if (ticket <= 0) {
        winner = missed[i]
        break
      }
    }
    const order = [winner, ...missed.filter(team => team.id !== winner.id), ...made]
    this.draftOrder = []
    for (let round = 1; round <= NBA_RULES.DRAFT_ROUNDS; round++) {
      order.forEach((team, index) => {
        this.draftOrder.push({
          round,
          pick: (round - 1) * order.length + index + 1,
          teamId: team.id
        })
      })
    }
    this.draftIndex = 0
  }

  private thinnestPosition(team: Team): Position {
    return [...POSITIONS].sort((a, b) => {
      const countA = team.roster.filter(player => player.position === a).length
      const countB = team.roster.filter(player => player.position === b).length
      return countA - countB
    })[0]
  }

  private chooseAiProspect(team: Team): DraftProspect {
    return [...this.draftProspects].sort((a, b) => this.prospectValue(team, b) - this.prospectValue(team, a))[0]
  }

  private prospectValue(team: Team, prospect: DraftProspect): number {
    const count = team.roster.filter(player => player.position === prospect.position).length
    const need = count < 2 ? 8 : 0
    return prospect.potentialRating * 1.15 + prospect.overallRating + need
  }

  private completeDraftPick(prospectId: string, team: Team): OfferVerdict {
    const pick = this.draftOrder[this.draftIndex]
    if (!pick || pick.teamId !== team.id) return deny('That team is not on the clock.')
    if (team.roster.length >= NBA_RULES.OFFSEASON_ROSTER_MAX) {
      return deny(`Offseason rosters cap at ${NBA_RULES.OFFSEASON_ROSTER_MAX}. Waive someone before this pick.`)
    }
    const index = this.draftProspects.findIndex(prospect => prospect.id === prospectId)
    if (index === -1) return deny('That prospect is already off the board.')

    const prospect = this.draftProspects[index]
    const player = playerFromProspect(prospect, pick.pick)
    team.roster.push(player)
    addToDepthChart(team, player)
    CBASimulator.updateTeamFinances(team)
    pick.prospectId = prospect.id
    pick.playerName = player.name
    this.draftProspects.splice(index, 1)
    this.draftIndex++
    return { allowed: true, exceptionUsed: 'Rookie Scale', reason: `${team.city} drafted ${player.name}.`, consumes: null, setsHardCap: null }
  }

  private simDraftUntilUserOrEnd() {
    while (this.draftIndex < this.draftOrder.length) {
      const pick = this.draftOrder[this.draftIndex]
      if (pick.teamId === this.userTeamId) return
      const team = this.teams.find(item => item.id === pick.teamId)
      if (!team || this.draftProspects.length === 0) {
        this.draftIndex = this.draftOrder.length
        break
      }
      const prospect = this.chooseAiProspect(team)
      const result = this.completeDraftPick(prospect.id, team)
      if (!result.allowed) break
    }
    if (this.draftIndex >= this.draftOrder.length) this.finishDraft()
  }

  draftProspect(prospectId: string): OfferVerdict {
    if (this.phase !== 'offseason' || this.offseasonStep !== 'draft') {
      return deny('College players are drafted after the season, not signed whenever you want.')
    }
    const pick = this.currentPick()
    if (!pick || pick.teamId !== this.userTeamId) {
      return deny('Wait until your team is on the clock.')
    }
    const result = this.completeDraftPick(prospectId, this.userTeam())
    if (!result.allowed) return result
    this.simDraftUntilUserOrEnd()
    this.saveToLocalStorage()
    return result
  }

  private finishDraft() {
    const names = this.takenNames()
    for (const prospect of this.draftProspects) {
      const player = playerFromProspect(prospect, null)
      if (names.has(player.name)) player.name = player.name + ' Jr'
      this.freeAgents.push(player)
    }
    this.draftProspects = []
    this.offseasonStep = 'free-agency'
    this.aiBalanceRosters()
    this.note(
      'League Office',
      'Draft is complete',
      'Undrafted rookies are in the free agent pool. Cut to 15 and fill out to at least 14 before opening day. Cap room, the mid-level, and the bi-annual are all live.'
    )
  }

  private aiBalanceRosters() {
    for (const team of this.teams) {
      if (team.id === this.userTeamId) continue
      while (team.roster.length > NBA_RULES.ROSTER_MAX) {
        const veterans = team.roster.filter(player => player.age > 23 || player.contract.yearsServed > 0)
        const pool = veterans.length > 0 ? veterans : team.roster
        const worst = [...pool].sort((a, b) => a.overallRating - b.overallRating)[0]
        const result = waivePlayer(team, worst.id)
        if (!result.allowed) break
        this.toFreeAgent(worst)
        this.glueLeft(team, worst)
      }
      while (team.roster.length < NBA_RULES.ROSTER_MIN) this.signCampBody(team)
      CBASimulator.updateTeamFinances(team)
    }
  }

  private signCampBody(team: Team) {
    const player = createPlayer({
      position: this.thinnestPosition(team),
      targetOverall: 63,
      age: between(24, 29),
      years: 1,
      usedNames: this.takenNames()
    })
    player.contract.salaries = [NBA_RULES.MINIMUM_SALARY]
    player.contract.option = 'none'
    player.contract.yearsServed = 0
    player.contract.birdRights = 'none'
    team.roster.push(player)
    addToDepthChart(team, player)
    this.glueJoined(team, player)
  }

  signFreeAgent(playerId: string, salary: number, years: number): OfferVerdict {
    if (this.phase === 'offseason' && this.offseasonStep !== 'free-agency') {
      return deny('Free agency opens after the draft.')
    }
    const player = this.freeAgents.find(item => item.id === playerId)
    if (!player) return deny('That player is no longer a free agent.')
    const team = this.userTeam()
    const verdict = CBASimulator.evaluateFreeAgent(team, salary, years, this.phase)
    if (!verdict.allowed) return verdict

    player.contract.salaries = CBASimulator.generateContractSalaries(salary, years, false)
    player.contract.option = 'none'
    player.contract.yearsServed = 0
    player.contract.birdRights = 'none'
    team.roster.push(player)
    addToDepthChart(team, player)
    this.glueJoined(team, player)
    this.freeAgents = this.freeAgents.filter(item => item.id !== playerId)
    CBASimulator.commitSigning(team, verdict)
    this.note('Cap Desk', `${player.name} signed`, `${verdict.exceptionUsed}: ${verdict.reason}`)
    this.saveToLocalStorage()
    return verdict
  }

  waive(playerId: string): OfferVerdict {
    const team = this.userTeam()
    const player = team.roster.find(item => item.id === playerId)
    const verdict = waivePlayer(team, playerId)
    if (verdict.allowed && player) {
      this.toFreeAgent(player)
      this.glueLeft(team, player)
      this.saveToLocalStorage()
    }
    return verdict
  }

  extend(playerId: string, salary: number, years: number): OfferVerdict {
    const team = this.userTeam()
    const player = team.roster.find(item => item.id === playerId)
    if (!player) return deny('Player not found.')
    const walking = player.contract.salaries.length === 1
    const verdict = CBASimulator.applyExtension(team, player, salary, years)
    if (verdict.allowed) {
      if (walking) player.morale = Math.min(100, player.morale + 2)
      this.note('Cap Desk', `${player.name} extended`, verdict.reason)
      this.saveToLocalStorage()
    }
    return verdict
  }

  startNewSeason(): OfferVerdict {
    if (this.phase !== 'offseason' || this.offseasonStep !== 'free-agency') {
      return deny('Finish the draft before starting the next season.')
    }
    const user = this.userTeam()
    if (user.roster.length > NBA_RULES.ROSTER_MAX) {
      return deny(`Opening day rosters max out at ${NBA_RULES.ROSTER_MAX}. You have ${user.roster.length}.`)
    }
    if (user.roster.length < NBA_RULES.ROSTER_MIN) {
      return deny(`You need at least ${NBA_RULES.ROSTER_MIN} players. You have ${user.roster.length}.`)
    }

    this.aiBalanceRosters()
    for (const team of this.teams) {
      team.history.push({ season: this.season, wins: team.wins, losses: team.losses })
      team.wins = 0
      team.losses = 0
      team.pointDiff = 0
      team.cupWins = 0
      team.cupLosses = 0
      team.finances.seasonRevenue = 0
      team.finances.seasonExpenses = 0
      team.finances.books = []
      team.finances.lastBookMonth = undefined
      team.finances.exceptions = CBASimulator.freshExceptions()
      team.finances.hardCap = null
      for (const player of team.roster) {
        if (player.careerStats['season']) {
          player.careerStats[`s${this.season}`] = player.careerStats['season']
          delete player.careerStats['season']
        }
        player.fatigue = 0
        player.injury = null
      }
      CBASimulator.updateTeamFinances(team)
    }
    this.injuryDate = ''

    this.season++
    this.currentRound = 1
    this.seasonComplete = false
    this.awards = null
    this.phase = 'regular'
    this.offseasonStep = null
    this.draftOrder = []
    this.draftIndex = 0
    this.generateSchedule()
    this.generateDraftProspects(this.takenNames())
    this.scoutingTokens = NBA_RULES.SCOUTING_TOKENS
    this.note('Owner', `${this.season} training camp`, 'New scouting class is in. Tokens are refilled. Exceptions reset. Dead cap from anyone you waived still counts.')
    this.saveToLocalStorage()
    return { allowed: true, exceptionUsed: 'Season', reason: `${this.season} is open.`, consumes: null, setsHardCap: null }
  }
}

export default LeagueManager
