<script lang="ts">
  import type { Team, Player } from '../sim/types';
  import type { ScheduledMatch } from '../sim/league';

  let { 
    team, 
    allTeams, 
    schedule, 
    currentRound, 
    totalRounds, 
    onAdvanceRound, 
    onInstantSim,
    onGoToMatchCenter 
  }: { 
    team: Team, 
    allTeams: Team[], 
    schedule: ScheduledMatch[], 
    currentRound: number, 
    totalRounds: number, 
    onAdvanceRound: () => void, 
    onInstantSim: () => void,
    onGoToMatchCenter: (matchId: string) => void 
  } = $props();

  // Fictional inbox messages list
  let inboxMessages = $state([
    {
      id: 'm1',
      sender: 'Owner / Board',
      subject: 'Welcome Coach!',
      body: 'Welcome to the franchise. We expect you to keep our finances in order under the CBA rules while putting together a competitive roster. Good luck this season!',
      date: 'Preseason',
      read: false
    },
    {
      id: 'm2',
      sender: 'Head Trainer',
      subject: 'Stamina report',
      body: ' Roster looks healthy for the season opener. Make sure to monitor physical fatigue during games, as tired players show a 25% drop in shot accuracy and increase defense errors.',
      date: 'Preseason',
      read: false
    }
  ]);
  let selectedMessage = $state(inboxMessages[0]);

  // Derived standings
  let standings = $derived(
    [...allTeams].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    })
  );

  // User team rank
  let userRank = $derived(standings.findIndex(t => t.id === team.id) + 1);

  // Find next match for the user's team
  let nextUserMatch = $derived(
    schedule.find(m => m.round === currentRound && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );

  let nextOpponent = $derived.by(() => {
    if (!nextUserMatch) return null;
    const isHome = nextUserMatch.homeTeamId === team.id;
    const oppId = isHome ? nextUserMatch.awayTeamId : nextUserMatch.homeTeamId;
    return allTeams.find(t => t.id === oppId) || null;
  });

  let activeLeaderTab = $state<'pts' | 'ast' | 'reb' | 'stl' | 'blk'>('pts');

  // Derived top players in the league based on selected tab
  let leagueLeaders = $derived.by(() => {
    const allPlayers: { player: Player; teamName: string; avgValue: number }[] = [];
    allTeams.forEach(t => {
      t.roster.forEach(p => {
        const stats = p.careerStats['season'];
        const played = (stats as any)?.games || (t.wins + t.losses) || 0;
        if (!stats || played === 0) return;

        let val = 0;
        if (activeLeaderTab === 'pts') val = stats.points / played;
        else if (activeLeaderTab === 'ast') val = stats.assists / played;
        else if (activeLeaderTab === 'reb') val = stats.rebounds / played;
        else if (activeLeaderTab === 'stl') val = stats.steals / played;
        else if (activeLeaderTab === 'blk') val = stats.blocks / played;

        allPlayers.push({ player: p, teamName: t.name, avgValue: val });
      });
    });
    return allPlayers.sort((a, b) => b.avgValue - a.avgValue).slice(0, 5);
  });

  const readMessage = (msg: typeof inboxMessages[0]) => {
    msg.read = true;
    selectedMessage = msg;
  };

  const advanceDay = () => {
    // If it's a match day for the user, go to match center instead
    if (nextUserMatch && !nextUserMatch.simulated) {
      onGoToMatchCenter(nextUserMatch.id);
    } else {
      onAdvanceRound();
    }
  };
</script>

<div class="dashboard-page fade-in">
  <!-- Top Welcome / Quick Stats -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
    <div>
      <h2 style="font-size: 1.8rem; font-weight: 800;">Welcome, General Manager</h2>
      <p style="color: var(--text-secondary);">Season {2026} • Round {currentRound} of {totalRounds}</p>
    </div>
    
    <div style="display: flex; gap: 12px;">
      {#if nextUserMatch && !nextUserMatch.simulated}
        <button class="btn btn-secondary" onclick={onInstantSim}>
          ⚡ Instant Sim
        </button>
        <button class="btn btn-primary" onclick={advanceDay}>
          🏀 Play Game vs {nextOpponent?.name}
        </button>
      {:else}
        <button class="btn btn-primary" onclick={advanceDay}>
          ⏩ Advance Round ({currentRound}/{totalRounds})
        </button>
      {/if}
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- Team Summary Card -->
    <div class="card" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h3 style="color: var(--primary); margin-bottom: 4px;">{team.city} {team.name}</h3>
        <span class="badge badge-secondary">Rank #{userRank} in League</span>
        
        <div style="margin-top: 24px; display: flex; align-items: baseline; gap: 12px;">
          <span style="font-size: 3rem; font-family: var(--font-display); font-weight: 900; line-height: 1;">
            {team.wins} - {team.losses}
          </span>
          <span style="color: var(--text-secondary); font-size: 0.95rem;">
            ({Math.round((team.wins / Math.max(1, team.wins + team.losses)) * 100)}% Win Pct)
          </span>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 16px; display: flex; justify-content: space-between; font-size: 0.85rem;">
        <div><b>Point Diff:</b> <span style="color: {team.pointDiff >= 0 ? 'var(--primary)' : 'var(--danger)'}">{team.pointDiff > 0 ? '+' : ''}{team.pointDiff}</span></div>
        <div><b>Salaries:</b> ${(team.finances.salariesTotal / 1000000).toFixed(1)}M</div>
      </div>
    </div>

    <!-- Next Match Card -->
    <div class="card" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h3 class="card-title">Next Fixture <span class="badge badge-primary">ROUND {currentRound}</span></h3>
        
        {#if nextOpponent}
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 1.5rem; font-weight: 800;">{team.name}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">Home</div>
            </div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-muted);">VS</div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--secondary);">{nextOpponent.name}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">{nextOpponent.city} ({nextOpponent.wins}-{nextOpponent.losses})</div>
            </div>
          </div>
        {:else}
          <div style="text-align: center; color: var(--text-muted); margin-top: 20px;">
            No upcoming matches left this season.
          </div>
        {/if}
      </div>

      <div style="margin-top: 16px; display: flex; gap: 8px;">
        {#if nextUserMatch && !nextUserMatch.simulated}
          <button class="btn btn-secondary" style="flex: 1;" onclick={onInstantSim}>
            ⚡ Instant Sim
          </button>
          <button class="btn btn-primary" style="flex: 2;" onclick={advanceDay}>
            🏀 Enter Match Center
          </button>
        {:else}
          <button class="btn btn-secondary" style="width: 100%; cursor: not-allowed;" disabled>
            Simulated / Done
          </button>
        {/if}
      </div>
    </div>

    <!-- League Leaders Card -->
    <div class="card" style="grid-column: span 4;">
      <h3 class="card-title" style="margin-bottom: 8px;">League Leaders</h3>
      
      <div style="display: flex; gap: 4px; margin-bottom: 12px; font-size: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; width: 100%; justify-content: space-between;">
        <button style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: {activeLeaderTab === 'pts' ? '800' : '400'}; color: {activeLeaderTab === 'pts' ? 'var(--primary)' : 'var(--text-secondary)'}; background-color: {activeLeaderTab === 'pts' ? 'var(--primary-glow)' : 'transparent'};" onclick={() => activeLeaderTab = 'pts'}>PTS</button>
        <button style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: {activeLeaderTab === 'ast' ? '800' : '400'}; color: {activeLeaderTab === 'ast' ? 'var(--primary)' : 'var(--text-secondary)'}; background-color: {activeLeaderTab === 'ast' ? 'var(--primary-glow)' : 'transparent'};" onclick={() => activeLeaderTab = 'ast'}>AST</button>
        <button style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: {activeLeaderTab === 'reb' ? '800' : '400'}; color: {activeLeaderTab === 'reb' ? 'var(--primary)' : 'var(--text-secondary)'}; background-color: {activeLeaderTab === 'reb' ? 'var(--primary-glow)' : 'transparent'};" onclick={() => activeLeaderTab = 'reb'}>REB</button>
        <button style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: {activeLeaderTab === 'stl' ? '800' : '400'}; color: {activeLeaderTab === 'stl' ? 'var(--primary)' : 'var(--text-secondary)'}; background-color: {activeLeaderTab === 'stl' ? 'var(--primary-glow)' : 'transparent'};" onclick={() => activeLeaderTab = 'stl'}>STL</button>
        <button style="background: none; border: none; cursor: pointer; font-family: inherit; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: {activeLeaderTab === 'blk' ? '800' : '400'}; color: {activeLeaderTab === 'blk' ? 'var(--primary)' : 'var(--text-secondary)'}; background-color: {activeLeaderTab === 'blk' ? 'var(--primary-glow)' : 'transparent'};" onclick={() => activeLeaderTab = 'blk'}>BLK</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        {#each leagueLeaders as leader, idx}
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; color: var(--text-muted);">#{idx + 1}</span>
              <div>
                <div style="font-weight: 700;">{leader.player.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">{leader.teamName} • {leader.player.position}</div>
              </div>
            </div>
            <span style="font-weight: 800; color: var(--primary);">
              {leader.avgValue.toFixed(1)} 
              {#if activeLeaderTab === 'pts'}PPG
              {:else if activeLeaderTab === 'ast'}APG
              {:else if activeLeaderTab === 'reb'}RPG
              {:else if activeLeaderTab === 'stl'}SPG
              {:else}BPG
              {/if}
            </span>
          </div>
        {:else}
          <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            No statistics recorded yet. Play a game to record stats.
          </div>
        {/each}
      </div>
    </div>

    <!-- Inbox & Mail Card -->
    <div class="card" style="grid-column: span 6; display: flex; flex-direction: column; gap: 16px;">
      <h3 class="card-title">Office Inbox</h3>
      
      <div style="display: flex; gap: 16px; height: 260px;">
        <!-- Mail List -->
        <div style="width: 35%; border-right: 1px solid var(--border-color); overflow-y: auto; padding-right: 8px; display: flex; flex-direction: column; gap: 6px;">
          {#each inboxMessages as msg}
            <button 
              class="mail-item-btn" 
              class:active={selectedMessage.id === msg.id}
              class:unread={!msg.read}
              onclick={() => readMessage(msg)}
            >
              <div style="font-weight: 700; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{msg.sender}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{msg.subject}</div>
            </button>
          {/each}
        </div>

        <!-- Mail Body -->
        <div style="width: 65%; display: flex; flex-direction: column; gap: 10px; padding-left: 8px;">
          {#if selectedMessage}
            <div>
              <div style="font-weight: 800; font-size: 1rem; color: var(--primary);">{selectedMessage.subject}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">From: <b>{selectedMessage.sender}</b> • {selectedMessage.date}</div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.5; overflow-y: auto; flex-grow: 1;">
              {selectedMessage.body}
            </p>
          {:else}
            <div style="text-align: center; color: var(--text-muted); margin-top: 60px;">
              Select a message to read.
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Standings Card -->
    <div class="card" style="grid-column: span 6;">
      <h3 class="card-title">League Standings</h3>
      
      <div class="table-container" style="max-height: 260px; overflow-y: auto;">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>PD</th>
            </tr>
          </thead>
          <tbody>
            {#each standings as t, idx}
              <tr class:user-row={t.id === team.id}>
                <td><span style="font-weight: 800; color: {idx < 8 ? 'var(--primary)' : 'var(--text-muted)'}">{idx + 1}</span></td>
                <td style="font-weight: 700;">{t.city} {t.name}</td>
                <td>{t.wins}</td>
                <td>{t.losses}</td>
                <td style="color: {t.pointDiff >= 0 ? 'var(--primary)' : 'var(--danger)'}">
                  {t.pointDiff > 0 ? '+' : ''}{t.pointDiff}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<style>
  .mail-item-btn {
    width: 100%;
    background-color: var(--bg-darker);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mail-item-btn:hover {
    background-color: var(--bg-card-hover);
  }

  .mail-item-btn.active {
    background-color: var(--primary-glow);
    border-color: var(--primary);
  }

  .mail-item-btn.unread {
    border-left: 3px solid var(--primary);
  }

  .user-row {
    background-color: var(--secondary-glow) !important;
  }
</style>
