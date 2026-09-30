import { assignBadges, shootingBoost, shotCallout } from '../badges'
import type { Player, PlayerPersonality } from '../types'
import { generateAttributes } from '../ratings'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const personality: PlayerPersonality = {
  ego: 90,
  loyalty: 30,
  greed: 80,
  morale: 40,
  chemistry: 40,
  usageExpectation: 28
}

const wing = generateAttributes('SG', 78)
wing.technical.threePoint = 90
wing.technical.finishing = 88
wing.mental.teamwork = 40
const wingBadges = assignBadges(wing, 'SG', personality)
assert(wingBadges.includes('sharpshooter'), `sharpshooter missing: ${wingBadges.join(',')}`)
assert(wingBadges.includes('slasher'), `slasher missing: ${wingBadges.join(',')}`)
assert(wingBadges.includes('diva'), `diva missing: ${wingBadges.join(',')}`)
assert(wingBadges.length <= 4, 'too many badges')

const fake = {
  traits: ['sharpshooter', 'clutch', 'fragile'],
  morale: 40
} as Player
assert(Math.abs(shootingBoost(fake, 'three', 4, 60) - 0.04) < 0.0001, `boost ${shootingBoost(fake, 'three', 4, 60)}`)
assert(shotCallout(fake, 'three', 4, 60).includes('Sharpshooter'), 'callout names the badge')
assert(shotCallout(fake, 'three', 4, 60).includes('Clutch'), 'callout names clutch')
assert(shotCallout(fake, 'three', 4, 60).includes('Fragile'), 'low morale shows up')

console.log('badges ok')
