import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * .what = a local stand-in for the aws account api that throttles, then answers
 * .why = drives the real aws sdk through a 429 in aws's own wire shape, so the throttle
 *        the sdk throws, and the retry past the sdk's own attempts, are proven, not
 *        assumed; and counts every call, which real aws does not expose per caller
 * .note = replies as aws restJson1 does: a 429 carries `x-amzn-errortype`
 * .note = point the real sdk at it via env `AWS_ENDPOINT_URL_ACCOUNT`
 */
export const genAwsAccountApiFake = async (input: {
  throttles: number;
  accountName: string;
  delayMs: number;
}): Promise<{ server: Server; url: string; calls: () => number }> => {
  const state = { calls: 0 };
  const server = createServer((request, response) => {
    request.resume();
    request.on('end', async () => {
      state.calls += 1; // .note = deliberate mutation, scoped to this fake
      const callIndex = state.calls;
      await sleep(input.delayMs);
      if (callIndex <= input.throttles) {
        response.writeHead(429, {
          'content-type': 'application/json',
          'x-amzn-errortype': 'TooManyRequestsException',
        });
        response.end(JSON.stringify({ message: 'Too Many Requests' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          AccountId: '123456789012',
          AccountName: input.accountName,
        }),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo; // .note = node types address() as a union; a tcp listen returns AddressInfo
  return { server, url: `http://127.0.0.1:${port}`, calls: () => state.calls };
};
