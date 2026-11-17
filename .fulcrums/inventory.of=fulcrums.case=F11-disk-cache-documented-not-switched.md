# F11 — the disk cache is documented, with no off switch added

## .the fork
- a) document the disk cache in the readme: where it lives, its ttl, that `cache: 'skip'` skips only the in-process cache, how to bust it (delete the dir), and the stubbed-send hazard (taken)
- b) add an off switch: an env var (e.g. `SDK_ENVIRONMENT_CACHE=skip`) or thread `cache: 'skip'` down to the parser
- c) both

## .taken, why
a). the wish asks for the smallest change that meets done. b) adds a public contract (a new env var, or a parser input that F4 left as main has it), which is a design call for the commander, not a defect fix. the hazard b) guards is narrow: a consumer test that stubs `AccountClient.send` while it holds REAL credentials. a full module mock also stubs `config.credentials`, which then throws a credential error and returns null before any write. the readme names the hazard and its remedy.

## .rework, why
clean: one env read in `getEnvAccessFromAwsAccountName` that returns the direct fetch; no caller changes.

## .confidence, why low
75%. a reviewer judged the stubbed-send case plausible; if the commander rates a wrong tier for 15 minutes as unacceptable, b) is owed.

## .where
`readme.md` (fromAwsAccountName section); `src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.ts`

## .verdict
awaits council.
