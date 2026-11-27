# fulcrum F05: the pre-merge proof ships as a permanent pr-ci clamp, not a one-time check

## .the fork

the vision's pre-merge proof is one run of the workflow's npm upgrade step on the `.nvmrc` node, in 5.3. the wish is `size: nano`. the `enroll-impl-behavior-intent` lane notes the route grew a skill, an integration test, and snapshots that run in every pr's ci, with no recorded choice.

- a) a one-time proof: run the step by hand in 5.3, cite the output in the pr, ship only the two-line pin
- b) a clamp: ship `verify.publish-npm-pin` plus its integration test, so pr ci runs the step on every pr

## .taken, why

b). the defect class is "a line that only a tag runs, so no pr can catch it". a one-time proof catches today's instance and none of its kin:

- a future pr that puts back `npm@latest` goes green and breaks the next tag, as v0.1.6 did
- a future npm 11.x that raises its engine floor (`case=2`) meets the tag first, not a pr

`rule.require.clamp-edge-cases` asks a defect fix to carry a regression test that fails before the fix and passes after. case1 is that test: with `npm@latest` put back it goes 3 of 3 red, and with `npm@11` green. the clamp is the test; the skill is what lets the test run the shipped line rather than a copy.

the cost stays off the critical path: case1 and case4 hit the registry; every other verdict runs offline on a local `file:` npm. the publish chain already needs the registry (`pnpm install`, `npm publish`), so the clamp adds no new outside dependency to the tag.

## .rework

clean. to revert to (a), delete the skill, its test, and its snapshot. the workflow pin does not depend on them.

## .confidence

88%. the wish says nano, and the vision's pros list "no test change". the vision was written before the clamp rule was weighed against it.

## .where

`.agent/repo=.this/role=any/skills/verify.publish-npm-pin.sh` · `…integration.test.ts` · `1.vision.yield.md` pros · `0.wish.md` `size: nano`.

## .verdict

open — for the council.
