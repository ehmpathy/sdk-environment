# F011 — the disk cache is documented, and `cache: 'skip'` reaches past it

## .the fork
- a) document the disk cache in the readme: where it lives, its ttl, that `cache: 'skip'` skips only the in-process cache, how to bust it (delete the dir), and the stubbed-send hazard (taken first)
- b) add an off switch: an env var (e.g. `SDK_ENVIRONMENT_CACHE=skip`) or thread `cache: 'skip'` down to the parser
- c) both

## .taken, why
a) first: the wish asked for the smallest change that meets done, and b) adds a public contract. the hazard b) guards is narrow: a consumer test that stubs `AccountClient.send` while it holds REAL credentials.

## .rework, why
clean: thread `cache: 'skip'` to the name parser; no caller changes.

## .confidence, why low
75%. a reviewer judged the stubbed-send case plausible.

## .where
`readme.md` (fromAwsAccountName section); `src/domain.operations/parsers/access/getEnvAccessFromAwsAccountName.ts`

## .verdict
ruled by the commander on pr #18: a skip that leaves the disk cache in place is wrong. b) taken: `cache: 'skip'` now asks aws past the disk file, then rewrites it. the shape of the thread is F021.
