const FIRST_NAMES = [
  "Marcus", "Andre", "Malik", "Darius", "Terrell", "Isaiah", "Cameron", "Julian",
  "Nico", "Mateo", "Andrejs", "Kenji", "Ibrahim", "Omar", "Luis", "Diego",
  "Callum", "Jonah", "Ellis", "Harlan", "Micah", "Soren", "Idris", "Jamal",
  "DeShawn", "Malcolm", "Andres", "Rafael", "Yuki", "Emile", "Tariq", "Hassan",
  "Cole", "Bennett", "Griffin", "Wesley", "Anton", "Leandro", "Pavel", "Nolan"
]

const LAST_NAMES = [
  "Walker", "Brooks", "Hayes", "Bennett", "Morales", "Nguyen", "Okoye", "Diallo",
  "Keller", "Santos", "Berg", "Abebe", "Rossi", "Nakamura", "Clarke", "Duval",
  "Hernandez", "Petrov", "Mensah", "Almeida", "Kruger", "Shaw", "Ibarra", "Novak",
  "Adeyemi", "Moreau", "Silva", "Park", "Owens", "Brennan", "Costa", "Haddad",
  "Reeves", "Lang", "Ortiz", "Bauer", "Diallo", "Fontaine", "Cho", "McKay"
]

export function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
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
