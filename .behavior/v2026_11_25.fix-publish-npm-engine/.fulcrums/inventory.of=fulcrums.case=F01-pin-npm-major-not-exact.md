# fulcrum F01: pin `npm@11`, not exact `npm@11.21.3`

## .the fork

- a) `npm install -g npm@11` — major range; patches within 11.x flow
- b) `npm install -g npm@11.21.3` — exact; `rule.require.pinned-versions` asks for exact pins

## .taken, why

a). the file is a declapract `cicd-package` best-practice with no `.declapract.ts` beside it, so the practice checks it by exact equality: upstream reads `npm@11`, so b) drifts from the practice and the next `declapract.upgrade` overwrites it. every 11.x shares the engine `^20.17.0 || >=22.9.0`, so the range carries no engine risk.

## .rework

clean — one token in one line.

## .confidence, why below 93%

b) would be stricter against an 11.x regression, and the repo rule leans that way. the call rests on a claim that conformance outweighs the rule for a ci tool install; a reviewer could weigh it the other way.

## .where

`.github/workflows/.publish-npm.yml`, the `verify oidc compat` step.

## .verdict

open.
