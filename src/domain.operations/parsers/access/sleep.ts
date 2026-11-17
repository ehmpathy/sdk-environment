/**
 * .what = wait for the given milliseconds
 * .why = the parsers load at import time for every caller, so they use only apis
 *        every supported node holds; `timers/promises` needs node 15+
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));
