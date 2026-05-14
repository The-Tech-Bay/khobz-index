import { useSyncExternalStore } from 'react';

function getCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

function subscribeToCoarsePointer(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia('(pointer: coarse)');
  const handler = (): void => {
    callback();
  };
  if (mq.addEventListener !== undefined) {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}

/**
 * True when the primary pointer is coarse (typically touch-first mobile / tablet).
 * Uses matchMedia("(pointer: coarse)") so stylus/touch laptops are handled sensibly.
 */
export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribeToCoarsePointer, getCoarsePointer, () => false);
}
