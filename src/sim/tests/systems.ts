import { CBASimulator } from '../cba'
import { LeagueManager } from '../league'
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
assert(league.teams.length === 12, '12 teams')
assert(league.teams.every(team => team.roster.length === NBA_RULES.ROSTER_MAX), 'every roster is 15')
assert(league.teams.filter(team => team.conference === 'East').length === 6, 'east')
assert(league.teams.filter(team => team.conference === 'West').length === 6, 'west')

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
assert(lotteryIds.length === 4, 'four lottery teams')
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
assert(league.draftProspects.length === 24, 'next class is scoutable')
assert(league.scoutingTokens === NBA_RULES.SCOUTING_TOKENS, 'tokens refill')

console.log('systems ok')
console.log(`user payroll $${(CBASimulator.capHit(user) / 1_000_000).toFixed(1)}M, roster ${user.roster.length}, season ${league.season}`)
