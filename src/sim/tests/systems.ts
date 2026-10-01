import { crowdedShotPenalty, moraleAfterGame, roleMoraleDelta, settleTeamMorale } from '../badges'
import { CBASimulator } from '../cba'
import { careerChoices, LeagueManager } from '../league'
import { bookGameMoney, coachFoulMultiplier, coachShotAdjust, coachTurnoverBump, tvCheck } from '../office'
import { createPlayer } from '../players'
import { NBA_RULES } from '../rules'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function must<T>(value: T | undefined | null, message: string): T {
  if (value == null) throw new Error(message)
  return value
}

const league = new LeagueManager()
assert(league.teams.length === 30, '30 teams')
const elites = league.teams.flatMap(team => {
  const ordered = [...team.roster].sort((a, b) => b.overallRating - a.overallRating)
  if (ordered[0].overallRating < 96) return []
  assert(ordered[0].overallRating - ordered[1].overallRating >= 10, `${team.city} star is too close to the next player`)
  return [ordered[0]]
})
assert(elites.length === 6, `six players sit above the league, saw ${elites.length}`)
assert(league.teams.every(team => team.roster.length === NBA_RULES.ROSTER_MAX), 'every roster is 15')
assert(league.teams.filter(team => team.conference === 'East').length === 15, 'east')
assert(league.teams.filter(team => team.conference === 'West').length === 15, 'west')
for (const division of ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'] as const) {
  assert(league.teams.filter(team => team.division === division).length === 5, `${division} has five clubs`)
}
for (const team of league.teams) {
  const games = league.schedule.filter(match => match.homeTeamId === team.id || match.awayTeamId === team.id).length
  assert(games === NBA_RULES.SEASON_GAMES, `${team.city} plays ${games}`)
}

for (const team of league.teams) {
  const hit = CBASimulator.capHit(team)
  assert(hit > NBA_RULES.SALARY_CAP * 0.8 && hit < NBA_RULES.SECOND_APRON, `${team.city} payroll ${hit} is outside an NBA range`)
  assert(team.finances.exceptions.mle && team.finances.exceptions.biAnnual, 'exceptions start available')
}

const user = league.userTeam()
assert(CBASimulator.capHit(user) > NBA_RULES.SALARY_CAP, 'user team is over the cap, like most NBA teams')

const guard = createPlayer({ position: 'PG', targetOverall: 90, age: 27, years: 2 })
assert(guard.attributes.technical.block < 50, `star PG block should stay low, got ${guard.attributes.technical.block}`)
assert(guard.attributes.technical.ballHandling > 80, `star PG handle should be high, got ${guard.attributes.technical.ballHandling}`)
assert(Math.abs(guard.overallRating - 90) <= 2, `overall landed on ${guard.overallRating}`)

const center = createPlayer({ position: 'C', targetOverall: 88, age: 26, years: 3 })
assert(center.attributes.technical.threePoint < 55, `center three should stay low, got ${center.attributes.technical.threePoint}`)
assert(center.attributes.technical.defRebound > 75, 'center should rebound')

const banned = ['Curry', 'LeBron', 'Jokic', 'Doncic', 'Wembanyama', 'Antetokounmpo', 'Gilgeous-Alexander']
const names = league.teams.flatMap(team => team.roster.map(player => player.name))
for (const name of names) {
  for (const bannedName of banned) assert(!name.includes(bannedName), `real star name leaked: ${name}`)
}

assert(!league.enterOffseason().allowed, 'offseason locked during the season')
const bigOffer = league.signFreeAgent(league.freeAgents[0].id, 12_000_000, 3)
assert(!bigOffer.allowed, `in-season exception signing should fail: ${bigOffer.reason}`)

const waived = user.roster[user.roster.length - 1]
const waivedSalary = waived.contract.salaries[0]
const waiveResult = league.waive(waived.id)
assert(waiveResult.allowed, waiveResult.reason)
assert(user.roster.length === 14, 'roster min boundary')
assert(user.finances.deadCap === waivedSalary, 'dead cap keeps this year')
assert(!user.roster.some(player => player.id === waived.id), 'waived player left the roster')
assert(!league.waive(user.roster[0].id).allowed, 'cannot drop below 14')

const cheap = must(league.freeAgents.find(player => player.overallRating < 70), 'need a minimum-level free agent')
const signed = league.signFreeAgent(cheap.id, NBA_RULES.MINIMUM_SALARY, 1)
assert(signed.allowed, signed.reason)
assert(user.depthChart[cheap.position].includes(cheap.id), 'signing puts him on the depth chart')

const veteran = must(user.roster.find(player => player.contract.salaries.length > 1), 'need a multi-year deal')
assert(!CBASimulator.evaluateExtension(user, veteran, 10_000_000, 2).allowed, 'extension locked until the final year')
veteran.contract.salaries = [veteran.contract.salaries[0]]
veteran.contract.birdRights = 'full-bird'
veteran.contract.yearsServed = 4
const beforeHit = CBASimulator.capHit(user)
const extended = league.extend(veteran.id, 25_000_000, 3)
assert(extended.allowed, extended.reason)
assert(veteran.contract.salaries[0] !== 25_000_000, 'extension money starts next year')
assert(veteran.contract.salaries[1] === 25_000_000, 'year two is the new money')
assert(CBASimulator.capHit(user) === beforeHit, 'extension does not change this year cap hit')

assert(league.userTeam().finances.tvDeal === 'national', 'a contender has a national TV deal')
assert(league.userTeam().finances.sponsor?.annual === NBA_RULES.SPONSOR_NATIONAL, 'national sponsor is on the books')
assert(!league.draftProspect(league.draftProspects[0].id).allowed, 'cannot draft in season')
league.seasonComplete = true
const opened = league.enterOffseason()
assert(opened.allowed, opened.reason)
assert(league.phase === 'offseason', 'phase')

const playoffIds = new Set<string>()
for (const conference of ['East', 'West'] as const) {
  const table = league.teams
    .filter(team => team.conference === conference)
    .sort((a, b) => a.city.localeCompare(b.city))
  for (const team of table.slice(0, NBA_RULES.PLAYOFF_SPOTS_PER_CONFERENCE)) playoffIds.add(team.id)
}
const firstRound = league.draftOrder.filter(pick => pick.round === 1)
const lotteryIds = firstRound.slice(0, league.teams.length - playoffIds.size).map(pick => pick.teamId)
assert(lotteryIds.length === 14, 'fourteen lottery teams')
assert(lotteryIds.every(id => !playoffIds.has(id)), 'playoff teams stay out of the lottery')
const secondRound = league.draftOrder.filter(pick => pick.round === 2).map(pick => pick.teamId)
assert(firstRound.map(pick => pick.teamId).join() === secondRound.join(), 'draft order repeats, it does not snake')

let safety = 0
while (league.offseasonStep === 'draft') {
  const pick = league.currentPick()
  assert(pick?.teamId === league.userTeamId, 'sim should stop on the user pick')
  const prospect = league.draftProspects[0]
  const drafted = league.draftProspect(prospect.id)
  assert(drafted.allowed, drafted.reason)
  if (++safety > 4) throw new Error('draft did not finish')
}
assert(league.offseasonStep === 'free-agency', 'free agency follows the draft')
assert(league.draftProspects.length === 0, 'undrafted players leave the board')

if (user.roster.length >= NBA_RULES.ROSTER_MAX && user.roster.length < NBA_RULES.OFFSEASON_ROSTER_MAX) {
  const extra = must(league.freeAgents.find(player => player.overallRating < 76), 'camp body for the 16th spot')
  const overRegularMax = league.signFreeAgent(extra.id, NBA_RULES.MINIMUM_SALARY, 1)
  assert(overRegularMax.allowed, overRegularMax.reason)
}

while (user.roster.length < NBA_RULES.ROSTER_MIN) {
  const body = must(league.freeAgents.find(player => player.overallRating < 76), 'camp body available')
  const camp = league.signFreeAgent(body.id, NBA_RULES.MINIMUM_SALARY, 1)
  assert(camp.allowed, camp.reason)
}
while (user.roster.length > NBA_RULES.ROSTER_MAX) {
  const cut = [...user.roster].sort((a, b) => a.overallRating - b.overallRating)[0]
  assert(league.waive(cut.id).allowed, 'cut down to 15')
}
const started = league.startNewSeason()
assert(started.allowed, started.reason)
assert(league.season === 2027, 'season rolled')
assert(league.phase === 'regular', 'back to regular season')
assert(user.wins === 0 && user.losses === 0, 'record reset')
assert(user.roster.length >= NBA_RULES.ROSTER_MIN && user.roster.length <= NBA_RULES.ROSTER_MAX, 'legal opening roster')
assert(league.draftProspects.length === 60, 'next class is scoutable')
assert(league.scoutingTokens === NBA_RULES.SCOUTING_TOKENS, 'tokens refill')

const choices = careerChoices()
assert(choices.length === 30, 'every franchise is choosable')
const picked = new LeagueManager()
picked.initializeLeague('team_14')
assert(picked.userTeamId === 'team_14', 'career starts with the chosen team')
assert(picked.userTeam().city === 'Orlando' && picked.userTeam().owner.name === 'Sofia Marin', 'Orlando keeps its owner')
assert(picked.userTeam().coach.name === 'Devin Cole', 'skipping a coach keeps the bench coach')
const hired = new LeagueManager()
hired.initializeLeague('team_14', {
  name: 'Amina Cole',
  style: 'tactician',
  tempo: 'fast',
  offense: 'isolation',
  coverage: 'switch-everything'
})
assert(hired.userTeam().coach.name === 'Amina Cole' && hired.userTeam().coach.style === 'tactician', 'the new coach is hired')
assert(hired.userTeam().coach.offense === 76 && hired.userTeam().coach.age > 30, 'the hired coach has a profile')
assert(hired.userTeam().coach.pedigree === 'video-room' && hired.userTeam().coach.signatures.length === 0, 'a tactician starts in the video room')
const marked = new LeagueManager()
marked.initializeLeague('team_1', {
  name: 'Ivo Petrov',
  style: 'tactician',
  tempo: 'fast',
  offense: 'motion',
  coverage: 'switch-everything',
  pedigree: 'european-tactician',
  signatures: ['seven-seconds', 'lockdown', 'players-friend'],
  offenseSkill: 84,
  defenseSkill: 70,
  teaching: 66,
  manManagement: 52
})
const ivo = marked.userTeam().coach
assert(ivo.pedigree === 'european-tactician' && ivo.signatures.length === 2 && ivo.signatures[0] === 'seven-seconds' && ivo.respect === 58, 'two signatures stick and respect follows the pedigree')
assert(ivo.offense === 88 && ivo.defense === 76 && ivo.style === 'tactician' && ivo.formerPlayer === false, 'the pedigree locks the ratings')
const near = (value: number, target: number) => Math.abs(value - target) < 0.0001
assert(coachTurnoverBump(ivo, false) === 0.008 && coachTurnoverBump(ivo, true) === 0, 'seven seconds costs the ball in the half court')
assert(near(coachShotAdjust(ivo, { fastBreak: true, quarter: 1, secondsRemaining: 400, shooterIsDiva: false, roomMorale: 80 }), 0.033), 'transition and the tactician finish more often')
assert(near(coachShotAdjust(ivo, { fastBreak: false, quarter: 1, secondsRemaining: 400, shooterIsDiva: true, roomMorale: 60 }), -0.007), 'a diva has not bought in')
assert(near(coachFoulMultiplier({ ...ivo, pedigree: 'college-mentor', signatures: ['lockdown'] }), 0.92 * 1.1), 'a mentor fouls less and lockdown fouls more')
const guy = structuredClone(marked.userTeam().roster[0])
guy.morale = 60
guy.traits = []
guy.age = 21
const plain = moraleAfterGame(guy, 32, false, false, { ...ivo, pedigree: 'video-room', signatures: [], formerPlayer: false, manManagement: 60 })
const soft = moraleAfterGame(guy, 32, false, false, { ...ivo, pedigree: 'video-room', signatures: ['players-friend'], formerPlayer: false, manManagement: 60 })
const young = moraleAfterGame(guy, 32, false, false, { ...ivo, pedigree: 'former-star', signatures: [], formerPlayer: false, manManagement: 60 })
assert(soft > plain, 'a player\'s best friend halves a loss')
assert(young < plain, 'a former star weighs on a young player after a loss')
const buried = structuredClone(guy)
buried.personality = { ...buried.personality, usageExpectation: 32 }
buried.id = 'buried'
assert(roleMoraleDelta(buried, 12, 0) === -3, 'a starter buried by his minutes feels it')
assert(roleMoraleDelta(buried, 30, 0) === 0, 'a starter near his minutes is fine')
const mates = [
  buried,
  { ...buried, id: 'a', personality: { ...buried.personality, usageExpectation: 26 } },
  { ...buried, id: 'b', personality: { ...buried.personality, usageExpectation: 26 } }
]
assert(crowdedShotPenalty(buried, mates) === 0.012, 'three ball-dominant players make the shot worse')
assert(crowdedShotPenalty(buried, [buried, mates[1]]) === 0, 'one partner is not a crowd')
const room = marked.userTeam()
const starter = room.roster[0]
starter.personality.usageExpectation = 32
starter.tradeDemand = false
starter.tradeLeak = false
room.depthChart[starter.position] = [starter.id, ...(room.depthChart[starter.position] || []).filter(id => id !== starter.id)]
settleTeamMorale(room.roster, player => player.id === starter.id ? 10 : 32, true, room.coach, room)
const askedOut = Boolean(starter.tradeDemand && starter.tradeLeak)
assert(askedOut, 'a buried starter wants out')
const beforeCash = hired.userTeam().finances.cash
bookGameMoney(hired.userTeam(), true, true, '2026-10-22')
const october = hired.userTeam().finances.books?.find(row => row.month === '2026-10')
assert(october && october.gate > 0 && october.tv > 0 && october.merch > 0 && october.salary < 0 && october.staff < 0 && october.stadium < 0, 'october books gate, TV, merch, salary, staff, and the building')
assert(hired.userTeam().finances.cash !== beforeCash, 'the night moves cash')
assert(hired.userTeam().tactics.tempo === 'fast' && hired.userTeam().tactics.offensiveStyle === 'isolation', 'the scheme starts with the coach')
assert(hired.teams.find(team => team.id === 'team_1')?.coach.name === 'Alex Ward', 'other benches keep their coaches')

const bracket = new LeagueManager()
bracket.initializeLeague('team_1')
for (const conference of ['East', 'West'] as const) {
  const table = bracket.teams.filter(team => team.conference === conference).sort((a, b) => a.city.localeCompare(b.city))
  table.forEach((team, index) => {
    team.wins = 60 - index
    team.losses = 22 + index
  })
}
const winsBefore = bracket.userTeam().wins
bracket.seasonComplete = true
bracket.openPlayoffs()
assert(bracket.playoffSeries.length === 8, 'eight first-round series')
assert(bracket.userPlayoffGame(), 'the user has a playoff game')
const firstHome = bracket.userPlayoffGame()!
assert(firstHome.homeTeamId === bracket.userTeamId, 'higher seed hosts game 1')
const champion = bracket.simulatePlayoffs()
assert(champion, 'a champion is crowned')
assert(bracket.userTeam().wins === winsBefore, 'playoff games stay off the regular-season record')
for (const series of bracket.playoffSeries) {
  assert(series.winnerId, 'every series has a winner')
  const wins = Math.max(series.highWins, series.lowWins)
  assert(wins === NBA_RULES.PLAYOFF_WINS_TO_ADVANCE, 'a series ends at four wins')
  assert(series.highWins + series.lowWins <= 7, 'no series runs past seven')
}
assert(bracket.enterOffseason().allowed, 'offseason opens after the title')

const market = new LeagueManager()
market.initializeLeague('team_2')
assert(market.userTeam().finances.tvDeal === 'partner', 'a middle market starts on the partner deal')
const cash = market.userTeam().finances.cash
const blocked = market.setTvDeal('national')
assert(!blocked.allowed, blocked.reason)
market.userTeam().finances.cash = cash + NBA_RULES.TV_BUYOUT_NATIONAL
assert(market.setTvDeal('national').allowed, 'national deal signs once the buyout is covered')
assert(tvCheck(market.userTeam()) === Math.round(NBA_RULES.TV_SHARE * NBA_RULES.TV_NATIONAL), 'national check')
assert(market.setTvDeal('partner').allowed, 'dropping a tier is free')
assert(market.userTeam().finances.cash === cash, 'a downgrade does not refund the buyout')

const club = new LeagueManager()
club.initializeLeague('team_1')
assert(club.wire.some(post => post.body.includes('Alex Ward') || post.body.includes(club.userTeam().coach.name)), 'a new career opens the wire')
const homeCash = club.userTeam().finances.cash
const blockedJersey = club.setJersey(club.userTeam().color, club.userTeam().trim ?? '#E8E4D9')
assert(!blockedJersey.allowed, blockedJersey.reason)
assert(club.setJersey('#552583', '#F5F5F0').allowed, 'uniform order goes through')
assert(club.userTeam().color === '#552583' && club.userTeam().trim === '#F5F5F0', 'home colors change')
assert(club.userTeam().finances.cash === homeCash - NBA_RULES.JERSEY_ORDER, 'uniforms come out of cash')
const broke = new LeagueManager()
broke.initializeLeague('team_1')
broke.userTeam().finances.cash = 0
assert(!broke.setHomeCity('Montreal').allowed, 'a move needs the fee')
assert(club.setHomeCity('Boston').allowed === false, 'the current city is not a move')
assert(club.setHomeCity('Montreal').allowed, 'an open city is available')
assert(club.userTeam().city === 'Montreal' && club.userTeam().id === 'team_1' && club.userTeam().division === 'Atlantic', 'the club moves and stays in the division')
assert(club.teams.filter(team => team.city === 'Boston').length === 0, 'the old city is empty')
const beforeWire = club.wire.length
let spins = 0
while (club.wire.length === beforeWire && spins++ < 8) club.simulateRound('team_1')
assert(club.wire.length > beforeWire, 'a user game hits the wire')
assert(club.wire.some(post => post.role === 'journalist'), 'a beat writer posts')
assert(club.wire.some(post => post.role === 'player'), 'a player posts')

console.log('systems ok')
console.log(`user payroll $${(CBASimulator.capHit(user) / 1_000_000).toFixed(1)}M, roster ${user.roster.length}, season ${league.season}`)
