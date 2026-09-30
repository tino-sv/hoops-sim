<script lang="ts">
  import { LeagueManager } from './sim/league';
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
  import type { CoachStyle, DefensiveCoverage, OffensiveStyle, TeamTactics } from './sim/types';

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
  let activeTab = $state<'dashboard' | 'roster' | 'tactics' | 'standings' | 'league_stats' | 'scouting' | 'free_agents' | 'directory' | 'office' | 'honors' | 'calendar'>('dashboard');
  let awards = $state(league.awards);
  let allStar = $state(league.allStar);
  let cupChampionId = $state(league.cupChampionId);
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
    
    // Save to local storage
    league.saveToLocalStorage();
  };

  let showResetConfirm = $state(false);

  const executeResetLeague = () => {
    league.clearLocalStorage();
    league = new LeagueManager();
    refreshLeagueState();
    showResetConfirm = false;
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
    skipByes();
    refreshLeagueState();
  };

  const handleSimSeason = () => {
    if (!confirm('Sim every remaining regular-season game, including yours? Awards and the Cup resolve at the end. This is for testing.')) return;
    const summary = league.simulateRegularSeason();
    refreshLeagueState();
    alert(`${userTeam.city} ${userTeam.name} finished ${summary.wins}-${summary.losses}.`);
  };

  const handleInstantSim = () => {
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
    activeMatchId = matchId;
  };

  const handleFinishedMatch = (_scoreHome: number, _scoreAway: number, winnerId: string) => {
    const matchId = activeMatchId;
    if (matchId) {
      const match = league.schedule.find(item => item.id === matchId);
      if (match) league.bookWatchedGame(matchId, winnerId === match.homeTeamId);
    }
    activeMatchId = null;
    const match = matchId ? league.schedule.find(item => item.id === matchId) : undefined;
    if (match?.cupKnockout) league.continueCup();
    else {
      league.simulateRound(userTeam.id);
      skipByes();
    }
    refreshLeagueState();
  };

  const handleSaveCoach = (name: string, style: CoachStyle, tempo: TeamTactics['tempo'], offense: OffensiveStyle, coverage: DefensiveCoverage) => {
    league.setCoach(name, style, tempo, offense, coverage);
    refreshLeagueState();
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

<div class="shell-container">
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="logo-icon">🏀</span>
      <div class="logo-text">
        <h1>Hoops Manager</h1>
        <span>PRO SIMULATOR</span>
      </div>
    </div>

    <ul class="sidebar-menu">
      <li class="nav-label">Club</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'dashboard' && !activeMatchId}
          onclick={() => { activeTab = 'dashboard'; activeMatchId = null; }}
        >
          📰 Home
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'roster' && !activeMatchId}
          onclick={() => { activeTab = 'roster'; activeMatchId = null; }}
        >
          📊 Roster & Cap
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'tactics' && !activeMatchId}
          onclick={() => { activeTab = 'tactics'; activeMatchId = null; }}
        >
          📋 Lineups
        </button>
      </li>
      <li class="nav-label">League</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'standings' && !activeMatchId}
          onclick={() => { activeTab = 'standings'; activeMatchId = null; }}
        >
          🏆 Standings
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'league_stats' && !activeMatchId}
          onclick={() => { activeTab = 'league_stats'; activeMatchId = null; }}
        >
          📈 League Leaders
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'scouting' && !activeMatchId}
          onclick={() => { activeTab = 'scouting'; activeMatchId = null; }}
        >
          🧭 Draft Board
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'free_agents' && !activeMatchId}
          onclick={() => { activeTab = 'free_agents'; activeMatchId = null; }}
        >
          🤝 Free Agency
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'directory' && !activeMatchId}
          onclick={() => { activeTab = 'directory'; activeMatchId = null; }}
        >
          🏢 Teams
        </button>
      </li>
      <li class="nav-label">Desk</li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'office' && !activeMatchId}
          onclick={() => { activeTab = 'office'; activeMatchId = null; }}
        >
          💼 Office
        </button>
      </li>
      <li class="menu-item">
        <button
          class="menu-link"
          class:active={activeTab === 'honors' && !activeMatchId}
          onclick={() => { activeTab = 'honors'; activeMatchId = null; }}
        >
          🏆 Honors
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'calendar' && !activeMatchId}
          onclick={() => { activeTab = 'calendar'; activeMatchId = null; }}
        >
          📅 Calendar
        </button>
      </li>
    </ul>

    <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 12px;">
      <div class="user-team-badge" style="border-left-color: {userTeam.color}">
        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Managing</div>
        <div style="color: var(--primary); font-weight: 800;">{userTeam.city} {userTeam.name}</div>
        <div style="font-size: 0.8rem; font-weight: 700; margin-top: 2px;">{userTeam.wins} - {userTeam.losses}</div>
      </div>

      <button 
        class="btn-reset"
        onclick={() => showResetConfirm = true}
      >
        🔄 Reset League
      </button>
    </div>
  </aside>

  <!-- Main Content Shell -->
  <main class="main-content">
    {#if activeMatchId}
      <MatchCenter 
        matchId={activeMatchId} 
        allTeams={league.teams} 
        schedule={league.schedule}
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
        news={news}
        clockLabel={clockLabel}
        onAdvanceRound={handleAdvanceRound}
        onInstantSim={handleInstantSim}
        onSimSeason={handleSimSeason}
        onGoToMatchCenter={handleGoToMatchCenter}
        onEnterOffseason={handleEnterOffseason}
        onStartSeason={handleStartSeason}
        onOpenTab={(tab) => { activeTab = tab; }}
        onNewsRead={handleNewsRead}
      />
    {:else if activeTab === 'roster'}
      <RosterCBA 
        team={league.userTeam()} 
        onWaive={handleWaive}
        onExtend={handleExtend}
      />
    {:else if activeTab === 'tactics'}
      <Chalkboard 
        bind:team={league.teams[0]} 
        onTacticsChanged={refreshLeagueState}
      />
    {:else if activeTab === 'standings'}
      <Standings 
        allTeams={teams}
        userTeamId={userTeamId}
      />
    {:else if activeTab === 'league_stats'}
      <LeagueStats 
        allTeams={teams} 
      />
    {:else if activeTab === 'scouting'}
      <Scouting 
        {draftProspects}
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
      />
    {:else if activeTab === 'office'}
      <FrontOffice
        team={userTeam}
        onSave={handleSaveCoach}
      />
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
  </main>
</div>

{#if showResetConfirm}
  <div class="confirm-overlay">
    <div class="confirm-modal">
      <h3>⚠️ Reset League</h3>
      <p>Are you sure you want to reset the league? This wipes the schedule, the records, and the stats, and starts a fresh 2026 season.</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" onclick={() => showResetConfirm = false}>Cancel</button>
        <button class="btn btn-danger" onclick={executeResetLeague}>Confirm Reset</button>
      </div>
    </div>
  </div>
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

  .btn-reset {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: var(--danger);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reset:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .confirm-modal {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 24px;
    border-radius: 12px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    text-align: center;
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
