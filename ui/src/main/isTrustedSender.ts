/** Origin plus path; hash and query do not change which page is talking. */
function pageOf(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

function parse(url: string): URL | null {
  return URL.canParse(url) ? new URL(url) : null;
}

/**
 * True only when an IPC call comes from the app's own page (`trustedUrl`),
 * so a page navigated to or dropped onto the window cannot use the bridge.
 */
export function isTrustedSender(senderUrl: string | undefined, trustedUrl: string): boolean {
  if (senderUrl === undefined) return false;
  const sender = parse(senderUrl);
  const trusted = parse(trustedUrl);
  if (!sender || !trusted) return false;
  return pageOf(sender) === pageOf(trusted);
}
