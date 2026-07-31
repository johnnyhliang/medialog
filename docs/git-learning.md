# Git, for the situations this repo actually gets into

**2026-07-30.** Written after a real tangle: two Claude sessions working in the
same directory, a `main` branch that appeared out of nowhere, 8 unpushed commits,
and a rebase that refused to finish. Everything below is a thing that actually
happened here, not a tutorial.

The one-line summary: **nothing committed is ever lost, and every scary state has
an abort.** The rest is learning to read what git is telling you.

---

## 1. "You're really behind" usually doesn't mean what it sounds like

```
## master...origin/master [ahead 8, behind 1]
```

**"Behind" does not mean your work is old.** It means *the remote has commits you
don't have* — in that case exactly one, a merge commit from a pull request. You
also had 8 it didn't. Both numbers non-zero is called **divergence**, and it is
completely normal when two sessions share a repo.

Read it before reacting:

```bash
git fetch origin                       # get the facts first, changes nothing
git status -sb                         # the ahead/behind line
git log --oneline origin/master..HEAD  # commits YOU have, they don't
git log --oneline HEAD..origin/master  # commits THEY have, you don't
```

Those last two are the ones that actually answer "what am I missing". The `..`
means "reachable from the right, not the left".

---

## 2. The normal push, when you've diverged

```bash
git pull --rebase origin master
git push origin master
```

**Rebase rather than merge while your work is unpushed.** Rebase replays your
commits on top of theirs, so history stays a straight line. A plain `git pull`
would create a merge bubble for no reason — merge commits are for combining
branches that both exist publicly, not for catching up.

Never rebase commits you have already pushed and someone else may have pulled.
Rewriting shared history is the one genuinely rude git operation.

---

## 3. Two sessions, one directory

This repo has parallel Claude sessions working in the **same working tree**. Two
consequences, both learned the hard way:

**Never `git add -A`.** It stages everything on disk, including the other
session's half-finished edits. That happened here: six unrelated files got swept
into a commit about the admin dashboard.

```bash
git add path/one.js path/two.js       # name the files, always
git status --short                    # confirm before committing
```

**The recovery, if you do it anyway** — the commit was local, so:

```bash
git reset --soft HEAD~1   # undo the commit, KEEP all changes staged
git reset                 # unstage everything
git add <only your files> # stage deliberately
git commit
```

`--soft` is the safe reset: it moves the branch pointer and touches nothing else.
`--hard` is the one that destroys work. If you only ever remember one thing about
`reset`, remember that `--soft` keeps your files and `--hard` does not.

---

## 4. When a rebase stops, read the FIRST error, not the last

The rebase here printed a wall of `hint:` lines ending in "It has been
rescheduled". The hints were noise. The actual error was four lines up:

```
error: The following untracked working tree files would be overwritten by merge:
	CLAUDE.md
```

**Git was protecting a file.** A commit wanted to create a tracked `CLAUDE.md`,
but an untracked one already sat on disk. Overwriting an untracked file is
unrecoverable — it exists in no history — so git refuses. That is a feature.

The fix is always the same shape: move it aside, continue, put it back.

```bash
cp CLAUDE.md /tmp/CLAUDE.md.bak   # never skip this step
rm CLAUDE.md
git rebase --continue
cp /tmp/CLAUDE.md.bak CLAUDE.md
md5sum CLAUDE.md                  # verify it came back identical
```

### Why `git rebase --skip` appeared to do nothing

Running `--skip` re-printed the *same* `pick` line every time. Reason:

- `--skip` skips a commit whose changes **already applied** (an empty patch)
- it cannot skip a command that **failed to execute at all**

The command was blocked by the untracked file, so git rescheduled it instead of
skipping it. **When you see the same line repeat after `--skip`, the blocker is
environmental — fix the working tree, don't keep skipping.**

---

## 5. The escape hatches

| Situation | Command | What it does |
|---|---|---|
| Rebase going badly | `git rebase --abort` | Returns to exactly where you started. Always safe. |
| Merge going badly | `git merge --abort` | Same. |
| "I lost a commit" | `git reflog` | Every state HEAD has been in, with hashes. Nothing committed is gone. |
| Undo last commit, keep work | `git reset --soft HEAD~1` | Branch pointer moves back, files untouched. |
| See what a commit touched | `git show --stat <hash>` | Files + line counts, no diff wall. |
| Is this commit already upstream? | `git merge-base --is-ancestor <hash> origin/master` | Exit 0 = yes. |

`git reflog` is the real safety net. If a rebase or reset ever loses something,
the old hash is in there, and `git checkout <hash>` gets it back.

---

## 6. Branch hygiene for this repo

**`master` is trunk.** A `main` branch appeared once via a PR and was a one-off;
it is not the trunk and should not become one without a deliberate decision
(GitHub's default-branch setting would need changing too).

Check whether a branch still holds anything before deleting it:

```bash
git rev-list --left-right --count master...some-branch
#   left  = commits master has that the branch doesn't
#   right = commits the branch has that master doesn't  ← the number that matters
```

**`right = 0` means fully merged and safe to delete.** Every stale branch in this
repo except `feat/editor-versioning` was 0 — and that one is superseded by better
work already on master, not lost.

If the upstream ever gets crossed (`master` tracking `origin/main`, which happened
here and caused a confusing push error):

```bash
git branch --set-upstream-to=origin/master master
```

---

## 7. Before pushing, in this repo specifically

```bash
npx vitest run     # 696 tests as of 2026-07-30
npm run build      # catches what tests don't
git status --short # nothing unexpected riding along
```

Worth it because a push here triggers a Vercel production deploy. The one time it
mattered, a rebase pulled in a commit literally titled "Possibly breaking
changes" — the tests passing was the only reason to trust it.

---

## 8. Commit hygiene (also in CLAUDE.md, repeated because it's the thing most often skipped)

- Finish a **unit of work** before committing. Not a timer, not a habit.
- Avoid back-to-back commits minutes apart — that's work sliced too thin.
- The message describes what's **in** the commit. Check `git status` before
  staging and add only what the message covers.
- Several unrelated things finished at once → several commits.
