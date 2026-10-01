import { fatigueMultiplier } from './badges'
import { coachFatigueFactor } from './office'
import { PossessionEngine, type PossessionResult } from './possessionEngine'
import { POSITIONS, type BoxScoreStats, type Player, type Team, type TeamTactics } from './types'

export interface PlayByPlayEvent {
  quarter: number
  timeString: string
  log: string
  scoreA: number
  scoreB: number
  teamName: string
}

export interface MatchResult {
  teamAId: string
  teamBId: string
  teamAScore: number
  teamBScore: number
  playerStatsA: Record<string, BoxScoreStats>
  playerStatsB: Record<string, BoxScoreStats>
  playByPlay: PlayByPlayEvent[]
  winnerId: string
}

export interface StepLog {
  text: string
  type: 'score' | 'foul' | 'turnover' | 'system' | 'normal'
}

export function emptyBox(): BoxScoreStats {
  return {
    minutes: 0, points: 0, assists: 0, rebounds: 0, offRebounds: 0, defRebounds: 0,
    steals: 0, blocks: 0, turnovers: 0, fouls: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0,
    ftm: 0, fta: 0, plusMinus: 0
  }
}

export function applyPossession(
  offStats: Record<string, BoxScoreStats>,
  defStats: Record<string, BoxScoreStats>,
  event: PossessionResult
) {
  if (event.shooterId && offStats[event.shooterId]) {
    const line = offStats[event.shooterId]
    line.points += event.points
    if (event.shotAttempted) {
      line.fga += 1
      if (event.shotMade) line.fgm += 1
      if (event.shotType === 'three') {
        line.tpa += 1
        if (event.shotMade) line.tpm += 1
      }
    }
    if (event.freeThrowsAwarded > 0) {
      line.fta += event.freeThrowsAwarded
      line.ftm += event.freeThrowsMade
    }
  }
  if (event.passerId && event.shotMade && offStats[event.passerId]) {
    offStats[event.passerId].assists += 1
  }
  if (event.rebounderId) {
    const bag = event.offensiveRebound ? offStats : defStats
    const line = bag[event.rebounderId]
    if (line) {
      line.rebounds += 1
      if (event.offensiveRebound) line.offRebounds += 1
      else line.defRebounds += 1
    }
  }
  if (event.turnoverPlayerId && offStats[event.turnoverPlayerId]) offStats[event.turnoverPlayerId].turnovers += 1
  if (event.stealedById && defStats[event.stealedById]) defStats[event.stealedById].steals += 1
  if (event.blockedById && defStats[event.blockedById]) defStats[event.blockedById].blocks += 1
  if (event.foulPlayerId && defStats[event.foulPlayerId]) defStats[event.foulPlayerId].fouls += 1
}

function classify(line: string): StepLog['type'] {
  if (line.includes('SCORE:')) return 'score'
  if (line.includes('FOUL:')) return 'foul'
  if (line.includes('TURNOVER:') || line.includes('BLOCKED')) return 'turnover'
  return 'normal'
}

function targetMinutes(team: Team, playerId: string): number {
  let best = 99
  for (const position of POSITIONS) {
    const index = (team.depthChart[position] || []).indexOf(playerId)
    if (index >= 0) best = Math.min(best, index)
  }
  if (best === 0) return 32
  if (best === 1) return 16
  return 6
}

function healthy(player: Player | undefined): player is Player {
  return !!player && (!player.injury || player.injury.daysRemaining <= 0)
}

export function startingFive(team: Team, stats: Record<string, BoxScoreStats>): Player[] {
  const onCourt: Player[] = []
  for (const position of POSITIONS) {
    const list = (team.depthChart[position] || [])
      .map(id => team.roster.find(p => p.id === id))
      .filter(healthy)
    const available = list.find(player => (stats[player.id]?.fouls ?? 0) < 6)
    if (available && !onCourt.includes(available)) onCourt.push(available)
  }
  for (const player of team.roster) {
    if (onCourt.length >= 5) break
    if (!onCourt.includes(player) && healthy(player) && (stats[player.id]?.fouls ?? 0) < 6) onCourt.push(player)
  }
  return onCourt.slice(0, 5)
}

function foulTroubleLimit(quarter: number): number {
  if (quarter <= 1) return 2
  if (quarter === 2) return 3
  if (quarter === 3) return 4
  return 5
}

export function rotateLineup(
  team: Team,
  onCourt: Player[],
  stats: Record<string, BoxScoreStats>,
  quarter: number,
  secondsRemaining: number,
  locks?: ReadonlySet<string>
): Player[] {
  const court = [...onCourt]
  const elapsed = Math.min(48, (Math.min(quarter, 4) - 1) * 12 + (720 - Math.min(secondsRemaining, 720)) / 60)
  if (elapsed < 5) return court
  const fraction = Math.min(1, elapsed / 48)
  const limit = foulTroubleLimit(quarter)

  const lineOf = (player: Player) => stats[player.id] ?? emptyBox()
  const behind = (player: Player) => targetMinutes(team, player.id) * fraction - lineOf(player).minutes
  const shouldSit = (player: Player) => {
    const line = lineOf(player)
    if (line.fouls >= 6 || line.fouls >= limit) return true
    if (locks?.has(player.id)) return false
    if (player.fatigue > 76) return true
    return line.minutes > targetMinutes(team, player.id) * fraction + 2
  }
  const wantsIn = (player: Player) => {
    const line = lineOf(player)
    return healthy(player)
      && line.fouls < 6
      && line.fouls < limit
      && player.fatigue < 68
      && line.minutes < targetMinutes(team, player.id) * fraction + 1
  }

  for (let i = 0; i < court.length; i++) {
    const current = court[i]
    if (!shouldSit(current)) continue
    const candidates = team.roster.filter(player => player.id !== current.id && !court.includes(player) && wantsIn(player))
    candidates.sort((a, b) => {
      const score = (player: Player) => behind(player) + (player.position === current.position ? 3 : 0)
      return score(b) - score(a)
    })
    const emergency = lineOf(current).fouls >= 6
      ? team.roster.find(player => !court.includes(player) && healthy(player) && lineOf(player).fouls < 6)
      : undefined
    const next = candidates[0] ?? emergency
    if (next) court[i] = next
  }

  if (quarter >= 4) {
    for (const position of POSITIONS) {
      const starter = team.roster.find(player => player.id === team.depthChart[position]?.[0])
      if (!starter || court.includes(starter) || !healthy(starter)) continue
      const starterLine = lineOf(starter)
      if (starterLine.fouls >= 5 || starter.fatigue > 58 || starterLine.minutes > 33) continue
      const replaceAt = court.findIndex(player => !locks?.has(player.id) && targetMinutes(team, player.id) < 20)
      if (replaceAt >= 0) court[replaceAt] = starter
    }
  }
  return court
}

function fatigueDelta(player: Player, seconds: number): number {
  const stamina = player.attributes.physical.stamina || 50
  const delta = seconds * (0.05 - stamina * 0.00032) * fatigueMultiplier(player)
  return Math.max(0.05, delta)
}

interface ScriptTrip {
  homeIds: string[]
  awayIds: string[]
  events: PossessionResult[]
}

interface SessionSnapshot {
  scoreHome: number
  scoreAway: number
  quarter: number
  secondsRemaining: number
  possession: 'home' | 'away'
  isTransition: boolean
  secondChance: boolean
  finished: boolean
  foulsHome: number
  foulsAway: number
  statsHome: Record<string, BoxScoreStats>
  statsAway: Record<string, BoxScoreStats>
  onCourtHome: string[]
  onCourtAway: string[]
  fatigue: Record<string, number>
  lastEvent: PossessionResult | null
}

function tacticsKey(tactics: TeamTactics): string {
  return JSON.stringify([
    tactics.tempo,
    tactics.offensiveStyle,
    tactics.defensiveCoverage,
    tactics.doubleTeamTrigger,
    tactics.offensiveRoles,
    tactics.targetOverplay
  ])
}

export class GameSession {
  readonly home: Team
  readonly away: Team
  scoreHome = 0
  scoreAway = 0
  quarter = 1
  secondsRemaining = 720
  possession: 'home' | 'away'
  isTransition = false
  secondChance = false
  finished = false
  statsHome: Record<string, BoxScoreStats> = {}
  statsAway: Record<string, BoxScoreStats> = {}
  onCourtHome: Player[] = []
  onCourtAway: Player[] = []
  foulsHome = 0
  foulsAway = 0
  lastEvent: PossessionResult | null = null
  playByPlay: PlayByPlayEvent[] = []
  private narrate: boolean
  private engine = new PossessionEngine()
  private script: ScriptTrip[] = []
  private tacticsKey = ''
  private homeLocks = new Set<string>()
  homeTactics: TeamTactics | null = null

  constructor(home: Team, away: Team, options?: { narrate?: boolean }) {
    this.home = home
    this.away = away
    this.narrate = options?.narrate !== false
    this.possession = Math.random() < 0.5 ? 'home' : 'away'
    for (const player of home.roster) {
      this.statsHome[player.id] = emptyBox()
      player.fatigue = 0
    }
    for (const player of away.roster) {
      this.statsAway[player.id] = emptyBox()
      player.fatigue = 0
    }
    this.onCourtHome = startingFive(home, this.statsHome)
    this.onCourtAway = startingFive(away, this.statsAway)
  }

  scriptedPossessions(): number {
    return this.script.length
  }

  setHomeTactics(tactics: TeamTactics) {
    const key = tacticsKey(tactics)
    this.homeTactics = tactics
    if (key === this.tacticsKey) return
    this.tacticsKey = key
    this.script = []
  }

  manualSub(outId: string, inPlayer: Player): boolean {
    const index = this.onCourtHome.findIndex(player => player.id === outId)
    if (index === -1) return false
    if (this.onCourtHome.some(player => player.id === inPlayer.id)) return false
    if ((this.statsHome[inPlayer.id]?.fouls ?? 0) >= 6) return false
    this.onCourtHome[index] = inPlayer
    this.homeLocks.delete(outId)
    this.homeLocks.add(inPlayer.id)
    this.script = []
    return true
  }

  /** Play the next trip from the charted script. The first call charts the rest of the game. */
  step(): { logs: StepLog[]; finished: boolean } {
    if (this.finished) return { logs: [], finished: true }
    if (this.script.length === 0) this.compile()
    const trip = this.script.shift()
    if (!trip) return { logs: [], finished: this.finished }
    this.onCourtHome = this.playersFrom(this.home, trip.homeIds)
    this.onCourtAway = this.playersFrom(this.away, trip.awayIds)
    const logs = this.applyEvents(trip.events)
    return { logs, finished: this.finished }
  }

  /** Roll the rest of the game without keeping a script. Season sim uses this. */
  runLive() {
    let guard = 0
    while (!this.finished && guard < 800) {
      this.rollTrip()
      guard += 1
    }
  }

  private compile() {
    if (this.finished) return
    const snap = this.capture()
    const trips: ScriptTrip[] = []
    let guard = 0
    while (!this.finished && guard < 800) {
      trips.push(this.rollTrip())
      guard += 1
    }
    this.restore(snap)
    this.script = trips
  }

  private rollTrip(): ScriptTrip {
    this.onCourtHome = rotateLineup(this.home, this.onCourtHome, this.statsHome, this.quarter, this.secondsRemaining, this.homeLocks)
    this.onCourtAway = rotateLineup(this.away, this.onCourtAway, this.statsAway, this.quarter, this.secondsRemaining)
    const offenseIsHome = this.possession === 'home'
    const offense = offenseIsHome ? this.home : this.away
    const defense = offenseIsHome ? this.away : this.home
    const events = this.engine.simulatePossession(
      offense,
      defense,
      offenseIsHome ? this.onCourtHome : this.onCourtAway,
      offenseIsHome ? this.onCourtAway : this.onCourtHome,
      {
        isTransition: this.isTransition,
        secondChance: this.secondChance,
        defenseTeamFouls: offenseIsHome ? this.foulsAway : this.foulsHome,
        secondsRemaining: this.secondsRemaining,
        quarter: this.quarter,
        isHomeOffense: offenseIsHome,
        offenseTactics: offenseIsHome ? this.homeTactics ?? undefined : undefined,
        defenseTactics: offenseIsHome ? undefined : this.homeTactics ?? undefined,
        narrate: this.narrate
      }
    )
    const trip = {
      homeIds: this.onCourtHome.map(player => player.id),
      awayIds: this.onCourtAway.map(player => player.id),
      events
    }
    this.applyEvents(events)
    return trip
  }

  private applyEvents(events: PossessionResult[]): StepLog[] {
    const logs: StepLog[] = []
    const offenseIsHome = this.possession === 'home'
    const offStats = offenseIsHome ? this.statsHome : this.statsAway
    const defStats = offenseIsHome ? this.statsAway : this.statsHome
    let elapsed = 0
    for (const event of events) {
      elapsed += event.secondsElapsed
      applyPossession(offStats, defStats, event)
      if (event.foulPlayerId) {
        if (offenseIsHome) this.foulsAway += 1
        else this.foulsHome += 1
      }
      if (event.points > 0) {
        if (offenseIsHome) this.scoreHome += event.points
        else this.scoreAway += event.points
        for (const player of this.onCourtHome) {
          this.statsHome[player.id].plusMinus += offenseIsHome ? event.points : -event.points
        }
        for (const player of this.onCourtAway) {
          this.statsAway[player.id].plusMinus += offenseIsHome ? -event.points : event.points
        }
      }
      for (const line of event.logs) logs.push({ text: line, type: classify(line) })
      this.lastEvent = event
    }

    elapsed = Math.max(1, elapsed)
    this.secondsRemaining -= elapsed
    const minutes = elapsed / 60
    for (const player of [...this.onCourtHome, ...this.onCourtAway]) {
      const bag = this.statsHome[player.id] ? this.statsHome : this.statsAway
      if (bag[player.id]) bag[player.id].minutes += minutes
      const coach = this.home.roster.includes(player) ? this.home.coach : this.away.coach
      player.fatigue = Math.min(100, player.fatigue + fatigueDelta(player, elapsed) * coachFatigueFactor(coach))
    }
    for (const player of [...this.home.roster, ...this.away.roster]) {
      const onCourt = this.onCourtHome.includes(player) || this.onCourtAway.includes(player)
      if (!onCourt) player.fatigue = Math.max(0, player.fatigue - elapsed * 0.11)
    }

    const last = events[events.length - 1]
    if (last?.keepOffense) {
      this.isTransition = false
      this.secondChance = last.offensiveRebound
    } else {
      this.possession = offenseIsHome ? 'away' : 'home'
      this.isTransition = !!last?.liveBall
      this.secondChance = false
    }

    if (this.secondsRemaining <= 0) {
      this.secondsRemaining = 0
      logs.push(...this.endPeriod())
    }
    return logs
  }

  private playersFrom(team: Team, ids: string[]): Player[] {
    return ids
      .map(id => team.roster.find(player => player.id === id))
      .filter((player): player is Player => !!player)
  }

  private capture(): SessionSnapshot {
    const fatigue: Record<string, number> = {}
    for (const player of [...this.home.roster, ...this.away.roster]) fatigue[player.id] = player.fatigue
    return {
      scoreHome: this.scoreHome,
      scoreAway: this.scoreAway,
      quarter: this.quarter,
      secondsRemaining: this.secondsRemaining,
      possession: this.possession,
      isTransition: this.isTransition,
      secondChance: this.secondChance,
      finished: this.finished,
      foulsHome: this.foulsHome,
      foulsAway: this.foulsAway,
      statsHome: structuredClone(this.statsHome),
      statsAway: structuredClone(this.statsAway),
      onCourtHome: this.onCourtHome.map(player => player.id),
      onCourtAway: this.onCourtAway.map(player => player.id),
      fatigue,
      lastEvent: this.lastEvent ? structuredClone(this.lastEvent) : null
    }
  }

  private restore(snap: SessionSnapshot) {
    this.scoreHome = snap.scoreHome
    this.scoreAway = snap.scoreAway
    this.quarter = snap.quarter
    this.secondsRemaining = snap.secondsRemaining
    this.possession = snap.possession
    this.isTransition = snap.isTransition
    this.secondChance = snap.secondChance
    this.finished = snap.finished
    this.foulsHome = snap.foulsHome
    this.foulsAway = snap.foulsAway
    this.statsHome = snap.statsHome
    this.statsAway = snap.statsAway
    this.onCourtHome = this.playersFrom(this.home, snap.onCourtHome)
    this.onCourtAway = this.playersFrom(this.away, snap.onCourtAway)
    this.lastEvent = snap.lastEvent
    for (const player of [...this.home.roster, ...this.away.roster]) {
      player.fatigue = snap.fatigue[player.id] ?? 0
    }
  }

  private endPeriod(): StepLog[] {
    const logs: StepLog[] = []
    const label = this.quarter <= 4 ? `End of quarter ${this.quarter}` : `End of overtime ${this.quarter - 4}`
    logs.push({ text: `${label}. ${this.home.name} ${this.scoreHome}, ${this.away.name} ${this.scoreAway}.`, type: 'system' })
    for (const player of [...this.onCourtHome, ...this.onCourtAway]) {
      player.fatigue = Math.max(0, player.fatigue - 12)
    }
    this.foulsHome = 0
    this.foulsAway = 0
    const tied = this.scoreHome === this.scoreAway
    if (this.quarter < 4 || tied) {
      this.quarter += 1
      this.secondsRemaining = this.quarter <= 4 ? 720 : 300
      if (this.quarter > 4) logs.push({ text: 'OVERTIME.', type: 'system' })
      if (this.quarter > 8) this.finished = true
    } else {
      this.finished = true
      const winner = this.scoreHome > this.scoreAway ? this.home.name : this.away.name
      logs.push({ text: `FINAL: ${this.home.name} ${this.scoreHome} - ${this.scoreAway} ${this.away.name}. ${winner} wins.`, type: 'system' })
    }
    return logs
  }

  result(): MatchResult {
    const winnerId = this.scoreHome > this.scoreAway ? this.home.id : this.away.id
    return {
      teamAId: this.home.id,
      teamBId: this.away.id,
      teamAScore: this.scoreHome,
      teamBScore: this.scoreAway,
      playerStatsA: this.statsHome,
      playerStatsB: this.statsAway,
      playByPlay: this.playByPlay,
      winnerId
    }
  }
}

export class MatchEngine {
  simulateMatch(home: Team, away: Team): MatchResult {
    const game = new GameSession(home, away, { narrate: false })
    game.runLive()
    const result = game.result()
    const winner = result.winnerId === home.id ? home.name : away.name
    result.playByPlay = [{
      quarter: game.quarter,
      timeString: '0:00',
      log: `FINAL: ${home.name} ${result.teamAScore} - ${result.teamBScore} ${away.name}. ${winner} wins.`,
      scoreA: result.teamAScore,
      scoreB: result.teamBScore,
      teamName: 'SYSTEM'
    }]
    return result
  }
}

export default MatchEngine
