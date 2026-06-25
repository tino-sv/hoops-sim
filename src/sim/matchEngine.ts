import { PossessionEngine } from './possessionEngine';
import type { Team, Player, BoxScoreStats, Position } from './types';

export interface PlayByPlayEvent {
  quarter: number;
  timeString: string;
  log: string;
  scoreA: number;
  scoreB: number;
  teamName: string;
}

export interface MatchResult {
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  playerStatsA: Record<string, BoxScoreStats>;
  playerStatsB: Record<string, BoxScoreStats>;
  playByPlay: PlayByPlayEvent[];
  winnerId: string;
}

export class MatchEngine {
  private possessionEngine = new PossessionEngine();

  // Helper to format remaining seconds into MM:SS
  private formatTime(secondsRemaining: number): string {
    const m = Math.floor(secondsRemaining / 60);
    const s = Math.floor(secondsRemaining % 60);
    const ss = s < 10 ? `0${s}` : `${s}`;
    return `${m}:${ss}`;
  }

  // Initialize fresh box score stats for a player
  private initBoxScore(): BoxScoreStats {
    return {
      minutes: 0,
      points: 0,
      assists: 0,
      rebounds: 0,
      offRebounds: 0,
      defRebounds: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      ftm: 0,
      fta: 0,
      plusMinus: 0
    };
  }

  // Select on-court 5 based on depth chart and fitness/fouls
  private determineOnCourt(team: Team, stats: Record<string, BoxScoreStats>, currentQuarter: number): Player[] {
    const onCourt: Player[] = [];
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

    positions.forEach(pos => {
      const list = team.depthChart[pos] || [];
      // Find the first player who is not fouled out and not severely injured
      const activePlayer = list
        .map(id => team.roster.find(p => p.id === id)!)
        .filter(p => p && (!p.injury || p.injury.daysRemaining <= 0))
        .find(p => {
          const pStats = stats[p.id] || this.initBoxScore();
          return pStats.fouls < 6;
        });

      if (activePlayer) {
        onCourt.push(activePlayer);
      } else {
        // Fallback: any healthy player
        const fallback = team.roster.find(p => !onCourt.includes(p) && (!p.injury || p.injury.daysRemaining <= 0));
        if (fallback) onCourt.push(fallback);
      }
    });

    // Ensure we have exactly 5 players
    while (onCourt.length < 5 && team.roster.length > onCourt.length) {
      const extra = team.roster.find(p => !onCourt.includes(p));
      if (extra) onCourt.push(extra);
    }

    return onCourt.slice(0, 5);
  }

  // AI Coaching: substitution logic
  private runSubstitutions(
    team: Team,
    onCourt: Player[],
    stats: Record<string, BoxScoreStats>,
    quarter: number
  ): Player[] {
    const updatedCourt = [...onCourt];
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

    for (let i = 0; i < updatedCourt.length; i++) {
      const current = updatedCourt[i];
      const pStats = stats[current.id] || this.initBoxScore();
      
      // Determine if player needs rest or is in foul trouble
      const needsRest = current.fatigue > 60;
      
      // Foul trouble limits
      let foulLimit = 6;
      if (quarter === 1) foulLimit = 2;
      else if (quarter === 2) foulLimit = 3;
      else if (quarter === 3) foulLimit = 4;
      else if (quarter === 4) foulLimit = 5;
      
      const foulTrouble = pStats.fouls >= foulLimit && pStats.fouls < 6;
      
      if (needsRest || foulTrouble) {
        // Look in depth chart for a replacement in the same position
        const depthList = team.depthChart[current.position] || [];
        const backup = depthList
          .map(id => team.roster.find(p => p.id === id)!)
          .filter(p => p && p.id !== current.id && !updatedCourt.includes(p) && (!p.injury || p.injury.daysRemaining <= 0))
          .find(p => {
            const bStats = stats[p.id] || this.initBoxScore();
            return bStats.fouls < 6 && p.fatigue < 35;
          });

        if (backup) {
          updatedCourt[i] = backup;
        } else {
          // Flexible fallback: look for any healthy, non-fouled bench player with fatigue < 35
          const fallback = team.roster.find(p => 
            p.id !== current.id && 
            !updatedCourt.includes(p) && 
            (!p.injury || p.injury.daysRemaining <= 0) &&
            (stats[p.id]?.fouls || 0) < 6 &&
            p.fatigue < 35
          );
          if (fallback) {
            updatedCourt[i] = fallback;
          }
        }
      }
    }
    return updatedCourt;
  }

  simulateMatch(teamA: Team, teamB: Team): MatchResult {
    // Reset temporary variables
    const playerStatsA: Record<string, BoxScoreStats> = {};
    const playerStatsB: Record<string, BoxScoreStats> = {};
    const playByPlay: PlayByPlayEvent[] = [];

    // Initialize stats
    teamA.roster.forEach(p => { playerStatsA[p.id] = this.initBoxScore(); p.fatigue = 0; });
    teamB.roster.forEach(p => { playerStatsB[p.id] = this.initBoxScore(); p.fatigue = 0; });

    let scoreA = 0;
    let scoreB = 0;
    
    // Choose initial lineups
    let onCourtA = this.determineOnCourt(teamA, playerStatsA, 1);
    let onCourtB = this.determineOnCourt(teamB, playerStatsB, 1);

    const totalQuarters = 4;
    const quarterSeconds = 720; // 12 minutes
    let currentQuarter = 1;
    let possession: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    let isTransition = false;

    // Simulation loop
    while (currentQuarter <= totalQuarters || (scoreA === scoreB && currentQuarter > totalQuarters)) {
      let secondsRemaining = currentQuarter <= 4 ? quarterSeconds : 300; // 5 min OT
      const qName = currentQuarter <= 4 ? `Quarter ${currentQuarter}` : `Overtime ${currentQuarter - 4}`;
      
      playByPlay.push({
        quarter: currentQuarter,
        timeString: this.formatTime(secondsRemaining),
        log: `🏁 Start of ${qName}: ${teamA.name} vs ${teamB.name}`,
        scoreA,
        scoreB,
        teamName: 'SYSTEM'
      });

      while (secondsRemaining > 0) {
        // Run AI coaching & subs
        onCourtA = this.runSubstitutions(teamA, onCourtA, playerStatsA, currentQuarter);
        onCourtB = this.runSubstitutions(teamB, onCourtB, playerStatsB, currentQuarter);

        // Simulate possession
        const offTeam = possession === 'A' ? teamA : teamB;
        const defTeam = possession === 'A' ? teamB : teamA;
        const offCourt = possession === 'A' ? onCourtA : onCourtB;
        const defCourt = possession === 'A' ? onCourtB : onCourtA;

        const res = this.possessionEngine.simulatePossession(
          offTeam,
          defTeam,
          offCourt,
          defCourt,
          isTransition
        );

        // Track minutes played based on actual time elapsed in possession
        const minsElapsed = res.secondsElapsed / 60;
        onCourtA.forEach(p => playerStatsA[p.id].minutes += minsElapsed);
        onCourtB.forEach(p => playerStatsB[p.id].minutes += minsElapsed);

        // Deduct time
        secondsRemaining -= res.secondsElapsed;
        if (secondsRemaining < 0) secondsRemaining = 0;

        // Apply fatigue increments
        offCourt.forEach(p => {
          // fatigue increases: base + stamina dampening
          const stamina = p.attributes.physical.stamina || 50;
          let fatigueInc = res.secondsElapsed * (0.20 - stamina * 0.0016);
          if (p.traits?.includes('iron_man')) {
            fatigueInc *= 0.7;
          }
          p.fatigue += fatigueInc;
          if (p.fatigue > 100) p.fatigue = 100;
        });
        
        // Recover bench players
        const benchedA = teamA.roster.filter(p => !onCourtA.includes(p));
        const benchedB = teamB.roster.filter(p => !onCourtB.includes(p));
        benchedA.forEach(p => {
          p.fatigue = Math.max(0, p.fatigue - res.secondsElapsed * 0.20);
        });
        benchedB.forEach(p => {
          p.fatigue = Math.max(0, p.fatigue - res.secondsElapsed * 0.20);
        });

        // Record score changes
        if (possession === 'A') {
          scoreA += res.points;
        } else {
          scoreB += res.points;
        }

        // Apply Box Score stats updates
        const offStats = possession === 'A' ? playerStatsA : playerStatsB;
        const defStats = possession === 'A' ? playerStatsB : playerStatsA;

        // Points & Shots
        if (res.shooterId) {
          const pStat = offStats[res.shooterId];
          if (pStat) {
            pStat.points += res.points;
            if (res.isShootingFoul) {
              pStat.fta += res.freeThrowsAwarded;
              // Made FTs are equal to points scored on foul
              pStat.ftm += res.points;
            } else {
              pStat.fga += 1;
              if (res.points >= 2) pStat.fgm += 1;
              if (res.points === 3) {
                pStat.tpa += 1;
                pStat.tpm += 1;
              } else if (res.points === 0 && res.freeThrowsAwarded === 0) {
                // Check if missed shot was a 3
                const logLower = res.logs.join(' ').toLowerCase();
                if (logLower.includes('three-pointer') || logLower.includes('triple') || logLower.includes('corner three')) {
                  pStat.tpa += 1;
                }
              }
            }
          }
        }

        // Assists
        if (res.passerId) {
          const pStat = offStats[res.passerId];
          if (pStat) pStat.assists += 1;
        }

        // Rebounds
        if (res.rebounderId) {
          const isOffRebound = possession === 'A' ? 
            onCourtA.some(p => p.id === res.rebounderId) : 
            onCourtB.some(p => p.id === res.rebounderId);
          
          const rebStats = isOffRebound ? offStats : defStats;
          const pStat = rebStats[res.rebounderId];
          if (pStat) {
            pStat.rebounds += 1;
            if (isOffRebound) pStat.offRebounds += 1;
            else pStat.defRebounds += 1;
          }
        }

        // Turnovers
        if (res.turnoverPlayerId) {
          const pStat = offStats[res.turnoverPlayerId];
          if (pStat) pStat.turnovers += 1;
        }

        // Steals
        if (res.stealedById) {
          const pStat = defStats[res.stealedById];
          if (pStat) pStat.steals += 1;
        }

        // Blocks
        if (res.blockedById) {
          const pStat = defStats[res.blockedById];
          if (pStat) pStat.blocks += 1;
        }

        // Fouls
        if (res.foulPlayerId) {
          const pStat = defStats[res.foulPlayerId];
          if (pStat) pStat.fouls += 1;
        }

        // Plus/Minus tracking on scoring events
        if (res.points > 0) {
          onCourtA.forEach(p => playerStatsA[p.id].plusMinus += possession === 'A' ? res.points : -res.points);
          onCourtB.forEach(p => playerStatsB[p.id].plusMinus += possession === 'B' ? res.points : -res.points);
        }

        // Append logs to match play-by-play
        res.logs.forEach(log => {
          playByPlay.push({
            quarter: currentQuarter,
            timeString: this.formatTime(secondsRemaining),
            log,
            scoreA,
            scoreB,
            teamName: possession === 'A' ? teamA.name : teamB.name
          });
        });

        // Determine next possession and transition state
        const hadOffRebound = res.rebounderId && (possession === 'A' ? 
          onCourtA.some(p => p.id === res.rebounderId) : 
          onCourtB.some(p => p.id === res.rebounderId)
        );

        if (hadOffRebound && res.points === 0) {
          // Offense keeps possession, no transition
          possession = possession; 
          isTransition = false;
        } else if (res.points > 0 && res.isShootingFoul) {
          // After free throws, defense takes it out
          possession = possession === 'A' ? 'B' : 'A';
          isTransition = false;
        } else {
          // Flip possession
          possession = possession === 'A' ? 'B' : 'A';
          // If play ended in a live-ball steal or defensive rebound, fast break is possible
          isTransition = !!(res.stealedById || (res.rebounderId && !hadOffRebound));
        }
      }

      // Rest team and sub-out between quarters
      onCourtA.forEach(p => { p.fatigue = Math.max(0, p.fatigue - 15); });
      onCourtB.forEach(p => { p.fatigue = Math.max(0, p.fatigue - 15); });

      currentQuarter++;
    }

    // Determine winner
    const winnerId = scoreA > scoreB ? teamA.id : teamB.id;

    playByPlay.push({
      quarter: currentQuarter - 1,
      timeString: '0:00',
      log: `🚨 FINAL BUZZER: ${teamA.name} ${scoreA} - ${scoreB} ${teamB.name}. Winner: ${scoreA > scoreB ? teamA.name : teamB.name}!`,
      scoreA,
      scoreB,
      teamName: 'SYSTEM'
    });

    return {
      teamAId: teamA.id,
      teamBId: teamB.id,
      teamAScore: scoreA,
      teamBScore: scoreB,
      playerStatsA,
      playerStatsB,
      playByPlay,
      winnerId
    };
  }
}
export default MatchEngine;
