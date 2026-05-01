/**
 * .what = which tier of resources this process can access
 * .why = controls which databases, apis, secrets, etc. are reachable
 */
export type EnvironmentAccessTier = 'test' | 'prep' | 'prod';
