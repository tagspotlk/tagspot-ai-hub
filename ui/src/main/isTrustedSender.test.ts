import { describe, expect, it } from 'vitest';
import { isTrustedSender } from './isTrustedSender.ts';

const DEV_URL = 'http://localhost:5173/';
const FILE_URL = 'file:///C:/app/out/renderer/index.html';

describe('isTrustedSender', () => {
  it('shouldAccept_whenSenderIsTrustedPage', () => {
    // Given the app's own dev page with a hash and query
    const sender = 'http://localhost:5173/?tab=1#status';

    // When checking the sender
    const trusted = isTrustedSender(sender, DEV_URL);

    // Then it is trusted
    expect(trusted).toBe(true);
  });

  it('shouldAccept_whenSenderIsBuiltRendererFile', () => {
    // Given the built renderer file
    // When checking the sender
    const trusted = isTrustedSender(FILE_URL, FILE_URL);

    // Then it is trusted
    expect(trusted).toBe(true);
  });

  it('shouldReject_whenSenderHasOtherHttpOrigin', () => {
    // Given a page from another origin
    const sender = 'http://evil.example:5173/';

    // When checking the sender
    const trusted = isTrustedSender(sender, DEV_URL);

    // Then it is rejected
    expect(trusted).toBe(false);
  });

  it('shouldReject_whenSenderIsOtherFile', () => {
    // Given a different local file, e.g. one dropped onto the window
    const sender = 'file:///C:/Users/me/Downloads/evil.html';

    // When checking the sender
    const trusted = isTrustedSender(sender, FILE_URL);

    // Then it is rejected
    expect(trusted).toBe(false);
  });

  it('shouldReject_whenSenderUrlUndefined', () => {
    // Given a sender without a frame URL
    // When checking the sender
    const trusted = isTrustedSender(undefined, DEV_URL);

    // Then it is rejected
    expect(trusted).toBe(false);
  });

  it('shouldReject_whenSenderUrlMalformed', () => {
    // Given a sender URL that cannot be parsed
    // When checking the sender
    const trusted = isTrustedSender('not a url', DEV_URL);

    // Then it is rejected
    expect(trusted).toBe(false);
  });
});
