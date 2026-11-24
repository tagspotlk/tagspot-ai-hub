import { timingSafeEqual } from 'node:crypto';
import type { ErrorResponse } from '@tagspot/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const UNAUTHORIZED_ERROR: ErrorResponse = {
  code: 'unauthorized',
  message: 'Missing or invalid session secret',
};

const HTTP_UNAUTHORIZED = 401;
const BEARER_PREFIX = 'Bearer ';

/** Returns the token of a well-formed bearer header, or undefined. */
const extractBearerToken = (header: string | undefined): string | undefined => {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  return header.slice(BEARER_PREFIX.length);
};

/** Constant-time comparison; the length check is needed because timingSafeEqual throws on unequal lengths. */
const secretsMatch = (candidate: string, expected: string): boolean => {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
  );
};

/** Rejects every request that does not carry the per-run session secret as a bearer token. */
export const registerBearerAuth = (app: FastifyInstance, sessionSecret: string): void => {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (token === undefined || token === '' || !secretsMatch(token, sessionSecret)) {
      return reply.code(HTTP_UNAUTHORIZED).send(UNAUTHORIZED_ERROR);
    }
  });
};
