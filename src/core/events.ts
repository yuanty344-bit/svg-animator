/**
 * 事件总线 — 模块间松耦合通信
 *
 * 控件 emit 事件 → 引擎/模块 on 监听 → 无需直接 import。
 * 加新功能只需监听已有事件 + 发射新事件，不动其他模块。
 *
 * 用法：
 *   import { bus, Events } from './events.js';
 *   bus.on(Events.COLOR_CHANGED, ({ type }) => { ... });
 *   bus.emit(Events.COLOR_CHANGED, { type: 'stroke' });
 */

// ── EventBus 实现 ──────────────────────────────────────────

type Listener = (...args: any[]) => void;

export class EventBus {
  private _listeners = new Map<string, Set<Listener>>();

  /** 订阅事件，返回取消订阅函数 */
  on(event: string, fn: Listener): () => void {
    let s = this._listeners.get(event);
    if (!s) {
      s = new Set();
      this._listeners.set(event, s);
    }
    s.add(fn);
    return () => {
      s!.delete(fn);
    };
  }

  /** 单次订阅 */
  once(event: string, fn: Listener): () => void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  /** 取消订阅 */
  off(event: string, fn: Listener): void {
    this._listeners.get(event)?.delete(fn);
  }

  /** 发射事件 */
  emit(event: string, ...args: any[]): void {
    this._listeners.get(event)?.forEach(fn => fn(...args));
  }

  /** 移除事件的所有监听器（或全部事件） */
  removeAll(event?: string): void {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }

  /** 调试：某事件的监听器数量 */
  listenerCount(event: string): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}

// ── 单例 ──────────────────────────────────────────────────

export const bus = new EventBus();

// ── 事件名常量 ────────────────────────────────────────────

export const Events = {
  // SVG 生命周期
  SVG_LOADED: 'svg:loaded',
  SVG_PARSE_ERROR: 'svg:parse-error',

  // 颜色
  COLOR_CHANGED: 'color:changed',

  // 动画模式
  MODE_CHANGED: 'mode:changed',

  // 动画控制
  ANIMATION_PLAY: 'animation:play',
  ANIMATION_PAUSE: 'animation:pause',
  ANIMATION_RESET: 'animation:reset',

  // 时间轴
  TIMELINE_SEEK: 'timeline:seek',
  TIMELINE_DRAG_END: 'timeline:drag-end',

  // 引擎切换
  ENGINE_SWITCHED: 'engine:switched',

  // 速度
  SPEED_CHANGED: 'speed:changed',

  // 描边宽度
  STROKE_WIDTH_CHANGED: 'stroke-width:changed',

  // 背景色
  BG_COLOR_CHANGED: 'bg:color-changed',

  // 图层
  LAYER_VISIBILITY_CHANGED: 'layer:visibility-changed',
  LAYER_COLOR_CHANGED: 'layer:color-changed',
  LAYER_COLORS_RESET: 'layer:colors-reset',

  // 预设
  PRESET_APPLIED: 'preset:applied',

  // 主题
  THEME_CHANGED: 'theme:changed',

  // 导出
  EXPORT_REQUESTED: 'export:requested',
} as const;
