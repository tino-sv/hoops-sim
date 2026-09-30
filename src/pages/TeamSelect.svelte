<script lang="ts">
  import { careerChoices, type CareerChoice } from '../sim/league';
  import type { Conference, Division } from '../sim/types';

  let { onStart }: { onStart: (teamId: string) => void } = $props();

  const choices = careerChoices();
  const divisions: Division[] = ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'];
  let conference = $state<'ALL' | Conference>('ALL');
  let selectedId = $state<string | null>(null);

  const shown = $derived(choices.filter(team => conference === 'ALL' || team.conference === conference));
  const selected = $derived(choices.find(team => team.id === selectedId) ?? null);
  const visibleDivisions = $derived(divisions.filter(division => shown.some(team => team.division === division)));

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
      <h1>Pick a franchise</h1>
      <p>This is the team you run. Reset the league later if you want a different one.</p>
    </div>
    <div class="filters">
      {#each ['ALL', 'East', 'West'] as side}
        <button class="btn btn-secondary" class:on={conference === side} onclick={() => conference = side as 'ALL' | Conference}>
          {side === 'ALL' ? 'Both' : side}
        </button>
      {/each}
    </div>
  </header>

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

  <footer>
    <p>{selected ? `${selected.city} ${selected.name}. ${selected.owner} wants ${selected.goalWins} wins.` : 'Select a team.'}</p>
    <button class="btn btn-primary" disabled={!selected} onclick={() => selected && onStart(selected.id)}>Start career</button>
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
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: inherit;
    cursor: pointer;
  }
  .team-card.selected { border-color: var(--team); box-shadow: inset 3px 0 0 var(--team); }
  .swatch {
    width: 10px;
    border-radius: 99px;
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
</style>
