import { networkInterfaces } from 'node:os';

/** First non-internal IPv4 address of this machine, or undefined when it has none (tests then skip). */
export const findNonLoopbackAddress = (): string | undefined =>
  Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .find((entry) => entry.family === 'IPv4' && !entry.internal)?.address;
