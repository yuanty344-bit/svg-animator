/**
 * Tests for SVG parser — edge cases that caused real bugs
 */
import { describe, it, expect } from 'vitest';
import { parseSVG, extractAttrsAndFill } from '../src/core/parser.js';

describe('parseSVG', () => {
  it('extracts fill colors', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ff0000" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBe('#ff0000');
  });

  it('fill="" defaults to black', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBe('#000000');
  });

  it('fill="none" returns null (explicit transparent)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBeNull();
  });

  it('fill="transparent" returns null', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="transparent" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBeNull();
  });

  it('no fill attribute defaults to black', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBe('#000000');
  });

  it('preserves original element order', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<path fill="#111111" d="M0,0 L10,10"/>'
      + '<path fill="#222222" d="M20,20 L30,30"/>'
      + '</svg>';
    const r = parseSVG(svg)!;
    expect(r.originalElements[0].originalFill).toBe('#111111');
    expect(r.originalElements[1].originalFill).toBe('#222222');
  });

  it('handles nested <g> groups', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g><g>'
      + '<path fill="red" d="M0,0 L10,10"/>'
      + '</g></g></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements.length).toBe(1);
    expect(r.elements[0].originalFill).toBe('red');
  });

  it('normalizes viewBox with commas', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0,200,200"><path d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.viewBox).toBe('0 0 200 200');
  });

  it('handles hex color normalization', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ABC" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBe('#aabbcc');
  });

  it('returns null for empty SVG', () => {
    expect(parseSVG('<svg></svg>')).toBeNull();
  });

  it('skips non-geometry elements', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<text>hello</text>'
      + '<path fill="red" d="M0,0 L10,10"/>'
      + '<image href="x.png"/>'
      + '</svg>';
    const r = parseSVG(svg)!;
    expect(r.elements.length).toBe(1);
  });
});
