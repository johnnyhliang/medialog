// Seed curriculum for the interview readiness tracker. Each pattern becomes a
// topic (master_doc = primer, tracks[], pattern_target); each problem becomes an
// entry. Primers teach the concept so you're not going in blind; starter
// problems are canonical. Add deeper question banks later via the import panel.
//
// tracks: 'swe' (general/infra SWE), 'sysdesign', 'qt' (quant trading),
//         'quant-dev', 'apm' (product manager).

export const TRACKS = [
  { key: 'swe', label: 'SWE + Infra' },
  { key: 'sysdesign', label: 'System Design' },
  { key: 'qt', label: 'Quant Trading' },
  { key: 'quant-dev', label: 'Quant Dev' },
  { key: 'apm', label: 'APM / Product' },
]

const lc = (slug) => `https://leetcode.com/problems/${slug}/`

export const PATTERNS = [
  // ─────────────────────────── SWE coding patterns ───────────────────────────
  {
    name: 'Arrays & Hashing',
    tracks: ['swe', 'quant-dev'],
    target: 5,
    primer: `Hash maps/sets turn O(n) lookups into O(1), trading space for time. The core move: as you scan an array once, remember what you've seen (value → index, or counts) so a later element can query the past in constant time. Watch for: frequency counting, de-duplication, complement lookups, and grouping by a canonical key.`,
    problems: [
      { title: 'Two Sum', url: lc('two-sum'), difficulty: 'easy' },
      { title: 'Valid Anagram', url: lc('valid-anagram'), difficulty: 'easy' },
      { title: 'Group Anagrams', url: lc('group-anagrams'), difficulty: 'medium' },
      { title: 'Top K Frequent Elements', url: lc('top-k-frequent-elements'), difficulty: 'medium' },
      { title: 'Product of Array Except Self', url: lc('product-of-array-except-self'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Two Pointers',
    tracks: ['swe'],
    target: 4,
    primer: `Two indices moving through a sorted or symmetric structure, converging or chasing, to avoid a nested loop. Key insight: sorting first often unlocks it, and the direction you move a pointer is dictated by whether the current sum/condition is too big or too small. O(n) instead of O(n²).`,
    problems: [
      { title: 'Valid Palindrome', url: lc('valid-palindrome'), difficulty: 'easy' },
      { title: 'Two Sum II (Sorted)', url: lc('two-sum-ii-input-array-is-sorted'), difficulty: 'medium' },
      { title: '3Sum', url: lc('3sum'), difficulty: 'medium' },
      { title: 'Container With Most Water', url: lc('container-with-most-water'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Sliding Window',
    tracks: ['swe'],
    target: 4,
    primer: `A window [left, right] over a sequence that grows and shrinks to maintain an invariant (sum ≤ k, all-distinct, ≤ k replacements). Expand right to include, contract left to restore validity, track the best window as you go. Turns "check every subarray" (O(n²)) into a single O(n) pass.`,
    problems: [
      { title: 'Best Time to Buy and Sell Stock', url: lc('best-time-to-buy-and-sell-stock'), difficulty: 'easy' },
      { title: 'Longest Substring Without Repeating Characters', url: lc('longest-substring-without-repeating-characters'), difficulty: 'medium' },
      { title: 'Longest Repeating Character Replacement', url: lc('longest-repeating-character-replacement'), difficulty: 'medium' },
      { title: 'Minimum Window Substring', url: lc('minimum-window-substring'), difficulty: 'hard' },
    ],
  },
  {
    name: 'Stack',
    tracks: ['swe'],
    target: 3,
    primer: `LIFO structure for problems with nesting or "most recent unmatched" semantics: bracket matching, parsing, and the monotonic stack (keep elements increasing/decreasing to answer "next greater/smaller" in O(n)).`,
    problems: [
      { title: 'Valid Parentheses', url: lc('valid-parentheses'), difficulty: 'easy' },
      { title: 'Min Stack', url: lc('min-stack'), difficulty: 'medium' },
      { title: 'Daily Temperatures', url: lc('daily-temperatures'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Binary Search',
    tracks: ['swe', 'quant-dev'],
    target: 4,
    primer: `Halve the search space each step when it's monotonic. Beyond sorted arrays, the real skill is "binary search on the answer": guess a value, ask a yes/no feasibility question, and narrow the range. Nail the invariant (lo/hi inclusive?) to avoid off-by-one and infinite loops.`,
    problems: [
      { title: 'Binary Search', url: lc('binary-search'), difficulty: 'easy' },
      { title: 'Search a 2D Matrix', url: lc('search-a-2d-matrix'), difficulty: 'medium' },
      { title: 'Koko Eating Bananas', url: lc('koko-eating-bananas'), difficulty: 'medium' },
      { title: 'Find Minimum in Rotated Sorted Array', url: lc('find-minimum-in-rotated-sorted-array'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Linked Lists',
    tracks: ['swe'],
    target: 4,
    primer: `Pointer manipulation with no random access. Master three tools: the dummy head (simplifies edge cases at the front), fast/slow pointers (cycle detection, middle-finding), and careful in-place reversal (track prev/cur/next).`,
    problems: [
      { title: 'Reverse Linked List', url: lc('reverse-linked-list'), difficulty: 'easy' },
      { title: 'Merge Two Sorted Lists', url: lc('merge-two-sorted-lists'), difficulty: 'easy' },
      { title: 'Linked List Cycle', url: lc('linked-list-cycle'), difficulty: 'easy' },
      { title: 'Remove Nth Node From End of List', url: lc('remove-nth-node-from-end-of-list'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Trees (BFS / DFS)',
    tracks: ['swe'],
    target: 5,
    primer: `Recursion is the natural fit: solve a node in terms of its children (DFS), or sweep level-by-level with a queue (BFS). Know when order matters (BST in-order = sorted), and the recurring "return info up the tree" pattern (height, subtree sums, LCA).`,
    problems: [
      { title: 'Invert Binary Tree', url: lc('invert-binary-tree'), difficulty: 'easy' },
      { title: 'Maximum Depth of Binary Tree', url: lc('maximum-depth-of-binary-tree'), difficulty: 'easy' },
      { title: 'Binary Tree Level Order Traversal', url: lc('binary-tree-level-order-traversal'), difficulty: 'medium' },
      { title: 'Validate Binary Search Tree', url: lc('validate-binary-search-tree'), difficulty: 'medium' },
      { title: 'Lowest Common Ancestor of a BST', url: lc('lowest-common-ancestor-of-a-binary-search-tree'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Backtracking',
    tracks: ['swe'],
    target: 4,
    primer: `Build candidates incrementally and abandon ("backtrack") the moment a partial solution can't work. The template: choose → explore (recurse) → un-choose. Used for subsets, permutations, combinations, and constraint search. Prune aggressively to tame exponential blowup.`,
    problems: [
      { title: 'Subsets', url: lc('subsets'), difficulty: 'medium' },
      { title: 'Combination Sum', url: lc('combination-sum'), difficulty: 'medium' },
      { title: 'Permutations', url: lc('permutations'), difficulty: 'medium' },
      { title: 'Word Search', url: lc('word-search'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Graphs',
    tracks: ['swe'],
    target: 5,
    primer: `Model entities as nodes and relationships as edges, then BFS/DFS/union-find over them. Core skills: grid-as-graph (islands), cycle detection, topological sort (course scheduling / dependencies), and knowing when BFS gives shortest path (unweighted) vs when you need Dijkstra.`,
    problems: [
      { title: 'Number of Islands', url: lc('number-of-islands'), difficulty: 'medium' },
      { title: 'Clone Graph', url: lc('clone-graph'), difficulty: 'medium' },
      { title: 'Course Schedule', url: lc('course-schedule'), difficulty: 'medium' },
      { title: 'Pacific Atlantic Water Flow', url: lc('pacific-atlantic-water-flow'), difficulty: 'medium' },
      { title: 'Rotting Oranges', url: lc('rotting-oranges'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Dynamic Programming',
    tracks: ['swe', 'quant-dev'],
    target: 6,
    primer: `Optimal substructure + overlapping subproblems: define a state, a recurrence relating it to smaller states, and a base case; then memoize (top-down) or tabulate (bottom-up). The hard part is naming the right state. Start 1D (sequences), then 2D (two strings / grid / knapsack).`,
    problems: [
      { title: 'Climbing Stairs', url: lc('climbing-stairs'), difficulty: 'easy' },
      { title: 'House Robber', url: lc('house-robber'), difficulty: 'medium' },
      { title: 'Coin Change', url: lc('coin-change'), difficulty: 'medium' },
      { title: 'Longest Increasing Subsequence', url: lc('longest-increasing-subsequence'), difficulty: 'medium' },
      { title: 'Longest Common Subsequence', url: lc('longest-common-subsequence'), difficulty: 'medium' },
      { title: 'Unique Paths', url: lc('unique-paths'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Intervals',
    tracks: ['swe'],
    target: 3,
    primer: `Sort by start (or end), then sweep once merging or counting overlaps. The recurring trick: after sorting, an overlap exists iff the next start ≤ current end. Underlies calendars, meeting rooms, and range merging.`,
    problems: [
      { title: 'Merge Intervals', url: lc('merge-intervals'), difficulty: 'medium' },
      { title: 'Insert Interval', url: lc('insert-interval'), difficulty: 'medium' },
      { title: 'Non-overlapping Intervals', url: lc('non-overlapping-intervals'), difficulty: 'medium' },
    ],
  },
  {
    name: 'Heap / Priority Queue',
    tracks: ['swe', 'quant-dev'],
    target: 3,
    primer: `A heap gives O(log n) access to the min/max and O(1) peek — ideal for "top-k", streaming medians (two heaps), and merging k sorted sources. Reach for it whenever you repeatedly need the current extreme of a changing set.`,
    problems: [
      { title: 'Kth Largest Element in an Array', url: lc('kth-largest-element-in-an-array'), difficulty: 'medium' },
      { title: 'Find Median from Data Stream', url: lc('find-median-from-data-stream'), difficulty: 'hard' },
      { title: 'Merge k Sorted Lists', url: lc('merge-k-sorted-lists'), difficulty: 'hard' },
    ],
  },

  // ─────────────────────────── System design primer ───────────────────────────
  {
    name: 'SD: Fundamentals & Trade-offs',
    tracks: ['swe', 'sysdesign'],
    target: 2,
    primer: `The vocabulary everything else builds on: latency vs throughput, availability vs consistency (CAP — in a partition you pick one), vertical vs horizontal scaling, and back-of-envelope estimation (QPS, storage, bandwidth). Interviewers want you to state assumptions and reason about numbers before drawing boxes.`,
    problems: [
      { title: 'Estimate QPS & storage for a photo-sharing app', difficulty: 'easy' },
      { title: 'Explain CAP with a concrete partition scenario', difficulty: 'medium' },
    ],
  },
  {
    name: 'SD: Scaling & Caching',
    tracks: ['swe', 'sysdesign'],
    target: 3,
    primer: `How systems absorb load: load balancers (L4/L7, health checks), horizontal replication behind them, and caching at every layer (client, CDN, app, DB). Know cache strategies (cache-aside, write-through, write-back), eviction (LRU), and the two hard problems — invalidation and the thundering herd.`,
    problems: [
      { title: 'Design a CDN / edge cache', difficulty: 'medium' },
      { title: 'Design a distributed cache (à la Redis/Memcached)', difficulty: 'hard' },
      { title: 'When does caching hurt? Discuss consistency', difficulty: 'medium' },
    ],
  },
  {
    name: 'SD: Data Storage',
    tracks: ['swe', 'sysdesign'],
    target: 3,
    primer: `Picking and scaling the datastore: SQL (ACID, joins) vs NoSQL (flexible, horizontally scalable), indexing (B-tree vs LSM), sharding (by key/range/hash) and its hot-spot pitfalls, and replication (leader-follower, quorum). Tie the choice back to the access pattern, not fashion.`,
    problems: [
      { title: 'Design a URL shortener (key gen + storage)', difficulty: 'medium' },
      { title: 'Shard a users table — pick a key, discuss hot spots', difficulty: 'medium' },
      { title: 'SQL vs NoSQL for a messaging app — justify', difficulty: 'medium' },
    ],
  },
  {
    name: 'SD: Classic Designs',
    tracks: ['swe', 'sysdesign'],
    target: 4,
    primer: `The canonical end-to-end interviews. Practice the flow: clarify scope → estimate → API → data model → high-level diagram → deep-dive a bottleneck → discuss trade-offs. Rate limiter, news feed, chat, and web crawler cover most reusable sub-components.`,
    problems: [
      { title: 'Design a rate limiter (token bucket vs sliding window)', difficulty: 'medium' },
      { title: 'Design a news feed (fan-out on write vs read)', difficulty: 'hard' },
      { title: 'Design a chat system (delivery, presence, ordering)', difficulty: 'hard' },
      { title: 'Design a web crawler (dedup, politeness, scale)', difficulty: 'hard' },
    ],
  },

  // ─────────────────────────── Quant trading ───────────────────────────
  {
    name: 'Probability Fundamentals',
    tracks: ['qt'],
    target: 4,
    primer: `The bedrock of every trading interview. Sample spaces, independence vs mutual exclusivity, complementary counting, and the difference between "and" (multiply, if independent) and "or" (add, minus overlap). Most brainteasers are a clean probability question in disguise — find the right sample space.`,
    problems: [
      { title: 'Prob. two random points on a stick form a triangle', difficulty: 'medium' },
      { title: 'Prob. of at least one shared birthday in a room of n', difficulty: 'easy' },
      { title: 'Drawing without replacement: prob. of a specific hand', difficulty: 'easy' },
      { title: 'Gambler’s ruin: prob. of reaching N before 0', difficulty: 'hard' },
    ],
  },
  {
    name: 'Expected Value & Decisions',
    tracks: ['qt'],
    target: 4,
    primer: `EV is the trader's compass: value = Σ (probability × payoff). Master linearity of expectation (works even when events are dependent — hugely powerful), conditional EV, and using EV to price bets and decide optimal stopping. A fair price is the one making EV zero.`,
    problems: [
      { title: 'EV of rolling a die, re-roll once if you want — optimal policy', difficulty: 'medium' },
      { title: 'Expected number of coin flips to get HH vs HT', difficulty: 'hard' },
      { title: 'You pay $x to draw; what’s a fair price for this game?', difficulty: 'medium' },
      { title: 'Expected number of distinct faces after n die rolls', difficulty: 'medium' },
    ],
  },
  {
    name: 'Combinatorics',
    tracks: ['qt'],
    target: 3,
    primer: `Counting without listing: permutations vs combinations, the multiplication principle, stars-and-bars for distributions, and inclusion-exclusion for overlaps. Getting the denominator right (total outcomes) is where most probability errors actually come from.`,
    problems: [
      { title: 'Number of ways to arrange letters of a word with repeats', difficulty: 'easy' },
      { title: 'How many paths on a grid from corner to corner?', difficulty: 'medium' },
      { title: 'Inclusion-exclusion: derangements of n items', difficulty: 'hard' },
    ],
  },
  {
    name: 'Conditional Probability & Bayes',
    tracks: ['qt'],
    target: 3,
    primer: `Updating beliefs on evidence: P(A|B) = P(A∩B)/P(B), and Bayes to flip the condition. The classic traps are base-rate neglect (rare-disease test) and the Monty Hall / two-children ambiguity — always write the conditioning event explicitly.`,
    problems: [
      { title: 'Rare disease test: P(sick | positive) with base rates', difficulty: 'medium' },
      { title: 'Monty Hall — prove switching wins 2/3', difficulty: 'medium' },
      { title: 'Two children, one is a boy — prob. both boys?', difficulty: 'medium' },
    ],
  },
  {
    name: 'Markov Chains & Random Walks',
    tracks: ['qt'],
    target: 2,
    primer: `Memoryless processes where the next state depends only on the current one. Set up transition probabilities, solve for hitting times and stationary distributions with a system of linear equations. Random walks (symmetric and biased) recur constantly in market-microstructure questions.`,
    problems: [
      { title: 'Expected steps for a random walk to hit ±N', difficulty: 'hard' },
      { title: 'Stationary distribution of a 3-state chain', difficulty: 'medium' },
    ],
  },
  {
    name: 'Market Making & Microstructure',
    tracks: ['qt', 'quant-dev'],
    target: 3,
    primer: `How trading actually works: bid/ask spread as compensation for risk and adverse selection, inventory management, and the limit order book (price-time priority, market vs limit orders, queue position). Understand why a market maker quotes both sides and how they manage being "picked off" by informed flow.`,
    problems: [
      { title: 'Explain bid-ask spread & adverse selection', difficulty: 'medium' },
      { title: 'You’re a market maker holding inventory — how do you skew quotes?', difficulty: 'medium' },
      { title: 'Order book mechanics: what fills first and why?', difficulty: 'easy' },
    ],
  },

  // ─────────────────────────── Quant dev (systems-heavy) ───────────────────────────
  {
    name: 'Low-Latency C++',
    tracks: ['quant-dev'],
    target: 3,
    primer: `Where microseconds are money: cache-friendly data layout (arrays over pointer-chasing, false sharing), avoiding allocations on the hot path, move semantics, and knowing what the compiler does (inlining, branch prediction). Mechanical sympathy — writing code that respects how the hardware works — is the whole game.`,
    problems: [
      { title: 'Why is std::vector faster to iterate than std::list?', difficulty: 'medium' },
      { title: 'Eliminate allocations from a hot-path function', difficulty: 'hard' },
      { title: 'Explain false sharing and how to fix it', difficulty: 'medium' },
    ],
  },
  {
    name: 'Concurrency & Lock-Free',
    tracks: ['quant-dev'],
    target: 3,
    primer: `Correctness and speed under threads: data races, mutexes vs atomics, memory ordering (acquire/release), and lock-free structures like the SPSC ring buffer used to pass market data between threads without blocking. Know why a lock-free queue can beat a mutex — and why it's so easy to get wrong.`,
    problems: [
      { title: 'Implement a single-producer/single-consumer ring buffer', difficulty: 'hard' },
      { title: 'Mutex vs atomic vs lock-free: when each?', difficulty: 'medium' },
      { title: 'Explain acquire/release memory ordering', difficulty: 'hard' },
    ],
  },
  {
    name: 'Order Book Implementation',
    tracks: ['quant-dev'],
    target: 2,
    primer: `The canonical quant-dev build: a matching engine maintaining price levels with FIFO queues, supporting add/cancel/execute in the tightest possible time. Data-structure choice (sorted map of prices → intrusive lists, plus a hash for O(1) cancel by order id) is the crux.`,
    problems: [
      { title: 'Design data structures for a limit order book (add/cancel/match)', difficulty: 'hard' },
      { title: 'Make order cancellation O(1) — what indexing?', difficulty: 'medium' },
    ],
  },
  {
    name: 'Numerical & Floating Point',
    tracks: ['quant-dev'],
    target: 2,
    primer: `Money math without bugs: IEEE-754 representation error, why you never == floats, catastrophic cancellation, and when to use fixed-point/integers for prices. Also basic numerical methods (Newton's method, stable summation) that surface in pricing questions.`,
    problems: [
      { title: 'Why does 0.1 + 0.2 != 0.3? How to compare safely?', difficulty: 'easy' },
      { title: 'Represent prices without floating-point error', difficulty: 'medium' },
    ],
  },

  // ─────────────────────────── APM / Product ───────────────────────────
  {
    name: 'Product Sense & Design',
    tracks: ['apm'],
    target: 4,
    primer: `The heart of PM interviews: pick a user segment, find their sharpest unmet need, and design for it — then justify trade-offs. Use a structure (user → pain → solutions → prioritize → metrics). Great answers are specific about who and why, not feature lists.`,
    problems: [
      { title: 'Design a product for [elderly / commuters / students]', difficulty: 'medium' },
      { title: 'Improve [Google Maps / Spotify]: pick a user & pain', difficulty: 'medium' },
      { title: 'Your favorite product — why is it well designed?', difficulty: 'easy' },
      { title: 'Design a fridge for the blind', difficulty: 'medium' },
    ],
  },
  {
    name: 'Estimation & Market Sizing',
    tracks: ['apm'],
    target: 3,
    primer: `Fermi estimation under pressure: decompose a big number into knowable factors (population → % relevant → frequency → unit), state assumptions out loud, and sanity-check the magnitude. They're testing structured thinking, not the exact answer.`,
    problems: [
      { title: 'How many pizzas are sold in the US per day?', difficulty: 'easy' },
      { title: 'Estimate revenue of the App Store', difficulty: 'medium' },
      { title: 'How much storage does YouTube add per day?', difficulty: 'medium' },
    ],
  },
  {
    name: 'Metrics & Analytics',
    tracks: ['apm'],
    target: 3,
    primer: `Defining success and diagnosing change. Pick a North Star tied to real value, break it into input metrics (AARRR: acquisition, activation, retention, revenue, referral), guard against gaming with counter-metrics, and debug a metric drop with a structured funnel (is it real? which segment? which step?).`,
    problems: [
      { title: 'Pick the North Star metric for [WhatsApp / Uber]', difficulty: 'medium' },
      { title: 'DAU dropped 5% — how do you investigate?', difficulty: 'medium' },
      { title: 'Would you ship a feature that lifts revenue but hurts retention?', difficulty: 'hard' },
    ],
  },
  {
    name: 'Prioritization & Execution',
    tracks: ['apm'],
    target: 3,
    primer: `Turning ambiguity into a plan: frameworks (RICE, impact/effort) as a lens not a crutch, defining an MVP and a launch plan, handling trade-offs and disagreement, and root-causing execution problems. Show judgment about what to cut, not just what to build.`,
    problems: [
      { title: 'You have 3 features and one quarter — how do you prioritize?', difficulty: 'medium' },
      { title: 'A launch is slipping — how do you respond?', difficulty: 'medium' },
      { title: 'Define the MVP for [a new product idea]', difficulty: 'easy' },
    ],
  },
]
