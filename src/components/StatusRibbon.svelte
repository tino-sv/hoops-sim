<script lang="ts">
  import { unansweredDemand } from '../sim/badges';
  import { capTierLabel, rosterBlockReason, type OfferVerdict } from '../sim/cba';
  import type { PlayoffSeries, ScheduledMatch } from '../sim/league';
  import type { OfficeNote, SeasonPhase, Team } from '../sim/types';

  let {
    team,
    allTeams,
    schedule,
    currentRound,
    phase,
    offseasonStep,
    seasonComplete,
    playoffSeries,
    championId,
    news,
    season,
    inMatch,
    onAdvance,
    onPlayoffNight,
    onGoToMatch,
    onEnterOffseason,
    onStartSeason,
    onOpenHome,
    onOpenDraft
  }: {
    team: Team
    allTeams: Team[]
    schedule: ScheduledMatch[]
    currentRound: number
    phase: SeasonPhase
    offseasonStep: 'draft' | 'free-agency' | null
    seasonComplete: boolean
    playoffSeries: PlayoffSeries[]
    championId: string | null
    news: OfficeNote[]
    season: number
    inMatch: boolean
    onAdvance: () => void
    onPlayoffNight: () => void
    onGoToMatch: (matchId: string) => void
    onEnterOffseason: () => OfferVerdict
    onStartSeason: () => OfferVerdict
    onOpenHome: () => void
    onOpenDraft: () => void
  } = $props();

  const nextUserMatch = $derived(
    schedule.find(match => !match.playoff && !match.cupKnockout && !match.simulated && match.round >= currentRound && (match.homeTeamId === team.id || match.awayTeamId === team.id))
  );
  const playoffMatch = $derived(
    schedule.find(match => match.playoff && !match.simulated && (match.homeTeamId === team.id || match.awayTeamId === team.id))
  );
  const cupMatch = $derived(
    schedule.find(match => match.cupKnockout && !match.simulated && (match.homeTeamId === team.id || match.awayTeamId === team.id))
  );
  const inPlayoffs = $derived(phase === 'regular' && seasonComplete && playoffSeries.length > 0 && !championId);
  const featured = $derived(playoffMatch ?? cupMatch ?? nextUserMatch);
  const opponent = $derived.by(() => {
    if (!featured) return null;
    const oppId = featured.homeTeamId === team.id ? featured.awayTeamId : featured.homeTeamId;
    return allTeams.find(club => club.id === oppId) ?? null;
  });
  const home = $derived(featured?.homeTeamId === team.id);
  const playable = $derived(!!playoffMatch || !!cupMatch || (!!nextUserMatch && nextUserMatch.round === currentRound));
  const unread = $derived(news.filter(note => !note.read).length);
  const tier = $derived(capTierLabel(team));
  const block = $derived(rosterBlockReason(team.roster.length, phase));

  const night = $derived.by(() => {
    if (phase === 'offseason') return `Offseason ${season}`;
    const iso = featured?.date
      ?? schedule.find(match => match.round === currentRound && !match.playoff)?.date
      ?? '';
    if (!iso) return `Night ${currentRound}`;
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    });
  });

  const waiting = $derived(unansweredDemand(team.roster));
  const action = $derived.by(() => {
    if (inMatch) return { label: 'In the game', disabled: true, reason: '', run: 'none' as const };
    if (waiting) return { label: `Answer ${waiting.name.split(' ').slice(-1)[0]}`, disabled: false, reason: '', run: 'answer' as const };
    if (block) return { label: 'Blocked', disabled: true, reason: block, run: 'none' as const };
    if (playable && featured) return { label: 'Continue', disabled: false, reason: '', run: 'match' as const };
    if (inPlayoffs) return { label: 'Continue', disabled: false, reason: '', run: 'playoff' as const };
    if (phase === 'regular' && !seasonComplete) return { label: 'Continue', disabled: false, reason: '', run: 'day' as const };
    if (seasonComplete && !inPlayoffs) return { label: 'Enter offseason', disabled: false, reason: '', run: 'offseason' as const };
    if (phase === 'offseason' && offseasonStep === 'draft') return { label: 'Go to the draft', disabled: false, reason: '', run: 'draft' as const };
    if (phase === 'offseason') return { label: 'Open the next season', disabled: false, reason: '', run: 'season' as const };
    return { label: 'Blocked', disabled: true, reason: 'Nothing is on the slate.', run: 'none' as const };
  });

  let actionError = $state('');

  const press = () => {
    if (action.disabled) return;
    actionError = '';
    if (action.run === 'answer') onOpenHome();
    else if (action.run === 'match' && featured) onGoToMatch(featured.id);
    else if (action.run === 'day') onAdvance();
    else if (action.run === 'playoff') onPlayoffNight();
    else if (action.run === 'offseason') {
      const result = onEnterOffseason();
      if (!result.allowed) actionError = result.reason;
    } else if (action.run === 'draft') onOpenDraft();
    else if (action.run === 'season') {
      const result = onStartSeason();
      if (!result.allowed) actionError = result.reason;
    }
  };
</script>

<header class="status-ribbon">
  <span><b>{team.city}</b> {team.wins}-{team.losses}</span>
  <span>
    {#if opponent}
      {home ? 'vs' : '@'} {opponent.city} {opponent.wins}-{opponent.losses}
    {:else}
      No game
    {/if}
  </span>
  <span>{tier}</span>
  <span>{night}</span>
  <button class="mail" onclick={onOpenHome}>{unread === 0 ? 'No mail' : `${unread} unread`}</button>
  <button class="btn btn-primary go" disabled={action.disabled} onclick={press}>{action.label}</button>
  {#if action.reason || actionError}<span class="reason">{action.reason || actionError}</span>{/if}
</header>

<style>
  .status-ribbon {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    padding: 10px 32px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-dark);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .status-ribbon b { color: var(--text-primary); font-weight: 650; }
  .mail {
    background: none;
    border: none;
    color: var(--text-primary);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  .go { margin-left: auto; }
  .go:disabled { opacity: 0.45; cursor: not-allowed; }
  .reason { color: var(--danger); }
  @media (max-width: 800px) {
    .status-ribbon { padding: 10px 16px; }
    .go { margin-left: 0; }
  }
</style>
