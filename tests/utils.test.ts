/**
 * Tests for utility functions
 */
import { describe, it, expect } from 'vitest';
import { escHtml, hexToRgb, parseColor, applyEasing, normalizeViewBox } from '../src/utils/helpers.js';

describe('escHtml', () => {
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes <', () => expect(escHtml('a<b')).toBe('a&lt;b'));
  it('escapes >', () => expect(escHtml('a>b')).toBe('a&gt;b'));
  it('escapes "', () => expect(escHtml('a"b')).toBe('a&quot;b'));
  it('returns unchanged for safe strings', () => expect(escHtml('hello')).toBe('hello'));
});

describe('hexToRgb', () => {
  it('converts 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('converts 3-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('returns null for non-hex', () => {
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
  it('handles #000000', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('parseColor', () => {
  it('returns lowercase hex', () => expect(parseColor('#FF0000')).toBe('#ff0000'));
  it('returns null for none', () => expect(parseColor('none')).toBeNull());
  it('returns null for transparent', () => expect(parseColor('transparent')).toBeNull());
  it('returns null for empty', () => expect(parseColor('')).toBeNull());
  it('returns named colors as-is', () => expect(parseColor('red')).toBe('red'));
  it('returns rgb as-is', () => expect(parseColor('rgb(255,0,0)')).toBe('rgb(255,0,0)'));
});

describe('applyEasing', () => {
  it('linear: t=0 → 0', () => expect(applyEasing(0, 'linear')).toBeCloseTo(0));
  it('linear: t=1 → 1', () => expect(applyEasing(1, 'linear')).toBeCloseTo(1));
  it('linear: t=0.5 → 0.5', () => expect(applyEasing(0.5, 'linear')).toBeCloseTo(0.5));
  it('ease-in: starts slower', () => expect(applyEasing(0.5, 'ease-in')).toBeLessThan(0.5));
  it('ease-out: starts faster', () => expect(applyEasing(0.5, 'ease-out')).toBeGreaterThan(0.5));
  it('ease-in-out: midpoint is 0.5', () => expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5, 1));
});

describe('normalizeViewBox', () => {
  it('handles commas', () => expect(normalizeViewBox('0,0,1024,1024')).toBe('0 0 1024 1024'));
  it('handles extra spaces', () => expect(normalizeViewBox('0   0   1024   1024')).toBe('0 0 1024 1024'));
  it('passes through clean input', () => expect(normalizeViewBox('0 0 1024 1024')).toBe('0 0 1024 1024'));
});
