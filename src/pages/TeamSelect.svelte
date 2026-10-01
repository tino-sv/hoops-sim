<script lang="ts">
  import { careerChoices, type CareerChoice, type HiredCoach } from '../sim/league';
  import { PEDIGREE_PRESETS, SIGNATURE_PRESETS, skillWord, styleWord } from '../sim/office';
  import type { CoachPedigree, CoachSignature, Conference, Division, TeamTactics } from '../sim/types';

  let { onStart }: { onStart: (teamId: string, coach: HiredCoach) => void } = $props();

  const choices = careerChoices();
  const divisions: Division[] = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'];
  let conference = $state<'ALL' | Conference>('ALL');
  let selectedId = $state<string | null>(null);
  let step = $state<'team' | 'coach'>('team');
  let coachName = $state('');
  let age = $state(46);
  let origin = $state('');
  let pedigree = $state<CoachPedigree>('former-star');
  let signatures = $state<CoachSignature[]>([]);
  let tempo = $state<TeamTactics['tempo']>('balanced');
  let offense = $state<TeamTactics['offensiveStyle']>('pace-and-space');
  let coverage = $state<TeamTactics['defensiveCoverage']>('drop');

  const shown = $derived(choices.filter(team => conference === 'ALL' || team.conference === conference));
  const selected = $derived(choices.find(team => team.id === selectedId) ?? null);
  const visibleDivisions = $derived(divisions.filter(division => shown.some(team => team.division === division)));
  const ready = $derived(coachName.trim().length > 0);
  const pedigreeNote = $derived(PEDIGREE_PRESETS[pedigree].note);
  const preset = $derived(PEDIGREE_PRESETS[pedigree]);

  const applyPedigree = (next: CoachPedigree) => {
    pedigree = next;
  };

  const toggleSignature = (id: CoachSignature) => {
    if (signatures.includes(id)) signatures = signatures.filter(item => item !== id);
    else if (signatures.length < 2) signatures = [...signatures, id];
  };

  const outlookLabel: Record<CareerChoice['outlook'], string> = {
    contender: 'Contender',
    middle: 'In the mix',
    rebuild: 'Rebuild'
  };

  const swatch = (color: string) => color.toLowerCase() === '#000000' ? '#9aa0a6' : color;
</script>

<div class="pick">
  <header>
    <div>
      <h1>{step === 'team' ? 'Pick a franchise' : 'Name your coach'}</h1>
      <p>{step === 'team' ? 'This is the team you run. Reset the league later if you want a different one.' : 'The pedigree sets your ratings. Two signatures change how the games play. You can change them later from the office.'}</p>
    </div>
    {#if step === 'team'}
      <div class="filters">
        {#each ['ALL', 'East', 'West'] as side}
          <button class="btn btn-secondary" class:on={conference === side} onclick={() => conference = side as 'ALL' | Conference}>
            {side === 'ALL' ? 'Both' : side}
          </button>
        {/each}
      </div>
    {/if}
  </header>

  {#if step === 'coach' && selected}
    <div class="card coach-form">
      <p style="color: var(--text-secondary); margin-bottom: 12px;">{selected.city} {selected.name}. {selected.owner} wants {selected.goalWins} wins. {selected.coach} is out.</p>
      <label>Pedigree
        <select class="form-input" value={pedigree} onchange={(event) => applyPedigree(event.currentTarget.value as CoachPedigree)}>
          {#each Object.entries(PEDIGREE_PRESETS) as [id, preset]}
            <option value={id}>{preset.label}</option>
          {/each}
        </select>
      </label>
      <p class="hint">{pedigreeNote} Player respect starts at {PEDIGREE_PRESETS[pedigree].respect}.</p>
      <p class="hint">Signatures, pick two.</p>
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
      <label>Name <input class="form-input" bind:value={coachName} placeholder="Your name" /></label>
      <label>Age <input class="form-input" type="number" min="28" max="78" bind:value={age} /></label>
      <label>Origin <input class="form-input" bind:value={origin} placeholder="City you are from" /></label>
      <div class="locked">
        <div><span>Offense</span><b>{skillWord(preset.offense)}</b></div>
        <div><span>Defense</span><b>{skillWord(preset.defense)}</b></div>
        <div><span>Teaching</span><b>{skillWord(preset.teaching)}</b></div>
        <div><span>Locker room</span><b>{skillWord(preset.manManagement)}</b></div>
        <div><span>Style</span><b>{styleWord(preset.style)}</b></div>
        <div><span>Former player</span><b>{preset.formerPlayer ? 'Yes' : 'No'}</b></div>
      </div>
      <p class="hint">The pedigree sets these. They stay put. A tactician helps the offense finish. A disciplinarian contests more and tires the roster slower. A players' coach adds a point of morale after a win.</p>
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
    </div>
  {:else}
  {#each visibleDivisions as division}
    <section>
      <h2>{division}</h2>
      <div class="grid">
        {#each shown.filter(team => team.division === division) as team}
          <button
            class="team-card"
            class:selected={team.id === selectedId}
            style="--team: {swatch(team.color)}"
            onclick={() => selectedId = team.id}
          >
            <span class="swatch"></span>
            <span class="meta">
              <strong>{team.city} {team.name}</strong>
              <span>{outlookLabel[team.outlook]} · {team.goalWins} wins</span>
              <span>{team.coach} · {team.owner}</span>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
  {/if}

  <footer>
    {#if step === 'coach' && selected}
      <p>{coachName.trim() || 'Name the coach'} takes the {selected.city} job.</p>
      <div class="filters">
        <button class="btn btn-secondary" onclick={() => step = 'team'}>Back</button>
        <button class="btn btn-primary" disabled={!ready} onclick={() => onStart(selected.id, {
          name: coachName.trim(), style: preset.style, tempo, offense, coverage,
          age: Number(age), origin, formerPlayer: preset.formerPlayer,
          offenseSkill: preset.offense, defenseSkill: preset.defense,
          teaching: preset.teaching, manManagement: preset.manManagement,
          pedigree, signatures
        })}>Start career</button>
      </div>
    {:else}
      <p>{selected ? `${selected.city} ${selected.name}. ${selected.owner} wants ${selected.goalWins} wins.` : 'Select a team.'}</p>
      <button class="btn btn-primary" disabled={!selected} onclick={() => selected && (step = 'coach')}>Name your coach</button>
    {/if}
  </footer>
</div>

<style>
  .pick {
    min-height: 100vh;
    padding: 28px 32px 96px;
    background: var(--bg-dark);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    margin-bottom: 20px;
  }
  h1 { font-size: 1.8rem; }
  header p, footer p { color: var(--text-secondary); margin-top: 4px; }
  .filters { display: flex; gap: 8px; }
  .filters .on { border-color: var(--primary); color: var(--primary); }
  section { margin-bottom: 18px; }
  h2 {
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 10px;
  }
  .team-card {
    display: flex;
    gap: 12px;
    text-align: left;
    padding: 12px;
    border-radius: 2px;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: inherit;
    cursor: pointer;
  }
  .team-card.selected { border-color: var(--team); box-shadow: inset 3px 0 0 var(--team); }
  .swatch {
    width: 10px;
    border-radius: 0;
    background: var(--team);
    flex: none;
  }
  .meta { display: flex; flex-direction: column; gap: 2px; }
  .meta span { color: var(--text-secondary); font-size: 0.82rem; }
  footer {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin: 12px -32px -96px;
    padding: 16px 32px;
    background: var(--bg-dark);
    border-top: 1px solid var(--border-color);
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .coach-form {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .check { display: flex; align-items: center; gap: 8px; }
  .coach-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .coach-form label.check {
    flex-direction: row;
    align-items: flex-start;
    font-weight: 560;
  }
  .coach-form label.check input { margin-top: 3px; }
  .hint { color: var(--text-secondary); font-size: 0.85rem; margin: 4px 0 8px; }
  .locked {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    margin: 4px 0 8px;
    font-size: 0.85rem;
  }
  .locked div { display: flex; justify-content: space-between; gap: 8px; color: var(--text-secondary); }
  .locked b { color: var(--text-primary); font-weight: 650; }
</style>
