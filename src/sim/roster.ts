import { CBASimulator } from './cba'
import type { OfferVerdict } from './cba'
import { POSITIONS, type Player, type Position, type Team } from './types'

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
