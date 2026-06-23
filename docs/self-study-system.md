# Self-study in MediaLog

How to use MediaLog to stay sharp and learn a field — **without** turning it into
a course-manager, a second Obsidian, or a backlog you escape from. The whole point
of the app is flat topics + low-friction capture. This guide adds *conventions*,
not schema. If a convention ever feels like homework, drop it.

> **Separate from school.** Lecture slides and homework notes stay on the iPad.
> MediaLog is self-study: things to remember, read, reference, and practice.

## The three jobs, kept distinct

Don't model "everything" with one structure. There are three different jobs, and
each is just a **topic** with a different habit attached. Pick an icon so you can
tell them apart at a glance (the icon picker is on each topic card).

| Topic kind | Icon | What lives here | The habit |
|---|---|---|---|
| **Study** (e.g. `Systems`) | `Cpu` | One resource in flight + its takeaways + a small backlog | One thing `active` at a time; log a takeaway when done |
| **Build** (`Projects`) | `Code` | Project references, links, work done | Ship, don't collect; output is the point |
| **Parking** (`Hobbies`) | `Gamepad2` | Interesting-but-distracting stuff | Park it, get back to work; time-box it |

That's the only "taxonomy." No tag system to maintain — the topic *is* the
distinction. Tags stay optional and self-managing (`#book`, `#video`, `#done`).

## The study loop (the important one)

The failure mode you're designing against: starting five resources, hitting
friction, drifting to something cheaper. The fixes are constraints, not features.

1. **One spine, one `active`.** Only ever keep **one** entry in `active` status.
   Everything else is `backlog`. The constraint is what stops the resource-hopping.
2. **Lab-first / problem-first.** For deep books (CSAPP, etc.), the exercises are
   the resource and the chapters are reference. Read only what a problem forces.
   A problem with a win condition gives the pull that passive reading never does.
3. **Capture the curiosity, not the artifact.** A long video that's interesting
   but boring to watch? Save the *question* it provoked as a one-line note, not the
   link. Satisfy it in 3 minutes of reading, or watch on purpose if the itch survives.
4. **Each finish = one `done` entry** with a one-line takeaway. `done` entries drop
   out of the main list and roll into the topic's archive — so your "what I've
   studied" record accumulates as a byproduct. No separate tracker.
5. **Next-action pointer lives in the topic's master doc.** At the top of the
   Study topic's **Doc** view, keep:

   ```
   ## Active: CSAPP — lab-first
   Next: Cache Lab — implement the LRU sim
   ```

   When you sit down, the decision of where to start is already made and waiting —
   you don't spend willpower re-deciding. That's the whole "borrow what makes a
   guitar easy to pick up" move.

## The Focus widget

The home screen now shows a **Focus** card (top of the right-hand widget panel).
It reads your single `active` resource and pulls the `Next:` line out of that
topic's master doc, so opening the app hands you a *move* instead of a backlog —
that's the thing that competes with the scroll reflex at the moment of the urge.

- Source: the most recent **pinned + `active`** entry (`src/components/widgets/FocusWidget.jsx`).
- Click the card → jumps to that entry in its topic.
- Keep exactly one entry `active` and the widget stays meaningful. Two active
  resources = you've broken the one-spine rule; the widget will nudge you by only
  showing one.

## Getting set up

Run the seed script once to create the three topics with real starter content
(Systems/CSAPP active + lab-first doc + backlog, a Projects topic, a Hobbies
parking lot). It's idempotent — existing topics are left alone.

```sh
SUPABASE_SERVICE_ROLE_KEY=<service_role key> node scripts/seed-study-setup.js
```

Then edit to taste: swap CSAPP for your real spine, fix the `Next:` line, delete
the sample entries you don't want.

## Where SRS / spaced repetition fits

It doesn't live here — on purpose. MediaLog is the capture + reference + record
layer. True flashcard drilling is a different tool (Anki/RemNote). Don't reach for
it until you've got a body of concepts you've noticed yourself forgetting; it
solves a retention problem you don't have on day one. When you do, feed it from
your `done` takeaways.

## Deliberately not built (yet)

Captured so it's out of your head, not so it gets built:

- A topic "kind" column / filter. Naming + icon convention covers it without schema.
- A dedicated spaced-repetition mode. External tool until proven necessary.
- A multi-resource progress dashboard. The one-`active` rule makes it pointless.

Add any of these only when using the plain version makes the need obvious. Building
them pre-emptively is the productive-procrastination trap this whole system exists
to avoid.
