import type { Player, Team, Position, BoxScoreStats, TeamTactics, DefensiveCoverage, OffensiveStyle, OffensiveRole } from './types';

export interface PossessionResult {
  points: number;
  shooterId: string | null;
  passerId: string | null;
  rebounderId: string | null;
  turnoverPlayerId: string | null;
  foulPlayerId: string | null;
  foulOnPlayerId: string | null;
  isShootingFoul: boolean;
  freeThrowsAwarded: number;
  stealedById: string | null;
  blockedById: string | null;
  wasFastBreak: boolean;
  logs: string[];
  secondsElapsed: number;
}

export class PossessionEngine {
  // Helper to adjust attribute based on fatigue
  private getAttr(player: Player, category: 'technical' | 'physical' | 'mental', attrName: string): number {
    // Attributes are objects. Let's extract the base value
    const attrs = player.attributes[category] as unknown as Record<string, number>;
    const base = attrs[attrName] || 50;
    // Fatigue ranges from 0 to 100.
    // At fatigue 100, attributes decay by up to 25%
    const fatigueFactor = 1 - (player.fatigue / 400);
    return Math.max(1, Math.min(100, Math.round(base * fatigueFactor)));
  }

  // Calculate player game-score/overall value on the floor
  private getPlayerImpact(player: Player): number {
    const stamina = this.getAttr(player, 'physical', 'stamina');
    return Math.round(player.overallRating * (1 - (player.fatigue / 400)));
  }

  simulatePossession(
    offense: Team,
    defense: Team,
    onCourtOff: Player[],
    onCourtDef: Player[],
    isTransition: boolean
  ): PossessionResult {
    const logs: string[] = [];
    let points = 0;
    let shooterId: string | null = null;
    let passerId: string | null = null;
    let rebounderId: string | null = null;
    let turnoverPlayerId: string | null = null;
    let foulPlayerId: string | null = null;
    let foulOnPlayerId: string | null = null;
    let isShootingFoul = false;
    let freeThrowsAwarded = 0;
    let stealedById: string | null = null;
    let blockedById: string | null = null;
    let wasFastBreak = false;
    let secondsElapsed = 0;

    // 1. Identify key players for matchups
    // Ball handler defaults to PG/SG based on role/handling
    const pg = onCourtOff.find(p => p.position === 'PG') || onCourtOff[0];
    const sg = onCourtOff.find(p => p.position === 'SG') || onCourtOff[1];
    
    // Choose primary initiator based on tactics
    let ballHandler = pg;
    const assignedInitiator = onCourtOff.find(
      p => offense.tactics.offensiveRoles[p.id] === 'initiator'
    );
    if (assignedInitiator) {
      ballHandler = assignedInitiator;
    } else if (this.getAttr(sg, 'technical', 'ballHandling') > this.getAttr(pg, 'technical', 'ballHandling')) {
      ballHandler = sg;
    }

    // Matchup defender (same position or custom overplay target)
    let primaryDefender = onCourtDef.find(p => p.position === ballHandler.position) || onCourtDef[0];

    // Big men (Center / Power Forward)
    const center = onCourtDef.find(p => p.position === 'C') || onCourtDef[4] || onCourtDef[0];
    const powerForward = onCourtDef.find(p => p.position === 'PF') || onCourtDef[3] || onCourtDef[0];
    
    // The rim protector is usually the C, or PF if C is not on floor
    const rimProtector = center;

    // --- PHASE 1: TRANSITION CHECK ---
    if (isTransition) {
      const avgOffSpeed = onCourtOff.reduce((acc, p) => acc + this.getAttr(p, 'physical', 'speed'), 0) / 5;
      const avgDefSpeed = onCourtDef.reduce((acc, p) => acc + this.getAttr(p, 'physical', 'speed'), 0) / 5;
      
      const transitionRoll = Math.random() * 100;
      const transitionSuccessChance = 50 + (avgOffSpeed - avgDefSpeed);

      if (transitionRoll < transitionSuccessChance) {
        wasFastBreak = true;
        secondsElapsed = Math.round(3 + Math.random() * 3);
        logs.push(`⚡ Fast Break! ${offense.name} sprint down the court before ${defense.name} can set their defense.`);
        
        // Select runner (usually PG, SG, or SF)
        const transitionRunners = onCourtOff.filter(p => p.position === 'PG' || p.position === 'SG' || p.position === 'SF');
        const runner = transitionRunners[Math.floor(Math.random() * transitionRunners.length)] || ballHandler;
        
        // Fast break shot choice: layup/dunk or open 3-pointer
        const speed = this.getAttr(runner, 'physical', 'speed');
        const finishing = this.getAttr(runner, 'technical', 'finishing');
        const tpmAttr = this.getAttr(runner, 'technical', 'threePoint');
        
        if (Math.random() < 0.65) {
          // Attack the rim on break
          shooterId = runner.id;
          logs.push(`🏀 ${runner.name} drives hard to the rim in transition.`);
          const makeChance = finishing * 0.8 + speed * 0.1 + 15; // wide open fast break layout
          
          if (Math.random() * 100 < makeChance) {
            points = 2;
            logs.push(`🎯 SCORE: ${runner.name} converts the easy transition layup!`);
            // Chance of assist
            const passerCandidates = onCourtOff.filter(p => p.id !== runner.id);
            const passer = passerCandidates.reduce((best, curr) => 
              this.getAttr(curr, 'technical', 'passingAccuracy') > this.getAttr(best, 'technical', 'passingAccuracy') ? curr : best
            , passerCandidates[0]);
            if (passer && Math.random() < 0.75) {
              passerId = passer.id;
              logs.push(`🤝 Assisted by ${passer.name} with a pinpoint outlet pass.`);
            }
            return { points, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
          } else {
            logs.push(`❌ Miss! ${runner.name} misses the contested transition layup.`);
            // Go to rebound phase
            return this.resolveRebound(offense, defense, onCourtOff, onCourtDef, runner.id, false, logs, secondsElapsed);
          }
        } else {
          // Pull up for transition three
          shooterId = runner.id;
          logs.push(`🏀 ${runner.name} pulls up from the wing for a transition three!`);
          const makeChance = tpmAttr * 0.65 + 10;
          
          if (Math.random() * 100 < makeChance) {
            points = 3;
            logs.push(`🎯 SCORE: Splash! ${runner.name} drains the transition triple!`);
            const passerCandidates = onCourtOff.filter(p => p.id !== runner.id);
            const passer = passerCandidates[0];
            if (passer && Math.random() < 0.6) {
              passerId = passer.id;
              logs.push(`🤝 Assisted by ${passer.name}.`);
            }
            return { points, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
          } else {
            logs.push(`🧱 Miss! ${runner.name} clanks the transition three-pointer off the front rim.`);
            return this.resolveRebound(offense, defense, onCourtOff, onCourtDef, runner.id, true, logs, secondsElapsed);
          }
        }
      } else {
        logs.push(`🔒 ${defense.name} scrambles back and forces ${offense.name} into their half-court offense.`);
      }
    }

    // --- PHASE 2: HALF-COURT INITIATION ---
    secondsElapsed = Math.round(8 + Math.random() * 11);
    const style = offense.tactics.offensiveStyle;
    
    logs.push(`🏀 [Initiation] ${ballHandler.name} initiates the offense. Style: ${style.toUpperCase()}.`);

    // Check for defensive overplay target instructions
    const overplayType = defense.tactics.targetOverplay[ballHandler.id] || 'none';
    if (overplayType !== 'none') {
      logs.push(`🛡️ Def. Adjustment: ${primaryDefender.name} is overplaying ${ballHandler.name}'s ${overplayType === 'force-left' ? 'right side to force him Left' : 'left side to force him Right'}.`);
    }

    // Turnovers/Fouls during initiation phase
    const initTurnoverRoll = Math.random() * 100;
    const defenderStealSkill = this.getAttr(primaryDefender, 'technical', 'steal');
    const handlerSkill = this.getAttr(ballHandler, 'technical', 'ballHandling');
    const turnoverChance = 6.0 + (defenderStealSkill - handlerSkill) * 0.10;
    
    if (initTurnoverRoll < turnoverChance) {
      // Stripped clean or bad pass
      turnoverPlayerId = ballHandler.id;
      secondsElapsed = Math.round(4 + Math.random() * 5);
      if (Math.random() < 0.55) {
        stealedById = primaryDefender.id;
        logs.push(`💥 TURNOVER: ${primaryDefender.name} strips the ball clean from ${ballHandler.name}!`);
      } else {
        // Intercepted pass
        if (Math.random() < 0.8) {
          const interceptor = onCourtDef.filter(p => p.id !== primaryDefender.id)[Math.floor(Math.random() * 4)];
          stealedById = interceptor.id;
          logs.push(`💥 TURNOVER: ${ballHandler.name} throws a lazy pass, intercepted by ${interceptor.name}!`);
        } else {
          logs.push(`💥 TURNOVER: ${ballHandler.name} throws the ball out of bounds!`);
        }
      }
      return { points: 0, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
    }

    // Foul check in initiation
    const initFoulRoll = Math.random() * 100;
    if (initFoulRoll < 11) {
      foulPlayerId = primaryDefender.id;
      foulOnPlayerId = ballHandler.id;
      secondsElapsed = Math.round(3 + Math.random() * 4);
      logs.push(`🚨 FOUL: ${primaryDefender.name} reaches in and commits a defensive foul on ${ballHandler.name}.`);
      return { points: 0, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
    }

    // Determine Play Action Success (Creating Advantage)
    let advantage = false;
    let matchDescription = '';

    if (style === 'pick-and-roll') {
      const screener = onCourtOff.find(p => offense.tactics.offensiveRoles[p.id] === 'screen-setter') || 
                       onCourtOff.find(p => p.position === 'C' || p.position === 'PF') || 
                       onCourtOff[3];
      const screenerRoll = this.getAttr(screener, 'technical', 'screenSetting');
      const actionRoll = Math.random() * 100;
      const advantageChance = 50 + (handlerSkill * 0.4 + screenerRoll * 0.4) - (this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.5 + this.getAttr(rimProtector, 'technical', 'helpDefense') * 0.3);
      
      matchDescription = `📋 P&R Action: ${screener.name} comes up to set a screen for ${ballHandler.name}.`;
      if (actionRoll < advantageChance) {
        advantage = true;
        matchDescription += ` ${ballHandler.name} uses the screen and turns the corner, creating an advantage.`;
      } else {
        matchDescription += ` ${primaryDefender.name} slides around the screen and stays attached to ${ballHandler.name}.`;
      }
    } else if (style === 'post-up') {
      const postScorer = onCourtOff.find(p => p.position === 'C' || p.position === 'PF') || onCourtOff[4];
      const postDefender = onCourtDef.find(p => p.position === postScorer.position) || rimProtector;
      const postRoll = Math.random() * 100;
      const advantageChance = 45 + this.getAttr(postScorer, 'technical', 'closeShot') - this.getAttr(postDefender, 'technical', 'interiorDefense');
      
      matchDescription = `📋 Post-Up: ${ballHandler.name} feeds the entry pass down low to ${postScorer.name} in the post.`;
      // Check entry pass turnover
      if (Math.random() < 0.10) {
        turnoverPlayerId = ballHandler.id;
        secondsElapsed = Math.round(5 + Math.random() * 4);
        if (Math.random() < 0.55) {
          stealedById = postDefender.id;
          logs.push(`💥 TURNOVER: Entry pass is too high! ${postDefender.name} tips it and steals the ball.`);
        } else {
          logs.push(`💥 TURNOVER: Entry pass is too high! It sails out of bounds.`);
        }
        return { points: 0, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
      }
      
      if (postRoll < advantageChance) {
        advantage = true;
        ballHandler = postScorer; // post-scorer now controls the ball
        primaryDefender = postDefender;
        matchDescription += ` ${postScorer.name} backs down ${postDefender.name} and establishes strong position.`;
      } else {
        ballHandler = postScorer;
        primaryDefender = postDefender;
        matchDescription += ` ${postDefender.name} holds his ground, denying ${postScorer.name} a clean angle.`;
      }
    } else if (style === 'pace-and-space') {
      // Quick ball movement
      const passingAcc = this.getAttr(ballHandler, 'technical', 'passingAccuracy');
      const actionRoll = Math.random() * 100;
      const teamOffBall = onCourtOff.reduce((acc, p) => acc + this.getAttr(p, 'mental', 'iq') + this.getAttr(p, 'technical', 'offBall'), 0) / 5;
      const teamDefHelp = onCourtDef.reduce((acc, p) => acc + this.getAttr(p, 'technical', 'helpDefense'), 0) / 5;
      const advantageChance = 52 + (passingAcc * 0.2 + teamOffBall * 0.3) - (teamDefHelp * 0.4);
      
      matchDescription = `📋 Pace & Space: Ball swings around the perimeter. Players are cutting and spacing out.`;
      if (actionRoll < advantageChance) {
        advantage = true;
        // The ball swings to an open wing player
        const wingCandidates = onCourtOff.filter(p => p.id !== ballHandler.id);
        const newBallHandler = wingCandidates[Math.floor(Math.random() * wingCandidates.length)];
        passerId = ballHandler.id;
        ballHandler = newBallHandler;
        primaryDefender = onCourtDef.find(p => p.position === ballHandler.position) || onCourtDef[1];
        matchDescription += ` Fast swing pass to ${ballHandler.name} catches the defense rotating slowly.`;
      } else {
        matchDescription += ` The defensive rotation is crisp, forcing ${ballHandler.name} to reset.`;
      }
    } else {
      // Isolation
      const isoRoll = Math.random() * 100;
      const acc = this.getAttr(ballHandler, 'physical', 'acceleration');
      const defAgility = this.getAttr(primaryDefender, 'physical', 'agility');
      const advantageChance = 45 + (this.getAttr(ballHandler, 'technical', 'ballHandling') * 0.4 + acc * 0.4) - (this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.5 + defAgility * 0.3);
      
      matchDescription = `📋 Isolation: The floor clears out. ${ballHandler.name} works on ${primaryDefender.name} 1-on-1.`;
      if (isoRoll < advantageChance) {
        advantage = true;
        matchDescription += ` ${ballHandler.name} uses a quick crossover and blows past ${primaryDefender.name}.`;
      } else {
        matchDescription += ` ${primaryDefender.name} slides laterally and cuts off the drive.`;
      }
    }

    logs.push(matchDescription);

    // --- PHASE 3: DEFENSIVE SCHEME RESPONSE ---
    // If the offense has an advantage, evaluate defense's scheme coverage
    let coverage = defense.tactics.defensiveCoverage;
    let shootContestPenalty = 0;
    let selectedPlayResult: 'SHOT' | 'TURNOVER' | 'KICKOUT_SHOT' = 'SHOT';

    if (advantage) {
      logs.push(`🛡️ Defense Response: ${defense.name} reacts in ${coverage.toUpperCase()} coverage.`);
      
      if (coverage === 'drop') {
        // Drop protects rim, leaves mid-range open
        if (style === 'pick-and-roll' && this.getAttr(ballHandler, 'technical', 'midRange') > 65) {
          logs.push(`🔒 Drop: ${rimProtector.name} drops back to the paint. ${ballHandler.name} spots an open mid-range pull-up.`);
          shootContestPenalty = 10; // very light contest
          selectedPlayResult = 'SHOT';
        } else {
          // Drive inside, contested at rim
          logs.push(`🔒 Drop: ${rimProtector.name} is waiting at the rim. ${ballHandler.name} challenges him inside anyway.`);
          shootContestPenalty = this.getAttr(rimProtector, 'technical', 'interiorDefense') * 0.55 + this.getAttr(rimProtector, 'physical', 'vertical') * 0.15;
          selectedPlayResult = 'SHOT';
        }
      } else if (coverage === 'blitz') {
        // Double-team the handler, leaving roll man or weakside corner open
        const passVision = this.getAttr(ballHandler, 'technical', 'passingVision');
        const passRoll = Math.random() * 100;
        
        if (passRoll < passVision * 0.8) {
          // Successfully hits the open man (roll man or spot-up shooter)
          const rollMan = onCourtOff.find(p => p.position === 'C') || onCourtOff[4];
          const cornerShooter = onCourtOff.find(p => offense.tactics.offensiveRoles[p.id] === 'spot-up') || onCourtOff[1];
          const target = Math.random() < 0.5 ? rollMan : cornerShooter;
          
          passerId = ballHandler.id;
          ballHandler = target;
          shootContestPenalty = 5; // Wide open shot!
          selectedPlayResult = 'KICKOUT_SHOT';
          logs.push(`🎯 Blitz Punished: ${passerId ? onCourtOff.find(p=>p.id === passerId)?.name : 'Ball handler'} splits the double team and fires a pass to ${ballHandler.name} who is wide open.`);
        } else {
          // Blitz forced turnover
          turnoverPlayerId = ballHandler.id;
          secondsElapsed = Math.round(6 + Math.random() * 5);
          if (Math.random() < 0.5) {
            stealedById = primaryDefender.id;
            logs.push(`💥 Blitz Success: ${primaryDefender.name} and ${rimProtector.name} swarm ${ballHandler.name}, forcing a steal!`);
          } else {
            logs.push(`💥 Blitz Success: ${primaryDefender.name} and ${rimProtector.name} swarm ${ballHandler.name}, forcing a bad pass out of bounds!`);
          }
          return { points: 0, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
        }
      } else if (coverage === 'switch-everything') {
        // Switch everything prevents open looks, but creates mismatches
        // Check for mismatch (e.g. big defender on PG)
        const mismatchRatingDiff = this.getPlayerImpact(ballHandler) - this.getPlayerImpact(primaryDefender);
        logs.push(`🔒 Switch: The defense switches assignments. ${ballHandler.name} finds himself guarded by ${primaryDefender.name}.`);
        if (mismatchRatingDiff > 10) {
          logs.push(`🔥 Mismatch! ${ballHandler.name} exploits the matchup advantage.`);
          shootContestPenalty = this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.3; // weak contest
        } else {
          logs.push(`🔒 The switched defender keeps up, maintaining solid contest.`);
          shootContestPenalty = this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.7; // solid contest
        }
      } else {
        // Zone (2-3 / 3-2)
        if (coverage === 'zone-23') {
          // Weak against perimeter, strong against interior
          if (Math.random() < 0.6) {
            logs.push(`🏀 Zone 2-3: Offense passes around the zone, finding an open corner three-pointer.`);
            const shooter = onCourtOff.find(p => p.position === 'SG' || p.position === 'SF') || ballHandler;
            if (shooter.id !== ballHandler.id) passerId = ballHandler.id;
            ballHandler = shooter;
            shootContestPenalty = 15; // low contest on perimeter
            selectedPlayResult = 'KICKOUT_SHOT';
          } else {
            logs.push(`🏀 Zone 2-3: Ball handler attempts to drive, but the paint is clogged.`);
            shootContestPenalty = this.getAttr(rimProtector, 'technical', 'interiorDefense') * 0.8;
          }
        } else {
          // Zone 3-2: Strong perimeter, weak inside/post
          if (Math.random() < 0.5 && (style === 'post-up' || style === 'pick-and-roll')) {
            logs.push(`🏀 Zone 3-2: Offense exploits the paint, feeding it to the big man at the rim.`);
            const shooter = onCourtOff.find(p => p.position === 'C' || p.position === 'PF') || ballHandler;
            if (shooter.id !== ballHandler.id) passerId = ballHandler.id;
            ballHandler = shooter;
            shootContestPenalty = 15; // low contest inside
            selectedPlayResult = 'KICKOUT_SHOT';
          } else {
            logs.push(`🏀 Zone 3-2: Offense hoists a contested outside shot against the tight perimeter zone.`);
            shootContestPenalty = this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.85;
          }
        }
      }
    } else {
      // Neutral - forced play
      logs.push(`⏰ Late Clock: ${offense.name} is struggling to find a seam. The shot clock is winding down.`);
      const forceRoll = Math.random();
      
      if (forceRoll < 0.22) {
        // Forced Turnover
        turnoverPlayerId = ballHandler.id;
        secondsElapsed = Math.round(16 + Math.random() * 6);
        logs.push(`💥 TURNOVER: Under heavy pressure, ${ballHandler.name} loses control and throws the ball out of bounds.`);
        return { points: 0, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
      }
      
      // Forced Contested Shot
      shootContestPenalty = this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.9;
      logs.push(`⚠️ ${ballHandler.name} is forced to take a heavily contested shot as the buzzer sounds.`);
    }

    // --- PHASE 4: SHOT EXECUTION & RESOLUTION ---
    
    // Kickout/Extra Pass decision to distribute shots and avoid PG/SG over-usage
    const teamwork = this.getAttr(ballHandler, 'mental', 'teamwork');
    const ego = ballHandler.personality.ego || 50;
    
    // Tailor base pass chance by position to flatten player PPG curves
    let basePassChance = 0.45;
    if (ballHandler.position === 'PG') basePassChance = 0.58;
    else if (ballHandler.position === 'SG') basePassChance = 0.49;
    else if (ballHandler.position === 'SF') basePassChance = 0.46;
    else if (ballHandler.position === 'PF') basePassChance = 0.32;
    else if (ballHandler.position === 'C') basePassChance = 0.26;
    
    let passChance = basePassChance + (teamwork - ego) * 0.0025;
    passChance = Math.max(0.18, Math.min(0.75, passChance));
    
    if (Math.random() < passChance && onCourtOff.length > 1) {
      const candidates = onCourtOff.filter(p => p.id !== ballHandler.id);
      const receiver = candidates[Math.floor(Math.random() * candidates.length)];
      
      logs.push(`🏀 Extra Pass: ${ballHandler.name} swings the ball to ${receiver.name} on the perimeter.`);
      passerId = ballHandler.id;
      ballHandler = receiver;
      primaryDefender = onCourtDef.find(p => p.position === ballHandler.position) || onCourtDef[Math.floor(Math.random() * 5)];
      
      // Swings create slightly better looks (lower contest)
      shootContestPenalty = Math.max(0, shootContestPenalty - 10);
    }
    
    // 35% of passes are cleared from being assists to represent the shooter creating their own shot
    if (passerId && Math.random() < 0.35) {
      passerId = null;
    }
    
    shooterId = ballHandler.id;

    // Determine shot type: Rim (Close), Mid-range, or Three-point
    let shotType: 'close' | 'mid' | 'three' = 'mid';
    const closeAttr = this.getAttr(ballHandler, 'technical', 'closeShot');
    const midAttr = this.getAttr(ballHandler, 'technical', 'midRange');
    const threeAttr = this.getAttr(ballHandler, 'technical', 'threePoint');
    
    if (ballHandler.position === 'C' || ballHandler.position === 'PF') {
      shotType = Math.random() < 0.7 ? 'close' : (Math.random() < 0.8 ? 'mid' : 'three');
    } else {
      shotType = Math.random() < 0.45 ? 'three' : (Math.random() < 0.75 ? 'mid' : 'close');
    }

    // Check for shot blocks
    if (shotType === 'close' || shotType === 'mid') {
      const blockRoll = Math.random() * 100;
      const blockChance = 3.0 + (this.getAttr(rimProtector, 'technical', 'block') * 0.10 - this.getAttr(ballHandler, 'physical', 'vertical') * 0.03);
      if (blockRoll < blockChance && !advantage) {
        blockedById = rimProtector.id;
        logs.push(`🚫 BLOCKED! ${rimProtector.name} swats the shot from ${ballHandler.name} out of the air!`);
        return this.resolveRebound(offense, defense, onCourtOff, onCourtDef, ballHandler.id, false, logs, secondsElapsed, blockedById);
      }
    }

    // Check for Shooting Foul
    const foulRoll = Math.random() * 100;
    // Inside shots generate more fouls
    const baseFoulChance = shotType === 'close' ? 22 : (shotType === 'mid' ? 11 : 4);
    const drawFoulChance = baseFoulChance + (this.getAttr(ballHandler, 'mental', 'composure') * 0.08 - this.getAttr(primaryDefender, 'technical', 'perimeterDefense') * 0.05);
    
    if (foulRoll < drawFoulChance) {
      foulPlayerId = primaryDefender.id;
      foulOnPlayerId = ballHandler.id;
      isShootingFoul = true;
      freeThrowsAwarded = shotType === 'three' ? 3 : 2;
      logs.push(`🚨 FOUL: ${primaryDefender.name} hacks ${ballHandler.name} in the act of shooting. Free throws awarded!`);
      
      // Resolve Free Throws
      const ftAttr = this.getAttr(ballHandler, 'technical', 'freeThrow');
      let ftMade = 0;
      for (let i = 0; i < freeThrowsAwarded; i++) {
        if (Math.random() * 100 < ftAttr) {
          ftMade++;
        }
      }
      points = ftMade;
      logs.push(`📊 Free Throws: ${ballHandler.name} shoots ${freeThrowsAwarded} free throws. Makes ${ftMade}/${freeThrowsAwarded}.`);
      return { points, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed: secondsElapsed + 2 };
    }

    // Resolve Shot Percentage
    const shotRoll = Math.random() * 100;
    let baseMakeChance = 0;
    if (shotType === 'three') {
      baseMakeChance = threeAttr * 0.38; // Real-world scaling: e.g. 90 3PT -> ~34% base
      if (ballHandler.traits?.includes('sharpshooter')) {
        baseMakeChance += 6;
      }
    } else if (shotType === 'mid') {
      baseMakeChance = midAttr * 0.45;   // e.g. 80 MID -> ~36% base
    } else {
      baseMakeChance = closeAttr * 0.55; // e.g. 80 CLOSE -> ~44% base
      if (ballHandler.traits?.includes('post_beast')) {
        baseMakeChance += 6;
      }
    }

    // Apply Assist Bonus
    let assistBonus = 0;
    if (passerId) {
      const passer = onCourtOff.find(p => p.id === passerId);
      if (passer) {
        let pBonus = this.getAttr(passer, 'technical', 'passingAccuracy') * 0.08 + this.getAttr(passer, 'technical', 'passingVision') * 0.04;
        if (passer.traits?.includes('playmaker')) {
          pBonus += 6;
        }
        assistBonus = pBonus;
      }
    }

    // Net success rate = Base + AssistBonus - ContestPenalty
    // Make sure contest penalty doesn't exceed reasonable levels
    let contestPenalty = shootContestPenalty;
    if (primaryDefender && primaryDefender.traits?.includes('lockdown')) {
      contestPenalty += 10;
    }
    const finalContest = Math.max(0, contestPenalty);
    let successRate = Math.max(5, baseMakeChance + assistBonus - finalContest * 0.25);
    if (ballHandler.traits?.includes('clutch') && !advantage) {
      successRate += 6;
    }
    
    if (shotRoll < successRate) {
      // Made shot
      points = shotType === 'three' ? 3 : 2;
      logs.push(`🎯 SCORE: ${ballHandler.name} buries the ${shotType === 'three' ? 'three-pointer' : (shotType === 'mid' ? 'mid-range jumper' : 'inside layup')}!`);
      if (passerId) {
        const passer = onCourtOff.find(p => p.id === passerId);
        logs.push(`🤝 Assisted by ${passer?.name}.`);
      } else {
        passerId = null; // Clear if no formal assist
      }
      return { points, shooterId, passerId, rebounderId, turnoverPlayerId, foulPlayerId, foulOnPlayerId, isShootingFoul, freeThrowsAwarded, stealedById, blockedById, wasFastBreak, logs, secondsElapsed };
    } else {
      // Missed shot
      const shotTypeName = shotType === 'three' ? 'three-pointer' : (shotType === 'mid' ? 'mid-range jumper' : 'inside layup');
      logs.push(`❌ Miss: ${ballHandler.name}'s ${shotTypeName} is offline, bouncing off the rim.`);
      passerId = null; // No assist on a miss
      return this.resolveRebound(offense, defense, onCourtOff, onCourtDef, ballHandler.id, shotType === 'three', logs, secondsElapsed);
    }
  }

  // Handle rebounding splits
  private resolveRebound(
    offense: Team,
    defense: Team,
    onCourtOff: Player[],
    onCourtDef: Player[],
    shooterId: string,
    isThree: boolean,
    logs: string[],
    secondsElapsed: number,
    blockedById: string | null = null
  ): PossessionResult {
    // Rebounding battle: Offense vs Defense
    // Rebounding attributes, strength, and height/position weighting
    const calculateReboundStrength = (p: Player, isOff: boolean): number => {
      const rebAttr = isOff ? this.getAttr(p, 'technical', 'offRebound') : this.getAttr(p, 'technical', 'defRebound');
      const strength = this.getAttr(p, 'physical', 'strength');
      const vertical = this.getAttr(p, 'physical', 'vertical');
      
      // Position multipliers (C & PF have positional advantage)
      let posMult = 1.0;
      if (p.position === 'C') posMult = 1.4;
      else if (p.position === 'PF') posMult = 1.25;
      else if (p.position === 'SF') posMult = 1.1;
      
      let rStrength = (rebAttr * 0.6 + strength * 0.25 + vertical * 0.15) * posMult;
      if (p.traits?.includes('glass_cleaner')) {
        rStrength *= 1.15;
      }
      return rStrength;
    };

    // Calculate sum of strengths
    const offStrengths = onCourtOff.map(p => ({ player: p, score: calculateReboundStrength(p, true) }));
    const defStrengths = onCourtDef.map(p => ({ player: p, score: calculateReboundStrength(p, false) }));

    const totalOffStrength = offStrengths.reduce((acc, p) => acc + p.score, 0);
    // Defense has a baseline positioning advantage (about 70/30 split)
    const totalDefStrength = defStrengths.reduce((acc, p) => acc + p.score, 0) * 2.3;

    const totalStrength = totalOffStrength + totalDefStrength;
    const reboundRoll = Math.random() * totalStrength;

    let rebounderId: string | null = null;
    let points = 0;

    if (reboundRoll < totalOffStrength) {
      // Offensive rebound!
      // Select which offensive player got it
      let runningSum = 0;
      for (const off of offStrengths) {
        runningSum += off.score;
        if (reboundRoll <= runningSum) {
          rebounderId = off.player.id;
          break;
        }
      }
      if (!rebounderId) rebounderId = onCourtOff[0].id;
      
      const rebounder = onCourtOff.find(p => p.id === rebounderId);
      logs.push(`🏀 offensive Rebound! ${rebounder?.name} grabs the offensive board, extending the possession.`);
      
      // Immediate putback shot attempt!
      if (Math.random() < 0.5) {
        const closeAttr = this.getAttr(rebounder!, 'technical', 'closeShot');
        const makeChance = closeAttr * 0.5 + 5;
        logs.push(`🏀 Putback attempt: ${rebounder?.name} goes straight back up with it...`);
        if (Math.random() * 100 < makeChance) {
          points = 2;
          logs.push(`🎯 SCORE: ${rebounder?.name} scores the putback layup!`);
          return { points, shooterId, passerId: null, rebounderId, turnoverPlayerId: null, foulPlayerId: null, foulOnPlayerId: null, isShootingFoul: false, freeThrowsAwarded: 0, stealedById: null, blockedById, wasFastBreak: false, logs, secondsElapsed: secondsElapsed + 2 };
        } else {
          logs.push(`❌ Miss: The putback attempt slips off the rim.`);
          // Recursive call for second rebound, but capped to avoid infinite loops
          // We'll just award the defensive rebound to simplify
          const defRebounder = onCourtDef[Math.floor(Math.random() * 5)];
          logs.push(`🏀 Defensive Rebound: ${defRebounder.name} cleans up the second miss.`);
          return { points: 0, shooterId, passerId: null, rebounderId: defRebounder.id, turnoverPlayerId: null, foulPlayerId: null, foulOnPlayerId: null, isShootingFoul: false, freeThrowsAwarded: 0, stealedById: null, blockedById, wasFastBreak: false, logs, secondsElapsed: secondsElapsed + 4 };
        }
      } else {
        // Reset possession (kick back out)
        logs.push(`🏀 ${rebounder?.name} kicks the ball back out to reset the play.`);
        return { points: 0, shooterId, passerId: null, rebounderId, turnoverPlayerId: null, foulPlayerId: null, foulOnPlayerId: null, isShootingFoul: false, freeThrowsAwarded: 0, stealedById: null, blockedById, wasFastBreak: false, logs, secondsElapsed: secondsElapsed + 5 };
      }
    } else {
      // Defensive rebound
      const relativeDefRoll = reboundRoll - totalOffStrength;
      let runningSum = 0;
      for (const def of defStrengths) {
        runningSum += def.score * 2.3; // matching the multiplier
        if (relativeDefRoll <= runningSum) {
          rebounderId = def.player.id;
          break;
        }
      }
      if (!rebounderId) rebounderId = onCourtDef[0].id;
      
      const rebounder = onCourtDef.find(p => p.id === rebounderId);
      logs.push(`🔒 Defensive Rebound: ${rebounder?.name} leaps and secures the defensive board.`);
      return { points: 0, shooterId, passerId: null, rebounderId, turnoverPlayerId: null, foulPlayerId: null, foulOnPlayerId: null, isShootingFoul: false, freeThrowsAwarded: 0, stealedById: null, blockedById, wasFastBreak: false, logs, secondsElapsed };
    }
  }
}
export default PossessionEngine;
