<script lang="ts">
  import type { Team, TeamTactics, Player, OffensiveRole, Position } from '../sim/types';

  // Svelte 5 Props syntax
  let { team = $bindable(), onTacticsChanged }: { team: Team, onTacticsChanged?: () => void } = $props();

  let tactics = $derived(team.tactics);
  let roster = $derived(team.roster);

  const OFF_ROLES: { value: OffensiveRole; label: string }[] = [
    { value: 'initiator', label: 'Primary Ball Handler / Initiator' },
    { value: 'secondary-initiator', label: 'Secondary Playmaker' },
    { value: 'screen-setter', label: 'Screen Setter' },
    { value: 'spot-up', label: 'Spot-Up Shooter' },
    { value: 'rim-runner', label: 'Rim Runner / Lob Threat' }
  ];

  let starters = $derived(
    (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map(pos => {
      const id = team.depthChart[pos]?.[0];
      return roster.find(p => p.id === id) || roster.find(p => p.position === pos) || roster[0];
    })
  );

  const changeStarter = (pos: Position, playerId: string) => {
    // 1. Prepend to pos depth chart
    const currentList = [...(team.depthChart[pos] || [])];
    const index = currentList.indexOf(playerId);
    if (index !== -1) {
      currentList.splice(index, 1);
    }
    currentList.unshift(playerId);
    team.depthChart[pos] = currentList;

    // 2. Remove from starting position of all other positions to avoid duplicates
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
    positions.forEach(otherPos => {
      if (otherPos !== pos) {
        const otherList = [...(team.depthChart[otherPos] || [])];
        if (otherList[0] === playerId) {
          const pIndex = otherList.indexOf(playerId);
          if (pIndex !== -1) otherList.splice(pIndex, 1);
          otherList.push(playerId); // move to backup
          team.depthChart[otherPos] = otherList;
        } else {
          // Just ensure it's not duplicated as backup either or move to backup
          const pIndex = otherList.indexOf(playerId);
          if (pIndex !== -1) {
            otherList.splice(pIndex, 1);
            otherList.push(playerId);
            team.depthChart[otherPos] = otherList;
          }
        }
      }
    });

    onTacticsChanged?.();
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

  // Get active positions and their coordinates
  let positions = $derived(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]);
  let coords = $derived(
    positions.map(pos => {
      const coord = getCoordinates(pos, tactics.offensiveStyle);
      const starterId = team.depthChart[pos]?.[0];
      const player = roster.find(p => p.id === starterId) || roster.find(p => p.position === pos) || roster[0];
      return { pos, name: player ? player.name : pos, ...coord };
    })
  );
</script>

<div class="chalkboard-container fade-in">
  <div class="dashboard-grid">
    <!-- Left panel: Tactical adjustments -->
    <div class="card" style="grid-column: span 5; display: flex; flex-direction: column; gap: 20px;">
      <h3 style="color: var(--primary); font-size: 1.25rem;">Tactical Chalkboard</h3>

      <!-- Starting Lineup Selector -->
      <div class="setting-group" style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px;">
        <h4 style="font-size: 0.95rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px;">Starting Lineup</h4>
        {#each ['PG', 'SG', 'SF', 'PF', 'C'] as pos}
          {@const starterId = team.depthChart[pos as Position]?.[0]}
          <div class="role-row">
            <span class="role-player-name" style="font-weight: 700;">Starting {pos}</span>
            <select 
              class="role-select" 
              value={starterId} 
              onchange={(e) => changeStarter(pos as Position, e.currentTarget.value)}
            >
              {#each roster as player}
                <option value={player.id}>{player.name} ({player.position} • OVR {player.overallRating})</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>

      <!-- Offensive settings -->
      <div class="setting-group">
        <label for="off-style">Offensive Style</label>
        <select id="off-style" class="tactics-select" bind:value={tactics.offensiveStyle} onchange={() => onTacticsChanged?.()}>
          <option value="pace-and-space">Pace & Space (5-Out)</option>
          <option value="pick-and-roll">Pick & Roll heavy</option>
          <option value="motion">Motion Offense</option>
          <option value="post-up">Feed the Post</option>
          <option value="isolation">1-on-1 Isolation</option>
        </select>
      </div>

      <div class="setting-group">
        <label for="tempo">Game Tempo / Pace</label>
        <select id="tempo" class="tactics-select" bind:value={tactics.tempo} onchange={() => onTacticsChanged?.()}>
          <option value="slow">Slow & Controlled (Stamina conservation)</option>
          <option value="balanced">Balanced Pace</option>
          <option value="fast">Fast Break heavy (High fatigue, fast shots)</option>
        </select>
      </div>

      <!-- Defensive settings -->
      <div class="setting-group" style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <label for="def-cov">Defensive P&R Coverage</label>
        <select id="def-cov" class="tactics-select" bind:value={tactics.defensiveCoverage} onchange={() => onTacticsChanged?.()}>
          <option value="drop">Drop Coverage (Protect paint, give up midrange)</option>
          <option value="blitz">Blitz Handler (Trap PG, high steals/turnovers)</option>
          <option value="switch-everything">Switch Everything (Prevent open shots, mismatch risk)</option>
          <option value="zone-23">2-3 Zone (Deny interior, weak to corner 3s)</option>
          <option value="zone-32">3-2 Zone (Deny perimeter 3s, weak inside)</option>
        </select>
      </div>

      <div class="setting-group">
        <label for="double-team">Double Team Trigger</label>
        <select id="double-team" class="tactics-select" bind:value={tactics.doubleTeamTrigger} onchange={() => onTacticsChanged?.()}>
          <option value="always">Always (Aggressive pressure)</option>
          <option value="late-clock">Late in Shot Clock (Fewer exceptions)</option>
          <option value="never">Never (Stay home on shooters)</option>
        </select>
      </div>

      <!-- Role assignment -->
      <div class="setting-group" style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <h4 style="margin-bottom: 12px; font-size: 0.95rem; color: var(--text-secondary);">Assign Key Offensive Roles</h4>
        
        {#each starters as player}
          <div class="role-row">
            <span class="role-player-name">{player.name} ({player.position})</span>
            <select 
              class="role-select" 
              bind:value={tactics.offensiveRoles[player.id]}
              onchange={() => onTacticsChanged?.()}
            >
              <option value="spot-up">Spot-Up Shooter</option>
              {#each OFF_ROLES as role}
                {#if role.value !== 'spot-up'}
                  <option value={role.value}>{role.label}</option>
                {/if}
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </div>

    <!-- Right panel: Interactive 2D Court -->
    <div class="card" style="grid-column: span 7; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 450px;">
      <h4 style="margin-bottom: 16px; color: var(--text-secondary); width: 100%; text-align: left;">Spacing Representation (Half-Court Offense)</h4>
      
      <div class="court-container" style="width: 100%; aspect-ratio: 1 / 1; max-width: 450px;">
        <!-- Beautiful SVG Court Markings -->
        <svg viewBox="0 0 100 100" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;">
          <!-- Court floor background -->
          <rect width="100%" height="100%" fill="#0f172a" />
          
          <!-- Key / Paint area -->
          <rect x="0" y="34" width="40" height="32" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" />
          <line x1="0" y1="34" x2="40" y2="34" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
          <line x1="0" y1="66" x2="40" y2="66" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
          <line x1="40" y1="34" x2="40" y2="66" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
          
          <!-- Free Throw circle -->
          <path d="M 40,34 A 16,16 0 0,1 40,66" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" stroke-dasharray="2,2" />
          <path d="M 40,34 A 16,16 0 0,0 40,66" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
          
          <!-- Midcourt center circle arc -->
          <path d="M 100,38 A 12,12 0 0,0 100,62" fill="none" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />
          <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />

          <!-- Three-point arc -->
          <path d="M 0,6 L 29.8,6 A 47.5,47.5 0 0,1 29.8,94 L 0,94" fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1.5" />
          
          <!-- Rim, backboard and connector -->
          <line x1="4" y1="42" x2="4" y2="58" stroke="#ffffff" stroke-width="2.5" />
          <line x1="4" y1="50" x2="4.75" y2="50" stroke="#ffffff" stroke-width="1.5" />
          <circle cx="4.75" cy="50" r="1.5" fill="none" stroke="#f97316" stroke-width="2.5" />
        </svg>

        <!-- Player Nodes -->
        {#each coords as node}
          <div 
            class="court-dot offense" 
            style="left: {node.x}%; top: {node.y}%; z-index: 5;"
            title="{node.name} - {node.pos}"
          >
            {node.pos}
            <span class="court-dot-tooltip">{node.name}</span>
          </div>
        {/each}
      </div>

      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 14px; text-align: center;">
        ℹ️ Adjusting your <b>Offensive Style</b> changes how players space the floor and interact on possessions.
      </p>
    </div>
  </div>
</div>

<style>
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

  /* Court visual details */
  .court-rim {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid #ef4444;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }

  .court-backboard {
    position: absolute;
    width: 2px;
    height: 24px;
    background-color: var(--text-primary);
    transform: translate(-50%, -50%);
  }

  .court-dot-tooltip {
    visibility: hidden;
    width: 120px;
    background-color: var(--bg-darker);
    color: var(--text-primary);
    text-align: center;
    border-radius: 4px;
    padding: 4px;
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.75rem;
    border: 1px solid var(--border-color);
  }

  .court-dot:hover .court-dot-tooltip {
    visibility: visible;
    opacity: 1;
  }
</style>
