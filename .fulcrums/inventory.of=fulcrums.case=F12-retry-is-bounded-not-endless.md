# F12 — the throttle retry is bounded; an outlasted budget surfaces aws's own error

## .the fork
- a) 6 attempts with full jitter, cap 4s; after the last, the raw `TooManyRequestsException` surfaces as-is (taken)
- b) retry until a deadline long enough to outlast any burst
- c) as a), but wrap the final error with the attempt count

## .taken, why
a). "never fails the caller's test" is met by the cause, not the retry: the shared cache cuts N calls to one, so the burst that throttled is gone; the retry covers the residual throttle on that one call (plus the sdk's own 3 attempts per call). an endless retry (b) turns a sustained aws outage into a hung test with no error, which is worse for the 3am reader than a named throttle. c) changes the error class the caller sees; callers and the parser's allowlist read aws's own error today, so a wrap is a contract change for a log nicety.

## .rework, why
clean: one throw site in `withRetryOnThrottle`.

## .confidence, why low
80%. no N-process test measures the exhausted path end to end; the unit test pins that the last throttle surfaces after the budget.

## .where
`src/domain.operations/parsers/access/withRetryOnThrottle.ts`

## .verdict
awaits council.
