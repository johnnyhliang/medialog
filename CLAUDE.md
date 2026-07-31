# MediaLog — Working Rules

## Commit hygiene

Do substantial work before staging a commit. A commit should represent one
complete, coherent unit of work — not a snapshot of whatever happens to be on
disk at a convenient moment.

- **Don't commit on a timer or out of habit.** Finish the actual unit of work
  (a feature, a fix, a doc pass) before committing it, even if that means a
  longer gap between commits.
- **Avoid back-to-back commits in a short window** (multiple commits within
  minutes of each other). That's a sign work is being sliced too thin, not
  that progress is being tracked well. If you find yourself about to commit
  again shortly after the last one, prefer folding the new change into a
  follow-up commit once there's more to say, not committing immediately.
- **A commit message should describe what it actually contains.** Don't let
  unrelated in-progress files ride along under an unrelated message — check
  `git status` before staging and only add what the message describes.
- **Multiple unrelated features finished around the same time → multiple
  commits**, not one commit with a message that only covers one of them.

This applies whether committing is happening interactively or as part of
autonomous/background work in this repo.
