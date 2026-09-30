<script lang="ts">
  import type { ScheduledMatch } from '../sim/league';
  import { formatSlateDate } from '../sim/schedule';
  import type { Team } from '../sim/types';

  let {
    team,
    allTeams,
    schedule,
    currentRound,
    allStarDate,
    onPlay
  }: {
    team: Team
    allTeams: Team[]
    schedule: ScheduledMatch[]
    currentRound: number
    allStarDate: string
    onPlay: (matchId: string) => void
  } = $props();

  let year = $state(2026);
  let month = $state(9);
  let following = $state(true);
  let slate = $state<'all' | 'home' | 'away' | 'cup'>('all');

  const mine = $derived(schedule.filter(match => match.homeTeamId === team.id || match.awayTeamId === team.id));
  const visible = $derived(mine.filter(match => {
    if (slate === 'home') return match.homeTeamId === team.id;
    if (slate === 'away') return match.awayTeamId === team.id;
    if (slate === 'cup') return match.cup || !!match.cupKnockout;
    return true;
  }));
  const today = $derived(
    mine.find(match => !match.simulated && !match.cupKnockout)?.date
    ?? schedule.find(match => match.round === currentRound)?.date
    ?? ''
  );

  $effect(() => {
    if (!following || !today) return;
    const [nextYear, nextMonth] = today.split('-').map(Number);
    year = nextYear;
    month = nextMonth - 1;
  });

  const monthName = $derived(new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const pad = $derived(new Date(Date.UTC(year, month, 1)).getUTCDay());
  const days = $derived(new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const played = $derived(mine.filter(match => match.simulated && !match.cupKnockout).length);

  const iso = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const gamesOn = (day: number) => visible.filter(match => match.date === iso(day));

  const monthGames = $derived(visible.filter(match => match.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)));

  const opponent = (match: ScheduledMatch) => {
    const id = match.homeTeamId === team.id ? match.awayTeamId : match.homeTeamId;
    return allTeams.find(club => club.id === id);
  };

  const canPlay = (match: ScheduledMatch) => !match.simulated && (match.cupKnockout || match.round === currentRound);

  const outcome = (match: ScheduledMatch): 'W' | 'L' | '' => {
    if (!match.simulated || match.scoreHome == null || match.scoreAway == null) return '';
    const homeWon = match.scoreHome > match.scoreAway;
    return homeWon === (match.homeTeamId === team.id) ? 'W' : 'L';
  };

  const shift = (delta: number) => {
    following = false;
    const next = new Date(Date.UTC(year, month + delta, 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth();
  };

  const jumpToToday = () => {
    following = true;
  };
</script>

<div class="calendar-page fade-in">
  <div class="head">
    <div>
      <h2>Calendar</h2>
      <p>{played} of 82 regular-season games played. All-Star break is {formatSlateDate(allStarDate)}.</p>
    </div>
    <div class="nav">
      <button class="btn btn-secondary" onclick={() => shift(-1)}>Prev</button>
      <strong>{monthName}</strong>
      <button class="btn btn-secondary" onclick={() => shift(1)}>Next</button>
      <button class="btn btn-secondary" onclick={jumpToToday}>Today</button>
      <select class="form-input" bind:value={slate}>
        <option value="all">All games</option>
        <option value="home">Home</option>
        <option value="away">Road</option>
        <option value="cup">Cup</option>
      </select>
    </div>
  </div>

  <div class="layout">
    <div>
      <div class="dow">
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as label}
          <div>{label}</div>
        {/each}
      </div>
      <div class="grid">
        {#each Array(pad) as _, index (index)}
          <div class="cell empty"></div>
        {/each}
        {#each Array(days) as _, index (index + 1)}
          {@const day = index + 1}
          {@const date = iso(day)}
          {@const games = gamesOn(day)}
          <div class="cell" class:today={date === today} class:break-day={date === allStarDate}>
            <div class="num">{day}</div>
            {#if date === allStarDate}
              <div class="tag">All-Star</div>
            {/if}
            {#each games as match (match.id)}
              {@const opp = opponent(match)}
              {@const mark = outcome(match)}
              <button
                class="game"
                class:played={match.simulated}
                class:win={mark === 'W'}
                class:loss={mark === 'L'}
                class:cup={match.cup || !!match.cupKnockout}
                disabled={!canPlay(match)}
                onclick={() => canPlay(match) && onPlay(match.id)}
              >
                <span>{match.homeTeamId === team.id ? 'vs' : '@'} {opp?.city ?? 'TBD'}</span>
                {#if mark}<strong>{mark} {match.scoreHome}-{match.scoreAway}</strong>{/if}
                {#if !mark && (match.cup || match.cupKnockout)}<em>{match.cupKnockout ?? 'Cup'}</em>{/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    </div>

    <aside class="card list">
      <h3>{monthName}</h3>
      {#if monthGames.length === 0}
        <p class="quiet">No games this month.</p>
      {:else}
        {#each monthGames as match (match.id)}
          {@const opp = opponent(match)}
          {@const mark = outcome(match)}
          <div class="row">
            <div>
              <div class="when">{formatSlateDate(match.date)}</div>
              <div>{match.homeTeamId === team.id ? 'vs' : '@'} {opp?.city} {opp?.name}</div>
              {#if match.cup || match.cupKnockout}<div class="tag">{match.cupKnockout ?? 'Cup group'}</div>{/if}
            </div>
            {#if mark}
              <strong class={mark === 'W' ? 'win-text' : 'loss-text'}>{mark} {match.scoreHome}-{match.scoreAway}</strong>
            {:else if canPlay(match)}
              <button class="btn btn-primary" onclick={() => onPlay(match.id)}>Play</button>
            {:else}
              <span class="quiet">Later</span>
            {/if}
          </div>
        {/each}
      {/if}
    </aside>
  </div>
</div>

<style>
  h2 { font-size: 1.6rem; font-weight: 800; }
  h3 { margin-bottom: 12px; }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .head p { color: var(--text-secondary); }
  .nav { display: flex; gap: 8px; align-items: center; }
  .nav strong { min-width: 160px; text-align: center; }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.7fr);
    gap: 16px;
    align-items: start;
  }
  .dow, .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .dow {
    margin-bottom: 6px;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
  }
  .cell {
    min-height: 96px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 6px;
  }
  .cell.empty { visibility: hidden; }
  .cell.today { outline: 2px solid var(--secondary); }
  .break-day { outline: 1px solid var(--accent); }
  .num { font-size: 0.75rem; color: var(--text-muted); font-weight: 700; }
  .tag { font-size: 0.7rem; color: var(--accent); font-weight: 800; }
  .game {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 4px;
    padding: 4px;
    border-radius: 4px;
    border: none;
    background: var(--primary-glow);
    color: inherit;
    text-align: left;
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }
  .game:disabled { cursor: default; }
  .game.win { background: rgba(16, 185, 129, 0.2); }
  .game.loss { background: rgba(239, 68, 68, 0.18); }
  .game.cup { box-shadow: inset 2px 0 0 var(--accent); }
  .game em { font-style: normal; color: var(--accent); font-weight: 700; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.9rem;
  }
  .when { color: var(--text-muted); font-size: 0.75rem; font-weight: 700; }
  .quiet { color: var(--text-muted); font-size: 0.8rem; }
  .win-text { color: var(--primary); }
  .loss-text { color: var(--danger); }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .cell { min-height: 72px; padding: 4px; }
    .game { font-size: 0.62rem; }
  }
</style>
