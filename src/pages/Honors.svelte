<script lang="ts">
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
      <p>Awards, the All-Star teams, and the Cup.</p>
    </div>
  </div>

  {#if !awards && !allStar.announced && !cupChampionId}
    <div class="card">
      <p style="color: var(--text-secondary);">Nothing is named yet. The All-Star teams come out at the break. Awards and the Cup champion come after the schedule.</p>
    </div>
  {/if}

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
    <p>{cupChampionId ? `${clubName(cupChampionId)} won the Cup.` : 'The knockout has not been decided.'}</p>
    <p style="color: var(--text-secondary); margin-top: 6px;">Your group record is {userTeam.cupWins}-{userTeam.cupLosses}. Quarters and semis count in the standings. The final does not.</p>
  </div>
</div>

<style>
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
