<script lang="ts">
  import { awardRace } from '../sim/office';
  import { seasonLine } from '../sim/seasonStats';
  import type { AllStarWeekend, Player, SeasonAwards, Team } from '../sim/types';

  let {
    allTeams,
    awards,
    allStar,
    cupChampionId,
    userTeam
  }: {
    allTeams: Team[]
    awards: SeasonAwards | null
    allStar: AllStarWeekend
    cupChampionId: string | null
    userTeam: Team
  } = $props();

  const locate = (id: string | null | undefined) => {
    if (!id) return null;
    for (const club of allTeams) {
      const player = club.roster.find(item => item.id === id);
      if (player) return { player, club };
    }
    return null;
  };

  const clubName = (id: string | null) => {
    const club = allTeams.find(item => item.id === id);
    return club ? `${club.city} ${club.name}` : '—';
  };

  const blurb = (player: Player) => {
    const line = seasonLine(player.careerStats['season']);
    if (!line.gp) return `${player.position}`;
    return `${player.position} · ${line.pts.toFixed(1)} PTS, ${line.reb.toFixed(1)} REB, ${line.ast.toFixed(1)} AST`;
  };

  type Race = 'mvp' | 'defense' | 'rookie' | 'sixth';
  type RaceSort = 'score' | 'pts' | 'reb' | 'ast';
  let race = $state<Race>('mvp');
  let raceSort = $state<RaceSort>('score');
  let raceAsc = $state(false);
  let query = $state('');
  let conference = $state<'ALL' | 'East' | 'West'>('ALL');
  let position = $state('ALL');
  let mineOnly = $state(false);

  const scoreOf = (row: ReturnType<typeof awardRace>[number]) => {
    const line = seasonLine(row.player.careerStats['season']);
    if (raceSort === 'pts') return line.pts;
    if (raceSort === 'reb') return line.reb;
    if (raceSort === 'ast') return line.ast;
    if (race === 'defense') return row.defense;
    return row.mvp;
  };

  let raceRows = $derived.by(() => {
    return awardRace(allTeams)
      .filter(row => {
        if (conference !== 'ALL' && row.team.conference !== conference) return false;
        if (position !== 'ALL' && row.player.position !== position) return false;
        if (mineOnly && row.team.id !== userTeam.id) return false;
        if (race === 'rookie' && row.player.experience !== 0) return false;
        if (race === 'sixth' && !row.reserve) return false;
        return row.player.name.toLowerCase().includes(query.toLowerCase());
      })
      .sort((a, b) => raceAsc ? scoreOf(a) - scoreOf(b) : scoreOf(b) - scoreOf(a))
      .slice(0, 20);
  });

  const setRaceSort = (key: RaceSort) => {
    if (raceSort === key) raceAsc = !raceAsc;
    else {
      raceSort = key;
      raceAsc = false;
    }
  };

  const major = $derived(awards ? [
    ['MVP', awards.mvpId],
    ['Defensive player', awards.dpoyId],
    ['Rookie', awards.royId],
    ['Sixth man', awards.sixthId],
    ['Most improved', awards.mipId]
  ] as const : []);
</script>

<div class="fade-in">
  <div class="page-head" style="margin-bottom: 16px;">
    <div>
      <h2 style="font-size: 1.6rem; font-weight: 800;">Honors</h2>
      <p>The race updates with the season. Named awards, All-Star teams, and the Cup stay on this page.</p>
    </div>
  </div>

  <div class="card filter-bar">
    <label>Race
      <select class="form-input" bind:value={race} onchange={() => { raceSort = 'score'; raceAsc = false; }}>
        <option value="mvp">MVP</option>
        <option value="defense">Defense</option>
        <option value="rookie">Rookie</option>
        <option value="sixth">Sixth man</option>
      </select>
    </label>
    <label>Search
      <input class="form-input" placeholder="Name" bind:value={query} />
    </label>
    <label>Conference
      <select class="form-input" bind:value={conference}>
        <option value="ALL">Both</option>
        <option value="East">East</option>
        <option value="West">West</option>
      </select>
    </label>
    <label>Position
      <select class="form-input" bind:value={position}>
        <option value="ALL">All</option>
        <option value="PG">PG</option>
        <option value="SG">SG</option>
        <option value="SF">SF</option>
        <option value="PF">PF</option>
        <option value="C">C</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={mineOnly} /> My team</label>
  </div>

  <div class="card" style="margin: 16px 0;">
    <div class="table-container">
      <table class="sim-table">
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Team</th>
            <th class="sortable" onclick={() => setRaceSort('pts')}>PTS {raceSort === 'pts' ? (raceAsc ? '▲' : '▼') : ''}</th>
            <th class="sortable" onclick={() => setRaceSort('reb')}>REB {raceSort === 'reb' ? (raceAsc ? '▲' : '▼') : ''}</th>
            <th class="sortable" onclick={() => setRaceSort('ast')}>AST {raceSort === 'ast' ? (raceAsc ? '▲' : '▼') : ''}</th>
            <th class="sortable" onclick={() => setRaceSort('score')}>Score {raceSort === 'score' ? (raceAsc ? '▲' : '▼') : ''}</th>
          </tr>
        </thead>
        <tbody>
          {#each raceRows as row, index}
            {@const line = seasonLine(row.player.careerStats['season'])}
            <tr class:mine={row.team.id === userTeam.id}>
              <td style="color: var(--text-muted); font-weight: 800;">{index + 1}</td>
              <td style="font-weight: 700;">{row.player.name} <span style="color: var(--text-muted); font-weight: 600;">{row.player.position}</span></td>
              <td>{row.team.city}</td>
              <td>{line.pts.toFixed(1)}</td>
              <td>{line.reb.toFixed(1)}</td>
              <td>{line.ast.toFixed(1)}</td>
              <td style="font-weight: 700;">{scoreOf(row).toFixed(1)}</td>
            </tr>
          {:else}
            <tr><td colspan="7" style="color: var(--text-muted);">No players match those filters.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  {#if awards}
    <div class="award-grid">
      {#each major as [label, id]}
        {@const found = locate(id)}
        <article class="card">
          <div class="kicker">{label}</div>
          {#if found}
            <h3>{found.player.name}</h3>
            <p>{found.club.city} {found.club.name}</p>
            <p class="line">{blurb(found.player)}</p>
          {:else}
            <h3>—</h3>
            <p style="color: var(--text-secondary);">Not awarded.</p>
          {/if}
        </article>
      {/each}
    </div>

    <div class="card" style="margin-top: 16px;">
      <h3 style="margin-bottom: 12px;">All-League</h3>
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr><th></th><th>Player</th><th>Team</th><th>Line</th></tr>
          </thead>
          <tbody>
            {#each awards.allNbaIds as id, index}
              {@const found = locate(id)}
              <tr>
                <td style="width: 48px; color: var(--text-muted); font-weight: 800;">{index + 1}</td>
                <td style="font-weight: 700;">{found?.player.name ?? '—'}</td>
                <td>{found ? `${found.club.city} ${found.club.name}` : '—'}</td>
                <td style="color: var(--text-secondary);">{found ? blurb(found.player) : ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if allStar.announced}
    <div class="star-grid">
      {#each [['East', allStar.eastIds], ['West', allStar.westIds]] as [side, ids]}
        <div class="card">
          <h3 style="margin-bottom: 12px;">All-Star {side}</h3>
          <ol>
            {#each ids as id}
              {@const found = locate(id)}
              <li>
                <b>{found?.player.name ?? '—'}</b>
                <span>{found ? `${found.club.city} · ${blurb(found.player)}` : ''}</span>
              </li>
            {/each}
          </ol>
        </div>
      {/each}
    </div>
  {/if}

  <div class="card" style="margin-top: 16px;">
    <h3 style="margin-bottom: 8px;">Cup</h3>
    <p>{cupChampionId ? `${clubName(cupChampionId)} won the Cup.` : 'The elimination games are not finished.'}</p>
    <p style="color: var(--text-secondary); margin-top: 6px;">Your group record is {userTeam.cupWins}-{userTeam.cupLosses}. Elimination games pay the gate and do not change the regular-season record.</p>
  </div>
</div>

<style>
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
  }
  .filter-bar label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .check {
    flex-direction: row !important;
    align-items: center;
    gap: 6px;
    padding-bottom: 8px;
  }
  .sortable { cursor: pointer; user-select: none; }
  tr.mine td { background: rgba(16, 185, 129, 0.08); }
  .award-grid, .star-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .star-grid { margin-top: 16px; }
  .kicker {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6px;
  }
  h3 { font-size: 1.15rem; }
  .line, article p { color: var(--text-secondary); margin-top: 4px; }
  ol { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; flex-direction: column; gap: 2px; }
  li span { color: var(--text-secondary); font-size: 0.85rem; }
</style>
