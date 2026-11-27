# fulcrum F07: worktree edits that predate the route stay out of this pr, and in the worktree

## .the fork

the worktree holds edits made before this route: rhachet role bumps (`package.json`, `pnpm-lock.yaml`), `.gitattributes`, `bin/run.bun.sdk-environment.bc`, the deletion of `.claude/settings.json`, 15 old-route peer-review deletions, and a staged trash `.gitignore` deletion. the `enroll-impl-arch-defects` lane asks for a revert or a split.

- a) revert them in the worktree
- b) leave them in the worktree, and commit only this route's named paths
- c) commit them in a separate commit on this branch

## .taken, why

b). they are not this route's work, and their owner is unknown to the route. a revert would destroy edits a human or another session may want; a separate commit would ship them in this pr under a deadline. a commit of named paths, after `git restore --staged` of the prior deletion and a `git diff --cached --stat` check, keeps the pr to the fix, the clamp, and the route.

## .the one exception, at the commit

the staged trash `.gitignore` deletion rides in the commit. no paved tool unstages it: `git restore --staged` and `git reset` are unpaved, `git.commit.set` commits the whole index, and `git.stage.add` cannot re-add the file, since `.agent/.cache` is gitignored. it is harmless, because its parent is ignored, so the deletion changes no tracked behavior. the pr body names it.

## .rework

clean. every other prior edit stays in the worktree. the trash `.gitignore` comes back with one force-add commit (`git add -f`), if wanted.

## .confidence

93%.

## .where

`5.1.execution.from_vision.yield.md` `## out of scope, recorded`.

## .verdict

open — for the council.
