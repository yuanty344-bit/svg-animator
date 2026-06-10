// ── 全局状态（单一数据源，所有模块共享） ────────────────

export const state = {
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
  strokeWidth: 8,
  bgColor: '#000000',
  autoBgEnabled: true,
  pathStrokeVisible: [],
  cachedFillRgb: null,
  cachedFillHex: '',
  lastTickTime: 0,
  keyboardResumeTimer: null,
};

// ── 常量 ────────────────────────────────────────────────

export const CONST = {
  STROKE_DUR: 6,
  FILL_DUR: 1.2,
  PAUSE_TIME: 1.3,
  KEYBOARD_RESUME_DELAY: 800,
  MAX_IMAGE_SIZE: 2048,
  DEFAULT_VIEWBOX: '0 0 1024 1024',
};

export function totalCycle() {
  return CONST.STROKE_DUR + CONST.FILL_DUR + CONST.PAUSE_TIME;
}
