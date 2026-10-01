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

  const SHIRT: Record<Position, string> = { PG: '1', SG: '2', SF: '3', PF: '4', C: '5' };

  const endFor = (offenseIsHome: boolean, quarter: number): 'left' | 'right' => {
    const homeAttacksRight = quarter % 2 === 1;
    return offenseIsHome === homeAttacksRight ? 'right' : 'left';
  };

  const mapHalf = (half: { x: number, y: number }, end: 'left' | 'right', leak = 0) => {
    const along = Math.max(8, Math.min(47, 8 + half.x * 0.36 + leak));
    return {
      x: end === 'left' ? along : 100 - along,
      y: Math.max(7, Math.min(93, half.y))
    };
  };

  const inkFor = (hex: string) => {
    const h = hex.replace('#', '');
    if (h.length < 6) return '#fff';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return r * 0.3 + g * 0.59 + b * 0.11 > 165 ? '#1a1208' : '#fff';
  };

  const guardSpot = (offBase: { x: number, y: number }) => {
    const nearEdge = offBase.y < 20 || offBase.y > 80;
    const inward = offBase.y >= 50 ? -1 : 1;
    const y = nearEdge ? offBase.y + inward * 16 : offBase.y + (offBase.y >= 50 ? 12 : -12);
    return {
      x: Math.max(6, offBase.x - (offBase.x - 4.75) * 0.34),
      y: Math.max(10, Math.min(90, y))
    };
  };

  // Full-court spots. The team with the ball attacks one basket for the quarter.
  let playerCoordinates = $derived.by(() => {
    const coords: Record<string, { x: number, y: number, isOffense: boolean, name: string, pos: Position, side: 'home' | 'away' }> = {};
    const isHomeOffense = possession === 'home';
    const end = endFor(isHomeOffense, currentQuarter);
    const leak = isTransition ? 6 : 0;
    const offStyle = isHomeOffense ? tacticsHome.offensiveStyle : teamAway.tactics.offensiveStyle;
    const offCourt = isHomeOffense ? onCourtHome : onCourtAway;
    const defCourt = isHomeOffense ? onCourtAway : onCourtHome;

    offCourt.forEach(p => {
      const spot = mapHalf(getCoordinates(p.position, offStyle), end, leak);
      coords[p.id] = { ...spot, isOffense: true, name: p.name, pos: p.position, side: isHomeOffense ? 'home' : 'away' };
    });

    defCourt.forEach(p => {
      const matchedOff = offCourt.find(o => o.position === p.position) || offCourt[0];
      const offBase = matchedOff ? getCoordinates(matchedOff.position, offStyle) : { x: 50, y: 50 };
      const spot = mapHalf(guardSpot(offBase), end, leak);
      coords[p.id] = { ...spot, isOffense: false, name: p.name, pos: p.position, side: isHomeOffense ? 'away' : 'home' };
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

  const placeBall = (event: import('../sim/possessionEngine').PossessionResult | null, offCourt: Player[], defCourt: Player[], offenseWasHome: boolean, quarter: number) => {
    if (!event) return;
    const end = endFor(offenseWasHome, quarter);
    const offStyle = offenseWasHome ? tacticsHome.offensiveStyle : teamAway.tactics.offensiveStyle;
    const getPlayerCoord = (pId: string) => {
      const pl = offCourt.find(p => p.id === pId) || defCourt.find(p => p.id === pId);
      if (!pl) return mapHalf({ x: 50, y: 50 }, end);
      const isOff = offCourt.some(p => p.id === pId);
      if (isOff) return mapHalf(getCoordinates(pl.position, offStyle), end);
      const matchedOff = offCourt.find(o => o.position === pl.position) || offCourt[0];
      const offBase = matchedOff ? getCoordinates(matchedOff.position, offStyle) : { x: 50, y: 50 };
      return mapHalf(guardSpot(offBase), end);
    };
    activeShooter = event.shooterId || event.turnoverPlayerId || event.blockedById;
    if (event.points > 0) liveBallLocation = mapHalf({ x: 4.75, y: 50 }, end);
    else if (event.blockedById) liveBallLocation = mapHalf({ x: 6, y: 50 }, end);
    else if (event.rebounderId) liveBallLocation = getPlayerCoord(event.rebounderId);
    else if (event.stealedById) liveBallLocation = getPlayerCoord(event.stealedById);
    else if (event.turnoverPlayerId) liveBallLocation = getPlayerCoord(event.turnoverPlayerId);
    else if (event.shooterId) liveBallLocation = getPlayerCoord(event.shooterId);
  };

  const executePossession = () => {
    if (session.finished) return;
    const quarterThen = session.quarter;
    const offenseWasHome = session.possession === 'home';
    const offCourt = offenseWasHome ? [...session.onCourtHome] : [...session.onCourtAway];
    const defCourt = offenseWasHome ? [...session.onCourtAway] : [...session.onCourtHome];
    session.setHomeTactics(tacticsHome);
    const stepped = session.step();
    placeBall(session.lastEvent, offCourt, defCourt, offenseWasHome, quarterThen);
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

  const lastName = (name: string) => name.split(' ').slice(-1)[0];

  const tally = (book: Record<string, BoxScoreStats>) => {
    const rows = Object.values(book);
    const add = (key: keyof BoxScoreStats) => rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
    return { fgm: add('fgm'), fga: add('fga'), reb: add('rebounds'), ast: add('assists'), tov: add('turnovers') };
  };

  const homeLine = $derived(tally(statsHome));
  const awayLine = $derived(tally(statsAway));
  const share = (home: number, away: number) => {
    const total = home + away;
    return total === 0 ? 50 : Math.round((home / total) * 100);
  };
  const recent = $derived(logsList.slice(0, 6));
</script>

<div class="game-screen fade-in">
  <header class="match-bar">
    <div class="club">
      <span class="crest" style="background: {teamHome.color}; border-color: {teamHome.trim ?? '#E8E4D9'};"></span>
      <div>
        <div class="club-city">{teamHome.city}</div>
        <div class="club-name">{teamHome.name}</div>
        <div class="club-meta">{teamHome.wins}-{teamHome.losses} · {foulsHome} fouls{foulsHome >= 4 ? ' · bonus' : ''}</div>
      </div>
    </div>

    <div class="score-pill">
      <span class="crest mini" style="background: {teamHome.color};"></span>
      <span class="score-num" class:has-ball={possession === 'home'}>{scoreHome}</span>
      <span class="score-mid">
        <span class="clock">{quarterLabel(currentQuarter)} {formatTimeStr(secondsRemaining)}</span>
        <span class="ball-note">{possession === 'home' ? teamHome.name : teamAway.name}{isTransition ? ' · running' : ''}</span>
      </span>
      <span class="score-num" class:has-ball={possession === 'away'}>{scoreAway}</span>
      <span class="crest mini" style="background: {teamAway.color};"></span>
    </div>

    <div class="match-actions">
      <div class="speeds">
        {#each [1, 2, 5] as speed}
          <button class="speed" class:on={playSpeed === speed} disabled={isRunning} onclick={() => playSpeed = speed}>{speed}x</button>
        {/each}
      </div>
      <button class="sim" onclick={() => { stopGame(); playSpeed = 100; startGame(); }}>Sim</button>
      {#if isRunning}
        <button class="play" onclick={stopGame}>Pause</button>
      {:else}
        <button class="play" onclick={startGame}>Play</button>
      {/if}
    </div>
  </header>

  <div class="stage">
    <aside class="unit">
      <div class="unit-head">
        <span class="pip" style="background: {teamHome.color};"></span>
        <span>On the floor</span>
        <select class="coverage" bind:value={tacticsHome.defensiveCoverage}>
          <option value="drop">Drop</option>
          <option value="blitz">Blitz</option>
          <option value="switch-everything">Switch</option>
          <option value="zone-23">2-3</option>
          <option value="zone-32">3-2</option>
        </select>
      </div>
      {#each onCourtHome as p}
        {@const line = statsHome[p.id]}
        <button class="unit-row" class:active={selectedOnCourtId === p.id} onclick={() => selectedOnCourtId = selectedOnCourtId === p.id ? null : p.id}>
          <span class="jersey-no" style="background: {teamHome.color}; color: {inkFor(teamHome.color)};">{SHIRT[p.position]}</span>
          <span class="unit-name">{lastName(p.name)}</span>
          <span class="ovr">{p.overallRating}</span>
          <span class="pts">{line?.points || 0}</span>
          <span class="pf" class:foul-trouble={(line?.fouls || 0) >= 4}>{line?.fouls || 0}</span>
        </button>
      {/each}
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
    </aside>

    <div class="floor-wrap">
      <div class="floor">
        <svg class="wood" viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="maple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#e7b56a"/>
              <stop offset="0.45" stop-color="#d09245"/>
              <stop offset="1" stop-color="#b8742e"/>
            </linearGradient>
            <pattern id="grain" width="22" height="500" patternUnits="userSpaceOnUse">
              <rect width="11" height="500" fill="rgba(255,255,255,0.035)"/>
            </pattern>
          </defs>
          <rect width="940" height="500" fill="url(#maple)"/>
          <rect width="940" height="500" fill="url(#grain)"/>
          <rect x="10" y="10" width="920" height="480" fill="none" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <line x1="470" y1="10" x2="470" y2="490" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <circle cx="470" cy="250" r="60" fill="none" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <rect x="10" y="170" width="180" height="160" fill="rgba(140,62,24,0.28)" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <rect x="750" y="170" width="180" height="160" fill="rgba(140,62,24,0.28)" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M190 190 A60 60 0 0 1 190 310" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M190 190 A60 60 0 0 0 190 310" fill="none" stroke="rgba(255,248,240,0.55)" stroke-width="3" stroke-dasharray="8 7"/>
          <path d="M750 190 A60 60 0 0 0 750 310" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M750 190 A60 60 0 0 1 750 310" fill="none" stroke="rgba(255,248,240,0.55)" stroke-width="3" stroke-dasharray="8 7"/>
          <path d="M10 32 H142 A237 237 0 0 0 142 468 H10" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M930 32 H798 A237 237 0 0 1 798 468 H930" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <line x1="36" y1="214" x2="36" y2="286" stroke="#f8fafc" stroke-width="5"/>
          <line x1="36" y1="250" x2="52" y2="250" stroke="#f8fafc" stroke-width="3"/>
          <circle cx="58" cy="250" r="9" fill="none" stroke="#ea580c" stroke-width="4"/>
          <line x1="904" y1="214" x2="904" y2="286" stroke="#f8fafc" stroke-width="5"/>
          <line x1="904" y1="250" x2="888" y2="250" stroke="#f8fafc" stroke-width="3"/>
          <circle cx="882" cy="250" r="9" fill="none" stroke="#ea580c" stroke-width="4"/>
        </svg>

        <div class="bball" style="left: {liveBallLocation.x}%; top: {liveBallLocation.y}%;"></div>

        {#each Object.entries(playerCoordinates) as [playerId, c] (playerId)}
          {@const kit = c.side === 'home' ? teamHome : teamAway}
          <div
            class="actor"
            class:defense={!c.isOffense}
            class:hot={playerId === activeShooter}
            style="left: {c.x}%; top: {c.y}%; z-index: {Math.round(c.y)};"
          >
            <svg class="kit" viewBox="0 0 36 30" aria-hidden="true">
              <path d="M8 7 L12 4 H24 L28 7 L33 9 L29 13 V27 H7 V13 L3 9 Z" fill={kit.color} stroke="rgba(0,0,0,0.45)" stroke-width="1"/>
              <path d="M12 4 L18 8 L24 4" fill={kit.trim ?? '#E8E4D9'}/>
              <text x="18" y="21" text-anchor="middle" fill={inkFor(kit.color)} font-size="10" font-weight="800">{SHIRT[c.pos]}</text>
            </svg>
            <span class="plate">{lastName(c.name)}</span>
          </div>
        {/each}
      </div>
      <div class="ticker" class:commentary-score={logsList[0]?.type === 'score'} class:commentary-foul={logsList[0]?.type === 'foul'} class:commentary-turnover={logsList[0]?.type === 'turnover'}>
        {logsList[0]?.text ?? 'Tip-off is next.'}
      </div>
    </div>

    <aside class="unit">
      <div class="unit-head">
        <span class="pip" style="background: {teamAway.color};"></span>
        <span>{teamAway.city}</span>
      </div>
      {#each onCourtAway as p}
        {@const line = statsAway[p.id]}
        <div class="unit-row away">
          <span class="jersey-no" style="background: {teamAway.color}; color: {inkFor(teamAway.color)};">{SHIRT[p.position]}</span>
          <span class="unit-name">{lastName(p.name)}</span>
          <span class="ovr">{p.overallRating}</span>
          <span class="pts">{line?.points || 0}</span>
          <span class="pf" class:foul-trouble={(line?.fouls || 0) >= 4}>{line?.fouls || 0}</span>
        </div>
      {/each}
      <div class="events">
        {#each recent as log}
          <p class:commentary-score={log.type === 'score'} class:commentary-foul={log.type === 'foul'} class:commentary-turnover={log.type === 'turnover'}>{log.text}</p>
        {/each}
      </div>
    </aside>
  </div>

  <div class="stat-row">
    <div class="stat">
      <span>{homeLine.fgm}-{homeLine.fga}</span>
      <div class="bar"><span style="width: {share(homeLine.fgm, awayLine.fgm)}%; background: {teamHome.color};"></span></div>
      <span>FG</span>
      <div class="bar away"><span style="width: {share(awayLine.fgm, homeLine.fgm)}%; background: {teamAway.color};"></span></div>
      <span>{awayLine.fgm}-{awayLine.fga}</span>
    </div>
    <div class="stat">
      <span>{homeLine.reb}</span>
      <div class="bar"><span style="width: {share(homeLine.reb, awayLine.reb)}%; background: {teamHome.color};"></span></div>
      <span>REB</span>
      <div class="bar away"><span style="width: {share(awayLine.reb, homeLine.reb)}%; background: {teamAway.color};"></span></div>
      <span>{awayLine.reb}</span>
    </div>
    <div class="stat">
      <span>{homeLine.ast}</span>
      <div class="bar"><span style="width: {share(homeLine.ast, awayLine.ast)}%; background: {teamHome.color};"></span></div>
      <span>AST</span>
      <div class="bar away"><span style="width: {share(awayLine.ast, homeLine.ast)}%; background: {teamAway.color};"></span></div>
      <span>{awayLine.ast}</span>
    </div>
    <div class="stat">
      <span>{homeLine.tov}</span>
      <div class="bar"><span style="width: {share(homeLine.tov, awayLine.tov)}%; background: {teamHome.color};"></span></div>
      <span>TO</span>
      <div class="bar away"><span style="width: {share(awayLine.tov, homeLine.tov)}%; background: {teamAway.color};"></span></div>
      <span>{awayLine.tov}</span>
    </div>
  </div>

  {#if selectedOnCourtId}
    <div class="bench-row">
      <span class="bench-label">Bring in for {selectedHome?.name}</span>
      {#each teamHome.roster.filter(p => !onCourtHome.some(on => on.id === p.id) && (statsHome[p.id]?.fouls ?? 0) < 6) as p}
        <button class="bench-chip" onclick={() => makeManualSub(p)}>
          {p.position} {p.name}
          <span>Legs {Math.round(p.fatigue)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="card box-card">
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
  .game-screen {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .match-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 8px 10px;
    background: #12151c;
    border: 1px solid #2a3142;
    border-radius: 2px;
  }

  .club {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .crest {
    width: 8px;
    align-self: stretch;
    min-height: 32px;
    border-bottom: 3px solid;
    flex: none;
  }

  .crest.mini {
    width: 8px;
    min-height: 18px;
    align-self: center;
    border: none;
  }

  .club-city {
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .club-name {
    font-family: var(--font-display);
    font-weight: 800;
    line-height: 1.1;
  }

  .club-meta {
    font-size: 0.72rem;
    color: var(--text-secondary);
  }

  .score-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #0c0e14;
    border: 1px solid #2a3142;
    border-radius: 2px;
    padding: 6px 16px;
  }

  .score-num {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.7rem;
    line-height: 1;
    min-width: 1.6ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .score-num.has-ball {
    color: #f6c445;
  }

  .score-mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 92px;
  }

  .clock {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
  }

  .ball-note {
    font-size: 0.68rem;
    color: var(--text-secondary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .match-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  }

  .speeds {
    display: flex;
    background: #0c0e14;
    border-radius: 2px;
    padding: 3px;
    border: 1px solid #2a3142;
  }

  .speed, .sim, .play {
    border: none;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
  }

  .speed {
    background: transparent;
    color: var(--text-secondary);
    border-radius: 2px;
    padding: 6px 8px;
    font-size: 0.75rem;
  }

  .speed.on {
    background: #2a3142;
    color: white;
  }

  .speed:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .sim {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid #2a3142;
    border-radius: 2px;
    padding: 7px 12px;
  }

  .play {
    background: #e7e5e4;
    color: #1c1917;
    border-radius: 2px;
    padding: 8px 16px;
  }

  .stage {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr) 210px;
    gap: 10px;
    align-items: start;
  }

  .unit, .floor-wrap, .stat-row, .box-card {
    background: #12151c;
    border: 1px solid #2a3142;
    border-radius: 2px;
  }

  .unit {
    padding: 8px;
  }

  .unit-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .pip {
    width: 8px;
    height: 8px;
    border-radius: 99px;
  }

  .coverage {
    margin-left: auto;
    background: #0c0e14;
    color: var(--text-primary);
    border: 1px solid #2a3142;
    border-radius: 6px;
    font-size: 0.72rem;
    padding: 3px 4px;
    max-width: 78px;
  }

  .unit-row {
    width: 100%;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) 28px 22px 16px;
    gap: 6px;
    align-items: center;
    text-align: left;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 4px;
    font: inherit;
    cursor: pointer;
  }

  .unit-row.away {
    cursor: default;
  }

  .unit-row.active {
    border-color: #d6d3d1;
    background: rgba(124, 58, 237, 0.12);
  }

  .jersey-no {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: grid;
    place-items: center;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .unit-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
    font-size: 0.86rem;
  }

  .ovr, .pts, .pf {
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    text-align: right;
    color: var(--text-secondary);
  }

  .ovr {
    color: #86efac;
    font-weight: 800;
  }

  .floor-wrap {
    padding: 8px;
    min-width: 0;
  }

  .floor {
    position: relative;
    aspect-ratio: 94 / 50;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.28);
  }

  .wood {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .actor {
    position: absolute;
    transform: translate(-50%, -78%);
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: left 0.55s ease, top 0.55s ease;
    pointer-events: none;
  }

  .kit {
    width: 28px;
    height: 24px;
    filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.45));
  }

  .actor.defense {
    transform: translate(-50%, -18%);
    flex-direction: column-reverse;
  }

  .actor.hot .kit {
    filter: drop-shadow(0 0 4px #f6c445);
  }

  .plate {
    margin-top: -2px;
    background: rgba(8, 10, 16, 0.88);
    color: white;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .bball {
    position: absolute;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 30;
    background:
      radial-gradient(circle at 35% 30%, #ffc56a, #ea580c 55%, #9a3412);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    transition: left 0.4s ease, top 0.4s ease;
  }

  .bball::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 50%;
    background:
      linear-gradient(#3a1d0b, #3a1d0b) center / 100% 1px no-repeat,
      linear-gradient(#3a1d0b, #3a1d0b) center / 1px 100% no-repeat;
    opacity: 0.7;
  }

  .ticker {
    margin-top: 8px;
    background: #0c0e14;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 0.86rem;
    font-weight: 650;
  }

  .events {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
    overflow: auto;
  }

  .events p {
    margin: 0;
    font-size: 0.72rem;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 10px 12px;
  }

  .stat {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr auto;
    gap: 6px;
    align-items: center;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .stat > span:nth-child(3) {
    color: var(--text-muted);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
  }

  .bar {
    height: 6px;
    background: #0c0e14;
    border-radius: 99px;
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
  }

  .bar.away span {
    margin-left: auto;
  }

  .badge-card {
    margin-top: 8px;
    padding: 8px;
    border-radius: 8px;
    background: #0c0e14;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .badge-card p {
    margin: 6px 0 0;
  }

  .badge-card-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--text-primary);
  }

  .mini-badge {
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 2px;
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
  }

  .bench-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .bench-chip {
    background: transparent;
    border: 1px solid #3a4458;
    color: var(--text-primary);
    border-radius: 2px;
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

  .box-card {
    padding: 12px;
  }

  .box-team td {
    background: #0c0e14;
    font-weight: 800;
    font-size: 0.75rem;
    text-align: left !important;
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
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .box-score .on-floor {
    font-weight: 800;
    color: #f6c445;
  }

  .commentary-score { color: #86efac; }
  .commentary-foul { color: #fca5a5; }
  .commentary-turnover { color: #fcd34d; }

  @media (max-width: 1100px) {
    .match-bar,
    .stage,
    .stat-row {
      grid-template-columns: 1fr;
    }
    .match-actions {
      justify-content: flex-start;
    }
  }
</style>
