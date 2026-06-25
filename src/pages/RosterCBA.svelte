<script lang="ts">
  import type { Team, Player, Position } from '../sim/types';
  import { CBASimulator, CBA_CONSTANTS } from '../sim/cba';

  let { team = $bindable(), otherTeams, onRosterChanged }: { team: Team, otherTeams: Team[], onRosterChanged?: () => void } = $props();

  const TRAIT_META: Record<string, { name: string; desc: string; icon: string; style: string }> = {
    sharpshooter: {
      name: 'Sharpshooter',
      desc: 'Elite three-point specialist (+6% to 3PT makes)',
      icon: '🎯',
      style: 'border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #f87171;'
    },
    lockdown: {
      name: 'Lockdown',
      desc: 'Elite defender who contests shots relentlessly (+10 to defensive contests)',
      icon: '🛡️',
      style: 'border: 1px solid rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.1); color: #60a5fa;'
    },
    playmaker: {
      name: 'Floor General',
      desc: 'Exceptional passing and playmaking (+6% to assisted shooter success rate)',
      icon: '🪄',
      style: 'border: 1px solid rgba(168, 85, 247, 0.4); background: rgba(168, 85, 247, 0.1); color: #c084fc;'
    },
    post_beast: {
      name: 'Post Beast',
      desc: 'Dominant scoring close to the basket (+6% to interior makes)',
      icon: '🦁',
      style: 'border: 1px solid rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1); color: #fbbf24;'
    },
    glass_cleaner: {
      name: 'Glass Cleaner',
      desc: 'Relentless rebounder (+25% to rebounding strength)',
      icon: '🧼',
      style: 'border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); color: #34d399;'
    },
    clutch: {
      name: 'Clutch',
      desc: 'Composed under pressure (+6% to late-clock and overtime success)',
      icon: '⏱️',
      style: 'border: 1px solid rgba(236, 72, 153, 0.4); background: rgba(236, 72, 153, 0.1); color: #f472b6;'
    },
    iron_man: {
      name: 'Iron Man',
      desc: 'Durable and high stamina (reduces fatigue buildup by 30%)',
      icon: '🤖',
      style: 'border: 1px solid rgba(100, 116, 139, 0.4); background: rgba(100, 116, 139, 0.1); color: #94a3b8;'
    }
  };

  let selectedPlayer: Player | null = $state(null);
  let extensionSuccessMessage = $state('');
  let extensionErrorMessage = $state('');

  // Negotiation States
  let negotiatingPlayer: Player | null = $state(null);
  let negotiationStage = $state<'intro' | 'offering' | 'accepted' | 'stalled' | 'walked_away'>('intro');
  let agentMood = $state<'happy' | 'neutral' | 'annoyed' | 'furious'>('neutral');
  let agentText = $state('');
  let currentOffer = $state(0);
  let currentYears = $state(3);
  let negotiationRounds = $state(3);
  let agentName = $state('');
  let agencyName = $state('');
  let offerErrorMessage = $state('');

  // Svelte 5 derived state
  let totalSalaries = $derived(CBASimulator.calculateTotalSalaries(team));
  let capSpace = $derived(CBA_CONSTANTS.SALARY_CAP - totalSalaries);
  let apron1Margin = $derived(CBA_CONSTANTS.FIRST_APRON - totalSalaries);
  let apron2Margin = $derived(CBA_CONSTANTS.SECOND_APRON - totalSalaries);

  const formatNumber = (num: number) => {
    return '$' + Math.round(num).toLocaleString();
  };

  const getMoraleClass = (morale: number) => {
    if (morale >= 75) return 'badge-primary';
    if (morale >= 40) return 'badge-warning';
    return 'badge-danger';
  };

  const selectPlayer = (player: Player) => {
    selectedPlayer = player;
    extensionSuccessMessage = '';
    extensionErrorMessage = '';
  };

  const closeProfile = () => {
    selectedPlayer = null;
  };

  const releasePlayer = (player: Player) => {
    if (confirm(`Are you sure you want to release ${player.name}? Doing so will buy out his current year contract ($${player.contract.salaries[0].toLocaleString()}) and create dead cap.`)) {
      team.roster = team.roster.filter(p => p.id !== player.id);
      
      // Update depth chart by removing player ID
      for (const pos in team.depthChart) {
        team.depthChart[pos as Position] = team.depthChart[pos as Position].filter(id => id !== player.id);
      }
      
      CBASimulator.updateTeamFinances(team);
      selectedPlayer = null;
      onRosterChanged?.();
    }
  };

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
    extensionSuccessMessage = '';
    extensionErrorMessage = '';
    offerErrorMessage = '';
    
    negotiatingPlayer = player;
    negotiationStage = 'intro';
    agentMood = 'neutral';
    negotiationRounds = 3;
    currentYears = 3;
    
    const isContender = team.wins > team.losses;
    const baseline = CBASimulator.getPlayerSalaryDemand(player, { isContender });
    currentOffer = baseline;
    
    const details = getAgentDetails(player);
    agentName = details.name;
    agencyName = details.agency;
    
    agentText = `Hello. I am ${agentName} from ${agencyName}. We represent ${player.name}. We are looking to discuss a contract extension. My client is seeking a fair deal around ${formatNumber(baseline)} per year. What can you offer?`;
  };

  const submitOffer = () => {
    offerErrorMessage = '';
    if (!negotiatingPlayer) return;
    
    const isContender = team.wins > team.losses;
    const signCheck = CBASimulator.evaluateSignOffer(team, negotiatingPlayer, currentOffer, currentYears);
    
    if (!signCheck.allowed) {
      agentText = `We appreciate the offer, but your team has a CBA compliance issue: ${signCheck.reason}. Under league rules, you cannot offer this contract. Please adjust the numbers or clear some space first.`;
      agentMood = 'annoyed';
      return;
    }
    
    negotiationRounds--;
    const baseline = CBASimulator.getPlayerSalaryDemand(negotiatingPlayer, { isContender });
    const agentType = negotiatingPlayer.contract.agentType || 'reasonable';
    
    if (currentOffer >= baseline) {
      negotiationStage = 'accepted';
      agentMood = 'happy';
      agentText = `Deal! My client is thrilled to accept this offer of ${formatNumber(currentOffer)} per year for ${currentYears} years. We are excited to keep building here!`;
    } else {
      if (negotiationRounds <= 0) {
        negotiationStage = 'walked_away';
        agentMood = 'furious';
        agentText = `That is enough. We've tried to find middle ground, but your offers are simply not valuation-aligned. We are walking away from the table and will test free agency next season.`;
        extensionErrorMessage = `❌ Negotiations stalled: Agent walked away.`;
      } else {
        if (agentType === 'hardball') {
          if (currentOffer < baseline * 0.93) {
            negotiationRounds = Math.max(0, negotiationRounds - 1);
            agentMood = 'furious';
            agentText = `This is a joke. My client is an elite talent. You are offering ${formatNumber(currentOffer)}, which is way below our bottom line. Come back with a serious offer above ${formatNumber(baseline * 1.05)} or we are done.`;
          } else {
            agentMood = 'annoyed';
            agentText = `That is not enough. Hardball agents don't settle for under-market offers. We need at least ${formatNumber(baseline * 1.02)} to close this deal.`;
          }
        } else if (agentType === 'ring-chaser') {
          if (isContender) {
            const discountedDemand = baseline * 0.82;
            if (currentOffer >= discountedDemand) {
              negotiationStage = 'accepted';
              agentMood = 'happy';
              agentText = `Since you guys are true contenders, my client is excited about winning rings and will accept this discounted offer of ${formatNumber(currentOffer)}! Let's go win a championship!`;
            } else {
              agentMood = 'annoyed';
              agentText = `We are willing to take a contender discount, but ${formatNumber(currentOffer)} is too cheap. We want at least ${formatNumber(discountedDemand)}.`;
            }
          } else {
            agentMood = 'annoyed';
            agentText = `My client wants to win rings. If your team is not a contender, you need to pay full value. We won't go below ${formatNumber(baseline)}.`;
          }
        } else if (agentType === 'team-first') {
          const discountedDemand = baseline * 0.92;
          if (currentOffer >= discountedDemand) {
            negotiationStage = 'accepted';
            agentMood = 'happy';
            agentText = `My client loves this team and wants to be a lifer. We accept the home-team discount offer of ${formatNumber(currentOffer)}!`;
          } else {
            const counter = Math.round(baseline * 0.94);
            agentMood = 'neutral';
            agentText = `My client wants to stay, but we need a bit more. Make it ${formatNumber(counter)} for ${currentYears} years, and we'll sign it.`;
          }
        } else {
          if (currentOffer >= baseline * 0.95) {
            const counter = Math.round(baseline * 0.97);
            agentMood = 'neutral';
            agentText = `We are very close. Give us ${formatNumber(counter)} and we have a deal.`;
          } else {
            agentMood = 'annoyed';
            agentText = `That is too low. We want to be reasonable, but we need something closer to ${formatNumber(baseline)}.`;
          }
        }
      }
    }
  };

  const applyNegotiatedContract = () => {
    if (!negotiatingPlayer) return;
    
    const testSalaries = CBASimulator.generateContractSalaries(currentOffer, currentYears, true);
    
    negotiatingPlayer.contract.salaries = [...negotiatingPlayer.contract.salaries.slice(0, 1), ...testSalaries];
    negotiatingPlayer.contract.yearsServed += 1;
    CBASimulator.updateTeamFinances(team);
    
    extensionSuccessMessage = `🎉 Re-Signed! ${negotiatingPlayer.name} agreed to a ${currentYears}-year extension starting next year, averaging ${formatNumber(currentOffer)}/yr.`;
    
    negotiatingPlayer = null;
    onRosterChanged?.();
  };
</script>

<div class="roster-cba-container fade-in">
  <!-- CBA Overview Card -->
  <div class="card" style="margin-bottom: 24px;">
    <h3 style="color: var(--primary); margin-bottom: 16px; font-size: 1.25rem;">CBA Financial Dashboard</h3>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
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
        <span class="stat-lbl">First Apron Margin</span>
        <span class="stat-val" style="color: {apron1Margin >= 0 ? 'var(--secondary)' : 'var(--danger)'}">
          {formatNumber(apron1Margin)}
        </span>
        <span class="stat-sub">First Apron: {formatNumber(CBA_CONSTANTS.FIRST_APRON)}</span>
      </div>

      <div class="stat-box">
        <span class="stat-lbl">Second Apron Margin</span>
        <span class="stat-val" style="color: {apron2Margin >= 0 ? 'var(--accent)' : 'var(--danger)'}">
          {formatNumber(apron2Margin)}
        </span>
        <span class="stat-sub">Second Apron: {formatNumber(CBA_CONSTANTS.SECOND_APRON)}</span>
      </div>
    </div>

    <!-- Apron warnings -->
    {#if totalSalaries > CBA_CONSTANTS.SECOND_APRON}
      <div class="warning-alert">
        ⚠️ <b>CRITICAL WARNING: Above Second Apron!</b> Your team cannot sign free agents using Mid-Level Exceptions, and trades must match exact outgoing salary.
      </div>
    {:else}
      {#if totalSalaries > CBA_CONSTANTS.FIRST_APRON}
        <div class="warning-alert" style="border-left-color: var(--accent); color: var(--accent);">
          ⚠️ <b>First Apron Warning:</b> Your Mid-Level Exception is capped at Taxpayer rates ($5M) and trade rules are restricted.
        </div>
      {/if}
    {/if}
  </div>

  <div class="dashboard-grid">
    <!-- Main Roster Spreadsheet -->
    <div class="card" style="grid-column: span {selectedPlayer ? '7' : '12'};">
      <h3 class="card-title">Roster Sheet <span class="badge badge-secondary">{team.roster.length} Players</span></h3>
      
      <div class="table-container">
        <table class="sim-table">
          <thead>
            <tr>
              <th>Player Name</th>
              <th>Pos</th>
              <th>Age</th>
              <th>OVR</th>
              <th>Y1 Salary</th>
              <th>Y2 Salary</th>
              <th>Bird Tier</th>
              <th>Morale</th>
            </tr>
          </thead>
          <tbody>
            {#each team.roster as player}
              <tr class="roster-row" class:active={selectedPlayer?.id === player.id} onclick={() => selectPlayer(player)}>
                <td>
                  <div style="font-weight: 700;">{player.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    {#if player.injury}
                      🔴 INJ: {player.injury.description} ({player.injury.daysRemaining}d)
                    {:else}
                      🟢 Healthy
                    {/if}
                  </div>
                </td>
                <td><span class="badge badge-secondary">{player.position}</span></td>
                <td>{player.age}</td>
                <td><span style="font-weight: 800; color: var(--primary);">{player.overallRating}</span></td>
                <td>{formatNumber(player.contract.salaries[0] || 0)}</td>
                <td>{player.contract.salaries[1] ? formatNumber(player.contract.salaries[1]) : '—'}</td>
                <td><span class="badge badge-primary">{player.contract.birdRights.toUpperCase()}</span></td>
                <td><span class="badge {getMoraleClass(player.morale)}">{player.morale}%</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Active Player Profile Panel -->
    {#if selectedPlayer}
      <div class="card fade-in" style="grid-column: span 5; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
          <div>
            <h3 style="font-size: 1.3rem; margin-bottom: 4px;">{selectedPlayer.name}</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <span class="badge badge-secondary">{selectedPlayer.position}</span>
              <span class="badge badge-primary">Age: {selectedPlayer.age}</span>
              <span class="badge badge-warning">Overall: {selectedPlayer.overallRating}</span>
            </div>
            {#if selectedPlayer.traits && selectedPlayer.traits.length > 0}
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                {#each selectedPlayer.traits as trait}
                  {#if TRAIT_META[trait]}
                    <span 
                      class="trait-badge" 
                      style={TRAIT_META[trait].style} 
                      title={TRAIT_META[trait].desc}
                    >
                      {TRAIT_META[trait].icon} {TRAIT_META[trait].name}
                    </span>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick={closeProfile}>✕</button>
        </div>

        <!-- Section: Contract Status -->
        <div class="profile-section">
          <h4 style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px;">Contract & CBA Status</h4>
          <div style="background-color: var(--bg-dark); padding: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
            <div><b>Salary Sheet:</b> {selectedPlayer.contract.salaries.map(s => formatNumber(s)).join(' → ')}</div>
            <div><b>Option:</b> {selectedPlayer.contract.option.toUpperCase()}</div>
            <div><b>Years with Team:</b> {selectedPlayer.contract.yearsServed} yrs</div>
            <div><b>Bird Rights:</b> {selectedPlayer.contract.birdRights.toUpperCase()}</div>
            <div><b>Agent Type:</b> <span style="color: var(--primary); text-transform: capitalize;">{selectedPlayer.contract.agentType}</span></div>
          </div>
        </div>

        <!-- Section: Player Attributes -->
        <div class="profile-section">
          <h4 style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px;">Key Skill Groups</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Simple attribute meters -->
            <div>
              <div class="meter-lbl">🔥 Perimeter Shooting: <span>{selectedPlayer.attributes.technical.threePoint}</span></div>
              <div class="meter-container"><div class="meter-bar" style="width: {selectedPlayer.attributes.technical.threePoint}%"></div></div>
            </div>
            <div>
              <div class="meter-lbl">🏀 Playmaking & Handling: <span>{selectedPlayer.attributes.technical.ballHandling}</span></div>
              <div class="meter-container"><div class="meter-bar" style="width: {selectedPlayer.attributes.technical.ballHandling}%"></div></div>
            </div>
            <div>
              <div class="meter-lbl">🛡️ Perimeter / Rim Defense: <span>{Math.round((selectedPlayer.attributes.technical.perimeterDefense + selectedPlayer.attributes.technical.interiorDefense)/2)}</span></div>
              <div class="meter-container"><div class="meter-bar" style="width: {Math.round((selectedPlayer.attributes.technical.perimeterDefense + selectedPlayer.attributes.technical.interiorDefense)/2)}%"></div></div>
            </div>
            <div>
              <div class="meter-lbl">💪 Physical Strength & Speed: <span>{Math.round((selectedPlayer.attributes.physical.speed + selectedPlayer.attributes.physical.strength)/2)}</span></div>
              <div class="meter-container"><div class="meter-bar" style="width: {Math.round((selectedPlayer.attributes.physical.speed + selectedPlayer.attributes.physical.strength)/2)}%"></div></div>
            </div>
            <div>
              <div class="meter-lbl">🧠 Basketball IQ & Composure: <span>{Math.round((selectedPlayer.attributes.mental.iq + selectedPlayer.attributes.mental.composure)/2)}</span></div>
              <div class="meter-container"><div class="meter-bar" style="width: {Math.round((selectedPlayer.attributes.mental.iq + selectedPlayer.attributes.mental.composure)/2)}%"></div></div>
            </div>
          </div>
        </div>

        <!-- Section: Season Statistics -->
        <div class="profile-section">
          <h4 style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px;">Season Statistics</h4>
          {#if selectedPlayer.careerStats['season'] && (selectedPlayer.careerStats['season'].games || 0) > 0}
            {@const stats = selectedPlayer.careerStats['season']}
            {@const played = stats.games || 0}
            <div style="background-color: var(--bg-dark); padding: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; border: 1px solid var(--border-color);">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">GP</div>
                  <div class="stat-mini-val">{played}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">MIN</div>
                  <div class="stat-mini-val">{(stats.minutes / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">PTS</div>
                  <div class="stat-mini-val">{(stats.points / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">AST</div>
                  <div class="stat-mini-val">{(stats.assists / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">REB</div>
                  <div class="stat-mini-val">{(stats.rebounds / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">STL</div>
                  <div class="stat-mini-val">{(stats.steals / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">BLK</div>
                  <div class="stat-mini-val">{(stats.blocks / played).toFixed(1)}</div>
                </div>
                <div class="stat-mini-box">
                  <div class="stat-mini-lbl">TO</div>
                  <div class="stat-mini-val">{(stats.turnovers / played).toFixed(1)}</div>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <div>
                  <div class="stat-mini-lbl">FG%</div>
                  <div style="font-weight: 700; color: var(--text-primary);">{stats.fga > 0 ? ((stats.fgm / stats.fga) * 100).toFixed(1) : '0.0'}%</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">{stats.fgm}/{stats.fga}</div>
                </div>
                <div>
                  <div class="stat-mini-lbl">3PT%</div>
                  <div style="font-weight: 700; color: var(--text-primary);">{stats.tpa > 0 ? ((stats.tpm / stats.tpa) * 100).toFixed(1) : '0.0'}%</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">{stats.tpm}/{stats.tpa}</div>
                </div>
                <div>
                  <div class="stat-mini-lbl">FT%</div>
                  <div style="font-weight: 700; color: var(--text-primary);">{stats.fta > 0 ? ((stats.ftm / stats.fta) * 100).toFixed(1) : '0.0'}%</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">{stats.ftm}/{stats.fta}</div>
                </div>
              </div>
            </div>
          {:else}
            <div style="background-color: var(--bg-dark); padding: 16px; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 0.85rem; border: 1px solid var(--border-color);">
              No games played this season
            </div>
          {/if}
        </div>

        <!-- Section: Personality & Morale -->
        <div class="profile-section">
          <h4 style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px;">Personality & Dynamics</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; font-size: 0.8rem;">
            <div style="background-color: var(--bg-dark); padding: 8px; border-radius: 6px;">
              <div>Ego/USG Demand</div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--primary);">{selectedPlayer.personality.ego}</div>
            </div>
            <div style="background-color: var(--bg-dark); padding: 8px; border-radius: 6px;">
              <div>Greed focus</div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--accent);">{selectedPlayer.personality.greed}</div>
            </div>
            <div style="background-color: var(--bg-dark); padding: 8px; border-radius: 6px;">
              <div>Loyalty</div>
              <div style="font-weight: 700; font-size: 1rem; color: var(--secondary);">{selectedPlayer.personality.loyalty}</div>
            </div>
          </div>
        </div>

        <!-- Extension Negotiation Results -->
        {#if extensionSuccessMessage}
          <div class="alert-box success-alert">{extensionSuccessMessage}</div>
        {/if}
        {#if extensionErrorMessage}
          <div class="alert-box error-alert">{extensionErrorMessage}</div>
        {/if}

        <!-- Actions -->
        <div style="display: flex; gap: 10px; margin-top: auto; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <button class="btn btn-secondary" style="flex: 1;" onclick={() => startNegotiation(selectedPlayer!)}>
            🤝 Re-Sign Extension
          </button>
          <button class="btn btn-primary" style="background-color: var(--danger); color: white;" onclick={() => releasePlayer(selectedPlayer!)}>
            🗑️ Release Player
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Agent Negotiation Modal -->
  {#if negotiatingPlayer}
    <div class="modal-overlay">
      <div class="modal-content fade-in">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <div>
            <h3 style="font-size: 1.2rem; margin: 0; color: var(--primary);">Negotiation with Agent</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Client: {negotiatingPlayer.name} ({negotiatingPlayer.position})</span>
          </div>
          {#if negotiationStage !== 'accepted' && negotiationStage !== 'walked_away'}
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick={() => negotiatingPlayer = null}>Walk Away</button>
          {/if}
        </div>

        <!-- Agent profile card -->
        <div class="agent-profile">
          <div class="agent-avatar">💼</div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">{agentName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{agencyName}</div>
            <div style="display: flex; gap: 8px; font-size: 0.75rem; margin-top: 2px;">
              <span class="badge badge-secondary">Agent: {negotiatingPlayer.contract.agentType || 'reasonable'}</span>
              <span class="badge badge-primary">Mood: {agentMood === 'happy' ? '😊 Happy' : (agentMood === 'neutral' ? '😐 Neutral' : (agentMood === 'annoyed' ? '😒 Annoyed' : '😡 Furious'))}</span>
            </div>
          </div>
        </div>

        <!-- Dialogue Bubble -->
        <div class="agent-speech-bubble">
          {agentText}
        </div>

        <!-- Offer form / controls -->
        {#if negotiationStage === 'intro' || negotiationStage === 'offering'}
          <div class="negotiation-controls">
            <!-- Salary offer slider -->
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
                max={60000000} 
                step={50000}
                bind:value={currentOffer} 
              />
              <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: -2px;">
                <span>Min: {formatNumber(CBA_CONSTANTS.MINIMUM_SALARY)}</span>
                <span>Max: $60.0M</span>
              </div>
            </div>

            <!-- Years selector -->
            <div class="control-row">
              <label for="years-select">Contract Length:</label>
              <select id="years-select" class="tactics-select" bind:value={currentYears} style="padding: 6px 12px; font-size: 0.85rem; width: 100%;">
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={4}>4 Years</option>
              </select>
            </div>

            <!-- CBA helper facts -->
            <div style="background-color: var(--bg-dark); padding: 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--border-color);">
              <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase;">Team Finances & CBA Context</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div>• Current Cap Space: <span style="font-weight: 700; color: {capSpace >= 0 ? 'var(--primary)' : 'var(--danger)'}">{formatNumber(capSpace)}</span></div>
                <div>• Player Bird Rights: <span style="font-weight: 700; color: var(--secondary);">{negotiatingPlayer.contract.birdRights.toUpperCase()}</span></div>
                <div>• Limit details: Re-signing a player with <b>Full Bird Rights</b> allows exceeding the salary cap. Otherwise, must fit into cap space or MLE exceptions.</div>
              </div>
            </div>

            <!-- Action buttons -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="rounds-badge" class:safe={negotiationRounds > 1}>
                  ⚠️ {negotiationRounds} tries left
                </span>
              </div>
              <button class="btn btn-primary" onclick={submitOffer} style="padding: 8px 24px;">Submit Offer</button>
            </div>
          </div>
        {:else if negotiationStage === 'accepted'}
          <div style="display: flex; flex-direction: column; gap: 14px; text-align: center;">
            <div style="font-size: 1.1rem; color: var(--primary); font-weight: 700;">Negotiations Successful!</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Both parties have agreed to the contract details. Click below to sign the contract extension.</p>
            <button class="btn btn-primary" onclick={applyNegotiatedContract} style="padding: 10px; font-size: 0.9rem; font-weight: 700; margin-top: 10px;">✍️ Sign Extension Contract</button>
          </div>
        {:else}
          <!-- Stalled / walked away -->
          <div style="display: flex; flex-direction: column; gap: 14px; text-align: center;">
            <div style="font-size: 1.1rem; color: var(--danger); font-weight: 700;">Negotiations Stalled</div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">The agent has walked away from the bargaining table. Negotiations are closed for this round.</p>
            <button class="btn btn-secondary" onclick={() => { negotiatingPlayer = null; onRosterChanged?.(); }} style="padding: 10px; font-size: 0.9rem; font-weight: 700; margin-top: 10px;">Close Table</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .roster-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .roster-row:hover {
    background-color: rgba(255, 255, 255, 0.03) !important;
  }

  .roster-row.active {
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

  .warning-alert {
    background-color: rgba(239, 68, 68, 0.08);
    border-left: 4px solid var(--danger);
    color: var(--danger);
    font-size: 0.85rem;
    padding: 12px;
    border-radius: 0 6px 6px 0;
    margin-top: 16px;
  }

  /* Player Profile specific layouts */
  .meter-lbl {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .meter-lbl span {
    font-weight: 800;
    color: var(--primary);
  }

  .meter-container {
    height: 8px;
    background-color: var(--bg-dark);
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    border: 1px solid var(--border-color);
  }

  .meter-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    border-radius: 4px;
  }

  .alert-box {
    font-size: 0.85rem;
    padding: 10px;
    border-radius: 6px;
    margin-top: 8px;
  }

  .success-alert {
    background-color: rgba(16, 185, 129, 0.12);
    color: var(--primary);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .error-alert {
    background-color: rgba(239, 68, 68, 0.12);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.25);
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

  /* Trait Badges styling */
  .trait-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: help;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .trait-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  /* Season stats boxes styling */
  .stat-mini-box {
    background-color: rgba(255, 255, 255, 0.02);
    padding: 8px 4px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }
  .stat-mini-lbl {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 700;
    margin-bottom: 2px;
  }
  .stat-mini-val {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--primary);
  }
</style>
