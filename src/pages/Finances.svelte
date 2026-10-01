<script lang="ts">
  import { yearBooks } from '../sim/office';
  import type { MonthBook, Team } from '../sim/types';

  let { team }: { team: Team } = $props();

  type Line = Exclude<keyof MonthBook, 'month'>;

  const amount = (book: MonthBook, key: Line) => {
    const value = book[key];
    return typeof value === 'number' ? value : 0;
  };

  const money = (value: number) => {
    const sign = value < 0 ? '-' : '';
    return sign + `$${(Math.abs(value) / 1_000_000).toFixed(2)}M`;
  };

  const cell = (book: MonthBook, key: Line) => {
    const value = amount(book, key);
    return value === 0 ? '—' : money(value);
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthRank = (key: string) => {
    if (key === 'preseason') return '0';
    if (/^\d{4}-\d{2}$/.test(key)) return key;
    if (key === 'cup') return '8';
    if (key === 'offseason') return '9';
    return `5-${key}`;
  };

  const monthLabel = (key: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) {
      if (key === 'preseason') return 'Preseason';
      if (key === 'offseason') return 'Offseason';
      if (key === 'cup') return 'Cup';
      return key;
    }
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  };

  const year = $derived(yearBooks(team));
  const months = $derived(
    [...(team.finances.books ?? [])].sort((a, b) => monthRank(a.month).localeCompare(monthRank(b.month)))
  );
  const operating: { key: Line; label: string }[] = [
    { key: 'gate', label: 'Gate' },
    { key: 'tv', label: 'TV' },
    { key: 'merch', label: 'Merch' },
    { key: 'sponsor', label: 'Sponsor' },
    { key: 'salary', label: 'Salaries' },
    { key: 'staff', label: 'Staff' },
    { key: 'stadium', label: 'Building' },
    { key: 'fine', label: 'Fines' }
  ];
  const rare: { key: Line; label: string }[] = [
    { key: 'jersey', label: 'Uniforms' },
    { key: 'move', label: 'Move' },
    { key: 'buyout', label: 'TV buyout' },
    { key: 'tax', label: 'Tax' },
    { key: 'cup', label: 'Cup' },
    { key: 'other', label: 'Other' }
  ];
  const lines = $derived([
    ...operating,
    ...rare.filter(row => amount(year, row.key) !== 0)
  ]);

  const income = $derived(
    amount(year, 'gate') + amount(year, 'tv') + amount(year, 'merch') + amount(year, 'sponsor') + amount(year, 'cup') + Math.max(0, amount(year, 'other'))
  );
  const spending = $derived(
    Math.abs(amount(year, 'salary')) + Math.abs(amount(year, 'staff')) + Math.abs(amount(year, 'stadium')) + Math.abs(amount(year, 'fine'))
    + Math.abs(amount(year, 'jersey')) + Math.abs(amount(year, 'move')) + Math.abs(amount(year, 'buyout')) + Math.abs(amount(year, 'tax'))
    + Math.abs(Math.min(0, amount(year, 'other')))
  );
</script>

<div class="fade-in">
  <div class="card">
    <h2>Books</h2>
    <p class="note">
      Cash on hand is {money(team.finances.cash)}. Gate, TV, and salaries hit every game. Merch, the building, and staff hit once a month. A 25-point loss draws a league fine. The sponsor check arrives in the offseason.
    </p>
    <div class="totals">
      <div><span>Income</span><b>{money(income)}</b></div>
      <div><span>Spending</span><b>{money(-spending)}</b></div>
      <div><span>Net</span><b>{money(income - spending)}</b></div>
    </div>
  </div>

  {#if months.length === 0}
    <div class="card"><p class="note">No month has closed. Play a game and the book fills in.</p></div>
  {:else}
    <div class="card">
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Line</th>
              {#each months as book}
                <th>{monthLabel(book.month)}</th>
              {/each}
              <th>Year</th>
            </tr>
          </thead>
          <tbody>
            {#each lines as row}
              <tr>
                <td>{row.label}</td>
                {#each months as book}
                  <td class:neg={amount(book, row.key) < 0}>{cell(book, row.key)}</td>
                {/each}
                <td class:neg={amount(year, row.key) < 0}>{cell(year, row.key)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  h2 { font-size: 1.15rem; margin-bottom: 6px; }
  .note { color: var(--text-secondary); margin: 0 0 14px; }
  .totals {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .totals div {
    border: 1px solid var(--border-color);
    padding: 10px 12px;
  }
  .totals span {
    display: block;
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .totals b { font-size: 1.15rem; }
  th, td { white-space: nowrap; }
  td.neg { color: var(--danger); }
  @media (max-width: 700px) {
    .totals { grid-template-columns: 1fr; }
  }
</style>
