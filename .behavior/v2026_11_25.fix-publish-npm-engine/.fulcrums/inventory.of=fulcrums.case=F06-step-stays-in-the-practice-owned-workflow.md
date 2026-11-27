# fulcrum F06: the npm upgrade step stays inline in the practice-owned workflow

## .the fork

the `enroll-impl-arch-defects` lane asks to move the upgrade step into one shared file that both the workflow and the skill call, and to drop the step's "upgrade only if npm < 11.5.1" guard.

- a) move the step into a shared file under `.github/`, drop the guard, and have the skill call that file
- b) keep the step inline as the `cicd-package` practice ships it; the skill reads the line from the workflow and mirrors the guard
- c) keep the step inline; the skill extracts the `verify oidc compat` step's `run:` block from the yaml and runs it verbatim under a temp `NPM_CONFIG_PREFIX` (raised by the same lane at i006)

## .taken, why

b). `.publish-npm.yml` comes from the `cicd-package` practice in `declapract-typescript-ehmpathy`, and the fix matches it word for word on the changed lines. (a) would make this repo drift from the practice, and the next `declapract.upgrade` would write the practice's version back over the shared-file call. the skill reads the line from the workflow and mirrors its guard (case11), so the code path it proves is the one that ships. a shared-file shape, if wanted, belongs upstream: the reseed dream `v2026_11_25.reseed.publish-npm-engine-check-in-pr-ci`.

b) over c): (c) trades a one-line `sed` spec read and a five-line guard mirror for a yaml block-scalar parse keyed on a step name, which is a larger decode surface that breaks on a step rename or a reindent. the block's own output is a bare `npm install` exit, so the skill would still re-read npm's error code to sort an engine fault (exit 2) from a network fault (exit 1), and still check the installed version against the floor. the parts (c) would drop are the smallest parts of the skill; the parts it keeps are the verdicts. (b) still proves the shipped path: the spec is the workflow's own literal, the guard branch is mirrored and held by case11, and case1 goes red on `npm@latest`.

## .rework

clean. (a) is a new file, a two-line workflow edit, and a skill edit; (c) is a skill edit and a fixture change; no caller depends on the current shape.

## .confidence

87%. the drift cost of (a) depends on how often `declapract.upgrade` runs here; it ran for this very fix's upstream line. (c) is a closer call: it removes a mirror at the cost of a parse, and a reader who weighs the mirror's drift risk above the parse's fragility could rule for it.

## .where

`.github/workflows/.publish-npm.yml:46-55` · `.agent/repo=.this/role=any/skills/verify.publish-npm-pin.sh`.

## .verdict

open — for the council.
