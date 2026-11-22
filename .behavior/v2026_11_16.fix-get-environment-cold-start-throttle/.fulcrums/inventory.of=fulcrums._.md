# inventory.of=fulcrums

ids pad to 3 digits (`F002` sorts before `F019`). the dated review records under `.reviews/` and `.seeds/` cite the unpadded form of the same id: `F2` = `F002`.

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F001-cache-key-is-access-key-id-hash | cache key = hash of resolved access key id, not sts arn or profile | clean | ruled: keep a) | 80% |
| F002-own-file-lock-over-with-simple-mutex | own pid-aware file lock, not with-simple-mutex | clean | best-guessed | 75% |
| F003-hof-wrappers-take-fn-then-options | hof wrappers take (fn, options), per the hook-wrapper brief | clean | disputed | 90% |
| F004-parser-input-signature-unchanged | parser `input?` left as main has it; gains an optional `cache` | clean | disputed | 90% |
| F005-release-green-proven-at-the-commit-window | release green proven after the commit window; local suites green on repo code | clean | disputed | 85% |
| F006-husky-hooks-are-not-this-fix | untracked husky hooks stay out of this fix | clean | disputed | 90% |
| F007-cache-dir-rides-in-context | cacheDir rides in context beside the sdk seam | clean | disputed | 80% |
| F008-enum-returns-asserted-exactly-not-snapped | tier returns asserted exactly, not snapped | clean | disputed | 85% |
| F009-lock-and-sdk-factory-stay-at-their-leaf | lock and sdk factory stay at their one-caller leaf | clean | disputed | 85% |
| F010-extant-credential-catch-left-as-is | name parser's credential catch extracted to `isCredentialError`; alias parser's left as main has it | clean | disputed | 80% |
| F011-disk-cache-documented-not-switched | disk cache documented in the readme; `cache: 'skip'` reaches past it | clean | ruled: skip reaches the disk cache | 75% |
| F012-retry-is-bounded-not-endless | throttle retry bounded at 6; the last throttle surfaces as-is | clean | disputed | 80% |
| F013-no-log-channel-for-the-wait | the lock wait and retry emit no log; the wait is bounded instead | clean | disputed | 85% |
| F014-acceptance-suite-left-as-is | cold start proven through `getEnvironment()` on a name-only parser chain (b taken in 5.3) | clean | taken, awaits council | 90% |
| F015-stubbed-send-needs-fake-credentials | a test that stubs `AccountClient.send` must hold fake env credentials | clean | disputed | 75% |
| F016-real-aws-default-case-asserts-null-ungated | real-aws default case asserts null with no readability gate | clean | disputed | 85% |
| F017-predicate-suites-stay-data-driven | predicate unit suites stay table-driven, not given/when/then | clean | disputed | 85% |
| F018-live-real-aws-snaps-stay-masked | live real-aws snapshots stay behind the readability mask | clean | ruled: keep a) | 80% |
| F019-lock-fate-journeys-proven-below-the-contract | lock-fate journeys proven on the wrapper, not walked through `getEnvironment()` | clean | disputed | 80% |
| F020-claude-migration-held-out-of-the-bump | the `.claude` actor migration stays out of the upgrade bump, for one box-local path | clean | ruled: keep a) | 75% |
| F021-skip-reaches-parsers-via-parser-context | `cache: 'skip'` reaches the name parser as an optional `ParserContext` arg on each async parser | clean | best-guessed | 85% |
