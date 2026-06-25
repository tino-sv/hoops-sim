import type { Team, Player, PlayerContract, OptionType, BirdRights } from './types';

export const CBA_CONSTANTS = {
  SALARY_CAP: 140600000,
  LUXURY_TAX: 170814000,
  FIRST_APRON: 178132000,
  SECOND_APRON: 188910000,
  ROOKIE_SCALE_BASE: 4000000,
  MINIMUM_SALARY: 1150000
};

export interface OfferDetails {
  salaries: number[]; // e.g. [15000000, 15750000, 16537500] (8% raises for Bird, 5% for non-Bird)
  option: OptionType;
}

export class CBASimulator {
  // Calculate total salary for a team
  static calculateTotalSalaries(team: Team): number {
    return team.roster.reduce((sum, player) => {
      const currentSalary = player.contract.salaries[0] || 0;
      return sum + currentSalary;
    }, 0);
  }

  // Update team financial statuses
  static updateTeamFinances(team: Team): void {
    const total = this.calculateTotalSalaries(team);
    team.finances = {
      salaryCap: CBA_CONSTANTS.SALARY_CAP,
      salariesTotal: total,
      luxuryTaxApron1: CBA_CONSTANTS.FIRST_APRON,
      luxuryTaxApron2: CBA_CONSTANTS.SECOND_APRON
    };
  }

  // Check if team can sign a player to a specific first-year salary
  static evaluateSignOffer(
    team: Team,
    player: Player,
    firstYearSalary: number,
    contractYears: number
  ): { allowed: boolean; exceptionUsed: string; reason: string } {
    this.updateTeamFinances(team);
    const totalSalaries = team.finances.salariesTotal;
    const projectedTotal = totalSalaries + firstYearSalary;

    // Minimum Contract is always allowed
    if (firstYearSalary <= CBA_CONSTANTS.MINIMUM_SALARY) {
      return { allowed: true, exceptionUsed: 'Minimum Contract Exception', reason: 'Minimum contracts can always be signed.' };
    }

    // Check Bird Rights
    const bird = player.contract.birdRights;
    const isCurrentTeam = team.roster.some(p => p.id === player.id);

    if (isCurrentTeam) {
      if (bird === 'full-bird') {
        // Can sign up to max contract regardless of cap (even above second apron)
        return { allowed: true, exceptionUsed: 'Full Bird Rights', reason: 'Full Bird Rights allow re-signing up to maximum contract.' };
      } else if (bird === 'early-bird') {
        const prevSalary = player.contract.salaries[0] || CBA_CONSTANTS.MINIMUM_SALARY;
        const maxEarlyBird = Math.max(prevSalary * 1.75, CBA_CONSTANTS.SALARY_CAP * 0.25);
        if (firstYearSalary <= maxEarlyBird) {
          return { allowed: true, exceptionUsed: 'Early Bird Rights', reason: `Allowed under Early Bird up to $${Math.round(maxEarlyBird).toLocaleString()}.` };
        }
      } else if (bird === 'non-bird') {
        const prevSalary = player.contract.salaries[0] || CBA_CONSTANTS.MINIMUM_SALARY;
        const maxNonBird = prevSalary * 1.20;
        if (firstYearSalary <= maxNonBird) {
          return { allowed: true, exceptionUsed: 'Non-Bird Rights', reason: `Allowed under Non-Bird up to $${Math.round(maxNonBird).toLocaleString()}.` };
        }
      }
    }

    // Cap Space checks
    const capSpace = CBA_CONSTANTS.SALARY_CAP - totalSalaries;
    if (firstYearSalary <= capSpace) {
      return { allowed: true, exceptionUsed: 'Cap Space', reason: `Fits within remaining Cap Space of $${capSpace.toLocaleString()}.` };
    }

    // Exception Checks
    if (projectedTotal < CBA_CONSTANTS.SECOND_APRON) {
      // Mid-Level Exception Check
      const hasFirstApronRisk = projectedTotal > CBA_CONSTANTS.FIRST_APRON;
      const maxMLE = hasFirstApronRisk ? 5000000 : 12800000; // Taxpayer vs Non-Taxpayer MLE
      
      if (firstYearSalary <= maxMLE) {
        return { 
          allowed: true, 
          exceptionUsed: hasFirstApronRisk ? 'Taxpayer MLE' : 'Non-Taxpayer MLE', 
          reason: `Fits inside MLE ($${maxMLE.toLocaleString()}) since team is below Second Apron.` 
        };
      }

      // Bi-Annual Exception Check
      if (!hasFirstApronRisk && firstYearSalary <= 4700000) {
        return { allowed: true, exceptionUsed: 'Bi-Annual Exception', reason: 'Fits inside Bi-Annual Exception ($4.7M) and below First Apron.' };
      }
    }

    // Hard Capped checks (if they crossed Second Apron or used non-taxpayer MLE)
    if (projectedTotal > CBA_CONSTANTS.SECOND_APRON) {
      return { allowed: false, exceptionUsed: 'None', reason: `Rejected: Projecting salaries to $${projectedTotal.toLocaleString()} crosses the Second Apron ($${CBA_CONSTANTS.SECOND_APRON.toLocaleString()}) without valid Bird Rights.` };
    }

    return { allowed: false, exceptionUsed: 'None', reason: `Insufficient Cap Space and no exceptions applicable for $${firstYearSalary.toLocaleString()}.` };
  }

  // Calculate Player Demand
  static getPlayerSalaryDemand(player: Player, leagueStanding: { isContender: boolean }): number {
    const overall = player.overallRating;
    const age = player.age;
    const ego = player.personality.ego;
    const greed = player.personality.greed;
    const loyalty = player.personality.loyalty;

    // Base formula based on overall rating
    // Rating 90+: $35M - $50M (Max)
    // Rating 80-89: $18M - $35M
    // Rating 70-79: $5M - $18M
    // Rating <70: $1.15M - $5M
    let baseSalary = CBA_CONSTANTS.MINIMUM_SALARY;
    if (overall >= 90) {
      baseSalary = 35000000 + (overall - 90) * 1500000;
    } else if (overall >= 80) {
      baseSalary = 15000000 + (overall - 80) * 2000000;
    } else if (overall >= 70) {
      baseSalary = 4000000 + (overall - 70) * 1100000;
    } else if (overall >= 60) {
      baseSalary = 1500000 + (overall - 60) * 250000;
    }

    // Age modifications (veteran value vs regression/development)
    if (age > 33) {
      // Decline demand for aging players unless ego is huge
      baseSalary *= (1 - (age - 33) * 0.07);
    } else if (age < 23) {
      // Rookie scales are locked or lower
      baseSalary *= 0.85;
    }

    // Personality Multipliers
    let multiplier = 1.0;
    multiplier += (greed - 50) * 0.005; // greed increases demand up to +25%
    multiplier += (ego - 50) * 0.003;  // ego increases demand up to +15%
    
    let demand = Math.round(baseSalary * multiplier);

    // Agent adjustments
    const agent = player.contract?.agentType || 'reasonable';
    if (agent === 'hardball') {
      demand = Math.round(demand * 1.15);
    } else if (agent === 'ring-chaser' && leagueStanding.isContender) {
      demand = Math.round(demand * 0.65); // takes massive discount for rings
    } else if (agent === 'team-first') {
      demand = Math.round(demand * 0.9);
    }

    // Clamp between minimum salary and absolute supermax ($60M)
    return Math.max(CBA_CONSTANTS.MINIMUM_SALARY, Math.min(60000000, demand));
  }

  // Helper to generate salaries over multi-year contract with proper raises
  static generateContractSalaries(firstYearSalary: number, years: number, hasBirdRights: boolean): number[] {
    const raises = hasBirdRights ? 0.08 : 0.05; // 8% raises for Bird Rights, 5% otherwise
    const salaries: number[] = [];
    let current = firstYearSalary;

    for (let i = 0; i < years; i++) {
      salaries.push(Math.round(current));
      current *= (1 + raises);
    }
    return salaries;
  }
}
export default CBASimulator;
