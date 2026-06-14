/**
 * 动画引擎 — requestAnimationFrame 循环 + 每帧更新
 *
 * 核心函数：
 *   tick() — RAF 循环入口
 *   resetAnimation() — 重新开始动画
 *   setRenderContext() — 设置渲染目标（canvas 等）
 *
 * 通过事件总线与其他模块通信：
 *   监听: animation:play/pause/reset, svg:loaded, speed:changed 等
 *   发射: (无 — animator 是调度中心，其他模块 emit 事件驱动它)
 */

import { state, totalCycle, elementCycle } from '../state/store.js';
import { getActiveEngine, type RenderContext } from './engine-registry.js';
import { bus, Events } from './events.js';

// 重新导出 updateColors（从 stroke-engine 移入，保持测试兼容）
export { updateColors } from '../engines/stroke-engine.js';

let renderCtx: RenderContext = {};

export function setRenderContext(ctx: RenderContext) { renderCtx = ctx; }

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
  if (timelineSlider) timelineSlider.value = (progress * 100).toFixed(1);
  if (timeVal) timeVal.textContent = Math.round(progress * 100) + '%';
  state.rafId = requestAnimationFrame(tick);
}

// ── 事件监听（模块加载时自动注册）────────────────────────────

// 播放
bus.on(Events.ANIMATION_PLAY, () => {
  state.paused = false;
  const n = state.strokeElements.length;
  const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
  state.animStart = performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
  state.lastTickTime = 0;
  tick();
});

// 暂停
bus.on(Events.ANIMATION_PAUSE, () => {
  state.paused = true;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
});

// 重置
bus.on(Events.ANIMATION_RESET, () => {
  resetAnimation();
});

// 速度变更 → 调整动画基准时间
bus.on(Events.SPEED_CHANGED, ({ speed }: { speed: number }) => {
  state.speedFactor = speed;
  if (!state.paused) {
    const n = state.strokeElements.length;
    const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
    state.animStart = performance.now() - (state.currentProgress * cd) / speed * 1000;
    state.lastTickTime = 0;
  }
});

// 背景色变更（animator 跟踪 state.bgColor，不需要额外 action）
bus.on(Events.BG_COLOR_CHANGED, () => {
  // bgColor 已在 state 中更新，由 render 时读取
});

// 预设应用 → 速度/描边宽等已在 state 中更新，重设动画基准
bus.on(Events.PRESET_APPLIED, () => {
  if (!state.paused) {
    const n = state.strokeElements.length;
    const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
    state.animStart = performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
    state.lastTickTime = 0;
  }
});

// 时间轴拖动结束 → 恢复播放
bus.on(Events.TIMELINE_DRAG_END, ({ progress }: { progress: number }) => {
  state.currentProgress = progress;
  const n = state.strokeElements.length;
  const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
  state.animStart = performance.now() - (progress * cd) / state.speedFactor * 1000;
  state.lastTickTime = 0;
  state.paused = false;
  tick();
});
