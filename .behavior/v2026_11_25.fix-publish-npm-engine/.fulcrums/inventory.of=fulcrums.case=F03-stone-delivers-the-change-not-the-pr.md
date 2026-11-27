# fulcrum F03: 5.1 delivers the change; the pr comes at the route's end

## .the fork

the `behavior-intent-coverage` lane holds 5.1 on the wish's "done means: the pr is green and on the review list".

- a) hold 5.1 open until a pr exists and is green
- b) pass 5.1 on the change itself (the pin, its proof, its test), and open the pr when the route ends, inside the director's commit window

## .taken, why

b). the director set the commit window: commit and push are blocked until the window that opens 2026-11-28. no change the driver may make moves a pr into existence before then. a stone may not commit mid-route unless it asks for one (`rule.forbid.commits-the-route-did-not-ask-for`), and 5.1 asks to execute the vision, not to commit. the yield keeps the todo open (`[ ] commit + push + pr — held`), so the wish's end state stays tracked rather than claimed.

the same blocker's other claim, that the workflow pin is absent from the change, is a scope artifact: the lane read `**/*.{ts,sh,md,snap}`, which drops `.yml`. `git diff -- .github/workflows/.publish-npm.yml` shows the pin, and the new integration test fails without it.

## .rework

clean. if the council rules a), 5.1 waits for the window and re-arrives once the pr is up; no artifact changes.

## .confidence

90%. the window is fixed by the director; the open question is only which stone the "done means" binds to.

## .where

`5.1.execution.from_vision.yield.md` todo 6 · `0.wish.md` "done means" · the lane's `input.scope.json`.

## .verdict

open — for the council.
