# S3 — skip reaches the disk cache

## .said
> getEnvironment({ cache: 'skip' }) skips the in-process cache only; the disk cache still answers within its ttl. to force a fresh aws read, delete the dir above

that seems wrong

## .settled
`cache: 'skip'` asks aws fresh past the disk file, then rewrites the file.

## .landed
- `withCacheAcrossProcesses` (`cache: 'skip'` input), `getEnvAccessFromAwsAccountName` (`input.cache`), `ParserContext` on async parsers (F021); readme; F011 verdict
