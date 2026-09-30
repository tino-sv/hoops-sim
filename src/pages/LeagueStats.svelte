<script lang="ts">
  import { seasonLine, type SeasonLine } from '../sim/seasonStats';
  import type { Team, Player } from '../sim/types';

  let { allTeams }: { allTeams: Team[] } = $props();

  let searchQuery = $state('');
  let filterTeam = $state('ALL');
  let filterConference = $state('ALL');
  let filterPosition = $state('ALL');
  let playedOnly = $state(true);
  type SortKey = 'gp' | 'min' | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov' | 'fgPct' | 'tpPct' | 'ftPct' | 'efgPct' | 'plusMinus';
  let sortBy = $state<SortKey>('pts');
  let sortAscending = $state(false);

  interface FlatPlayerStats extends SeasonLine {
    player: Player;
    teamId: string;
    teamName: string;
    conference: string;
  }

  let playersData = $derived.by(() => {
    const list: FlatPlayerStats[] = [];
    for (const club of allTeams) {
      for (const player of club.roster) {
        list.push({
          player,
          teamId: club.id,
          teamName: `${club.city} ${club.name}`,
          conference: club.conference,
          ...seasonLine(player.careerStats['season'])
        });
      }
    }
    return list;
  });

  // Apply filters
  let filteredPlayers = $derived.by(() => {
    return playersData
      .filter(item => {
        const matchesSearch = item.player.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTeam = filterTeam === 'ALL' || item.teamId === filterTeam;
        const matchesConference = filterConference === 'ALL' || item.conference === filterConference;
        const matchesPos = filterPosition === 'ALL' || item.player.position === filterPosition;
        const matchesPlayed = !playedOnly || item.gp > 0;
        return matchesSearch && matchesTeam && matchesConference && matchesPos && matchesPlayed;
      })
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        return sortAscending ? valA - valB : valB - valA;
      });
  });

  const one = (value: number) => value.toFixed(1);
  const plusMinus = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

  const toggleSort = (field: SortKey) => {
    if (sortBy === field) {
      sortAscending = !sortAscending;
    } else {
      sortBy = field;
      sortAscending = false;
    }
  };
</script>

<div class="league-stats-container fade-in">
  <!-- Filter Controls -->
  <div class="card filter-bar">
    <div class="setting-group">
      <label for="stat-search">Search Player</label>
      <input 
        id="stat-search"
        type="text" 
        placeholder="Type name..." 
        bind:value={searchQuery}
        style="background: var(--bg-dark); border: 1px solid var(--border-color); color: white; padding: 10px; border-radius: 6px; font-size: 0.9rem;"
      />
    </div>

    <div class="setting-group">
      <label for="stat-team">Filter Team</label>
      <select id="stat-team" class="tactics-select" bind:value={filterTeam} style="padding: 10px;">
        <option value="ALL">All Teams</option>
        {#each allTeams as t}
          <option value={t.id}>{t.city} {t.name}</option>
        {/each}
      </select>
    </div>

    <div class="setting-group">
      <label for="stat-conf">Conference</label>
      <select id="stat-conf" class="form-input" bind:value={filterConference}>
        <option value="ALL">Both</option>
        <option value="East">East</option>
        <option value="West">West</option>
      </select>
    </div>

    <div class="setting-group">
      <label for="stat-pos">Filter Position</label>
      <select id="stat-pos" class="tactics-select" bind:value={filterPosition} style="padding: 10px;">
        <option value="ALL">All Positions</option>
        <option value="PG">Point Guard (PG)</option>
        <option value="SG">Shooting Guard (SG)</option>
        <option value="SF">Small Forward (SF)</option>
        <option value="PF">Power Forward (PF)</option>
        <option value="C">Center (C)</option>
      </select>
    </div>

    <label class="played-only"><input type="checkbox" bind:checked={playedOnly} /> Played this season</label>
    <div style="font-size: 0.85rem; color: var(--text-muted); padding-bottom: 12px; font-weight: 500;">
      Showing {filteredPlayers.length} players
    </div>
  </div>

  <!-- Player Stats Table -->
  <div class="card">
    <div class="table-container">
      <table class="sim-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th style="text-align: center;">Pos</th>
            {#each [
              ['gp', 'GP'], ['min', 'MIN'], ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'],
              ['stl', 'STL'], ['blk', 'BLK'], ['tov', 'TOV'],
              ['fgPct', 'FG%'], ['tpPct', '3P%'], ['ftPct', 'FT%'], ['efgPct', 'eFG%'], ['plusMinus', '+/-']
            ] as [key, label]}
              <th class="sortable-header" onclick={() => toggleSort(key as SortKey)} style="text-align: center;">{label} {sortBy === key ? (sortAscending ? '▲' : '▼') : ''}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each filteredPlayers as p}
            <tr class="stats-row">
              <td>
                <div style="font-weight: 700;">{p.player.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Overall: {p.player.overallRating}</div>
              </td>
              <td><span style="font-weight: 500;">{p.teamName}</span></td>
              <td style="text-align: center;"><span class="badge badge-secondary">{p.player.position}</span></td>
              <td style="text-align: center; font-weight: 600;">{p.gp}</td>
              <td style="text-align: center;">{one(p.min)}</td>
              <td style="text-align: center; font-weight: 700; color: var(--primary);">{one(p.pts)}</td>
              <td style="text-align: center;">{one(p.reb)}</td>
              <td style="text-align: center;">{one(p.ast)}</td>
              <td style="text-align: center;">{one(p.stl)}</td>
              <td style="text-align: center;">{one(p.blk)}</td>
              <td style="text-align: center;">{one(p.tov)}</td>
              <td style="text-align: center;">{one(p.fgPct)}</td>
              <td style="text-align: center;">{one(p.tpPct)}</td>
              <td style="text-align: center;">{one(p.ftPct)}</td>
              <td style="text-align: center;">{one(p.efgPct)}</td>
              <td style="text-align: center;">{plusMinus(p.plusMinus)}</td>
            </tr>
          {:else}
            <tr>
              <td colspan="16" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                {#if playedOnly && playersData.every(player => player.gp === 0)}
                  No games yet. Uncheck “Played this season” to browse the league.
                {:else}
                  No players match those filters.
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
  .filter-bar {
    margin-bottom: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: end;
  }
  .played-only {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    padding-bottom: 10px;
  }
  .stats-row {
    transition: background-color 0.15s;
  }
  .stats-row:hover {
    background-color: rgba(255, 255, 255, 0.02) !important;
  }
  .sortable-header {
    cursor: pointer;
    user-select: none;
    transition: color 0.15s;
  }
  .sortable-header:hover {
    color: var(--primary);
  }
</style>
