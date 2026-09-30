<script lang="ts">
  import { badgeById, settleTeamMorale } from '../sim/badges';
  import { GameSession } from '../sim/matchEngine';
  import { madeAttempts } from '../sim/seasonStats';
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
  let session: GameSession;

  // Active game states
  let isRunning = $state(false);
  let playSpeed = $state(1); // 1 = 1.5s per possession, 2 = 500ms, 5 = 50ms, 100 = instant
  let scoreHome = $state(0);
  let scoreAway = $state(0);
  let currentQuarter = $state(1);
  let secondsRemaining = $state(720);
  let possession = $state(Math.random() < 0.5 ? 'home' : 'away');
  let isTransition = $state(false);
  let foulsHome = $state(0);
  let foulsAway = $state(0);
  
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

  const syncFromSession = () => {
    scoreHome = session.scoreHome;
    scoreAway = session.scoreAway;
    currentQuarter = session.quarter;
    secondsRemaining = session.secondsRemaining;
    possession = session.possession;
    isTransition = session.isTransition;
    foulsHome = session.foulsHome;
    foulsAway = session.foulsAway;
    onCourtHome = [...session.onCourtHome];
    onCourtAway = [...session.onCourtAway];
    statsHome = { ...session.statsHome };
    statsAway = { ...session.statsAway };
  };

  const setupGame = () => {
    session = new GameSession(teamHome, teamAway, { narrate: true });
    syncFromSession();
    logsList = [{ text: `Tip-off: ${teamHome.name} vs ${teamAway.name}.`, type: 'system' }];
  };

  setupGame();

  let intervalHandle: any = null;

  const placeBall = (event: import('../sim/possessionEngine').PossessionResult | null, offCourt: Player[], defCourt: Player[], offenseWasHome: boolean) => {
    if (!event) return;
    const offStyle = offenseWasHome ? tacticsHome.offensiveStyle : teamAway.tactics.offensiveStyle;
    const getPlayerCoord = (pId: string) => {
      const pl = offCourt.find(p => p.id === pId) || defCourt.find(p => p.id === pId);
      if (!pl) return { x: 50, y: 50 };
      const isOff = offCourt.some(p => p.id === pId);
      if (isOff) return getCoordinates(pl.position, offStyle);
      const matchedOff = offCourt.find(o => o.position === pl.position) || offCourt[0];
      const offBase = matchedOff ? getCoordinates(matchedOff.position, offStyle) : { x: 50, y: 50 };
      return {
        x: offBase.x - (offBase.x - 4.75) * 0.18,
        y: offBase.y - (offBase.y - 50) * 0.18
      };
    };
    activeShooter = event.shooterId || event.turnoverPlayerId || event.blockedById;
    if (event.points > 0) liveBallLocation = { x: 4.75, y: 50 };
    else if (event.blockedById) liveBallLocation = { x: 6, y: 50 };
    else if (event.rebounderId) liveBallLocation = getPlayerCoord(event.rebounderId);
    else if (event.stealedById) liveBallLocation = getPlayerCoord(event.stealedById);
    else if (event.turnoverPlayerId) liveBallLocation = getPlayerCoord(event.turnoverPlayerId);
    else if (event.shooterId) liveBallLocation = getPlayerCoord(event.shooterId);
  };

  const executePossession = () => {
    if (session.finished) return;
    const offenseWasHome = session.possession === 'home';
    const offCourt = offenseWasHome ? [...session.onCourtHome] : [...session.onCourtAway];
    const defCourt = offenseWasHome ? [...session.onCourtAway] : [...session.onCourtHome];
    session.setHomeTactics(tacticsHome);
    const stepped = session.step();
    placeBall(session.lastEvent, offCourt, defCourt, offenseWasHome);
    syncFromSession();
    for (const line of stepped.logs) {
      logsList = [line, ...logsList];
    }
    if (session.finished) {
      stopGame();
      saveGameResult();
    }
  };

  const saveGameResult = () => {
    const winnerId = scoreHome > scoreAway ? teamHome.id : teamAway.id;
    matchData.simulated = true;
    matchData.scoreHome = scoreHome;
    matchData.scoreAway = scoreAway;
    matchData.winnerId = winnerId;
    matchData.playByPlaySummary = `Game ended. Final: ${scoreHome}-${scoreAway}.`;
    
    const countsInStandings = !matchData.cupKnockout && !matchData.playoff;
    if (countsInStandings) {
      if (winnerId === teamHome.id) {
        teamHome.wins++;
        teamAway.losses++;
      } else {
        teamAway.wins++;
        teamHome.losses++;
      }
      teamHome.pointDiff += (scoreHome - scoreAway);
      teamAway.pointDiff += (scoreAway - scoreHome);
    }

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
        }
      });
    };
    if (countsInStandings) {
      updateStats(teamHome, statsHome);
      updateStats(teamAway, statsAway);
    }
    settleTeamMorale(teamHome.roster, player => statsHome[player.id]?.minutes ?? 0, winnerId === teamHome.id, teamHome.coach?.style);
    settleTeamMorale(teamAway.roster, player => statsAway[player.id]?.minutes ?? 0, winnerId === teamAway.id, teamAway.coach?.style);

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
        while (!session.finished) executePossession();
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
    const outgoing = onCourtHome.find(p => p.id === selectedOnCourtId);
    if (!outgoing) return;
    if (session.manualSub(selectedOnCourtId, benchPlayer)) {
      selectedOnCourtId = null;
      syncFromSession();
      logsList = [{ text: `Substitution: ${benchPlayer.name} replaces ${outgoing.name}.`, type: 'normal' }, ...logsList];
    }
  };

  const checkedIn = (team: Team, stats: Record<string, BoxScoreStats>, onCourt: Player[]) => {
    const onFloor = new Set(onCourt.map(player => player.id));
    return team.roster
      .filter(player => onFloor.has(player.id) || (stats[player.id]?.minutes ?? 0) > 0)
      .sort((a, b) => (stats[b.id]?.minutes ?? 0) - (stats[a.id]?.minutes ?? 0));
  };

  const plusMinusText = (value: number) => `${value > 0 ? '+' : ''}${value}`;

  const quarterLabel = (quarter: number) => {
    if (quarter <= 4) return ['1st', '2nd', '3rd', '4th'][quarter - 1];
    return quarter === 5 ? 'OT' : `OT${quarter - 4}`;
  };

  let selectedHome = $derived(onCourtHome.find(player => player.id === selectedOnCourtId) ?? null);

  const formatTimeStr = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
</script>

<div class="game-screen fade-in">
  <header class="card scorebug">
    <div class="scorebug-side">
      <span class="swatch" style="background: {teamHome.color};"></span>
      <div class="scorebug-id">
        <div class="scorebug-city">{teamHome.city}</div>
        <div class="scorebug-name">{teamHome.name}</div>
        <div class="scorebug-meta">{teamHome.wins}-{teamHome.losses} · {foulsHome} team fouls{foulsHome >= 4 ? ' · bonus' : ''}</div>
      </div>
      <div class="scorebug-points" class:has-ball={possession === 'home'}>{scoreHome}</div>
    </div>

    <div class="scorebug-mid">
      <div class="scorebug-clock">{quarterLabel(currentQuarter)} · {formatTimeStr(secondsRemaining)}</div>
      <div class="scorebug-ball">{possession === 'home' ? teamHome.name : teamAway.name} ball{isTransition ? ' · transition' : ''}</div>
      <div class="scorebug-controls">
        {#if isRunning}
          <button class="btn btn-secondary" onclick={stopGame}>Pause</button>
        {:else}
          <button class="btn btn-primary" onclick={startGame}>Play</button>
        {/if}
        <button class="btn btn-secondary" onclick={() => { stopGame(); playSpeed = 100; startGame(); }}>Sim game</button>
        <label><input type="radio" group={playSpeed} value={1} disabled={isRunning} /> 1x</label>
        <label><input type="radio" group={playSpeed} value={2} disabled={isRunning} /> 2x</label>
        <label><input type="radio" group={playSpeed} value={5} disabled={isRunning} /> 5x</label>
      </div>
    </div>

    <div class="scorebug-side away">
      <div class="scorebug-points" class:has-ball={possession === 'away'}>{scoreAway}</div>
      <div class="scorebug-id" style="text-align: right;">
        <div class="scorebug-city">{teamAway.city}</div>
        <div class="scorebug-name">{teamAway.name}</div>
        <div class="scorebug-meta">{teamAway.wins}-{teamAway.losses} · {foulsAway} team fouls{foulsAway >= 4 ? ' · bonus' : ''}</div>
      </div>
      <span class="swatch" style="background: {teamAway.color};"></span>
    </div>
  </header>

  <div class="last-play card" class:commentary-score={logsList[0]?.type === 'score'} class:commentary-foul={logsList[0]?.type === 'foul'} class:commentary-turnover={logsList[0]?.type === 'turnover'}>
    {logsList[0]?.text ?? 'Tip-off is next.'}
  </div>

  <div class="dashboard-grid">
    <div class="card court-card" style="grid-column: span 7;">
      <div class="court-container">
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
        {#if isRunning}
          <div class="court-ball" style="left: {liveBallLocation.x}%; top: {liveBallLocation.y}%; z-index: 10;"></div>
        {/if}
        {#each Object.entries(playerCoordinates) as [playerId, c]}
          <div
            class="court-dot"
            class:offense={c.isOffense}
            class:defense={!c.isOffense}
            class:hot={playerId === activeShooter}
            style="left: {c.x}%; top: {c.y}%; z-index: 5;"
            title="{c.name} ({c.pos})"
          >
            {c.pos}
            <span class="dot-name">{c.name.split(' ').slice(-1)[0]}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="card pbp-card" style="grid-column: span 5;">
      <h3 class="card-title">Play-by-play</h3>
      <div class="pbp-feed">
        {#each logsList as log}
          <div
            class="pbp-line"
            class:commentary-score={log.type === 'score'}
            class:commentary-foul={log.type === 'foul'}
            class:commentary-turnover={log.type === 'turnover'}
            class:commentary-system={log.type === 'system'}
          >{log.text}</div>
        {:else}
          <div class="pbp-empty">Play-by-play starts at tip-off.</div>
        {/each}
      </div>
    </div>
  </div>

  <div class="card floor-card">
    <div class="floor-col">
      <div class="floor-head">
        <h3>{teamHome.name} on the floor</h3>
        <label class="coverage-label">
          Coverage
          <select class="tactics-select" bind:value={tacticsHome.defensiveCoverage}>
            <option value="drop">Drop</option>
            <option value="blitz">Blitz the handler</option>
            <option value="switch-everything">Switch everything</option>
            <option value="zone-23">2-3 zone</option>
            <option value="zone-32">3-2 zone</option>
          </select>
        </label>
      </div>
      <div class="floor-list">
        {#each onCourtHome as p}
          {@const line = statsHome[p.id]}
          <button class="floor-player" class:active={selectedOnCourtId === p.id} onclick={() => selectedOnCourtId = selectedOnCourtId === p.id ? null : p.id}>
            <span class="floor-pos">{p.position}</span>
            <span class="floor-name">{p.name}</span>
            <span class="floor-stat">{line?.points || 0} pts</span>
            <span class="floor-stat" class:foul-trouble={(line?.fouls || 0) >= 4}>{line?.fouls || 0} pf</span>
            <span class="floor-stat">Legs {Math.round(p.fatigue)}</span>
            <span class="floor-stat">Mood {p.morale}</span>
            <span class="floor-badges">
              {#each p.traits as id}
                {@const badge = badgeById(id)}
                {#if badge}
                  <span class="mini-badge {badge.group}" title={badge.effect}>{badge.name}</span>
                {/if}
              {/each}
            </span>
          </button>
        {/each}
      </div>
      {#if selectedHome}
        <div class="badge-card">
          <div class="badge-card-head">
            <strong>{selectedHome.name}</strong>
            <span>Morale {selectedHome.morale}</span>
          </div>
          {#each selectedHome.traits as id}
            {@const badge = badgeById(id)}
            {#if badge}
              <p><span class="mini-badge {badge.group}">{badge.name}</span> {badge.effect}</p>
            {/if}
          {:else}
            <p>No badge. His ratings still decide the possession.</p>
          {/each}
        </div>
      {/if}
      {#if selectedOnCourtId}
        <div class="bench-row">
          <span class="bench-label">Bring in</span>
          {#each teamHome.roster.filter(p => !onCourtHome.some(on => on.id === p.id) && (statsHome[p.id]?.fouls ?? 0) < 6) as p}
            <button class="bench-chip" onclick={() => makeManualSub(p)}>
              {p.position} {p.name}
              <span>Legs {Math.round(p.fatigue)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="floor-col">
      <h3>{teamAway.name} on the floor</h3>
      <div class="floor-list">
        {#each onCourtAway as p}
          {@const line = statsAway[p.id]}
          <div class="floor-player away">
            <span class="floor-pos">{p.position}</span>
            <span class="floor-name">{p.name}</span>
            <span class="floor-stat">{line?.points || 0} pts</span>
            <span class="floor-stat" class:foul-trouble={(line?.fouls || 0) >= 4}>{line?.fouls || 0} pf</span>
            <span class="floor-badges">
              {#each p.traits as id}
                {@const badge = badgeById(id)}
                {#if badge}
                  <span class="mini-badge {badge.group}" title={badge.effect}>{badge.name}</span>
                {/if}
              {/each}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">Box score</h3>
    <div class="table-container">
      <table class="sim-table box-score">
        <thead>
          <tr>
            <th>Player</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>FG</th>
            <th>3P</th>
            <th>FT</th>
            <th>STL</th>
            <th>BLK</th>
            <th>TO</th>
            <th>PF</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          <tr class="box-team"><td colspan="13">{teamHome.city} {teamHome.name}</td></tr>
          {#each checkedIn(teamHome, statsHome, onCourtHome) as p}
            {@const line = statsHome[p.id]}
            <tr>
              <td class="box-name" class:on-floor={onCourtHome.some(on => on.id === p.id)}>{p.name}</td>
              <td>{(line?.minutes || 0).toFixed(1)}</td>
              <td>{line?.points || 0}</td>
              <td>{line?.rebounds || 0}</td>
              <td>{line?.assists || 0}</td>
              <td>{madeAttempts(line?.fgm || 0, line?.fga || 0)}</td>
              <td>{madeAttempts(line?.tpm || 0, line?.tpa || 0)}</td>
              <td>{madeAttempts(line?.ftm || 0, line?.fta || 0)}</td>
              <td>{line?.steals || 0}</td>
              <td>{line?.blocks || 0}</td>
              <td>{line?.turnovers || 0}</td>
              <td class:foul-trouble={(line?.fouls || 0) >= 5}>{line?.fouls || 0}</td>
              <td>{plusMinusText(line?.plusMinus || 0)}</td>
            </tr>
          {/each}
          <tr class="box-team away"><td colspan="13">{teamAway.city} {teamAway.name}</td></tr>
          {#each checkedIn(teamAway, statsAway, onCourtAway) as p}
            {@const line = statsAway[p.id]}
            <tr>
              <td class="box-name" class:on-floor={onCourtAway.some(on => on.id === p.id)}>{p.name}</td>
              <td>{(line?.minutes || 0).toFixed(1)}</td>
              <td>{line?.points || 0}</td>
              <td>{line?.rebounds || 0}</td>
              <td>{line?.assists || 0}</td>
              <td>{madeAttempts(line?.fgm || 0, line?.fga || 0)}</td>
              <td>{madeAttempts(line?.tpm || 0, line?.tpa || 0)}</td>
              <td>{madeAttempts(line?.ftm || 0, line?.fta || 0)}</td>
              <td>{line?.steals || 0}</td>
              <td>{line?.blocks || 0}</td>
              <td>{line?.turnovers || 0}</td>
              <td class:foul-trouble={(line?.fouls || 0) >= 5}>{line?.fouls || 0}</td>
              <td>{plusMinusText(line?.plusMinus || 0)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>

  .last-play {
    margin-bottom: 16px;
    padding: 10px 14px;
    font-weight: 650;
  }

  .dot-name {
    position: absolute;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    text-shadow: 0 1px 2px #000;
    pointer-events: none;
  }

  .court-dot.hot {
    outline: 2px solid #f97316;
    outline-offset: 2px;
  }

  .badge-card {
    margin-top: 10px;
    padding: 8px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-dark);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .badge-card p {
    margin: 6px 0 0;
  }

  .badge-card-head {
    display: flex;
    justify-content: space-between;
    color: var(--text-primary);
  }

  .scorebug {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    align-items: center;
    margin-bottom: 16px;
    padding: 14px 18px;
  }

  .scorebug-side {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .scorebug-side.away {
    justify-content: flex-end;
  }

  .swatch {
    width: 8px;
    align-self: stretch;
    border-radius: 4px;
    min-height: 42px;
  }

  .scorebug-city {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .scorebug-name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
  }

  .scorebug-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .scorebug-points {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 2.6rem;
    line-height: 1;
    margin-left: auto;
  }

  .scorebug-side.away .scorebug-points {
    margin-left: 0;
    margin-right: auto;
  }

  .scorebug-points.has-ball {
    color: var(--primary);
  }

  .scorebug-mid {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .scorebug-clock {
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .scorebug-ball {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .scorebug-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }

  .scorebug-controls label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }

  .court-card {
    display: flex;
    justify-content: center;
    padding: 12px;
  }

  .court-card .court-container {
    width: 100%;
    max-width: 460px;
    aspect-ratio: 1 / 1;
  }

  .pbp-card {
    display: flex;
    flex-direction: column;
    min-height: 420px;
    max-height: 520px;
  }

  .pbp-feed {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pbp-line {
    font-size: 0.85rem;
    padding: 6px 10px;
    border-radius: 4px;
    border-left: 3px solid transparent;
  }

  .pbp-empty {
    color: var(--text-muted);
    text-align: center;
    margin-top: 40px;
    font-size: 0.85rem;
  }

  .floor-card {
    margin: 16px 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .floor-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }

  .floor-head h3,
  .floor-col > h3 {
    margin: 0 0 8px;
    font-size: 0.95rem;
  }

  .coverage-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .coverage-label .tactics-select {
    width: auto;
    padding: 6px 8px;
  }

  .floor-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .floor-player {
    display: grid;
    grid-template-columns: 28px minmax(0, 1.4fr) repeat(4, auto) minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    text-align: left;
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    font: inherit;
  }

  .floor-player.away {
    cursor: default;
    grid-template-columns: 28px minmax(0, 1.4fr) repeat(2, auto) minmax(0, 1fr);
  }

  .floor-player.active {
    border-color: var(--primary);
  }

  .floor-pos {
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--text-muted);
  }

  .floor-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .floor-stat {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .floor-badges {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .mini-badge {
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .mini-badge.skill {
    border-color: rgba(16, 185, 129, 0.5);
    color: #6ee7b7;
  }

  .mini-badge.personality {
    border-color: rgba(245, 158, 11, 0.5);
    color: #fcd34d;
  }

  .bench-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
  }

  .bench-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .bench-chip {
    background: transparent;
    border: 1px solid var(--primary);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .bench-chip span {
    color: var(--text-muted);
    margin-left: 4px;
  }

  .foul-trouble {
    color: var(--danger);
    font-weight: 800;
  }

  .box-team td {
    background: var(--bg-dark);
    font-weight: 800;
    font-size: 0.75rem;
    text-align: left !important;
  }

  @media (max-width: 1100px) {
    .scorebug,
    .floor-card {
      grid-template-columns: 1fr;
    }
  }

  .box-score th,
  .box-score td {
    padding: 6px 8px;
    font-size: 0.75rem;
    white-space: nowrap;
    text-align: center;
  }

  .box-score .box-name {
    text-align: left;
    font-weight: 600;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .box-score .on-floor {
    font-weight: 800;
    color: var(--primary);
  }

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
