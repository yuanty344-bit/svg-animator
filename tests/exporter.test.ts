/**
 * Tests for exporter — snapshot and export logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state/store.js';
import { buildCurrentSnapshotSVG } from '../src/export/exporter.js';

function makeSvgEl(tag: string) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

beforeEach(() => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'previewSvg';
  document.body.innerHTML = '';
  document.body.appendChild(svg);

  state.currentData = {
    viewBox: '0 0 100 100',
    elements: [
      { tag: 'circle', attrs: { cx: '50', cy: '50', r: '30' }, originalFill: '#ff0000' },
      { tag: 'rect', attrs: { x: '10', y: '10', width: '30', height: '30' }, originalFill: null },
    ],
    originalElements: [],
  };

  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  state.customFills = [];
  state.lengths = [200, 150];
  state.strokeColor = '#ffffff';
  state.fillColor = '#ffffff';
  state.strokeWidth = 8;
  state.bgColor = '#000000';
  state.preserveOriginalColors = false;
  state.keepStrokes = true;

  for (let i = 0; i < 2; i++) {
    const s = makeSvgEl('circle');
    s.setAttribute('cx', '50'); s.setAttribute('cy', '50'); s.setAttribute('r', '30');
    Object.assign(s.style, {
      stroke: '#ffffff', strokeWidth: '8', fill: 'transparent',
      strokeDasharray: '200', strokeDashoffset: '0', strokeOpacity: '1',
      strokeLinecap: 'round', strokeLinejoin: 'round',
    });
    svg.appendChild(s);
    state.strokeElements.push(s);

    const f = makeSvgEl('rect');
    f.setAttribute('x', '10'); f.setAttribute('y', '10');
    f.setAttribute('width', '30'); f.setAttribute('height', '30');
    f.style.fill = 'rgb(255, 255, 255)'; f.style.stroke = 'none'; f.style.opacity = '1';
    svg.appendChild(f);
    state.fillElements.push(f);
    state.originalFills.push(state.currentData.elements[i].originalFill);
    state.customFills.push(null);
  }
});

describe('buildCurrentSnapshotSVG', () => {
  it('returns valid SVG string', () => {
    const result = buildCurrentSnapshotSVG(false);
    expect(result).toContain('<svg');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result).toContain('viewBox="0 0 100 100"');
    expect(result).toContain('</svg>');
  });

  it('includes background rect when includeBg=true', () => {
    const result = buildCurrentSnapshotSVG(true);
    expect(result).toContain('<rect width="100%" height="100%" fill="#000000"');
  });

  it('excludes background when includeBg=false', () => {
    const result = buildCurrentSnapshotSVG(false);
    expect(result).not.toContain('width="100%"');
  });

  it('includes stroke and fill styling', () => {
    const result = buildCurrentSnapshotSVG(false);
    expect(result).toContain('stroke:rgb(255, 255, 255)');
    expect(result).toContain('stroke-dasharray:');
    expect(result).toContain('stroke-linecap:round');
  });

  it('returns empty string when no data', () => {
    state.strokeElements = [];
    expect(buildCurrentSnapshotSVG(false)).toBe('');
  });
});
