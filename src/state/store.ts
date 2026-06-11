/**
 * 全局状态 & 常量
 *
 * 单一数据源：所有模块 import 同一个 state 实例。
 * state 变量通过模块直接修改（无 setter），animator 每帧读取。
 */

import type { AppState, Constants } from './types.js';

export const state: AppState = {
  // ── SVG 数据 ──
  currentData: null,           // 当前加载的 SVG 解析结果
  strokeElements: [],          // DOM 描边元素数组（每路径一个）
  fillElements: [],            // DOM 填充元素数组（每路径一个）
  originalFills: [],           // 原始 fill 颜色（null=透明/none）
  customFills: [] as (string | null)[],  // 用户在图层面板自定义的颜色
  lengths: [],                 // 每条路径的总长度（用于 stroke-dasharray）

  // ── 动画状态 ──
  currentProgress: 0,          // 当前进度 0-1
  paused: false,               // 是否暂停
  playDesired: true,           // 用户期望播放（用于键盘自动恢复判断）
  rafId: null,                 // requestAnimationFrame ID
  animStart: 0,                // 动画起始时间戳
  speedFactor: 1,              // 播放速度倍率

  // ── 颜色 ──
  strokeColor: '#ffffff',      // 全局描边色
  fillColor: '#ffffff',        // 全局填色
  syncColors: true,            // 填色跟随描边
  preserveOriginalColors: false,  // 保留原色模式
  bgColor: '#000000',          // 背景色

  // ── 动画选项 ──
  sequentialMode: false,       // 逐条绘制
  staggerFactor: 1.0,          // 逐条间隔系数
  keepStrokes: true,           // 动画结束后保留描边
  easing: 'linear',            // 缓动曲线类型
  strokeWidth: 8,              // 描边宽度

  // ── 图层 ──
  autoBgEnabled: true,         // 自动背景排序（当前始终用原始顺序）
  pathStrokeVisible: [],       // 每条路径的描边可见性

  // ── 缓存 & 内部 ──
  cachedFillRgb: null,         // fillColor 的 RGB 缓存
  cachedFillHex: '',           // 缓存对应的 hex 值
  lastTickTime: 0,             // 上一次 tick 时间戳（防后台跳变）
  keyboardResumeTimer: null,   // 键盘自动恢复计时器 ID
};

// ── 常量 ────────────────────────────────────────────────

export const CONST: Constants = {
  STROKE_DUR: 6,               // 描边阶段时长（秒）
  FILL_DUR: 1.2,               // 填色消退阶段时长（秒）
  PAUSE_TIME: 1.3,             // 完成后停顿（秒）
  KEYBOARD_RESUME_DELAY: 800,  // 键盘操作后自动恢复播放（毫秒）
  MAX_IMAGE_SIZE: 2048,        // 导出图片最大尺寸
  DEFAULT_VIEWBOX: '0 0 1024 1024',
};

/** 单次动画循环总时长（同步模式） */
export function totalCycle(): number {
  return CONST.STROKE_DUR + CONST.FILL_DUR + CONST.PAUSE_TIME;
}

/**
 * 逐条模式：每条路径的描边时长
 * 总描边时间 STROKE_DUR 平分给所有路径，最少 0.4s
 */
export function perElemStrokeDur(elemCount: number): number {
  if (elemCount <= 1) return CONST.STROKE_DUR;
  return Math.max(0.4, CONST.STROKE_DUR / elemCount);
}

/** 逐条模式：总循环时长 */
export function elementCycle(elemCount: number): number {
  if (elemCount <= 1) return totalCycle();
  const perElem = perElemStrokeDur(elemCount) * state.staggerFactor;
  return elemCount * perElem + CONST.FILL_DUR + CONST.PAUSE_TIME;
}
