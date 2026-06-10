// ── DOM 构建（纯函数，不依赖 animator） ─────────────────

import { state } from './state.js';
import { withTempSVG, parseViewBoxParts } from './utils.js';

// ── 测量 ────────────────────────────────────────────────

export function measureAndCacheLengths() {
  if (!state.currentData) return [];
  const { viewBox, elements } = state.currentData;
  const lens = withTempSVG(viewBox, (tmp) => {
    const results = [];
    for (const el of elements) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
      for (const [k, v] of Object.entries(el.attrs)) node.setAttribute(k, v);
      tmp.appendChild(node);
      const len = typeof node.getTotalLength === 'function' ? node.getTotalLength() : 0;
      results.push(len || 0);
      tmp.removeChild(node);
    }
    return results;
  });
  state.currentData.lengths = lens;
  return lens;
}

function getDashFallback() {
  if (!state.currentData) return 5000;
  const [, , w, h] = parseViewBoxParts(state.currentData.viewBox);
  return Math.max(5000, Math.ceil(Math.sqrt(w * w + h * h) * 2));
}

export function getLength(i) {
  return state.lengths[i] && state.lengths[i] > 0 ? state.lengths[i] : getDashFallback();
}

// ── 排序 ────────────────────────────────────────────────

export function sortElementsByArea(elements) {
  if (!state.currentData) return elements;
  return withTempSVG(state.currentData.viewBox, (tmp) => {
    const areas = elements.map((el) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
      for (const [k, v] of Object.entries(el.attrs)) node.setAttribute(k, v);
      tmp.appendChild(node);
      const b = node.getBBox();
      tmp.removeChild(node);
      return { el, area: (b.width || 0) * (b.height || 0) };
    });
    areas.sort((a, b) => b.area - a.area);
    return areas.map((item) => item.el);
  });
}

// ── 元素创建 ────────────────────────────────────────────

export function createElementPair(elData, lengthVal) {
  const len = lengthVal || getDashFallback();
  const sEl = document.createElementNS('http://www.w3.org/2000/svg', elData.tag);
  for (const [k, v] of Object.entries(elData.attrs)) sEl.setAttribute(k, v);
  Object.assign(sEl.style, {
    strokeWidth: state.strokeWidth,
    stroke: state.strokeColor,
    fill: 'transparent',
    strokeDasharray: len,
    strokeDashoffset: len,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  });
  const fEl = document.createElementNS('http://www.w3.org/2000/svg', elData.tag);
  for (const [k, v] of Object.entries(elData.attrs)) fEl.setAttribute(k, v);
  fEl.style.fill = 'transparent';
  fEl.style.stroke = 'none';
  return { sEl, fEl };
}

// ── 完整 DOM 重建 ───────────────────────────────────────

export function rebuildPreviewDOM() {
  if (!state.currentData) return;
  const previewSvg = document.getElementById('previewSvg');
  let { viewBox, elements } = state.currentData;

  // 保留原色 → 原始顺序；统一颜色 → 面积排序
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

export function reorderDomElements() {
  const previewSvg = document.getElementById('previewSvg');
  previewSvg.innerHTML = '';
  state.strokeElements = [];
  state.fillElements = [];
  state.originalFills = [];
  const newElements = state.currentData.elements;
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
