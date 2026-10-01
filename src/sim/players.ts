import { birdFromYears, CBASimulator } from './cba'
import { uniqueName } from './names'
import { computeOverall, deriveTraits, generateAttributes, noisyRange, scoutingNotes } from './ratings'
import { NBA_RULES } from './rules'
import type { DraftProspect, Injury, Player, PlayerContract, Position } from './types'

const AGENTS: PlayerContract['agentType'][] = ['hardball', 'reasonable', 'ring-chaser', 'team-first']

function potentialFor(overall: number, age: number): number {
  if (age <= 22) return Math.min(99, overall + 4 + Math.floor(Math.random() * 8))
  if (age <= 25) return Math.min(99, overall + Math.floor(Math.random() * 5))
  if (age <= 29) return Math.min(99, overall + Math.floor(Math.random() * 2))
  return overall
}

function rollTenure(age: number, yearsLeft: number): number {
  if (age < 23) return Math.random() < 0.75 ? 0 : 1
  if (yearsLeft >= 3) return Math.random() < 0.6 ? 0 : 1
  if (yearsLeft === 1) return 2 + Math.floor(Math.random() * 5)
  return 1 + Math.floor(Math.random() * 3)
}

export function createPlayer(options: {
  position: Position
  targetOverall: number
  age: number
  years?: number
  name?: string
  usedNames?: Set<string>
}): Player {
  const position = options.position
  const attributes = generateAttributes(position, options.targetOverall)
  const overallRating = computeOverall(attributes, position)
  const age = options.age
  const years = options.years ?? (1 + Math.floor(Math.random() * 4))
  const agentType = AGENTS[Math.floor(Math.random() * AGENTS.length)]
  const yearsServed = rollTenure(age, years)
  const personality = {
    ego: Math.round(30 + Math.random() * 60),
    loyalty: Math.round(25 + Math.random() * 65),
    greed: Math.round(30 + Math.random() * 60),
    morale: 80,
    chemistry: 75,
    usageExpectation: overallRating >= 96 ? 36 : overallRating >= 90 ? 31 : overallRating >= 84 ? 24 : overallRating >= 78 ? 18 : overallRating >= 72 ? 14 : 10
  }

  const traits = deriveTraits(attributes, position, personality)
  const demand = CBASimulator.getPlayerSalaryDemand({
    age,
    overallRating,
    personality,
    traits,
    contract: { agentType }
  } as Player, { isContender: false })

  const optionRoll = Math.random()
  const option: PlayerContract['option'] = years >= 3
    ? (optionRoll < 0.25 ? 'player' : optionRoll < 0.45 ? 'team' : 'none')
    : 'none'

  const name = options.name ?? (options.usedNames ? uniqueName(options.usedNames) : 'Camp Player')

  return {
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    name,
    age,
    position,
    attributes,
    personality,
    contract: {
      salaries: CBASimulator.generateContractSalaries(demand, years, yearsServed >= 1),
      option,
      yearsServed,
      birdRights: birdFromYears(yearsServed),
      agentType
    },
    injury: null,
    fatigue: 0,
    morale: 75 + Math.floor(Math.random() * 15),
    overallRating,
    potential: potentialFor(overallRating, age),
    careerStats: {},
    traits,
    experience: Math.max(0, age - 19)
  }
}

export function rookieFirstYear(overallPick: number): number {
  if (overallPick <= 30) {
    const t = (overallPick - 1) / 29
    return Math.round((12_400_000 + (2_400_000 - 12_400_000) * t) / 10_000) * 10_000
  }
  return NBA_RULES.MINIMUM_SALARY
}

export function playerFromProspect(prospect: DraftProspect, overallPick: number | null): Player {
  const attributes = prospect.hiddenAttributes ?? generateAttributes(prospect.position, prospect.overallRating)
  const overallRating = computeOverall(attributes, prospect.position)
  const years = overallPick == null ? 1 : overallPick <= 30 ? 3 : 2
  const salary = overallPick == null ? NBA_RULES.MINIMUM_SALARY : rookieFirstYear(overallPick)

  const personality = {
    ego: 30 + Math.floor(Math.random() * 40),
    loyalty: 50 + Math.floor(Math.random() * 40),
    greed: 20 + Math.floor(Math.random() * 40),
    morale: 90,
    chemistry: 80,
    usageExpectation: 12
  }

  return {
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    name: prospect.name,
    age: prospect.age,
    position: prospect.position,
    attributes,
    personality,
    contract: {
      salaries: CBASimulator.generateContractSalaries(salary, years, true),
      option: years >= 3 ? 'team' : 'none',
      yearsServed: 0,
      birdRights: 'none',
      agentType: 'reasonable'
    },
    injury: null,
    fatigue: 0,
    morale: 90,
    overallRating,
    potential: prospect.potentialRating,
    careerStats: {},
    traits: deriveTraits(attributes, prospect.position, personality),
    experience: 0
  }
}

const HOMETOWNS = ['Chicago', 'Lagos', 'Manila', 'Belgrade', 'Oakland', 'San Juan', 'Melbourne', 'Athens', 'Dakar', 'Halifax', 'Seoul', 'Lyon', 'Accra', 'Split', 'Detroit']

export function playerOrigin(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 33 + name.charCodeAt(i)) >>> 0
  return HOMETOWNS[hash % HOMETOWNS.length]
}

const STORY: { id: string; line: string }[] = [
  { id: 'diva', line: 'he wants the ball' },
  { id: 'leader', line: 'he holds the room' },
  { id: 'sharpshooter', line: 'he lives on the three' },
  { id: 'pick_pocket', line: 'he gambles for steals' },
  { id: 'post_beast', line: 'he lives in the post' },
  { id: 'rim_protector', line: 'he protects the rim' }
]

/** One line for the roster panel. The same name always comes from the same place. */
export function playerStory(player: Player): string {
  const place = playerOrigin(player.name)
  const year = player.experience <= 0 ? 'a rookie' : `in year ${player.experience + 1}`
  const note = STORY.find(item => player.traits.includes(item.id))?.line
  return note
    ? `${player.name} is from ${place}, ${year}, and ${note}.`
    : `${player.name} is from ${place}, ${year} in the league.`
}

const COLLEGES = [
  'Duke', 'Kentucky', 'Kansas', 'North Carolina', 'UCLA', 'Gonzaga', 'Arizona',
  'Michigan State', 'Connecticut', 'Indiana', 'Villanova', 'Texas', 'Houston',
  'Baylor', 'Oregon', 'Florida', 'Tennessee', 'Arkansas', 'Ohio State', 'LSU'
]

export function createProspect(position: Position, targetOverall: number, usedNames: Set<string>): DraftProspect {
  const attributes = generateAttributes(position, targetOverall)
  const overallRating = computeOverall(attributes, position)
  const age = 18 + Math.floor(Math.random() * 3)
  const upside = 8 + Math.floor(Math.random() * 12)
  const potentialRating = Math.min(99, overallRating + upside)
  const notes = scoutingNotes(attributes)

  return {
    id: 'prospect_' + Math.random().toString(36).slice(2, 10),
    name: uniqueName(usedNames),
    age,
    position,
    school: COLLEGES[Math.floor(Math.random() * COLLEGES.length)],
    projectedRange: noisyRange(overallRating),
    overallRating,
    potentialRating,
    scouted: false,
    strengths: notes.strengths,
    weaknesses: notes.weaknesses,
    hiddenAttributes: attributes
  }
}

const HURTS: { description: string; days: number; weight: number }[] = [
  { description: 'Rolled ankle', days: 3, weight: 4 },
  { description: 'Sore knee', days: 4, weight: 3 },
  { description: 'Back spasm', days: 5, weight: 2 },
  { description: 'Sprained ankle', days: 10, weight: 2 },
  { description: 'Hamstring', days: 18, weight: 1 }
]

/** A night under 18 minutes is too short to get hurt. A player already out stays out. */
export function hurtPlayer(player: Player, minutes: number, chanceRoll = Math.random(), kindRoll = Math.random()): Injury | null {
  if (minutes < 18 || (player.injury && player.injury.daysRemaining > 0)) return null
  const chance = player.fatigue > 75 ? 0.02 : 0.012
  if (chanceRoll >= chance) return null
  const total = HURTS.reduce((sum, hurt) => sum + hurt.weight, 0)
  let ticket = kindRoll * total
  let pick = HURTS[0]
  for (const hurt of HURTS) {
    ticket -= hurt.weight
    if (ticket <= 0) {
      pick = hurt
      break
    }
  }
  player.injury = { description: pick.description, daysRemaining: pick.days }
  return player.injury
}

export function healPlayer(player: Player, days: number) {
  if (!player.injury || days <= 0) return
  player.injury.daysRemaining -= days
  if (player.injury.daysRemaining <= 0) player.injury = null
}
