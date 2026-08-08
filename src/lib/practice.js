// A few practice problems, in Explore. Pure — no fetching, no clock reads
// except through an injected date.
//
// WHY TWO OF THE THREE SOURCES ARE STATIC. Only LeetCode has a genuine "problem
// of the day", and it is the one thing here that needs a server (leetcode.com
// answers a browser 200 but sends no CORS header — see
// supabase/functions/daily-problem). The other two are fixed, canonical problem
// sets that do not change:
//   * CSES is a curated 300-problem list that has been stable for years.
//   * Codeforces has an open, CORS-enabled API — but `problemset.problems` is
//     2.25 MB and 11,347 problems. Downloading that for one row is absurd, so
//     the picks below were DERIVED from it once (rating 1200–1700, sorted by
//     solve count, capped at two per primary tag) and frozen.
//
// Every id here was verified against the live source rather than written from
// memory: all 41 CSES tasks return 200 with the title shown, and the Codeforces
// rows came out of the API itself. A curated list whose links 404 is worse than
// no list.
//
// "Only a few, not too many" is the brief, so the card shows THREE rows and the
// lists exist only to rotate them.

export const CSES = [
  { id: 1068, title: 'Weird Algorithm', group: 'Introductory' },
  { id: 1083, title: 'Missing Number', group: 'Introductory' },
  { id: 1069, title: 'Repetitions', group: 'Introductory' },
  { id: 1094, title: 'Increasing Array', group: 'Introductory' },
  { id: 1070, title: 'Permutations', group: 'Introductory' },
  { id: 1071, title: 'Number Spiral', group: 'Introductory' },
  { id: 1072, title: 'Two Knights', group: 'Introductory' },
  { id: 1092, title: 'Two Sets', group: 'Introductory' },
  { id: 1621, title: 'Distinct Numbers', group: 'Sorting & Searching' },
  { id: 1084, title: 'Apartments', group: 'Sorting & Searching' },
  { id: 1090, title: 'Ferris Wheel', group: 'Sorting & Searching' },
  { id: 1091, title: 'Concert Tickets', group: 'Sorting & Searching' },
  { id: 1074, title: 'Stick Lengths', group: 'Sorting & Searching' },
  { id: 1073, title: 'Towers', group: 'Sorting & Searching' },
  { id: 1633, title: 'Dice Combinations', group: 'Dynamic Programming' },
  { id: 1634, title: 'Minimizing Coins', group: 'Dynamic Programming' },
  { id: 1635, title: 'Coin Combinations I', group: 'Dynamic Programming' },
  { id: 1636, title: 'Coin Combinations II', group: 'Dynamic Programming' },
  { id: 1637, title: 'Removing Digits', group: 'Dynamic Programming' },
  { id: 1638, title: 'Grid Paths I', group: 'Dynamic Programming' },
  { id: 1158, title: 'Book Shop', group: 'Dynamic Programming' },
  { id: 1097, title: 'Removal Game', group: 'Dynamic Programming' },
  { id: 1192, title: 'Counting Rooms', group: 'Graph Algorithms' },
  { id: 1193, title: 'Labyrinth', group: 'Graph Algorithms' },
  { id: 1194, title: 'Monsters', group: 'Graph Algorithms' },
  { id: 1666, title: 'Building Roads', group: 'Graph Algorithms' },
  { id: 1667, title: 'Message Route', group: 'Graph Algorithms' },
  { id: 1668, title: 'Building Teams', group: 'Graph Algorithms' },
  { id: 1671, title: 'Shortest Routes I', group: 'Graph Algorithms' },
  { id: 1673, title: 'High Score', group: 'Graph Algorithms' },
  { id: 1674, title: 'Subordinates', group: 'Tree Algorithms' },
  { id: 1130, title: 'Tree Matching', group: 'Tree Algorithms' },
  { id: 1131, title: 'Tree Diameter', group: 'Tree Algorithms' },
  { id: 1646, title: 'Static Range Sum Queries', group: 'Range Queries' },
  { id: 1647, title: 'Static Range Minimum Queries', group: 'Range Queries' },
  { id: 1648, title: 'Dynamic Range Sum Queries', group: 'Range Queries' },
  { id: 1095, title: 'Exponentiation', group: 'Mathematics' },
  { id: 1617, title: 'Bit Strings', group: 'Mathematics' },
  { id: 1618, title: 'Trailing Zeros', group: 'Mathematics' },
  { id: 1755, title: 'Palindrome Reorder', group: 'String Algorithms' },
  { id: 1753, title: 'String Matching', group: 'String Algorithms' },
]

export const CODEFORCES = [
  { id: '4C', title: 'Registration System', rating: 1300, tags: ['data structures', 'hashing'] },
  { id: '25A', title: 'IQ test', rating: 1300, tags: ['brute force'] },
  { id: '230B', title: 'T-primes', rating: 1300, tags: ['binary search', 'implementation'] },
  { id: '492B', title: 'Vanya and Lanterns', rating: 1200, tags: ['binary search', 'implementation'] },
  { id: '189A', title: 'Cut Ribbon', rating: 1300, tags: ['brute force', 'dp'] },
  { id: '466A', title: 'Cheap Travel', rating: 1200, tags: ['implementation'] },
  { id: '455A', title: 'Boredom', rating: 1500, tags: ['dp'] },
  { id: '514A', title: 'Chewbaсca and Number', rating: 1200, tags: ['greedy', 'implementation'] },
  { id: '1520D', title: 'Same Differences', rating: 1200, tags: ['data structures', 'hashing'] },
  { id: '520B', title: 'Two Buttons', rating: 1400, tags: ['dfs and similar', 'graphs'] },
  { id: '489B', title: 'BerSU Ball', rating: 1200, tags: ['dfs and similar', 'dp'] },
  { id: '433B', title: "Kuriyama Mirai's Stones", rating: 1200, tags: ['dp', 'implementation'] },
  { id: '451B', title: 'Sort the Array', rating: 1300, tags: ['implementation', 'sortings'] },
  { id: '459B', title: 'Pashmak and Flowers', rating: 1300, tags: ['combinatorics', 'implementation'] },
]

// Must stay coprime with CODEFORCES.length or the rotation collapses to a
// fraction of the list — there is a test asserting every entry is reachable.
export const CF_STRIDE = 5

/** `1520D` -> contest 1520, index D. Codeforces urls need them separately. */
export function codeforcesUrl(id) {
  const m = /^(\d+)([A-Z]\d?)$/.exec(id)
  if (!m) return 'https://codeforces.com/problemset'
  return `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`
}

export const csesUrl = (id) => `https://cses.fi/problemset/task/${id}`

/**
 * Days since epoch in the given zone — the rotation index.
 *
 * A date, not `Math.random()`: the pick must be the same all day. A random one
 * re-rolls on every render, so glancing at the card twice shows two different
 * problems and neither feels like today's.
 */
export function dayIndex(now = new Date(), tz) {
  const d = tz
    ? new Date(now.toLocaleString('en-US', { timeZone: tz }))
    : now
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

/**
 * The static half of the card: one CSES and one Codeforces problem, rotating
 * daily and offset from each other so they do not advance in lockstep.
 */
export function staticPicks(now = new Date(), tz) {
  const i = dayIndex(now, tz)
  const cses = CSES[((i % CSES.length) + CSES.length) % CSES.length]
  // A stride COPRIME with the list length, so `i * stride` visits every entry
  // before repeating. The first version used 7 against a 14-item list — 7
  // divides 14, so it reached exactly two of the fourteen problems, forever.
  // Prime is not the property that matters here; coprime to the length is.
  // 5 and 14 share no factor, and CSES's length (41) is prime, so the pairing
  // period is their product rather than either list's length.
  const cfIndex = ((i * CF_STRIDE) % CODEFORCES.length + CODEFORCES.length) % CODEFORCES.length
  const cf = CODEFORCES[cfIndex]
  return [
    { source: 'cses', title: cses.title, url: csesUrl(cses.id), meta: cses.group },
    { source: 'codeforces', title: cf.title, url: codeforcesUrl(cf.id), meta: `${cf.id} · ${cf.rating}` },
  ]
}
