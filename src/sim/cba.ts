import { NBA_RULES } from './rules'
import type { BirdRights, Player, SeasonPhase, Team } from './types'

export { CBA_CONSTANTS } from './rules'

export interface OfferVerdict {
  allowed: boolean
  exceptionUsed: string
  reason: string
  consumes: 'mle' | 'biAnnual' | null
  setsHardCap: number | null
}

export interface OfferDetails {
  salaries: number[]
  option: 'none' | 'player' | 'team' | 'non-guaranteed'
}

function deny(reason: string): OfferVerdict {
  return { allowed: false, exceptionUsed: 'None', reason, consumes: null, setsHardCap: null }
}

function allow(exceptionUsed: string, reason: string, consumes: OfferVerdict['consumes'] = null, setsHardCap: number | null = null): OfferVerdict {
  return { allowed: true, exceptionUsed, reason, consumes, setsHardCap }
}

export class CBASimulator {
  static activePayroll(team: Team): number {
    return team.roster.reduce((sum, player) => sum + (player.contract.salaries[0] || 0), 0)
  }

  static capHit(team: Team): number {
    return this.activePayroll(team) + (team.finances?.deadCap || 0)
  }

  static calculateTotalSalaries(team: Team): number {
    return this.capHit(team)
  }

  static freshExceptions() {
    return { mle: true, biAnnual: true }
  }

  static updateTeamFinances(team: Team): void {
    const deadCap = team.finances?.deadCap || 0
    const exceptions = team.finances?.exceptions || this.freshExceptions()
    const hardCap = team.finances?.hardCap ?? null
    team.finances = {
      salaryCap: NBA_RULES.SALARY_CAP,
      salariesTotal: this.activePayroll(team) + deadCap,
      luxuryTaxApron1: NBA_RULES.FIRST_APRON,
      luxuryTaxApron2: NBA_RULES.SECOND_APRON,
      deadCap,
      hardCap,
      exceptions
    }
  }

  static commitSigning(team: Team, verdict: OfferVerdict): void {
    if (!team.finances.exceptions) team.finances.exceptions = this.freshExceptions()
    if (verdict.consumes === 'mle') team.finances.exceptions.mle = false
    if (verdict.consumes === 'biAnnual') team.finances.exceptions.biAnnual = false
    if (verdict.setsHardCap != null) {
      team.finances.hardCap = team.finances.hardCap == null
        ? verdict.setsHardCap
        : Math.min(team.finances.hardCap, verdict.setsHardCap)
    }
    this.updateTeamFinances(team)
  }

  static evaluateFreeAgent(
    team: Team,
    firstYearSalary: number,
    contractYears: number,
    phase: SeasonPhase
  ): OfferVerdict {
    if (team.roster.length >= NBA_RULES.ROSTER_MAX) {
      return deny(`Roster is full (${NBA_RULES.ROSTER_MAX}). Waive someone first.`)
    }
    if (contractYears < 1 || contractYears > 4) {
      return deny('Contracts run from 1 to 4 years.')
    }
    if (firstYearSalary < NBA_RULES.MINIMUM_SALARY || firstYearSalary > NBA_RULES.MAX_SALARY) {
      return deny(`Salary must sit between the minimum and the max ($${NBA_RULES.MAX_SALARY.toLocaleString()}).`)
    }
    if (phase === 'regular' && (firstYearSalary > NBA_RULES.MINIMUM_SALARY || contractYears !== 1)) {
      return deny('During the season you can only offer a 1-year veteran minimum. Cap room and exceptions open in the offseason.')
    }

    const capHit = this.capHit(team)
    const projected = capHit + firstYearSalary
    const room = NBA_RULES.SALARY_CAP - capHit
    const hardCap = team.finances.hardCap
    const exceptions = team.finances.exceptions || this.freshExceptions()

    if (hardCap != null && projected > hardCap) {
      return deny(`This signing would cross your hard cap of $${hardCap.toLocaleString()}. That hard cap came from using the full mid-level or the bi-annual.`)
    }

    if (firstYearSalary <= NBA_RULES.MINIMUM_SALARY) {
      return allow(
        'Minimum Exception',
        'Veteran minimums can be signed even when a team is over the cap or the aprons.'
      )
    }

    if (firstYearSalary <= room) {
      return allow('Cap Space', `Fits in $${Math.max(0, room).toLocaleString()} of cap room.`)
    }

    const underFirst = projected <= NBA_RULES.FIRST_APRON
    const underSecond = projected <= NBA_RULES.SECOND_APRON

    if (exceptions.mle && firstYearSalary <= NBA_RULES.MLE && underFirst) {
      return allow(
        'Non-Taxpayer MLE',
        `Uses the mid-level ($${NBA_RULES.MLE.toLocaleString()}) and hard-caps the team at the first apron.`,
        'mle',
        NBA_RULES.FIRST_APRON
      )
    }

    if (exceptions.mle && firstYearSalary <= NBA_RULES.TAXPAYER_MLE && underSecond) {
      return allow(
        'Taxpayer MLE',
        `Uses the taxpayer mid-level ($${NBA_RULES.TAXPAYER_MLE.toLocaleString()}). The team must stay under the second apron.` ,
        'mle',
        null
      )
    }

    if (exceptions.biAnnual && capHit <= NBA_RULES.FIRST_APRON && firstYearSalary <= NBA_RULES.BAE && underFirst) {
      return allow(
        'Bi-Annual Exception',
        `Uses the bi-annual ($${NBA_RULES.BAE.toLocaleString()}) and hard-caps the team at the first apron.`,
        'biAnnual',
        NBA_RULES.FIRST_APRON
      )
    }

    if (!underSecond) {
      return deny(`That salary would push the books to $${projected.toLocaleString()}, past the second apron. Only a minimum is legal from here.`)
    }
    if (!exceptions.mle && !exceptions.biAnnual) {
      return deny('Cap room is gone, and both the mid-level and the bi-annual have already been used.')
    }
    return deny(`$${firstYearSalary.toLocaleString()} does not fit in cap room or an unused exception.`)
  }

  static extensionCeiling(player: Player): { max: number; name: string; reason: string } {
    const previous = player.contract.salaries[0] || NBA_RULES.MINIMUM_SALARY
    if (player.contract.birdRights === 'full-bird') {
      return {
        max: NBA_RULES.MAX_SALARY,
        name: 'Full Bird Rights',
        reason: 'Full Bird lets you re-sign him up to the max without cap room.'
      }
    }
    if (player.contract.birdRights === 'early-bird') {
      const max = Math.round(Math.max(previous * 1.75, NBA_RULES.SALARY_CAP * 0.25))
      return {
        max,
        name: 'Early Bird Rights',
        reason: `Early Bird caps the first year at $${max.toLocaleString()} (175% of his salary, or 25% of the cap).`
      }
    }
    if (player.contract.birdRights === 'non-bird') {
      const max = Math.round(previous * 1.2)
      return {
        max,
        name: 'Non-Bird Rights',
        reason: `Non-Bird caps the raise at 20%, so $${max.toLocaleString()}.`
      }
    }
    return {
      max: 0,
      name: 'None',
      reason: 'He has no Bird rights. He has to reach free agency.'
    }
  }

  static evaluateExtension(team: Team, player: Player, firstYearSalary: number, contractYears: number): OfferVerdict {
    if (!team.roster.some(p => p.id === player.id)) {
      return deny('That player is not on the roster.')
    }
    if (player.contract.salaries.length !== 1) {
      return deny('Extensions are only open in the final year of the contract. The new money starts next season.')
    }
    if (contractYears < 1 || contractYears > 4) {
      return deny('Extensions run from 1 to 4 new years.')
    }
    const ceiling = this.extensionCeiling(player)
    if (ceiling.max <= 0) return deny(ceiling.reason)
    if (firstYearSalary < NBA_RULES.MINIMUM_SALARY) {
      return deny('The offer is below the minimum salary.')
    }
    if (firstYearSalary > ceiling.max) {
      return deny(`${ceiling.reason} This offer is over that.`)
    }
    return allow(ceiling.name, `${ceiling.reason} This year's cap hit does not change.`)
  }

  static applyExtension(team: Team, player: Player, firstYearSalary: number, contractYears: number): OfferVerdict {
    const verdict = this.evaluateExtension(team, player, firstYearSalary, contractYears)
    if (!verdict.allowed) return verdict
    const current = player.contract.salaries[0] || NBA_RULES.MINIMUM_SALARY
    const hasBird = player.contract.birdRights !== 'none'
    player.contract.salaries = [current, ...this.generateContractSalaries(firstYearSalary, contractYears, hasBird)]
    player.contract.option = 'none'
    this.updateTeamFinances(team)
    return verdict
  }

  static previewWaive(team: Team, player: Player): OfferVerdict {
    if (!team.roster.some(p => p.id === player.id)) return deny('That player is not on the roster.')
    if (team.roster.length <= NBA_RULES.ROSTER_MIN) {
      return deny(`Rosters cannot drop below ${NBA_RULES.ROSTER_MIN}. Sign a replacement before waiving anyone else.`)
    }
    const hit = player.contract.salaries[0] || 0
    return allow(
      'Waiver',
      `Waiving ${player.name} keeps $${hit.toLocaleString()} on the books this season as dead cap. Later years are wiped.`
    )
  }

  static getPlayerSalaryDemand(player: Player, leagueStanding: { isContender: boolean }): number {
    const overall = player.overallRating
    const age = player.age
    const ego = player.personality.ego
    const greed = player.personality.greed

    let baseSalary = NBA_RULES.MINIMUM_SALARY
    if (overall >= 90) {
      baseSalary = 35_000_000 + (overall - 90) * 1_500_000
    } else if (overall >= 80) {
      baseSalary = 15_000_000 + (overall - 80) * 2_000_000
    } else if (overall >= 70) {
      baseSalary = 4_000_000 + (overall - 70) * 1_100_000
    } else if (overall >= 60) {
      baseSalary = 1_500_000 + (overall - 60) * 250_000
    }

    if (age > 33) baseSalary *= (1 - (age - 33) * 0.07)
    else if (age < 23) baseSalary *= 0.85

    let multiplier = 1
    multiplier += (greed - 50) * 0.005
    multiplier += (ego - 50) * 0.003
    let demand = Math.round(baseSalary * multiplier)

    const agent = player.contract?.agentType || 'reasonable'
    if (agent === 'hardball') demand = Math.round(demand * 1.15)
    else if (agent === 'ring-chaser' && leagueStanding.isContender) demand = Math.round(demand * 0.65)
    else if (agent === 'team-first') demand = Math.round(demand * 0.9)

    return Math.max(NBA_RULES.MINIMUM_SALARY, Math.min(NBA_RULES.MAX_SALARY, demand))
  }

  static generateContractSalaries(firstYearSalary: number, years: number, hasBirdRights: boolean): number[] {
    const raises = hasBirdRights ? 0.08 : 0.05
    const salaries: number[] = []
    let current = firstYearSalary
    for (let i = 0; i < years; i++) {
      salaries.push(Math.round(current))
      current *= (1 + raises)
    }
    return salaries
  }

  static scaleContracts(players: Player[], targetCapHit: number): void {
    for (let pass = 0; pass < 4; pass++) {
      const raw = players.reduce((sum, player) => sum + (player.contract.salaries[0] || 0), 0)
      if (raw <= 0) return
      const factor = targetCapHit / raw
      if (Math.abs(factor - 1) < 0.02) return
      for (const player of players) {
        player.contract.salaries = player.contract.salaries.map(salary => (
          Math.max(NBA_RULES.MINIMUM_SALARY, Math.min(NBA_RULES.MAX_SALARY, Math.round(salary * factor)))
        ))
      }
    }
  }
}

export function birdFromYears(yearsServed: number): BirdRights {
  if (yearsServed >= 3) return 'full-bird'
  if (yearsServed === 2) return 'early-bird'
  if (yearsServed === 1) return 'non-bird'
  return 'none'
}

export default CBASimulator
