/**
 * Stroke 描边动画引擎
 *
 * 实现 AnimationEngine 接口，负责 stroke-dasharray 描边绘制 + fill 淡入。
 * 包含 updateColors()（颜色同步 + 重新渲染），通过事件总线与其他模块通信。
 */
import type { AnimationEngine } from '../core/engine-registry.js';
import { state, CONST, totalCycle, elementCycle, perElemStrokeDur } from '../state/store.js';
import { rebuildPreviewDOM, getLength } from '../core/renderer.js';
import { hexToRgb, applyEasing } from '../utils/helpers.js';
import { bus, Events } from '../core/events.js';

export function invalidateFillCache(): void { state.cachedFillRgb = null; state.cachedFillHex = ''; }

function getFillRgb() {
  if (state.cachedFillRgb && state.cachedFillHex === state.fillColor) return state.cachedFillRgb;
  state.cachedFillHex = state.fillColor;
  state.cachedFillRgb = hexToRgb(state.fillColor);
  return state.cachedFillRgb!;
}

export function updateElements(progress: number): void {
  const n = state.strokeElements.length;
  const perElemStroke = state.sequentialMode ? perElemStrokeDur(n) : CONST.STROKE_DUR;
  const stagger = state.sequentialMode ? perElemStroke * state.staggerFactor : 0;
  const cycleDuration = state.sequentialMode ? elementCycle(n) : totalCycle();
  const cycleTime = progress * cycleDuration;

  state.strokeElements.forEach((el, i) => {
    const offset = stagger * i;
    const localTime = Math.max(0, cycleTime - offset);
    let rawDraw = localTime <= perElemStroke ? localTime / perElemStroke : 1;
    const dp = applyEasing(rawDraw, state.easing);
    const len = getLength(i);
    el.style.strokeDashoffset = String(len * (1 - dp));
    el.style.stroke = state.strokeColor;
    el.style.strokeWidth = String(state.strokeWidth);

    let strokeOpacity: number;
    if (localTime <= perElemStroke) strokeOpacity = 1;
    else if (localTime <= perElemStroke + CONST.FILL_DUR) strokeOpacity = 1 - (localTime - perElemStroke) / CONST.FILL_DUR;
    else strokeOpacity = 0;

    const hasOwnFill = state.preserveOriginalColors
      ? state.originalFills[i] !== null
      : state.originalFills.some((f: string | null) => f !== null);
    el.style.strokeOpacity = String(state.pathStrokeVisible[i] && hasOwnFill ? (state.keepStrokes ? 1 : strokeOpacity) : (state.pathStrokeVisible[i] ? 1 : 0));
  });

  if (state.preserveOriginalColors) {
    state.fillElements.forEach((el, i) => {
      const offset = stagger * i;
      const localTime = Math.max(0, cycleTime - offset);
      const perElem = perElemStroke;
      let rawFill = 0;
      if (localTime > perElem) rawFill = localTime <= perElem + CONST.FILL_DUR ? (localTime - perElem) / CONST.FILL_DUR : 1;
      const fo = applyEasing(rawFill, state.easing);
      const eff = state.customFills[i] || state.originalFills[i];
      if (eff) {
        const rgb = hexToRgb(eff);
        if (rgb) el.style.fill = `rgba(${rgb.r},${rgb.g},${rgb.b},${fo})`;
        else { el.style.fill = eff; el.style.opacity = String(fo); }
      } else { el.style.fill = 'transparent'; el.style.opacity = '1'; }
    });
  } else {
    state.fillElements.forEach((el, i) => {
      const offset = stagger * i;
      const localTime = Math.max(0, cycleTime - offset);
      let rawFill = 0;
      if (localTime > perElemStroke) rawFill = localTime <= perElemStroke + CONST.FILL_DUR ? (localTime - perElemStroke) / CONST.FILL_DUR : 1;
      const fo = applyEasing(rawFill, state.easing);
      const cust = state.customFills[i];
      if (cust) {
        const rgb = hexToRgb(cust);
        if (rgb) el.style.fill = `rgba(${rgb.r},${rgb.g},${rgb.b},${fo})`;
        else { el.style.fill = cust; el.style.opacity = String(fo); }
      } else {
        const fr = getFillRgb();
        el.style.fill = `rgba(${fr.r},${fr.g},${fr.b},${fo})`;
        el.style.opacity = '1';
      }
    });
  }
}

// ── updateColors — 颜色同步 & 重新渲染 ──────────────────────

export function updateColors(): void {
  const fillColorInput = document.getElementById('fillColor') as HTMLInputElement;
  if (state.syncColors) {
    state.fillColor = state.strokeColor;
    if (fillColorInput) fillColorInput.value = state.strokeColor;
    if (fillColorInput) fillColorInput.disabled = true;
  } else {
    if (fillColorInput) fillColorInput.disabled = false;
    if (fillColorInput) state.fillColor = fillColorInput.value;
  }
  invalidateFillCache();
  state.strokeElements.forEach((el) => (el.style.stroke = state.strokeColor));
  if (state.strokeElements.length) updateElements(state.currentProgress);
}

// ── 事件监听 ──────────────────────────────────────────────

// 颜色变更 → 重新渲染描边/填充
bus.on(Events.COLOR_CHANGED, () => {
  updateColors();
});

// 模式变更 → 更新当前帧渲染
bus.on(Events.MODE_CHANGED, () => {
  if (state.strokeElements.length) updateElements(state.currentProgress);
});

// 时间轴拖动 → 更新渲染
bus.on(Events.TIMELINE_SEEK, ({ progress }: { progress: number }) => {
  if (state.strokeElements.length) updateElements(progress);
});

// 描边宽度变更
bus.on(Events.STROKE_WIDTH_CHANGED, ({ width }: { width: number }) => {
  state.strokeElements.forEach((el) => (el.style.strokeWidth = String(width)));
});

// 图层可见性 / 颜色变更
bus.on(Events.LAYER_VISIBILITY_CHANGED, () => {
  if (state.strokeElements.length) updateElements(state.currentProgress);
});
bus.on(Events.LAYER_COLOR_CHANGED, () => {
  if (state.strokeElements.length) updateElements(state.currentProgress);
});
bus.on(Events.LAYER_COLORS_RESET, () => {
  if (state.strokeElements.length) updateElements(state.currentProgress);
});

// ── 引擎实例 ──────────────────────────────────────────────

export const strokeEngine: AnimationEngine = {
  id: 'stroke',
  name: '描边动画',

  init() {
    if (!state.currentData) return;
    rebuildPreviewDOM();
    updateColors();
    state.playDesired = true;
    state.paused = false;
    state.currentProgress = 0;
  },

  tick(progress: number) {
    updateElements(progress);
  },

  render() {
    // Stroke engine updates DOM in tick(), no additional render needed
  },

  destroy() {
    // 不清理 strokeElements/fillElements — 粒子引擎需要它们来采样路径
  },
};
