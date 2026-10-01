<script lang="ts">
  import { OPEN_MARKETS, type HiredCoach } from '../sim/league';
  import { coachTraits, PEDIGREE_PRESETS, SIGNATURE_PRESETS, skillWord, styleWord, luxuryTaxBill, tvCheck, tvCheckFor, tvUpgradeCost } from '../sim/office';
  import { NBA_RULES } from '../sim/rules';
  import type { OfferVerdict } from '../sim/cba';
  import type { CoachPedigree, CoachSignature, MarketDeal, Team, TeamTactics } from '../sim/types';

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
  let pedigree = $state<CoachPedigree>(team.coach.pedigree ?? 'former-star');
  let signatures = $state<CoachSignature[]>(team.coach.signatures ?? []);
  let tempo = $state(team.tactics.tempo);
  let offense = $state(team.tactics.offensiveStyle);
  let coverage = $state(team.tactics.defensiveCoverage);

  $effect(() => {
    name = team.coach.name;
    age = team.coach.age ?? 46;
    origin = team.coach.origin ?? '';
    pedigree = team.coach.pedigree ?? 'former-star';
    signatures = team.coach.signatures ?? [];
    primary = team.color;
    trim = team.trim ?? '#E8E4D9';
    tempo = team.tactics.tempo;
    offense = team.tactics.offensiveStyle;
    coverage = team.tactics.defensiveCoverage;
  });

  const played = $derived(team.wins + team.losses);
  const pace = $derived(played ? Math.round((team.wins / played) * NBA_RULES.SEASON_GAMES) : 0);
  const millions = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;
  const tax = $derived(luxuryTaxBill(team));

  const preset = $derived(PEDIGREE_PRESETS[pedigree]);
  const traits = $derived(coachTraits({
    name, style: preset.style, age: Number(age), origin, formerPlayer: preset.formerPlayer, pedigree, signatures,
    offense: preset.offense, defense: preset.defense,
    teaching: preset.teaching, manManagement: preset.manManagement
  }));

  const applyPedigree = (next: CoachPedigree) => {
    pedigree = next;
  };

  const toggleSignature = (id: CoachSignature) => {
    if (signatures.includes(id)) signatures = signatures.filter(item => item !== id);
    else if (signatures.length < 2) signatures = [...signatures, id];
  };

  const save = () => onSave({
    name, style: preset.style, tempo, offense, coverage,
    age: Number(age),
    origin,
    formerPlayer: preset.formerPlayer,
    offenseSkill: preset.offense,
    defenseSkill: preset.defense,
    teaching: preset.teaching,
    manManagement: preset.manManagement,
    pedigree,
    signatures
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
      The pedigree sets the ratings and how the room treats you. Two signatures change makes, fouls, fatigue, or a loss. The scheme is still what the games run.
    </p>
    <label>Pedigree
      <select class="form-input" value={pedigree} onchange={(event) => applyPedigree(event.currentTarget.value as CoachPedigree)}>
        {#each Object.entries(PEDIGREE_PRESETS) as [id, preset]}
          <option value={id}>{preset.label}</option>
        {/each}
      </select>
    </label>
    <p style="color: var(--text-secondary);">Player respect {PEDIGREE_PRESETS[pedigree].respect}.</p>
    <p style="font-weight: 700; margin-top: 8px;">Signatures, pick two</p>
    {#each SIGNATURE_PRESETS as signature}
      <label class="check">
        <input
          type="checkbox"
          checked={signatures.includes(signature.id)}
          onchange={(event) => {
            toggleSignature(signature.id);
            event.currentTarget.checked = signatures.includes(signature.id);
          }}
        />
        {signature.label}. {signature.effect}
      </label>
    {/each}
    <label>Name <input class="form-input" bind:value={name} /></label>
    <label>Age <input class="form-input" type="number" min="28" max="78" bind:value={age} /></label>
    <label>Origin <input class="form-input" bind:value={origin} placeholder="City" /></label>
    <div class="locked">
      <div><span>Offense</span><b>{skillWord(preset.offense)}</b></div>
      <div><span>Defense</span><b>{skillWord(preset.defense)}</b></div>
      <div><span>Teaching</span><b>{skillWord(preset.teaching)}</b></div>
      <div><span>Locker room</span><b>{skillWord(preset.manManagement)}</b></div>
      <div><span>Style</span><b>{styleWord(preset.style)}</b></div>
      <div><span>Former player</span><b>{preset.formerPlayer ? 'Yes' : 'No'}</b></div>
    </div>
    <p style="color: var(--text-secondary); margin-bottom: 12px;">The pedigree sets these. They stay put.</p>
    {#if traits.length}
      <ul class="traits">
        {#each traits as trait}
          <li><b>{trait.name}.</b> {trait.effect}</li>
        {/each}
      </ul>
    {/if}
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
      <div class="locked">
        <div><span>Cash</span><b>{millions(team.finances.cash)}</b></div>
        <div><span>TV check</span><b>{millions(tvCheck(team))}</b></div>
        <div><span>Deal</span><b>{currentDeal}</b></div>
        <div><span>Tax</span><b>{tax > 0 ? millions(tax) : 'Under'}</b></div>
      </div>
      <p>Sponsor {team.finances.sponsor ? `${team.finances.sponsor.name}, ${millions(team.finances.sponsor.annual)} a year` : 'none yet'}.</p>
      <div class="deal-row">
        {#each tiers as tier}
          <button class="btn btn-secondary" disabled={tier === currentDeal} onclick={() => signDeal(tier)}>
            {tier} · {dealPrice(tier)}
          </button>
        {/each}
      </div>
      {#if dealError}<p style="color: var(--danger);">{dealError}</p>{/if}
      <p style="color: var(--text-secondary);">A higher tier is a cash buyout. Dropping a tier does not pay you back.</p>
      {#if tax > 0}
        <p style="color: var(--text-secondary);">Luxury tax if the season ended today comes off cash, not the cap.</p>
      {/if}
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
  label.check {
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
    font-weight: 560;
  }
  label.check input { margin-top: 3px; }
  .locked {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    margin: 8px 0;
    font-size: 0.85rem;
  }
  .locked div { display: flex; justify-content: space-between; gap: 8px; color: var(--text-secondary); }
  .locked b { color: var(--text-primary); font-weight: 650; text-transform: capitalize; }
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
