/**
 * 动画引擎 — requestAnimationFrame 循环 + 每帧更新
 *
 * 核心函数：
 *   tick() — RAF 循环入口
 *   updateElements(progress) — 根据进度更新所有描边/填充状态
 *   updateColors() — 颜色变更时重新渲染
 */

import { state, CONST, totalCycle, elementCycle } from '../state/store.js';
import { getActiveEngine, type RenderContext } from './engine-registry.js';
import { updateElements, invalidateFillCache } from '../engines/stroke-engine.js';

let renderCtx: RenderContext = {};

export function setRenderContext(ctx: RenderContext) { renderCtx = ctx; }

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

  const engine = getActiveEngine();
  if (engine) {
    engine.tick(progress);
    engine.render(renderCtx);
  }

  const timelineSlider = document.getElementById('timeline') as HTMLInputElement;
  const timeVal = document.getElementById('timeVal')!;
  timelineSlider.value = (progress * 100).toFixed(1);
  timeVal.textContent = Math.round(progress * 100) + '%';
  state.rafId = requestAnimationFrame(tick);
}
