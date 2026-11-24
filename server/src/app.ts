import Fastify, { type FastifyInstance } from 'fastify';
import { registerBearerAuth } from './auth/bearerAuth.ts';
import { registerStatusRoute } from './routes/status.ts';

export interface AppOptions {
  sessionSecret: string;
  version: string;
}

/** Builds the backend app without listening; the logger stays off so headers and the secret are never logged. */
export const buildApp = (options: AppOptions): FastifyInstance => {
  const app = Fastify({ logger: false });
  registerBearerAuth(app, options.sessionSecret);
  registerStatusRoute(app, options.version);
  return app;
};
