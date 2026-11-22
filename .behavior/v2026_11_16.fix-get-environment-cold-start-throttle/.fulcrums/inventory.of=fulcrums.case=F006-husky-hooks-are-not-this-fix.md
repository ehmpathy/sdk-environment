# F006 — the husky hooks in the tree are not this fix

## .the fork
- a) leave `.husky/check.secrets.sh`, `check.timestamps.sh`, `check.timestamps.lock.sh` (untracked) and the `.husky/pre-commit` edit out of this fix; stage only this fix's files at the window (taken)
- b) test, snapshot, or refactor those hooks here

## .taken, why
a). `git status -- .husky` shows them untracked or modified before this route began; no stone of this route wrote them. the review lanes see them only because `since-main` reads the whole tree, staged or not. the wish scope is the cold-start throttle (#17). b) would smuggle an unrelated change into this pr.

the one real collision: the timestamp hook would block a commit of route docs that hold clock times. the docs this route authored now write times as `HHMMZ`. route files this route does not author still hold clock times (`0.wish.md`, the route engine's `approvals.jsonl` iso `at`, reviewer reports). whoever owns the hook must settle that with the route engine; it is flagged to the human.

## .rework, why
clean: hooks stay untouched.

## .confidence, why low
90%.

## .where
`.husky/`

## .verdict
awaits council; flagged to the human.
