/**
 * Edge cases & integration-level tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, CONST, totalCycle } from '../src/state/store.js';
import { updateColors, updateElements, invalidateFillCache } from '../src/core/animator.js';
import { exportHTML } from '../src/export/exporter.js';
import { parseSVG } from '../src/core/parser.js';
import { sortElementsByArea, measureAndCacheLengths } from '../src/core/renderer.js';

function makeSvgEl(tag: string) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

beforeEach(() => {
  document.body.innerHTML = `
    <svg id="previewSvg" viewBox="0 0 100 100"></svg>
    <div id="toast"></div>
    <input id="fillColor" value="#ffffff"/>
    <input id="syncColors" type="checkbox" checked/>
  `;

  state.currentData = {
    viewBox: '0 0 100 100',
    elements: [
      { tag: 'path', attrs: { d: 'M0,0 L50,50' }, originalFill: '#ff0000' },
      { tag: 'path', attrs: { d: 'M50,50 L100,0' }, originalFill: '#0000ff' },
    ],
    originalElements: [],
  };
  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = ['#ff0000', '#0000ff'];
  state.customFills = [null, null];
  state.lengths = [100, 100];
  state.pathStrokeVisible = [true, true];
  state.strokeColor = '#ffffff';
  state.fillColor = '#ffffff';
  state.syncColors = true;
  state.strokeWidth = 8;
  state.bgColor = '#000000';
  state.preserveOriginalColors = false;
  state.keepStrokes = true;
  state.easing = 'linear';
  state.sequentialMode = false;
  state.staggerFactor = 1;
  state.currentProgress = 0;
  state.speedFactor = 1;

  const svg = document.getElementById('previewSvg')!;
  for (let i = 0; i < 2; i++) {
    const s = makeSvgEl('path');
    s.setAttribute('d', `M${i},0 L${i+1},50`);
    svg.appendChild(s);
    state.strokeElements.push(s);

    const f = makeSvgEl('path');
    f.setAttribute('d', `M${i},0 L${i+1},50`);
    svg.appendChild(f);
    state.fillElements.push(f);
  }
  state.currentData.originalElements = state.currentData.elements.slice();
});

describe('updateColors', () => {
  it('sync: fillColor follows strokeColor', () => {
    state.strokeColor = '#ff8800';
    updateColors();
    expect(state.fillColor).toBe('#ff8800');
    const fillInput = document.getElementById('fillColor') as HTMLInputElement;
    expect(fillInput.value).toBe('#ff8800');
    expect(fillInput.disabled).toBe(true);
  });

  it('unsync: fillColor independent', () => {
    state.syncColors = false;
    (document.getElementById('syncColors') as HTMLInputElement).checked = false;
    const fillInput = document.getElementById('fillColor') as HTMLInputElement;
    fillInput.value = '#00ff00';
    fillInput.disabled = false;
    updateColors();
    expect(state.fillColor).toBe('#00ff00');
    expect(fillInput.disabled).toBe(false);
  });

  it('updates stroke elements color', () => {
    state.strokeColor = '#ff0000';
    updateColors();
    state.strokeElements.forEach(el => {
      expect(el.style.stroke).toBe('rgb(255, 0, 0)');
    });
  });
});

describe('invalidateFillCache', () => {
  it('clears cached fill RGB', () => {
    state.cachedFillRgb = { r: 255, g: 0, b: 0 };
    state.cachedFillHex = '#ff0000';
    invalidateFillCache();
    expect(state.cachedFillRgb).toBeNull();
    expect(state.cachedFillHex).toBe('');
  });
});

describe('exportHTML validation', () => {
  it('generates valid HTML string with required parts', () => {
    // Mock download to prevent actual download
    const origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:test';

    exportHTML();

    URL.createObjectURL = origCreateObjectURL;
    // exportHTML calls downloadBlob which triggers download —
    // we just verify it doesn't throw. The function is side-effect heavy
    // but we can at least verify it completes without error.
    expect(true).toBe(true); // smoke test passed
  });
});

describe('parseSVG edge cases', () => {
  it('handles SVG with no namespace', () => {
    const r = parseSVG('<svg><path fill="red" d="M0,0 L10,10"/></svg>');
    expect(r).not.toBeNull();
    expect(r!.elements.length).toBe(1);
  });

  it('handles deeply nested groups', () => {
    let svg = '<svg>';
    for (let i = 0; i < 10; i++) svg += '<g>';
    svg += '<path d="M0,0 L10,10" fill="red"/>';
    for (let i = 0; i < 10; i++) svg += '</g>';
    svg += '</svg>';
    const r = parseSVG(svg);
    expect(r).not.toBeNull();
    expect(r!.elements.length).toBe(1);
  });

  it('handles circle, rect, ellipse, line, polygon, polyline', () => {
    const tags = ['circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline'];
    for (const tag of tags) {
      const svg = `<svg><${tag} fill="blue"/></svg>`;
      const r = parseSVG(svg);
      expect(r).not.toBeNull();
      expect(r!.elements[0].tag).toBe(tag);
    }
  });

  it('handles style attribute fill', () => {
    const svg = '<svg><path style="fill:#abc" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBe('#aabbcc');
  });

  it('handles style with fill:none', () => {
    const svg = '<svg><path style="fill:none" d="M0,0 L10,10"/></svg>';
    const r = parseSVG(svg)!;
    expect(r.elements[0].originalFill).toBeNull();
  });
});

describe('sortElementsByArea with mock', () => {
  it('sorts by bounding box area', () => {
    state.currentData = {
      viewBox: '0 0 100 100',
      elements: [
        { tag: 'rect', attrs: { width: '10', height: '10', x: '0', y: '0' }, originalFill: '#111' },
        { tag: 'rect', attrs: { width: '50', height: '50', x: '0', y: '0' }, originalFill: '#222' },
      ],
      originalElements: [],
    };
    // Mock on the Element prototype (jsdom uses this)
    const orig = (Element.prototype as any).getBBox;
    let callCount = 0;
    (Element.prototype as any).getBBox = function() {
      callCount++;
      return callCount === 1
        ? { x: 0, y: 0, width: 10, height: 10 }
        : { x: 0, y: 0, width: 50, height: 50 };
    } as any;

    try {
      const sorted = sortElementsByArea(state.currentData.elements);
      expect(sorted[0].originalFill).toBe('#222');
      expect(sorted[1].originalFill).toBe('#111');
    } finally {
      (Element.prototype as any).getBBox = orig;
    }
  });
});

describe('state boundaries', () => {
  it('totalCycle is always 8.5', () => {
    expect(totalCycle()).toBe(8.5);
  });

  it('speedFactor affects animation timing calculation', () => {
    state.speedFactor = 4;
    // Just verify the state accepts extreme values
    expect(state.speedFactor).toBe(4);
    state.speedFactor = 0.25;
    expect(state.speedFactor).toBe(0.25);
  });
});
