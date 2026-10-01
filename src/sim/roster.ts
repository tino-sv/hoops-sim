import { CBASimulator } from './cba'
import type { OfferVerdict } from './cba'
import { POSITIONS, type Player, type Position, type Team } from './types'

export function roleWord(index: number): { label: string; rank: number } {
  if (index === 0) return { label: 'Starter', rank: 0 }
  if (index === 1) return { label: 'Rotation', rank: 1 }
  if (index === 2) return { label: 'Situational', rank: 2 }
  return { label: 'Deep bench', rank: 3 }
}

export function shapeWord(player: Player): { label: string; rank: number } {
  if (player.injury && player.injury.daysRemaining > 0) {
    return { label: `Out ${player.injury.daysRemaining}d`, rank: 0 }
  }
  if (player.fatigue >= 70) return { label: 'Tired', rank: 1 }
  return { label: 'Fresh', rank: 2 }
}

export function moodWord(player: Player): { label: string; rank: number } {
  if (player.tradeDemand || player.morale < 30) return { label: 'Gone', rank: 0 }
  if (player.morale < 55) return { label: 'Unhappy', rank: 1 }
  return { label: 'Fine', rank: 2 }
}

export function lastNightLine(player: Player): string {
  const night = player.lastNight
  if (!night) return ''
  const name = player.name.split(' ')[0]
  if (night.minutes <= 0) return `${name} did not play.`
  const wanted = !!player.tradeDemand || (player.personality.usageExpectation >= 24 && night.minutes < 24)
  return wanted ? `${name} had ${night.points} and wanted the ball.` : `${name} had ${night.points}.`
}

function hashText(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0
  return hash
}

/** How far the staff misses. About one read in five is off by 8 to 11. */
export function scoutMiss(id: string): number {
  const hash = hashText(id)
  if (hash % 5 === 0) return (hash & 1 ? -1 : 1) * (8 + (hash % 4))
  return (hash % 7) - 3
}

/** The staff's opinion of someone who is not yours, measured against your roster. */
export function scoutRead(
  player: { id: string; name: string; overallRating: number },
  yours: { overallRating: number }[]
): { label: string; rank: number; line: string } {
  const seen = Math.max(40, Math.min(99, player.overallRating + scoutMiss(player.id)))
  const marks = yours.map(item => item.overallRating).sort((a, b) => b - a)
  const best = marks[0] ?? 70
  const startAt = marks[4] ?? marks[marks.length - 1] ?? 70
  const rotateAt = marks[9] ?? marks[marks.length - 1] ?? 62
  const fringeAt = marks[marks.length - 1] ?? 58
  const first = player.name.split(' ')[0]
  if (marks.length && seen >= best) {
    return { label: 'Better', rank: 0, line: `${first} looks better than anyone you have.` }
  }
  if (seen >= startAt) {
    return { label: 'Starter', rank: 1, line: `The staff thinks ${first} would start for you.` }
  }
  if (seen >= rotateAt) {
    return { label: 'Rotation', rank: 2, line: `The staff sees ${first} as a rotation piece.` }
  }
  if (seen + 2 >= fringeAt) {
    return { label: 'Fringe', rank: 3, line: `${first} looks like the end of the bench.` }
  }
  return { label: 'Below', rank: 4, line: `${first} does not look like he belongs on this roster.` }
}

export function scoutCeiling(id: string, potential: number): { label: string; line: string } {
  const seen = Math.max(40, Math.min(99, potential + scoutMiss(`${id}:pot`)))
  if (seen >= 90) return { label: 'Star', line: 'a star ceiling' }
  if (seen >= 82) return { label: 'Starter', line: 'a starter ceiling' }
  if (seen >= 74) return { label: 'Rotation', line: 'a rotation ceiling' }
  return { label: 'Limited', line: 'a limited ceiling' }
}

export function capLine(salaries: number[]): string {
  if (!salaries.length) return 'No deal'
  const years = salaries.length === 1 ? '1 year' : `${salaries.length} years`
  const money = salaries.map(value => `$${(value / 1_000_000).toFixed(1)}M`).join(', ')
  return `${years}, ${money}`
}

export function addToDepthChart(team: Team, player: Player): void {
  const list = team.depthChart[player.position] || []
  if (!list.includes(player.id)) list.push(player.id)
  team.depthChart[player.position] = list
}

export function removeFromDepthChart(team: Team, playerId: string): void {
  for (const position of POSITIONS) {
    team.depthChart[position] = (team.depthChart[position] || []).filter(id => id !== playerId)
  }
}

export function rebuildDepthChart(team: Team): void {
  const next = {} as Record<Position, string[]>
  for (const position of POSITIONS) {
    next[position] = team.roster
      .filter(player => player.position === position)
      .sort((a, b) => b.overallRating - a.overallRating)
      .map(player => player.id)
  }
  team.depthChart = next
}

export function waivePlayer(team: Team, playerId: string): OfferVerdict {
  const player = team.roster.find(p => p.id === playerId)
  if (!player) {
    return { allowed: false, exceptionUsed: 'None', reason: 'Player not found.', consumes: null, setsHardCap: null }
  }
  const verdict = CBASimulator.previewWaive(team, player)
  if (!verdict.allowed) return verdict

  team.finances.deadCap += player.contract.salaries[0] || 0
  team.roster = team.roster.filter(p => p.id !== playerId)
  removeFromDepthChart(team, playerId)
  CBASimulator.updateTeamFinances(team)
  return verdict
}
