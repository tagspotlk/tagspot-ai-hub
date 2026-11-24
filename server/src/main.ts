import { createParentChannel } from './channel/parentChannel.ts';
import { startBackend } from './startBackend.ts';

const EXIT_ERROR = 1;

/** Only the error name is written: messages may carry details we do not control. Exits once the line is flushed. */
const exitWithError = (error: unknown): void => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`Backend failed: ${name}\n`, () => process.exit(EXIT_ERROR));
};

Promise.resolve()
  .then(() => startBackend(createParentChannel()))
  .catch(exitWithError);
