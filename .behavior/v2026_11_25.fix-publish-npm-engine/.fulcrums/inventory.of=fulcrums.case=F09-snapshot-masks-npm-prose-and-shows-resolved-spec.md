# fulcrum F09: the snapshot folds npm's prose tail, and the header shows the resolved spec

## .the fork

`enroll-verif-snapshot-blemishes` (5.3, i003, nitpick.1 and nitpick.2) asks for two snapshot shapes to change:

- case8 shows `npm error <npm prose, 5 lines>` where a maintainer sees five real lines
  - a) snap the five lines literal
  - b) keep the fold: the code line literal, the prose masked and counted
- case1 runs with no flags yet its header reads `--spec 11`; case11 prints a `step:` line for a step the tag skips
  - a) print only the flags passed, and drop the `step:` line on a skip
  - b) keep the resolved spec and the `step:` line
- i003 again (nitpick.1, nitpick.3): case16 t0 and t2 print the `step:` line for a fault before the install; `--help` prints `.what` / `.why` labels and no `🐚` root
  - a) gate the `step:` line on the install path, and recast `--help` as a tree
  - b) keep both

## .taken, why

b) for each.

- npm's advice prose varies by npm release, so a literal snapshot flips on any `.nvmrc` bump and teaches a reader to re-snap blind. the code line (`npm error code ECONNREFUSED`) carries the verdict and stays literal
- the artifact header shows the inputs after defaults (`howto.write.skills-stdout`), so a no-flag run names the spec it read from the workflow
- on a skip, the `step:` line names the step the verdict is about; without it the skip names no step
- on a host fault before the install, the `step:` line names the step the run was about to take; the `💥` line below it says the fault came first
- `--help` prints the file's own header, so it cannot drift from the contract the file declares; `.what` / `.why` are that header's labels across this repo's skills, and `options:` lists each flag's sense and default where `usage:` shows calls

## .rework

clean. drop the `<npm prose>` mask and the fold in the test; or print `--spec` only when passed, and gate the `step:` echo on the install path. no caller reads either line.

## .confidence

88%. a reader who runs the skill sees the five lines, so the fold trades their view in the snapshot for a host-proof snapshot.

## .where

`.agent/repo=.this/role=any/skills/verify.publish-npm-pin.integration.test.ts` (`asSnapshotUnfolded`, `asNpmProseRunsFolded`) · `.agent/repo=.this/role=any/skills/verify.publish-npm-pin.sh` (`emit_header`).

## .verdict

open — for the council.
