<script lang="ts">
  import { badgeById } from "../sim/badges";
  import { seasonLine } from "../sim/seasonStats";
  import type { Team, Player, Position } from "../sim/types";

  let { allTeams }: { allTeams: Team[] } = $props();

  // Selected Team ID state (defaults to the first opposing team, team_2, or team_1)
  let selectedTeamId = $state(allTeams[0]?.id || "");
  let teamConference = $state<'ALL' | 'East' | 'West'>('ALL');
  let teamDivision = $state('ALL');
  let rosterPos = $state('ALL');
  let rosterSort = $state<'overall' | 'age' | 'salary' | 'name'>('overall');

  let listedTeams = $derived(allTeams.filter(team =>
    (teamConference === 'ALL' || team.conference === teamConference) &&
    (teamDivision === 'ALL' || team.division === teamDivision)
  ));
  let divisionOptions = $derived([...new Set(
    allTeams
      .filter(team => teamConference === 'ALL' || team.conference === teamConference)
      .map(team => team.division)
  )]);
  let selectedTeam = $derived(
    allTeams.find((t) => t.id === selectedTeamId) || listedTeams[0] || allTeams[0],
  );

  // Selected Player Profile Modal inside Directory
  let selectedPlayer = $state<Player | null>(null);

  const OFFENSE_LABEL: Record<string, string> = {
    "pace-and-space": "Pace and space",
    "pick-and-roll": "Pick-and-roll",
    motion: "Motion",
    "post-up": "Post-up",
    isolation: "Isolation",
  };

  const formatNumber = (num: number) => {
    return "$" + Math.round(num).toLocaleString();
  };

  const getPositionLabel = (pos: Position) => {
    const labels: Record<Position, string> = {
      PG: "Point Guard",
      SG: "Shooting Guard",
      SF: "Small Forward",
      PF: "Power Forward",
      C: "Center",
    };
    return labels[pos] || pos;
  };

  // Find Team Leaders
  interface LeaderInfo {
    player: Player;
    value: number;
  }

  const getTeamLeaders = (team: Team) => {
    const leaders: Record<'pts' | 'ast' | 'reb' | 'stl' | 'blk', LeaderInfo | null> = {
      pts: null,
      ast: null,
      reb: null,
      stl: null,
      blk: null
    };

    for (const player of team.roster) {
      const stats = player.careerStats["season"];
      const gp = stats?.games || 0;
      if (gp <= 0 || !stats) continue;
      const next = {
        pts: stats.points / gp,
        ast: stats.assists / gp,
        reb: stats.rebounds / gp,
        stl: stats.steals / gp,
        blk: stats.blocks / gp
      };
      for (const key of ['pts', 'ast', 'reb', 'stl', 'blk'] as const) {
        if (!leaders[key] || next[key] > leaders[key].value) {
          leaders[key] = { player, value: next[key] };
        }
      }
    }

    return leaders;
  };

  let leaders = $derived(selectedTeam ? getTeamLeaders(selectedTeam) : {
    pts: null,
    ast: null,
    reb: null,
    stl: null,
    blk: null
  });

  // Sort roster of selected team by overall
  let sortedRoster = $derived.by(() => {
    if (!selectedTeam) return [];
    const posOrder: Record<string, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
    return [...selectedTeam.roster]
      .filter(player => rosterPos === 'ALL' || player.position === rosterPos)
      .sort((a, b) => {
        if (rosterSort === 'name') return a.name.localeCompare(b.name);
        if (rosterSort === 'age') return a.age - b.age;
        if (rosterSort === 'salary') return (b.contract.salaries[0] ?? 0) - (a.contract.salaries[0] ?? 0);
        return b.overallRating - a.overallRating || posOrder[a.position] - posOrder[b.position];
      });
  });
</script>

<div class="team-directory-container fade-in">
  <!-- Team Selector Card -->
  <div
    class="card selector-card"
    style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px;"
  >
    <div style="display: flex; align-items: center; gap: 16px;">
      <span style="font-size: 1.5rem;">🏢</span>
      <div>
        <h2 style="font-size: 1.25rem; margin: 0;">Teams</h2>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
          Rosters, leaders, and schemes.
        </p>
      </div>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
      <select class="tactics-select" bind:value={teamConference} style="padding: 10px;">
        <option value="ALL">Both conferences</option>
        <option value="East">East</option>
        <option value="West">West</option>
      </select>
      <select class="tactics-select" bind:value={teamDivision} style="padding: 10px;">
        <option value="ALL">All divisions</option>
        {#each divisionOptions as division}
          <option value={division}>{division}</option>
        {/each}
      </select>
      <select
        id="team-selector"
        class="tactics-select"
        bind:value={selectedTeamId}
        style="padding: 10px; min-width: 220px;"
      >
        {#each listedTeams as t}
          <option value={t.id}
            >{t.city} {t.name} {t.id === allTeams[0].id ? "(USER)" : ""}</option
          >
        {/each}
      </select>
    </div>
  </div>

  {#if selectedTeam}
    <!-- Team Info Banner -->
    <div
      class="card team-banner-card"
      style="margin-bottom: 24px; border-left: 4px solid {selectedTeam.id ===
      'team_1'
        ? '#008348'
        : '#3b82f6'};"
    >
      <div
        style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;"
      >
        <div>
          <h2
            style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);"
          >
            {selectedTeam.city}
            {selectedTeam.name}
          </h2>
          <div
            style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px; display: flex; gap: 16px;"
          >
            <span
              >Record: <b>{selectedTeam.wins} - {selectedTeam.losses}</b></span
            >
            <span
              >Point Differential: <b
                style="color: {selectedTeam.pointDiff >= 0
                  ? 'var(--primary)'
                  : 'var(--danger)'}"
                >{selectedTeam.pointDiff >= 0
                  ? "+"
                  : ""}{selectedTeam.pointDiff}</b
              ></span
            >
          </div>
        </div>

        <div style="display: flex; gap: 24px;">
          <div class="banner-stat">
            <span class="banner-stat-lbl">Active Salaries</span>
            <span class="banner-stat-val"
              >{formatNumber(selectedTeam.finances?.salariesTotal || 0)}</span
            >
          </div>
          <div class="banner-stat">
            <span class="banner-stat-lbl">Offense</span>
            <span
              class="banner-stat-val"
              style="color: var(--secondary);"
              >{OFFENSE_LABEL[selectedTeam.tactics?.offensiveStyle] ||
                "Balanced"}</span
            >
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Roster Spreadsheet -->
      <div
        class="card"
        style="grid-column: span {selectedPlayer
          ? '8'
          : '9'}; transition: all 0.3s ease;"
      >
        <h3 class="card-title">
          Roster <span class="badge badge-secondary"
            >{sortedRoster.length} Players</span
          >
        </h3>
        <div class="list-tools">
          <select class="tactics-select" bind:value={rosterPos}>
            <option value="ALL">All positions</option>
            <option value="PG">PG</option>
            <option value="SG">SG</option>
            <option value="SF">SF</option>
            <option value="PF">PF</option>
            <option value="C">C</option>
          </select>
          <select class="tactics-select" bind:value={rosterSort}>
            <option value="overall">Sort: overall</option>
            <option value="age">Sort: age</option>
            <option value="salary">Sort: salary</option>
            <option value="name">Sort: name</option>
          </select>
        </div>

        <div class="table-container">
          <table class="sim-table">
            <thead>
              <tr>
                <th>Player Name</th>
                <th style="text-align: center;">Pos</th>
                <th style="text-align: center;">Age</th>
                <th style="text-align: center;">OVR</th>
                <th>Current Salary</th>
                <th>Contract Length</th>
              </tr>
            </thead>
            <tbody>
              {#each sortedRoster as player}
                <tr
                  class="player-row-directory"
                  class:active-profile={selectedPlayer?.id === player.id}
                >
                  <td>
                    <button
                      type="button"
                      style="background: none; border: none; color: inherit; text-align: left; cursor: pointer; font-weight: 700; width: 100%;"
                      onclick={() => (selectedPlayer = player)}
                    >
                      {player.name}
                      {#if player.injury}
                        <span
                          class="badge badge-danger"
                          style="font-size: 0.65rem; margin-left: 6px; padding: 1px 4px;"
                          >INJ</span
                        >
                      {/if}
                    </button>
                  </td>
                  <td style="text-align: center;"
                    ><span class="badge badge-secondary">{player.position}</span
                    ></td
                  >
                  <td style="text-align: center;">{player.age}</td>
                  <td
                    style="text-align: center; font-weight: 800; color: var(--primary);"
                    >{player.overallRating}</td
                  >
                  <td style="font-family: monospace;"
                    >{player.contract.salaries[0]
                      ? formatNumber(player.contract.salaries[0])
                      : "Minimum"}</td
                  >
                  <td style="color: var(--text-secondary);"
                    >{player.contract.salaries.length} Yr(s) left</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column Panels (Leaders & Tactics) -->
      {#if !selectedPlayer}
        <div
          style="grid-column: span 3; display: flex; flex-direction: column; gap: 24px;"
        >
          <!-- Category Leaders Card -->
          <div class="card">
            <h3
              style="color: var(--primary); font-size: 1.1rem; margin-bottom: 16px;"
            >
              Team Leaders
            </h3>

            <div style="display: flex; flex-direction: column; gap: 14px;">
              <!-- PTS -->
              <div class="leader-entry">
                <span class="leader-category">PTS</span>
                {#if leaders.pts}
                  <div class="leader-details">
                    <span class="leader-name">{leaders.pts.player.name}</span>
                    <span class="leader-val"
                      >{leaders.pts.value.toFixed(1)} PPG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No games yet</span>
                {/if}
              </div>

              <!-- REB -->
              <div class="leader-entry">
                <span
                  class="leader-category"
                  style="background: var(--secondary-glow); color: var(--secondary);"
                  >REB</span
                >
                {#if leaders.reb}
                  <div class="leader-details">
                    <span class="leader-name">{leaders.reb.player.name}</span>
                    <span class="leader-val"
                      >{leaders.reb.value.toFixed(1)} RPG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No games yet</span>
                {/if}
              </div>

              <!-- AST -->
              <div class="leader-entry">
                <span
                  class="leader-category"
                  style="background: rgba(168, 85, 247, 0.15); color: #c084fc;"
                  >AST</span
                >
                {#if leaders.ast}
                  <div class="leader-details">
                    <span class="leader-name">{leaders.ast.player.name}</span>
                    <span class="leader-val"
                      >{leaders.ast.value.toFixed(1)} APG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No games yet</span>
                {/if}
              </div>

              <!-- STL -->
              <div class="leader-entry">
                <span
                  class="leader-category"
                  style="background: rgba(245, 158, 11, 0.15); color: var(--accent);"
                  >STL</span
                >
                {#if leaders.stl}
                  <div class="leader-details">
                    <span class="leader-name">{leaders.stl.player.name}</span>
                    <span class="leader-val"
                      >{leaders.stl.value.toFixed(1)} SPG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No games yet</span>
                {/if}
              </div>

              <!-- BLK -->
              <div class="leader-entry">
                <span
                  class="leader-category"
                  style="background: rgba(239, 68, 68, 0.15); color: var(--danger);"
                  >BLK</span
                >
                {#if leaders.blk}
                  <div class="leader-details">
                    <span class="leader-name">{leaders.blk.player.name}</span>
                    <span class="leader-val"
                      >{leaders.blk.value.toFixed(1)} BPG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No games yet</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Tactical Profile Card -->
          <div class="card">
            <h3
              style="color: var(--primary); font-size: 1.1rem; margin-bottom: 16px;"
            >
              Scheme
            </h3>

            <div
              style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;"
            >
              <div class="tactic-spec">
                <span class="tactic-label">Offense</span>
                <span class="tactic-val">{OFFENSE_LABEL[selectedTeam.tactics?.offensiveStyle] || 'Balanced'}</span>
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Pace</span>
                <span class="tactic-val">{selectedTeam.tactics?.tempo === 'fast' ? 'Push' : selectedTeam.tactics?.tempo === 'slow' ? 'Slow' : 'Balanced'}</span>
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Coverage</span>
                <span class="tactic-val">{selectedTeam.tactics?.defensiveCoverage === 'blitz' ? 'Blitz' : selectedTeam.tactics?.defensiveCoverage === 'switch-everything' ? 'Switch' : selectedTeam.tactics?.defensiveCoverage === 'zone-23' ? '2-3 zone' : selectedTeam.tactics?.defensiveCoverage === 'zone-32' ? '3-2 zone' : 'Drop'}</span>
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Double team</span>
                <span class="tactic-val">{selectedTeam.tactics?.doubleTeamTrigger === 'always' ? 'Every touch' : selectedTeam.tactics?.doubleTeamTrigger === 'never' ? 'Stay home' : 'Late clock'}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Detailed Player Profile inside Directory (if selected) -->
      {#if selectedPlayer}
        <div
          class="card fade-in"
          style="grid-column: span 4; display: flex; flex-direction: column; height: fit-content;"
        >
          <div
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"
          >
            <h3 style="color: var(--primary);">Player Profile</h3>
            <button
              type="button"
              class="btn-close"
              style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;"
              onclick={() => (selectedPlayer = null)}>×</button
            >
          </div>

          <div
            style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;"
          >
            <div
              style="width: 48px; height: 48px; border-radius: 50%; background: var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; border: 2px solid var(--primary);"
            >
              {selectedPlayer.name[0]}
            </div>
            <div>
              <div style="font-weight: 800; font-size: 1.05rem;">
                {selectedPlayer.name}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">
                {getPositionLabel(selectedPlayer.position)} • Age {selectedPlayer.age}
              </div>
            </div>
          </div>

          <div
            style="display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px; font-size: 0.85rem;"
          >
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Overall Rating:</span>
              <span style="font-weight: 800; color: var(--primary);"
                >{selectedPlayer.overallRating} OVR</span
              >
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Salary demand tier:</span>
              <span style="font-weight: 600; text-transform: capitalize;"
                >{selectedPlayer.contract.agentType}</span
              >
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Salary:</span>
              <span
                style="font-weight: 700; color: var(--text-primary); font-family: monospace;"
              >
                {selectedPlayer.contract.salaries[0]
                  ? formatNumber(selectedPlayer.contract.salaries[0])
                  : "Minimum"}
              </span>
            </div>
          </div>

          <div
            style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;"
          >
            <div
              style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase;"
            >
              Technical Attributes
            </div>
            <div
              style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 0.75rem;"
            >
              <div>
                Close Shot: <b
                  >{selectedPlayer.attributes.technical.closeShot}</b
                >
              </div>
              <div>
                Mid-Range: <b>{selectedPlayer.attributes.technical.midRange}</b>
              </div>
              <div>
                3-Point Shot: <b
                  >{selectedPlayer.attributes.technical.threePoint}</b
                >
              </div>
              <div>
                Finishing: <b>{selectedPlayer.attributes.technical.finishing}</b
                >
              </div>
              <div>
                Handling: <b
                  >{selectedPlayer.attributes.technical.ballHandling}</b
                >
              </div>
              <div>
                Passing Accuracy: <b
                  >{selectedPlayer.attributes.technical.passingAccuracy}</b
                >
              </div>
              <div>
                Def. Contest: <b
                  >{selectedPlayer.attributes.technical.perimeterDefense}</b
                >
              </div>
              <div>
                Interior Def.: <b
                  >{selectedPlayer.attributes.technical.interiorDefense}</b
                >
              </div>
              <div>
                Rebounding: <b
                  >{selectedPlayer.attributes.technical.defRebound}</b
                >
              </div>
              <div>
                Blocking: <b>{selectedPlayer.attributes.technical.block}</b>
              </div>
            </div>
          </div>

          {#if selectedPlayer.traits.length > 0}
            <div style="margin-bottom: 20px;">
              <div
                style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;"
              >
                Badges
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                {#each selectedPlayer.traits as trait}
                  {@const badge = badgeById(trait)}
                  {#if badge}
                    <span class="badge badge-primary" style="font-size: 0.7rem;" title={badge.effect}>{badge.name}</span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- Season Averages if available -->
          {#if selectedPlayer.careerStats["season"]}
            {@const line = seasonLine(selectedPlayer.careerStats["season"])}
            <div
              style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);"
            >
              <div
                style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;"
              >
                Season ({line.gp} GP)
              </div>
              {#if line.gp > 0}
                <div
                  style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.75rem; text-align: center;"
                >
                  <div class="stat-mini-box"><div class="stat-mini-lbl">MIN</div><div class="stat-mini-val">{line.min.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">PTS</div><div class="stat-mini-val">{line.pts.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">REB</div><div class="stat-mini-val">{line.reb.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">AST</div><div class="stat-mini-val">{line.ast.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">STL</div><div class="stat-mini-val">{line.stl.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">BLK</div><div class="stat-mini-val">{line.blk.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">TOV</div><div class="stat-mini-val">{line.tov.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">+/-</div><div class="stat-mini-val">{line.plusMinus > 0 ? '+' : ''}{line.plusMinus.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">FG%</div><div class="stat-mini-val">{line.fgPct.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">3P%</div><div class="stat-mini-val">{line.tpPct.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">FT%</div><div class="stat-mini-val">{line.ftPct.toFixed(1)}</div></div>
                  <div class="stat-mini-box"><div class="stat-mini-lbl">eFG%</div><div class="stat-mini-val">{line.efgPct.toFixed(1)}</div></div>
                </div>
              {:else}
                <div
                  style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 4px;"
                >
                  No games yet.
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .selector-card {
    background: linear-gradient(
      135deg,
      rgba(30, 41, 59, 0.9),
      rgba(15, 23, 42, 0.9)
    );
  }

  .team-banner-card {
    background: linear-gradient(
      90deg,
      rgba(30, 41, 59, 0.75) 0%,
      rgba(15, 23, 42, 0.75) 100%
    );
  }

  .banner-stat {
    display: flex;
    flex-direction: column;
    text-align: right;
  }

  .banner-stat-lbl {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 700;
  }

  .banner-stat-val {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .player-row-directory {
    transition: background-color 0.2s;
  }

  .player-row-directory:hover {
    background-color: rgba(255, 255, 255, 0.03) !important;
  }

  .player-row-directory.active-profile {
    background-color: var(--primary-glow) !important;
    border-left: 3px solid var(--primary);
  }

  .leader-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.25);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .leader-category {
    background: var(--primary-glow);
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 800;
    width: 38px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .leader-details {
    flex-grow: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .leader-name {
    font-weight: 700;
    color: var(--text-primary);
  }

  .leader-val {
    font-weight: 800;
    color: var(--primary);
    font-family: var(--font-display);
  }

  .no-stats {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .tactic-spec {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .tactic-spec:last-child {
    border-bottom: none;
  }

  .tactic-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .tactic-val {
    font-weight: 700;
    color: var(--text-primary);
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
