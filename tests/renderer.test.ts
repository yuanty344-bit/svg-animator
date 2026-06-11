/**
 * Tests for renderer — DOM construction functions
 * jsdom provides browser-like environment
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state/store.js';
import { createElementPair, measureAndCacheLengths } from '../src/core/renderer.js';

// Setup minimal DOM for SVG operations
beforeEach(() => {
  // jsdom may not have full SVG support, so we mock for unit tests
  state.currentData = null;
  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  state.customFills = [];
  state.lengths = [];
  state.strokeColor = '#ffffff';
  state.strokeWidth = 8;
});

describe('createElementPair', () => {
  it('creates stroke + fill SVG elements', () => {
    const elData = { tag: 'path', attrs: { d: 'M0,0 L10,10' }, originalFill: '#ff0000' };
    const { sEl, fEl } = createElementPair(elData, 100);

    // Stroke element
    expect(sEl.tagName).toBe('path');
    expect(sEl.getAttribute('d')).toBe('M0,0 L10,10');
    expect(sEl.style.fill).toBe('transparent');
    expect(sEl.style.stroke).toBe('rgb(255, 255, 255)');
    expect(sEl.style.strokeDasharray).toBe('100');
    expect(sEl.style.strokeDashoffset).toBe('100');

    // Fill element
    expect(fEl.tagName).toBe('path');
    expect(fEl.getAttribute('d')).toBe('M0,0 L10,10');
    expect(fEl.style.fill).toBe('transparent');
    expect(fEl.style.stroke).toBe('none');
  });

  it('uses strokeColor and strokeWidth from state', () => {
    state.strokeColor = '#ff8800';
    state.strokeWidth = 12;
    const elData = { tag: 'circle', attrs: { r: '50' }, originalFill: null };
    const { sEl } = createElementPair(elData, 200);
    expect(sEl.style.stroke).toBe('rgb(255, 136, 0)');
    expect(sEl.style.strokeWidth).toBe('12');
  });

  it('uses getDashFallback when no length provided', () => {
    const elData = { tag: 'rect', attrs: { width: '100', height: '100' }, originalFill: '#000' };
    // Without currentData, getDashFallback returns 5000
    const { sEl } = createElementPair(elData);
    expect(sEl.style.strokeDasharray).toBe('5000');
  });
});
