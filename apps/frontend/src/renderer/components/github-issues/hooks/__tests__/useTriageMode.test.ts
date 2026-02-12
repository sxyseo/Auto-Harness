/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTriageMode } from '../useTriageMode';
import { usePhase4Store } from '../../../../stores/github/phase4-store';

describe('useTriageMode', () => {
  beforeEach(() => {
    usePhase4Store.setState({ triageModeEnabled: false });
  });

  it('returns isAvailable=false when viewport < 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    window.dispatchEvent(new Event('resize'));
    const { result } = renderHook(() => useTriageMode());
    expect(result.current.isAvailable).toBe(false);
  });

  it('returns isAvailable=true when viewport >= 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    window.dispatchEvent(new Event('resize'));
    const { result } = renderHook(() => useTriageMode());
    expect(result.current.isAvailable).toBe(true);
  });

  it('toggle enables triage mode when available', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(true);
  });

  it('does not toggle when isAvailable is false', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(false);
  });

  it('auto-disables when viewport shrinks below 1200px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true });
    const { result } = renderHook(() => useTriageMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isAvailable).toBe(false);
  });
});
