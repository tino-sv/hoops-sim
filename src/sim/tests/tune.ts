import { LeagueManager } from '../league'
import { GameSession, MatchEngine } from '../matchEngine'
import type { PlayerAttributes, Team, TeamTactics } from '../types'

interface Totals {
  points: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  orb: number
  drb: number
  ast: number
  tov: number
  stl: number
  blk: number
  fouls: number
  games: number
  starterMinutes: number
  starterGames: number
}

function blank(): Totals {
  return {
    points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, fouls: 0,
    games: 0, starterMinutes: 0, starterGames: 0
  }
}

function addSide(totals: Totals, score: number, stats: Record<string, { fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; offRebounds: number; defRebounds: number; assists: number; turnovers: number; steals: number; blocks: number; fouls: number; minutes: number }>, starters: string[]) {
  totals.points += score
  totals.games += 1
  for (const [id, line] of Object.entries(stats)) {
    totals.fgm += line.fgm
    totals.fga += line.fga
    totals.tpm += line.tpm
    totals.tpa += line.tpa
    totals.ftm += line.ftm
    totals.fta += line.fta
    totals.orb += line.offRebounds
    totals.drb += line.defRebounds
    totals.ast += line.assists
    totals.tov += line.turnovers
    totals.stl += line.steals
    totals.blk += line.blocks
    totals.fouls += line.fouls
    if (starters.includes(id)) {
      totals.starterMinutes += line.minutes
      totals.starterGames += 1
    }
  }
}

function startersOf(team: Team): string[] {
  return (['PG', 'SG', 'SF', 'PF', 'C'] as const)
    .map(position => team.depthChart[position]?.[0])
    .filter((id): id is string => !!id)
}

function report(label: string, totals: Totals) {
  const g = Math.max(1, totals.games)
  const efg = (totals.fgm + 0.5 * totals.tpm) / Math.max(1, totals.fga)
  const tovPct = totals.tov / Math.max(1, totals.fga + 0.44 * totals.fta + totals.tov)
  const orbPct = totals.orb / Math.max(1, totals.orb + totals.drb)
  const ftRate = totals.fta / Math.max(1, totals.fga)
  const pace = (totals.fga + 0.44 * totals.fta + totals.tov - totals.orb) / g
  const threeRate = totals.tpa / Math.max(1, totals.fga)
  const ftPct = totals.ftm / Math.max(1, totals.fta)
  const ppg = totals.points / g
  const starterMin = totals.starterMinutes / Math.max(1, totals.starterGames)
  const line = {
    ppg: +ppg.toFixed(1),
    pace: +pace.toFixed(1),
    efg: +(efg * 100).toFixed(1),
    tov: +(totals.tov / g).toFixed(1),
    tovPct: +(tovPct * 100).toFixed(1),
    orbPct: +(orbPct * 100).toFixed(1),
    ftRate: +ftRate.toFixed(3),
    ftPct: +(ftPct * 100).toFixed(1),
    threeRate: +(threeRate * 100).toFixed(1),
    fgPct: +((totals.fgm / Math.max(1, totals.fga)) * 100).toFixed(1),
    tpPct: +((totals.tpm / Math.max(1, totals.tpa)) * 100).toFixed(1),
    ast: +(totals.ast / g).toFixed(1),
    stl: +(totals.stl / g).toFixed(1),
    blk: +(totals.blk / g).toFixed(1),
    fouls: +(totals.fouls / g).toFixed(1),
    starterMin: +starterMin.toFixed(1)
  }
  console.log(label, line)
  return line
}

function play(engine: MatchEngine, home: Team, away: Team, games: number, intoHome?: Totals, intoAway?: Totals) {
  const homeStarters = startersOf(home)
  const awayStarters = startersOf(away)
  let homePoints = 0
  let awayPoints = 0
  for (let i = 0; i < games; i++) {
    const result = engine.simulateMatch(home, away)
    homePoints += result.teamAScore
    awayPoints += result.teamBScore
    if (intoHome) addSide(intoHome, result.teamAScore, result.playerStatsA, homeStarters)
    if (intoAway) addSide(intoAway, result.teamBScore, result.playerStatsB, awayStarters)
  }
  return { homePoints, awayPoints, margin: (homePoints - awayPoints) / games }
}

function snapshotAttributes(team: Team): Map<string, PlayerAttributes> {
  const saved = new Map<string, PlayerAttributes>()
  for (const player of team.roster) saved.set(player.id, structuredClone(player.attributes))
  return saved
}

function restoreAttributes(team: Team, saved: Map<string, PlayerAttributes>) {
  for (const player of team.roster) {
    const copy = saved.get(player.id)
    if (copy) player.attributes = structuredClone(copy)
  }
}

function shiftAttributes(team: Team, delta: number) {
  for (const player of team.roster) {
    for (const category of ['technical', 'physical', 'mental'] as const) {
      const bag = player.attributes[category] as unknown as Record<string, number>
      for (const key of Object.keys(bag)) bag[key] = Math.max(1, Math.min(99, bag[key] + delta))
    }
  }
}

function snapshotStyle(team: Team): TeamTactics['offensiveStyle'] {
  return team.tactics.offensiveStyle
}

const failures: string[] = []
function expectRange(name: string, value: number, min: number, max: number) {
  if (value < min || value > max) failures.push(`${name} ${value} outside ${min}-${max}`)
}

const league = new LeagueManager()
const engine = new MatchEngine()
const home = league.teams[0]
const away = league.teams[1]
const homeStyle = snapshotStyle(home)
const awayStyle = snapshotStyle(away)
home.tactics.offensiveStyle = 'pick-and-roll'
away.tactics.offensiveStyle = 'pick-and-roll'
home.tactics.tempo = 'balanced'
away.tactics.tempo = 'balanced'

const both = blank()
const base = play(engine, home, away, 80, both, both)
const factors = report('balanced', both)
expectRange('ppg', factors.ppg, 108, 120)
expectRange('pace', factors.pace, 96, 106)
expectRange('efg', factors.efg, 52, 57)
expectRange('tov', factors.tov, 12, 16)
expectRange('orbPct', factors.orbPct, 23, 32)
expectRange('ftRate', factors.ftRate, 0.18, 0.30)
expectRange('ftPct', factors.ftPct, 74, 82)
expectRange('threeRate', factors.threeRate, 36, 46)
expectRange('stl', factors.stl, 6, 9)
expectRange('blk', factors.blk, 3.5, 6.5)
expectRange('ast', factors.ast, 20, 28)
expectRange('starterMin', factors.starterMin, 26, 36)
console.log('balanced margin', +base.margin.toFixed(1))

const goodSaved = snapshotAttributes(home)
const badSaved = snapshotAttributes(away)
shiftAttributes(away, -12)
const talentGames = 120
let goodPoints = 0
let badPoints = 0
for (let i = 0; i < talentGames; i++) {
  const flipped = i % 2 === 1
  const result = engine.simulateMatch(flipped ? away : home, flipped ? home : away)
  const good = flipped ? result.teamBScore : result.teamAScore
  const bad = flipped ? result.teamAScore : result.teamBScore
  goodPoints += good
  badPoints += bad
}
const talentMargin = (goodPoints - badPoints) / talentGames
console.log('talent margin', +talentMargin.toFixed(1))
expectRange('talentMargin', talentMargin, 6, 24)
restoreAttributes(home, goodSaved)
restoreAttributes(away, badSaved)

home.tactics.offensiveStyle = 'pace-and-space'
away.tactics.offensiveStyle = 'post-up'
const space = blank()
const post = blank()
play(engine, home, away, 40, space, post)
const spaceLine = report('pace-and-space', space)
const postLine = report('post-up', post)
const styleGap = spaceLine.threeRate - postLine.threeRate
console.log('style 3PAr gap', +styleGap.toFixed(1))
if (styleGap < 8) failures.push(`pace-and-space 3PAr lead ${styleGap} is under 8 points`)

home.tactics.offensiveStyle = homeStyle
away.tactics.offensiveStyle = awayStyle

const watched = new GameSession(home, away, { narrate: false })
watched.setHomeTactics(structuredClone(home.tactics))
watched.step()
const banked = watched.scriptedPossessions()
if (banked < 80) failures.push(`script banked ${banked} possessions, expected the rest of the game`)
const changed = structuredClone(home.tactics)
changed.defensiveCoverage = home.tactics.defensiveCoverage === 'drop' ? 'switch-everything' : 'drop'
watched.setHomeTactics(changed)
if (watched.scriptedPossessions() !== 0) failures.push('a coverage change kept the old script')
const outgoing = watched.onCourtHome[0]
const incoming = home.roster.find(player => !watched.onCourtHome.some(on => on.id === player.id) && (!player.injury || player.injury.daysRemaining <= 0))
if (!incoming || !watched.manualSub(outgoing.id, incoming)) failures.push('could not sub into the charted game')
else if (watched.scriptedPossessions() !== 0) failures.push('a sub kept the old script')
watched.step()
if (incoming && !watched.onCourtHome.some(player => player.id === incoming.id)) failures.push('the sub was not on the recalculated trip')
let replayGuard = 0
while (!watched.finished && replayGuard < 800) {
  watched.step()
  replayGuard += 1
}
if (!watched.finished) failures.push('scripted replay did not finish')
if (watched.scoreHome < 70 || watched.scoreAway < 70) failures.push(`scripted score ${watched.scoreHome}-${watched.scoreAway} is too low`)

const defense = new Map<string, { minutes: number; stl: number; blk: number; points: number; games: number }>()
for (let i = 0; i < 40; i++) {
  const result = engine.simulateMatch(home, away)
  for (const [team, stats] of [[home, result.playerStatsA], [away, result.playerStatsB]] as const) {
    for (const player of team.roster) {
      const line = stats[player.id]
      if (!line || line.minutes <= 0) continue
      const row = defense.get(player.id) ?? { minutes: 0, stl: 0, blk: 0, points: 0, games: 0 }
      row.minutes += line.minutes
      row.stl += line.steals
      row.blk += line.blocks
      row.points += line.points
      row.games += 1
      defense.set(player.id, row)
    }
  }
}
const star = [...home.roster].sort((a, b) => b.overallRating - a.overallRating)[0]
const starRow = defense.get(star.id)
const starPpg = starRow && starRow.games ? starRow.points / starRow.games : 0
const bench = [...home.roster].filter(player => player.overallRating < 74)
const benchPpg = bench.reduce((sum, player) => {
  const row = defense.get(player.id)
  return sum + (row && row.games ? row.points / row.games : 0)
}, 0) / Math.max(1, bench.length)
console.log('star', star.name, star.overallRating, +starPpg.toFixed(1), 'bench', +benchPpg.toFixed(1))
if (star.overallRating >= 94 && (starPpg < 26 || starPpg > 36)) failures.push(`${star.name} averages ${starPpg.toFixed(1)} points`)
if (benchPpg > 12) failures.push(`bench averages ${benchPpg.toFixed(1)} points`)
const per36 = (stat: number, minutes: number) => stat / minutes * 36
const rows = [...defense.entries()].map(([id, row]) => {
  const player = home.roster.find(p => p.id === id) ?? away.roster.find(p => p.id === id)!
  return {
    name: player.name,
    pos: player.position,
    minutes: row.minutes,
    steal: player.attributes.technical.steal,
    block: player.attributes.technical.block,
    stl36: per36(row.stl, row.minutes),
    blk36: per36(row.blk, row.minutes)
  }
}).filter(row => row.minutes >= 240)
const mean = (list: { blk36: number; stl36: number }[], key: 'blk36' | 'stl36') => list.reduce((sum, row) => sum + row[key], 0) / Math.max(1, list.length)
const eliteBlock = rows.filter(row => row.block >= 82)
const weakBlock = rows.filter(row => row.block <= 42)
const eliteSteal = rows.filter(row => row.steal >= 85)
const ordinarySteal = rows.filter(row => row.steal <= 58)
console.log('block elites', eliteBlock.map(row => `${row.name} ${row.pos} blk ${row.block} ${row.blk36.toFixed(2)}`))
console.log('steal elites', eliteSteal.map(row => `${row.name} ${row.pos} stl ${row.steal} ${row.stl36.toFixed(2)}`))
if (eliteBlock.length) {
  const blk = mean(eliteBlock, 'blk36')
  console.log('elite blk36', +blk.toFixed(2), 'weak blk36', +mean(weakBlock, 'blk36').toFixed(2))
  if (blk < 1.6 || blk > 3.6) failures.push(`elite shot blockers average ${blk.toFixed(2)} per 36`)
}
if (weakBlock.length && mean(weakBlock, 'blk36') > 0.45) failures.push(`weak shot blockers average ${mean(weakBlock, 'blk36').toFixed(2)} per 36`)
const bestBlocker = [...rows].sort((a, b) => b.block - a.block)[0]
if (bestBlocker && weakBlock.length && bestBlocker.blk36 < mean(weakBlock, 'blk36') + 1) {
  failures.push(`${bestBlocker.name} is not separating from the weak shot blockers`)
}
if (eliteSteal.length) {
  const stl = mean(eliteSteal, 'stl36')
  console.log('elite stl36', +stl.toFixed(2), 'ordinary stl36', +mean(ordinarySteal, 'stl36').toFixed(2))
  if (stl < 1.7 || stl > 3.2) failures.push(`elite thieves average ${stl.toFixed(2)} per 36`)
  if (ordinarySteal.length && stl < mean(ordinarySteal, 'stl36') + 0.6) failures.push('elite thieves are not clear of the rest')
}
if (ordinarySteal.length && mean(ordinarySteal, 'stl36') > 1.35) failures.push(`ordinary hands average ${mean(ordinarySteal, 'stl36').toFixed(2)} per 36`)

if (failures.length) {
  throw new Error(`TUNE FAILED\n - ${failures.join('\n - ')}`)
}
console.log('tune ok')
