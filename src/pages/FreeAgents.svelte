<script lang="ts">
  import type { Team, Player, Position } from '../sim/types';
  import { CBASimulator, CBA_CONSTANTS } from '../sim/cba';

  let { 
    team = $bindable(), 
    freeAgents = $bindable(), 
    onRosterChanged 
  }: { 
    team: Team, 
    freeAgents: Player[], 
    onRosterChanged?: () => void 
  } = $props();

  // Search & Filter state
  let searchQuery = $state('');
  let filterPosition = $state('ALL');

  // Selected Player Profile Modal
  let selectedPlayer = $state<Player | null>(null);

  // Negotiation states
  let negotiatingPlayer = $state<Player | null>(null);
  let negotiationStage = $state<'intro' | 'offering' | 'accepted' | 'stalled' | 'walked_away'>('intro');
  let agentMood = $state<'happy' | 'neutral' | 'annoyed' | 'furious'>('neutral');
  let agentText = $state('');
  let currentOffer = $state(0);
  let currentYears = $state(2);
  let negotiationRounds = $state(3);
  let agentName = $state('');
  let agencyName = $state('');
  let offerErrorMessage = $state('');

  // Team finance derived values
  let totalSalaries = $derived(CBASimulator.calculateTotalSalaries(team));
  let capSpace = $derived(CBA_CONSTANTS.SALARY_CAP - totalSalaries);
  let apron2Margin = $derived(CBA_CONSTANTS.SECOND_APRON - totalSalaries);

  const formatNumber = (num: number) => {
    return '$' + Math.round(num).toLocaleString();
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

  // Compile and filter free agents list
  let filteredFreeAgents = $derived.by(() => {
    return freeAgents.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPos = filterPosition === 'ALL' || p.position === filterPosition;
      return matchesSearch && matchesPos;
    }).sort((a, b) => b.overallRating - a.overallRating);
  });

  const getAgentDetails = (player: Player) => {
    const seed = player.name.charCodeAt(0) + player.name.charCodeAt(player.name.length - 1);
    const agentFirsts = ["Rich", "Scott", "Rob", "Beka", "Jeff", "Leon", "Mark", "David", "Aaron", "Happy"];
    const agentLasts = ["Paul", "Boras", "Pelinka", "Obasi", "Schwartz", "Rose", "Bartelstein", "Falk", "Goodwin", "Walters"];
    
    const first = agentFirsts[seed % agentFirsts.length];
    const last = agentLasts[(seed + 3) % agentLasts.length];
    
    const agencySuffixes = ["Sports Group", "Athletic Representation", "Partners", "Management", "Agencies"];
    const agencyName = `${last} ${agencySuffixes[seed % agencySuffixes.length]}`;
    
    return {
      name: `${first} ${last}`,
      agency: agencyName
    };
  };

  const startNegotiation = (player: Player) => {
    selectedPlayer = null; // Close profile if open
    offerErrorMessage = '';
    
    // 15 players roster size constraint check
    if (team.roster.length >= 15) {
      alert(`Negotiations cannot begin because your roster is at maximum capacity (15/15 players).\nYou must release a player from your Roster tab first.`);
      return;
    }

    negotiatingPlayer = player;
    negotiationStage = 'intro';
    agentMood = 'neutral';
    negotiationRounds = 3;
    currentYears = 2;

    const isContender = team.wins > team.losses;
    const baseline = CBASimulator.getPlayerSalaryDemand(player, { isContender });
    currentOffer = baseline;

    const details = getAgentDetails(player);
    agentName = details.name;
    agencyName = details.agency;

    agentText = `Hello. I represent ${player.name}. We are testing the market and looking for a suitable team. My client is seeking a contract around ${formatNumber(baseline)} per year. What kind of offer do you have?`;
  };

  const submitOffer = () => {
    offerErrorMessage = '';
    if (!negotiatingPlayer) return;

    const isContender = team.wins > team.losses;
    const signCheck = CBASimulator.evaluateSignOffer(team, negotiatingPlayer, currentOffer, currentYears);

    if (!signCheck.allowed) {
      agentText = `I appreciate the offer, but your team has a CBA compliance issue: ${signCheck.reason}. Under league rules, you cannot offer this contract. Please adjust the numbers or clear some space first.`;
      agentMood = 'annoyed';
      return;
    }

    negotiationRounds--;
    const baseline = CBASimulator.getPlayerSalaryDemand(negotiatingPlayer, { isContender });
    const agentType = negotiatingPlayer.contract?.agentType || 'reasonable';

    if (currentOffer >= baseline) {
      negotiationStage = 'accepted';
      agentMood = 'happy';
      agentText = `Deal! We accept your offer of ${formatNumber(currentOffer)} per year for ${currentYears} years. We are excited to sign with ${team.city} and hit the court!`;
    } else {
      if (negotiationRounds <= 0) {
        negotiationStage = 'walked_away';
        agentMood = 'furious';
        agentText = `This negotiation is over. Your offers are insulting and way below our market valuation. We will look elsewhere for opportunities.`;
      } else {
        if (agentType === 'hardball') {
          if (currentOffer < baseline * 0.93) {
            negotiationRounds = Math.max(0, negotiationRounds - 1);
            agentMood = 'furious';
            agentText = `This is far below my client's value. You are offering ${formatNumber(currentOffer)}, but we won't even consider anything below ${formatNumber(baseline * 1.05)}. Bring a serious offer or we walk.`;
          } else {
            agentMood = 'annoyed';
            agentText = `That's still too low. Hardball agents don't settle for discount rates. We need at least ${formatNumber(baseline * 1.02)} to sign.`;
          }
        } else if (agentType === 'ring-chaser') {
          if (isContender) {
            const discountedDemand = baseline * 0.82;
            if (currentOffer >= discountedDemand) {
              negotiationStage = 'accepted';
              agentMood = 'happy';
              agentText = `Winning a championship is our absolute priority. We accept your discounted offer of ${formatNumber(currentOffer)} per year for ${currentYears} years! Let's chase that ring!`;
            } else {
              agentMood = 'annoyed';
              agentText = `We want to join a winner, but ${formatNumber(currentOffer)} is too low even with a contender discount. We need at least ${formatNumber(discountedDemand)}.`;
            }
          } else {
            agentMood = 'annoyed';
            agentText = `My client wants to win rings. Since your team is not currently a contender, you will have to pay full market value. We won't go below ${formatNumber(baseline)}.`;
          }
        } else if (agentType === 'team-first') {
          const discountedDemand = baseline * 0.92;
          if (currentOffer >= discountedDemand) {
            negotiationStage = 'accepted';
            agentMood = 'happy';
            agentText = `We accept your offer of ${formatNumber(currentOffer)}! My client wants to build something special here.`;
          } else {
            const counter = Math.round(baseline * 0.94);
            agentMood = 'neutral';
            agentText = `We like your team, but we need a bit more security. Make it ${formatNumber(counter)} for ${currentYears} years, and we'll sign it.`;
          }
        } else {
          if (currentOffer >= baseline * 0.95) {
            const counter = Math.round(baseline * 0.97);
            agentMood = 'neutral';
            agentText = `We are very close. Give us ${formatNumber(counter)} and we have a deal.`;
          } else {
            agentMood = 'annoyed';
            agentText = `That's below what my client is looking for. We want to find a deal, but we need something closer to ${formatNumber(baseline)}.`;
          }
        }
      }
    }
  };

  const applyNegotiatedContract = () => {
    if (!negotiatingPlayer) return;
    
    // Double check roster spots first
    if (team.roster.length >= 15) {
      alert("Your roster is already full! Please release a player first.");
      negotiatingPlayer = null;
      return;
    }

    const testSalaries = CBASimulator.generateContractSalaries(currentOffer, currentYears, false); // free agent has no bird rights
    
    // Create new contract object
    const newPlayerContract = {
      salaries: testSalaries,
      option: 'none' as const,
      yearsServed: 0,
      birdRights: 'none' as const,
      agentType: negotiatingPlayer.contract?.agentType || 'reasonable'
    };

    // Update the player contract
    negotiatingPlayer.contract = newPlayerContract;
    
    // Add player to team roster
    team.roster = [...team.roster, negotiatingPlayer];
    team.roster.sort((a, b) => b.overallRating - a.overallRating);

    // Remove from free agents list
    freeAgents = freeAgents.filter(p => p.id !== negotiatingPlayer!.id);

    // Recalculate team finances
    CBASimulator.updateTeamFinances(team);

    negotiatingPlayer = null;
    onRosterChanged?.();
  };

  const selectPlayer = (player: Player) => {
    selectedPlayer = player;
  };
</script>

<div class="free-agents-container fade-in">
  <!-- Roster Slots and Financial Status Bar -->
  <div class="card" style="margin-bottom: 24px;">
    <h3 style="color: var(--primary); margin-bottom: 16px; font-size: 1.25rem;">Market Registration & Roster Capacity</h3>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
      <div class="stat-box">
        <span class="stat-lbl">Active Roster Size</span>
        <span class="stat-val" style="color: {team.roster.length >= 15 ? 'var(--danger)' : 'var(--text-primary)'}">
          {team.roster.length} / 15
        </span>
        <span class="stat-sub">{15 - team.roster.length} open slots remaining</span>
      </div>

      <div class="stat-box">
        <span class="stat-lbl">Active Salaries Total</span>
        <span class="stat-val">{formatNumber(totalSalaries)}</span>
        <span class="stat-sub">Cap Limit: {formatNumber(CBA_CONSTANTS.SALARY_CAP)}</span>
      </div>
      
      <div class="stat-box">
        <span class="stat-lbl">Cap Space</span>
        <span class="stat-val" style="color: {capSpace >= 0 ? 'var(--primary)' : 'var(--danger)'}">
          {capSpace >= 0 ? '' : '-'}{formatNumber(Math.abs(capSpace))}
        </span>
        <span class="stat-sub">{capSpace >= 0 ? 'Available space' : 'Over the cap'}</span>
      </div>

      <div class="stat-box">
        <span class="stat-lbl">Max Mid-Level Exception</span>
        <span class="stat-val" style="color: var(--secondary);">
          {formatNumber(apron2Margin > 0 ? (totalSalaries > CBA_CONSTANTS.FIRST_APRON ? 5000000 : 12800000) : 0)}
        </span>
        <span class="stat-sub">CBA tax apron exception room</span>
      </div>
    </div>
  </div>

  <div class="dashboard-grid">
    <!-- Free Agents List Table -->
    <div class="card" style="grid-column: span {selectedPlayer ? '8' : '12'}; transition: all 0.3s ease;">
      <div class="card-title" style="margin-bottom: 20px;">
        <h3>Free Agent Market</h3>
        <div style="display: flex; gap: 12px;">
          <!-- Search -->
          <input 
            type="text" 
            placeholder="Search player name..." 
            bind:value={searchQuery}
            style="background: var(--bg-dark); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem;"
          />
          <!-- Filter Position -->
          <select class="tactics-select" bind:value={filterPosition} style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="ALL">All Positions</option>
            <option value="PG">Point Guard (PG)</option>
            <option value="SG">Shooting Guard (SG)</option>
            <option value="SF">Small Forward (SF)</option>
            <option value="PF">Power Forward (PF)</option>
            <option value="C">Center (C)</option>
          </select>
        </div>
      </div>

      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Player Name</th>
              <th style="text-align: center;">Pos</th>
              <th style="text-align: center;">Age</th>
              <th style="text-align: center;">Overall</th>
              <th>Demanded Salary</th>
              <th>Agent Demeanor</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFreeAgents as agent}
              <tr class="agent-row" class:active-profile={selectedPlayer?.id === agent.id}>
                <td>
                  <button 
                    type="button" 
                    style="background: none; border: none; color: inherit; text-align: left; cursor: pointer; font-weight: 700; width: 100%;"
                    onclick={() => selectPlayer(agent)}
                  >
                    {agent.name}
                  </button>
                </td>
                <td style="text-align: center;"><span class="badge badge-secondary">{agent.position}</span></td>
                <td style="text-align: center;">{agent.age}</td>
                <td style="text-align: center; font-weight: 800; color: var(--primary);">{agent.overallRating}</td>
                <td style="font-weight: 600;">{formatNumber(CBASimulator.getPlayerSalaryDemand(agent, { isContender: team.wins > team.losses }))} / yr</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">
                  <span class="badge" class:badge-primary={agent.contract?.agentType === 'team-first'} class:badge-warning={agent.contract?.agentType === 'reasonable'} class:badge-danger={agent.contract?.agentType === 'hardball'}>
                    {agent.contract?.agentType || 'reasonable'}
                  </span>
                </td>
                <td style="text-align: right;">
                  <button 
                    type="button"
                    class="btn btn-primary" 
                    style="padding: 6px 12px; font-size: 0.8rem;" 
                    onclick={() => startNegotiation(agent)}
                  >
                    🤝 Negotiate
                  </button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No free agents found in current pool.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Free Agent Profile Card -->
    {#if selectedPlayer}
      <div class="card fade-in" style="grid-column: span 4; display: flex; flex-direction: column; height: fit-content;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="color: var(--primary);">Player Profile</h3>
          <button type="button" class="btn-close" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;" onclick={() => selectedPlayer = null}>×</button>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; border: 2px solid var(--primary);">
            {selectedPlayer.name[0]}
          </div>
          <div>
            <div style="font-weight: 800; font-size: 1.05rem;">{selectedPlayer.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">{getPositionLabel(selectedPlayer.position)} • Age {selectedPlayer.age}</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted); font-size: 0.8rem;">Overall Rating:</span>
            <span style="font-weight: 800; color: var(--primary); font-size: 0.9rem;">{selectedPlayer.overallRating} OVR</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted); font-size: 0.8rem;">Contract Demand:</span>
            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">
              {formatNumber(CBASimulator.getPlayerSalaryDemand(selectedPlayer, { isContender: team.wins > team.losses }))} / yr
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted); font-size: 0.8rem;">Agent Demeanor:</span>
            <span style="font-weight: 600; font-size: 0.85rem; text-transform: capitalize;">{selectedPlayer.contract?.agentType || 'reasonable'}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;">Technical Attributes</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 0.75rem;">
            <div>Close Shot: <b>{selectedPlayer.attributes.technical.closeShot}</b></div>
            <div>Mid-Range: <b>{selectedPlayer.attributes.technical.midRange}</b></div>
            <div>3-Point Shot: <b>{selectedPlayer.attributes.technical.threePoint}</b></div>
            <div>Finishing: <b>{selectedPlayer.attributes.technical.finishing}</b></div>
            <div>Handling: <b>{selectedPlayer.attributes.technical.ballHandling}</b></div>
            <div>Passing Accuracy: <b>{selectedPlayer.attributes.technical.passingAccuracy}</b></div>
            <div>Def. Contest: <b>{selectedPlayer.attributes.technical.perimeterDefense}</b></div>
            <div>Interior Def.: <b>{selectedPlayer.attributes.technical.interiorDefense}</b></div>
            <div>Rebounding: <b>{selectedPlayer.attributes.technical.defRebound}</b></div>
            <div>Blocking: <b>{selectedPlayer.attributes.technical.block}</b></div>
          </div>
        </div>

        {#if selectedPlayer.traits.length > 0}
          <div style="margin-bottom: 20px;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;">Special Traits</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              {#each selectedPlayer.traits as trait}
                <span class="badge badge-primary" style="font-size: 0.7rem;">⭐ {trait.replace('_', ' ')}</span>
              {/each}
            </div>
          </div>
        {/if}

        <button 
          type="button" 
          class="btn btn-primary" 
          style="width: 100%; margin-top: auto;" 
          onclick={() => startNegotiation(selectedPlayer!)}
        >
          🤝 Begin Contract Talks
        </button>
      </div>
    {/if}
  </div>

  <!-- Agent Negotiation Modal (Consistent overlay with RosterCBA) -->
  {#if negotiatingPlayer}
    <div class="modal-overlay">
      <div class="modal-content fade-in">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.2rem; margin: 0; color: var(--primary);">Negotiate Contract</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Client: {negotiatingPlayer.name} ({negotiatingPlayer.position} | {negotiatingPlayer.overallRating} OVR)</span>
          </div>
          {#if negotiationStage !== 'accepted' && negotiationStage !== 'walked_away'}
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick={() => negotiatingPlayer = null}>Cancel Talks</button>
          {/if}
        </div>

        <!-- Agent Details Card -->
        <div class="agent-profile">
          <div class="agent-avatar">💼</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">{agentName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{agencyName}</div>
            <div style="display: flex; gap: 8px; font-size: 0.75rem; margin-top: 2px;">
              <span class="badge badge-secondary">Style: {negotiatingPlayer.contract?.agentType || 'reasonable'}</span>
              <span class="badge badge-primary">Mood: {agentMood === 'happy' ? '😊 Happy' : (agentMood === 'neutral' ? '😐 Neutral' : (agentMood === 'annoyed' ? '😒 Annoyed' : '😡 Furious'))}</span>
            </div>
          </div>
        </div>

        <!-- Dialogue Bubble -->
        <div class="agent-speech-bubble">
          {agentText}
        </div>

        <!-- Offer Form / Controls -->
        {#if negotiationStage === 'intro' || negotiationStage === 'offering'}
          <div class="negotiation-controls">
            <!-- Salary Slider -->
            <div class="control-row">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                <label for="salary-slider">Salary Offer (per year):</label>
                <b style="color: var(--primary);">{formatNumber(currentOffer)}</b>
              </div>
              <input 
                id="salary-slider"
                type="range" 
                class="salary-slider"
                min={CBA_CONSTANTS.MINIMUM_SALARY} 
                max={40000000} 
                step={50000}
                bind:value={currentOffer} 
              />
              <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: -2px;">
                <span>Min: {formatNumber(CBA_CONSTANTS.MINIMUM_SALARY)}</span>
                <span>Max: $40.0M</span>
              </div>
            </div>

            <!-- Years Selector -->
            <div class="control-row">
              <label for="years-select">Contract Length:</label>
              <select id="years-select" class="tactics-select" bind:value={currentYears} style="padding: 6px 12px; font-size: 0.85rem; width: 100%;">
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={4}>4 Years</option>
              </select>
            </div>

            <!-- CBA Helper Box -->
            <div style="background-color: var(--bg-dark); padding: 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--border-color);">
              <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase;">Team CBA Standing</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div>• Current Cap Space: <span style="font-weight: 700; color: {capSpace >= 0 ? 'var(--primary)' : 'var(--danger)'}">{formatNumber(capSpace)}</span></div>
                <div>• Active Roster Count: <span style="font-weight: 700;">{team.roster.length} / 15 Players</span></div>
                <div style="color: var(--text-muted); margin-top: 4px;">• Free agents signed from the open market do not qualify for Bird Exception salary cap overrides. The contract first-year salary must fit within Cap Space or Mid-Level Exceptions (MLE).</div>
              </div>
            </div>

            <!-- Submit button and rounds tracking -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span class="rounds-badge" class:safe={negotiationRounds > 1}>
                ⚠️ {negotiationRounds} attempts left
              </span>
              <button class="btn btn-primary" onclick={submitOffer} style="padding: 8px 24px;">Submit Offer</button>
            </div>
          </div>
        {:else if negotiationStage === 'accepted'}
          <div style="display: flex; flex-direction: column; gap: 14px; text-align: center;">
            <div style="font-size: 1.1rem; color: var(--primary); font-weight: 700;">Agreement Reached!</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Both parties have agreed to the contract details. Click below to sign the player to your roster.</p>
            <button class="btn btn-primary" onclick={applyNegotiatedContract} style="padding: 10px; font-size: 0.9rem; font-weight: 700; margin-top: 10px;">✍️ Sign Player to Roster</button>
          </div>
        {:else}
          <!-- Walked away / Stalled -->
          <div style="display: flex; flex-direction: column; gap: 14px; text-align: center;">
            <div style="font-size: 1.1rem; color: var(--danger); font-weight: 700;">Negotiations Terminated</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">The agent has walked away and refuses to negotiate further at this time.</p>
            <button class="btn btn-secondary" onclick={() => negotiatingPlayer = null} style="padding: 10px; font-size: 0.9rem; font-weight: 700; margin-top: 10px;">Close Table</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .agent-row {
    transition: background-color 0.2s;
  }

  .agent-row:hover {
    background-color: rgba(255, 255, 255, 0.03) !important;
  }

  .agent-row.active-profile {
    background-color: var(--primary-glow) !important;
    border-left: 3px solid var(--primary);
  }

  .stat-box {
    background-color: var(--bg-dark);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-lbl {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-val {
    font-size: 1.35rem;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--text-primary);
  }

  .stat-sub {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  /* Modal Content */
  .modal-content {
    background-color: #1e293b;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 90%;
    max-width: 580px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: var(--text-primary);
  }

  /* Agent profile area */
  .agent-profile {
    display: flex;
    align-items: center;
    gap: 16px;
    background-color: var(--bg-dark);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .agent-avatar {
    font-size: 2rem;
    background-color: rgba(255, 255, 255, 0.05);
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Agent dialogue speech bubble */
  .agent-speech-bubble {
    position: relative;
    background: #0f172a;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    font-size: 0.95rem;
    line-height: 1.5;
    margin-top: 10px;
  }

  .agent-speech-bubble::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 30px;
    width: 0;
    height: 0;
    border: 10px solid transparent;
    border-bottom-color: var(--border-color);
  }

  .agent-speech-bubble::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 30px;
    width: 0;
    height: 0;
    border: 9px solid transparent;
    border-bottom-color: #0f172a;
  }

  /* Slider and input controls */
  .negotiation-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .control-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-row label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .salary-slider {
    width: 100%;
    height: 6px;
    background-color: var(--bg-dark);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    accent-color: var(--primary);
  }

  .rounds-badge {
    background-color: rgba(239, 68, 68, 0.15);
    color: var(--danger);
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .rounds-badge.safe {
    background-color: rgba(16, 185, 129, 0.15);
    color: var(--primary);
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
</style>
