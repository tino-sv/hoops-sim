import { assistBoost, blockMultiplier, contestBoost, foulBoost, hasBadge, leaderMakeBoost, reboundMultiplier, shootingBoost, shotCallout, stealBoost, turnoverBoost, usageMultiplier } from './badges'
import { coachMakeBoost } from './office'
import type { Player, Position, Team, TeamTactics } from './types'

export type ShotKind = 'close' | 'mid' | 'three'

export interface PossessionContext {
  isTransition: boolean
  secondChance: boolean
  defenseTeamFouls: number
  secondsRemaining: number
  quarter: number
  isHomeOffense: boolean
  offenseTactics?: TeamTactics
  defenseTactics?: TeamTactics
  narrate?: boolean
}

export interface PossessionResult {
  points: number
  shooterId: string | null
  passerId: string | null
  rebounderId: string | null
  offensiveRebound: boolean
  turnoverPlayerId: string | null
  stealedById: string | null
  blockedById: string | null
  foulPlayerId: string | null
  foulOnPlayerId: string | null
  isShootingFoul: boolean
  andOne: boolean
  freeThrowsAwarded: number
  freeThrowsMade: number
  shotType: ShotKind | null
  shotAttempted: boolean
  shotMade: boolean
  wasFastBreak: boolean
  keepOffense: boolean
  liveBall: boolean
  secondsElapsed: number
  logs: string[]
}

const SIZE: Record<Position, number> = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function attr(player: Player, category: 'technical' | 'physical' | 'mental', key: string): number {
  const bag = player.attributes[category] as unknown as Record<string, number>
  const base = bag[key] ?? 50
  const fatigueFactor = 1 - player.fatigue / 450
  return clamp(base * fatigueFactor, 1, 99)
}

function pickWeighted<T>(entries: { item: T; w: number }[]): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0.01, entry.w), 0)
  let roll = Math.random() * total
  for (const entry of entries) {
    roll -= Math.max(0.01, entry.w)
    if (roll <= 0) return entry.item
  }
  return entries[entries.length - 1].item
}

function ftProb(rating: number): number {
  return clamp(0.60 + rating * 0.003, 0.62, 0.94)
}

function schemePhrase(coverage: string, kind: ShotKind, kickout: boolean): string {
  if (kickout) return ' against the blitz'
  if (coverage === 'drop' && kind === 'mid') return ' against the drop'
  if (coverage === 'zone-23' && kind === 'three') return ' over the 2-3'
  if (coverage === 'zone-32' && kind === 'close') return ' inside the 3-2'
  if (coverage === 'switch-everything') return ' on the switch'
  return ''
}

function emptyResult(seconds: number, logs: string[]): PossessionResult {
  return {
    points: 0,
    shooterId: null,
    passerId: null,
    rebounderId: null,
    offensiveRebound: false,
    turnoverPlayerId: null,
    stealedById: null,
    blockedById: null,
    foulPlayerId: null,
    foulOnPlayerId: null,
    isShootingFoul: false,
    andOne: false,
    freeThrowsAwarded: 0,
    freeThrowsMade: 0,
    shotType: null,
    shotAttempted: false,
    shotMade: false,
    wasFastBreak: false,
    keepOffense: false,
    liveBall: false,
    secondsElapsed: seconds,
    logs
  }
}

export class PossessionEngine {
  simulatePossession(
    offense: Team,
    defense: Team,
    onCourtOff: Player[],
    onCourtDef: Player[],
    ctx: PossessionContext
  ): PossessionResult[] {
    if (onCourtOff.length === 0 || onCourtDef.length === 0) {
      return [emptyResult(4, ['Turnover: a team could not field five players.'])]
    }

    const narrate = ctx.narrate !== false
    const logs: string[] = []
    const say = (line: string) => { if (narrate) logs.push(line) }
    const offTactics = ctx.offenseTactics ?? offense.tactics
    const defTactics = ctx.defenseTactics ?? defense.tactics

    const handler = ctx.secondChance
      ? this.pickReboundAttacker(onCourtOff, offTactics)
      : this.pickBallHandler(onCourtOff, offTactics)
    const primaryDef = onCourtDef.find(p => p.position === handler.position) ?? onCourtDef[0]
    const rimProtector = onCourtDef.find(p => p.position === 'C') ?? onCourtDef[onCourtDef.length - 1]
    const spacers = onCourtOff.filter(p => attr(p, 'technical', 'threePoint') >= 72).length

    let seconds = this.possessionLength(offTactics.tempo, ctx)
    const fastBreak = ctx.isTransition && !ctx.secondChance && Math.random() < 0.33
    if (fastBreak) seconds = 4 + Math.round(Math.random() * 2)
    if (ctx.secondChance) seconds = 5 + Math.round(Math.random() * 3)

    const home = ctx.isHomeOffense ? 1 : 0
    const mood = (handler.morale - 75) * 0.00045

    let turnoverChance = 0.155 + turnoverBoost(handler)
      + (attr(primaryDef, 'technical', 'steal') - attr(handler, 'technical', 'ballHandling')) * 0.00045
      + (75 - handler.morale) * 0.00035
      - home * 0.004
    if (fastBreak) turnoverChance *= 0.7
    if (ctx.secondChance) turnoverChance *= 0.6
    if (defTactics.defensiveCoverage === 'blitz' && defTactics.doubleTeamTrigger !== 'never') turnoverChance += 0.018
    if (defTactics.doubleTeamTrigger === 'always') turnoverChance += 0.012
    if (defTactics.doubleTeamTrigger === 'late-clock' && ctx.secondsRemaining < 90 && ctx.quarter >= 4) turnoverChance += 0.01
    const overplay = defTactics.targetOverplay[handler.id] ?? 'none'
    if (overplay !== 'none') turnoverChance += 0.012
    turnoverChance = clamp(turnoverChance, 0.07, 0.22)

    if (Math.random() < turnoverChance) {
      const result = emptyResult(Math.min(seconds, 8), logs)
      result.turnoverPlayerId = handler.id
      result.wasFastBreak = fastBreak
      const stealAvg = onCourtDef.reduce((sum, player) => sum + attr(player, 'technical', 'steal'), 0) / onCourtDef.length
      const stealChance = clamp(
        0.55 + (stealAvg - 56) * 0.006 + (onCourtDef.some(player => stealBoost(player) > 0) ? 0.04 : 0),
        0.38,
        0.68
      )
      if (Math.random() < stealChance) {
        const thief = pickWeighted(onCourtDef.map(p => ({ item: p, w: this.stealWeight(p, primaryDef.id) })))
        result.stealedById = thief.id
        result.liveBall = true
        const pocket = stealBoost(thief) > 0 ? ' Pick pocket.' : ''
        const mood = hasBadge(handler, 'hothead') && handler.morale < 60 ? ' Hothead.' : ''
        say(`TURNOVER: ${thief.name} steals it from ${handler.name}.${pocket}${mood}`)
      } else {
        result.liveBall = false
        say(`TURNOVER: ${handler.name} loses the ball.`)
      }
      return [result]
    }

    const inBonus = ctx.defenseTeamFouls >= 4
    const nonShootingFoul = !fastBreak && !ctx.secondChance && Math.random() < (inBonus ? 0.055 : 0.07) + foulBoost(primaryDef)
    if (nonShootingFoul) {
      const result = emptyResult(4 + Math.round(Math.random() * 2), logs)
      result.foulPlayerId = primaryDef.id
      result.foulOnPlayerId = handler.id
      result.wasFastBreak = fastBreak
      if (inBonus) {
        const made = this.shootFreeThrows(handler, 2)
        result.shooterId = handler.id
        result.freeThrowsAwarded = 2
        result.freeThrowsMade = made
        result.points = made
        result.isShootingFoul = true
        result.keepOffense = false
        say(`FOUL: ${primaryDef.name} reaches in. Bonus. ${handler.name} makes ${made} of 2.${foulBoost(primaryDef) > 0 ? ' Hothead.' : ''}`)
      } else {
        result.keepOffense = true
        say(`FOUL: ${primaryDef.name} fouls ${handler.name}. Side out.${foulBoost(primaryDef) > 0 ? ' Hothead.' : ''}`)
      }
      return [result]
    }

    const advantage = this.createdAdvantage(handler, primaryDef, rimProtector, onCourtOff, offTactics, defTactics, spacers, fastBreak)
    const shot = this.chooseShot(handler, onCourtOff, offTactics, defTactics, fastBreak, ctx.secondChance, overplay !== 'none')
    const shooter = shot.shooter
    const defender = onCourtDef.find(p => p.position === shooter.position) ?? primaryDef

    let contest = 0.055
    contest += (attr(defender, 'technical', shot.kind === 'close' ? 'interiorDefense' : 'perimeterDefense') - 68) * 0.0003
    if (shot.kind === 'close') contest += (attr(rimProtector, 'technical', 'block') - 60) * 0.0004
    contest += (2 - spacers) * 0.008
    if (advantage) contest -= 0.028
    if (fastBreak) contest -= 0.04
    if (shot.kickout) contest -= 0.03
    if (defTactics.defensiveCoverage === 'drop' && shot.kind === 'mid') contest -= 0.025
    if (defTactics.defensiveCoverage === 'drop' && shot.kind === 'close') contest += 0.02
    if (defTactics.defensiveCoverage === 'zone-23' && shot.kind === 'three') contest -= 0.02
    if (defTactics.defensiveCoverage === 'zone-23' && shot.kind === 'close') contest += 0.025
    if (defTactics.defensiveCoverage === 'zone-32' && shot.kind === 'close') contest -= 0.02
    if (defTactics.defensiveCoverage === 'zone-32' && shot.kind === 'three') contest += 0.02
    contest += contestBoost(defender)
    contest += coachMakeBoost(defense.coach, 'defense')
    if (defTactics.defensiveCoverage === 'switch-everything') {
      const gap = SIZE[defender.position] - SIZE[shooter.position]
      if (gap >= 2) contest -= 0.025
      if (gap <= -2) contest -= 0.03
    }
    contest = clamp(contest, 0.005, 0.16)

    const skillKey = shot.kind === 'three' ? 'threePoint' : shot.kind === 'mid' ? 'midRange' : 'closeShot'
    let make = this.baseMake(shot.kind) + (attr(shooter, 'technical', skillKey) - 68) * 0.0012 - contest + mood
    if (ctx.isHomeOffense) make += 0.008
    make += shootingBoost(shooter, shot.kind, ctx.quarter, ctx.secondsRemaining)
    make += leaderMakeBoost(onCourtOff, shooter.id)
    make += coachMakeBoost(offense.coach, 'offense')
    make = clamp(make, shot.kind === 'close' ? 0.42 : 0.22, shot.kind === 'close' ? 0.78 : shot.kind === 'three' ? 0.46 : 0.52)

    const blockChance = this.blockChanceFor(shot.kind, onCourtDef, advantage)
    if (Math.random() < blockChance) {
      const swatter = pickWeighted(onCourtDef.map(p => ({ item: p, w: this.blockWeight(p) })))
      const rimTag = blockMultiplier(swatter) > 1 ? ' Rim protector.' : ''
      const missed = this.missedShot(shooter, shot.kind, seconds, fastBreak, logs, say, `${swatter.name} BLOCKED ${shooter.name}.${rimTag}`)
      missed.blockedById = swatter.id
      this.resolveRebound(missed, offense, defense, onCourtOff, onCourtDef, shot.kind === 'three', say)
      return [missed]
    }

    const foulChance = (shot.kind === 'close' ? 0.18 : shot.kind === 'mid' ? 0.08 : 0.04) + foulBoost(defender)
      + (attr(shooter, 'technical', 'finishing') - 60) * 0.0008
      + (shooter.overallRating >= 94 && shot.kind === 'close' ? 0.03 : 0)
    if (Math.random() < foulChance) {
      const andOne = Math.random() < make * 0.85
      const ftCount = andOne ? 1 : (shot.kind === 'three' ? 3 : 2)
      const made = this.shootFreeThrows(shooter, ftCount)
      const fgPoints = andOne ? (shot.kind === 'three' ? 3 : 2) : 0
      const result = emptyResult(seconds, logs)
      result.shooterId = shooter.id
      result.shotAttempted = true
      result.shotMade = andOne
      result.shotType = shot.kind
      result.andOne = andOne
      result.isShootingFoul = true
      result.foulPlayerId = defender.id
      result.foulOnPlayerId = shooter.id
      result.freeThrowsAwarded = ftCount
      result.freeThrowsMade = made
      result.points = fgPoints + made
      result.wasFastBreak = fastBreak
      result.keepOffense = false
      if (andOne && shot.assist) result.passerId = shot.passerId
      const tag = shotCallout(shooter, shot.kind, ctx.quarter, ctx.secondsRemaining)
      const heat = foulBoost(defender) > 0 ? ' Hothead.' : ''
      say(`FOUL: ${defender.name} fouls ${shooter.name} on the shot. ${made} of ${ftCount} free throws.${heat}`)
      if (andOne) say(`SCORE: ${shooter.name} finishes through the foul.${tag}`)
      return [result]
    }

    const madeShot = Math.random() < make
    if (madeShot) {
      const points = shot.kind === 'three' ? 3 : 2
      const result = emptyResult(seconds, logs)
      result.points = points
      result.shooterId = shooter.id
      result.shotAttempted = true
      result.shotMade = true
      result.shotType = shot.kind
      result.wasFastBreak = fastBreak
      result.keepOffense = false
      result.liveBall = false
      if (shot.assist && shot.passerId && shot.passerId !== shooter.id) result.passerId = shot.passerId
      const label = shot.kind === 'three' ? 'three' : shot.kind === 'mid' ? 'midrange jumper' : 'layup'
      const tag = shotCallout(shooter, shot.kind, ctx.quarter, ctx.secondsRemaining)
      say(`SCORE: ${shooter.name} makes the ${label}${schemePhrase(defTactics.defensiveCoverage, shot.kind, shot.kickout)}.${tag}`)
      return [result]
    }

    const missLabel = shot.kind === 'three' ? 'three' : shot.kind === 'mid' ? 'jumper' : 'layup'
    const missTag = shotCallout(shooter, shot.kind, ctx.quarter, ctx.secondsRemaining)
    const missed = this.missedShot(shooter, shot.kind, seconds, fastBreak, logs, say, `${shooter.name} misses the ${missLabel}${schemePhrase(defTactics.defensiveCoverage, shot.kind, shot.kickout)}.${missTag}`)
    this.resolveRebound(missed, offense, defense, onCourtOff, onCourtDef, shot.kind === 'three', say)

    if (missed.offensiveRebound && missed.rebounderId && Math.random() < 0.4) {
      const rebounder = onCourtOff.find(p => p.id === missed.rebounderId) ?? shooter
      const putback = this.putback(rebounder, onCourtOff, onCourtDef, rimProtector, say)
      return [missed, putback]
    }
    return [missed]
  }

  private stealWeight(player: Player, primaryId: string): number {
    const steal = attr(player, 'technical', 'steal')
    const extra = steal > 72 ? (steal - 72) * 1.8 : 0
    const badge = stealBoost(player) > 0 ? 28 : 0
    const matchup = player.id === primaryId ? 1.15 : 1
    return (steal + extra + badge) * matchup
  }

  private blockWeight(player: Player): number {
    const skill = Math.max(0.4, attr(player, 'technical', 'block') - 38)
    const spot = player.position === 'C' ? 1.2 : player.position === 'PF' ? 1 : player.position === 'SF' ? 0.5 : 0.15
    return Math.pow(skill, 1.7) * spot * blockMultiplier(player)
  }

  private blockChanceFor(kind: ShotKind, defense: Player[], advantage: boolean): number {
    const best = Math.max(...defense.map(player => attr(player, 'technical', 'block')))
    const gap = Math.max(0, best - 60)
    let chance = kind === 'close' ? 0.055 + gap * 0.0052 : kind === 'mid' ? 0.007 + gap * 0.00028 : 0.0014
    if (defense.some(player => blockMultiplier(player) > 1) && kind === 'close') chance *= 1.1
    if (advantage) chance *= 0.68
    return clamp(chance, 0, kind === 'close' ? 0.2 : 0.035)
  }

  private usageWeight(player: Player): number {
    const usage = Math.max(8, player.personality.usageExpectation)
    const star = player.overallRating >= 96 ? 1.35 : player.overallRating >= 90 ? 1.15 : 1
    return Math.pow(usage, 1.2) * star * usageMultiplier(player)
  }

  private possessionLength(tempo: TeamTactics['tempo'], ctx: PossessionContext): number {
    const mean = tempo === 'fast' ? 15.6 : tempo === 'slow' ? 19.2 : 17.4
    const length = mean + (Math.random() * 4 - 2)
    return Math.max(4, Math.min(ctx.secondsRemaining || 24, Math.round(length)))
  }

  private pickBallHandler(players: Player[], tactics: TeamTactics): Player {
    return pickWeighted(players.map(player => {
      const role = tactics.offensiveRoles[player.id]
      let weight = this.usageWeight(player)
      weight += (attr(player, 'technical', 'ballHandling') - 50) * 0.12
      if (role === 'initiator') weight += 16
      if (role === 'secondary-initiator') weight += 9
      if (role === 'spot-up') weight -= 5
      if (role === 'screen-setter') weight -= 4
      if (role === 'rim-runner') weight -= 3
      return { item: player, w: weight }
    }))
  }

  private pickReboundAttacker(players: Player[], tactics: TeamTactics): Player {
    return pickWeighted(players.map(player => ({
      item: player,
      w: 4 + attr(player, 'technical', 'offRebound') * 0.15 + (player.position === 'C' || player.position === 'PF' ? 8 : 0)
        + (tactics.offensiveRoles[player.id] === 'rim-runner' ? 6 : 0)
    })))
  }

  private createdAdvantage(
    handler: Player,
    defender: Player,
    rim: Player,
    offense: Player[],
    offTactics: TeamTactics,
    defTactics: TeamTactics,
    spacers: number,
    fastBreak: boolean
  ): boolean {
    if (fastBreak) return Math.random() < 0.72
    const screener = offense.find(p => offTactics.offensiveRoles[p.id] === 'screen-setter')
      ?? offense.find(p => p.position === 'C')
      ?? offense[0]
    let chance = 0.40
    chance += (attr(handler, 'technical', 'ballHandling') - attr(defender, 'technical', 'perimeterDefense')) * 0.0035
    chance += (attr(screener, 'technical', 'screenSetting') - attr(rim, 'technical', 'helpDefense')) * 0.0015
    if (offTactics.offensiveStyle === 'motion') chance += 0.04 + (spacers - 2) * 0.015
    if (offTactics.offensiveStyle === 'pace-and-space') chance += (spacers - 2) * 0.02
    if (offTactics.offensiveStyle === 'isolation') chance += (attr(handler, 'technical', 'ballHandling') - 75) * 0.002
    if (defTactics.defensiveCoverage === 'blitz') chance -= 0.06
    if (defTactics.defensiveCoverage === 'drop') chance += 0.03
    return Math.random() < clamp(chance, 0.22, 0.68)
  }

  private chooseShot(
    handler: Player,
    lineup: Player[],
    tactics: TeamTactics,
    defense: TeamTactics,
    fastBreak: boolean,
    secondChance: boolean,
    overplayed: boolean
  ): { shooter: Player; kind: ShotKind; assist: boolean; passerId: string | null; kickout: boolean } {
    const others = lineup.filter(player => player.id !== handler.id)
    const keepIt = secondChance ? 0.72
      : handler.overallRating >= 96 ? 0.42
      : handler.overallRating >= 90 ? 0.34
      : tactics.offensiveRoles[handler.id] === 'initiator' ? 0.3
      : 0.2
    const shooter = others.length === 0 || Math.random() < keepIt
      ? handler
      : pickWeighted(others.map(player => ({
          item: player,
          w: this.usageWeight(player)
            + Math.max(0, attr(player, 'technical', 'threePoint') - 70) * 0.4
            + (tactics.offensiveRoles[player.id] === 'spot-up' ? 8 : 0)
            + (tactics.offensiveRoles[player.id] === 'rim-runner' ? 7 : 0)
        })))

    const style = tactics.offensiveStyle
    let three = 12 + Math.max(0, attr(shooter, 'technical', 'threePoint') - 52) * 0.62
    let mid = 5 + Math.max(0, attr(shooter, 'technical', 'midRange') - 55) * 0.28
    let close = 6 + Math.max(0, attr(shooter, 'technical', 'finishing') - 52) * 0.28
      + Math.max(0, attr(shooter, 'technical', 'closeShot') - 55) * 0.16

    const role = tactics.offensiveRoles[shooter.id]
    if (role === 'spot-up') three += 14
    if (role === 'rim-runner') close += 14
    if (role === 'screen-setter') close += 6
    if (style === 'pace-and-space') { three *= 1.4; mid *= 0.75 }
    if (style === 'post-up') {
      three *= 0.7
      if (shooter.position === 'C' || shooter.position === 'PF' || role === 'screen-setter') {
        close *= 1.7
        three *= 0.55
      }
    }
    if (style === 'isolation') { mid *= 1.35; three *= 0.85 }
    if (style === 'motion') { three *= 1.25; close *= 1.05 }
    if (style === 'pick-and-roll') { close *= 1.15; mid *= 1.15 }
    if (defense.defensiveCoverage === 'drop' && style === 'pick-and-roll') mid *= 1.45
    if (defense.defensiveCoverage === 'zone-23') three *= 1.4
    if (defense.defensiveCoverage === 'zone-32') close *= 1.35
    if (fastBreak) { close *= 1.55; three *= 1.05; mid *= 0.55 }
    if (secondChance) { close *= 1.7; three *= 0.45; mid *= 0.45 }
    if (overplayed && shooter.id === handler.id) three *= 0.72

    const kind = pickWeighted([
      { item: 'three' as ShotKind, w: three },
      { item: 'mid' as ShotKind, w: mid },
      { item: 'close' as ShotKind, w: close }
    ])

    const kicked = shooter.id !== handler.id
    const assistBase = kicked ? (style === 'isolation' ? 0.5 : 0.86) : 0.1
    const playmaker = assistBoost(handler)
    const assist = kicked && Math.random() < clamp(assistBase + playmaker, 0.1, 0.96)
    return {
      shooter,
      kind,
      assist,
      passerId: assist ? handler.id : null,
      kickout: defense.defensiveCoverage === 'blitz' && kind === 'three'
    }
  }

  private baseMake(kind: ShotKind): number {
    if (kind === 'close') return 0.70
    if (kind === 'mid') return 0.47
    return 0.40
  }

  private shootFreeThrows(shooter: Player, count: number): number {
    const prob = ftProb(attr(shooter, 'technical', 'freeThrow'))
    let made = 0
    for (let i = 0; i < count; i++) if (Math.random() < prob) made++
    return made
  }

  private missedShot(
    shooter: Player,
    kind: ShotKind,
    seconds: number,
    fastBreak: boolean,
    logs: string[],
    say: (line: string) => void,
    line: string
  ): PossessionResult {
    say(line)
    const result = emptyResult(seconds, logs)
    result.shooterId = shooter.id
    result.shotAttempted = true
    result.shotMade = false
    result.shotType = kind
    result.wasFastBreak = fastBreak
    return result
  }

  private resolveRebound(
    result: PossessionResult,
    offense: Team,
    defense: Team,
    onCourtOff: Player[],
    onCourtDef: Player[],
    isThree: boolean,
    say: (line: string) => void
  ) {
    const offScore = onCourtOff.reduce((sum, p) => sum + this.reboundWeight(p, true), 0)
    const defScore = onCourtDef.reduce((sum, p) => sum + this.reboundWeight(p, false), 0)
    let orb = offScore / (offScore + defScore * 2.55)
    if (isThree) orb += 0.03
    orb = clamp(orb, 0.18, 0.36)
    if (Math.random() < orb) {
      const rebounder = pickWeighted(onCourtOff.map(p => ({ item: p, w: this.reboundWeight(p, true) })))
      result.rebounderId = rebounder.id
      result.offensiveRebound = true
      result.keepOffense = true
      result.liveBall = false
      say(`${rebounder.name} grabs the offensive rebound.`)
    } else {
      const rebounder = pickWeighted(onCourtDef.map(p => ({ item: p, w: this.reboundWeight(p, false) })))
      result.rebounderId = rebounder.id
      result.offensiveRebound = false
      result.keepOffense = false
      result.liveBall = true
      say(`${rebounder.name} with the defensive rebound.`)
    }
    void offense
    void defense
  }

  private reboundWeight(player: Player, offense: boolean): number {
    const key = offense ? 'offRebound' : 'defRebound'
    let weight = attr(player, 'technical', key) * 0.65 + attr(player, 'physical', 'strength') * 0.2 + attr(player, 'physical', 'vertical') * 0.15
    if (player.position === 'C') weight *= 1.45
    else if (player.position === 'PF') weight *= 1.25
    else if (player.position === 'SF') weight *= 1.05
    else weight *= 0.78
    weight *= reboundMultiplier(player)
    return weight
  }

  private putback(
    rebounder: Player,
    onCourtOff: Player[],
    onCourtDef: Player[],
    rim: Player,
    say: (line: string) => void
  ): PossessionResult {
    const logs: string[] = []
    const localSay = (line: string) => { logs.push(line) }
    void say
    const make = clamp(0.58 + (attr(rebounder, 'technical', 'closeShot') - 68) * 0.003 - (attr(rim, 'technical', 'interiorDefense') - 68) * 0.001, 0.40, 0.75)
    if (Math.random() < make) {
      localSay(`SCORE: ${rebounder.name} scores the putback.`)
      const result = emptyResult(3, logs)
      result.points = 2
      result.shooterId = rebounder.id
      result.shotAttempted = true
      result.shotMade = true
      result.shotType = 'close'
      result.keepOffense = false
      return result
    }
    const missed = this.missedShot(rebounder, 'close', 3, false, logs, localSay, `${rebounder.name} misses the putback.`)
    const def = pickWeighted(onCourtDef.map(p => ({ item: p, w: this.reboundWeight(p, false) })))
    missed.rebounderId = def.id
    missed.offensiveRebound = false
    missed.keepOffense = false
    missed.liveBall = true
    localSay(`${def.name} cleans it up.`)
    void onCourtOff
    return missed
  }
}

export default PossessionEngine
