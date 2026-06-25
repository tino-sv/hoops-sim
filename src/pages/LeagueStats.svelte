<script lang="ts">
  import type { Team, Player, Position } from '../sim/types';

  let { allTeams }: { allTeams: Team[] } = $props();

  let searchQuery = $state('');
  let filterTeam = $state('ALL');
  let filterPosition = $state('ALL');
  let sortBy = $state<'pts' | 'ast' | 'reb' | 'stl' | 'blk' | 'min' | 'gp' | 'fgPct' | 'tpPct'>('pts');
  let sortAscending = $state(false);

  // Compile all players with team names and calculated stats
  interface FlatPlayerStats {
    player: Player;
    teamName: string;
    gp: number;
    min: number; // average
    pts: number;
    ast: number;
    reb: number;
    stl: number;
    blk: number;
    fgPct: number;
    tpPct: number;
  }

  let playersData = $derived.by(() => {
    const list: FlatPlayerStats[] = [];
    allTeams.forEach(t => {
      t.roster.forEach(p => {
        const stats = p.careerStats['season'];
        const gp = stats?.games || 0;
        const pts = gp > 0 ? stats.points / gp : 0;
        const ast = gp > 0 ? stats.assists / gp : 0;
        const reb = gp > 0 ? stats.rebounds / gp : 0;
        const stl = gp > 0 ? stats.steals / gp : 0;
        const blk = gp > 0 ? stats.blocks / gp : 0;
        const min = gp > 0 ? stats.minutes / gp : 0;
        const fgPct = stats && stats.fga > 0 ? (stats.fgm / stats.fga) * 100 : 0;
        const tpPct = stats && stats.tpa > 0 ? (stats.tpm / stats.tpa) * 100 : 0;

        list.push({
          player: p,
          teamName: t.name,
          gp,
          min,
          pts,
          ast,
          reb,
          stl,
          blk,
          fgPct,
          tpPct
        });
      });
    });
    return list;
  });

  // Apply filters
  let filteredPlayers = $derived.by(() => {
    return playersData
      .filter(item => {
        const matchesSearch = item.player.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTeam = filterTeam === 'ALL' || item.teamName === filterTeam;
        const matchesPos = filterPosition === 'ALL' || item.player.position === filterPosition;
        return matchesSearch && matchesTeam && matchesPos;
      })
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        return sortAscending ? valA - valB : valB - valA;
      });
  });

  const toggleSort = (field: typeof sortBy) => {
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
  <div class="card" style="margin-bottom: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: end;">
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
          <option value={t.name}>{t.city} {t.name}</option>
        {/each}
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
            <th class="sortable-header" onclick={() => toggleSort('gp')} style="text-align: center;">GP {sortBy === 'gp' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('min')} style="text-align: center;">MIN {sortBy === 'min' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('pts')} style="text-align: center;">PTS {sortBy === 'pts' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('ast')} style="text-align: center;">AST {sortBy === 'ast' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('reb')} style="text-align: center;">REB {sortBy === 'reb' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('stl')} style="text-align: center;">STL {sortBy === 'stl' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('blk')} style="text-align: center;">BLK {sortBy === 'blk' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('fgPct')} style="text-align: center;">FG% {sortBy === 'fgPct' ? (sortAscending ? '▲' : '▼') : ''}</th>
            <th class="sortable-header" onclick={() => toggleSort('tpPct')} style="text-align: center;">3PT% {sortBy === 'tpPct' ? (sortAscending ? '▲' : '▼') : ''}</th>
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
              <td style="text-align: center; font-family: monospace;">{p.min.toFixed(1)}</td>
              <td style="text-align: center; font-weight: 700; color: var(--primary);">{p.pts.toFixed(1)}</td>
              <td style="text-align: center; font-weight: 600; color: var(--text-primary);">{p.ast.toFixed(1)}</td>
              <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{p.reb.toFixed(1)}</td>
              <td style="text-align: center; font-family: monospace;">{p.stl.toFixed(1)}</td>
              <td style="text-align: center; font-family: monospace;">{p.blk.toFixed(1)}</td>
              <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{p.fgPct.toFixed(1)}%</td>
              <td style="text-align: center; font-weight: 600; color: var(--text-secondary);">{p.tpPct.toFixed(1)}%</td>
            </tr>
          {:else}
            <tr>
              <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No players found matching current filters.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
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
