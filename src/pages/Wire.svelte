<script lang="ts">
  import type { WirePost, WireRole } from '../sim/types';

  let { posts }: { posts: WirePost[] } = $props();

  const filters: { id: 'all' | WireRole; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'journalist', label: 'Press' },
    { id: 'show', label: 'Shows' },
    { id: 'player', label: 'Players' },
    { id: 'team', label: 'Teams' },
    { id: 'fan', label: 'Fans' }
  ];
  let role = $state<'all' | WireRole>('all');
  const shown = $derived(posts.filter(post => role === 'all' || post.role === role));
</script>

<div class="fade-in">
  <header class="page-head">
    <div>
      <h1>Wire</h1>
      <p>Press, shows, players, the team account, and the crowd. They talk when you play.</p>
    </div>
  </header>
  <div class="filters">
    {#each filters as filter}
      <button class="btn btn-secondary" class:on={role === filter.id} onclick={() => role = filter.id}>{filter.label}</button>
    {/each}
  </div>
  {#if shown.length === 0}
    <div class="card">
      <p>Nothing in this feed yet. Play a game, or switch the filter.</p>
    </div>
  {:else}
    <div class="feed">
      {#each shown as post (post.id)}
        <article class="card post">
          <div class="who">
            <strong>{post.name}</strong>
            <span>@{post.handle}</span>
          </div>
          <p>{post.body}</p>
          <p class="when">{post.date}</p>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .filters .on {
    border-color: var(--primary);
    color: var(--primary);
  }
  .feed {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .who {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .who span, .when {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  .post p {
    margin: 0;
  }
  .when {
    margin-top: 8px;
  }
</style>
