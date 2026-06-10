// ── 全局状态 ──────────────────────────────────────────

import type { AppState, Constants } from './types.js';

export const state: AppState = {
  currentData: null,
  strokeElements: [],
  fillElements: [],
  originalFills: [],
  lengths: [],
  currentProgress: 0,
  paused: false,
  playDesired: true,
  rafId: null,
  animStart: 0,
  speedFactor: 1,
  strokeColor: '#ffffff',
  fillColor: '#ffffff',
  syncColors: true,
  preserveOriginalColors: false,
  sequentialMode: false,
  staggerFactor: 1.0,
  keepStrokes: true,
  easing: 'linear',
  strokeWidth: 8,
  bgColor: '#000000',
  autoBgEnabled: true,
  pathStrokeVisible: [],
  cachedFillRgb: null,
  cachedFillHex: '',
  lastTickTime: 0,
  keyboardResumeTimer: null,
};

export const CONST: Constants = {
  STROKE_DUR: 6,
  FILL_DUR: 1.2,
  PAUSE_TIME: 1.3,
  KEYBOARD_RESUME_DELAY: 800,
  MAX_IMAGE_SIZE: 2048,
  DEFAULT_VIEWBOX: '0 0 1024 1024',
};

export function totalCycle(): number {
  return CONST.STROKE_DUR + CONST.FILL_DUR + CONST.PAUSE_TIME;
}

/** 逐条模式：每条路径平分 stroke 时间，最少 0.4s */
export function perElemStrokeDur(elemCount: number): number {
  if (elemCount <= 1) return CONST.STROKE_DUR;
  return Math.max(0.4, CONST.STROKE_DUR / elemCount);
}

export function elementCycle(elemCount: number): number {
  if (elemCount <= 1) return totalCycle();
  const perElem = perElemStrokeDur(elemCount) * state.staggerFactor;
  return elemCount * perElem + CONST.FILL_DUR + CONST.PAUSE_TIME;
}
