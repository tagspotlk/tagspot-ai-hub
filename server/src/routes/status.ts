import type { StatusResponse } from '@tagspot/api';
import type { FastifyInstance } from 'fastify';

export const STATUS_ROUTE = '/status';

/** Registers GET /status, reporting that the backend is running. */
export const registerStatusRoute = (app: FastifyInstance, version: string): void => {
  app.get(STATUS_ROUTE, async (): Promise<StatusResponse> => ({ state: 'running', version }));
};
