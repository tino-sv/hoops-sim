<script lang="ts">
  import type { Team, Player, Position } from "../sim/types";

  let { allTeams }: { allTeams: Team[] } = $props();

  // Selected Team ID state (defaults to the first opposing team, team_2, or team_1)
  let selectedTeamId = $state(allTeams[0]?.id || "");
  let selectedTeam = $derived(
    allTeams.find((t) => t.id === selectedTeamId) || allTeams[0],
  );

  // Selected Player Profile Modal inside Directory
  let selectedPlayer = $state<Player | null>(null);

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
    let ptsLeader: LeaderInfo | null = null;
    let astLeader: LeaderInfo | null = null;
    let rebLeader: LeaderInfo | null = null;
    let stlLeader: LeaderInfo | null = null;
    let blkLeader: LeaderInfo | null = null;

    team.roster.forEach((p) => {
      const stats = p.careerStats["season"];
      const gp = stats?.games || 0;
      if (gp > 0) {
        const pts = stats.points / gp;
        const ast = stats.assists / gp;
        const reb = stats.rebounds / gp;
        const stl = stats.steals / gp;
        const blk = stats.blocks / gp;

        if (!ptsLeader || pts > ptsLeader.value)
          ptsLeader = { player: p, value: pts };
        if (!astLeader || ast > astLeader.value)
          astLeader = { player: p, value: ast };
        if (!rebLeader || reb > rebLeader.value)
          rebLeader = { player: p, value: reb };
        if (!stlLeader || stl > stlLeader.value)
          stlLeader = { player: p, value: stl };
        if (!blkLeader || blk > blkLeader.value)
          blkLeader = { player: p, value: blk };
      }
    });

    return {
      pts: ptsLeader,
      ast: astLeader,
      reb: rebLeader,
      stl: stlLeader,
      blk: blkLeader,
    };
  };

  let leaders = $derived(selectedTeam ? getTeamLeaders(selectedTeam) : {
    pts: null,
    ast: null,
    reb: null,
    stl: null,
    blk: null
  });

  // Sort roster of selected team by overall
  let sortedRoster = $derived(selectedTeam ? [...selectedTeam.roster].sort((a, b) => b.overallRating - a.overallRating) : []);
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
        <h2 style="font-size: 1.25rem; margin: 0;">League Team Directory</h2>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
          Inspect rosters, team leaders, and coaching tactics for all league
          franchises.
        </p>
      </div>
    </div>
    <div class="setting-group" style="width: 250px; margin: 0;">
      <select
        id="team-selector"
        class="tactics-select"
        bind:value={selectedTeamId}
        style="padding: 10px; width: 100%;"
      >
        {#each allTeams as t}
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
            <span class="banner-stat-lbl">Tactical Style</span>
            <span
              class="banner-stat-val"
              style="text-transform: capitalize; color: var(--secondary);"
              >{selectedTeam.tactics?.offensiveStyle.replace("-", " ") ||
                "None"}</span
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
          Roster Roster <span class="badge badge-secondary"
            >{sortedRoster.length} Players</span
          >
        </h3>

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
                    <span class="leader-name">{leaders.pts.Player.name}</span>
                    <span class="leader-val"
                      >{leaders.pts.value.toFixed(1)} PPG</span
                    >
                  </div>
                {:else}
                  <span class="no-stats">No stats recorded</span>
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
                  <span class="no-stats">No stats recorded</span>
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
                  <span class="no-stats">No stats recorded</span>
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
                  <span class="no-stats">No stats recorded</span>
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
                  <span class="no-stats">No stats recorded</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Tactical Profile Card -->
          <div class="card">
            <h3
              style="color: var(--primary); font-size: 1.1rem; margin-bottom: 16px;"
            >
              Tactical Settings
            </h3>

            <div
              style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;"
            >
              <div class="tactic-spec">
                <span class="tactic-label">Offensive Style:</span>
                <span class="tactic-val"
                  >{selectedTeam.tactics?.offensiveStyle
                    .replace("-", " ")
                    .toUpperCase() || "BALANCED"}</span
                >
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Tempo / Pace:</span>
                <span class="tactic-val"
                  >{selectedTeam.tactics?.tempo.toUpperCase() ||
                    "BALANCED"}</span
                >
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Defensive Coverage:</span>
                <span class="tactic-val"
                  >{selectedTeam.tactics?.defensiveCoverage
                    .replace("-", " ")
                    .toUpperCase() || "DROP"}</span
                >
              </div>
              <div class="tactic-spec">
                <span class="tactic-label">Double Team Trigger:</span>
                <span class="tactic-val"
                  >{selectedTeam.tactics?.doubleTeamTrigger
                    .replace("-", " ")
                    .toUpperCase() || "LATE CLOCK"}</span
                >
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
                Special Traits
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                {#each selectedPlayer.traits as trait}
                  <span class="badge badge-primary" style="font-size: 0.7rem;"
                    >⭐ {trait.replace("_", " ")}</span
                  >
                {/each}
              </div>
            </div>
          {/if}

          <!-- Season Averages if available -->
          {#if selectedPlayer.careerStats["season"]}
            {@const stats = selectedPlayer.careerStats["season"]}
            {@const gp = stats.games || 0}
            <div
              style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);"
            >
              <div
                style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;"
              >
                Season Stats ({gp} GP)
              </div>
              {#if gp > 0}
                <div
                  style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.75rem; text-align: center;"
                >
                  <div class="stat-mini-box">
                    <div class="stat-mini-lbl">PTS</div>
                    <div class="stat-mini-val">
                      {(stats.points / gp).toFixed(1)}
                    </div>
                  </div>
                  <div class="stat-mini-box">
                    <div class="stat-mini-lbl">REB</div>
                    <div class="stat-mini-val">
                      {(stats.rebounds / gp).toFixed(1)}
                    </div>
                  </div>
                  <div class="stat-mini-box">
                    <div class="stat-mini-lbl">AST</div>
                    <div class="stat-mini-val">
                      {(stats.assists / gp).toFixed(1)}
                    </div>
                  </div>
                  <div class="stat-mini-box">
                    <div class="stat-mini-lbl">MIN</div>
                    <div class="stat-mini-val">
                      {(stats.minutes / gp).toFixed(1)}
                    </div>
                  </div>
                </div>
              {:else}
                <div
                  style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 4px;"
                >
                  No statistics accumulated yet.
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
