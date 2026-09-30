<script lang="ts">
  import { luxuryTaxBill, tvCheck, tvCheckFor, tvUpgradeCost } from '../sim/office';
  import { NBA_RULES } from '../sim/rules';
  import type { OfferVerdict } from '../sim/cba';
  import type { CoachStyle, MarketDeal, Team, TeamTactics } from '../sim/types';

  let { team, onSave, onTvDeal }: {
    team: Team
    onSave: (
      name: string,
      style: CoachStyle,
      tempo: TeamTactics['tempo'],
      offense: TeamTactics['offensiveStyle'],
      coverage: TeamTactics['defensiveCoverage']
    ) => void
    onTvDeal: (tier: MarketDeal) => OfferVerdict
  } = $props();

  const tiers: MarketDeal[] = ['local', 'partner', 'national'];
  let dealError = $state('');
  const currentDeal = $derived<MarketDeal>(team.finances.tvDeal ?? 'partner');

  const signDeal = (tier: MarketDeal) => {
    dealError = '';
    const result = onTvDeal(tier);
    if (!result.allowed) dealError = result.reason;
  };

  const dealPrice = (tier: MarketDeal) => {
    if (tier === currentDeal) return 'Signed';
    const cost = tvUpgradeCost(currentDeal, tier);
    if (cost === 0) return `Switch · ${millions(tvCheckFor(tier))} a game`;
    return `Buy out ${millions(cost)} · ${millions(tvCheckFor(tier))} a game`;
  };

  let name = $state(team.coach.name);
  let style = $state<CoachStyle>(team.coach.style);
  let tempo = $state(team.tactics.tempo);
  let offense = $state(team.tactics.offensiveStyle);
  let coverage = $state(team.tactics.defensiveCoverage);

  $effect(() => {
    name = team.coach.name;
    style = team.coach.style;
    tempo = team.tactics.tempo;
    offense = team.tactics.offensiveStyle;
    coverage = team.tactics.defensiveCoverage;
  });

  const played = $derived(team.wins + team.losses);
  const pace = $derived(played ? Math.round((team.wins / played) * NBA_RULES.SEASON_GAMES) : 0);
  const millions = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;
  const tax = $derived(luxuryTaxBill(team));

  const save = () => onSave(name, style, tempo, offense, coverage);
</script>

<div class="fade-in office-grid">
  <div class="card">
    <h2 style="margin-bottom: 8px;">Coach</h2>
    <p style="color: var(--text-secondary); margin-bottom: 16px;">
      The scheme is what the games use. A tactician helps your offense finish. A disciplinarian contests more and tires the roster slower, and he wears on fragile players. A players' coach adds a point of morale after a win.
    </p>
    <label>Name <input class="form-input" bind:value={name} /></label>
    <label>Style
      <select class="form-input" bind:value={style}>
        <option value="players-coach">Players' coach</option>
        <option value="tactician">Tactician</option>
        <option value="disciplinarian">Disciplinarian</option>
      </select>
    </label>
    <label>Offense
      <select class="form-input" bind:value={offense}>
        <option value="pace-and-space">Pace and space</option>
        <option value="pick-and-roll">Pick-and-roll</option>
        <option value="motion">Motion</option>
        <option value="post-up">Post-up</option>
        <option value="isolation">Isolation</option>
      </select>
    </label>
    <label>Pace
      <select class="form-input" bind:value={tempo}>
        <option value="slow">Slow it down</option>
        <option value="balanced">Balanced</option>
        <option value="fast">Push in transition</option>
      </select>
    </label>
    <label>Pick-and-roll coverage
      <select class="form-input" bind:value={coverage}>
        <option value="drop">Drop</option>
        <option value="blitz">Blitz the handler</option>
        <option value="switch-everything">Switch everything</option>
        <option value="zone-23">2-3 zone</option>
        <option value="zone-32">3-2 zone</option>
      </select>
    </label>
    <button class="btn btn-primary" style="margin-top: 12px;" onclick={save}>Save coach</button>
  </div>

  <div style="display: flex; flex-direction: column; gap: 16px;">
    <div class="card">
      <h2 style="margin-bottom: 8px;">Owner</h2>
      <p style="font-weight: 800;">{team.owner.name}</p>
      <p style="color: var(--text-secondary);">Goal is {team.owner.goalWins} wins. Pace is {played ? pace : '—'}.</p>
      <p>Patience {team.owner.patience}</p>
      <div class="bar"><span style="width: {team.owner.patience}%;"></span></div>
    </div>
    <div class="card">
      <h2 style="margin-bottom: 8px;">Money</h2>
      <p>Cash {millions(team.finances.cash)}</p>
      <p>Gate and TV {millions(team.finances.seasonRevenue)}</p>
      <p>Spent {millions(team.finances.seasonExpenses)}</p>
      <p>Payroll {millions(team.finances.salariesTotal)}</p>
      <p>TV deal {currentDeal}. Each game pays {millions(tvCheck(team))}.</p>
      <div class="deal-row">
        {#each tiers as tier}
          <button class="btn btn-secondary" disabled={tier === currentDeal} onclick={() => signDeal(tier)}>
            {tier} · {dealPrice(tier)}
          </button>
        {/each}
      </div>
      {#if dealError}<p style="color: var(--danger);">{dealError}</p>{/if}
      <p style="color: var(--text-secondary);">A higher tier is a cash buyout. Dropping a tier does not pay you back.</p>
      <p>Sponsor {team.finances.sponsor ? `${team.finances.sponsor.name}, ${millions(team.finances.sponsor.annual)} a year` : 'none yet'}.</p>
      <p style="color: var(--text-secondary);">
        {#if tax > 0}
          Luxury tax if the season ended today: {millions(tax)}. That comes off cash, not the cap.
        {:else}
          Under the tax line. Cash is the checkbook. The cap is a different book.
        {/if}
      </p>
    </div>
  </div>
</div>

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .office-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .office-grid { grid-template-columns: 1fr; }
  }
  .bar {
    height: 8px;
    background: var(--border-color);
    border-radius: 99px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--primary);
  }
  .deal-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 8px 0;
  }
  .deal-row .btn {
    text-transform: capitalize;
  }
</style>
