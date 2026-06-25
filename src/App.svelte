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
  import type { Team } from './sim/types';

  // Instantiate League Manager
  let league = $state(new LeagueManager());
  
  // Svelte 5 reactive states to trigger re-renders
  let currentRound = $state(league.currentRound);
  let schedule = $state(league.schedule);
  let teams = $state(league.teams);

  // Find User Team (derived from reactive teams state)
  let userTeam = $derived(teams[0]);

  // Routing State
  let activeTab = $state<'dashboard' | 'roster' | 'tactics' | 'standings' | 'league_stats' | 'scouting' | 'free_agents' | 'directory'>('dashboard');
  let activeMatchId = $state<string | null>(null); // If active, shows MatchCenter

  // Trigger Svelte state refresh
  const refreshLeagueState = () => {
    // Re-assign local states to trigger reactive updates in the UI
    teams = [...league.teams];
    schedule = [...league.schedule];
    currentRound = league.currentRound;
    
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

  const handleAdvanceRound = () => {
    // Advance league schedule for other teams
    league.simulateRound(userTeam.id);
    refreshLeagueState();
  };

  const handleInstantSim = () => {
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

  const handleFinishedMatch = (scoreHome: number, scoreAway: number, winnerId: string) => {
    // Return back to dashboard, simulate rest of round matches, and save/refresh
    activeMatchId = null;
    league.simulateRound(userTeam.id);
    refreshLeagueState();
  };

  const handleProspectDrafted = (prospectId: string) => {
    // Find the user team in the league (we need the mutable reference)
    const liveUserTeam = league.teams[0];
    if (!liveUserTeam) return;
    league.draftProspect(prospectId, liveUserTeam);
    refreshLeagueState();
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

    <ul class="sidebar-menu" style="overflow-y: auto;">
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'dashboard' && !activeMatchId}
          onclick={() => { activeTab = 'dashboard'; activeMatchId = null; }}
        >
          📰 Dashboard Home
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'roster' && !activeMatchId}
          onclick={() => { activeTab = 'roster'; activeMatchId = null; }}
        >
          📊 Roster & Salary Cap
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'tactics' && !activeMatchId}
          onclick={() => { activeTab = 'tactics'; activeMatchId = null; }}
        >
          📋 Tactics & Chalkboard
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'standings' && !activeMatchId}
          onclick={() => { activeTab = 'standings'; activeMatchId = null; }}
        >
          🏆 League Standings
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'league_stats' && !activeMatchId}
          onclick={() => { activeTab = 'league_stats'; activeMatchId = null; }}
        >
          📈 Player Statistics
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'scouting' && !activeMatchId}
          onclick={() => { activeTab = 'scouting'; activeMatchId = null; }}
        >
          🧭 College Scouting
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'free_agents' && !activeMatchId}
          onclick={() => { activeTab = 'free_agents'; activeMatchId = null; }}
        >
          🤝 Free Agents Market
        </button>
      </li>
      <li class="menu-item">
        <button 
          class="menu-link" 
          class:active={activeTab === 'directory' && !activeMatchId}
          onclick={() => { activeTab = 'directory'; activeMatchId = null; }}
        >
          🏢 Team Directory
        </button>
      </li>
    </ul>

    <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 12px;">
      <div class="user-team-badge">
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
        totalRounds={league.totalRounds}
        onAdvanceRound={handleAdvanceRound}
        onInstantSim={handleInstantSim}
        onGoToMatchCenter={handleGoToMatchCenter}
      />
    {:else if activeTab === 'roster'}
      <RosterCBA 
        team={league.teams[0]} 
        otherTeams={league.teams.filter(t => t.id !== league.teams[0].id)} 
        onRosterChanged={refreshLeagueState}
      />
    {:else if activeTab === 'tactics'}
      <Chalkboard 
        bind:team={league.teams[0]} 
        onTacticsChanged={refreshLeagueState}
      />
    {:else if activeTab === 'standings'}
      <Standings 
        allTeams={teams} 
      />
    {:else if activeTab === 'league_stats'}
      <LeagueStats 
        allTeams={teams} 
      />
    {:else if activeTab === 'scouting'}
      <Scouting 
        bind:draftProspects={league.draftProspects} 
        bind:scoutingTokens={league.scoutingTokens}
        userTeam={league.teams[0]}
        onScoutingChanged={refreshLeagueState}
        onProspectDrafted={handleProspectDrafted}
      />
    {:else if activeTab === 'free_agents'}
      <FreeAgents 
        bind:team={league.teams[0]} 
        bind:freeAgents={league.freeAgents} 
        onRosterChanged={refreshLeagueState}
      />
    {:else if activeTab === 'directory'}
      <TeamDirectory 
        allTeams={teams} 
      />
    {/if}
  </main>
</div>

{#if showResetConfirm}
  <div class="confirm-overlay">
    <div class="confirm-modal">
      <h3>⚠️ Reset League</h3>
      <p>Are you sure you want to reset the league? This will erase all matches, records, and stats, and start a fresh 2026 season.</p>
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
