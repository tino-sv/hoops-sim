import type { Conference, Division } from './types'

export interface ScheduleTeam {
  id: string
  conference: Conference
  division: Division
  slot: number
}

export interface BuiltMatch {
  id: string
  round: number
  date: string
  homeTeamId: string
  awayTeamId: string
  cup: boolean
}

export interface BuiltSeason {
  matches: BuiltMatch[]
  allStarRound: number
  allStarDate: string
  rounds: number
}

interface DatedNight {
  date: string
}

function gamesAgainst(a: ScheduleTeam, b: ScheduleTeam): number {
  if (a.conference !== b.conference) return 2
  if (a.division === b.division) return 4
  const diff = (a.slot - b.slot + 5) % 5
  return diff === 0 || diff === 1 || diff === 4 ? 4 : 3
}

function calendar(season: number): { nights: DatedNight[]; allStarDate: string } {
  const nights: DatedNight[] = []
  const cursor = new Date(Date.UTC(season, 9, 20))
  const end = Date.UTC(season + 1, 3, 20)
  const breakStart = Date.UTC(season + 1, 1, 13)
  const breakEnd = Date.UTC(season + 1, 1, 22)
  while (cursor.getTime() < end) {
    const day = cursor.getUTCDay()
    const time = cursor.getTime()
    const onBreak = time >= breakStart && time < breakEnd
    const gameNight = day === 0 || day === 2 || day === 4 || day === 6
    if (!onBreak && gameNight) {
      nights.push({ date: cursor.toISOString().slice(0, 10) })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return { nights, allStarDate: `${season + 1}-02-14` }
}

function pairList(teams: ScheduleTeam[]): [string, string][] {
  const games: [string, string][] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const times = gamesAgainst(teams[i], teams[j])
      for (let n = 0; n < times; n++) games.push([teams[i].id, teams[j].id])
    }
  }
  return games
}

function place(games: [string, string][], nights: number, salt: number): { a: string; b: string; night: number }[] | null {
  let state = (salt * 997) % 2147483647
  const next = () => {
    state = state * 16807 % 2147483647
    return state
  }
  const order = games.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = next() % (i + 1)
    const swap = order[i]
    order[i] = order[j]
    order[j] = swap
  }
  const busy: Set<string>[] = Array.from({ length: nights }, () => new Set())
  const placed: { a: string; b: string; night: number }[] = []
  for (const index of order) {
    const [a, b] = games[index]
    let night = -1
    const start = next() % nights
    for (let step = 0; step < nights; step++) {
      const candidate = (start + step) % nights
      if (!busy[candidate].has(a) && !busy[candidate].has(b)) {
        night = candidate
        break
      }
    }
    if (night < 0) return null
    busy[night].add(a)
    busy[night].add(b)
    placed.push({ a, b, night })
  }
  return placed
}

export function formatSlateDate(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'
  })
}

export function buildSeason(teams: ScheduleTeam[], season: number): BuiltSeason {
  if (teams.length !== 30) throw new Error(`schedule expects 30 teams, got ${teams.length}`)
  const games = pairList(teams)
  const { nights, allStarDate } = calendar(season)
  if (nights.length < 82) throw new Error('not enough dates for an 82-game season')

  let placed: { a: string; b: string; night: number }[] | null = null
  for (let attempt = 0; attempt < 30 && !placed; attempt++) {
    placed = place(games, nights.length, attempt + 1)
  }
  if (!placed) throw new Error('Could not place the 82-game schedule on the calendar')

  const used = [...new Set(placed.map(game => game.night))].sort((a, b) => a - b)
  const roundOf = new Map(used.map((night, index) => [night, index + 1]))
  const meetings = new Map<string, number>()
  const matches: BuiltMatch[] = []

  placed.forEach((game, index) => {
    const key = game.a < game.b ? `${game.a}|${game.b}` : `${game.b}|${game.a}`
    const seen = meetings.get(key) ?? 0
    meetings.set(key, seen + 1)
    const home = seen % 2 === 0 ? game.a : game.b
    const away = home === game.a ? game.b : game.a
    matches.push({
      id: `match_${index + 1}`,
      round: roundOf.get(game.night)!,
      date: nights[game.night].date,
      homeTeamId: home,
      awayTeamId: away,
      cup: false
    })
  })
  matches.sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))

  const byId = new Map(teams.map(team => [team.id, team]))
  const earliest = new Map<string, BuiltMatch>()
  for (const match of matches) {
    const home = byId.get(match.homeTeamId)!
    const away = byId.get(match.awayTeamId)!
    if (home.division !== away.division) continue
    const key = [match.homeTeamId, match.awayTeamId].sort().join('|')
    const prior = earliest.get(key)
    if (!prior || match.round < prior.round) earliest.set(key, match)
  }
  for (const match of earliest.values()) match.cup = true

  const lastBeforeBreak = matches.filter(match => match.date < allStarDate).reduce((max, match) => Math.max(max, match.round), 1)

  return {
    matches,
    allStarRound: lastBeforeBreak,
    allStarDate,
    rounds: used.length
  }
}
