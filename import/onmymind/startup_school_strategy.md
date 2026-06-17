# Startup School Strategy — Key Points

A condensed export of the strategic conversation. Organized by decision, not by chat order.

---

## The headline decision

**Build a local-first multimodal indexing CLI (`mmgrep`-shaped) as Shape A. Treat the inference proxy (Shape B) as the natural business expansion to reference in the YC pitch but not build yet.**

The convergence: your two interests — multimodal data infra and llama.cpp-tier inference hacking — are the same wedge from two angles. The shape is *a systems-level data + inference layer for teams doing multimodal AI at small scale*.

---

## Why this direction (vs everything else considered)

**Rejected:**
- *Vertical AI workforce slop* (most of YC W26 and a16z Speedrun 006). LLM wrappers with domain prompts, sold via founder networks, "cARR" theater. Most churn within 18 months.
- *"CodeRabbit but cheaper"*. No moat, no margin, no narrative. "Cheaper X" is the worst pre-seed position.
- *Prediction market / crypto infra*. Real opportunity (a16z just funded Kairos at $2.5M for a Kalshi/Polymarket terminal), but you don't want it gut-level — and Synthesis conflict-of-interest would have been the central question.
- *Foundational AI research, healthcare, bio, hardware*. Funded but inaccessible in a 1-2 month sprint without credentials/supply chains.
- *Agent skill registries*. Anthropic owns the registry layer. Specialist skills are projects, not companies.

**Chosen because:**
- Hits your systems brain (caching, embedding pipelines, SQLite-as-everything)
- Uses your llama.cpp/MLX/Parameter Golf-trained interest in inference optimization
- Demo is cinematic (the cache-hit moment lands with infra-minded people)
- Buyer is technical (developers, ML teams) so they can tell good from slop
- Ship-in-6-weeks-able
- Distribution is concrete (HN, r/LocalLLaMA, dev Discords)
- The YC framing writes itself: "I built a faster, local-first multimodal indexer because I needed it"

---

## The product, tangibly

**One-sentence pitch:** A local-first CLI that indexes folders of videos, images, and audio so you can grep across them in milliseconds — using llama.cpp/MLX under the hood, with aggressive caching so re-runs and re-queries are nearly free.

**30-second pitch:** "If you have a folder of 1,000 videos and you want to find every clip where someone says 'fourth quarter' or hands over a set of keys, your options today are: pay Pixeltable enterprise pricing, duct-tape FFmpeg + Whisper + a vector DB yourself, or upload everything to a cloud service. I'm building the Postgres-tier primitive for this — point it at a folder, get back queryable multimodal data in seconds, runs entirely on your laptop, free."

**The 90-second demo (this is what you show at Startup School):**
1. `mmgrep index ./videos/` — progress bar, "1,247 videos indexed in 4 minutes", GPU pegged.
2. `mmgrep "person handing over car keys"` — results stream back in under a second with timestamped thumbnails.
3. Re-run the same query: "47ms (cache hit)." New query on same corpus: "210ms — vision encodings cached, only the text embedding was new."

Beat 3 is the kicker. That's the moment infra-minded people lean in.

---

## V1 scope (4-5 weeks)

**In:**
- `index <path>` — recursive ingestion of video/image/audio
- Video: frame sampling, perceptual-hash dedup, parallel vision encoding, audio extraction + Whisper transcription
- Images: vision encoder pass
- Audio: Whisper + audio embeddings
- Single SQLite file with `sqlite-vec`. No daemon, no server.
- Content-hash caching — re-running is near-instant
- `query <text>` — joint search across video frames, images, transcripts
- Backend: MLX on Apple Silicon, llama.cpp/GGUF as fallback. CLIP or SigLIP for vision, Whisper for audio.

**Hard nos for V1:**
- No UI. Terminal only.
- No cloud. Local only.
- No fine-tuning. Off-the-shelf models only.
- No "agents" / chat interface.

---

## The non-obvious technical bets that make it defensible

1. **Perceptual hashing for frame dedup.** Naïve 1-FPS sampling on a 2-hour video = 7,200 frames, most near-identical. pHash/dHash collapses to ~200 distinct frames. 36x speedup before any model inference. Most people skip this.
2. **Content-addressable embedding cache.** SHA-256 (or pHash for near-dupes) keys the embedding. Same image across folders = one embedding. Re-index = zero work. This is the demo moment.
3. **Streaming index updates.** Watch the folder; new file → index it. No full re-runs.
4. **SQLite + sqlite-vec as the whole stack.** One file, copy anywhere, query from any language. Taste move that the right buyer recognizes.
5. **Async batched inference.** Saturate the GPU, expose progress.

---

## Week-by-week plan

- **Week 1 — Skeleton + ingestion.** CLI scaffold, FFmpeg + pHash dedup, Whisper, SQLite + sqlite-vec, query-against-transcripts baseline.
- **Week 2 — Vision pipeline.** MLX SigLIP integration, llama.cpp fallback, batched inference, content-hash embedding cache, visual search working on images.
- **Week 3 — Joint multimodal query.** Cross-modal ranking, terminal result rendering (kitty/iTerm graphics for thumbnails, timestamps, previews), watch mode, perf pass to hit demo numbers.
- **Week 4 — Polish + launch.** One-command install (brew/pip/cargo), README, screen recording, Show HN draft, 5-10 user conversations done.
- **Week 5 (buffer).** Onboard 3-5 real users, fix what they hit, collect "I would pay for X" signals → these become Shape B.

---

## Shape B — the business expansion (don't build yet, but pitch it)

> "People use mmgrep locally. They love the speed and the no-cloud thing. But they also have *some* workloads where they want to call OpenAI/Anthropic for the smartest model, or use cloud GPUs for huge batches. So we add a proxy mode: same CLI, same caching, same content-hashing — but it can transparently route to local or cloud, deduplicate identical inputs across both, and give you cost observability. The local tool becomes the client; the cloud becomes the optional accelerator."

The CLI is the wedge that brings people in and proves the chops. The proxy is what they pay for at scale.

Reference adjacency: Helicone, Portkey, OpenRouter — but those don't do multimodal well and don't do local fallback at all. Real wedge.

---

## Risks to plan for

1. **CLIP/SigLIP might not be good enough for the demo query.** "Person handing over car keys" is hard for off-the-shelf VLMs. Test in week 1 with a tiny corpus before committing.
2. **Competitors exist.** Pixeltable, Mixpeek, Twelve Labs, Voxel51, Unstructured.io. All enterprise-shaped. Your wedge is local-first, indie/small-team, CLI. Articulate the difference crisply.
3. **Corpus size matters.** Speed advantage is small with 50 videos, huge with 5,000. Find users with real archives.

---

## The single most important next step (this week)

**Not coding. Not architecture. Talk to 5 people who have folders of media they wish they could query.**

Ask: how do you handle this today? What hurts? What have you tried? The conversations will:
- Sharpen the demo query (what do they actually search for?)
- Validate corpus size assumptions
- Tell you whether "no cloud" matters or is just nice-to-have
- Give you 5 potential first users for week 4

Target the ML/dev crowd first — share your vocabulary, sharpest feedback, and they're who's at Startup School. Video creators and researchers come in week 3-4.

---

## Startup School tactical plan

Ranked by ROI:

1. **Apply to Project Demos AND Poster Sessions immediately.** Asymmetric move. Career fair = thousands of people; demo slot = founders and YC partners at full attention. `mmgrep` is the demo candidate.
2. **Email Ankit Gupta now, not the day before.** You have warm contact from the Michigan campus event. Frame it as a follow-up: you got the invite, you're coming, 10 minutes if his schedule allows.
3. **3-5 specific founder conversations from W@S.** When the list drops, pre-research it. Identify infra/devtools/data companies where you have domain overlap. Have a specific opening for each — Synthesis production-eng at 40k concurrent on Redis+Mongo is the detail small-infra founders care about.

---

## The meta-rules from this conversation

- **"Build something huge before YC" is the wrong framing.** YC funds working prototype + real user + clear thesis. Specific and credible beats huge.
- **Have the idea locked by day 3, execute the remaining ~55 days.** Sprints die in week-1-pivots.
- **Buyer recognition matters more than feature count.** A developer buyer can tell good infra from slop. Lean into that.
- **Founder-market fit is your unfair advantage when present.** "I'm a production engineer who deploys real systems at scale" is the credible opener — use it.
- **Talk to users before code, not after.** The cost of being wrong about what to build dwarfs feeling not-quite-ready in a conversation.

---

## Audience-specific impress moves (separate thread, keep for reference)

For the broader "how to impress" question — three rooms, three modes:

- **CS students:** depth and aesthetics. Local model doing something useful, live perf work (`perf`/flamegraph/samply), Verilog/FPGA hardware-software demos, weird-but-coherent personal site.
- **Synthesis coworkers:** seriousness. Read unfamiliar code fast, own the gnarly thing nobody wants, ship observability, write a calm precise postmortem, become the specialist in one tool.
- **Startup founders:** velocity, taste, judgment. Live product with real users (Magic Bot at 40k concurrent is the artifact), sharp opinion on a specific market, visible compounding numbers, weird-but-coherent side project, fast substantive replies.

The one move that works in all three rooms: be the person who calmly fixes the thing in front of the group in five minutes while explaining what they're doing. Can't manufacture the moment, can be ready for it.
