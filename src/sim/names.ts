const FIRST_NAMES = [
  "Marcus", "Andre", "Malik", "Darius", "Terrell", "Isaiah", "Cameron", "Julian",
  "Nico", "Mateo", "Andrejs", "Kenji", "Ibrahim", "Omar", "Luis", "Diego",
  "Callum", "Jonah", "Ellis", "Harlan", "Micah", "Soren", "Idris", "Jamal",
  "DeShawn", "Malcolm", "Andres", "Rafael", "Yuki", "Emile", "Tariq", "Hassan",
  "Cole", "Bennett", "Griffin", "Wesley", "Anton", "Leandro", "Pavel", "Nolan"
]

const LAST_NAMES: { name: string; weight: number }[] = [
  { name: 'Walker', weight: 8 }, { name: 'Brooks', weight: 8 }, { name: 'Hayes', weight: 7 },
  { name: 'Bennett', weight: 5 }, { name: 'Keller', weight: 5 }, { name: 'Clarke', weight: 5 },
  { name: 'Shaw', weight: 5 }, { name: 'Owens', weight: 5 }, { name: 'Reeves', weight: 4 },
  { name: 'Brennan', weight: 4 }, { name: 'Lang', weight: 4 }, { name: 'McKay', weight: 4 },
  { name: 'Morales', weight: 2 }, { name: 'Hernandez', weight: 2 }, { name: 'Ortiz', weight: 2 },
  { name: 'Ibarra', weight: 1 }, { name: 'Costa', weight: 1 },
  { name: 'Santos', weight: 1 }, { name: 'Silva', weight: 1 }, { name: 'Almeida', weight: 1 },
  { name: 'Diallo', weight: 2 }, { name: 'Okoye', weight: 2 }, { name: 'Adeyemi', weight: 2 },
  { name: 'Mensah', weight: 2 }, { name: 'Abebe', weight: 1 },
  { name: 'Moreau', weight: 2 }, { name: 'Duval', weight: 1 }, { name: 'Fontaine', weight: 1 },
  { name: 'Kruger', weight: 1 }, { name: 'Bauer', weight: 1 }, { name: 'Berg', weight: 1 },
  { name: 'Petrov', weight: 1 }, { name: 'Novak', weight: 1 }, { name: 'Rossi', weight: 1 },
  { name: 'Nakamura', weight: 1 }, { name: 'Park', weight: 1 }, { name: 'Cho', weight: 1 },
  { name: 'Nguyen', weight: 2 }, { name: 'Haddad', weight: 1 }
]

function pickWeightedName(items: { name: string; weight: number }[]): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.floor(Math.random() * total)
  for (const item of items) {
    if (cursor < item.weight) return item.name
    cursor -= item.weight
  }
  return items[0].name
}

export function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = pickWeightedName(LAST_NAMES)
  return `${first} ${last}`
}

export function uniqueName(used: Set<string>): string {
  for (let i = 0; i < 30; i++) {
    const name = randomName()
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `${randomName()} ${used.size + 1}`
  used.add(fallback)
  return fallback
}
