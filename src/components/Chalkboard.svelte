<script lang="ts">
  import { seasonLine } from '../sim/seasonStats';
  import { POSITIONS, type Team, type OffensiveRole, type Position } from '../sim/types';

  // Svelte 5 Props syntax
  let { team = $bindable(), onTacticsChanged }: { team: Team, onTacticsChanged?: () => void } = $props();

  let tactics = $derived(team.tactics);
  let roster = $derived(team.roster);

  const POSITION_NAME: Record<Position, string> = {
    PG: 'Point guard',
    SG: 'Shooting guard',
    SF: 'Small forward',
    PF: 'Power forward',
    C: 'Center'
  };

  const OFF_ROLES: { value: OffensiveRole; label: string }[] = [
    { value: 'initiator', label: 'Primary creator' },
    { value: 'secondary-initiator', label: 'Secondary creator' },
    { value: 'screen-setter', label: 'Screener' },
    { value: 'spot-up', label: 'Spot-up' },
    { value: 'rim-runner', label: 'Roll man' }
  ];

  const SLOT = ['Starter · ~32 min', 'Backup · ~16 min', 'End of bench · ~6 min'];

  let chartTick = $state(0);

  let starters = $derived(
    POSITIONS.map(pos => {
      void chartTick;
      const id = team.depthChart[pos]?.[0];
      return roster.find(p => p.id === id) || roster.find(p => p.position === pos) || roster[0];
    })
  );

  const depthAt = (pos: Position) => {
    void chartTick;
    return (team.depthChart[pos] || [])
      .map(id => roster.find(player => player.id === id))
      .filter((player): player is NonNullable<typeof player> => !!player);
  };

  const saveChart = (next: Team['depthChart']) => {
    team.depthChart = next;
    chartTick += 1;
    onTacticsChanged?.();
  };

  const reorder = (pos: Position, index: number, direction: -1 | 1) => {
    const list = [...(team.depthChart[pos] || [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const [id] = list.splice(index, 1);
    list.splice(target, 0, id);
    saveChart({ ...team.depthChart, [pos]: list });
  };

  const slideTo = (pos: Position, playerId: string) => {
    if (!playerId) return;
    const next = { ...team.depthChart };
    for (const position of POSITIONS) {
      next[position] = (next[position] || []).filter(id => id !== playerId);
    }
    next[pos] = [...(next[pos] || []), playerId];
    saveChart(next);
  };

  const seasonBlurb = (playerId: string) => {
    const line = seasonLine(roster.find(player => player.id === playerId)?.careerStats['season']);
    if (line.gp === 0) return 'No games yet';
    return `${line.min.toFixed(1)} MIN · ${line.pts.toFixed(1)} PPG`;
  };

  // Positions on the court (in percentages: x, y) based on offensive style
  const getCoordinates = (pos: Position, style: string) => {
    switch (style) {
      case 'pace-and-space': // 5-out spacing
        if (pos === 'PG') return { x: 85, y: 50 };
        if (pos === 'SG') return { x: 65, y: 15 };
        if (pos === 'SF') return { x: 65, y: 85 };
        if (pos === 'PF') return { x: 35, y: 10 };
        return { x: 35, y: 90 }; // C
      case 'pick-and-roll':
        if (pos === 'PG') return { x: 75, y: 40 };
        if (pos === 'C') return { x: 70, y: 50 }; // Setting screen
        if (pos === 'SG') return { x: 60, y: 15 };
        if (pos === 'SF') return { x: 30, y: 88 };
        return { x: 20, y: 55 }; // PF in dunker spot
      case 'post-up':
        if (pos === 'C') return { x: 15, y: 38 }; // Low block
        if (pos === 'PG') return { x: 65, y: 25 };
        if (pos === 'SG') return { x: 78, y: 55 };
        if (pos === 'SF') return { x: 65, y: 85 };
        return { x: 45, y: 62 }; // PF high post
      case 'motion':
        if (pos === 'PG') return { x: 70, y: 35 };
        if (pos === 'SG') return { x: 70, y: 65 };
        if (pos === 'SF') return { x: 25, y: 15 };
        if (pos === 'PF') return { x: 45, y: 50 };
        return { x: 18, y: 70 }; // C
      default: // isolation
        if (pos === 'PG') return { x: 65, y: 50 }; // Iso at top
        if (pos === 'SG') return { x: 45, y: 12 };
        if (pos === 'SF') return { x: 20, y: 10 };
        if (pos === 'PF') return { x: 45, y: 88 };
        return { x: 20, y: 90 }; // C
    }
  };

  const SHIRT: Record<Position, string> = { PG: '1', SG: '2', SF: '3', PF: '4', C: '5' };

  const inkFor = (hex: string) => {
    const h = hex.replace('#', '');
    if (h.length < 6) return '#fff';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return r * 0.3 + g * 0.59 + b * 0.11 > 165 ? '#1a1208' : '#fff';
  };

  const onHalf = (half: { x: number, y: number }) => {
    const along = Math.max(8, Math.min(47, 8 + half.x * 0.36));
    const fullX = 100 - along;
    return { x: (fullX - 50) * 2, y: half.y };
  };

  let coords = $derived(
    POSITIONS.map(pos => {
      void chartTick;
      const coord = onHalf(getCoordinates(pos, tactics.offensiveStyle));
      const starterId = team.depthChart[pos]?.[0];
      const player = roster.find(p => p.id === starterId) || roster.find(p => p.position === pos) || roster[0];
      const last = player?.name.split(' ').slice(-1)[0] ?? pos;
      return { pos, name: player ? player.name : pos, last, rating: player?.overallRating ?? 0, ...coord };
    })
  );
</script>

<div class="chalkboard-container fade-in">
  <div class="card rotation-card">
    <h3 style="font-size: 1rem; margin-bottom: 6px;">Rotation</h3>
    <p style="margin: 0 0 16px; color: var(--text-secondary); font-size: 0.9rem;">
      The first name at each spot starts. Move a player up for more minutes. Slide someone over when you want a different look, like a power forward at center.
    </p>
    <div class="rotation-grid">
      {#each POSITIONS as pos}
        {@const depth = depthAt(pos)}
        <div class="rotation-col">
          <div class="rotation-title">
            <span>{POSITION_NAME[pos]}</span>
            <span class="badge badge-secondary">{pos}</span>
          </div>
          {#each depth as player, index}
            <div class="rotation-player" class:is-starter={index === 0}>
              <div class="rotation-slot">{SLOT[index] ?? `Deep reserve · ~6 min`}</div>
              <div class="rotation-name">{player.name}</div>
              <div class="ovr-bar"><span style="width: {player.overallRating}%;"></span></div>
              <div class="rotation-meta">{player.overallRating} · {player.position} · {seasonBlurb(player.id)}</div>
              <div class="rotation-actions">
                <button type="button" disabled={index === 0} onclick={() => reorder(pos, index, -1)}>Up</button>
                <button type="button" disabled={index === depth.length - 1} onclick={() => reorder(pos, index, 1)}>Down</button>
              </div>
            </div>
          {:else}
            <div class="rotation-empty">Nobody at this spot</div>
          {/each}
          <select class="tactics-select slide-select" onchange={(e) => { slideTo(pos, e.currentTarget.value); e.currentTarget.value = ''; }}>
            <option value="">Slide a player to {pos}</option>
            {#each roster.filter(player => !(team.depthChart[pos] || []).includes(player.id)) as player}
              <option value={player.id}>{player.name} ({player.position}, {player.overallRating})</option>
            {/each}
          </select>
        </div>
      {/each}
    </div>
  </div>

  <div class="dashboard-grid board">
    <!-- Left panel: Tactical adjustments -->
    <div class="card" style="grid-column: span 5; display: flex; flex-direction: column; gap: 20px;">
      <h3 style="font-size: 1rem;">Scheme</h3>

      <!-- Offensive settings -->
      <div class="setting-group">
        <label for="off-style">Offense</label>
        <select id="off-style" class="tactics-select" bind:value={tactics.offensiveStyle} onchange={() => onTacticsChanged?.()}>
          <option value="pace-and-space">Pace and space</option>
          <option value="pick-and-roll">Pick-and-roll</option>
          <option value="motion">Motion</option>
          <option value="post-up">Post-up</option>
          <option value="isolation">Isolation</option>
        </select>
      </div>

      <div class="setting-group">
        <label for="tempo">Pace</label>
        <select id="tempo" class="tactics-select" bind:value={tactics.tempo} onchange={() => onTacticsChanged?.()}>
          <option value="slow">Slow it down</option>
          <option value="balanced">Balanced</option>
          <option value="fast">Push in transition</option>
        </select>
      </div>

      <!-- Defensive settings -->
      <div class="setting-group" style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <label for="def-cov">Pick-and-roll coverage</label>
        <select id="def-cov" class="tactics-select" bind:value={tactics.defensiveCoverage} onchange={() => onTacticsChanged?.()}>
          <option value="drop">Drop</option>
          <option value="blitz">Blitz the handler</option>
          <option value="switch-everything">Switch everything</option>
          <option value="zone-23">2-3 zone</option>
          <option value="zone-32">3-2 zone</option>
        </select>
      </div>

      <div class="setting-group">
        <label for="double-team">Double team</label>
        <select id="double-team" class="tactics-select" bind:value={tactics.doubleTeamTrigger} onchange={() => onTacticsChanged?.()}>
          <option value="always">Every touch</option>
          <option value="late-clock">Late clock</option>
          <option value="never">Stay home</option>
        </select>
      </div>

      <!-- Role assignment -->
      <div class="setting-group" style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <h4 style="margin-bottom: 12px; font-size: 0.95rem; color: var(--text-secondary);">Starter roles</h4>
        
        {#each starters as player}
          <div class="role-row">
            <span class="role-player-name">{player.name} ({player.position})</span>
            <select 
              class="role-select" 
              bind:value={tactics.offensiveRoles[player.id]}
              onchange={() => onTacticsChanged?.()}
            >
              {#each OFF_ROLES as role}
                <option value={role.value}>{role.label}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </div>

    <!-- Right panel: Interactive 2D Court -->
    <div class="card floor-card">
      <h4 class="floor-title">{tactics.offensiveStyle === 'pace-and-space' ? 'Pace and space' : tactics.offensiveStyle === 'pick-and-roll' ? 'Pick-and-roll' : tactics.offensiveStyle === 'post-up' ? 'Post-up' : tactics.offensiveStyle === 'motion' ? 'Motion' : 'Isolation'}</h4>
      <div class="half">
        <svg class="wood" viewBox="470 0 470 500" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="tacticsMaple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#e7b56a"/>
              <stop offset="0.45" stop-color="#d09245"/>
              <stop offset="1" stop-color="#b8742e"/>
            </linearGradient>
          </defs>
          <rect x="470" y="0" width="470" height="500" fill="url(#tacticsMaple)"/>
          <rect x="478" y="10" width="452" height="480" fill="none" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <line x1="470" y1="10" x2="470" y2="490" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <path d="M470 190 A60 60 0 0 1 470 310" fill="none" stroke="rgba(255,248,240,0.9)" stroke-width="3"/>
          <rect x="750" y="170" width="180" height="160" fill="rgba(140,62,24,0.28)" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M750 190 A60 60 0 0 0 750 310" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <path d="M750 190 A60 60 0 0 1 750 310" fill="none" stroke="rgba(255,248,240,0.55)" stroke-width="3" stroke-dasharray="8 7"/>
          <path d="M930 32 H798 A237 237 0 0 1 798 468 H930" fill="none" stroke="rgba(255,248,240,0.92)" stroke-width="3"/>
          <line x1="904" y1="214" x2="904" y2="286" stroke="#f8fafc" stroke-width="5"/>
          <line x1="904" y1="250" x2="888" y2="250" stroke="#f8fafc" stroke-width="3"/>
          <circle cx="882" cy="250" r="9" fill="none" stroke="#ea580c" stroke-width="4"/>
        </svg>
        {#each coords as node}
          <div class="actor" style="left: {node.x}%; top: {node.y}%; z-index: {Math.round(node.y)};" title="{node.name}">
            <svg class="kit" viewBox="0 0 36 30" aria-hidden="true">
              <path d="M8 7 L12 4 H24 L28 7 L33 9 L29 13 V27 H7 V13 L3 9 Z" fill={team.color} stroke="rgba(0,0,0,0.45)" stroke-width="1"/>
              <path d="M12 4 L18 8 L24 4" fill={team.trim ?? '#E8E4D9'}/>
              <text x="18" y="21" text-anchor="middle" fill={inkFor(team.color)} font-size="10" font-weight="800">{SHIRT[node.pos]}</text>
            </svg>
            <span class="plate">{node.last}</span>
          </div>
        {/each}
      </div>
      <p class="floor-note">The set moves when you change the offense. Pace and space spreads the floor. Post-up puts the big on the block.</p>
    </div>
  </div>
</div>

<style>
  .chalkboard-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .board { order: 0; }
  .rotation-card { order: 1; }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tactics-select, .role-select {
    background-color: var(--bg-dark);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 10px 14px;
    border-radius: 6px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
    cursor: pointer;
  }

  .tactics-select:focus, .role-select:focus {
    border-color: var(--primary);
  }

  .role-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .role-player-name {
    font-size: 0.85rem;
    color: var(--text-primary);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 45%;
  }

  .role-select {
    padding: 6px 10px;
    font-size: 0.8rem;
    width: 55%;
  }

  .rotation-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .rotation-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .rotation-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }

  .rotation-player {
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 10px;
  }

  .rotation-player.is-starter {
    border-color: #d6d3d1;
  }

  .ovr-bar {
    margin-top: 6px;
    height: 4px;
    border-radius: 99px;
    background: #0c0e14;
    overflow: hidden;
  }

  .ovr-bar span {
    display: block;
    height: 100%;
    background: #86efac;
  }

  .floor-card {
    grid-column: span 7;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .floor-title {
    margin: 0 0 10px;
    text-transform: capitalize;
  }

  .half {
    position: relative;
    width: 100%;
    aspect-ratio: 47 / 50;
    border-radius: 8px;
    overflow: hidden;
  }

  .wood {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .actor {
    position: absolute;
    transform: translate(-50%, -78%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }

  .kit {
    width: 30px;
    height: 26px;
    filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.45));
  }

  .plate {
    margin-top: -2px;
    background: rgba(8, 10, 16, 0.88);
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .floor-note {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 10px 0 0;
  }

  .rotation-slot {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .rotation-name {
    font-weight: 700;
    font-size: 0.9rem;
    margin-top: 2px;
  }

  .rotation-meta {
    font-size: 0.72rem;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .rotation-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .rotation-actions button {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 4px;
    font-size: 0.72rem;
    padding: 4px 0;
    cursor: pointer;
  }

  .rotation-actions button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .rotation-empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 8px 0;
  }

  .slide-select {
    padding: 6px 8px;
    font-size: 0.75rem;
  }

  @media (max-width: 1100px) {
    .rotation-grid {
      grid-template-columns: 1fr;
    }
    .floor-card {
      grid-column: auto;
    }
  }
</style>
