<script lang="ts">
  import { unansweredDemand } from './sim/badges';
  import { LeagueManager, type HiredCoach, type PlayoffSeries } from './sim/league';
  import type { PressAsk } from './sim/types';
  import Dashboard from './pages/Dashboard.svelte';
  import RosterCBA from './pages/RosterCBA.svelte';
  import Chalkboard from './components/Chalkboard.svelte';
  import MatchCenter from './pages/MatchCenter.svelte';
  import Standings from './pages/Standings.svelte';
  import LeagueStats from './pages/LeagueStats.svelte';
  import Scouting from './pages/Scouting.svelte';
  import FreeAgents from './pages/FreeAgents.svelte';
  import TeamDirectory from './pages/TeamDirectory.svelte';
  import Calendar from './pages/Calendar.svelte';
  import FrontOffice from './pages/FrontOffice.svelte';
  import Honors from './pages/Honors.svelte';
  import Playoffs from './pages/Playoffs.svelte';
  import TeamSelect from './pages/TeamSelect.svelte';
  import Wire from './pages/Wire.svelte';
  import Finances from './pages/Finances.svelte';
  import StatusRibbon from './components/StatusRibbon.svelte';
  import type { CoachStyle, DefensiveCoverage, MarketDeal, OffensiveStyle, TeamTactics } from './sim/types';

  // Instantiate League Manager
  let league = $state(new LeagueManager());
  
  // Svelte 5 reactive states to trigger re-renders
  let currentRound = $state(league.currentRound);
  let schedule = $state(league.schedule);
  let teams = $state(league.teams);
  let phase = $state(league.phase);
  let offseasonStep = $state(league.offseasonStep);
  let seasonComplete = $state(league.seasonComplete);
  let season = $state(league.season);
  let news = $state(league.news);
  let pressAsk = $state<PressAsk | null>(league.press);
  let wire = $state(league.wire);
  let userTeamId = $state(league.userTeamId);
  let draftProspects = $state(league.draftProspects);
  let freeAgents = $state(league.freeAgents);
  let scoutingTokens = $state(league.scoutingTokens);
  let draftOrder = $state(league.draftOrder);
  let draftIndex = $state(league.draftIndex);
  let totalRounds = $state(league.totalRounds);

  let userTeam = $derived(teams.find(team => team.id === userTeamId) ?? teams[0]);
  let onTheClock = $derived(
    phase === 'offseason' && offseasonStep === 'draft' && draftOrder[draftIndex]?.teamId === userTeamId
  );
  let clockLabel = $derived.by(() => {
    const pick = draftOrder[draftIndex];
    if (!pick) return 'Draft complete';
    const club = teams.find(team => team.id === pick.teamId);
    return `Round ${pick.round}, pick ${pick.pick}${club ? ` — ${club.city}` : ''}`;
  });

  // Routing State
  let activeTab = $state<'dashboard' | 'roster' | 'tactics' | 'standings' | 'playoffs' | 'league_stats' | 'scouting' | 'free_agents' | 'directory' | 'office' | 'honors' | 'calendar' | 'wire' | 'finances'>('dashboard');
  let awards = $state(league.awards);
  let allStar = $state(league.allStar);
  let cupChampionId = $state(league.cupChampionId);
  let playoffSeries = $state<PlayoffSeries[]>(league.playoffSeries);
  let championId = $state(league.championId);
  let allStarDate = $state(league.allStarDate);
  let activeMatchId = $state<string | null>(null); // If active, shows MatchCenter

  // Trigger Svelte state refresh
  const refreshLeagueState = () => {
    // Re-assign local states to trigger reactive updates in the UI
    teams = [...league.teams];
    schedule = [...league.schedule];
    currentRound = league.currentRound;
    totalRounds = league.totalRounds;
    phase = league.phase;
    offseasonStep = league.offseasonStep;
    seasonComplete = league.seasonComplete;
    season = league.season;
    news = [...league.news];
    pressAsk = league.press;
    wire = [...league.wire];
    userTeamId = league.userTeamId;
    draftProspects = [...league.draftProspects];
    freeAgents = [...league.freeAgents];
    scoutingTokens = league.scoutingTokens;
    draftOrder = [...league.draftOrder];
    draftIndex = league.draftIndex;
    awards = league.awards;
    allStar = league.allStar;
    cupChampionId = league.cupChampionId;
    allStarDate = league.allStarDate;
    playoffSeries = league.playoffSeries.map(series => ({ ...series, playedIds: [...series.playedIds] }));
    championId = league.championId;
    
    // Save to local storage
    league.saveToLocalStorage();
  };

  let showResetConfirm = $state(false);
  let pickingTeam = $state(league.teams.length === 0);
  let userIndex = $derived(teams.findIndex(team => team.id === userTeamId));

  const startCareer = (teamId: string, coach: HiredCoach) => {
    league.initializeLeague(teamId, coach);
    refreshLeagueState();
    activeTab = 'dashboard';
    activeMatchId = null;
    pickingTeam = false;
  };

  const executeResetLeague = () => {
    league.clearLocalStorage();
    league = new LeagueManager();
    showResetConfirm = false;
    activeMatchId = null;
    pickingTeam = true;
  };

  const holdForAnswer = () => {
    if (!league.press && !unansweredDemand(userTeam.roster)) return false;
    activeTab = 'dashboard';
    activeMatchId = null;
    return true;
  };

  const skipByes = () => {
    let guard = 0;
    while (guard++ < 12 && !league.seasonComplete && !league.userCupGame()) {
      const due = league.schedule.some(match => match.round === league.currentRound && !match.simulated && (match.homeTeamId === userTeam.id || match.awayTeamId === userTeam.id));
      if (due) return;
      const before = league.currentRound;
      league.simulateRound(userTeam.id);
      if (league.currentRound === before) return;
    }
  };

  const handleAdvanceRound = () => {
    if (holdForAnswer()) return;
    skipByes();
    refreshLeagueState();
  };

  const handleSimSeason = () => {
    if (holdForAnswer()) return;
    if (!confirm('Sim every remaining regular-season game, including yours? Awards and the Cup resolve at the end, then the playoff bracket is set. This is for testing.')) return;
    const summary = league.simulateRegularSeason();
    refreshLeagueState();
    alert(`${userTeam.city} ${userTeam.name} finished ${summary.wins}-${summary.losses}. The playoffs are up.`);
  };

  const handlePlayoffNight = () => {
    if (holdForAnswer()) return;
    league.playoffNight(false);
    refreshLeagueState();
  };

  const handleSimPlayoffs = () => {
    if (holdForAnswer()) return;
    if (!confirm('Sim every remaining playoff game, including yours? This is for testing.')) return;
    const winnerId = league.simulatePlayoffs();
    refreshLeagueState();
    const winner = league.teams.find(team => team.id === winnerId);
    alert(winner ? `${winner.city} ${winner.name} won the championship.` : 'The bracket is still going.');
  };

  const handleInstantSim = () => {
    if (holdForAnswer()) return;
    const playoff = league.userPlayoffGame();
    if (playoff) {
      const oppId = playoff.homeTeamId === userTeam.id ? playoff.awayTeamId : playoff.homeTeamId;
      const opp = league.teams.find(club => club.id === oppId);
      league.playoffNight(true);
      const played = league.schedule.find(match => match.id === playoff.id);
      alert(`Playoff final: ${played?.scoreHome}-${played?.scoreAway} vs ${opp?.name ?? 'opponent'}`);
      refreshLeagueState();
      return;
    }
    const cup = league.userCupGame();
    if (cup) {
      const oppId = cup.homeTeamId === userTeam.id ? cup.awayTeamId : cup.homeTeamId;
      const opp = league.teams.find(club => club.id === oppId);
      league.simUserCup();
      const played = league.schedule.find(match => match.id === cup.id);
      alert(`Cup game final: ${played?.scoreHome}-${played?.scoreAway} vs ${opp?.name ?? 'opponent'}`);
      refreshLeagueState();
      return;
    }
    league.simulateRound(userTeam.id, (result) => {
      const opp = league.teams.find(t => t.id === (result.teamAId === userTeam.id ? result.teamBId : result.teamAId))!;
      const userScore = result.teamAId === userTeam.id ? result.teamAScore : result.teamBScore;
      const oppScore = result.teamAId === userTeam.id ? result.teamBScore : result.teamAScore;
      const outcome = userScore > oppScore ? 'WON!' : (userScore < oppScore ? 'LOST.' : 'tied.');
      alert(`Instant Sim Complete!\n\n${userTeam.name} ${outcome}\nFinal Score: ${userTeam.name} ${userScore} - ${oppScore} ${opp.name}`);
    });
    refreshLeagueState();
  };

  const handleGoToMatchCenter = (matchId: string) => {
    if (holdForAnswer()) return;
    activeMatchId = matchId;
  };

  const handleFinishedMatch = (_scoreHome: number, _scoreAway: number, winnerId: string, minutes: { home: Record<string, number>; away: Record<string, number> }) => {
    const matchId = activeMatchId;
    if (matchId) {
      const match = league.schedule.find(item => item.id === matchId);
      if (match) league.bookWatchedGame(matchId, winnerId === match.homeTeamId, minutes);
    }
    activeMatchId = null;
    const match = matchId ? league.schedule.find(item => item.id === matchId) : undefined;
    if (match?.cupKnockout) league.continueCup();
    else if (match?.playoff) league.finishWatchedPlayoff(match.id);
    else {
      league.simulateRound(userTeam.id);
      skipByes();
    }
    refreshLeagueState();
  };

  const handleSaveCoach = (coach: HiredCoach) => {
    league.setCoach(coach);
    refreshLeagueState();
  };

  const handleTvDeal = (tier: MarketDeal) => {
    const result = league.setTvDeal(tier);
    refreshLeagueState();
    return result;
  };

  const handleJersey = (color: string, trim: string) => {
    const result = league.setJersey(color, trim);
    refreshLeagueState();
    return result;
  };

  const handleMove = (city: string) => {
    const result = league.setHomeCity(city);
    refreshLeagueState();
    return result;
  };

  const handleEnterOffseason = () => {
    const result = league.enterOffseason();
    refreshLeagueState();
    return result;
  };

  const handleStartSeason = () => {
    const result = league.startNewSeason();
    refreshLeagueState();
    return result;
  };

  const handleScout = (prospectId: string) => {
    league.scoutProspect(prospectId);
    refreshLeagueState();
  };

  const handleDraft = (prospectId: string) => {
    const result = league.draftProspect(prospectId);
    refreshLeagueState();
    return result;
  };

  const handleSignFreeAgent = (playerId: string, salary: number, years: number) => {
    const result = league.signFreeAgent(playerId, salary, years);
    refreshLeagueState();
    return result;
  };

  const handleWaive = (playerId: string) => {
    const result = league.waive(playerId);
    refreshLeagueState();
    return result;
  };

  const handleExtend = (playerId: string, salary: number, years: number) => {
    const result = league.extend(playerId, salary, years);
    refreshLeagueState();
    return result;
  };

  const handleNewsRead = () => {
    league.saveToLocalStorage();
  };
</script>

{#if pickingTeam}
  <TeamSelect onStart={startCareer} />
{:else}
<div class="shell-container">
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-text">
        <h1>Hoops</h1>
      </div>
    </div>

    <ul class="sidebar-menu">
      <li class="nav-label">Team</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'dashboard' && !activeMatchId}
          onclick={() => { activeTab = 'dashboard'; activeMatchId = null; }}
        >
          Home
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'roster' && !activeMatchId}
          onclick={() => { activeTab = 'roster'; activeMatchId = null; }}
        >
          Roster
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'tactics' && !activeMatchId}
          onclick={() => { activeTab = 'tactics'; activeMatchId = null; }}
        >
          Lineups
        </button>
      </li>
      <li class="nav-label">League</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'standings' && !activeMatchId}
          onclick={() => { activeTab = 'standings'; activeMatchId = null; }}
        >
          Standings
        </button>
      </li>
      <li class="menu-item">
        <button
          class="menu-link"
          class:active={activeTab === 'playoffs' && !activeMatchId}
          onclick={() => { activeTab = 'playoffs'; activeMatchId = null; }}
        >
          Playoffs
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'league_stats' && !activeMatchId}
          onclick={() => { activeTab = 'league_stats'; activeMatchId = null; }}
        >
          Leaders
        </button>
      </li>
      <li class="menu-item">
        <button
          class="menu-link"
          class:active={activeTab === 'honors' && !activeMatchId}
          onclick={() => { activeTab = 'honors'; activeMatchId = null; }}
        >
          Honors
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'scouting' && !activeMatchId}
          onclick={() => { activeTab = 'scouting'; activeMatchId = null; }}
        >
          Draft
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'free_agents' && !activeMatchId}
          onclick={() => { activeTab = 'free_agents'; activeMatchId = null; }}
        >
          Free agency
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'directory' && !activeMatchId}
          onclick={() => { activeTab = 'directory'; activeMatchId = null; }}
        >
          Teams
        </button>
      </li>
      <li class="nav-label">Desk</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'office' && !activeMatchId}
          onclick={() => { activeTab = 'office'; activeMatchId = null; }}
        >
          Office
        </button>
      </li>
      <li class="menu-item">
        <button
          class="menu-link"
          class:active={activeTab === 'finances' && !activeMatchId}
          onclick={() => { activeTab = 'finances'; activeMatchId = null; }}
        >
          Books
        </button>
      </li>
      <li class="menu-item">
        <button
          class="menu-link"
          class:active={activeTab === 'wire' && !activeMatchId}
          onclick={() => { activeTab = 'wire'; activeMatchId = null; }}
        >
          Wire
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'calendar' && !activeMatchId}
          onclick={() => { activeTab = 'calendar'; activeMatchId = null; }}
        >
          Calendar
        </button>
      </li>
    </ul>

    <div class="sidebar-footer">
      <div class="user-team-badge" style="border-left-color: {userTeam.color}; box-shadow: inset 0 -3px 0 {userTeam.trim ?? '#E8E4D9'};">
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Your team</div>
        <div style="font-weight: 650;">{userTeam.city} {userTeam.name}</div>
        <div style="font-size: 0.8rem; font-weight: 700; margin-top: 2px;">{userTeam.wins} - {userTeam.losses}</div>
      </div>

      <button 
        class="btn-reset"
        onclick={() => showResetConfirm = true}
      >
        Reset
      </button>
    </div>
  </aside>

  <!-- Main Content Shell -->
  <main class="main-content">
    <StatusRibbon
      team={userTeam}
      allTeams={teams}
      {schedule}
      {currentRound}
      {phase}
      {offseasonStep}
      {seasonComplete}
      {playoffSeries}
      {championId}
      {news}
      {pressAsk}
      {season}
      inMatch={!!activeMatchId}
      onAdvance={handleAdvanceRound}
      onPlayoffNight={handlePlayoffNight}
      onGoToMatch={handleGoToMatchCenter}
      onEnterOffseason={handleEnterOffseason}
      onStartSeason={handleStartSeason}
      onOpenHome={() => { activeTab = 'dashboard'; activeMatchId = null; }}
      onOpenDraft={() => { activeTab = 'scouting'; activeMatchId = null; }}
    />
    <div class="desk">
    {#if activeMatchId}
      <MatchCenter 
        matchId={activeMatchId} 
        allTeams={league.teams} 
        schedule={league.schedule}
        {userTeamId}
        onFinishedMatch={handleFinishedMatch}
      />
    {:else if activeTab === 'dashboard'}
      <Dashboard 
        team={userTeam} 
        allTeams={teams} 
        schedule={schedule} 
        currentRound={currentRound} 
        totalRounds={totalRounds}
        season={season}
        phase={phase}
        offseasonStep={offseasonStep}
        seasonComplete={seasonComplete}
        playoffSeries={playoffSeries}
        {championId}
        news={news}
        {pressAsk}
        onSimSeason={handleSimSeason}
        onSimPlayoffs={handleSimPlayoffs}
        onOpenTab={(tab) => { activeTab = tab; }}
        onNewsRead={handleNewsRead}
        onAnswer={(playerId, choice) => { league.hearDemand(playerId, choice); refreshLeagueState(); }}
        onPress={(choice) => { league.answerPress(choice); refreshLeagueState(); }}
      />
    {:else if activeTab === 'roster'}
      <RosterCBA 
        team={league.userTeam()} 
        onWaive={handleWaive}
        onExtend={handleExtend}
      />
    {:else if activeTab === 'tactics'}
      <Chalkboard 
        bind:team={league.teams[userIndex]} 
        onTacticsChanged={refreshLeagueState}
      />
    {:else if activeTab === 'standings'}
      <Standings 
        allTeams={teams}
        userTeamId={userTeamId}
      />
    {:else if activeTab === 'playoffs'}
      <Playoffs
        allTeams={teams}
        {schedule}
        series={playoffSeries}
        {userTeamId}
        {championId}
        {seasonComplete}
        onPlay={handleGoToMatchCenter}
        onSimNight={handlePlayoffNight}
        onSimRest={handleSimPlayoffs}
      />
    {:else if activeTab === 'league_stats'}
      <LeagueStats 
        allTeams={teams} 
      />
    {:else if activeTab === 'scouting'}
      <Scouting 
        {draftProspects}
        roster={userTeam.roster}
        {scoutingTokens}
        {phase}
        {offseasonStep}
        {onTheClock}
        {clockLabel}
        onScout={handleScout}
        onDraft={handleDraft}
      />
    {:else if activeTab === 'free_agents'}
      <FreeAgents 
        team={league.userTeam()}
        {freeAgents}
        {phase}
        {offseasonStep}
        onSign={handleSignFreeAgent}
      />
    {:else if activeTab === 'directory'}
      <TeamDirectory 
        allTeams={teams}
        {userTeamId}
      />
    {:else if activeTab === 'office'}
      <FrontOffice
        team={userTeam}
        onSave={handleSaveCoach}
        onTvDeal={handleTvDeal}
        onJersey={handleJersey}
        onMove={handleMove}
      />
    {:else if activeTab === 'finances'}
      <Finances team={teams[userIndex]} />
    {:else if activeTab === 'wire'}
      <Wire posts={wire} />
    {:else if activeTab === 'honors'}
      <Honors
        allTeams={teams}
        {awards}
        {allStar}
        {cupChampionId}
        {userTeam}
      />
    {:else if activeTab === 'calendar'}
      <Calendar
        team={userTeam}
        allTeams={teams}
        {schedule}
        {currentRound}
        {allStarDate}
        onPlay={handleGoToMatchCenter}
      />
    {/if}
    </div>
  </main>
</div>

{#if showResetConfirm}
  <div class="confirm-overlay">
    <div class="confirm-modal">
      <h3>Reset the league</h3>
      <p>This wipes the schedule, the records, and the stats. You pick a franchise again.</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" onclick={() => showResetConfirm = false}>Cancel</button>
        <button class="btn btn-danger" onclick={executeResetLeague}>Confirm Reset</button>
      </div>
    </div>
  </div>
{/if}
{/if}

<style>
  /* Sidebar buttons override standard list button reset styles */
  .menu-link {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    width: 100%;
    color: var(--text-secondary);
  }

  .menu-link.active {
    color: #f4f4f5;
    box-shadow: inset 2px 0 0 #f4f4f5;
  }

  .btn-reset {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 2px;
    padding: 6px 10px;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .btn-reset:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .confirm-modal {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 24px;
    border-radius: 2px;
    max-width: 400px;
    width: 90%;
    text-align: left;
  }

  .confirm-modal h3 {
    margin-top: 0;
    color: var(--danger);
    font-size: 1.25rem;
    font-weight: 800;
  }

  .confirm-modal p {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 16px 0 24px 0;
  }

  .confirm-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .btn-danger {
    background: var(--danger);
    color: #fff;
    border: none;
    cursor: pointer;
  }

  .btn-danger:hover {
    background: #dc2626;
  }
</style>
