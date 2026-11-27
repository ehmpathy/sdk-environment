# fulcrum F08: the clamp's journey test stays at the integration tier, not acceptance

## .the fork

`ergo-acceptance-journey-coverage` (5.3, i001, blocker.3) reads `rule.require.acceptance-journey-coverage` as owed a `verify.publish-npm-pin.acceptance.test.ts`, since the skill is a cli in the diff.

- a) rename or copy the test to `.acceptance.test.ts`, so it runs in the acceptance shard
- b) keep it as `.integration.test.ts`, the tier this repo runs its dev-tool and i/o-bound tests in

## .taken, why

b). the rule's subject is a **user-faced** contract (its `.what`: "acceptance test coverage on user-faced contracts"). this skill faces no user of the package:

- `package.json` `files` ships `/dist` and `/bin` alone, so `.agent/repo=.this/role=any/skills/verify.publish-npm-pin.sh` never reaches a consumer
- this repo's acceptance tier tests what it ships: `blackbox/cli/get-commit.acceptance.test.ts` drives the published bin, and `src/getEnvironment*.acceptance.test.ts` drive the sdk contract
- the integration test already holds every property the rule asks of a journey test. it spawns the skill as a caller would (`spawnSync('bash', [SKILL_PATH, ...args])`), in given/when/then. it snaps the positive, negative, and edge paths. it makes real registry calls: case1 (success), case14 (ETARGET), and case15 (EBADENGINE)

a rename would change no assertion. it would move the clamp into `jest.acceptance.env.ts`, whose strict keyrack source stops locally on a key no test reads (`blocker/5.3.verification.md`). a maintainer could then no longer run the clamp on their own host.

## .rework

clean. `rhx mvsafe` the test and its snapshot to `.acceptance.test.ts`. no other file reads the name.

## .confidence

85%. the rule's examples name a cli "command" with no ship qualifier, so a stricter read that covers every cli in a diff is defensible.

## .where

`.agent/repo=.this/role=any/skills/verify.publish-npm-pin.integration.test.ts` · `package.json:25-27` · `blackbox/cli/get-commit.acceptance.test.ts` · `jest.acceptance.env.ts:46-48`.

## .verdict

open — for the council.
