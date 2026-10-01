<script lang="ts">
  import { OPEN_MARKETS, type HiredCoach } from '../sim/league';
  import { coachTraits, luxuryTaxBill, tvCheck, tvCheckFor, tvUpgradeCost } from '../sim/office';
  import { NBA_RULES } from '../sim/rules';
  import type { OfferVerdict } from '../sim/cba';
  import type { CoachStyle, MarketDeal, Team, TeamTactics } from '../sim/types';

  let { team, onSave, onTvDeal, onJersey, onMove }: {
    team: Team
    onSave: (coach: HiredCoach) => void
    onTvDeal: (tier: MarketDeal) => OfferVerdict
    onJersey: (color: string, trim: string) => OfferVerdict
    onMove: (city: string) => OfferVerdict
  } = $props();

  const palette = ['#008348', '#F58426', '#006BB6', '#E31837', '#1D42BA', '#552583', '#0E2240', '#F5F5F0', '#111111', '#C4CED4'];
  let primary = $state(team.color);
  let trim = $state(team.trim ?? '#E8E4D9');
  let nextCity = $state(OPEN_MARKETS[0]);
  let clubError = $state('');

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
  let age = $state(team.coach.age ?? 46);
  let origin = $state(team.coach.origin ?? '');
  let formerPlayer = $state(!!team.coach.formerPlayer);
  let offenseSkill = $state(team.coach.offense ?? 62);
  let defenseSkill = $state(team.coach.defense ?? 62);
  let teaching = $state(team.coach.teaching ?? 62);
  let manManagement = $state(team.coach.manManagement ?? 62);
  let style = $state<CoachStyle>(team.coach.style);
  let tempo = $state(team.tactics.tempo);
  let offense = $state(team.tactics.offensiveStyle);
  let coverage = $state(team.tactics.defensiveCoverage);

  $effect(() => {
    name = team.coach.name;
    age = team.coach.age ?? 46;
    origin = team.coach.origin ?? '';
    formerPlayer = !!team.coach.formerPlayer;
    offenseSkill = team.coach.offense ?? 62;
    defenseSkill = team.coach.defense ?? 62;
    teaching = team.coach.teaching ?? 62;
    manManagement = team.coach.manManagement ?? 62;
    primary = team.color;
    trim = team.trim ?? '#E8E4D9';
    style = team.coach.style;
    tempo = team.tactics.tempo;
    offense = team.tactics.offensiveStyle;
    coverage = team.tactics.defensiveCoverage;
  });

  const played = $derived(team.wins + team.losses);
  const pace = $derived(played ? Math.round((team.wins / played) * NBA_RULES.SEASON_GAMES) : 0);
  const millions = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;
  const tax = $derived(luxuryTaxBill(team));

  const traits = $derived(coachTraits({
    name, style, age: Number(age), origin, formerPlayer,
    offense: Number(offenseSkill), defense: Number(defenseSkill),
    teaching: Number(teaching), manManagement: Number(manManagement)
  }));

  const save = () => onSave({
    name, style, tempo, offense, coverage,
    age: Number(age),
    origin,
    formerPlayer,
    offenseSkill: Number(offenseSkill),
    defenseSkill: Number(defenseSkill),
    teaching: Number(teaching),
    manManagement: Number(manManagement)
  });

  const orderJersey = () => {
    clubError = '';
    const result = onJersey(primary, trim);
    if (!result.allowed) clubError = result.reason;
  };

  const moveClub = () => {
    clubError = '';
    const result = onMove(nextCity);
    if (!result.allowed) clubError = result.reason;
  };
</script>

<div class="fade-in office-grid">
  <div class="card">
    <h2 style="margin-bottom: 8px;">Coach</h2>
    <p style="color: var(--text-secondary); margin-bottom: 16px;">
      The scheme is what the games use. A tactician helps your offense finish. A disciplinarian contests more and tires the roster slower, and he wears on fragile players. A players' coach adds a point of morale after a win.
    </p>
    <label>Name <input class="form-input" bind:value={name} /></label>
    <label>Age <input class="form-input" type="number" min="28" max="78" bind:value={age} /></label>
    <label>Origin <input class="form-input" bind:value={origin} placeholder="City" /></label>
    <label class="check"><input type="checkbox" bind:checked={formerPlayer} /> Former player</label>
    <label>Offense skill
      <select class="form-input" bind:value={offenseSkill}>
        <option value={48}>Developing</option>
        <option value={62}>Solid</option>
        <option value={76}>Sharp</option>
        <option value={88}>Elite</option>
      </select>
    </label>
    <label>Defense skill
      <select class="form-input" bind:value={defenseSkill}>
        <option value={48}>Developing</option>
        <option value={62}>Solid</option>
        <option value={76}>Sharp</option>
        <option value={88}>Elite</option>
      </select>
    </label>
    <label>Teaching
      <select class="form-input" bind:value={teaching}>
        <option value={48}>Developing</option>
        <option value={62}>Solid</option>
        <option value={76}>Sharp</option>
        <option value={88}>Elite</option>
      </select>
    </label>
    <label>Locker room
      <select class="form-input" bind:value={manManagement}>
        <option value={48}>Developing</option>
        <option value={62}>Solid</option>
        <option value={76}>Sharp</option>
        <option value={88}>Elite</option>
      </select>
    </label>
    {#if traits.length}
      <ul class="traits">
        {#each traits as trait}
          <li><b>{trait.name}.</b> {trait.effect}</li>
        {/each}
      </ul>
    {/if}
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
      <h2 style="margin-bottom: 8px;">Club</h2>
      <p>{team.city} {team.name}. {team.division}, {team.conference}.</p>
      <div class="jersey" style="background: {primary}; color: {trim}; border-color: {trim};">{team.name}</div>
      <p style="font-weight: 700; margin-top: 8px;">Home color</p>
      <div class="swatches">
        {#each palette as swatch}
          <button class="swatch" class:on={primary === swatch} style="background: {swatch};" aria-label={swatch} onclick={() => primary = swatch}></button>
        {/each}
      </div>
      <p style="font-weight: 700;">Trim</p>
      <div class="swatches">
        {#each palette as swatch}
          <button class="swatch" class:on={trim === swatch} style="background: {swatch};" aria-label={`trim ${swatch}`} onclick={() => trim = swatch}></button>
        {/each}
      </div>
      <button class="btn btn-secondary" onclick={orderJersey}>Order uniforms · {millions(NBA_RULES.JERSEY_ORDER)}</button>
      <label style="margin-top: 12px;">Open city
        <select class="form-input" bind:value={nextCity}>
          {#each OPEN_MARKETS as city}
            <option value={city}>{city}</option>
          {/each}
        </select>
      </label>
      <button class="btn btn-secondary" onclick={moveClub}>Move the club · {millions(NBA_RULES.RELOCATION_FEE)}</button>
      <p style="color: var(--text-secondary);">The division stays. Both come out of cash, not the cap.</p>
      {#if clubError}<p style="color: var(--danger);">{clubError}</p>{/if}
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
  .jersey {
    margin-top: 10px;
    border: 4px solid;
    border-radius: 2px;
    min-height: 72px;
    display: grid;
    place-items: center;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0 10px;
  }
  .check { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
  .traits { margin: 8px 0 12px; padding-left: 16px; color: var(--text-secondary); font-size: 0.85rem; }
  .traits b { color: var(--text-primary); font-weight: 650; }
  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 99px;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
  }
  .swatch.on {
    border-color: var(--text-primary);
  }
</style>
