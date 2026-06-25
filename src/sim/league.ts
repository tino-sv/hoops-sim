import type { Player, Team, Position, PlayerContract, TeamTactics, BoxScoreStats, TechnicalAttributes, PhysicalAttributes, MentalAttributes, BirdRights, DraftProspect } from './types';
import { MatchEngine } from './matchEngine';
import { CBASimulator, CBA_CONSTANTS } from './cba';

const FIRST_NAMES = [
  // NBA-inspired first names
  "Stephen", "LeBron", "Kevin", "Luka", "Nikola", "Joel", "Giannis", "Jayson", "Devin", "Anthony",
  "Jimmy", "Damian", "Kyrie", "Shai", "Trae", "De'Aaron", "Donovan", "Jaylen", "Tyrese", "Bam",
  "Chet", "Victor", "Paolo", "LaMelo", "Rudy", "Cade", "Myles", "Jrue", "Kristaps", "Mikal",
  "Darius", "Pascal", "DeMar", "Domantas", "Derrick", "Austin", "Alex", "Marcus", "Klay", "Draymond",
  // Additional diverse names
  "Jordan", "Isaiah", "Brandon", "Cameron", "Malik", "Jalen", "Dillon", "Tre", "Miles", "Killian",
  "Scottie", "Franz", "Alperen", "Keyonte", "Gradey", "Bilal", "Kelly", "Caris", "Luguentz", "Matisse",
  "Xavier", "Nassir", "Ochai", "Terrence", "Precious", "Saddiq", "Immanuel", "Jaden", "Onyeka", "Moses",
  "Kendall", "Deni", "Aleksej", "Danilo", "Bojan", "Nikola", "Ricky", "Serge", "Bismack", "Clint",
  "Dwight", "Andre", "Paul", "Chris", "Deandre", "Naz", "Gary", "Donte", "Shake", "Cole",
  "Terance", "Charlie", "Justin", "Caleb", "Dyson", "Keyshawn", "Davion", "Scoot", "Ausar", "Amen"
];

const LAST_NAMES = [
  // NBA-inspired last names
  "Curry", "James", "Durant", "Doncic", "Jokic", "Embiid", "Antetokounmpo", "Tatum", "Booker", "Davis",
  "Butler", "Lillard", "Irving", "Gilgeous-Alexander", "Young", "Fox", "Mitchell", "Brown", "Haliburton", "Adebayo",
  "Holmgren", "Wembanyama", "Banchero", "Ball", "Gobert", "Cunningham", "Turner", "Holiday", "Porzingis", "Bridges",
  "Garland", "Siakam", "DeRozan", "Sabonis", "White", "Reaves", "Caruso", "Smart", "Thompson", "Green",
  // Additional diverse surnames
  "Williams", "Johnson", "Jackson", "Robinson", "Walker", "Harris", "Martin", "Thomas", "Anderson", "Taylor",
  "Moore", "Wilson", "Clark", "Lewis", "Lee", "Hall", "Allen", "Young", "Hernandez", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Rivera", "Campbell", "Mitchell", "Carter",
  "Roberts", "Gonzalez", "Nelson", "Baker", "Adams", "Reed", "Parker", "Evans", "Edwards", "Collins",
  "Stewart", "Sanchez", "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey",
  "Cooper", "Richardson", "Cox", "Howard", "Ward", "Torres", "Peterson", "Gray", "Ramirez", "James"
];

const TEAM_TEMPLATES = [
  { city: "Boston", name: "Shamrocks", color: "#008348" },
  { city: "Los Angeles", name: "Breakers", color: "#552583" },
  { city: "Chicago", name: "Wind", color: "#CE1141" },
  { city: "Miami", name: "Heatwave", color: "#98002E" },
  { city: "Golden State", name: "Waves", color: "#1D428A" },
  { city: "New York", name: "Skyscrapers", color: "#F58426" },
  { city: "Dallas", name: "Stallions", color: "#00538C" },
  { city: "Toronto", name: "Dinos", color: "#E31837" },
  { city: "Philadelphia", name: "Phantoms", color: "#006BB6" },
  { city: "Phoenix", name: "Flares", color: "#E56020" },
  { city: "Denver", name: "Peaks", color: "#0E2240" },
  { city: "Seattle", name: "Jetstreams", color: "#006241" }
];

export interface ScheduledMatch {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  simulated: boolean;
  scoreHome?: number;
  scoreAway?: number;
  winnerId?: string;
  playByPlaySummary?: string;
}

export class LeagueManager {
  teams: Team[] = [];
  schedule: ScheduledMatch[] = [];
  currentRound = 1;
  totalRounds = 44; // 12 teams, round robin * 4
  season = 2026;
  matchEngine = new MatchEngine();
  freeAgents: Player[] = [];
  draftProspects: DraftProspect[] = [];
  scoutingTokens = 5;

  constructor() {
    if (!this.loadFromLocalStorage()) {
      this.initializeLeague();
    }
  }

  saveToLocalStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = {
        teams: this.teams,
        schedule: this.schedule,
        currentRound: this.currentRound,
        season: this.season,
        freeAgents: this.freeAgents,
        draftProspects: this.draftProspects,
        scoutingTokens: this.scoutingTokens
      };
      window.localStorage.setItem('hoops_sim_league_data', JSON.stringify(data));
    }
  }

  loadFromLocalStorage(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('hoops_sim_league_data');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.teams = data.teams;
          this.schedule = data.schedule;
          this.currentRound = data.currentRound;
          this.season = data.season;
          this.freeAgents = data.freeAgents || [];
          this.draftProspects = data.draftProspects || [];
          this.scoutingTokens = data.scoutingTokens !== undefined ? data.scoutingTokens : 5;

          // Migration: backfill pools if old save has undersized data
          if (this.freeAgents.length < 20) {
            this.generateFreeAgents();
          }
          if (this.draftProspects.length < 15) {
            this.generateDraftProspects();
          }

          return true;
        } catch (e) {
          console.error("Error loading league data from localStorage:", e);
        }
      }
    }
    return false;
  }

  clearLocalStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('hoops_sim_league_data');
    }
  }

  // Generate random name
  private generateRandomName(): string {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${f} ${l}`;
  }

  // Generate a player with realistic attributes based on position & rating tier
  generatePlayer(position: Position, tier: 'superstar' | 'starter' | 'role' | 'bench'): Player {
    const name = this.generateRandomName();
    const id = 'p_' + Math.random().toString(36).substr(2, 9);

    // Determine age and overall range
    let age = 19 + Math.floor(Math.random() * 17); // 19 to 35
    let targetOverall = 65;

    if (tier === 'superstar') {
      targetOverall = 86 + Math.floor(Math.random() * 10); // 86-95
      age = 22 + Math.floor(Math.random() * 10); // prime age
    } else if (tier === 'starter') {
      targetOverall = 78 + Math.floor(Math.random() * 8); // 78-85
    } else if (tier === 'role') {
      targetOverall = 72 + Math.floor(Math.random() * 6); // 72-77
    } else {
      targetOverall = 60 + Math.floor(Math.random() * 11); // 60-70
    }

    // Set base attributes tailored by position
    const tech: TechnicalAttributes = {
      closeShot: 50, midRange: 50, threePoint: 50, freeThrow: 50, finishing: 50,
      ballHandling: 50, passingVision: 50, passingAccuracy: 50, screenSetting: 50,
      perimeterDefense: 50, interiorDefense: 50, helpDefense: 50, steal: 50, block: 50,
      offRebound: 50, defRebound: 50
    };

    const phys: PhysicalAttributes = {
      speed: 50, acceleration: 50, strength: 50, agility: 50, vertical: 50, stamina: 50
    };

    const ment: MentalAttributes = {
      iq: 50, composure: 50, workRate: 50, teamwork: 50, leadership: 50
    };

    // Position modifications
    if (position === 'PG') {
      tech.ballHandling = 75; tech.passingVision = 70; tech.passingAccuracy = 72;
      tech.threePoint = 65; tech.perimeterDefense = 60;
      tech.interiorDefense = 25; tech.block = 20; tech.offRebound = 25; tech.defRebound = 35;
      phys.speed = 75; phys.acceleration = 78; phys.agility = 75; phys.strength = 35;
    } else if (position === 'SG') {
      tech.threePoint = 72; tech.midRange = 70; tech.ballHandling = 65;
      tech.perimeterDefense = 62; tech.finishing = 60;
      tech.interiorDefense = 30; tech.block = 25; tech.offRebound = 28; tech.defRebound = 40;
      phys.speed = 72; phys.acceleration = 72; phys.agility = 70; phys.strength = 45;
    } else if (position === 'SF') {
      tech.threePoint = 64; tech.midRange = 62; tech.finishing = 68;
      tech.perimeterDefense = 65; tech.interiorDefense = 50; tech.defRebound = 52;
      phys.speed = 68; phys.acceleration = 68; phys.agility = 68; phys.strength = 58;
    } else if (position === 'PF') {
      tech.closeShot = 70; tech.finishing = 70; tech.interiorDefense = 65;
      tech.defRebound = 70; tech.offRebound = 65; tech.block = 55;
      tech.threePoint = 45; tech.ballHandling = 42;
      phys.speed = 58; phys.strength = 75; phys.vertical = 65; phys.agility = 55;
    } else if (position === 'C') {
      tech.closeShot = 76; tech.finishing = 72; tech.interiorDefense = 75;
      tech.block = 72; tech.defRebound = 78; tech.offRebound = 72; tech.screenSetting = 70;
      tech.threePoint = 20; tech.ballHandling = 30; tech.perimeterDefense = 35;
      phys.speed = 45; phys.strength = 85; phys.vertical = 60; phys.agility = 42;
    }

    // Scale attributes up or down to match target overall
    const scaling = targetOverall / 55; // 55 is approximate initial average

    const scaleAttrMap = (obj: any) => {
      for (const k in obj) {
        obj[k] = Math.max(1, Math.min(99, Math.round(obj[k] * scaling + (Math.random() * 8 - 4))));
      }
    };
    scaleAttrMap(tech);
    scaleAttrMap(phys);
    scaleAttrMap(ment);

    // Calculate actual overall
    const overallRating = Math.round(
      (Object.values(tech).reduce((a, b) => a + b, 0) / Object.keys(tech).length) * 0.5 +
      (Object.values(phys).reduce((a, b) => a + b, 0) / Object.keys(phys).length) * 0.3 +
      (Object.values(ment).reduce((a, b) => a + b, 0) / Object.keys(ment).length) * 0.2
    );

    // Personalities
    const ego = Math.round(30 + Math.random() * 65);
    const loyalty = Math.round(20 + Math.random() * 75);
    const greed = Math.round(30 + Math.random() * 65);
    const usageExpectation = tier === 'superstar' ? 28 : (tier === 'starter' ? 22 : (tier === 'role' ? 17 : 12));

    // Generate contract details
    const agentTypes: ('hardball' | 'reasonable' | 'ring-chaser' | 'team-first')[] = ['hardball', 'reasonable', 'ring-chaser', 'team-first'];
    const agentType = agentTypes[Math.floor(Math.random() * agentTypes.length)];

    // Years left: 1 to 4
    const yearsRemaining = 1 + Math.floor(Math.random() * 4);
    const demand = CBASimulator.getPlayerSalaryDemand(
      { 
        id, 
        name, 
        age, 
        position, 
        attributes: { technical: tech, physical: phys, mental: ment }, 
        overallRating, 
        personality: { ego, loyalty, greed, morale: 80, chemistry: 80, usageExpectation },
        contract: { agentType }
      } as any,
      { isContender: false }
    );

    const salaries = CBASimulator.generateContractSalaries(demand, yearsRemaining, true);

    const options: ('none' | 'player' | 'team')[] = ['none', 'player', 'team'];
    const option = yearsRemaining > 2 ? options[Math.floor(Math.random() * options.length)] : 'none';

    // Bird Rights
    const yearsServed = Math.floor(Math.random() * 6);
    let birdRights: BirdRights = 'none';
    if (yearsServed >= 3) birdRights = 'full-bird';
    else if (yearsServed === 2) birdRights = 'early-bird';
    else if (yearsServed === 1) birdRights = 'non-bird';

    const contract: PlayerContract = {
      salaries,
      option,
      yearsServed,
      birdRights,
      agentType
    };

    // Trait Generation based on attributes
    const traits: string[] = [];
    if (tech.threePoint > 80 && Math.random() < 0.40) traits.push('sharpshooter');
    if ((tech.perimeterDefense > 78 || tech.interiorDefense > 78) && Math.random() < 0.40) traits.push('lockdown');
    if (tech.passingVision > 78 && tech.passingAccuracy > 78 && Math.random() < 0.40) traits.push('playmaker');
    if (tech.closeShot > 80 && phys.strength > 75 && Math.random() < 0.40) traits.push('post_beast');
    if ((tech.offRebound > 78 || tech.defRebound > 78) && Math.random() < 0.40) traits.push('glass_cleaner');
    if (ment.composure > 80 && Math.random() < 0.35) traits.push('clutch');
    if (phys.stamina > 80 && Math.random() < 0.35) traits.push('iron_man');

    const finalTraits = traits.slice(0, 2);

    return {
      id,
      name,
      age,
      position,
      attributes: { technical: tech, physical: phys, mental: ment },
      personality: { ego, loyalty, greed, morale: 80, chemistry: 80, usageExpectation },
      contract,
      injury: null,
      fatigue: 0,
      morale: 80,
      overallRating,
      careerStats: {},
      traits: finalTraits
    };
  }

  // Set up the 12 league teams
  initializeLeague(): void {
    this.teams = TEAM_TEMPLATES.map((t, idx) => {
      const roster: Player[] = [];

      // Generate roster: 1 superstar, 2 starters, 5 roles, 4 bench players
      // Ensure positional coverage: at least 2 PG, 2 SG, 2 SF, 2 PF, 2 C
      const positionPool: Position[] = ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C', 'C', 'PG', 'C'];

      for (let i = 0; i < 12; i++) {
        const pos = positionPool[i];
        let tier: 'superstar' | 'starter' | 'role' | 'bench' = 'bench';
        if (i === 0) tier = 'superstar';
        else if (i === 1 || i === 2) tier = 'starter';
        else if (i >= 3 && i <= 7) tier = 'role';

        roster.push(this.generatePlayer(pos, tier));
      }

      // Sort roster by overall
      roster.sort((a, b) => b.overallRating - a.overallRating);

      // Setup default depth chart
      const depthChart: Record<Position, string[]> = {
        PG: roster.filter(p => p.position === 'PG').map(p => p.id),
        SG: roster.filter(p => p.position === 'SG').map(p => p.id),
        SF: roster.filter(p => p.position === 'SF').map(p => p.id),
        PF: roster.filter(p => p.position === 'PF').map(p => p.id),
        C: roster.filter(p => p.position === 'C').map(p => p.id),
      };

      // Default tactics
      const tactics: TeamTactics = {
        tempo: 'balanced',
        offensiveStyle: idx % 3 === 0 ? 'pace-and-space' : (idx % 3 === 1 ? 'pick-and-roll' : 'motion'),
        offensiveRoles: {},
        defensiveCoverage: 'drop',
        doubleTeamTrigger: 'late-clock',
        targetOverplay: {}
      };

      // Assign initial offensive roles
      const star = roster[0];
      const big = roster.find(p => p.position === 'C' || p.position === 'PF') || roster[1];
      const shooter = roster.find(p => p.attributes.technical.threePoint > 70) || roster[2];

      tactics.offensiveRoles[star.id] = 'initiator';
      tactics.offensiveRoles[big.id] = 'screen-setter';
      tactics.offensiveRoles[shooter.id] = 'spot-up';

      const team: Team = {
        id: 'team_' + (idx + 1),
        name: t.name,
        city: t.city,
        roster,
        depthChart,
        tactics,
        finances: { salaryCap: CBA_CONSTANTS.SALARY_CAP, salariesTotal: 0, luxuryTaxApron1: CBA_CONSTANTS.FIRST_APRON, luxuryTaxApron2: CBA_CONSTANTS.SECOND_APRON },
        wins: 0,
        losses: 0,
        pointDiff: 0,
        history: []
      };

      CBASimulator.updateTeamFinances(team);
      return team;
    });

    this.generateSchedule();
    this.generateFreeAgents();
    this.generateDraftProspects();
    this.scoutingTokens = 5;
  }

  private generateFreeAgents(): void {
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    this.freeAgents = [];

    // Tier distribution: 2 starters, 10 role players, 12 bench, 6 veteran minimums
    const tiers: { tier: 'superstar' | 'starter' | 'role' | 'bench'; count: number; ageMod?: [number, number] }[] = [
      { tier: 'starter', count: 2 },
      { tier: 'role',    count: 10 },
      { tier: 'bench',   count: 12 },
      { tier: 'bench',   count: 6, ageMod: [32, 38] }  // veteran-minimum aging vets
    ];

    let posIdx = 0;
    for (const { tier, count, ageMod } of tiers) {
      for (let i = 0; i < count; i++) {
        const pos = positions[posIdx % positions.length];
        posIdx++;
        const player = this.generatePlayer(pos, tier);
        // Free agents have no Bird Rights and no years served
        player.contract.yearsServed = 0;
        player.contract.birdRights = 'none';
        // Override age for veteran-minimum tier
        if (ageMod) {
          player.age = ageMod[0] + Math.floor(Math.random() * (ageMod[1] - ageMod[0] + 1));
          // Veteran minimums get low salary
          player.contract.salaries = [CBA_CONSTANTS.MINIMUM_SALARY + Math.floor(Math.random() * 500000)];
          player.contract.option = 'none';
        }
        this.freeAgents.push(player);
      }
    }
    // Shuffle the list so tiers are mixed together
    for (let i = this.freeAgents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.freeAgents[i], this.freeAgents[j]] = [this.freeAgents[j], this.freeAgents[i]];
    }
  }

  // Refresh the free agent pool (call between seasons)
  refreshFreeAgents(): void {
    this.generateFreeAgents();
    this.saveToLocalStorage();
  }

  private generateDraftProspects(): void {
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    const colleges = [
      'Duke', 'Kentucky', 'Kansas', 'North Carolina', 'UCLA', 'Gonzaga', 'Arizona',
      'Michigan State', 'Connecticut', 'Indiana', 'Villanova', 'Texas', 'Houston',
      'Baylor', 'Oregon', 'Florida', 'Tennessee', 'Arkansas', 'Ohio State', 'LSU'
    ];
    const strengthsPool = [
      'Deep Range', 'Elite Speed', 'Lockdown Defender', 'Rim Protector', 'High IQ',
      'Composure', 'Playmaker', 'Athletic Finisher', 'Stout Rebounder', 'Motor & Hustle',
      'Explosive First Step', 'Elite Perimeter Defense', 'Post Footwork', 'Shot Creation',
      'Length & Wingspan', 'Transition Threat'
    ];
    const weaknessesPool = [
      'Turnover Prone', 'Poor Stamina', 'Shooting Consistency', 'Size Disadvantage',
      'Foul Prone', 'Defensive Rotations', 'Free Throw Shooting', 'Ball Handling',
      'Needs NBA Body', 'Slow Release', 'Decision Making', 'Lateral Quickness'
    ];

    // Tier distribution: 2 Top 3, 4 Lottery, 8 First Round, 6 Second Round = 20 total
    const prospectTiers: { range: DraftProspect['projectedRange']; ovrMin: number; ovrMax: number; potBonus: number; count: number }[] = [
      { range: 'Top 3',       ovrMin: 72, ovrMax: 78, potBonus: 15, count: 2 },
      { range: 'Lottery',     ovrMin: 68, ovrMax: 74, potBonus: 12, count: 4 },
      { range: 'First Round', ovrMin: 63, ovrMax: 70, potBonus: 10, count: 8 },
      { range: 'Second Round',ovrMin: 58, ovrMax: 65, potBonus: 6,  count: 6 },
    ];

    this.draftProspects = [];
    let posIdx = 0;

    for (const { range, ovrMin, ovrMax, potBonus, count } of prospectTiers) {
      for (let i = 0; i < count; i++) {
        const pos = positions[posIdx % positions.length];
        posIdx++;
        const id = 'prospect_' + Math.random().toString(36).substr(2, 9);
        const name = this.generateRandomName();
        const school = colleges[Math.floor(Math.random() * colleges.length)];
        const age = 18 + Math.floor(Math.random() * 4); // 18-21

        const overallRating = ovrMin + Math.floor(Math.random() * (ovrMax - ovrMin + 1));
        const potentialRating = Math.min(95, overallRating + potBonus + Math.floor(Math.random() * 8));

        // Randomly pick 2 strengths and 2 weaknesses (no duplicates)
        const shuffledStr = [...strengthsPool].sort(() => Math.random() - 0.5);
        const shuffledWeak = [...weaknessesPool].sort(() => Math.random() - 0.5);
        const strengths = shuffledStr.slice(0, 2);
        const weaknesses = shuffledWeak.slice(0, 2);

        // Generate the actual hidden attributes using the bench/role tier
        // (lower tier for younger prospects — they grow into potential)
        const hiddenTier = overallRating >= 72 ? 'role' : 'bench';
        const tempPlayer = this.generatePlayer(pos, hiddenTier);
        const hiddenAttributes = tempPlayer.attributes;

        this.draftProspects.push({
          id,
          name,
          age,
          position: pos,
          school,
          projectedRange: range,
          overallRating,
          potentialRating,
          scouted: false,
          strengths,
          weaknesses,
          hiddenAttributes
        });
      }
    }
  }

  // Convert a college prospect to a Player and add them to the given team
  draftProspect(prospectId: string, team: Team): Player | null {
    const idx = this.draftProspects.findIndex(p => p.id === prospectId);
    if (idx === -1) return null;
    const prospect = this.draftProspects[idx];

    // Build attributes from hidden data (fallback to a generated bench player)
    let attributes = prospect.hiddenAttributes;
    if (!attributes) {
      const tmp = this.generatePlayer(prospect.position, 'bench');
      attributes = tmp.attributes;
    }

    // Rookie contract: 2 years at rookie scale
    const rookieSalary = CBA_CONSTANTS.ROOKIE_SCALE_BASE + (prospect.overallRating - 60) * 50000;
    const salaries = CBASimulator.generateContractSalaries(rookieSalary, 2, true);

    const player: Player = {
      id: 'p_' + Math.random().toString(36).substr(2, 9),
      name: prospect.name,
      age: prospect.age,
      position: prospect.position,
      attributes,
      personality: {
        ego: 30 + Math.floor(Math.random() * 40),
        loyalty: 50 + Math.floor(Math.random() * 40),
        greed: 20 + Math.floor(Math.random() * 40),
        morale: 90,
        chemistry: 80,
        usageExpectation: 12
      },
      contract: {
        salaries,
        option: 'team',
        yearsServed: 0,
        birdRights: 'none',
        agentType: 'reasonable'
      },
      injury: null,
      fatigue: 0,
      morale: 90,
      overallRating: prospect.overallRating,
      careerStats: {},
      traits: []
    };

    // Add to team roster and update depth chart
    team.roster.push(player);
    if (!team.depthChart[player.position]) {
      team.depthChart[player.position] = [];
    }
    team.depthChart[player.position].push(player.id);
    CBASimulator.updateTeamFinances(team);

    // Remove from draft pool
    this.draftProspects.splice(idx, 1);

    this.saveToLocalStorage();
    return player;
  }

  // Generate round-robin schedule (44 rounds, each team plays others 4 times)
  private generateSchedule(): void {
    const list = this.teams;
    const numTeams = list.length;
    const rounds = (numTeams - 1) * 4; // 11 * 4 = 44
    let gameIndex = 1;

    // Standard Circle Method for scheduling
    const tempTeams = [...list];

    for (let round = 1; round <= rounds; round++) {
      // Rotate circle
      for (let i = 0; i < numTeams / 2; i++) {
        const homeIdx = i;
        const awayIdx = numTeams - 1 - i;

        // Alternating home/away
        const home = round % 2 === 0 ? tempTeams[homeIdx] : tempTeams[awayIdx];
        const away = round % 2 === 0 ? tempTeams[awayIdx] : tempTeams[homeIdx];

        this.schedule.push({
          id: `match_r${round}_g${i + 1}`,
          round,
          homeTeamId: home.id,
          awayTeamId: away.id,
          simulated: false
        });
      }

      // Rotate circle list, holding the first index constant
      const last = tempTeams.pop()!;
      tempTeams.splice(1, 0, last);
    }
  }

  // Simulate all games scheduled for the current day/round
  simulateRound(userTeamId: string | null = null, onUserGameDone?: (res: any) => void): void {
    const roundMatches = this.schedule.filter(m => m.round === this.currentRound && !m.simulated);

    roundMatches.forEach(m => {
      const home = this.teams.find(t => t.id === m.homeTeamId)!;
      const away = this.teams.find(t => t.id === m.awayTeamId)!;

      // If user is playing and it is their game, we can skip or run it
      if (userTeamId && (home.id === userTeamId || away.id === userTeamId)) {
        // Run match and call callback
        const result = this.matchEngine.simulateMatch(home, away);

        m.simulated = true;
        m.scoreHome = result.teamAScore;
        m.scoreAway = result.teamBScore;
        m.winnerId = result.winnerId;
        m.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1].log;

        this.applyMatchResults(home, away, result);
        if (onUserGameDone) onUserGameDone(result);
      } else {
        // Instant simulation
        const result = this.matchEngine.simulateMatch(home, away);

        m.simulated = true;
        m.scoreHome = result.teamAScore;
        m.scoreAway = result.teamBScore;
        m.winnerId = result.winnerId;
        m.playByPlaySummary = result.playByPlay[result.playByPlay.length - 1].log;

        this.applyMatchResults(home, away, result);
      }
    });

    this.currentRound++;
    this.saveToLocalStorage();
  }

  // Apply standings, morale adjustments and stats
  private applyMatchResults(home: Team, away: Team, res: any): void {
    // 1. Update W/L
    if (res.winnerId === home.id) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }

    home.pointDiff += (res.teamAScore - res.teamBScore);
    away.pointDiff += (res.teamBScore - res.teamAScore);

    // 2. Accumulate career/season stats
    const updateStats = (t: Team, pStats: any) => {
      t.roster.forEach(p => {
        const stats = pStats[p.id];
        if (stats) {
          if (!p.careerStats['season']) {
            p.careerStats['season'] = {
              minutes: 0, points: 0, assists: 0, rebounds: 0, offRebounds: 0, defRebounds: 0,
              steals: 0, blocks: 0, turnovers: 0, fouls: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0,
              ftm: 0, fta: 0, plusMinus: 0, games: 0
            };
          }
          const c = p.careerStats['season'];
          if (stats.minutes > 0) {
            c.games = (c.games || 0) + 1;
          }
          c.minutes += stats.minutes;
          c.points += stats.points;
          c.assists += stats.assists;
          c.rebounds += stats.rebounds;
          c.offRebounds += stats.offRebounds;
          c.defRebounds += stats.defRebounds;
          c.steals += stats.steals;
          c.blocks += stats.blocks;
          c.turnovers += stats.turnovers;
          c.fouls += stats.fouls;
          c.fgm += stats.fgm;
          c.fga += stats.fga;
          c.tpm += stats.tpm;
          c.tpa += stats.tpa;
          c.ftm += stats.ftm;
          c.fta += stats.fta;
          c.plusMinus += stats.plusMinus;

          // Adjust morale based on win/loss and performance
          const win = res.winnerId === t.id;
          let moraleDelta = win ? 2 : -2;
          // check if played minutes matches usage expectation
          const playedMins = stats.minutes;
          if (playedMins < 5 && p.personality.usageExpectation > 20) {
            moraleDelta -= 3; // complaining about minutes
          } else if (playedMins > 20 && p.personality.usageExpectation > 20) {
            moraleDelta += 1;
          }
          p.morale = Math.max(0, Math.min(100, p.morale + moraleDelta));
        }
      });
    };

    updateStats(home, res.playerStatsA);
    updateStats(away, res.playerStatsB);
  }
}
export default LeagueManager;
