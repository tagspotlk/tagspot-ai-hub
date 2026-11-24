// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendStatus } from './BackendStatus.tsx';
import type { UiStatus } from './deriveUiStatus.ts';

function renderStatus(status: UiStatus, handlers = { onRetry: vi.fn(), onRestart: vi.fn() }) {
  render(<BackendStatus status={status} {...handlers} />);
  return handlers;
}

describe('BackendStatus', () => {
  afterEach(cleanup);

  it('shouldShowStarting_whenStarting', () => {
    // Given a starting status
    // When rendering it
    renderStatus({ kind: 'starting' });

    // Then the starting text is shown
    expect(screen.getByText('Starting backend…')).toBeTruthy();
  });

  it('shouldShowVersion_whenRunning', () => {
    // Given a running status
    // When rendering it
    renderStatus({ kind: 'running', version: '0.1.0' });

    // Then the running text with version is shown
    expect(screen.getByText('Backend running · v0.1.0')).toBeTruthy();
  });

  it('shouldShowRestart_whenStopped', () => {
    // Given a stopped status
    // When rendering it
    renderStatus({ kind: 'stopped' });

    // Then the stopped text and Restart button are shown
    expect(screen.getByText('Backend stopped')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy();
  });

  it('shouldShowRetry_whenFailed', () => {
    // Given a failed status
    // When rendering it
    renderStatus({ kind: 'failed', message: 'boom' });

    // Then the failure text and Retry button are shown
    expect(screen.getByText('Backend failed to start: boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('shouldCallOnRestart_whenRestartClicked', () => {
    // Given a stopped status
    const handlers = renderStatus({ kind: 'stopped' });

    // When clicking Restart
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    // Then onRestart is called
    expect(handlers.onRestart).toHaveBeenCalledOnce();
  });

  it('shouldCallOnRetry_whenRetryClicked', () => {
    // Given a failed status
    const handlers = renderStatus({ kind: 'failed', message: 'boom' });

    // When clicking Retry
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Then onRetry is called
    expect(handlers.onRetry).toHaveBeenCalledOnce();
  });
});
