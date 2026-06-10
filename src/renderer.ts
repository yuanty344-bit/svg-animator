// ── DOM 构建 ──────────────────────────────────────────

import type { SVGElementData } from './types.js';
import { state } from './state.js';
import { withTempSVG, parseViewBoxParts } from './utils.js';

export function measureAndCacheLengths(): number[] {
  if (!state.currentData) return [];
  const { viewBox, elements } = state.currentData;
  const lens = withTempSVG(viewBox, (tmp) => {
    return elements.map((el) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
      for (const [k, v] of Object.entries(el.attrs)) node.setAttribute(k, v);
      tmp.appendChild(node);
      const len =
        typeof (node as SVGGeometryElement).getTotalLength === 'function'
          ? (node as SVGGeometryElement).getTotalLength()
          : 0;
      tmp.removeChild(node);
      return len || 0;
    });
  });
  state.currentData.lengths = lens;
  return lens;
}

function getDashFallback(): number {
  if (!state.currentData) return 5000;
  const [, , w, h] = parseViewBoxParts(state.currentData.viewBox);
  return Math.max(5000, Math.ceil(Math.sqrt(w * w + h * h) * 2));
}

export function getLength(i: number): number {
  return state.lengths[i] && state.lengths[i] > 0 ? state.lengths[i] : getDashFallback();
}

export function sortElementsByArea(elements: SVGElementData[]): SVGElementData[] {
  if (!state.currentData) return elements;
  return withTempSVG(state.currentData.viewBox, (tmp) => {
    const areas = elements.map((el) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
      for (const [k, v] of Object.entries(el.attrs)) node.setAttribute(k, v);
      tmp.appendChild(node);
      const b = (node as SVGGraphicsElement).getBBox();
      tmp.removeChild(node);
      return { el, area: (b.width || 0) * (b.height || 0) };
    });
    areas.sort((a, b) => b.area - a.area);
    return areas.map((item) => item.el);
  });
}

export function createElementPair(
  elData: SVGElementData,
  lengthVal?: number
): { sEl: SVGElement; fEl: SVGElement } {
  const len = lengthVal || getDashFallback();
  const sEl = document.createElementNS('http://www.w3.org/2000/svg', elData.tag);
  for (const [k, v] of Object.entries(elData.attrs)) sEl.setAttribute(k, v);
  Object.assign(sEl.style, {
    strokeWidth: String(state.strokeWidth),
    stroke: state.strokeColor,
    fill: 'transparent',
    strokeDasharray: String(len),
    strokeDashoffset: String(len),
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  });
  const fEl = document.createElementNS('http://www.w3.org/2000/svg', elData.tag);
  for (const [k, v] of Object.entries(elData.attrs)) fEl.setAttribute(k, v);
  fEl.style.fill = 'transparent';
  fEl.style.stroke = 'none';
  return { sEl, fEl };
}

export function rebuildPreviewDOM(): void {
  if (!state.currentData) return;
  const previewSvg = document.getElementById('previewSvg')!;
  let { viewBox, elements } = state.currentData;

  if (state.preserveOriginalColors) {
    elements = state.currentData.originalElements || elements;
    state.currentData.elements = elements;
  } else if (state.autoBgEnabled && elements.length > 1) {
    elements = sortElementsByArea(elements);
    state.currentData.elements = elements;
  }

  measureAndCacheLengths();
  state.pathStrokeVisible = elements.map(() => true);
  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  previewSvg.innerHTML = '';
  previewSvg.setAttribute('viewBox', viewBox);

  for (let i = 0; i < elements.length; i++) {
    const len = getLength(i);
    const { sEl, fEl } = createElementPair(elements[i], len);
    previewSvg.appendChild(sEl);
    state.strokeElements.push(sEl);
    previewSvg.appendChild(fEl);
    state.fillElements.push(fEl);
    state.originalFills.push(elements[i].originalFill || null);
  }
}

export function reorderDomElements(): void {
  const previewSvg = document.getElementById('previewSvg')!;
  previewSvg.innerHTML = '';
  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  const newElements = state.currentData!.elements;
  for (let i = 0; i < newElements.length; i++) {
    const len = getLength(i);
    const { sEl, fEl } = createElementPair(newElements[i], len);
    previewSvg.appendChild(sEl);
    state.strokeElements.push(sEl);
    previewSvg.appendChild(fEl);
    state.fillElements.push(fEl);
    state.originalFills.push(newElements[i].originalFill || null);
  }
}
