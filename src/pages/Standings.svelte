<script lang="ts">
  import type { Conference, Team } from '../sim/types';
  import { NBA_RULES } from '../sim/rules';

  let { allTeams, userTeamId }: { allTeams: Team[], userTeamId: string } = $props();

  const conferences: Conference[] = ['East', 'West'];

  const sortTeams = (teams: Team[]) => [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return b.pointDiff - a.pointDiff;
  });

  const gamesBehind = (team: Team, leader: Team) => {
    if (team.id === leader.id) return '—';
    const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
    return gb === 0 ? '0.0' : gb.toFixed(1);
  };

  const winPct = (team: Team) => {
    const total = team.wins + team.losses;
    if (total === 0) return '.000';
    const pct = team.wins / total;
    if (pct === 1) return '1.000';
    return pct.toFixed(3).substring(1);
  };
</script>

<div class="standings-container fade-in">
  <p style="color: var(--text-secondary); margin-bottom: 16px;">
    Twelve-team league on NBA roster and cap rules. Top {NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE} in each conference are in the playoff picture. Playoffs are not simulated yet.
  </p>
  {#each conferences as conference}
    {@const table = sortTeams(allTeams.filter(team => team.conference === conference))}
    {@const leader = table[0]}
    <div class="card" style="margin-bottom: 20px;">
      <h3 style="color: var(--primary); font-size: 1.3rem; margin-bottom: 20px;">{conference} Conference</h3>
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
              <th style="text-align: center;">Picture</th>
            </tr>
          </thead>
          <tbody>
            {#each table as team, idx}
              <tr class="standings-row" class:user-team={team.id === userTeamId}>
                <td style="text-align: center; font-weight: 800; color: var(--text-secondary);">{idx + 1}</td>
                <td>
                  <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <span class="team-dot" style="background-color: {team.color};"></span>
                    {team.city} {team.name}
                    {#if team.id === userTeamId}
                      <span class="badge badge-primary" style="font-size: 0.65rem; padding: 2px 4px;">USER</span>
                    {/if}
                  </div>
                </td>
                <td style="text-align: center; font-weight: 700; color: var(--primary);">{team.wins}</td>
                <td style="text-align: center; font-weight: 700; color: var(--text-secondary);">{team.losses}</td>
                <td style="text-align: center; font-weight: 600; font-family: monospace; font-size: 0.95rem;">{winPct(team)}</td>
                <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{leader ? gamesBehind(team, leader) : '—'}</td>
                <td style="text-align: center; font-weight: 600; color: {team.pointDiff >= 0 ? 'var(--primary)' : 'var(--danger)'}">
                  {team.pointDiff >= 0 ? '+' : ''}{team.pointDiff}
                </td>
                <td style="text-align: center;">
                  {#if idx < NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE}
                    <span class="badge badge-primary">Playoff</span>
                  {:else}
                    <span class="badge badge-danger" style="background-color: rgba(239,68,68,0.1); color: var(--danger); border: 1px solid rgba(239,68,68,0.2);">Out</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/each}
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
