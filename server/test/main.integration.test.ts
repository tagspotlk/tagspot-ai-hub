import { fork, spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { BackendToParent } from '../src/protocol.ts';
import { findNonLoopbackAddress } from './helpers/nonLoopbackAddress.ts';

const MAIN_PATH = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);
const SERVER_VERSION = (JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf8')) as { version: string })
  .version;
const SECRET = 'integration-secret-value'; // allow-secret: test fixture
const HTTP_OK = 200;
const LOOPBACK = '127.0.0.1';
const NO_INIT_TEST_TIMEOUT_MS = 10_000;
const EXIT_OK = 0;
const EXIT_ERROR = 1;

const children: ChildProcess[] = [];
const nonLoopbackAddress = findNonLoopbackAddress();

const startChild = (): { child: ChildProcess; messages: BackendToParent[] } => {
  const child = fork(MAIN_PATH, [], { execArgv: [], silent: true });
  const messages: BackendToParent[] = [];
  child.on('message', (message) => messages.push(message as BackendToParent));
  children.push(child);
  return { child, messages };
};

const nextMessage = (child: ChildProcess): Promise<BackendToParent> =>
  new Promise((resolve) => child.once('message', (message) => resolve(message as BackendToParent)));

const exitCodeOf = (child: ChildProcess): Promise<number | null> =>
  new Promise((resolve) => child.once('exit', (code) => resolve(code)));

const sendInit = (child: ChildProcess, init: object = {}) =>
  child.send({ type: 'init', sessionSecret: SECRET, ...init });

const startReady = async (): Promise<{ child: ChildProcess; port: number }> => {
  const { child } = startChild();
  const ready = nextMessage(child);
  sendInit(child);
  const message = await ready;
  if (message.type !== 'ready') throw new Error('backend did not report ready');
  return { child, port: message.port };
};

const stderrOf = (child: ChildProcess): Promise<string> =>
  new Promise((resolve) => {
    let output = '';
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.once('close', () => resolve(output));
  });

const connectError = (host: string, port: number): Promise<string | undefined> =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(undefined);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code));
  });

afterEach(() => {
  children.splice(0).forEach((child) => child.kill());
});

describe('backend entry', () => {
  it('shouldReportReadyOnLoopbackPort_whenInitReceived', async () => {
    // Given / When
    const { port } = await startReady();
    const response = await fetch(`http://${LOOPBACK}:${port}/status`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });

    // Then
    expect(port).toBeGreaterThan(0);
    expect(response.status).toBe(HTTP_OK);
  });

  it('shouldReportServerPackageVersion_whenStatusRequested', async () => {
    // Given a ready backend
    const { port } = await startReady();

    // When requesting the status
    const response = await fetch(`http://${LOOPBACK}:${port}/status`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });

    // Then the version is the one in server/package.json
    expect(await response.json()).toEqual({ state: 'running', version: SERVER_VERSION });
  });

  it('shouldPickDifferentPorts_whenTwoBackendsStart', async () => {
    // Given / When
    const first = await startReady();
    const second = await startReady();

    // Then
    expect(first.port).not.toBe(second.port);
  });

  it.skipIf(!nonLoopbackAddress)('shouldNotAcceptConnections_onNonLoopbackAddress', async () => {
    // Given
    const { port } = await startReady();

    // When
    const code = await connectError(nonLoopbackAddress as string, port);

    // Then
    expect(code).toBe('ECONNREFUSED');
  });

  it('shouldExit_whenParentChannelCloses', async () => {
    // Given
    const { child } = await startReady();
    const exit = exitCodeOf(child);

    // When
    child.disconnect();

    // Then
    expect(await exit).toBe(EXIT_OK);
  });

  it('shouldExitWithError_whenInitHasNoSecret', async () => {
    // Given
    const { child, messages } = startChild();
    const exit = exitCodeOf(child);

    // When
    child.send({ type: 'init' });

    // Then
    expect(await exit).toBe(EXIT_ERROR);
    expect(messages.map((message) => message.type)).toEqual(['error']);
  });

  it(
    'shouldExitWithError_whenNoInitArrives',
    async () => {
      // Given
      const { child } = startChild();

      // When
      const code = await exitCodeOf(child);

      // Then
      expect(code).toBe(EXIT_ERROR);
    },
    NO_INIT_TEST_TIMEOUT_MS,
  );

  it('shouldWriteErrorNameToStderrAndExit_whenNoParentChannel', async () => {
    // Given a backend started without any parent channel
    const child = spawn(process.execPath, [MAIN_PATH], { stdio: ['ignore', 'ignore', 'pipe'] });
    children.push(child);
    const exit = exitCodeOf(child);
    const stderr = stderrOf(child);

    // When it starts
    const code = await exit;

    // Then it writes a fixed, secret-free line and exits with an error
    expect(code).toBe(EXIT_ERROR);
    expect(await stderr).toBe('Backend failed: Error\n');
  });

  it('shouldNotIncludeSecret_inErrorMessage', async () => {
    // Given
    const { child, messages } = startChild();
    const exit = exitCodeOf(child);

    // When an invalid message carrying the secret arrives
    child.send({ type: 'not-init', sessionSecret: SECRET });
    await exit;

    // Then
    expect(JSON.stringify(messages)).not.toContain(SECRET);
    expect(messages[0]?.type).toBe('error');
  });
});
