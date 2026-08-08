#!/usr/bin/env node
// Run: SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-quant-plan.js
//
// Seeds Documents/quantdevplan.xlsx into MediaLog as real data, per
// docs/manager-scope.md §7. Founder account only — this is personal planning
// data, not a product feature.
//
// The mapping (§7):
//   Start Here / Timeline / Coursework / Sprint  → master_doc of "Quant Dev Plan"
//   Project                                      → "Order Book (C++)" topic
//   C++ Curriculum                               → "C++ Curriculum" topic
//   Resources                                    → entries in the relevant topic
//   Applications                                 → existing `applications` table
//   Weekly Habits                                → the contribution grid (§6, not
//                                                  built yet) — parked here as a
//                                                  plain list, deliberately NOT
//                                                  checkboxes so it stays out of
//                                                  the progress denominator.
//
// No new tables. Checkbox lines are the goals.js step format
// (`- [ ] text`, src/lib/goals.js parseSteps) so the Manager derives progress
// from these docs with no extra schema — that is the whole point of §2.
//
// Idempotent: topics are matched by name and left untouched if they exist;
// applications are matched by (company, role). Re-running adds nothing.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhxqgpgyxqnqvnqjvrrj.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
let USER_ID = process.env.CAPTURE_USER_ID || null

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var (Supabase Dashboard → Settings → API → service_role).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Quant Dev Plan ───────────────────────────────────────────────────────────
// started/target are the §8 time model: intent, not an alarm. goals.js compares
// elapsed time to checked steps and shows a quiet "behind" chip past 15%.

const PLAN_DOC = `---
started: 2026-08-01
target: 2027-10-31
---

Rising sophomore → junior-summer (2028) quant dev internships. 5–12 hrs/wk, variable.

**The two things that matter more than everything else**

1. **The project.** An order book / matching engine in C++, built over ~8 months,
   benchmarked with latency numbers you measured yourself. One deep project beats
   three shallow ones. → *Order Book (C++)*
2. **Summer 2027.** Nothing is locked in. Landing a SWE internship or research
   position for the summer after sophomore year is a **Fall 2026** task, not a
   Spring 2027 one.

## Timeline

- [ ] **Aug 2026** — pre-semester. Toolchain (g++/clang, CMake, gdb, perf), EMC++ Ch.1–2, Zetamac 10 min/day. *Deadline: fall schedule locked.*
- [ ] **Sep 2026** — coursework ramp + recruiting. C++ items 1–4, LeetCode easies 3/day, green book Ch.1–2. *Summer 2027 SWE applications OPEN — start applying.*
- [ ] **Oct 2026** — apply broadly; project scoping. Project Phase 0, C++ items 5–7. *Bulk of Summer 2027 apps submitted.*
- [ ] **Nov 2026** — Project Phase 1 (basic order book). LeetCode mediums start. C++ items 8–9. *SWE interviews likely landing.*
- [ ] **Dec 2026** — finals: floor only. Over break finish Phase 1, green book Ch.3. *Summer 2027 offer ideally in hand.*
- [ ] **Jan 2027** — EECS 370 and/or 482, the two most interview-relevant courses. Project Phase 2. C++ items 10–12 (concurrency).
- [ ] **Feb 2027** — concurrency depth. Phase 2 continues. Green book Ch.4.
- [ ] **Mar 2027** — benchmarking and measurement. Project Phase 3. C++ items 13–15.
- [ ] **Apr 2027** — finish project core before finals. Phase 3 wrap, README, the 10-minute explanation. *Project defensible end-to-end.*
- [ ] **May 2027** — sprint wk 1–3, foundations. Green book Ch.1–6 properly, Zetamac to 30+, C++ fundamentals drill.
- [ ] **Jun 2027** — sprint wk 4–7, depth. Timed OA practice — *this is the stage most people die at.* Start mock interviews; do not defer them.
- [ ] **Jul 2027** — sprint wk 8–10, interview simulation. 2–3 full mocks/week. Project Phase 4. *Resume final; every line defensible.*
- [ ] **Aug 2027** — sprint wk 11–12 + apply. Firm research, 3–5 real questions per firm. *APPLICATIONS OPEN — submit early, rolling.*
- [ ] **Sep 2027** — interview season. OAs and first rounds. Keep Zetamac/LeetCode warm. Sleep. *Superdays begin at some firms.*
- [ ] **Oct 2027** — close it out. Final rounds. Post-mortem every rejection; they repeat questions. *Most decisions land Oct–Dec.*

## Coursework — SUGS 3+1 constrained

- [ ] **EECS 281** Data Structures & Algos — soph fall. Critical, non-negotiable. Every LeetCode round assumes it.
- [ ] **EECS 370** Computer Architecture — soph spring. Critical. "Why is this loop slow" is an architecture question.
- [ ] **EECS 482** Operating Systems — soph spring or junior fall. Arguably the single most interview-relevant course, and the hardest. Plan the semester around it.
- [ ] **EECS 483** Compilers — junior/grad. Strong signal, counts toward SUGS.
- [ ] **EECS 570** Parallel Computer Arch (grad) — memory models, coherence, lock-free reasoning. Maps directly to HFT infra questions.
- [ ] **EECS 376** Foundations — required anyway. Do it well, do not over-invest.
- [ ] **EECS 573 / 578** systems electives (grad) — senior, if room. Pick by instructor, not topic.
- [ ] **EECS 484/485** Databases / Web Systems — optional breadth, not core.

**Cut, deliberately:** Math 217 (marginal gain is proof maturity, not content),
Stats 426 (load-bearing for the *researcher* track, not dev — EECS 301 + green
book Ch.1–6 covers what you'll be asked), EECS 545 (only if drifting to research).

*The principle:* before adding an undergrad math course, check whether a grad
course covers the same ground at more depth **and** counts toward the master's.
Under the 3+1 constraint that substitution is almost always the better trade.

## Sprint — 12 weeks, May–Aug 2027

Timed to **end** as applications open. Runs alongside the summer internship, so
it is deliberately lighter than a full-time cram.

- [ ] **Wk 1–3 Foundations** — green book Ch.1–6 every problem, Zetamac 10–15 min/day, LeetCode easies→mediums 3–5/day, HOTS brainteasers 5/day, C++ fundamentals drill. *Benchmark: Zetamac 30+, mediums under 30 min, green book solutions out loud without notes.*
- [ ] **Wk 4–7 Depth + OA prep** — green book 2nd pass, LC mediums/hards (DP, graphs, trees), systems design (order book, feed handler, matching engine), C++ grilling (vtables, cache, concurrency), **timed OA practice under real conditions**. *Benchmark: Zetamac 40, 70%+ of green book unhinted. START MOCKS.*
- [ ] **Wk 8–10 Interview simulation** — 2–3 full mocks/week end to end, Glassdoor review per firm, firm research (market making vs stat arb vs multi-strat), Project Phase 4. *Benchmark: Zetamac 45+, mediums under 20 min, resume fully defensible.*
- [ ] **Wk 11–12 Sharpen, do not cram** — firm engineering blogs and talks, 3–5 real questions per firm, know the resume cold, one mock/week, SLEEP. *Benchmark: applications submitted, sharp and rested on day one.*

*Two corrections to the original plan:* timed OA prep in weeks 4–7, because most
firms gate on a proctored test before a human ever sees you and that stage kills
more candidates than the interviews do; and applications go out in week 11–12,
not 6–7, because the cycle actually starts Aug 2027.

*On mocks:* worth roughly 10× solo practice once past fundamentals. You will feel
stupid the first few times — that is the entire point.

## Weekly habits — the floor you never drop

~4 hrs/wk. In a brutal week, do only this. Not checkboxes: this is a rhythm, and
it belongs in the contribution grid (manager-scope §6) once that exists, not in
the progress denominator.

| Habit | Cadence | Time |
|---|---|---|
| LeetCode | 5 days/wk | ~30 min — easies until fluent, then mediums. Blind 75 → Neetcode 150. Time yourself. |
| Zetamac | daily | 10 min — cheap, keeps arithmetic sharp. No score anxiety this year. |
| Green book | 2–3 problems/wk | ~45 min — actually do them. Reading solutions feels like learning and is not. |
| Project | whatever remains | 2–6 hrs — even 1 hr in a bad week keeps context loaded. |
| C++ curriculum | 1 item / 1–2 wks | ~1 hr — read + write code demonstrating it. |
| Reading | casual | HFT blogs, CppCon, exchange docs. Builds the vocabulary. |

## Load management

5–12 hrs/wk is a wide band and that is fine. The habits above are the floor;
Project and C++ absorb whatever is left. Do not skip weeks entirely — the habit
dying is worse than the hours lost.

**A caveat.** Executing this well improves the odds substantially and guarantees
nothing. Acceptance rates are low single digits and a real share of the outcome
is noise. Keep adjacent paths — big-tech SWE, HFT-adjacent infra, fintech —
genuinely open rather than as consolation.
`

const PROJECT_DOC = `---
started: 2026-10-01
target: 2027-07-31
---

C++ order book / matching engine, ~8 months. Each phase is a standalone win, so
an interrupted semester does not leave you with nothing.

- [ ] **Phase 0 — Scope** *(Oct 2026)*. Read how real exchanges match orders (price-time priority, order types). Write a 1-page design doc: data structures, why you chose them, what you are explicitly **not** building. → *Shows you design before you code; "why did you structure it that way" then has an answer.*
- [ ] **Phase 1 — Core book** *(Nov–Dec 2026)*. Limit order book with add / cancel / modify. Price levels with intrusive lists. Unit tested. Handles a replayed message stream correctly. → *Data structure judgment. "Why a map of price levels and not a heap" is a real interview exchange.*
- [ ] **Phase 2 — Matching engine** *(Jan–Feb 2027)*. Price-time priority matching. Market / limit / IOC / FOK. Trade output stream. Deterministic replay. → *Correctness under fiddly rules — the closest thing to the actual job.*
- [ ] **Phase 3 — Performance** *(Mar–Apr 2027)*. Benchmark harness. Latency percentiles p50/p99/p99.9, **not averages**. Then optimize: memory pooling, cache-friendly layout, branch reduction — recording before/after for each change. → *The differentiator. Most candidates have a working order book; few have measured numbers and a story about what made it faster.*
- [ ] **Phase 4 — Polish and story** *(Jul 2027)*. README with architecture diagram and benchmark table. Rehearse a 5-min and a 10-min walkthrough out loud. → *Explaining it well is worth as much as building it.*
- [ ] **Stretch, optional** — multi-threaded feed handler with an SPSC queue feeding the book, or an ITCH-like market data parser. Only after Phase 3 is genuinely done.

**The rule.** If you cannot talk for 10 minutes about the technical decisions and
why you made them, the project is not ready.

**Commit discipline.** Real commit history over months reads very differently
from one dump. Commit as you go.

**Do not** start a second project until this one hits Phase 3. Breadth here is a trap.
`

const CPP_DOC = `---
started: 2026-08-01
target: 2027-05-01
---

The part school will not teach you. Roughly in order, ~1 item per 1–2 weeks at a
low simmer. Each item = read **and** write code that demonstrates it.

- [ ] **RAII and object lifetime** — why RAII exists, the rule of 0/3/5, when each special member is generated. *(EMC++ / cppreference)*
- [ ] **Smart pointers** — unique vs shared vs weak, the cost of shared_ptr's control block, when a raw pointer is correct. *(EMC++ Ch.4)*
- [ ] **Move semantics and rvalue refs** — what std::move actually does (nothing; it casts). Perfect forwarding. Why moves silently become copies. *(EMC++ Ch.5)*
- [ ] **Copy elision / RVO** — why returning by value is usually free, and when it is not. *(cppreference)*
- [ ] **STL containers and their costs** — vector vs deque vs list vs unordered_map. Iterator invalidation. Why vector wins almost always. *(Effective STL)*
- [ ] **STL algorithms** — the ~20 you actually use. Prefer them to hand-rolled loops. *(cppreference)*
- [ ] **Templates basics** — function/class templates, type deduction, SFINAE conceptually, constexpr. *(EMC++ Ch.1)*
- [ ] **Virtual functions and vtables** — memory layout of a polymorphic object, cost of a virtual call, why HFT code often avoids them.
- [ ] **Undefined behavior** — signed overflow, strict aliasing, use-after-move, data races. Why UB makes code faster.
- [ ] **Threads and std::thread** — spawning, joining, why detached threads are usually a bug. *(EECS 482 + CCiA)*
- [ ] **Mutexes, condition variables, deadlock** — lock ordering, holding locks as briefly as possible. *(CCiA)*
- [ ] **std::atomic and memory ordering** — relaxed / acquire / release / seq_cst, what a barrier is. **The** quant dev topic. *(CCiA Ch.5 + Herb Sutter)*
- [ ] **Lock-free structures** — write an SPSC ring buffer. CAS and the ABA problem. *(write it yourself)*
- [ ] **Cache behavior and false sharing** — cache lines, alignas, struct layout, prefetching. Measure it, do not just read it. *(EECS 370 + Mechanical Sympathy)*
- [ ] **Benchmarking and profiling** — perf, Google Benchmark, why microbenchmarks lie. Percentiles, not averages.
- [ ] **Build systems and tooling** — CMake, sanitizers (ASan/TSan/UBSan), gdb. Non-glamorous, constantly used.

**Sequencing note.** Items 10–15 overlap heavily with EECS 482 and 370. Land them
in the same semester as those courses and you get the coursework and the
interview prep for close to the price of one.
`

const TOPICS = [
  {
    name: 'Quant Dev Plan',
    icon: 'Compass',
    master_doc: PLAN_DOC,
    entries: [
      { title: 'LeetCode — Blind 75, then Neetcode 150', url: 'https://neetcode.io/', note: 'Critical. The gate at literally every firm — non-negotiable for dev. Speed matters more than volume; time yourself.', status: 'active', pinned: true },
      { title: 'Green book — A Practical Guide to Quantitative Finance Interviews (Xinfeng Zhou)', url: 'https://quant-wiki.com/', note: 'High. Ch.1–6 is enough for dev; later chapters are researcher territory. 2–3 problems/wk across the year so the sprint is a second pass.', status: 'active' },
      { title: 'Heard on the Street (Crack)', url: 'https://quant-wiki.com/', note: 'Medium. Brainteasers, some nearly verbatim. Lower yield for dev than trader.', status: 'backlog' },
      { title: 'Zetamac', url: 'https://arithmetic.zetamac.com/', note: 'Low-medium. Mental math is a filter for dev, not a skills test. Clear ~30–40 and stop optimizing.', status: 'active' },
      { title: 'Jane Street monthly puzzles', url: 'https://www.janestreet.com/puzzles/', note: 'Low. Fun, builds intuition, genuinely optional for dev.', status: 'backlog' },
      { title: 'ISL — An Introduction to Statistical Learning', url: 'https://www.statlearning.com/', note: 'Skip for dev. Researcher track; only if interests shift.', status: 'backlog' },
    ],
  },
  {
    name: 'Order Book (C++)',
    icon: 'Layers',
    master_doc: PROJECT_DOC,
    entries: [
      { title: 'How exchanges match orders — price-time priority, order types', note: 'Phase 0 reading. Output is a 1-page design doc, not notes.', status: 'active', pinned: true },
      { title: 'Databento / Jane Street / Optiver engineering blogs', url: 'https://databento.com/blog', note: 'Market data structure and the vocabulary that makes you sound native.', status: 'backlog' },
      { title: 'Google Benchmark', url: 'https://github.com/google/benchmark', note: 'Phase 3. Percentiles, not averages — and know why microbenchmarks lie.', status: 'backlog' },
    ],
  },
  {
    name: 'C++ Curriculum',
    icon: 'Cpu',
    master_doc: CPP_DOC,
    entries: [
      { title: 'Effective Modern C++ (Scott Meyers)', note: 'Critical. The C++ fluency coursework will not give you. Items 1–30 are the interview core.', status: 'active', pinned: true },
      { title: 'C++ Concurrency in Action (Williams)', note: 'Critical. Threads, atomics, memory ordering — the topic that separates quant dev from generic SWE.', status: 'backlog' },
      { title: 'Effective STL (Meyers)', note: 'Container and algorithm costs. Pairs with curriculum items 5–6.', status: 'backlog' },
      { title: 'CppCon talks — Sutter, Carruth, Acton', url: 'https://www.youtube.com/@CppCon', note: 'High. Free, deep, and the source of most "how does this actually work" intuition.', status: 'active' },
      { title: 'cppreference.com', url: 'https://en.cppreference.com/', note: 'Medium, constant. Reading it fluently is a skill in itself.', status: 'backlog' },
      { title: 'Mechanical Sympathy — cache behavior and false sharing', url: 'https://mechanical-sympathy.blogspot.com/', note: 'Curriculum item 14. Measure it, do not just read it.', status: 'backlog' },
    ],
  },
]

// ── Applications ─────────────────────────────────────────────────────────────
// Into the existing `applications` table (migration 0013, owner-scoped by 0044).
// No `deadline` is set: "app opens ~Aug 2027" is a rolling window, and turning it
// into a date field would be exactly the alarm manager-scope §8 rules out. It
// lives in the note instead.

const ROLE = 'Quant Developer Intern — Summer 2028'

const APPLICATIONS = [
  ['Jane Street', 'Reach', 'Market maker', 'Strong — OCaml shop but hires generalist devs', 'Aug 2027'],
  ['Citadel Securities', 'Reach', 'Market maker', 'Very strong — large C++ engineering org', 'Aug 2027'],
  ['Hudson River Trading', 'Reach', 'HFT', 'Very strong — core C++ / low latency', 'Aug 2027'],
  ['Two Sigma', 'Reach', 'Multi-strat', 'Strong — more general SWE flavor', 'Aug 2027'],
  ['SIG', 'Target', 'Market maker', 'Strong dev pipeline, large intern class', 'Jul–Aug 2027'],
  ['Optiver', 'Target', 'Market maker', 'Very strong C++ / low latency focus', 'Aug 2027'],
  ['IMC Trading', 'Target', 'Market maker', 'Strong — explicit quant dev track', 'Aug 2027'],
  ['DRW', 'Target', 'Multi-strat', 'Strong engineering org', 'Aug 2027'],
  ['Jump Trading', 'Target', 'HFT', 'Very strong low-latency C++', 'Aug 2027'],
  ['Akuna Capital', 'Target', 'Market maker', 'Strong, dev-friendly, good intern program', 'Jul 2027'],
  ['Flow Traders', 'Target', 'Market maker', 'Good fit, smaller US presence', 'Aug 2027'],
  ['Five Rings', 'Target', 'Market maker', 'Small class, strong comp', 'Aug 2027'],
  ['Belvedere / Peak6 / XTX', 'Safety-ish', 'Various', 'Less competitive, real experience, good stepping stones', 'Varies'],
  ['Big tech SWE (backup)', 'Parallel', 'SWE', 'Apply in parallel. A strong SWE internship keeps quant open for full-time.', 'Aug–Sep 2027'],
]

async function resolveUserId() {
  if (USER_ID) return USER_ID
  const { data, error } = await supabase.from('topics').select('user_id').limit(1)
  if (error) throw new Error(`Could not read topics: ${error.message}`)
  if (!data?.length) {
    throw new Error('No existing topics to infer your user_id from. Set CAPTURE_USER_ID (your Supabase auth user UUID).')
  }
  return data[0].user_id
}

async function seedTopic(topic) {
  const { data: existing, error: findErr } = await supabase
    .from('topics').select('id').eq('user_id', USER_ID).eq('name', topic.name).limit(1)
  if (findErr) throw new Error(`Look up topic "${topic.name}": ${findErr.message}`)
  if (existing?.length) {
    console.log(`• ${topic.name} — already exists, left untouched.`)
    return
  }

  const { data, error } = await supabase
    .from('topics')
    .insert({ user_id: USER_ID, name: topic.name, icon: topic.icon, master_doc: topic.master_doc })
    .select('id')
    .single()
  if (error) throw new Error(`Create topic "${topic.name}": ${error.message}`)

  const rows = topic.entries.map((e) => ({
    user_id: USER_ID,
    topic_id: data.id,
    title: e.title,
    url: e.url ?? null,
    note: e.note ?? '',
    status: e.status,
    pinned: e.pinned ?? false,
  }))
  const { error: entErr } = await supabase.from('entries').insert(rows)
  if (entErr) throw new Error(`Seed entries for "${topic.name}": ${entErr.message}`)

  const steps = (topic.master_doc.match(/^\s*[-*]\s+\[ \]/gm) || []).length
  console.log(`• ${topic.name} — created. ${steps} plan steps, ${rows.length} entries.`)
}

async function seedApplications() {
  const { data: existing, error } = await supabase
    .from('applications').select('company').eq('user_id', USER_ID).eq('role', ROLE)
  if (error) throw new Error(`Read applications: ${error.message}`)
  const have = new Set((existing ?? []).map((a) => a.company))

  const rows = APPLICATIONS
    .filter(([company]) => !have.has(company))
    .map(([company, tier, type, fit, opens]) => ({
      user_id: USER_ID,
      company,
      role: ROLE,
      status: 'saved',
      notes: `${tier} · ${type}. ${fit} Opens ~${opens}.`,
    }))

  if (!rows.length) {
    console.log('• Applications — all 14 already tracked, nothing added.')
    return
  }
  const { error: insErr } = await supabase.from('applications').insert(rows)
  if (insErr) throw new Error(`Seed applications: ${insErr.message}`)
  console.log(`• Applications — ${rows.length} firms added as 'saved'.`)
}

async function main() {
  USER_ID = await resolveUserId()
  console.log(`Seeding the quant dev plan for user ${USER_ID}\n`)
  for (const topic of TOPICS) await seedTopic(topic)
  await seedApplications()
  console.log(`
Done. The spreadsheet is now MediaLog data:
  • Manager  — three cards with progress derived from the plan checkboxes
  • Career   — 14 firms in the pipeline, none applied yet
  • Weekly habits are in the plan doc as a table, waiting on the grid (§6).

Nothing was overwritten. Existing topics of the same name were skipped entirely.`)
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1) })
