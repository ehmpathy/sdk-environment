# F20 — the `.claude` actor migration is held out of the upgrade bump

## .the fork
- a) the rhachet 1.51 bump rides in #18, but its `.claude` migration stays out: the deletion of `.claude/settings.json`, the `.claude` symlink, and `.agent/.actors/` (taken)
- b) the whole migration rides with the bump
- c) the migration rides, with the home-path line hand-edited out of `settings.of.repo.json`

## .taken, why
a). `settings.of.repo.json` pins `/home/camper/.claude/CLAUDE.md`, a box-local path in a file the actor `.gitignore` tracks (dream `v2026_11_20.reseed.rhachet-settings-of-repo-box-path`). the deletion of `.claude/settings.json` and its replacement are one unit: commit the deletion without the replacement, and every clone loses its hooks. c) hand-edits a generated file, which the next `rhachet init` reverts.

## .rework, why
clean: stage the `.claude` symlink, the `.claude/settings.json` deletion, and `.agent/.actors/` in one commit, once rhachet writes a host-free path (or now, if the leak is judged acceptable).

## .confidence, why low
75%. the bump was ruled to ride whole; this splits one part off on a single line.

## .where
`.agent/.actors/actor.via.repo=ambient/brain/.claude/settings.of.repo.json`, `claudeMdExcludes`

## .verdict
ruled 2026-11-20 by the director: a). the `.claude` migration stays out of #18. it pins a box-local home path, so it leaks a username and is wrong on any other box. the cure belongs upstream, via the reseed dream to ehmpathy/rhachet.
