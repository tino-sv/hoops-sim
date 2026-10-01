import { hasSignature } from './office'
import type { Coach, Player, PlayerAttributes, PlayerPersonality, Position, Team } from './types'

type ShotKind = 'close' | 'mid' | 'three'

export type BadgeGroup = 'skill' | 'personality'

export interface BadgeInfo {
  id: string
  name: string
  group: BadgeGroup
  effect: string
}

export const BADGES: BadgeInfo[] = [
  { id: 'sharpshooter', name: 'Sharpshooter', group: 'skill', effect: 'Makes about 3% more of his threes.' },
  { id: 'lockdown', name: 'Lockdown', group: 'skill', effect: 'Contests shots a little harder.' },
  { id: 'playmaker', name: 'Playmaker', group: 'skill', effect: 'A few more of his passes become assists.' },
  { id: 'post_beast', name: 'Post scorer', group: 'skill', effect: 'Makes about 3% more shots at the rim.' },
  { id: 'glass_cleaner', name: 'Glass cleaner', group: 'skill', effect: 'Grabs more rebounds.' },
  { id: 'clutch', name: 'Clutch', group: 'skill', effect: 'Makes about 2% more shots in the last 3 minutes.' },
  { id: 'iron_man', name: 'Iron man', group: 'skill', effect: 'Fatigue builds 30% slower.' },
  { id: 'slasher', name: 'Slasher', group: 'skill', effect: 'Makes about 3% more shots at the rim on the drive.' },
  { id: 'rim_protector', name: 'Rim protector', group: 'skill', effect: 'Blocks a few more shots at the rim.' },
  { id: 'pick_pocket', name: 'Pick pocket', group: 'skill', effect: 'Comes up with more steals.' },
  { id: 'leader', name: 'Leader', group: 'personality', effect: 'Teammates shoot a hair better with him on the floor, and a loss stings the locker room less.' },
  { id: 'competitor', name: 'Competitor', group: 'personality', effect: 'Rises after a win, hates sitting, and is a little better in the 4th.' },
  { id: 'hothead', name: 'Hothead', group: 'personality', effect: 'Picks up more fouls. A loss hits his morale hard, and a bad mood costs him the ball.' },
  { id: 'fragile', name: 'Fragile', group: 'personality', effect: 'Losses linger. When his morale is down, his shot comes and goes.' },
  { id: 'gym_rat', name: 'Gym rat', group: 'personality', effect: 'Tires slower and does not swing as hard after a win or a loss.' },
  { id: 'loyal', name: 'Loyal', group: 'personality', effect: 'Takes a little less money, and a loss does not sour him.' },
  { id: 'diva', name: 'Diva', group: 'personality', effect: 'Wants the ball. Short minutes and a bad mood show up in his shot and his turnovers.' }
]

const BY_ID = new Map(BADGES.map(badge => [badge.id, badge]))

export function badgeById(id: string): BadgeInfo | undefined {
  return BY_ID.get(id)
}

export function hasBadge(player: Player, id: string): boolean {
  return player.traits?.includes(id) ?? false
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function assignBadges(
  attrs: PlayerAttributes,
  position: Position,
  personality?: PlayerPersonality
): string[] {
  const t = attrs.technical
  const p = attrs.physical
  const m = attrs.mental
  const skill: string[] = []
  if (t.threePoint >= 84) skill.push('sharpshooter')
  if ((position === 'PG' || position === 'SG' || position === 'SF') && t.finishing >= 84) skill.push('slasher')
  if ((position === 'PF' || position === 'C') && t.closeShot >= 82 && p.strength >= 78) skill.push('post_beast')
  if ((position === 'PF' || position === 'C') && t.block >= 82) skill.push('rim_protector')
  if ((position === 'PG' || position === 'SG' || position === 'SF') && t.perimeterDefense >= 82) skill.push('lockdown')
  if ((position === 'PF' || position === 'C') && t.interiorDefense >= 82 && t.block >= 76) skill.push('lockdown')
  if (t.steal >= 84) skill.push('pick_pocket')
  if (t.passingVision >= 82 && t.passingAccuracy >= 78) skill.push('playmaker')
  if (t.defRebound >= 82 || t.offRebound >= 80) skill.push('glass_cleaner')
  if (m.composure >= 86) skill.push('clutch')
  if (p.stamina >= 86) skill.push('iron_man')

  const badges = skill.slice(0, 3)
  const personalityBadge = personality ? pickPersonality(personality, m.leadership, m.teamwork, m.workRate, m.composure) : null
  if (personalityBadge) badges.push(personalityBadge)
  return badges
}

function pickPersonality(
  personality: PlayerPersonality,
  leadership: number,
  teamwork: number,
  workRate: number,
  composure: number
): string | null {
  if (personality.ego >= 82 && teamwork <= 48) return 'diva'
  if (composure <= 48 && personality.ego >= 70) return 'hothead'
  if (composure <= 42) return 'fragile'
  if (leadership >= 80 && teamwork >= 68) return 'leader'
  if (personality.loyalty >= 80 && personality.greed <= 48) return 'loyal'
  if (personality.ego >= 72 && composure >= 68) return 'competitor'
  if (workRate >= 84) return 'gym_rat'
  return null
}

export function shootingBoost(player: Player, kind: ShotKind, quarter: number, secondsLeft: number): number {
  let boost = 0
  if (hasBadge(player, 'sharpshooter') && kind === 'three') boost += 0.03
  if (hasBadge(player, 'post_beast') && kind === 'close') boost += 0.03
  if (hasBadge(player, 'slasher') && kind === 'close') boost += 0.03
  if (hasBadge(player, 'clutch') && quarter >= 4 && secondsLeft < 180) boost += 0.02
  if (hasBadge(player, 'competitor') && quarter >= 4) boost += 0.008
  if (hasBadge(player, 'fragile') && player.morale < 55) boost -= 0.01
  if (hasBadge(player, 'diva') && player.morale < 50) boost -= 0.01
  return boost
}

export function leaderMakeBoost(lineup: Player[], shooterId: string): number {
  return lineup.some(player => player.id !== shooterId && hasBadge(player, 'leader')) ? 0.005 : 0
}

export function inContractYear(player: Player): boolean {
  return player.contract.salaries.length === 1
}

/** A walk year finishes a few more shots and gives a few more away. */
export function contractYearMake(player: Player): number {
  return inContractYear(player) ? 0.006 : 0
}

export function contractYearTurnover(player: Player): number {
  return inContractYear(player) ? 0.004 : 0
}

/** A low-usage teammate the room actually likes. Stars and divas are not glue. */
export function isGlue(player: Player): boolean {
  return player.personality.chemistry >= 84 && player.personality.usageExpectation <= 16 && !hasBadge(player, 'diva')
}

export function glueMakeBoost(lineup: Player[], shooterId: string): number {
  return lineup.some(player => player.id !== shooterId && isGlue(player)) ? 0.004 : 0
}

/** Teammates feel it when every glue guy sits, and a little less when one of them plays through a loss. */
export function glueMoraleDelta(player: Player, roster: Player[], minutesOf: (player: Player) => number, won: boolean): number {
  if (isGlue(player)) return 0
  const glues = roster.filter(isGlue)
  if (glues.length === 0) return 0
  if (glues.some(guy => minutesOf(guy) >= 12)) return won ? 0 : 1
  if (glues.every(guy => minutesOf(guy) < 8)) return -1
  return 0
}

export function turnoverBoost(player: Player): number {
  let extra = 0
  if (hasBadge(player, 'hothead') && player.morale < 60) extra += 0.01
  if (hasBadge(player, 'diva') && player.morale < 50) extra += 0.012
  return extra
}

export function contestBoost(defender: Player): number {
  return hasBadge(defender, 'lockdown') ? 0.02 : 0
}

export function blockMultiplier(player: Player): number {
  return hasBadge(player, 'rim_protector') ? 1.18 : 1
}

export function stealBoost(player: Player): number {
  return hasBadge(player, 'pick_pocket') ? 0.06 : 0
}

/** Short tag for the play-by-play when a badge is actually in the shot. */
export function shotCallout(player: Player, kind: ShotKind, quarter: number, secondsLeft: number): string {
  const tags: string[] = []
  if (hasBadge(player, 'sharpshooter') && kind === 'three') tags.push('Sharpshooter')
  if (hasBadge(player, 'post_beast') && kind === 'close') tags.push('Post scorer')
  if (hasBadge(player, 'slasher') && kind === 'close') tags.push('Slasher')
  if (hasBadge(player, 'clutch') && quarter >= 4 && secondsLeft < 180) tags.push('Clutch')
  if (hasBadge(player, 'fragile') && player.morale < 55) tags.push('Fragile')
  if (hasBadge(player, 'diva') && player.morale < 50) tags.push('Diva')
  return tags.length ? ` ${tags.join(', ')}.` : ''
}

export function foulBoost(defender: Player): number {
  return hasBadge(defender, 'hothead') ? 0.015 : 0
}

export function assistBoost(handler: Player): number {
  return hasBadge(handler, 'playmaker') ? 0.08 : 0
}

export function reboundMultiplier(player: Player): number {
  return hasBadge(player, 'glass_cleaner') ? 1.2 : 1
}

export function fatigueMultiplier(player: Player): number {
  let multiplier = 1
  if (hasBadge(player, 'iron_man')) multiplier *= 0.7
  if (hasBadge(player, 'gym_rat')) multiplier *= 0.85
  return multiplier
}

export function usageMultiplier(player: Player): number {
  return hasBadge(player, 'diva') ? 1.22 : 1
}

export function salaryBadgeMultiplier(player: Player): number {
  if (hasBadge(player, 'loyal')) return 0.94
  if (hasBadge(player, 'diva')) return 1.06
  return 1
}

export function promisedMinutes(player: Player, chartIndex: number): number {
  if (chartIndex < 0) return 0
  const hungry = player.personality.usageExpectation >= 28
  if (chartIndex === 0) return hungry ? 34 : 28
  if (chartIndex === 1) return hungry ? 22 : 16
  return hungry ? 12 : 6
}

export function roleMoraleDelta(player: Player, minutes: number, chartIndex: number): number {
  if (minutes <= 0 || chartIndex < 0) return 0
  const gap = promisedMinutes(player, chartIndex) - minutes
  if (gap < 8) return 0
  return gap >= 14 ? -3 : -1
}

export function crowdedShotPenalty(shooter: Player, onCourt: Player[]): number {
  if (shooter.personality.usageExpectation < 24) return 0
  const others = onCourt.filter(player => player.id !== shooter.id && player.personality.usageExpectation >= 24).length
  return others >= 2 ? 0.012 : 0
}

export function moraleAfterGame(player: Player, minutes: number, won: boolean, leaderPlayed: boolean, coach?: Coach, roleDelta = 0): number {
  const coachStyle = coach?.style
  let delta = won ? 2 : -2
  if (hasBadge(player, 'competitor')) delta = won ? 4 : -1
  if (hasBadge(player, 'hothead') && !won) delta = -5
  if (hasBadge(player, 'fragile')) delta = won ? 1 : -4
  if (hasBadge(player, 'loyal')) delta = won ? 3 : -1
  if (hasBadge(player, 'gym_rat')) delta = Math.round(delta * 0.5)
  if (coachStyle === 'players-coach' && won) delta += 1
  if (coachStyle === 'disciplinarian' && hasBadge(player, 'hothead')) delta += 1
  if (coachStyle === 'disciplinarian' && hasBadge(player, 'fragile')) delta -= 1
  if (coach?.formerPlayer && !won) delta += 1
  if (coach?.pedigree === 'former-star' && !won && player.age >= 30) delta += 1
  if (coach?.pedigree === 'former-star' && !won && player.age <= 23) delta -= 1
  if (coach?.pedigree === 'video-room' && !won && hasBadge(player, 'leader')) delta -= 1
  if (coach?.pedigree === 'college-mentor' && won && player.age <= 23) delta += 1
  if (coach?.pedigree === 'european-tactician' && !won && hasBadge(player, 'diva')) delta -= 1
  if ((coach?.teaching ?? 0) >= 75 && player.age <= 23 && won) delta += 1
  if ((coach?.manManagement ?? 60) >= 75 && (hasBadge(player, 'diva') || hasBadge(player, 'fragile'))) delta += 1
  if ((coach?.manManagement ?? 60) <= 42 && !won) delta -= 1
  if (hasSignature(coach, 'players-friend') && !won && delta < 0) delta = Math.trunc(delta / 2)

  const wantsBall = player.personality.usageExpectation > 20
  if (hasBadge(player, 'diva') && minutes > 0 && minutes < 28) delta -= 3
  else if (minutes < 5 && wantsBall && !hasBadge(player, 'gym_rat') && !hasBadge(player, 'fragile')) delta -= 3
  else if (minutes > 20 && wantsBall) delta += 1

  if (hasBadge(player, 'competitor') && minutes > 0 && minutes < 15 && player.personality.usageExpectation > 18) delta -= 2
  if (!won && leaderPlayed && !hasBadge(player, 'hothead')) delta += 1
  if (roleDelta) delta += roleDelta
  if (inContractYear(player) && minutes >= 18) delta += won ? 1 : -1

  delta = clamp(delta, -8, 6)
  return clamp(player.morale + delta, 0, 100)
}

export function settleTeamMorale(roster: Player[], minutesOf: (player: Player) => number, won: boolean, coach?: Coach, team?: Team) {
  const leaderPlayed = roster.some(player => hasBadge(player, 'leader') && minutesOf(player) >= 15)
  for (const player of roster) {
    const minutes = minutesOf(player)
    const chartIndex = team ? (team.depthChart[player.position] || []).indexOf(player.id) : -1
    const role = roleMoraleDelta(player, minutes, chartIndex)
    const glue = glueMoraleDelta(player, roster, minutesOf, won)
    player.morale = moraleAfterGame(player, minutes, won, leaderPlayed, coach, role + glue)
    const hungry = player.personality.usageExpectation >= 22
    if (role <= -3 && hungry) {
      if (!player.tradeDemand) player.tradeLeak = true
      player.tradeDemand = true
    } else if (chartIndex >= 0 && minutes + 4 >= promisedMinutes(player, chartIndex)) {
      player.tradeDemand = false
      player.tradeLeak = false
    }
  }
}
