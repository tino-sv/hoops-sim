<script lang="ts">
  import { PossessionEngine } from '../sim/possessionEngine';
  import type { Team, Player, BoxScoreStats, TeamTactics, Position } from '../sim/types';
  import type { ScheduledMatch } from '../sim/league';

  let { 
    matchId, 
    allTeams, 
    schedule = $bindable(), 
    onFinishedMatch 
  }: { 
    matchId: string, 
    allTeams: Team[], 
    schedule: ScheduledMatch[], 
    onFinishedMatch: (scoreHome: number, scoreAway: number, winnerId: string) => void 
  } = $props();

  const matchData = schedule.find(m => m.id === matchId)!;
  const teamHome = allTeams.find(t => t.id === matchData.homeTeamId)!;
  const teamAway = allTeams.find(t => t.id === matchData.awayTeamId)!;

  // Active game states
  let isRunning = $state(false);
  let playSpeed = $state(1); // 1 = 1.5s per possession, 2 = 500ms, 5 = 50ms, 100 = instant
  let scoreHome = $state(0);
  let scoreAway = $state(0);
  let currentQuarter = $state(1);
  let secondsRemaining = $state(720);
  let possession = $state(Math.random() < 0.5 ? 'home' : 'away');
  let isTransition = $state(false);
  
  // Stats
  let statsHome = $state<Record<string, BoxScoreStats>>({});
  let statsAway = $state<Record<string, BoxScoreStats>>({});
  
  // Active Lineups
  let onCourtHome = $state<Player[]>([]);
  let onCourtAway = $state<Player[]>([]);
  
  // Logs & Highlights
  let logsList = $state<{ text: string; type: 'score' | 'foul' | 'turnover' | 'system' | 'normal' }[]>([]);
  
  // Selection for subs
  let selectedOnCourtId = $state<string | null>(null);
  
  // Tactical adjustments in-game
  let tacticsHome = $state<TeamTactics>({ ...teamHome.tactics });
  
  // Live dots visual positioning (shooting coordinates)
  let liveBallLocation = $state({ x: 50, y: 50 });
  let activeShooter = $state<string | null>(null);

  // Spacing coordinates same as Chalkboard
  const getCoordinates = (pos: Position, style: string) => {
    switch (style) {
      case 'pace-and-space':
        if (pos === 'PG') return { x: 85, y: 50 };
        if (pos === 'SG') return { x: 65, y: 15 };
        if (pos === 'SF') return { x: 65, y: 85 };
        if (pos === 'PF') return { x: 35, y: 10 };
        return { x: 35, y: 90 }; // C
      case 'pick-and-roll':
        if (pos === 'PG') return { x: 75, y: 40 };
        if (pos === 'C') return { x: 70, y: 50 };
        if (pos === 'SG') return { x: 60, y: 15 };
        if (pos === 'SF') return { x: 30, y: 88 };
        return { x: 20, y: 55 }; // PF
      case 'post-up':
        if (pos === 'C') return { x: 15, y: 38 };
        if (pos === 'PG') return { x: 65, y: 25 };
        if (pos === 'SG') return { x: 78, y: 55 };
        if (pos === 'SF') return { x: 65, y: 85 };
        return { x: 45, y: 62 }; // PF
      case 'motion':
        if (pos === 'PG') return { x: 70, y: 35 };
        if (pos === 'SG') return { x: 70, y: 65 };
        if (pos === 'SF') return { x: 25, y: 15 };
        if (pos === 'PF') return { x: 45, y: 50 };
        return { x: 18, y: 70 }; // C
      default: // isolation
        if (pos === 'PG') return { x: 65, y: 50 };
        if (pos === 'SG') return { x: 45, y: 12 };
        if (pos === 'SF') return { x: 20, y: 10 };
        if (pos === 'PF') return { x: 45, y: 88 };
        return { x: 20, y: 90 }; // C
    }
  };

  // Derive all 10 on-court coordinates based on who has possession
  let playerCoordinates = $derived.by(() => {
    const coords: Record<string, { x: number, y: number, isOffense: boolean, name: string, pos: Position }> = {};
    const isHomeOffense = possession === 'home';
    const offStyle = isHomeOffense ? tacticsHome.offensiveStyle : teamAway.tactics.offensiveStyle;
    
    // Position offense
    const offCourt = isHomeOffense ? onCourtHome : onCourtAway;
    const defCourt = isHomeOffense ? onCourtAway : onCourtHome;

    offCourt.forEach(p => {
      const base = getCoordinates(p.position, offStyle);
      coords[p.id] = {
        x: base.x,
        y: base.y,
        isOffense: true,
        name: p.name,
        pos: p.position
      };
    });

    // Position defense (matching up to the same position, offset towards hoop at x=4.75, y=50)
    defCourt.forEach(p => {
      // Find matching offensive player to guard
      const matchedOff = offCourt.find(o => o.position === p.position) || offCourt[0];
      const offBase = matchedOff ? getCoordinates(matchedOff.position, offStyle) : { x: 50, y: 50 };
      
      // Shift defender towards baseline/rim
      const x = offBase.x - (offBase.x - 4.75) * 0.18;
      const y = offBase.y - (offBase.y - 50) * 0.18;

      coords[p.id] = {
        x,
        y,
        isOffense: false,
        name: p.name,
        pos: p.position
      };
    });

    return coords;
  });

  const initBoxScore = (): BoxScoreStats => ({
    minutes: 0, points: 0, assists: 0, rebounds: 0, offRebounds: 0, defRebounds: 0,
    steals: 0, blocks: 0, turnovers: 0, fouls: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0,
    ftm: 0, fta: 0, plusMinus: 0
  });

  // Setup initial state
  const setupGame = () => {
    // Reset player box scores
    teamHome.roster.forEach(p => { statsHome[p.id] = initBoxScore(); p.fatigue = 0; });
    teamAway.roster.forEach(p => { statsAway[p.id] = initBoxScore(); p.fatigue = 0; });
    
    // Choose start 5
    onCourtHome = determineLineup(teamHome, statsHome);
    onCourtAway = determineLineup(teamAway, statsAway);
    
    logsList = [{ text: `🚨 Game is preparing for Tip-Off: ${teamHome.name} vs ${teamAway.name}!`, type: 'system' }];
  };

  const determineLineup = (team: Team, stats: Record<string, BoxScoreStats>): Player[] => {
    const list: Player[] = [];
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    positions.forEach(pos => {
      const id = team.depthChart[pos]?.[0];
      const p = team.roster.find(pl => pl.id === id);
      if (p && stats[p.id].fouls < 6) list.push(p);
      else {
        const alt = team.roster.find(pl => !list.includes(pl) && stats[pl.id].fouls < 6);
        if (alt) list.push(alt);
      }
    });
    return list.slice(0, 5);
  };

  setupGame();

  let intervalHandle: any = null;

  const runSubstitutionsAuto = (team: Team, court: Player[], stats: Record<string, BoxScoreStats>): Player[] => {
    const nextCourt = [...court];
    for (let i = 0; i < nextCourt.length; i++) {
      const curr = nextCourt[i];
      const s = stats[curr.id];
      if (curr.fatigue > 65 || s.fouls >= 4) {
        // Swap with a fresh backup
        const backup = team.roster.find(p => !nextCourt.includes(p) && stats[p.id].fouls < 6 && p.fatigue < 30);
        if (backup) {
          nextCourt[i] = backup;
          logsList = [{ text: `🔄 Substitution: ${backup.name} enters for ${curr.name} (${team.name}).`, type: 'normal' }, ...logsList];
        }
      }
    }
    return nextCourt;
  };

  // Run single possession step
  const executePossession = () => {
    // 1. Check auto subs
    onCourtHome = runSubstitutionsAuto(teamHome, onCourtHome, statsHome);
    onCourtAway = runSubstitutionsAuto(teamAway, onCourtAway, statsAway);

    const offTeam = possession === 'home' ? teamHome : teamAway;
    const defTeam = possession === 'home' ? teamAway : teamHome;
    const offCourt = possession === 'home' ? onCourtHome : onCourtAway;
    const defCourt = possession === 'home' ? onCourtAway : onCourtHome;
    const offStats = possession === 'home' ? statsHome : statsAway;
    const defStats = possession === 'home' ? statsAway : statsHome;

    const pe = new PossessionEngine();
    // Simulate
    const res = pe.simulatePossession(offTeam, defTeam, offCourt, defCourt, isTransition);

    secondsRemaining -= res.secondsElapsed;
    if (secondsRemaining <= 0) secondsRemaining = 0;

    // Track minutes played based on actual time elapsed in possession
    const minsElapsed = res.secondsElapsed / 60;
    onCourtHome.forEach(p => statsHome[p.id].minutes += minsElapsed);
    onCourtAway.forEach(p => statsAway[p.id].minutes += minsElapsed);

    // Apply fatigue
    offCourt.forEach(p => {
      const stamina = p.attributes.physical.stamina || 50;
      let fatigueInc = res.secondsElapsed * (0.20 - stamina * 0.0016);
      if (p.traits?.includes('iron_man')) {
        fatigueInc *= 0.7;
      }
      p.fatigue += fatigueInc;
      if (p.fatigue > 100) p.fatigue = 100;
    });

    const benchOff = offTeam.roster.filter(p => !offCourt.includes(p));
    const benchDef = defTeam.roster.filter(p => !defCourt.includes(p));
    benchOff.forEach(p => p.fatigue = Math.max(0, p.fatigue - res.secondsElapsed * 0.20));
    benchDef.forEach(p => p.fatigue = Math.max(0, p.fatigue - res.secondsElapsed * 0.20));

    // Update score
    if (possession === 'home') {
      scoreHome += res.points;
    } else {
      scoreAway += res.points;
    }

    // Apply stats
    if (res.shooterId) {
      const s = offStats[res.shooterId];
      if (s) {
        s.points += res.points;
        if (res.isShootingFoul) {
          s.fta += res.freeThrowsAwarded;
          s.ftm += res.points;
        } else {
          s.fga += 1;
          if (res.points >= 2) s.fgm += 1;
          if (res.points === 3) { s.tpm += 1; s.tpa += 1; }
        }
      }
    }

    if (res.passerId) {
      const p = offStats[res.passerId];
      if (p) p.assists += 1;
    }

    if (res.rebounderId) {
      const isOff = possession === 'home' ? 
        onCourtHome.some(p => p.id === res.rebounderId) : 
        onCourtAway.some(p => p.id === res.rebounderId);
      const targetStats = isOff ? offStats : defStats;
      const r = targetStats[res.rebounderId];
      if (r) {
        r.rebounds += 1;
        if (isOff) r.offRebounds += 1;
        else r.defRebounds += 1;
      }
    }

    if (res.turnoverPlayerId) {
      const t = offStats[res.turnoverPlayerId];
      if (t) t.turnovers += 1;
    }
    if (res.stealedById) {
      const st = defStats[res.stealedById];
      if (st) st.steals += 1;
    }
    if (res.blockedById) {
      const bl = defStats[res.blockedById];
      if (bl) bl.blocks += 1;
    }
    if (res.foulPlayerId) {
      const f = defStats[res.foulPlayerId];
      if (f) f.fouls += 1;
    }

    // Live display location mapping - dynamic ball tracking
    const offStyle = possession === 'home' ? tacticsHome.offensiveStyle : teamAway.tactics.offensiveStyle;
    const getPlayerCoord = (pId: string) => {
      const pl = offCourt.find(p => p.id === pId) || defCourt.find(p => p.id === pId);
      if (pl) {
        const isOff = offCourt.some(p => p.id === pId);
        if (isOff) {
          return getCoordinates(pl.position, offStyle);
        } else {
          const matchedOff = offCourt.find(o => o.position === pl.position) || offCourt[0];
          const offBase = matchedOff ? getCoordinates(matchedOff.position, offStyle) : { x: 50, y: 50 };
          return {
            x: offBase.x - (offBase.x - 4.75) * 0.18,
            y: offBase.y - (offBase.y - 50) * 0.18
          };
        }
      }
      return { x: 50, y: 50 };
    };

    if (res.points > 0) {
      // Made shot - ball goes to rim
      liveBallLocation = { x: 4.75, y: 50 };
    } else if (res.blockedById) {
      // Blocked shot - ball near rim
      liveBallLocation = { x: 6, y: 50 };
    } else if (res.rebounderId) {
      // Missed shot/rebound - ball goes to rebounder
      const rCoord = getPlayerCoord(res.rebounderId);
      liveBallLocation = { x: rCoord.x, y: rCoord.y };
    } else if (res.stealedById) {
      // Steal - ball goes to stealer
      const sCoord = getPlayerCoord(res.stealedById);
      liveBallLocation = { x: sCoord.x, y: sCoord.y };
    } else if (res.turnoverPlayerId) {
      // Turnover - ball at turnover player
      const tCoord = getPlayerCoord(res.turnoverPlayerId);
      liveBallLocation = { x: tCoord.x, y: tCoord.y };
    } else if (res.shooterId) {
      // Shot in progress
      const shCoord = getPlayerCoord(res.shooterId);
      liveBallLocation = { x: shCoord.x, y: shCoord.y };
    } else {
      // Default to PG ball handler
      const pgPl = offCourt.find(p => p.position === 'PG') || offCourt[0];
      if (pgPl) {
        const pgCoord = getPlayerCoord(pgPl.id);
        liveBallLocation = { x: pgCoord.x, y: pgCoord.y };
      }
    }

    // Prepend logs
    res.logs.forEach(l => {
      let type: 'score' | 'foul' | 'turnover' | 'normal' = 'normal';
      if (l.includes('SCORE:')) type = 'score';
      else if (l.includes('FOUL:')) type = 'foul';
      else if (l.includes('TURNOVER:')) type = 'turnover';
      
      logsList = [{ text: l, type }, ...logsList];
    });

    // Toggle possession
    const hadOffRebound = res.rebounderId && (possession === 'home' ? 
      onCourtHome.some(p => p.id === res.rebounderId) : 
      onCourtAway.some(p => p.id === res.rebounderId)
    );

    if (hadOffRebound && res.points === 0) {
      // Retain
      possession = possession;
      isTransition = false;
    } else {
      possession = possession === 'home' ? 'away' : 'home';
      isTransition = !!(res.stealedById || (res.rebounderId && !hadOffRebound));
    }

    // Check quarter end
    if (secondsRemaining <= 0) {
      logsList = [{ text: `🚨 End of Quarter ${currentQuarter} • Score: ${teamHome.name} ${scoreHome} - ${scoreAway} ${teamAway.name}`, type: 'system' }, ...logsList];
      if (currentQuarter < 4) {
        currentQuarter++;
        secondsRemaining = 720;
      } else {
        // Game Over!
        if (scoreHome === scoreAway) {
          currentQuarter++;
          secondsRemaining = 300; // OT
          logsList = [{ text: `⏰ OVERTIME REQUIRED! Game is tied after regulation.`, type: 'system' }, ...logsList];
        } else {
          stopGame();
          saveGameResult();
        }
      }
    }
  };

  const saveGameResult = () => {
    const winnerId = scoreHome > scoreAway ? teamHome.id : teamAway.id;
    matchData.simulated = true;
    matchData.scoreHome = scoreHome;
    matchData.scoreAway = scoreAway;
    matchData.winnerId = winnerId;
    matchData.playByPlaySummary = `Game ended. Final: ${scoreHome}-${scoreAway}.`;
    
    // Standings updates
    if (winnerId === teamHome.id) {
      teamHome.wins++;
      teamAway.losses++;
    } else {
      teamAway.wins++;
      teamHome.losses++;
    }

    teamHome.pointDiff += (scoreHome - scoreAway);
    teamAway.pointDiff += (scoreAway - scoreHome);

    // Save player career stats
    const updateStats = (t: Team, pStats: any) => {
      t.roster.forEach(p => {
        const stats = pStats[p.id];
        if (stats) {
          if (!p.careerStats['season']) {
            p.careerStats['season'] = { ...initBoxScore(), games: 0 } as any;
          }
          const c = p.careerStats['season'];
          if (stats.minutes > 0) {
            c.games = (c.games || 0) + 1;
          }
          for (const k in c) {
            if (k !== 'games') {
              (c as any)[k] += (stats as any)[k];
            }
          }
          p.morale = Math.max(0, Math.min(100, p.morale + (winnerId === t.id ? 2 : -2)));
        }
      });
    };
    updateStats(teamHome, statsHome);
    updateStats(teamAway, statsAway);

    alert(`Game Completed! Final Score: ${teamHome.name} ${scoreHome} - ${scoreAway} ${teamAway.name}`);
    onFinishedMatch(scoreHome, scoreAway, winnerId);
  };

  const startGame = () => {
    if (isRunning) return;
    isRunning = true;
    
    const tick = () => {
      if (!isRunning) return;
      
      // Perform steps based on speed
      if (playSpeed === 100) {
        // Fast-simulate to end
        while (secondsRemaining > 0 || (scoreHome === scoreAway && currentQuarter >= 4)) {
          executePossession();
        }
        return;
      }

      executePossession();

      const delay = playSpeed === 5 ? 50 : (playSpeed === 2 ? 400 : 1200);
      intervalHandle = setTimeout(tick, delay);
    };

    tick();
  };

  const stopGame = () => {
    isRunning = false;
    if (intervalHandle) {
      clearTimeout(intervalHandle);
      intervalHandle = null;
    }
  };

  // Manual sub actions
  const makeManualSub = (benchPlayer: Player) => {
    if (!selectedOnCourtId) return;
    const courtIdx = onCourtHome.findIndex(p => p.id === selectedOnCourtId);
    if (courtIdx !== -1) {
      const outgoing = onCourtHome[courtIdx];
      onCourtHome[courtIdx] = benchPlayer;
      selectedOnCourtId = null;
      logsList = [{ text: `🔄 Substitution: ${benchPlayer.name} replaces ${outgoing.name}.`, type: 'normal' }, ...logsList];
    }
  };

  const formatTimeStr = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
</script>

<div class="match-center-container fade-in">
  <!-- Live scoreboard header -->
  <div class="card" style="margin-bottom: 24px; padding: 16px 24px;">
    <div style="display: flex; align-items: center; justify-content: space-between;">
      
      <!-- Home Team -->
      <div style="display: flex; align-items: center; gap: 24px; flex: 1;">
        <span style="font-size: 2.25rem; font-family: var(--font-display); font-weight: 900;">{teamHome.city}</span>
        <div style="text-align: right;">
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-secondary);">{teamHome.name}</div>
          <span class="badge badge-primary">HOME</span>
        </div>
      </div>

      <!-- Live Score -->
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 40px; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
        <div style="display: flex; items: center; gap: 16px;">
          <span style="font-size: 3rem; font-family: var(--font-display); font-weight: 900; color: var(--text-primary);">
            {scoreHome}
          </span>
          <span style="font-size: 2rem; color: var(--text-muted); font-weight: 300;">-</span>
          <span style="font-size: 3rem; font-family: var(--font-display); font-weight: 900; color: var(--secondary);">
            {scoreAway}
          </span>
        </div>
        
        <div>
          <span class="badge badge-secondary" style="font-size: 0.85rem; letter-spacing: 0.05em;">
            Q{currentQuarter} • {formatTimeStr(secondsRemaining)}
          </span>
        </div>
      </div>

      <!-- Away Team -->
      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 24px; flex: 1; text-align: right;">
        <div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-secondary);">{teamAway.name}</div>
          <span class="badge badge-secondary">{teamAway.city}</span>
        </div>
        <span style="font-size: 2.25rem; font-family: var(--font-display); font-weight: 900; color: var(--secondary);">{teamAway.name}</span>
      </div>

    </div>
  </div>

  <div class="dashboard-grid">
    <!-- Center panel: Interactive Live Court and Commentary Feed -->
    <div style="grid-column: span 8; display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Sim Controls -->
      <div class="card" style="padding: 16px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 10px;">
          {#if isRunning}
            <button class="btn btn-secondary" onclick={stopGame}>⏸️ Pause Sim</button>
          {:else}
            <button class="btn btn-primary" onclick={startGame}>▶️ Start Simulation</button>
          {/if}
          <button class="btn btn-secondary" onclick={() => { stopGame(); playSpeed = 100; startGame(); }}>
            ⚡ Instant Sim
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; font-size: 0.85rem;">
          <b>Speed:</b>
          <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="radio" group={playSpeed} value={1} disabled={isRunning} /> 1x
          </label>
          <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="radio" group={playSpeed} value={2} disabled={isRunning} /> 2x
          </label>
          <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="radio" group={playSpeed} value={5} disabled={isRunning} /> 5x
          </label>
        </div>
      </div>

      <!-- Live spacing representation -->
      <div class="card" style="padding: 12px; display: flex; flex-direction: column; align-items: center;">
        <h4 style="align-self: flex-start; color: var(--text-secondary); margin-bottom: 8px;">Live Broadcast View</h4>
        
        <div class="court-container" style="width: 100%; aspect-ratio: 1 / 1; max-width: 450px;">
          <!-- Beautiful SVG Court Markings -->
          <svg viewBox="0 0 100 100" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;">
            <!-- Court floor background -->
            <rect width="100%" height="100%" fill="#0f172a" />
            
            <!-- Key / Paint area -->
            <rect x="0" y="34" width="40" height="32" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" />
            <line x1="0" y1="34" x2="40" y2="34" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
            <line x1="0" y1="66" x2="40" y2="66" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
            <line x1="40" y1="34" x2="40" y2="66" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
            
            <!-- Free Throw circle -->
            <path d="M 40,34 A 16,16 0 0,1 40,66" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" stroke-dasharray="2,2" />
            <path d="M 40,34 A 16,16 0 0,0 40,66" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
            
            <!-- Midcourt center circle arc -->
            <path d="M 100,38 A 12,12 0 0,0 100,62" fill="none" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />
            <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />

            <!-- Three-point arc -->
            <path d="M 0,6 L 29.8,6 A 47.5,47.5 0 0,1 29.8,94 L 0,94" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
            
            <!-- Rim, backboard and connector -->
            <line x1="4" y1="42" x2="4" y2="58" stroke="#ffffff" stroke-width="2.5" />
            <line x1="4" y1="50" x2="4.75" y2="50" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="4.75" cy="50" r="1.5" fill="none" stroke="#f97316" stroke-width="2.5" />
          </svg>

          <!-- Highlight Ball location -->
          {#if isRunning}
            <div class="court-ball" style="left: {liveBallLocation.x}%; top: {liveBallLocation.y}%; z-index: 10;"></div>
          {/if}

          <!-- Player Dots (Guarding Matchups) -->
          {#each Object.entries(playerCoordinates) as [playerId, c]}
            <div 
              class="court-dot" 
              class:offense={c.isOffense}
              class:defense={!c.isOffense}
              style="left: {c.x}%; top: {c.y}%; z-index: 5;"
              title="{c.name} ({c.pos})"
            >
              {c.pos}
              <span class="court-dot-tooltip">{c.name}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Scrolling play commentary feed -->
      <div class="card" style="flex-grow: 1; height: 300px; display: flex; flex-direction: column;">
        <h4 class="card-title">Commentary Log</h4>
        
        <div style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; background-color: var(--bg-darker);">
          {#each logsList as log}
            <div 
              style="font-size: 0.85rem; padding: 6px 10px; border-radius: 4px; border-left: 3px solid transparent;"
              class:commentary-score={log.type === 'score'}
              class:commentary-foul={log.type === 'foul'}
              class:commentary-turnover={log.type === 'turnover'}
              class:commentary-system={log.type === 'system'}
            >
              {log.text}
            </div>
          {:else}
            <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 80px;">
              Match commentary starts once simulation begins.
            </div>
          {/each}
        </div>
      </div>

    </div>

    <!-- Right panel: Subs panel and Match statistics -->
    <div style="grid-column: span 4; display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Coach panel: Subs -->
      <div class="card" style="display: flex; flex-direction: column; gap: 12px;">
        <h3 class="card-title">Coaching & Subs</h3>

        <!-- In-game defensive tactics settings -->
        <div class="setting-group">
          <label for="live-cov">Adjust Scheme</label>
          <select id="live-cov" class="tactics-select" bind:value={tacticsHome.defensiveCoverage}>
            <option value="drop">Drop (Protect paint)</option>
            <option value="blitz">Blitz Handler (Trap PG)</option>
            <option value="switch-everything">Switch (Prevent open looks)</option>
          </select>
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
          <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">On Floor (Select to Sub)</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            {#each onCourtHome as p}
              <button 
                class="sub-item-btn" 
                class:active={selectedOnCourtId === p.id}
                onclick={() => selectedOnCourtId = p.id}
              >
                <span><b>{p.position}</b> {p.name}</span>
                <span class="badge badge-warning">Fatigue: {Math.round(p.fatigue)}%</span>
              </button>
            {/each}
          </div>
        </div>

        {#if selectedOnCourtId}
          <div style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px; animation: fadeIn 0.2s;">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">Choose Bench Replacement</h4>
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto;">
              {#each teamHome.roster.filter(p => !onCourtHome.includes(p)) as p}
                <button 
                  class="sub-item-btn" 
                  style="border-color: var(--primary-glow);"
                  onclick={() => makeManualSub(p)}
                >
                  <span><b>{p.position}</b> {p.name}</span>
                  <span class="badge badge-primary">F: {Math.round(p.fatigue)}%</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Live statistics snapshot -->
      <div class="card" style="flex-grow: 1;">
        <h3 class="card-title">Live Box Score</h3>
        
        <div class="table-container" style="max-height: 250px; overflow-y: auto;">
          <table class="sim-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>PTS</th>
                <th>AST</th>
                <th>REB</th>
                <th>PF</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: var(--bg-dark);"><td colspan="5" style="font-weight: 800; font-size: 0.75rem;">{teamHome.name} (Home)</td></tr>
              {#each onCourtHome as p}
                <tr>
                  <td style="font-weight: 700; max-width: 90px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{p.name}</td>
                  <td>{statsHome[p.id]?.points || 0}</td>
                  <td>{statsHome[p.id]?.assists || 0}</td>
                  <td>{statsHome[p.id]?.rebounds || 0}</td>
                  <td style="color: {(statsHome[p.id]?.fouls || 0) >= 5 ? 'var(--danger)' : 'inherit'}">{statsHome[p.id]?.fouls || 0}</td>
                </tr>
              {/each}

              <tr style="background-color: var(--bg-dark);"><td colspan="5" style="font-weight: 800; font-size: 0.75rem; color: var(--secondary);">{teamAway.name} (Away)</td></tr>
              {#each onCourtAway as p}
                <tr>
                  <td style="font-weight: 700; max-width: 90px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{p.name}</td>
                  <td>{statsAway[p.id]?.points || 0}</td>
                  <td>{statsAway[p.id]?.assists || 0}</td>
                  <td>{statsAway[p.id]?.rebounds || 0}</td>
                  <td style="color: {(statsAway[p.id]?.fouls || 0) >= 5 ? 'var(--danger)' : 'inherit'}">{statsAway[p.id]?.fouls || 0}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</div>

<style>
  /* Commentary logs formatting */
  .commentary-score {
    border-left-color: var(--primary) !important;
    background-color: rgba(16, 185, 129, 0.05);
    color: var(--primary);
    font-weight: 700;
  }
  .commentary-foul {
    border-left-color: var(--danger) !important;
    background-color: rgba(239, 68, 68, 0.05);
    color: var(--danger);
  }
  .commentary-turnover {
    border-left-color: var(--accent) !important;
    background-color: rgba(245, 158, 11, 0.05);
    color: var(--accent);
  }
  .commentary-system {
    border-left-color: var(--secondary) !important;
    background-color: rgba(59, 130, 246, 0.05);
    color: var(--text-primary);
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.8rem;
  }

  .sub-item-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--bg-dark);
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.8rem;
    text-align: left;
    transition: all 0.2s;
  }

  .sub-item-btn:hover {
    background-color: var(--bg-card-hover);
  }

  .sub-item-btn.active {
    background-color: var(--secondary-glow);
    border-color: var(--secondary);
  }

  .tactics-select {
    background-color: var(--bg-dark);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    width: 100%;
    cursor: pointer;
    outline: none;
  }
</style>
