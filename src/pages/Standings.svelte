<script lang="ts">
  import type { Conference, Division, Team } from '../sim/types';
  import { NBA_RULES } from '../sim/rules';

  let { allTeams, userTeamId }: { allTeams: Team[], userTeamId: string } = $props();

  const conferences: { name: Conference, divisions: Division[] }[] = [
    { name: 'East', divisions: ['Atlantic', 'Central', 'Southeast'] },
    { name: 'West', divisions: ['Northwest', 'Pacific', 'Southwest'] }
  ];

  type StandingsKey = 'wins' | 'losses' | 'pct' | 'diff';
  let sortKey = $state<StandingsKey>('wins');
  let sortAsc = $state(false);

  const metric = (team: Team) => {
    if (sortKey === 'wins') return team.wins;
    if (sortKey === 'losses') return team.losses;
    if (sortKey === 'diff') return team.pointDiff;
    const games = team.wins + team.losses;
    return games ? team.wins / games : 0;
  };

  const byRecord = (teams: Team[]) => [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return a.city.localeCompare(b.city);
  });

  const displaySort = (teams: Team[]) => {
    if (sortKey === 'wins') {
      const ordered = byRecord(teams);
      return sortAsc ? ordered.slice().reverse() : ordered;
    }
    return [...teams].sort((a, b) => {
      const diff = metric(a) - metric(b);
      if (diff !== 0) return sortAsc ? diff : -diff;
      return a.city.localeCompare(b.city);
    });
  };

  const toggle = (key: StandingsKey) => {
    if (sortKey === key) sortAsc = !sortAsc;
    else {
      sortKey = key;
      sortAsc = key === 'losses';
    }
  };

  const mark = (key: StandingsKey) => sortKey === key ? (sortAsc ? '▲' : '▼') : '';

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

{#snippet table(teams: Team[], leader: Team | undefined, picture: boolean, ranked: Team[])}
  {@const playoffIds = new Set(byRecord(ranked).slice(0, NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE).map(team => team.id))}
  <div class="table-container">
    <table class="sim-table">
      <thead>
        <tr>
          <th style="width: 52px; text-align: center;">Rank</th>
          <th>Team</th>
          {#if picture}<th>Division</th>{/if}
          <th class="sortable" style="text-align: center;" onclick={() => toggle('wins')}>W {mark('wins')}</th>
          <th class="sortable" style="text-align: center;" onclick={() => toggle('losses')}>L {mark('losses')}</th>
          <th class="sortable" style="text-align: center;" onclick={() => toggle('pct')}>PCT {mark('pct')}</th>
          <th style="text-align: center;">GB</th>
          <th class="sortable" style="text-align: center;" onclick={() => toggle('diff')}>DIFF {mark('diff')}</th>
          {#if picture}<th style="text-align: center;">Picture</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each teams as team, idx}
          <tr class="standings-row" class:user-team={team.id === userTeamId} class:cut={picture && sortKey === 'wins' && !sortAsc && idx === NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE - 1}>
            <td style="text-align: center; font-weight: 800; color: var(--text-secondary);">{idx + 1}</td>
            <td>
              <div style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
                <span class="team-dot" style="background-color: {team.color};"></span>
                {team.city} {team.name}
                {#if team.id === userTeamId}
                  <span class="badge badge-primary" style="font-size: 0.65rem; padding: 2px 4px;">You</span>
                {/if}
              </div>
            </td>
            {#if picture}<td style="color: var(--text-secondary);">{team.division}</td>{/if}
            <td style="text-align: center; font-weight: 700; color: var(--primary);">{team.wins}</td>
            <td style="text-align: center; font-weight: 700; color: var(--text-secondary);">{team.losses}</td>
            <td style="text-align: center; font-weight: 600; font-family: monospace; font-size: 0.95rem;">{winPct(team)}</td>
            <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{leader ? gamesBehind(team, leader) : '—'}</td>
            <td style="text-align: center; font-weight: 600; color: {team.pointDiff >= 0 ? 'var(--primary)' : 'var(--danger)'}">
              {team.pointDiff >= 0 ? '+' : ''}{team.pointDiff}
            </td>
            {#if picture}
              <td style="text-align: center;">
                {#if playoffIds.has(team.id)}
                  <span class="badge badge-primary">Playoff</span>
                {:else}
                  <span class="badge badge-danger">Out</span>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

<div class="standings-container fade-in">
  <div class="page-head" style="margin-bottom: 16px;">
    <div>
      <h2 style="font-size: 1.6rem; font-weight: 800;">Standings</h2>
      <p>Divisions come first. Games behind in those tables are against that division's leader. The conference table is the playoff picture, and it stays blank until a game is played. The series is not played yet.</p>
    </div>
  </div>
  {#each conferences as conference}
    {@const pool = allTeams.filter(team => team.conference === conference.name)}
    {@const started = pool.some(team => team.wins + team.losses > 0)}
    <div class="card" style="margin-bottom: 20px;">
      <h3 style="color: var(--primary); font-size: 1.3rem; margin-bottom: 16px;">{conference.name} Conference</h3>
      {#each conference.divisions as division}
        {@const divisionPool = allTeams.filter(team => team.division === division)}
        <section class="division-block">
          <h4>{division}</h4>
          {@render table(displaySort(divisionPool), byRecord(divisionPool)[0], false, divisionPool)}
        </section>
      {/each}
      <section class="division-block">
        <h4>Conference</h4>
        {@render table(displaySort(pool), byRecord(pool)[0], started, pool)}
      </section>
    </div>
  {/each}
</div>

<style>
  .division-block {
    margin-top: 22px;
  }

  h3 + .division-block {
    margin-top: 0;
  }

  h4 {
    margin-bottom: 8px;
    font-size: 1rem;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .standings-row.user-team {
    background-color: rgba(16, 185, 129, 0.08);
  }

  .standings-row.cut td {
    border-bottom: 2px solid var(--primary);
  }

  .team-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

</style>
