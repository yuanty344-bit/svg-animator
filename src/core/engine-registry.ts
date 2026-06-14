/**
 * 动画引擎注册中心
 *
 * 所有引擎实现 AnimationEngine 接口 → registerEngine() → switchEngine(id) 切换。
 * 加新动画类型只需实现接口 + 注册，不动 animator.ts。
 * 切换引擎时自动发射 ENGINE_SWITCHED 事件。
 */

import { bus, Events } from './events.js';

export interface AnimationEngine {
  id: string;
  name: string;
  init(): void;                      // 初始化（加载 SVG 后调用）
  tick(progress: number): void;       // 每帧更新
  render(ctx?: RenderContext): void;  // 每帧渲染
  destroy(): void;                    // 切换时清理
}

export interface RenderContext {
  svgRoot?: SVGElement;
  canvas?: HTMLCanvasElement;
}

const engines = new Map<string, AnimationEngine>();
let activeId = 'stroke';

export function registerEngine(e: AnimationEngine): void {
  engines.set(e.id, e);
}

export function switchEngine(id: string): void {
  const from = activeId;
  const old = engines.get(from);
  if (old) old.destroy();
  const next = engines.get(id);
  if (next) {
    activeId = id;
    next.init();
    bus.emit(Events.ENGINE_SWITCHED, { from, to: id });
  }
}

export function getActiveEngine(): AnimationEngine | undefined {
  return engines.get(activeId);
}

export function getEngine(id: string): AnimationEngine | undefined {
  return engines.get(id);
}

export function getActiveId(): string {
  return activeId;
}

/** 引擎列表（供 UI 展示） */
export function getEngineList(): { id: string; name: string }[] {
  return [...engines.values()].map(e => ({ id: e.id, name: e.name }));
}
