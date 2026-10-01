<script lang="ts">
  import { unansweredDemand } from '../sim/badges';
  import type { OfficeNote, OffseasonStep, SeasonPhase, Team } from '../sim/types';
  import type { PlayoffSeries, ScheduledMatch } from '../sim/league';
  import { formatSlateDate } from '../sim/schedule';
  let { 
    team, 
    allTeams, 
    schedule, 
    currentRound, 
    totalRounds,
    season,
    phase,
    offseasonStep,
    seasonComplete,
    playoffSeries,
    championId,
    news,
    onSimSeason,
    onSimPlayoffs,
    onOpenTab,
    onNewsRead,
    onAnswer
  }: { 
    team: Team, 
    allTeams: Team[], 
    schedule: ScheduledMatch[], 
    currentRound: number, 
    totalRounds: number,
    season: number,
    phase: SeasonPhase,
    offseasonStep: OffseasonStep | null,
    seasonComplete: boolean,
    playoffSeries: PlayoffSeries[],
    championId: string | null,
    news: OfficeNote[],
    onSimSeason: () => void,
    onSimPlayoffs: () => void,
    onOpenTab: (tab: 'scouting' | 'free_agents' | 'roster' | 'office' | 'calendar' | 'standings' | 'playoffs' | 'league_stats') => void,
    onNewsRead: () => void,
    onAnswer: (playerId: string, choice: 'play' | 'look') => void
  } = $props();

  let selectedMessage = $state<OfficeNote | null>(null);
  let seenTop = $state('');
  let inbox = $derived(news);

  $effect(() => {
    const top = news[0];
    if (top && top.id !== seenTop) {
      seenTop = top.id;
      selectedMessage = top;
    }
    if (selectedMessage && !selectedMessage.read) {
      selectedMessage.read = true;
      onNewsRead();
    }
  });

  // Find next match for the user's team
  let nextUserMatch = $derived(
    schedule.find(m => !m.playoff && !m.cupKnockout && !m.simulated && m.round >= currentRound && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );
  let playoffMatch = $derived(
    schedule.find(m => m.playoff && !m.simulated && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );
  let inPlayoffs = $derived(phase === 'regular' && seasonComplete && playoffSeries.length > 0 && !championId);
  let seriesScore = $derived.by(() => {
    const item = playoffSeries.find(series => series.id === playoffMatch?.playoffSeriesId);
    if (!item) return '';
    const userWins = item.highId === team.id ? item.highWins : item.lowWins;
    const oppWins = item.highId === team.id ? item.lowWins : item.highWins;
    return `Series ${userWins}-${oppWins}`;
  });
  let cupMatch = $derived(
    schedule.find(m => m.cupKnockout && !m.simulated && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );
  let featuredMatch = $derived(playoffMatch ?? cupMatch ?? nextUserMatch);

  let nextOpponent = $derived.by(() => {
    if (!featuredMatch) return null;
    const isHome = featuredMatch.homeTeamId === team.id;
    const oppId = isHome ? featuredMatch.awayTeamId : featuredMatch.homeTeamId;
    return allTeams.find(t => t.id === oppId) || null;
  });
  let featuredHome = $derived(featuredMatch?.homeTeamId === team.id);
  let waiting = $derived(unansweredDemand(team.roster));
  let sidelined = $derived(
    team.roster
      .filter(player => player.injury && player.injury.daysRemaining > 0)
      .sort((a, b) => (b.injury?.daysRemaining ?? 0) - (a.injury?.daysRemaining ?? 0))
  );
  let outLine = $derived(
    sidelined.length === 0
      ? 'Everyone can play.'
      : `Cannot play: ${sidelined.map(player => `${player.name}, ${player.injury?.description.toLowerCase()}, ${player.injury?.daysRemaining}d`).join(' · ')}`
  );

  const readMessage = (msg: OfficeNote) => {
    msg.read = true;
    selectedMessage = msg;
    onNewsRead();
  };

</script>

<div class="dashboard-page fade-in">
  <section class="fixture">
    <div class="fixture-club">
      <span class="crest" style="background: {team.color}; border-color: {team.trim ?? '#E8E4D9'};"></span>
      <div>
        <div class="fixture-city">{team.city}</div>
        <div class="fixture-name">{team.name}</div>
        <div class="fixture-meta">{team.wins}-{team.losses}</div>
      </div>
    </div>

    <div class="fixture-mid">
      {#if nextOpponent}
        <div class="fixture-when">{playoffMatch ? 'PLAYOFFS' : cupMatch ? 'CUP' : formatSlateDate(featuredMatch?.date ?? '')}</div>
        <div class="fixture-vs">{featuredHome ? 'Home' : 'Road'}{seriesScore ? ` · ${seriesScore}` : ''}</div>
      {:else if inPlayoffs}
        <div class="fixture-when">Series over</div>
        <div class="fixture-vs">The bracket is still going</div>
      {:else}
        <div class="fixture-when">{phase === 'offseason' ? `Offseason ${season}` : 'Schedule'}</div>
        <div class="fixture-vs">{phase === 'offseason' ? (offseasonStep === 'draft' ? 'Draft' : 'Free agency') : `Night ${currentRound} of ${totalRounds}`}</div>
      {/if}
    </div>

    <div class="fixture-club away">
      {#if nextOpponent}
        <div>
          <div class="fixture-city">{nextOpponent.city}</div>
          <div class="fixture-name">{nextOpponent.name}</div>
          <div class="fixture-meta">{nextOpponent.wins}-{nextOpponent.losses}</div>
        </div>
        <span class="crest" style="background: {nextOpponent.color}; border-color: {nextOpponent.trim ?? '#E8E4D9'};"></span>
      {:else}
        <div>
          <div class="fixture-city">{team.division}</div>
          <div class="fixture-name">No game</div>
          <div class="fixture-meta">{team.division}</div>
        </div>
      {/if}
    </div>
  </section>
  <p class="out-line">{outLine}</p>
  {#if waiting}
    <section class="decision">
      <h2>{waiting.name}</h2>
      <p>He is not getting the minutes he was promised. The day waits on an answer.</p>
      <div class="decision-actions">
        <button class="btn btn-primary" onclick={() => onAnswer(waiting.id, 'play')}>You will play</button>
        <button class="btn btn-secondary" onclick={() => onAnswer(waiting.id, 'look')}>You can look</button>
      </div>
    </section>
  {/if}
  <div class="facts">
    <button class="text-btn" onclick={() => onOpenTab('standings')}>Standings</button>
    <button class="text-btn" onclick={() => onOpenTab('league_stats')}>Leaders</button>
    <button class="text-btn" onclick={() => onOpenTab(playoffMatch ? 'playoffs' : 'calendar')}>{playoffMatch ? 'Bracket' : 'Calendar'}</button>
    {#if phase === 'offseason' && offseasonStep !== 'draft'}
      <button class="text-btn" onclick={() => onOpenTab('free_agents')}>Free agency</button>
    {/if}
    {#if phase === 'regular' && !seasonComplete && !inPlayoffs}
      <button class="text-btn" onclick={onSimSeason}>Sim rest of season</button>
    {/if}
    {#if inPlayoffs}
      <button class="text-btn" onclick={onSimPlayoffs}>Sim rest of playoffs</button>
    {/if}
  </div>

  <section class="note">
    {#if selectedMessage}
      <div class="note-kicker">{selectedMessage.sender}</div>
      <h2>{selectedMessage.subject}</h2>
      <p>{selectedMessage.body}</p>
    {:else}
      <p class="quiet">Nothing is waiting.</p>
    {/if}
    {#if inbox.length > 1}
      <div class="note-list">
        {#each inbox as msg}
          <button class="mail-item-btn" class:active={selectedMessage?.id === msg.id} class:unread={!msg.read} onclick={() => readMessage(msg)}>
            {msg.subject}
          </button>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .mail-item-btn {
    width: 100%;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    padding: 4px 8px;
    text-align: left;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .mail-item-btn.active {
    color: var(--text-primary);
    border-left-color: var(--primary);
  }

  .mail-item-btn.unread {
    color: var(--text-primary);
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--secondary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .decision, .note {
    background: #12151c;
    border: 1px solid #2a3142;
    border-radius: 2px;
    padding: 16px 18px;
    margin-bottom: 14px;
  }

  .decision h2, .note h2 {
    font-family: var(--font-display);
    font-size: 1.2rem;
    margin: 0 0 6px;
  }

  .decision p, .note p {
    margin: 0;
    color: var(--text-secondary);
    max-width: 62ch;
  }

  .decision-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .note-kicker {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .note-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
    max-width: 420px;
  }

  .quiet { color: var(--text-muted); }

  .fixture {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    align-items: center;
    background: #12151c;
    border: 1px solid #2a3142;
    border-radius: 2px;
    padding: 16px 18px;
    margin-bottom: 10px;
  }

  .fixture-club {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .fixture-club.away {
    justify-content: flex-end;
    text-align: right;
  }

  .crest {
    width: 8px;
    align-self: stretch;
    min-height: 36px;
    border-radius: 0;
    border-bottom: 3px solid;
    flex: none;
  }

  .fixture-city {
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .fixture-name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25rem;
    line-height: 1.1;
  }

  .fixture-meta {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .fixture-mid {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .fixture-when {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .fixture-vs {
    font-weight: 700;
  }

  .out-line {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0 0 10px;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin-bottom: 14px;
  }

  @media (max-width: 800px) {
    .fixture {
      grid-template-columns: 1fr;
    }
    .fixture-club.away {
      justify-content: flex-start;
      text-align: left;
    }
  }
</style>
