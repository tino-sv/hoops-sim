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
