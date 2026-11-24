import { describe, expect, it } from 'vitest';
import { isBackendToParent } from './isBackendToParent.ts';

describe('isBackendToParent', () => {
  it('shouldAccept_whenReadyHasValidPort', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'ready', port: 5123 });
    // Then
    expect(valid).toBe(true);
  });

  it('shouldAccept_whenErrorHasStringMessage', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'error', message: 'boom' });
    // Then
    expect(valid).toBe(true);
  });

  it('shouldReject_whenPortIsZero', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'ready', port: 0 });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenPortAboveMaximum', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'ready', port: 65_536 });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenPortNotInteger', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'ready', port: 51.5 });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenPortIsString', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'ready', port: '5123' });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenErrorMessageMissing', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'error' });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenTypeUnknown', () => {
    // Given / When
    const valid = isBackendToParent({ type: 'hello' });
    // Then
    expect(valid).toBe(false);
  });

  it('shouldReject_whenValueIsNull', () => {
    // Given / When
    const valid = isBackendToParent(null);
    // Then
    expect(valid).toBe(false);
  });
});
