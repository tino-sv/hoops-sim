<script lang="ts">
  import type { Team } from '../sim/types';

  let { allTeams }: { allTeams: Team[] } = $props();

  // Sort teams by Wins (descending), then Losses (ascending), then Point Diff (descending)
  let sortedTeams = $derived(
    [...allTeams].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.pointDiff - a.pointDiff;
    })
  );

  // Compute Games Behind (GB) relative to the leader
  let leader = $derived(sortedTeams[0]);

  const calculateGB = (team: Team) => {
    if (!leader || team.id === leader.id) return '—';
    const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
    return gb === 0 ? '0.0' : gb.toFixed(1);
  };

  const calculateWinPct = (team: Team) => {
    const total = team.wins + team.losses;
    if (total === 0) return '.000';
    const pct = team.wins / total;
    if (pct === 1) return '1.000';
    return pct.toFixed(3).substring(1); // e.g. "0.550" -> ".550"
  };
</script>

<div class="standings-container fade-in">
  <div class="card">
    <h3 style="color: var(--primary); font-size: 1.3rem; margin-bottom: 20px;">League Standings</h3>
    
    <div class="table-container">
      <table class="sim-table">
        <thead>
          <tr>
            <th style="width: 60px; text-align: center;">Rank</th>
            <th>Team Name</th>
            <th style="text-align: center;">W</th>
            <th style="text-align: center;">L</th>
            <th style="text-align: center;">PCT</th>
            <th style="text-align: center;">GB</th>
            <th style="text-align: center;">DIFF</th>
            <th style="text-align: center;">Streak / Form</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedTeams as team, idx}
            <tr class="standings-row" class:user-team={idx === sortedTeams.findIndex(t => t.id === allTeams[0].id)}>
              <td style="text-align: center; font-weight: 800; color: var(--text-secondary);">
                {idx + 1}
              </td>
              <td>
                <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
                  <span class="team-dot" style="background-color: {team.id === 'team_1' ? '#008348' : (team.id === 'team_2' ? '#552583' : (team.id === 'team_3' ? '#CE1141' : (team.id === 'team_4' ? '#98002E' : (team.id === 'team_5' ? '#1D428A' : (team.id === 'team_6' ? '#F58426' : (team.id === 'team_7' ? '#00538C' : (team.id === 'team_8' ? '#E31837' : (team.id === 'team_9' ? '#006BB6' : (team.id === 'team_10' ? '#E56020' : (team.id === 'team_11' ? '#0E2240' : '#006241'))))))))))}"></span>
                  {team.city} {team.name}
                  {#if team.id === allTeams[0].id}
                    <span class="badge badge-primary" style="font-size: 0.65rem; padding: 2px 4px;">USER</span>
                  {/if}
                </div>
              </td>
              <td style="text-align: center; font-weight: 700; color: var(--primary);">{team.wins}</td>
              <td style="text-align: center; font-weight: 700; color: var(--text-secondary);">{team.losses}</td>
              <td style="text-align: center; font-weight: 600; font-family: monospace; font-size: 0.95rem;">{calculateWinPct(team)}</td>
              <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{calculateGB(team)}</td>
              <td style="text-align: center; font-weight: 600; color: {team.pointDiff >= 0 ? 'var(--primary)' : 'var(--danger)'}">
                {team.pointDiff >= 0 ? '+' : ''}{team.pointDiff}
              </td>
              <td style="text-align: center;">
                {#if team.pointDiff > 100}
                  <span class="badge badge-primary">Dominant</span>
                {:else if team.wins > team.losses}
                  <span class="badge badge-secondary">Winning</span>
                {:else}
                  <span class="badge badge-danger" style="background-color: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.2);">Cold</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .standings-row {
    transition: background-color 0.2s;
  }
  
  .standings-row:hover {
    background-color: rgba(255, 255, 255, 0.02) !important;
  }

  .standings-row.user-team {
    background-color: rgba(0, 131, 72, 0.04);
    border-left: 3px solid #008348;
  }

  .team-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
</style>
