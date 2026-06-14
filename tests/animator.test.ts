/**
 * Tests for animator — animation engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, CONST } from '../src/state/store.js';
import { updateElements } from '../src/engines/stroke-engine.js';

function makeSvgEl(tag: string) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

beforeEach(() => {
  // Setup DOM: create stroke + fill element pairs
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'previewSvg';
  document.body.innerHTML = '';
  document.body.appendChild(svg);

  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  state.customFills = [];
  state.lengths = [];
  state.pathStrokeVisible = [];
  state.strokeColor = '#ffffff';
  state.strokeWidth = 8;
  state.fillColor = '#ffffff';
  state.preserveOriginalColors = false;
  state.keepStrokes = true;
  state.easing = 'linear';
  state.sequentialMode = false;
  state.staggerFactor = 1;
  state.currentProgress = 0;
  state.speedFactor = 1;

  // Create 3 test elements
  for (let i = 0; i < 3; i++) {
    const s = makeSvgEl('path');
    s.setAttribute('d', `M${i},0 L${i+1},10`);
    svg.appendChild(s);
    state.strokeElements.push(s);
    state.lengths.push(100);

    const f = makeSvgEl('path');
    f.setAttribute('d', `M${i},0 L${i+1},10`);
    svg.appendChild(f);
    state.fillElements.push(f);
    state.originalFills.push(i === 1 ? null : `#${i}${i}${i}`);  // #000, null, #222
    state.customFills.push(null);
    state.pathStrokeVisible.push(true);
  }
});

describe('updateElements — stroke phase', () => {
  it('at progress 0: strokes at full offset', () => {
    updateElements(0);
    state.strokeElements.forEach(el => {
      expect(el.style.strokeDashoffset).toBe('100');
      expect(el.style.strokeOpacity).toBe('1');
    });
  });

  it('at progress 0.5 (half stroke): partial offset', () => {
    // 50% through stroke phase → cycleTime = 4.25, fillOpacity = 0
    updateElements(0.5);
    const offset1 = parseFloat(state.strokeElements[0].style.strokeDashoffset);
    expect(offset1).toBeGreaterThan(0);
    expect(offset1).toBeLessThan(100);
    // Fills should be transparent
    state.fillElements.forEach(el => {
      expect(el.style.fill).toContain('rgba');
      expect(el.style.fill).toContain('0)');  // alpha=0
    });
  });

  it('at end (progress 0.85): strokes complete, fills visible', () => {
    // 85% → cycleTime ~7.2s → fill phase complete
    updateElements(0.85);
    state.strokeElements.forEach(el => {
      expect(el.style.strokeDashoffset).toBe('0');
    });
    // keepStrokes ON → strokes visible
    state.strokeElements.forEach(el => {
      expect(el.style.strokeOpacity).toBe('1');
    });
  });
});

describe('updateElements — keepStrokes OFF', () => {
  it('strokes fade during fill phase', () => {
    state.keepStrokes = false;
    // At 80% → cycleTime ~6.8s → fill phase, stroke should be fading
    updateElements(0.8);
    const op = parseFloat(state.strokeElements[0].style.strokeOpacity);
    expect(op).toBeLessThan(0.5);
  });
});

describe('updateElements — sequential mode', () => {
  it('elements have different stroke progress', () => {
    state.sequentialMode = true;
    // Early in cycle — elem 1 should be behind elem 0
    updateElements(0.1);
    const o0 = parseFloat(state.strokeElements[0].style.strokeDashoffset);
    const o1 = parseFloat(state.strokeElements[1].style.strokeDashoffset);
    expect(o1).toBeGreaterThan(o0);  // elem 1 hasn't drawn as much
  });
});

describe('updateElements — preserve colors', () => {
  it('uses originalFills when preserve is on', () => {
    state.preserveOriginalColors = true;
    // 85% → fill fully visible
    updateElements(0.85);
    expect(state.fillElements[0].style.fill).toContain('0, 0, 0');   // #000
    expect(state.fillElements[2].style.fill).toContain('34, 34, 34'); // #222
  });

  it('customFills override originalFills', () => {
    state.preserveOriginalColors = true;
    state.customFills = ['#ff0000', null, '#00ff00'];
    updateElements(0.85);
    expect(state.fillElements[0].style.fill).toContain('255, 0, 0');
    expect(state.fillElements[2].style.fill).toContain('0, 255, 0');
  });

  it('null originalFill stays transparent in preserve mode', () => {
    state.preserveOriginalColors = true;
    updateElements(0.85);
    expect(state.fillElements[1].style.fill).toBe('transparent');
  });
});
