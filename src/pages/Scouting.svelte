<script lang="ts">
  import type { DraftProspect, Position, Team } from '../sim/types';

  let { 
    draftProspects = $bindable(), 
    scoutingTokens = $bindable(),
    userTeam,
    onScoutingChanged,
    onProspectDrafted
  }: { 
    draftProspects: DraftProspect[], 
    scoutingTokens: number,
    userTeam: Team,
    onScoutingChanged?: () => void,
    onProspectDrafted?: (prospectId: string) => void
  } = $props();

  let selectedProspect = $state<DraftProspect | null>(null);
  let draftMessage = $state('');
  let draftMessageType = $state<'success' | 'error' | ''>('');

  const scoutPlayer = (prospect: DraftProspect) => {
    if (scoutingTokens <= 0) return;
    
    // Find in the bound array and update
    const p = draftProspects.find(item => item.id === prospect.id);
    if (p && !p.scouted) {
      p.scouted = true;
      scoutingTokens--;
      onScoutingChanged?.();
      
      // Update selected prospect view if open
      if (selectedProspect && selectedProspect.id === p.id) {
        selectedProspect = { ...p };
      }
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

  const signProspect = (prospect: DraftProspect) => {
    draftMessage = '';
    draftMessageType = '';

    if (userTeam.roster.length >= 15) {
      draftMessage = 'Roster is full (15/15). Release a player first before signing this prospect.';
      draftMessageType = 'error';
      return;
    }

    // Notify parent to handle the actual draft logic (which needs the LeagueManager)
    onProspectDrafted?.(prospect.id);
    draftMessage = `${prospect.name} has been signed to a rookie contract!`;
    draftMessageType = 'success';

    // Close the panel after a short delay and remove from local list
    setTimeout(() => {
      selectedProspect = null;
      draftMessage = '';
      draftMessageType = '';
    }, 2500);
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

  const getProjectedPotRange = (range: DraftProspect['projectedRange']) => {
    switch (range) {
      case 'Top 3': return 'A+ (88-95 POT)';
      case 'Lottery': return 'A- (82-90 POT)';
      case 'First Round': return 'B (76-85 POT)';
      case 'Second Round': return 'C (70-78 POT)';
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
      <div class="token-orb">
        <span class="compass-icon">🧭</span>
      </div>
      <div>
        <h2>College Scouting Center</h2>
        <p>Scout upcoming collegiate prospects to reveal their exact ratings and build your draft board.</p>
      </div>
    </div>
    <div class="tokens-right">
      <div class="token-count">
        <span class="count-val">{scoutingTokens}</span>
        <span class="count-lbl">Scouting Tokens</span>
      </div>
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- Prospects Grid -->
    <div class="card" style="grid-column: span {selectedProspect ? '8' : '12'}; transition: all 0.3s ease;">
      <h3 class="card-title">Draft Prospects Pool <span class="badge badge-secondary">{draftProspects.length} Available</span></h3>
      
      <div class="prospects-grid">
        {#each draftProspects as prospect}
          <button 
            type="button"
            class="prospect-card" 
            class:scouted={prospect.scouted}
            class:selected={selectedProspect?.id === prospect.id}
            onclick={() => selectProspect(prospect)}
          >
            <div class="card-header-row">
              <span class="badge badge-secondary">{prospect.position}</span>
              <span class="range-badge {prospect.projectedRange.toLowerCase().replace(' ', '-')}">
                {prospect.projectedRange}
              </span>
            </div>

            <div class="prospect-name">{prospect.name}</div>
            <div class="prospect-school">{prospect.school} • Age {prospect.age}</div>

            <div class="ratings-preview">
              <div class="rating-box">
                <span class="box-lbl">Proj. OVR</span>
                <span class="box-val">
                  {#if prospect.scouted}
                    <strong class={getOvrColorClass(prospect.overallRating)}>{prospect.overallRating}</strong>
                  {:else}
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">{getProjectedOvrRange(prospect.projectedRange).split(' ')[0]}</span>
                  {/if}
                </span>
              </div>
              <div class="rating-box">
                <span class="box-lbl">Proj. POT</span>
                <span class="box-val">
                  {#if prospect.scouted}
                    <strong style="color: var(--secondary);">{prospect.potentialRating}</strong>
                  {:else}
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">{getProjectedPotRange(prospect.projectedRange).split(' ')[0]}</span>
                  {/if}
                </span>
              </div>
            </div>

            <div class="card-actions">
              {#if prospect.scouted}
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <span class="scouted-tag">✓ Fully Scouted</span>
                  <span class="badge" style="background: rgba(16,185,129,0.15); color: var(--primary); border: 1px solid rgba(16,185,129,0.3); font-size: 0.65rem; padding: 2px 6px;">Draft Eligible</span>
                </div>
              {:else}
                <button 
                  type="button"
                  class="btn btn-sm btn-scout" 
                  disabled={scoutingTokens <= 0}
                  onclick={(e) => { e.stopPropagation(); scoutPlayer(prospect); }}
                >
                  🔍 Scout (1 Token)
                </button>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Prospect Details Panel -->
    {#if selectedProspect}
      <div class="card prospect-details-panel fade-in" style="grid-column: span 4; display: flex; flex-direction: column;">
        <div class="panel-header">
          <h3 style="color: var(--primary);">Scouting Dossier</h3>
          <button type="button" class="btn-close" onclick={closeDetails}>×</button>
        </div>

        <div class="details-body">
          <div class="profile-header">
            <div class="avatar-circle">
              {selectedProspect.name.split(' ')[0][0]}{selectedProspect.name.split(' ')[1]?.[0] || ''}
            </div>
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
              <span class="lock-icon">🔒</span>
              <p>Ratings Locked</p>
              <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 16px;">
                True Overall and Potential ratings are hidden until scouted.
              </span>
              <button 
                type="button"
                class="btn btn-primary" 
                disabled={scoutingTokens <= 0}
                onclick={() => scoutPlayer(selectedProspect!)}
              >
                🔍 Scout {selectedProspect.name}
              </button>
            </div>
          {/if}

          <hr class="divider" />

          <div class="bullet-section">
            <h4 style="color: var(--primary); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">Key Strengths</h4>
            <ul>
              {#each selectedProspect.strengths as strength}
                <li class="bullet-strength">⚡ {strength}</li>
              {/each}
            </ul>
          </div>

          <div class="bullet-section" style="margin-top: 16px;">
            <h4 style="color: var(--danger); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">Areas of Weakness</h4>
            <ul>
              {#each selectedProspect.weaknesses as weakness}
                <li class="bullet-weakness">⚠️ {weakness}</li>
              {/each}
            </ul>
          </div>

          {#if selectedProspect.scouted}
            <div class="scout-summary-box">
              <p><b>Scout Summary:</b> {selectedProspect.name} projects as a {selectedProspect.overallRating >= 73 ? 'highly skilled instant-starter' : 'long-term developmental piece'} with a potential tier of {selectedProspect.potentialRating >= 88 ? 'franchise cornerstone' : (selectedProspect.potentialRating >= 80 ? 'dependable starter' : 'rotation player')}.</p>
            </div>

            <!-- Draft / Sign Button -->
            {#if draftMessage}
              <div class="draft-message" class:success={draftMessageType === 'success'} class:error={draftMessageType === 'error'}>
                {draftMessageType === 'success' ? '🎉' : '⚠️'} {draftMessage}
              </div>
            {/if}
            <button
              type="button"
              class="btn btn-primary"
              style="width: 100%; margin-top: 16px; font-weight: 800; letter-spacing: 0.03em;"
              disabled={userTeam.roster.length >= 15}
              onclick={() => signProspect(selectedProspect!)}
            >
              🏀 Sign to Roster
              {#if userTeam.roster.length >= 15}
                <span style="font-size: 0.75rem; opacity: 0.7;">(Roster Full)</span>
              {:else}
                <span style="font-size: 0.75rem; opacity: 0.7;">2yr Rookie Deal</span>
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .draft-message {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 8px;
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
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
    border-left: 4px solid var(--primary);
  }


  .tokens-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .token-orb {
    width: 48px;
    height: 48px;
    background: var(--primary-glow);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .compass-icon {
    font-size: 1.5rem;
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
    text-shadow: 0 0 15px var(--primary-glow);
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
    border-radius: 8px;
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
    border-radius: 6px;
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
    background: rgba(16, 185, 129, 0.1);
    color: var(--primary);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .btn-scout:hover:not(:disabled) {
    background: var(--primary);
    color: var(--bg-darker);
  }

  .btn-scout:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Details Panel */
  .prospect-details-panel {
    background: linear-gradient(180deg, var(--bg-card) 0%, rgba(30, 41, 59, 0.9) 100%);
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

  .avatar-circle {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: var(--border-color);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.15rem;
    font-family: var(--font-display);
    border: 2px solid var(--primary);
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
    border-radius: 8px;
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
    text-shadow: 0 0 10px rgba(245, 158, 11, 0.2);
  }

  .text-green {
    color: var(--primary);
    text-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
  }

  .text-blue {
    color: var(--secondary);
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
  }

  .unscouted-card-lock {
    text-align: center;
    padding: 24px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
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
    border-radius: 6px;
  }

  .scout-summary-box p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
</style>
