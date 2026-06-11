// ── 动画引擎 ──────────────────────────────────────────

import { state, CONST, totalCycle, elementCycle, perElemStrokeDur } from '../state/store.js';
import { getLength } from './renderer.js';
import { hexToRgb, applyEasing } from '../utils/helpers.js';

function getFillRgb() {
  if (state.cachedFillRgb && state.cachedFillHex === state.fillColor)
    return state.cachedFillRgb;
  state.cachedFillHex = state.fillColor;
  state.cachedFillRgb = hexToRgb(state.fillColor);
  return state.cachedFillRgb;
}

export function invalidateFillCache(): void {
  state.cachedFillRgb = null;
  state.cachedFillHex = '';
}

export function updateElements(progress: number): void {
  const n = state.strokeElements.length;
  const cycleDuration = state.sequentialMode ? elementCycle(n) : totalCycle();
  const cycleTime = progress * cycleDuration;

  // 逐条模式：每条路径独立 stroke 时长，无重叠依次绘制
  const perElemStroke = state.sequentialMode ? perElemStrokeDur(n) : CONST.STROKE_DUR;
  const stagger = state.sequentialMode ? perElemStroke * state.staggerFactor : 0;

  // ── 描边 ──────────────────────────────────────────────
  state.strokeElements.forEach((el, i) => {
    const offset = stagger * i;
    const localTime = Math.max(0, cycleTime - offset);

    let rawDraw: number;
    if (localTime <= perElemStroke) {
      rawDraw = localTime / perElemStroke;
    } else {
      rawDraw = 1;
    }
    const drawProgress = applyEasing(rawDraw, state.easing);

    const len = getLength(i);
    el.style.strokeDashoffset = String(len * (1 - drawProgress));
    el.style.stroke = state.strokeColor;
    el.style.strokeWidth = String(state.strokeWidth);

    let strokeOpacity: number;
    if (localTime <= perElemStroke) {
      strokeOpacity = 1;
    } else if (localTime <= perElemStroke + CONST.FILL_DUR) {
      strokeOpacity = 1 - (localTime - perElemStroke) / CONST.FILL_DUR;
    } else {
      strokeOpacity = 0;
    }

    const hasOwnFill = state.preserveOriginalColors
      ? state.originalFills[i] !== null
      : state.originalFills.some((f) => f !== null);
    const finalStrokeOp = state.keepStrokes
      ? 1
      : hasOwnFill ? strokeOpacity : 1;
    el.style.strokeOpacity = String(
      state.pathStrokeVisible[i] ? finalStrokeOp : 0
    );
  });

  // ── 填充 ──────────────────────────────────────────────
  if (state.preserveOriginalColors) {
    state.fillElements.forEach((el, i) => {
      const offset = stagger * i;
      const localTime = Math.max(0, cycleTime - offset);
      let rawFill: number;
      if (localTime <= perElemStroke) rawFill = 0;
      else if (localTime <= perElemStroke + CONST.FILL_DUR)
        rawFill = (localTime - perElemStroke) / CONST.FILL_DUR;
      else rawFill = 1;
      const fillOpacity = applyEasing(rawFill, state.easing);

      const effectiveFill = state.customFills[i] || state.originalFills[i];
      if (effectiveFill) {
        const rgb = hexToRgb(effectiveFill);
        if (rgb) el.style.fill = `rgba(${rgb.r},${rgb.g},${rgb.b},${fillOpacity})`;
        else { el.style.fill = effectiveFill; el.style.opacity = String(fillOpacity); }
      } else {
        el.style.fill = 'transparent'; el.style.opacity = '1';
      }
    });
  } else {
    state.fillElements.forEach((el, i) => {
      const offset = stagger * i;
      const localTime = Math.max(0, cycleTime - offset);
      let rawFill: number;
      if (localTime <= perElemStroke) rawFill = 0;
      else if (localTime <= perElemStroke + CONST.FILL_DUR)
        rawFill = (localTime - perElemStroke) / CONST.FILL_DUR;
      else rawFill = 1;
      const fillOpacity = applyEasing(rawFill, state.easing);

      const custom = state.customFills[i];
      if (custom) {
        const rgb = hexToRgb(custom);
        if (rgb) el.style.fill = `rgba(${rgb.r},${rgb.g},${rgb.b},${fillOpacity})`;
        else { el.style.fill = custom; el.style.opacity = String(fillOpacity); }
      } else {
        const fillRgb = getFillRgb()!;
        el.style.fill = `rgba(${fillRgb.r},${fillRgb.g},${fillRgb.b},${fillOpacity})`;
        el.style.opacity = '1';
      }
    });
  }
}

export function updateColors(): void {
  const fillColorInput = document.getElementById('fillColor') as HTMLInputElement;
  if (state.syncColors) {
    state.fillColor = state.strokeColor;
    fillColorInput.value = state.strokeColor;
    fillColorInput.disabled = true;
  } else {
    fillColorInput.disabled = false;
    state.fillColor = fillColorInput.value;
  }
  invalidateFillCache();
  state.strokeElements.forEach((el) => (el.style.stroke = state.strokeColor));
  if (state.strokeElements.length) updateElements(state.currentProgress);
}

export function resetAnimation(): void {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.animStart = performance.now();
  state.currentProgress = 0;
  tick();
}

export function tick(): void {
  if (state.paused) {
    state.rafId = null;
    return;
  }
  const now = performance.now();
  const n = state.strokeElements.length;
  const cycleDuration = state.sequentialMode
    ? elementCycle(n)
    : totalCycle();
  let rawElapsed = ((now - state.animStart) / 1000) * state.speedFactor;

  if (state.lastTickTime > 0) {
    const dt = ((now - state.lastTickTime) / 1000) * state.speedFactor;
    if (dt > 0.1) {
      state.animStart =
        now - (state.currentProgress * cycleDuration) / state.speedFactor * 1000;
      rawElapsed = ((now - state.animStart) / 1000) * state.speedFactor;
    }
  }
  state.lastTickTime = now;
  const progress = (rawElapsed % cycleDuration) / cycleDuration;
  state.currentProgress = progress;
  updateElements(progress);

  const timelineSlider = document.getElementById('timeline') as HTMLInputElement;
  const timeVal = document.getElementById('timeVal')!;
  timelineSlider.value = (progress * 100).toFixed(1);
  timeVal.textContent = Math.round(progress * 100) + '%';
  state.rafId = requestAnimationFrame(tick);
}
