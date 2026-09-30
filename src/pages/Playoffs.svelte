<script lang="ts">
  import { playoffRoundLabel, type PlayoffRoundName, type PlayoffSeries, type ScheduledMatch } from '../sim/league';
  import type { Conference, Team } from '../sim/types';
  import { NBA_RULES } from '../sim/rules';

  let {
    allTeams,
    schedule,
    series,
    userTeamId,
    championId,
    seasonComplete,
    onPlay,
    onSimNight,
    onSimRest
  }: {
    allTeams: Team[]
    schedule: ScheduledMatch[]
    series: PlayoffSeries[]
    userTeamId: string
    championId: string | null
    seasonComplete: boolean
    onPlay: (matchId: string) => void
    onSimNight: () => void
    onSimRest: () => void
  } = $props();

  const club = (id: string) => allTeams.find(team => team.id === id);
  const champion = $derived(club(championId ?? ''));
  const inPlayoffs = $derived(seasonComplete && series.length > 0 && !championId);

  const bestFirst = (a: Team, b: Team) => {
    const gamesA = a.wins + a.losses;
    const gamesB = b.wins + b.losses;
    const pctA = gamesA === 0 ? 0 : a.wins / gamesA;
    const pctB = gamesB === 0 ? 0 : b.wins / gamesB;
    if (pctA !== pctB) return pctB - pctA;
    if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;
    return a.city.localeCompare(b.city);
  };

  const conferences: Conference[] = ['East', 'West'];
  const preview = (conference: Conference) =>
    allTeams.filter(team => team.conference === conference).sort(bestFirst).slice(0, NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE);

  const rounds: PlayoffRoundName[] = ['final', 'conf', 'semi', 'first'];
  const shownRounds = $derived(rounds.filter(round => series.some(item => item.round === round)));

  const nextGame = (item: PlayoffSeries) =>
    schedule.find(match => match.playoffSeriesId === item.id && !match.simulated);

  const yours = (item: PlayoffSeries) => item.highId === userTeamId || item.lowId === userTeamId;

  const scoreLine = (item: PlayoffSeries) => {
    const high = club(item.highId);
    const low = club(item.lowId);
    if (item.winnerId) {
      const winner = club(item.winnerId);
      const wins = item.winnerId === item.highId ? item.highWins : item.lowWins;
      const losses = item.winnerId === item.highId ? item.lowWins : item.highWins;
      return `${winner?.city ?? 'Winner'} wins ${wins}-${losses}`;
    }
    return `${high?.city ?? ''} ${item.highWins} – ${item.lowWins} ${low?.city ?? ''}`;
  };
</script>

<div class="fade-in">
  <div class="page-head" style="margin-bottom: 16px;">
    <div>
      <h2 style="font-size: 1.6rem; font-weight: 800;">Playoffs</h2>
      <p>Best of seven. The higher seed hosts games 1, 2, 5, and 7. Winners stay on their side of the bracket.</p>
    </div>
    {#if inPlayoffs}
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick={onSimNight}>Sim the night</button>
        <button class="btn btn-secondary" onclick={onSimRest}>Sim the rest</button>
      </div>
    {/if}
  </div>

  {#if champion}
    <div class="card" style="margin-bottom: 16px;">
      <h3 style="color: var(--primary);">{champion.city} {champion.name} are the champions.</h3>
    </div>
  {/if}

  {#if series.length === 0}
    <p style="color: var(--text-secondary); margin-bottom: 16px;">The bracket is the top 8 in each conference when the regular season ends.</p>
    <div class="office-grid">
      {#each conferences as conference}
        <div class="card">
          <h3 style="color: var(--primary); margin-bottom: 10px;">{conference}</h3>
          {#each preview(conference) as team, index}
            <div class="seed-row" class:mine={team.id === userTeamId}>
              <span>{index + 1}</span>
              <b>{team.city} {team.name}</b>
              <span>{team.wins}-{team.losses}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    {#each shownRounds as round}
      {@const inRound = series.filter(item => item.round === round)}
      <section class="card" style="margin-bottom: 16px;">
        <h3 style="margin-bottom: 12px;">{playoffRoundLabel(round)}</h3>
        <div class="series-list">
          {#each inRound as item, index}
            {#if index === 0 || inRound[index - 1].conference !== item.conference}
              <h4>{item.conference}</h4>
            {/if}
            {@const high = club(item.highId)}
            {@const low = club(item.lowId)}
            {@const game = nextGame(item)}
            <div class="series" class:mine={yours(item)}>
              <div class="teams">
                <div><span class="seed">{item.highSeed}</span> {high?.city} {high?.name}</div>
                <div><span class="seed">{item.lowSeed}</span> {low?.city} {low?.name}</div>
              </div>
              <div class="meta">
                <b>{scoreLine(item)}</b>
                {#if game}
                  <span>{game.homeTeamId === item.highId ? high?.city : low?.city} hosts game {item.highWins + item.lowWins + 1}</span>
                  {#if yours(item)}
                    <button class="btn btn-primary" onclick={() => onPlay(game.id)}>Play</button>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .office-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .seed-row, .series {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);
  }
  .seed-row.mine, .series.mine {
    background: rgba(16, 185, 129, 0.08);
    margin: 0 -8px;
    padding: 8px;
    border-radius: 8px;
  }
  h4 {
    margin: 14px 0 4px;
    color: var(--primary);
    font-size: 0.95rem;
  }
  .series-list { display: flex; flex-direction: column; }
  .teams { display: flex; flex-direction: column; gap: 4px; }
  .seed {
    display: inline-block;
    min-width: 1.2rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    text-align: right;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  @media (max-width: 800px) {
    .office-grid { grid-template-columns: 1fr; }
    .series { flex-direction: column; align-items: flex-start; }
    .meta { align-items: flex-start; text-align: left; }
  }
</style>
