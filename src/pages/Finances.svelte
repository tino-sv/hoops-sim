<script lang="ts">
  import { yearBooks } from '../sim/office';
  import type { MonthBook, Team } from '../sim/types';

  let { team }: { team: Team } = $props();

  const year = $derived(yearBooks(team));
  const months = $derived([...(team.finances.books ?? [])].reverse());
  const income = $derived(year.gate + year.tv + year.merch + year.sponsor + Math.max(0, year.other));
  const spending = $derived(Math.abs(year.salary) + Math.abs(year.staff) + Math.abs(year.stadium) + Math.abs(year.fine) + Math.abs(Math.min(0, year.other)));

  const money = (value: number) => {
    const sign = value < 0 ? '-' : ''
    const body = `$${(Math.abs(value) / 1_000_000).toFixed(2)}M`
    return sign + body
  };

  const rows: { key: Exclude<keyof MonthBook, 'month'>; label: string }[] = [
    { key: 'gate', label: 'Gate' },
    { key: 'tv', label: 'TV' },
    { key: 'merch', label: 'Merch' },
    { key: 'sponsor', label: 'Sponsor' },
    { key: 'salary', label: 'Salaries' },
    { key: 'staff', label: 'Staff' },
    { key: 'stadium', label: 'Building' },
    { key: 'fine', label: 'Fines' },
    { key: 'other', label: 'Other' }
  ];
</script>

<div class="fade-in">
  <div class="card" style="margin-bottom: 16px;">
    <h2>Books</h2>
    <p style="color: var(--text-secondary); margin: 6px 0 14px;">
      Cash on hand is {money(team.finances.cash)}. Gate, TV, and salaries hit every game. Merch, the building, and staff hit once a month. A 25-point loss draws a league fine. The sponsor check arrives in the offseason.
    </p>
    <div class="totals">
      <div><span>Income</span><b>{money(income)}</b></div>
      <div><span>Spending</span><b>{money(-spending)}</b></div>
      <div><span>Net</span><b>{money(income - spending)}</b></div>
    </div>
  </div>

  {#if months.length === 0}
    <div class="card"><p style="color: var(--text-secondary);">No month has closed. Play a game and the book fills in.</p></div>
  {:else}
    <div class="card">
      <h3 style="margin-bottom: 10px;">Year</h3>
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Month</th>
              {#each rows as row}<th>{row.label}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each months as book}
              <tr>
                <td>{book.month}</td>
                {#each rows as row}
                  <td class:neg={book[row.key] < 0}>{money(book[row.key])}</td>
                {/each}
              </tr>
            {/each}
            <tr>
              <td>Year</td>
              {#each rows as row}
                <td class:neg={year[row.key] < 0}>{money(year[row.key])}</td>
              {/each}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  h2 { font-size: 1.15rem; }
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
  td.neg { color: var(--danger); }
</style>
