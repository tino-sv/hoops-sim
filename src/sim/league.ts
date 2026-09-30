import { birdFromYears, CBASimulator, type OfferVerdict } from './cba'
import { MatchEngine } from './matchEngine'
import { createPlayer, createProspect, playerFromProspect } from './players'
import { developPlayer } from './ratings'
import { NBA_RULES } from './rules'
import { addToDepthChart, rebuildDepthChart, waivePlayer } from './roster'
import type { BoxScoreStats, Conference, DraftPick, DraftProspect, OfficeNote, OffseasonStep, Player, Position, SeasonPhase, Team, TeamTactics } from './types'
import { POSITIONS } from './types'

const TEAM_TEMPLATES: { city: string; name: string; color: string; conference: Conference }[] = [
  { city: 'Boston', name: 'Shamrocks', color: '#008348', conference: 'East' },
  { city: 'Los Angeles', name: 'Breakers', color: '#552583', conference: 'West' },
  { city: 'Chicago', name: 'Wind', color: '#CE1141', conference: 'East' },
  { city: 'Miami', name: 'Heatwave', color: '#98002E', conference: 'East' },
  { city: 'Golden State', name: 'Waves', color: '#1D428A', conference: 'West' },
  { city: 'New York', name: 'Skyscrapers', color: '#F58426', conference: 'East' },
  { city: 'Dallas', name: 'Stallions', color: '#00538C', conference: 'West' },
  { city: 'Toronto', name: 'Dinos', color: '#E31837', conference: 'East' },
  { city: 'Philadelphia', name: 'Phantoms', color: '#006BB6', conference: 'East' },
  { city: 'Phoenix', name: 'Flares', color: '#E56020', conference: 'West' },
  { city: 'Denver', name: 'Peaks', color: '#0E2240', conference: 'West' },
  { city: 'Seattle', name: 'Jetstreams', color: '#006241', conference: 'West' }
]

export interface ScheduledMatch {
  id: string
  round: number
  homeTeamId: string
  awayTeamId: string
  simulated: boolean
  scoreHome?: number
  scoreAway?: number
  winnerId?: string
  playByPlaySummary?: string
}

type TeamQuality = 'contender' | 'middle' | 'rebuild'

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

  constructor() {
    if (!this.loadFromLocalStorage()) this.initializeLeague()
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

  private takenNames(): Set<string> {
    const used = new Set<string>()
    for (const team of this.teams) for (const player of team.roster) used.add(player.name)
    for (const player of this.freeAgents) used.add(player.name)
    for (const prospect of this.draftProspects) used.add(prospect.name)
    return used
  }

  saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return
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
      news: this.news
    }))
  }

  loadFromLocalStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const saved = window.localStorage.getItem('hoops_sim_league_data')
    if (!saved) return false
    try {
      const data = JSON.parse(saved)
      if (data.schemaVersion !== NBA_RULES.SCHEMA_VERSION) return false
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

  initializeLeague(): void {
    const names = new Set<string>()
    this.teams = TEAM_TEMPLATES.map((template, index) => this.buildTeam(template, index, names))
    this.userTeamId = this.teams[0].id
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
    const user = this.userTeam()
    this.note(
      'Owner',
      'The books are already tight',
      `${user.city} is over or around the salary cap, same as most of the league. You get one mid-level and one bi-annual in the offseason. During the season the only contract you can hand out is a 1-year minimum. Roster stays between ${NBA_RULES.ROSTER_MIN} and ${NBA_RULES.ROSTER_MAX}.`
    )
    this.saveToLocalStorage()
  }

  private qualityFor(index: number): TeamQuality {
    if (index === 1 || index === 6) return 'contender'
    if (index >= 10) return 'rebuild'
    return 'middle'
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
      color: template.color,
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
        exceptions: CBASimulator.freshExceptions()
      },
      wins: 0,
      losses: 0,
      pointDiff: 0,
      history: []
    }
    rebuildDepthChart(team)
    CBASimulator.updateTeamFinances(team)
    return team
  }

  private targetOverall(quality: TeamQuality, depth: number, franchise: boolean): number {
    if (franchise) {
      if (quality === 'contender') return between(90, 95)
      if (quality === 'rebuild') return between(78, 82)
      return between(84, 88)
    }
    if (depth === 0) {
      if (quality === 'contender') return between(81, 86)
      if (quality === 'rebuild') return between(73, 77)
      return between(78, 83)
    }
    if (depth === 1) return quality === 'rebuild' ? between(68, 73) : between(72, 77)
    return quality === 'rebuild' ? between(62, 67) : between(64, 70)
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
      { overall: [74, 78], count: 2 },
      { overall: [70, 73], count: 4 },
      { overall: [66, 70], count: 8 },
      { overall: [60, 65], count: 10 }
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
    this.schedule = []
    const list = this.teams
    const numTeams = list.length
    const rounds = (numTeams - 1) * 4
    const tempTeams = [...list]

    for (let round = 1; round <= rounds; round++) {
      for (let i = 0; i < numTeams / 2; i++) {
        const homeIdx = i
        const awayIdx = numTeams - 1 - i
        const home = round % 2 === 0 ? tempTeams[homeIdx] : tempTeams[awayIdx]
        const away = round % 2 === 0 ? tempTeams[awayIdx] : tempTeams[homeIdx]
        this.schedule.push({
          id: `match_r${round}_g${i + 1}`,
          round,
          homeTeamId: home.id,
          awayTeamId: away.id,
          simulated: false
        })
      }
      const last = tempTeams.pop()!
      tempTeams.splice(1, 0, last)
    }
    this.totalRounds = rounds
  }

  simulateRound(userTeamId: string | null = null, onUserGameDone?: (res: any) => void): void {
    if (this.phase !== 'regular' || this.seasonComplete) return

    const roundMatches = this.schedule.filter(match => match.round === this.currentRound && !match.simulated)
    roundMatches.forEach(match => {
      const home = this.teams.find(team => team.id === match.homeTeamId)!
      const away = this.teams.find(team => team.id === match.awayTeamId)!
      const result = this.matchEngine.simulateMatch(home, away)
      match.simulated = true
      match.scoreHome = result.teamAScore
      match.scoreAway = result.teamBScore
      match.winnerId = result.winnerId
      match.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1]?.log
      this.applyMatchResults(home, away, result)
      if (userTeamId && (home.id === userTeamId || away.id === userTeamId) && onUserGameDone) {
        onUserGameDone(result)
      }
    })

    if (this.currentRound >= this.totalRounds) this.seasonComplete = true
    else this.currentRound++
    this.saveToLocalStorage()
  }

  private applyMatchResults(home: Team, away: Team, res: any): void {
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

        const win = res.winnerId === team.id
        let moraleDelta = win ? 2 : -2
        if (stats.minutes < 5 && player.personality.usageExpectation > 20) moraleDelta -= 3
        else if (stats.minutes > 20 && player.personality.usageExpectation > 20) moraleDelta += 1
        player.morale = Math.max(0, Math.min(100, player.morale + moraleDelta))
      })
    }

    updateStats(home, res.playerStatsA)
    updateStats(away, res.playerStatsB)
  }

  enterOffseason(): OfferVerdict {
    if (this.phase !== 'regular' || !this.seasonComplete) {
      return deny('The season is still going. Offseason starts after the last game.')
    }

    for (const team of this.teams) {
      team.finances.deadCap = 0
      team.finances.hardCap = null
      team.finances.exceptions = CBASimulator.freshExceptions()
    }

    const movers: { name: string; delta: number }[] = []
    const ageGroup = (player: Player) => {
      player.age++
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

  private buildDraftOrder() {
    const ranked = [...this.teams].sort((a, b) => {
      const gamesA = a.wins + a.losses
      const gamesB = b.wins + b.losses
      const pctA = gamesA === 0 ? 0 : a.wins / gamesA
      const pctB = gamesB === 0 ? 0 : b.wins / gamesB
      if (pctA !== pctB) return pctA - pctB
      if (a.pointDiff !== b.pointDiff) return a.pointDiff - b.pointDiff
      return a.city.localeCompare(b.city)
    })

    const pool = ranked.slice(0, 4)
    const weights = [40, 28, 20, 12]
    let ticket = Math.random() * weights.reduce((sum, weight) => sum + weight, 0)
    let winner = pool[0]
    for (let i = 0; i < pool.length; i++) {
      ticket -= weights[i]
      if (ticket <= 0) {
        winner = pool[i]
        break
      }
    }
    const order = [winner, ...pool.filter(team => team.id !== winner.id), ...ranked.slice(4)]
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
      this.saveToLocalStorage()
    }
    return verdict
  }

  extend(playerId: string, salary: number, years: number): OfferVerdict {
    const team = this.userTeam()
    const player = team.roster.find(item => item.id === playerId)
    if (!player) return deny('Player not found.')
    const verdict = CBASimulator.applyExtension(team, player, salary, years)
    if (verdict.allowed) {
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
      team.finances.exceptions = CBASimulator.freshExceptions()
      team.finances.hardCap = null
      for (const player of team.roster) {
        if (player.careerStats['season']) {
          player.careerStats[`s${this.season}`] = player.careerStats['season']
          delete player.careerStats['season']
        }
        player.fatigue = 0
      }
      CBASimulator.updateTeamFinances(team)
    }

    this.season++
    this.currentRound = 1
    this.seasonComplete = false
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
