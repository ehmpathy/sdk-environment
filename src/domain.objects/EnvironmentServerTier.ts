/**
 * .what = where this process executes
 * .why = enables server-specific behavior (log format, cache strategy, etc.)
 *
 * format: `$tier@$platform`
 * - tier: 'local' | 'cloud'
 * - platform: string (e.g., 'unix', 'cicd', 'aws.lambda')
 */
export type EnvironmentServerTier = `local@${string}` | `cloud@${string}`;
