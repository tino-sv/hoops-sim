<script lang="ts">
  import type { OfficeNote, OffseasonStep, Player, SeasonPhase, Team } from '../sim/types';
  import { playoffRoundLabel, type PlayoffSeries, type ScheduledMatch } from '../sim/league';
  import { formatSlateDate } from '../sim/schedule';
  import type { OfferVerdict } from '../sim/cba';

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
    clockLabel,
    onAdvanceRound, 
    onInstantSim,
    onSimSeason,
    onPlayoffNight,
    onSimPlayoffs,
    onGoToMatchCenter,
    onEnterOffseason,
    onStartSeason,
    onOpenTab,
    onNewsRead
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
    clockLabel: string,
    onAdvanceRound: () => void, 
    onInstantSim: () => void,
    onSimSeason: () => void,
    onPlayoffNight: () => void,
    onSimPlayoffs: () => void,
    onGoToMatchCenter: (matchId: string) => void,
    onEnterOffseason: () => OfferVerdict,
    onStartSeason: () => OfferVerdict,
    onOpenTab: (tab: 'scouting' | 'free_agents' | 'roster' | 'office' | 'calendar' | 'standings' | 'playoffs') => void,
    onNewsRead: () => void
  } = $props();

  let selectedMessage = $state<OfficeNote | null>(null);
  let actionError = $state('');
  let unreadOnly = $state(false);
  let inbox = $derived(unreadOnly ? news.filter(note => !note.read) : news);

  $effect(() => {
    if (!selectedMessage && news.length > 0) selectedMessage = news[0];
  });

  // Derived standings
  let standings = $derived(
    [...allTeams].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointDiff - a.pointDiff;
    })
  );

  // User team rank
  let userRank = $derived(standings.findIndex(t => t.id === team.id) + 1);

  let divisionTable = $derived(
    [...allTeams.filter(club => club.division === team.division)].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.pointDiff - a.pointDiff;
    })
  );

  const gamesBehind = (club: Team, leader: Team) => {
    if (club.id === leader.id) return '—';
    const gb = ((leader.wins - club.wins) + (club.losses - leader.losses)) / 2;
    return gb === 0 ? '0.0' : gb.toFixed(1);
  };

  // Find next match for the user's team
  let nextUserMatch = $derived(
    schedule.find(m => !m.playoff && !m.cupKnockout && !m.simulated && m.round >= currentRound && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );
  let playoffMatch = $derived(
    schedule.find(m => m.playoff && !m.simulated && (m.homeTeamId === team.id || m.awayTeamId === team.id))
  );
  let inPlayoffs = $derived(phase === 'regular' && seasonComplete && playoffSeries.length > 0 && !championId);
  let playoffLabel = $derived.by(() => {
    const round = playoffSeries[playoffSeries.length - 1]?.round;
    return round ? playoffRoundLabel(round) : 'Playoffs';
  });
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
  let playableNow = $derived(!!playoffMatch || !!cupMatch || (!!nextUserMatch && nextUserMatch.round === currentRound));
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

  const leaderTabs = ['pts', 'ast', 'reb', 'stl', 'blk'] as const;
  let activeLeaderTab = $state<(typeof leaderTabs)[number]>('pts');

  // Derived top players in the league based on selected tab
  let leagueLeaders = $derived.by(() => {
    const allPlayers: { player: Player; teamName: string; avgValue: number }[] = [];
    allTeams.forEach(t => {
      t.roster.forEach(p => {
        const stats = p.careerStats['season'];
        const played = (stats as any)?.games || (t.wins + t.losses) || 0;
        if (!stats || played === 0) return;

        let val = 0;
        if (activeLeaderTab === 'pts') val = stats.points / played;
        else if (activeLeaderTab === 'ast') val = stats.assists / played;
        else if (activeLeaderTab === 'reb') val = stats.rebounds / played;
        else if (activeLeaderTab === 'stl') val = stats.steals / played;
        else if (activeLeaderTab === 'blk') val = stats.blocks / played;

        allPlayers.push({ player: p, teamName: t.name, avgValue: val });
      });
    });
    return allPlayers.sort((a, b) => b.avgValue - a.avgValue).slice(0, 5);
  });

  const readMessage = (msg: OfficeNote) => {
    msg.read = true;
    selectedMessage = msg;
    onNewsRead();
  };

  const advanceDay = () => {
    if (playoffMatch && !playoffMatch.simulated) {
      onGoToMatchCenter(playoffMatch.id);
      return;
    }
    if (inPlayoffs) {
      onPlayoffNight();
      return;
    }
    if (phase !== 'regular' || seasonComplete) return;
    if (featuredMatch && !featuredMatch.simulated && (featuredMatch === cupMatch || featuredMatch.round === currentRound)) {
      onGoToMatchCenter(featuredMatch.id);
    } else {
      onAdvanceRound();
    }
  };

  const enterOffseason = () => {
    actionError = '';
    const result = onEnterOffseason();
    if (!result.allowed) actionError = result.reason;
  };

  const startSeason = () => {
    actionError = '';
    const result = onStartSeason();
    if (!result.allowed) actionError = result.reason;
  };

</script>

<div class="dashboard-page fade-in">
  <section class="fixture">
    <div class="fixture-club">
      <span class="crest" style="background: {team.color}; border-color: {team.trim ?? '#E8E4D9'};"></span>
      <div>
        <div class="fixture-city">{team.city}</div>
        <div class="fixture-name">{team.name}</div>
        <div class="fixture-meta">{team.wins}-{team.losses} · #{userRank}</div>
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
        <div class="fixture-when">{phase === 'offseason' ? 'Offseason' : 'Schedule'}</div>
        <div class="fixture-vs">{phase === 'offseason' ? (offseasonStep === 'draft' ? 'Draft' : 'Free agency') : `Night ${currentRound} of ${totalRounds}`}</div>
      {/if}
      <div class="fixture-actions">
        {#if inPlayoffs}
          <button class="btn btn-secondary" onclick={onSimPlayoffs}>Sim rest</button>
          {#if playoffMatch}
            <button class="btn btn-secondary" onclick={onInstantSim}>Sim</button>
            <button class="btn btn-primary" onclick={advanceDay}>Play</button>
          {:else}
            <button class="btn btn-primary" onclick={onPlayoffNight}>Sim the night</button>
          {/if}
        {:else if phase === 'offseason' && offseasonStep === 'draft'}
          <button class="btn btn-primary" onclick={() => onOpenTab('scouting')}>Draft · {clockLabel}</button>
        {:else if phase === 'offseason'}
          <button class="btn btn-secondary" onclick={() => onOpenTab('free_agents')}>Free agency</button>
          <button class="btn btn-primary" onclick={startSeason}>Open {season + 1}</button>
        {:else if seasonComplete && !inPlayoffs}
          <button class="btn btn-primary" onclick={enterOffseason}>Enter offseason</button>
        {:else if playableNow}
          {#if !cupMatch}
            <button class="btn btn-secondary" onclick={onInstantSim}>Sim</button>
          {/if}
          <button class="btn btn-primary" onclick={advanceDay}>Play</button>
        {:else if phase === 'regular' && !seasonComplete}
          <button class="btn btn-primary" onclick={advanceDay}>Sim the night</button>
        {/if}
      </div>
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
          <div class="fixture-name">{team.coach.name}</div>
          <div class="fixture-meta">{team.owner.name} wants {team.owner.goalWins}</div>
        </div>
      {/if}
    </div>
  </section>
  <p class="out-line">{outLine}</p>
  {#if actionError}
    <p style="color: var(--danger); font-weight: 700;">{actionError}</p>
  {/if}
  <div class="facts">
    <span>Cash ${(team.finances.cash / 1_000_000).toFixed(1)}M</span>
    <span>Diff {team.pointDiff > 0 ? '+' : ''}{team.pointDiff}</span>
    <span>{team.owner.name} · patience {team.owner.patience}</span>
    <span>{team.coach.name}</span>
    <button class="text-btn" onclick={() => onOpenTab(playoffMatch ? 'playoffs' : 'calendar')}>{playoffMatch ? 'Bracket' : 'Calendar'}</button>
    {#if phase === 'regular' && !seasonComplete && !inPlayoffs}
      <button class="text-btn" onclick={onSimSeason}>Sim rest of season</button>
    {/if}
  </div>

  <div class="dashboard-grid">

    <!-- League Leaders Card -->
    <div class="card span-6">
      <h3 class="card-title" style="margin-bottom: 8px;">League Leaders</h3>
      
      <div class="stat-tabs">
        {#each leaderTabs as stat}
          <button class:on={activeLeaderTab === stat} onclick={() => activeLeaderTab = stat}>{stat.toUpperCase()}</button>
        {/each}
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        {#each leagueLeaders as leader, idx}
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; color: var(--text-muted);">#{idx + 1}</span>
              <div>
                <div style="font-weight: 700;">{leader.player.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">{leader.teamName} • {leader.player.position}</div>
              </div>
            </div>
            <span style="font-weight: 800; color: var(--primary);">
              {leader.avgValue.toFixed(1)} 
              {#if activeLeaderTab === 'pts'}PPG
              {:else if activeLeaderTab === 'ast'}APG
              {:else if activeLeaderTab === 'reb'}RPG
              {:else if activeLeaderTab === 'stl'}SPG
              {:else}BPG
              {/if}
            </span>
          </div>
        {:else}
          <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            No statistics recorded yet. Play a game to record stats.
          </div>
        {/each}
      </div>
    </div>

    <!-- Inbox & Mail Card -->
    <div class="card span-6" style="display: flex; flex-direction: column; gap: 16px;">
      <h3 class="card-title">Office Inbox <button class="text-btn" onclick={() => unreadOnly = !unreadOnly}>{unreadOnly ? 'Show all' : `Unread ${news.filter(note => !note.read).length}`}</button></h3>
      
      <div style="display: flex; gap: 16px; height: 260px;">
        <!-- Mail List -->
        <div style="width: 35%; border-right: 1px solid var(--border-color); overflow-y: auto; padding-right: 8px; display: flex; flex-direction: column; gap: 6px;">
          {#each inbox as msg}
            <button 
              class="mail-item-btn" 
              class:active={selectedMessage?.id === msg.id}
              class:unread={!msg.read}
              onclick={() => readMessage(msg)}
            >
              <div style="font-weight: 700; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{msg.sender}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{msg.subject}</div>
            </button>
          {/each}
        </div>

        <!-- Mail Body -->
        <div style="width: 65%; display: flex; flex-direction: column; gap: 10px; padding-left: 8px;">
          {#if selectedMessage}
            <div>
              <div style="font-weight: 800; font-size: 1rem; color: var(--primary);">{selectedMessage.subject}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">From: <b>{selectedMessage.sender}</b> • {selectedMessage.date}</div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.5; overflow-y: auto; flex-grow: 1;">
              {selectedMessage.body}
            </p>
          {:else}
            <div style="text-align: center; color: var(--text-muted); margin-top: 60px;">
              Select a message to read.
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Standings Card -->
    <div class="card span-6">
      <h3 class="card-title">{team.division} <button class="text-btn" onclick={() => onOpenTab('standings')}>All standings</button></h3>
      
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>GB</th>
            </tr>
          </thead>
          <tbody>
            {#each divisionTable as club, idx}
              <tr class:user-row={club.id === team.id}>
                <td><span style="font-weight: 800; color: var(--text-muted)">{idx + 1}</span></td>
                <td style="font-weight: 700;">{club.city} {club.name}</td>
                <td>{club.wins}</td>
                <td>{club.losses}</td>
                <td>{divisionTable[0] ? gamesBehind(club, divisionTable[0]) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<style>
  .mail-item-btn {
    width: 100%;
    background-color: var(--bg-darker);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 10px;
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mail-item-btn:hover {
    background-color: var(--bg-card-hover);
  }

  .mail-item-btn.active {
    background-color: var(--primary-glow);
    border-color: var(--primary);
  }

  .mail-item-btn.unread {
    border-left: 3px solid var(--primary);
  }

  .user-row {
    background-color: var(--secondary-glow) !important;
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

  .stat-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .stat-tabs button {
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .stat-tabs button.on {
    font-weight: 800;
    color: #f4f4f5;
    background: transparent;
    box-shadow: inset 0 -1px 0 #f4f4f5;
  }

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

  .fixture-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
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
