// ── 动画引擎 ────────────────────────────────────────────

import { state, CONST, totalCycle } from './state.js';
import { getLength } from './renderer.js';
import { hexToRgb } from './utils.js';

// ── HexToRgb 缓存 ──────────────────────────────────────

function getFillRgb() {
  if (state.cachedFillRgb && state.cachedFillHex === state.fillColor)
    return state.cachedFillRgb;
  state.cachedFillHex = state.fillColor;
  state.cachedFillRgb = hexToRgb(state.fillColor);
  return state.cachedFillRgb;
}

export function invalidateFillCache() {
  state.cachedFillRgb = null;
  state.cachedFillHex = '';
}

// ── 每帧更新 ────────────────────────────────────────────

export function updateElements(progress) {
  const cycleTime = progress * totalCycle();
  let drawProgress, fillOpacity;
  if (cycleTime <= CONST.STROKE_DUR) {
    drawProgress = cycleTime / CONST.STROKE_DUR;
    fillOpacity = 0;
  } else if (cycleTime <= CONST.STROKE_DUR + CONST.FILL_DUR) {
    drawProgress = 1;
    fillOpacity = (cycleTime - CONST.STROKE_DUR) / CONST.FILL_DUR;
  } else {
    drawProgress = 1;
    fillOpacity = 1;
  }

  // 描边消退
  let strokeOpacity;
  if (cycleTime <= CONST.STROKE_DUR) {
    strokeOpacity = 1;
  } else if (cycleTime <= CONST.STROKE_DUR + CONST.FILL_DUR) {
    strokeOpacity = 1 - (cycleTime - CONST.STROKE_DUR) / CONST.FILL_DUR;
  } else {
    strokeOpacity = 0;
  }

  state.strokeElements.forEach((el, i) => {
    const len = getLength(i);
    el.style.strokeDashoffset = len * (1 - drawProgress);
    el.style.stroke = state.strokeColor;
    el.style.strokeWidth = state.strokeWidth;
    const hasOwnFill = state.preserveOriginalColors
      ? state.originalFills[i] !== null
      : state.originalFills.some((f) => f !== null);
    el.style.strokeOpacity =
      state.pathStrokeVisible[i] && hasOwnFill
        ? strokeOpacity
        : state.pathStrokeVisible[i]
          ? 1
          : 0;
  });

  if (state.preserveOriginalColors) {
    state.fillElements.forEach((el, i) => {
      const origFill = state.originalFills[i];
      if (origFill) {
        const rgb = hexToRgb(origFill);
        if (rgb) {
          el.style.fill =
            'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + fillOpacity + ')';
        } else {
          el.style.fill = origFill;
          el.style.opacity = fillOpacity;
        }
      } else {
        el.style.fill = 'transparent';
        el.style.opacity = 1;
      }
    });
  } else {
    const fillRgb = getFillRgb();
    state.fillElements.forEach((el) => {
      el.style.fill =
        'rgba(' + fillRgb.r + ',' + fillRgb.g + ',' + fillRgb.b + ',' + fillOpacity + ')';
      el.style.opacity = 1;
    });
  }
}

// ── 颜色更新 ────────────────────────────────────────────

export function updateColors() {
  const fillColorInput = document.getElementById('fillColor');
  const syncCheckbox = document.getElementById('syncColors');
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

// ── 动画循环 ────────────────────────────────────────────

function setPlayIcon(pause) {
  const playIcon = document.getElementById('playIcon');
  playIcon.innerHTML = pause
    ? '<rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/>'
    : '<polygon points="6,4 20,12 6,20" fill="currentColor"/>';
}

export function resetAnimation() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.animStart = performance.now();
  state.currentProgress = 0;
  tick();
}

export function tick() {
  if (state.paused) {
    state.rafId = null;
    return;
  }
  const now = performance.now();
  let rawElapsed = ((now - state.animStart) / 1000) * state.speedFactor;
  if (state.lastTickTime > 0) {
    const dt = ((now - state.lastTickTime) / 1000) * state.speedFactor;
    const maxDt = 0.1;
    if (dt > maxDt) {
      state.animStart =
        now - (state.currentProgress * totalCycle()) / state.speedFactor * 1000;
      rawElapsed = ((now - state.animStart) / 1000) * state.speedFactor;
    }
  }
  state.lastTickTime = now;
  const cyclePos = rawElapsed % totalCycle();
  const progress = cyclePos / totalCycle();
  state.currentProgress = progress;
  updateElements(progress);

  const timelineSlider = document.getElementById('timeline');
  const timeVal = document.getElementById('timeVal');
  timelineSlider.value = (progress * 100).toFixed(1);
  timeVal.textContent = Math.round(progress * 100) + '%';
  state.rafId = requestAnimationFrame(tick);
}
