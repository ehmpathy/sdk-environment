# F13 — the lock wait and the retry emit no log

## .the fork
- a) emit no log; bound the wait instead (holder gone → direct fetch; 60s deadline) and document it in the readme (taken)
- b) add a log channel (a `log` in context, or `console.debug`) for waits and retries

## .taken, why
a). the library has no log channel today; any parser that logs adds a contract the wish does not ask for, and a bare `console` write pollutes every consumer's test output. the silence the reviewer named was dangerous only while the wait was unbounded; it now ends in a value or an error within the deadline.

## .rework, why
clean: an optional `log` in the parser's context, passed down to the two wrappers.

## .confidence, why low
85%. an operator who debugs a slow suite would like a trace; that is a feature for the commander to ask for.

## .where
`src/domain.operations/parsers/access/withCacheAcrossProcesses.ts`, `withRetryOnThrottle.ts`

## .verdict
awaits council.
