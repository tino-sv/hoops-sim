<script lang="ts">
  import type { DraftProspect, OffseasonStep, Position, SeasonPhase } from '../sim/types';
  import type { OfferVerdict } from '../sim/cba';

  let { 
    draftProspects, 
    scoutingTokens,
    phase,
    offseasonStep,
    onTheClock,
    clockLabel,
    onScout,
    onDraft
  }: { 
    draftProspects: DraftProspect[], 
    scoutingTokens: number,
    phase: SeasonPhase,
    offseasonStep: OffseasonStep | null,
    onTheClock: boolean,
    clockLabel: string,
    onScout: (prospectId: string) => void,
    onDraft: (prospectId: string) => OfferVerdict
  } = $props();

  let selectedProspect = $state<DraftProspect | null>(null);
  let draftMessage = $state('');
  let draftMessageType = $state<'success' | 'error' | ''>('');
  let boardPos = $state('ALL');
  let boardRange = $state('ALL');
  let boardSort = $state<'range' | 'age' | 'name'>('range');

  const rangeRank: Record<DraftProspect['projectedRange'], number> = {
    'Top 3': 0,
    Lottery: 1,
    'First Round': 2,
    'Second Round': 3
  };

  let board = $derived.by(() => {
    return draftProspects
      .filter(prospect =>
        (boardPos === 'ALL' || prospect.position === boardPos) &&
        (boardRange === 'ALL' || prospect.projectedRange === boardRange)
      )
      .sort((a, b) => {
        if (boardSort === 'name') return a.name.localeCompare(b.name);
        if (boardSort === 'age') return a.age - b.age;
        const left = a.scouted ? -a.overallRating : rangeRank[a.projectedRange];
        const right = b.scouted ? -b.overallRating : rangeRank[b.projectedRange];
        return left - right;
      });
  });

  const scoutPlayer = (prospect: DraftProspect) => {
    if (scoutingTokens <= 0 || prospect.scouted) return;
    onScout(prospect.id);
    if (selectedProspect && selectedProspect.id === prospect.id) {
      selectedProspect = draftProspects.find(item => item.id === prospect.id) ?? selectedProspect;
    }
  };

  const selectProspect = (prospect: DraftProspect) => {
    selectedProspect = prospect;
    draftMessage = '';
    draftMessageType = '';
  };

  const closeDetails = () => {
    selectedProspect = null;
    draftMessage = '';
    draftMessageType = '';
  };

  const draftProspect = (prospect: DraftProspect) => {
    draftMessage = '';
    draftMessageType = '';
    const result = onDraft(prospect.id);
    draftMessage = result.reason;
    draftMessageType = result.allowed ? 'success' : 'error';
    if (result.allowed) selectedProspect = null;
  };

  const getPositionLabel = (pos: Position) => {
    const labels: Record<Position, string> = {
      PG: 'Point Guard',
      SG: 'Shooting Guard',
      SF: 'Small Forward',
      PF: 'Power Forward',
      C: 'Center'
    };
    return labels[pos] || pos;
  };

  const getProjectedOvrRange = (range: DraftProspect['projectedRange']) => {
    switch (range) {
      case 'Top 3': return '72 - 78 OVR';
      case 'Lottery': return '68 - 75 OVR';
      case 'First Round': return '64 - 72 OVR';
      case 'Second Round': return '60 - 68 OVR';
    }
  };

  const getOvrColorClass = (ovr: number) => {
    if (ovr >= 80) return 'text-gold';
    if (ovr >= 70) return 'text-green';
    return 'text-blue';
  };
</script>

<div class="scouting-container fade-in">
  <!-- Scouting Tokens Dashboard -->
  <div class="card tokens-banner">
    <div class="tokens-left">
      <div>
        <h2>Draft Board</h2>
        <p>
          {#if phase === 'offseason' && offseasonStep === 'draft'}
            {clockLabel}. {onTheClock ? 'You are on the clock.' : 'Another team is picking.'}
          {:else if phase === 'offseason'}
            The draft is over. Undrafted players are in free agency.
          {:else}
            Scout the class now. You draft after the season, when your team is on the clock. The public range can be a bucket off.
          {/if}
        </p>
      </div>
    </div>
    <div class="tokens-right">
      <div class="token-count">
        <span class="count-val">{scoutingTokens}</span>
        <span class="count-lbl">Scouting Tokens</span>
      </div>
    </div>
  </div>

  {#if draftMessage && !selectedProspect}
    <div class="draft-message" class:success={draftMessageType === 'success'} class:error={draftMessageType === 'error'} style="margin-bottom: 16px;">
      {draftMessage}
    </div>
  {/if}

  <div class="dashboard-grid">
    <!-- Prospects Grid -->
    <div class="card" style="grid-column: span {selectedProspect ? '8' : '12'}; transition: all 0.3s ease;">
      <h3 class="card-title">Class <span>{board.length}</span></h3>
      <div class="list-tools">
        <select class="tactics-select" bind:value={boardPos}>
          <option value="ALL">All positions</option>
          <option value="PG">PG</option>
          <option value="SG">SG</option>
          <option value="SF">SF</option>
          <option value="PF">PF</option>
          <option value="C">C</option>
        </select>
        <select class="tactics-select" bind:value={boardRange}>
          <option value="ALL">All ranges</option>
          <option value="Top 3">Top 3</option>
          <option value="Lottery">Lottery</option>
          <option value="First Round">First Round</option>
          <option value="Second Round">Second Round</option>
        </select>
        <select class="tactics-select" bind:value={boardSort}>
          <option value="range">Sort: board</option>
          <option value="age">Sort: age</option>
          <option value="name">Sort: name</option>
        </select>
      </div>
      
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th></th>
              <th>Player</th>
              <th>Pos</th>
              <th>Age</th>
              <th>School</th>
              <th>Range</th>
              <th>OVR</th>
              <th>POT</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each board as prospect, index}
              <tr class="board-row" class:active={selectedProspect?.id === prospect.id} onclick={() => selectProspect(prospect)}>
                <td>{index + 1}</td>
                <td>{prospect.name}</td>
                <td>{prospect.position}</td>
                <td>{prospect.age}</td>
                <td>{prospect.school}</td>
                <td>{prospect.projectedRange}</td>
                <td>
                  {#if prospect.scouted}
                    {prospect.overallRating}
                  {:else}
                    <span class="hidden band">{getProjectedOvrRange(prospect.projectedRange).replace(' OVR', '').replace(' - ', '–')}</span>
                  {/if}
                </td>
                <td>{prospect.scouted ? prospect.potentialRating : '—'}</td>
                <td>
                  {#if prospect.scouted}
                    Scouted
                  {:else}
                    <button
                      type="button"
                      class="btn btn-secondary"
                      disabled={scoutingTokens <= 0}
                      onclick={(event) => { event.stopPropagation(); scoutPlayer(prospect); }}
                    >
                      Scout
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Prospect Details Panel -->
    {#if selectedProspect}
      <div class="card prospect-details-panel fade-in" style="grid-column: span 4; display: flex; flex-direction: column;">
        <div class="panel-header">
          <h3>Dossier</h3>
          <button type="button" class="btn-close" onclick={closeDetails}>×</button>
        </div>

        <div class="details-body">
          <div class="profile-header">
            <div>
              <div class="profile-name">{selectedProspect.name}</div>
              <div class="profile-meta">{getPositionLabel(selectedProspect.position)} | {selectedProspect.school}</div>
              <div class="profile-age">Age: {selectedProspect.age} | Projected: {selectedProspect.projectedRange}</div>
            </div>
          </div>

          <hr class="divider" />

          {#if selectedProspect.scouted}
            <div class="scout-report font-display">
              <h4 style="margin-bottom: 12px; color: var(--text-primary); font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em;">Scouting Metrics</h4>
              <div class="metrics-grid">
                <div class="metric-item">
                  <div class="metric-label">True Overall Rating</div>
                  <div class="metric-val {getOvrColorClass(selectedProspect.overallRating)}">{selectedProspect.overallRating}</div>
                </div>
                <div class="metric-item">
                  <div class="metric-label">Potential Ceiling</div>
                  <div class="metric-val" style="color: var(--secondary);">{selectedProspect.potentialRating}</div>
                </div>
              </div>
            </div>
          {:else}
            <div class="unscouted-card-lock">
              <p>Not scouted</p>
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 16px;">
                True Overall and Potential ratings are hidden until scouted.
              </span>
              <button 
                type="button"
                class="btn btn-primary" 
                disabled={scoutingTokens <= 0}
                onclick={() => scoutPlayer(selectedProspect!)}
              >
                Scout {selectedProspect.name}
              </button>
            </div>
          {/if}

          {#if selectedProspect.scouted}
            <hr class="divider" />

            <div class="bullet-section">
              <h4 style="font-size: 0.85rem; margin-bottom: 8px;">Strengths</h4>
              <ul>
                {#each selectedProspect.strengths as strength}
                  <li class="bullet-strength">{strength}</li>
                {/each}
              </ul>
            </div>

            <div class="bullet-section" style="margin-top: 16px;">
              <h4 style="font-size: 0.85rem; margin-bottom: 8px;">Weaknesses</h4>
              <ul>
                {#each selectedProspect.weaknesses as weakness}
                  <li class="bullet-weakness">{weakness}</li>
                {/each}
              </ul>
            </div>

            <div class="scout-summary-box">
              <p><b>Scout Summary:</b> {selectedProspect.name} is a {selectedProspect.overallRating >= 73 ? 'ready contributor' : 'project'} with a ceiling of {selectedProspect.potentialRating}. Those notes come from his actual ratings, not a separate blurb.</p>
            </div>
          {/if}

          {#if draftMessage}
            <div class="draft-message" class:success={draftMessageType === 'success'} class:error={draftMessageType === 'error'}>
              {draftMessage}
            </div>
          {/if}
          {#if onTheClock}
            <button
              type="button"
              class="btn btn-primary"
              style="width: 100%; margin-top: 16px; font-weight: 800; letter-spacing: 0.03em;"
              onclick={() => draftProspect(selectedProspect!)}
            >
              Draft {selectedProspect.name}
              <span style="font-size: 0.75rem; opacity: 0.7;">{selectedProspect.scouted ? 'Rookie scale' : 'Unscouted'}</span>
            </button>
          {:else}
            <p style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted);">
              {phase === 'regular'
                ? 'You cannot sign him during the season.'
                : offseasonStep === 'draft'
                  ? 'Your pick is not up.'
                  : 'Draft night is over.'}
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .board-row { cursor: pointer; }
  .board-row.active td { background: var(--primary-glow); }
  .hidden { color: var(--text-secondary); }
  .band { white-space: nowrap; }
  .board-row .btn { padding: 4px 10px; font-size: 0.78rem; }
  .draft-message {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 2px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid;
  }
  .draft-message.success {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.35);
    color: var(--primary);
  }
  .draft-message.error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: var(--danger);
  }

  .tokens-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    background: var(--bg-card);
    border-left: 2px solid var(--border-color);
  }


  .tokens-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .tokens-banner h2 {
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .tokens-banner p {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .token-count {
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .count-val {
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--primary);
    line-height: 1;
    font-family: var(--font-display);
  }

  .count-lbl {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .prospects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .prospect-card {
    background: rgba(15, 23, 42, 0.35);
    border: 1px solid var(--border-color);
    border-radius: 2px;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 190px;
    width: 100%;
  }

  .prospect-card:hover {
    border-color: var(--text-muted);
    transform: translateY(-2px);
    background: rgba(15, 23, 42, 0.5);
  }

  .prospect-card.selected {
    border-color: var(--primary);
    background: rgba(16, 185, 129, 0.03);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.1);
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .range-badge {
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .range-badge.top-3 {
    background: rgba(245, 158, 11, 0.15);
    color: var(--accent);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .range-badge.lottery {
    background: rgba(236, 72, 153, 0.15);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.3);
  }
  .range-badge.first-round {
    background: rgba(59, 130, 246, 0.15);
    color: var(--secondary);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .range-badge.second-round {
    background: rgba(100, 116, 139, 0.15);
    color: var(--text-secondary);
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .prospect-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .prospect-school {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .ratings-preview {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    background: rgba(0, 0, 0, 0.2);
    padding: 8px;
    border-radius: 2px;
  }

  .rating-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .box-lbl {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 600;
  }

  .box-val {
    font-size: 0.9rem;
    font-weight: 700;
    font-family: var(--font-display);
    margin-top: 1px;
  }

  .card-actions {
    text-align: center;
  }

  .scouted-tag {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--primary);
    background: rgba(16, 185, 129, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-block;
  }

  .btn-scout {
    width: 100%;
    padding: 6px 12px;
    font-size: 0.75rem;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-scout:hover:not(:disabled) {
    background: #e7e5e4;
    color: #1c1917;
  }

  .btn-scout:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Details Panel */
  .prospect-details-panel {
    background: var(--bg-card);
    border-left: 2px solid var(--border-color);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    transition: color 0.15s;
  }

  .btn-close:hover {
    color: var(--text-primary);
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }

  .profile-name {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .profile-meta {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 1px;
  }

  .profile-age {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .divider {
    border: 0;
    height: 1px;
    background: var(--border-color);
    margin: 16px 0;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 8px;
  }

  .metric-item {
    background: rgba(0, 0, 0, 0.25);
    padding: 12px;
    border-radius: 2px;
    text-align: center;
    border: 1px solid var(--border-color);
  }

  .metric-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .metric-val {
    font-size: 1.8rem;
    font-weight: 800;
    font-family: var(--font-display);
  }

  .text-gold {
    color: var(--accent);
  }

  .text-green {
    color: var(--primary);
  }

  .text-blue {
    color: var(--secondary);
  }

  .unscouted-card-lock {
    text-align: center;
    padding: 24px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
    border: 1px dashed var(--border-color);
  }

  .lock-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 8px;
  }

  .unscouted-card-lock p {
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .bullet-section ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bullet-strength, .bullet-weakness {
    font-size: 0.8rem;
    font-weight: 500;
  }
  .bullet-strength { color: #34d399; }
  .bullet-weakness { color: #f87171; }

  .scout-summary-box {
    margin-top: 20px;
    padding: 12px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 2px;
  }

  .scout-summary-box p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
</style>
