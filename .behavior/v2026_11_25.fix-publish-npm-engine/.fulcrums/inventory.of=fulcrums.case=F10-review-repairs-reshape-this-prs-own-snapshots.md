# fulcrum F10: review repairs reshape this pr's own new snapshots in place

## .the fork

`enroll-verif-test-intent` (5.3, i004) diffs against `HEAD` (`2a5dfee`, the pr's own first push) and reads each snapshot change since as a locked criterion changed: case8, case5, case6 t0 and case7 t11, the mascot line, and case10's setup.

- a) revert each change, and keep the `HEAD` snapshots
- b) keep each change: the lock this rule guards is the one on `origin/main`, and each change carries its behavioral reason

## .taken, why

b).

- the rule guards **extant** tests: "they should only increase coverage for their new behaviors". `git diff --stat origin/main...HEAD -- .agent/repo=.this/role=any/skills/` shows the skill, its test, and its snapshot all added (`1386 insertions(+)`, no deletion). no test on main holds any of these lines
- each change is a defect repair a peer reviewer of this same stone asked for, which is the rule's own "acceptable — bug fix" row, never a fit to broken output:
  - case8: a bare `npm error` line drew an empty branch (`ergo-snapshot-visual-blemishes` i001 blocker.1)
  - case7 t11: the error quoted `'${{'`, half an expression (`enroll-verif-snapshot-blemishes` i003 blocker.1)
  - case5: `--help` printed raw `#` marks and no inputs block (same lane, i003 nitpick.3; `rule.require.help-on-demand`)
  - case6 t0: the fix line named one flag of two (5.3 i001 review)
  - the mascot line: errors opened with no vibe line, unlike every success (`howto.write.skills-stdout`)
  - case10: its verdict flipped on a host whose own npm is >= 11.5.1 (`enroll-verif-snapshot-coverage` i003 nitpick.2)
- no assertion loosened: each `toContain` moved to the new text, and several grew (case6 t0, t1; case16 t0, t2)
- the yield's `snapshot change rationalization` table names each change and its reason, which is the "document why in the PR" the rule's `.note` asks

## .rework

clean. revert the skill hunks and `--resnap`; no caller reads these lines.

## .confidence

90%. a reader who counts the first push as a lock may still want each change approved by a human at the pr.

## .where

`.agent/repo=.this/role=any/skills/verify.publish-npm-pin.sh` · `.agent/repo=.this/role=any/skills/verify.publish-npm-pin.integration.test.ts` · its `.snap` · `5.3.verification.yield.md` (`snapshot change rationalization`).

## .verdict

open — for the council.
