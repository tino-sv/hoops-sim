import { assignBadges } from './badges'
import type { MentalAttributes, PhysicalAttributes, Player, PlayerAttributes, PlayerPersonality, Position, TechnicalAttributes } from './types'

type Category = 'technical' | 'physical' | 'mental'

interface Weight {
  category: Category
  key: string
  w: number
}

const WEIGHTS: Record<Position, Weight[]> = {
  PG: [
    { category: 'technical', key: 'ballHandling', w: 0.16 },
    { category: 'technical', key: 'passingVision', w: 0.14 },
    { category: 'technical', key: 'passingAccuracy', w: 0.10 },
    { category: 'technical', key: 'threePoint', w: 0.10 },
    { category: 'technical', key: 'midRange', w: 0.06 },
    { category: 'technical', key: 'finishing', w: 0.06 },
    { category: 'technical', key: 'perimeterDefense', w: 0.08 },
    { category: 'technical', key: 'steal', w: 0.05 },
    { category: 'physical', key: 'speed', w: 0.08 },
    { category: 'physical', key: 'acceleration', w: 0.05 },
    { category: 'mental', key: 'iq', w: 0.08 },
    { category: 'mental', key: 'composure', w: 0.04 }
  ],
  SG: [
    { category: 'technical', key: 'threePoint', w: 0.16 },
    { category: 'technical', key: 'midRange', w: 0.12 },
    { category: 'technical', key: 'ballHandling', w: 0.10 },
    { category: 'technical', key: 'finishing', w: 0.08 },
    { category: 'technical', key: 'freeThrow', w: 0.06 },
    { category: 'technical', key: 'perimeterDefense', w: 0.10 },
    { category: 'technical', key: 'steal', w: 0.05 },
    { category: 'physical', key: 'speed', w: 0.08 },
    { category: 'physical', key: 'agility', w: 0.07 },
    { category: 'mental', key: 'iq', w: 0.08 },
    { category: 'mental', key: 'composure', w: 0.06 },
    { category: 'mental', key: 'workRate', w: 0.04 }
  ],
  SF: [
    { category: 'technical', key: 'threePoint', w: 0.10 },
    { category: 'technical', key: 'midRange', w: 0.08 },
    { category: 'technical', key: 'finishing', w: 0.10 },
    { category: 'technical', key: 'perimeterDefense', w: 0.10 },
    { category: 'technical', key: 'interiorDefense', w: 0.06 },
    { category: 'technical', key: 'defRebound', w: 0.06 },
    { category: 'technical', key: 'ballHandling', w: 0.06 },
    { category: 'physical', key: 'speed', w: 0.08 },
    { category: 'physical', key: 'strength', w: 0.08 },
    { category: 'physical', key: 'agility', w: 0.06 },
    { category: 'mental', key: 'iq', w: 0.08 },
    { category: 'mental', key: 'workRate', w: 0.08 },
    { category: 'mental', key: 'teamwork', w: 0.06 }
  ],
  PF: [
    { category: 'technical', key: 'closeShot', w: 0.12 },
    { category: 'technical', key: 'finishing', w: 0.12 },
    { category: 'technical', key: 'interiorDefense', w: 0.10 },
    { category: 'technical', key: 'defRebound', w: 0.10 },
    { category: 'technical', key: 'offRebound', w: 0.08 },
    { category: 'technical', key: 'block', w: 0.06 },
    { category: 'technical', key: 'threePoint', w: 0.06 },
    { category: 'physical', key: 'strength', w: 0.12 },
    { category: 'physical', key: 'vertical', w: 0.06 },
    { category: 'mental', key: 'iq', w: 0.08 },
    { category: 'mental', key: 'workRate', w: 0.06 },
    { category: 'technical', key: 'screenSetting', w: 0.04 }
  ],
  C: [
    { category: 'technical', key: 'closeShot', w: 0.12 },
    { category: 'technical', key: 'finishing', w: 0.10 },
    { category: 'technical', key: 'interiorDefense', w: 0.12 },
    { category: 'technical', key: 'block', w: 0.10 },
    { category: 'technical', key: 'defRebound', w: 0.12 },
    { category: 'technical', key: 'offRebound', w: 0.08 },
    { category: 'technical', key: 'screenSetting', w: 0.06 },
    { category: 'physical', key: 'strength', w: 0.12 },
    { category: 'physical', key: 'vertical', w: 0.06 },
    { category: 'mental', key: 'iq', w: 0.06 },
    { category: 'mental', key: 'workRate', w: 0.06 }
  ]
}

const SKILL_LABELS: { category: Category; key: string; high: string; low: string }[] = [
  { category: 'technical', key: 'threePoint', high: 'Deep range', low: 'Cannot shoot threes' },
  { category: 'technical', key: 'midRange', high: 'Midrange touch', low: 'No midrange game' },
  { category: 'technical', key: 'closeShot', high: 'Touch around the rim', low: 'Misses easy finishes' },
  { category: 'technical', key: 'finishing', high: 'Finishes through contact', low: 'Struggles at the rim' },
  { category: 'technical', key: 'ballHandling', high: 'Can create off the dribble', low: 'Loose handle' },
  { category: 'technical', key: 'passingVision', high: 'Sees the floor', low: 'Tunnel vision' },
  { category: 'technical', key: 'passingAccuracy', high: 'Accurate passer', low: 'Erratic passer' },
  { category: 'technical', key: 'perimeterDefense', high: 'Guards the point of attack', low: 'Gets beaten off the dribble' },
  { category: 'technical', key: 'interiorDefense', high: 'Holds up inside', low: 'Soft in the paint' },
  { category: 'technical', key: 'block', high: 'Rim protection', low: 'No shot blocking' },
  { category: 'technical', key: 'steal', high: 'Active hands', low: 'Rarely creates turnovers' },
  { category: 'technical', key: 'defRebound', high: 'Cleans the glass', low: 'Does not rebound' },
  { category: 'technical', key: 'offRebound', high: 'Crashing the offensive glass', low: 'No second-jump effort' },
  { category: 'physical', key: 'speed', high: 'Elite speed', low: 'Slow in the open floor' },
  { category: 'physical', key: 'strength', high: 'Strong frame', low: 'Gets pushed around' },
  { category: 'physical', key: 'vertical', high: 'Explosive leaper', low: 'Below-the-rim athlete' },
  { category: 'mental', key: 'iq', high: 'High basketball IQ', low: 'Questionable decisions' },
  { category: 'mental', key: 'composure', high: 'Steady in big moments', low: 'Pressures himself' },
  { category: 'mental', key: 'workRate', high: 'Relentless motor', low: 'Motor comes and goes' }
]

function clamp(n: number, min = 25, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function readAttr(attrs: PlayerAttributes, category: Category, key: string): number {
  const bag = attrs[category] as unknown as Record<string, number>
  return bag[key] ?? 50
}

function writeAttr(attrs: PlayerAttributes, category: Category, key: string, value: number) {
  const bag = attrs[category] as unknown as Record<string, number>
  bag[key] = value
}

export function computeOverall(attrs: PlayerAttributes, position: Position): number {
  const weights = WEIGHTS[position]
  const total = weights.reduce((sum, weight) => sum + readAttr(attrs, weight.category, weight.key) * weight.w, 0)
  return clamp(total, 40, 99)
}

function blankAttributes(): PlayerAttributes {
  const technical = {} as TechnicalAttributes
  const physical = {} as PhysicalAttributes
  const mental = {} as MentalAttributes
  const techKeys: (keyof TechnicalAttributes)[] = [
    'closeShot', 'midRange', 'threePoint', 'freeThrow', 'finishing',
    'ballHandling', 'passingVision', 'passingAccuracy', 'screenSetting',
    'perimeterDefense', 'interiorDefense', 'helpDefense', 'steal', 'block',
    'offRebound', 'defRebound'
  ]
  const physKeys: (keyof PhysicalAttributes)[] = ['speed', 'acceleration', 'strength', 'agility', 'vertical', 'stamina']
  const mentKeys: (keyof MentalAttributes)[] = ['iq', 'composure', 'workRate', 'teamwork', 'leadership']
  for (const key of techKeys) technical[key] = 48
  for (const key of physKeys) physical[key] = 48
  for (const key of mentKeys) mental[key] = 50
  return { technical, physical, mental }
}

/** Positional shape before the overall nudge. Guards stay guards. Bigs stay bigs. */
function applyPositionPriors(attrs: PlayerAttributes, position: Position) {
  const t = attrs.technical
  const p = attrs.physical
  if (position === 'PG') {
    Object.assign(t, { ballHandling: 74, passingVision: 72, passingAccuracy: 70, threePoint: 64, perimeterDefense: 60, interiorDefense: 32, block: 24, offRebound: 28, defRebound: 38 })
    Object.assign(p, { speed: 76, acceleration: 78, agility: 74, strength: 40, vertical: 62 })
  } else if (position === 'SG') {
    Object.assign(t, { threePoint: 72, midRange: 68, ballHandling: 64, finishing: 62, perimeterDefense: 62, interiorDefense: 36, block: 28, defRebound: 42 })
    Object.assign(p, { speed: 72, acceleration: 72, agility: 70, strength: 48 })
  } else if (position === 'SF') {
    Object.assign(t, { threePoint: 64, midRange: 62, finishing: 66, perimeterDefense: 64, interiorDefense: 52, defRebound: 54, ballHandling: 58 })
    Object.assign(p, { speed: 68, acceleration: 68, agility: 66, strength: 60 })
  } else if (position === 'PF') {
    Object.assign(t, { closeShot: 70, finishing: 70, interiorDefense: 66, defRebound: 70, offRebound: 64, block: 58, threePoint: 42, ballHandling: 44, screenSetting: 62 })
    Object.assign(p, { speed: 58, strength: 76, vertical: 68, agility: 54 })
  } else {
    Object.assign(t, { closeShot: 74, finishing: 70, interiorDefense: 74, block: 72, defRebound: 78, offRebound: 70, screenSetting: 72, threePoint: 28, ballHandling: 34, perimeterDefense: 40 })
    Object.assign(p, { speed: 48, strength: 84, vertical: 64, agility: 44 })
  }
}

export function generateAttributes(position: Position, targetOverall: number): PlayerAttributes {
  const attrs = blankAttributes()
  applyPositionPriors(attrs, position)
  for (const weight of WEIGHTS[position]) {
    const current = readAttr(attrs, weight.category, weight.key)
    writeAttr(attrs, weight.category, weight.key, clamp(current + (Math.random() * 8 - 4)))
  }

  // Move only the skills that count for this position. A 90 point guard does not become a rim protector.
  const weights = WEIGHTS[position]
  const delta = targetOverall - computeOverall(attrs, position)
  for (const weight of weights) {
    const current = readAttr(attrs, weight.category, weight.key)
    writeAttr(attrs, weight.category, weight.key, clamp(current + delta))
  }

  let stuck = 0
  for (let i = 0; i < 500 && stuck < weights.length; i++) {
    const overall = computeOverall(attrs, position)
    if (Math.abs(overall - targetOverall) <= 1) break
    const direction = overall < targetOverall ? 1 : -1
    const weight = weights[i % weights.length]
    const current = readAttr(attrs, weight.category, weight.key)
    const next = clamp(current + direction)
    if (next === current) {
      stuck++
      continue
    }
    stuck = 0
    writeAttr(attrs, weight.category, weight.key, next)
  }
  return attrs
}

export function deriveTraits(attrs: PlayerAttributes, position: Position, personality?: PlayerPersonality): string[] {
  return assignBadges(attrs, position, personality)
}

export function scoutingNotes(attrs: PlayerAttributes): { strengths: string[]; weaknesses: string[] } {
  const ranked = SKILL_LABELS.map(skill => ({
    ...skill,
    value: readAttr(attrs, skill.category, skill.key)
  })).sort((a, b) => b.value - a.value)

  const strengths = ranked.filter(skill => skill.value >= 72).slice(0, 2).map(skill => skill.high)
  const weaknesses = [...ranked].reverse().filter(skill => skill.value <= 58).slice(0, 2).map(skill => skill.low)

  if (strengths.length === 0) strengths.push(ranked[0].high)
  if (weaknesses.length === 0) weaknesses.push(ranked[ranked.length - 1].low)
  return { strengths, weaknesses }
}

export type ProjectedRange = 'Top 3' | 'Lottery' | 'First Round' | 'Second Round'

export function rangeFromOverall(overall: number): ProjectedRange {
  if (overall >= 74) return 'Top 3'
  if (overall >= 70) return 'Lottery'
  if (overall >= 66) return 'First Round'
  return 'Second Round'
}

const RANGE_ORDER: ProjectedRange[] = ['Second Round', 'First Round', 'Lottery', 'Top 3']

/** Public draft range. Sometimes a bucket off until a scout actually watches him. */
export function noisyRange(overall: number): ProjectedRange {
  const exact = rangeFromOverall(overall)
  if (Math.random() > 0.28) return exact
  const index = RANGE_ORDER.indexOf(exact)
  const shifted = index + (Math.random() < 0.5 ? -1 : 1)
  return RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, shifted))]
}

function growTowardPotential(player: Player, steps: number) {
  const weights = WEIGHTS[player.position]
  for (let i = 0; i < steps; i++) {
    for (const weight of weights.slice(0, 4)) {
      const current = readAttr(player.attributes, weight.category, weight.key)
      writeAttr(player.attributes, weight.category, weight.key, clamp(current + 1))
    }
  }
}

function declineAthleticism(player: Player, steps: number) {
  const keys = ['speed', 'acceleration', 'agility', 'vertical']
  for (let i = 0; i < steps; i++) {
    for (const key of keys) {
      const current = readAttr(player.attributes, 'physical', key)
      writeAttr(player.attributes, 'physical', key, clamp(current - 1, 20, 99))
    }
  }
}

/** One offseason of aging. Returns the overall change. */
export function developPlayer(player: Player): number {
  const before = player.overallRating
  if (player.age <= 25 && player.overallRating + 1 < player.potential) {
    growTowardPotential(player, player.age <= 22 ? 2 : 1)
  }
  if (player.age >= 34) declineAthleticism(player, 2)
  else if (player.age >= 31) declineAthleticism(player, 1)

  player.overallRating = computeOverall(player.attributes, player.position)
  if (player.overallRating > player.potential) player.potential = player.overallRating
  player.traits = deriveTraits(player.attributes, player.position, player.personality)
  return player.overallRating - before
}
