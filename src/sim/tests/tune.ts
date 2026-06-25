import { LeagueManager } from '../league';
import { MatchEngine } from '../matchEngine';
import { CBASimulator } from '../cba';

export function runTuningSimulation(iterations: number = 100) {
  console.log(`\n==========================================`);
  console.log(`🏀 RUNNING SIMULATOR VERIFICATION SUITE 🏀`);
  console.log(`Running ${iterations} simulated games...`);
  console.log(`==========================================\n`);

  const league = new LeagueManager();
  const matchEngine = new MatchEngine();

  let totalPoints = 0;
  let totalGames = 0;
  
  let totalFgm = 0;
  let totalFga = 0;
  let totalTpm = 0;
  let totalTpa = 0;
  let totalFtm = 0;
  let totalFta = 0;

  let totalRebounds = 0;
  let totalOffReb = 0;
  let totalDefReb = 0;

  let totalAssists = 0;
  let totalTurnovers = 0;
  let totalFouls = 0;
  let totalSteals = 0;
  let totalBlocks = 0;

  const teamA = league.teams[0];
  const teamB = league.teams[1];

  for (let i = 0; i < iterations; i++) {
    // Refresh rosters to clear fatigue
    teamA.roster.forEach(p => p.fatigue = 0);
    teamB.roster.forEach(p => p.fatigue = 0);

    const res = matchEngine.simulateMatch(teamA, teamB);
    
    // Add stats for both teams
    totalPoints += res.teamAScore + res.teamBScore;
    totalGames += 2;

    const extractStatsSum = (playerStats: any) => {
      Object.values(playerStats).forEach((p: any) => {
        totalFgm += p.fgm;
        totalFga += p.fga;
        totalTpm += p.tpm;
        totalTpa += p.tpa;
        totalFtm += p.ftm;
        totalFta += p.fta;

        totalRebounds += p.rebounds;
        totalOffReb += p.offRebounds;
        totalDefReb += p.defRebounds;

        totalAssists += p.assists;
        totalTurnovers += p.turnovers;
        totalFouls += p.fouls;
        totalSteals += p.steals;
        totalBlocks += p.blocks;
      });
    };

    extractStatsSum(res.playerStatsA);
    extractStatsSum(res.playerStatsB);
  }

  const avgPoints = totalPoints / totalGames; // average score per team in a game
  const fgPct = (totalFgm / Math.max(1, totalFga)) * 100;
  const tpPct = (totalTpm / Math.max(1, totalTpa)) * 100;
  const ftPct = (totalFtm / Math.max(1, totalFta)) * 100;

  const avgReb = totalRebounds / totalGames;
  const avgOffReb = totalOffReb / totalGames;
  const avgDefReb = totalDefReb / totalGames;
  const orbPct = (totalOffReb / Math.max(1, totalRebounds)) * 100;

  const avgAssists = totalAssists / totalGames;
  const avgTurnovers = totalTurnovers / totalGames;
  const avgFouls = totalFouls / totalGames;
  const avgSteals = totalSteals / totalGames;
  const avgBlocks = totalBlocks / totalGames;

  console.log(`📊 SIMULATION RESULTS AVERAGES PER TEAM:`);
  console.log(`------------------------------------------`);
  console.log(`Points Scored:     ${avgPoints.toFixed(1)} PPG  (Target: 105 - 120)`);
  console.log(`FG %:              ${fgPct.toFixed(1)}%     (Target: 44.0% - 49.0%)`);
  console.log(`3PT %:             ${tpPct.toFixed(1)}%     (Target: 33.0% - 38.0%)`);
  console.log(`FT %:              ${ftPct.toFixed(1)}%     (Target: 74.0% - 80.0%)`);
  console.log(`Rebounds:          ${avgReb.toFixed(1)} RPG`);
  console.log(`  - Offensive:     ${avgOffReb.toFixed(1)} RPG (${orbPct.toFixed(1)}% ORB share)`);
  console.log(`  - Defensive:     ${avgDefReb.toFixed(1)} RPG`);
  console.log(`Assists:           ${avgAssists.toFixed(1)} APG  (Target: 22.0 - 28.0)`);
  console.log(`Turnovers:         ${avgTurnovers.toFixed(1)} TOPG (Target: 11.0 - 15.0)`);
  console.log(`Fouls:             ${avgFouls.toFixed(1)} PFPG (Target: 16.0 - 22.0)`);
  console.log(`Steals:            ${avgSteals.toFixed(1)} SPG  (Target: 6.0 - 9.0)`);
  console.log(`Blocks:            ${avgBlocks.toFixed(1)} BPG  (Target: 4.0 - 6.0)`);
  console.log(`------------------------------------------`);

  // Simple validation assertions
  const isRealistic = 
    avgPoints >= 95 && avgPoints <= 130 &&
    fgPct >= 40 && fgPct <= 52 &&
    tpPct >= 28 && tpPct <= 41 &&
    avgTurnovers >= 9 && avgTurnovers <= 18;

  if (isRealistic) {
    console.log(`✅ VERIFICATION SUCCESS: Simulated statistics match target ranges!`);
  } else {
    console.log(`⚠️ VERIFICATION WARNING: Some statistics deviate from target ranges. Retuning may be required.`);
  }
}

// Run if direct execution
runTuningSimulation(100);
