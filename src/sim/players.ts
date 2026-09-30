import { birdFromYears, CBASimulator } from './cba'
import { uniqueName } from './names'
import { computeOverall, deriveTraits, generateAttributes, noisyRange, scoutingNotes } from './ratings'
import { NBA_RULES } from './rules'
import type { DraftProspect, Player, PlayerContract, Position } from './types'

const AGENTS: PlayerContract['agentType'][] = ['hardball', 'reasonable', 'ring-chaser', 'team-first']

function potentialFor(overall: number, age: number): number {
  if (age <= 22) return Math.min(95, overall + 4 + Math.floor(Math.random() * 10))
  if (age <= 25) return Math.min(93, overall + Math.floor(Math.random() * 6))
  if (age <= 29) return Math.min(92, overall + Math.floor(Math.random() * 3))
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
    usageExpectation: overallRating >= 86 ? 28 : overallRating >= 78 ? 22 : overallRating >= 72 ? 16 : 12
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
    traits
  }
}

export function rookieFirstYear(overallPick: number): number {
  if (overallPick <= 12) {
    const t = (overallPick - 1) / 11
    return Math.round((12_000_000 + (3_200_000 - 12_000_000) * t) / 10_000) * 10_000
  }
  const t = Math.min(1, (overallPick - 13) / 11)
  return Math.round((2_200_000 + (NBA_RULES.MINIMUM_SALARY - 2_200_000) * t) / 10_000) * 10_000
}

export function playerFromProspect(prospect: DraftProspect, overallPick: number | null): Player {
  const attributes = prospect.hiddenAttributes ?? generateAttributes(prospect.position, prospect.overallRating)
  const overallRating = computeOverall(attributes, prospect.position)
  const years = overallPick != null && overallPick <= 12 ? 3 : overallPick != null ? 2 : 1
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
    traits: deriveTraits(attributes, prospect.position, personality)
  }
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
  const potentialRating = Math.min(95, overallRating + upside)
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
