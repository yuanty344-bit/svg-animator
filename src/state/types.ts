// ── 类型定义 ──────────────────────────────────────────

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface SVGElementData {
  tag: string;
  attrs: Record<string, string>;
  originalFill: string | null;
}

export interface ParsedSVG {
  viewBox: string;
  elements: SVGElementData[];
  originalElements: SVGElementData[];
  lengths?: number[];
}

export interface AppState {
  currentData: ParsedSVG | null;
  strokeElements: SVGElement[];
  fillElements: SVGElement[];
  originalFills: (string | null)[];
  customFills: (string | null)[];
  lengths: number[];
  currentProgress: number;
  paused: boolean;
  playDesired: boolean;
  rafId: number | null;
  animStart: number;
  speedFactor: number;
  strokeColor: string;
  fillColor: string;
  syncColors: boolean;
  preserveOriginalColors: boolean;
  sequentialMode: boolean;
  staggerFactor: number;
  keepStrokes: boolean;
  easing: string;
  strokeWidth: number;
  bgColor: string;
  autoBgEnabled: boolean;
  pathStrokeVisible: boolean[];
  cachedFillRgb: RGB | null;
  cachedFillHex: string;
  lastTickTime: number;
  keyboardResumeTimer: number | null;
}

export interface Constants {
  STROKE_DUR: number;
  FILL_DUR: number;
  PAUSE_TIME: number;
  KEYBOARD_RESUME_DELAY: number;
  MAX_IMAGE_SIZE: number;
  DEFAULT_VIEWBOX: string;
}
