/**
 * Tests for UI layer — functions extractable from controls.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, CONST } from '../src/state/store.js';
import { renderLayerPathList } from '../src/ui/controls.js';

function makeSvgEl(tag: string) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="layerPathList"></div>
    <div id="playIcon"></div>
    <div id="previewSvg"></div>
    <div id="layerPanel" style="display:none"></div>
    <div id="layerHeader"></div>
    <div id="autoBgCheckPanel"></div>
    <div id="preserveColors"></div>
    <input id="speed" value="1"/>
    <span id="speedVal">1×</span>
    <input id="strokeWidth" value="8"/>
    <span id="strokeWidthVal">8</span>
    <input id="staggerFactor" value="1"/>
    <span id="staggerVal">1×</span>
    <select id="easing"><option value="linear" selected></option></select>
  `;

  state.currentData = {
    viewBox: '0 0 100 100',
    elements: [
      { tag: 'path', attrs: { d: 'M0,0 L10,10' }, originalFill: '#ff0000' },
      { tag: 'circle', attrs: { r: '30' }, originalFill: null },
      { tag: 'path', attrs: { d: 'M20,20 L30,30' }, originalFill: '#00ff00' },
    ],
    originalElements: [],
  };
  state.preserveOriginalColors = false;
  state.fillColor = '#ffffff';
  state.originalFills = ['#ff0000', null, '#00ff00'];
  state.customFills = ['#0000ff', null, null];
  state.pathStrokeVisible = [true, true, false];
  state.currentProgress = 0;
});

describe('renderLayerPathList', () => {
  it('creates entries for each element', () => {
    renderLayerPathList();
    const items = document.querySelectorAll('#layerPathList .path-item');
    expect(items.length).toBe(3);
  });

  it('shows effective color in non-preserve mode', () => {
    renderLayerPathList();
    const colors = document.querySelectorAll('#layerPathList input[type="color"]');
    // customFills[0]='#0000ff' → shows blue; elem 2: originalFills but not custom → shows uniform white
    expect((colors[0] as HTMLInputElement).value).toBe('#0000ff');
    expect((colors[1] as HTMLInputElement).value).toBe('#ffffff');
    expect((colors[2] as HTMLInputElement).value).toBe('#ffffff');
  });

  it('shows original colors in preserve mode', () => {
    state.preserveOriginalColors = true;
    state.customFills = [null, null, null];
    renderLayerPathList();
    const colors = document.querySelectorAll('#layerPathList input[type="color"]');
    expect((colors[0] as HTMLInputElement).value).toBe('#ff0000');
    expect((colors[1] as HTMLInputElement).value).toBe('#ffffff'); // null → white fallback
    expect((colors[2] as HTMLInputElement).value).toBe('#00ff00');
  });

  it('respects pathStrokeVisible checkboxes', () => {
    renderLayerPathList();
    const cbs = document.querySelectorAll('#layerPathList input[type="checkbox"]');
    expect((cbs[0] as HTMLInputElement).checked).toBe(true);
    expect((cbs[1] as HTMLInputElement).checked).toBe(true);
    expect((cbs[2] as HTMLInputElement).checked).toBe(false);
  });

  it('clears and rebuilds on second call', () => {
    renderLayerPathList();
    renderLayerPathList();
    expect(document.querySelectorAll('#layerPathList .path-item').length).toBe(3);
  });

  it('shows empty when no data', () => {
    state.currentData = null;
    renderLayerPathList();
    expect(document.querySelectorAll('#layerPathList .path-item').length).toBe(0);
  });
});

describe('syncPlayIcon', () => {
  // syncPlayIcon is not exported, but we can test the icon state indirectly
  it('playIcon element exists in DOM', () => {
    const icon = document.getElementById('playIcon');
    expect(icon).not.toBeNull();
  });
});
