/**
 * Tests for state functions
 */
import { describe, it, expect } from 'vitest';
import { totalCycle, perElemStrokeDur, elementCycle, state } from '../src/state/store.js';

describe('totalCycle', () => {
  it('returns 8.5 (6 + 1.2 + 1.3)', () => {
    expect(totalCycle()).toBeCloseTo(8.5);
  });
});

describe('perElemStrokeDur', () => {
  it('single element uses full stroke time', () => {
    expect(perElemStrokeDur(1)).toBe(6);
  });
  it('multiple elements divide stroke time', () => {
    expect(perElemStrokeDur(6)).toBeCloseTo(1.0);
  });
  it('minimum is 0.4s', () => {
    expect(perElemStrokeDur(100)).toBe(0.4);
  });
});

describe('elementCycle', () => {
  it('single element equals totalCycle', () => {
    expect(elementCycle(1)).toBeCloseTo(8.5);
  });
  it('multiple elements increase cycle (staggerFactor default 1)', () => {
    state.staggerFactor = 1;
    // 9 elements × 0.67s = 6s total stroke, same as sync mode
    expect(elementCycle(9)).toBeCloseTo(8.5, 1);
  });
});
