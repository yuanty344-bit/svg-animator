/**
 * 纯工具函数 — 无副作用，无 DOM 依赖
 */

import type { RGB } from '../state/types.js';

export function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeViewBox(vb: string): string {
  return vb.trim().replace(/,/g, ' ').split(/\s+/).join(' ');
}

export function parseViewBoxParts(vb: string): [number, number, number, number] {
  const parts = normalizeViewBox(vb).split(' ');
  const nums = parts.map(Number);
  if (nums.length >= 4 && nums.every((n) => !isNaN(n)))
    return nums as [number, number, number, number];
  return [0, 0, 1024, 1024];
}

export function parseColor(val: string): string | null {
  const v = val.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v.startsWith('rgb')) return v;
  if (v.startsWith('#')) {
    if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return v;
  }
  return v;
}

export function hexToRgb(hex: string): RGB | null {
  if (!hex || !hex.startsWith('#')) return null;
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** 缓动函数 */
export function applyEasing(t: number, type: string): number {
  switch (type) {
    case 'ease-in': return t * t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default: return t; // linear
  }
}

export function withTempSVG<T>(viewBox: string, fn: (svg: SVGElement) => T): T {
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('viewBox', viewBox);
  tmp.style.cssText =
    'position:absolute;visibility:hidden;width:1024px;height:1024px;pointer-events:none';
  document.body.appendChild(tmp);
  try {
    return fn(tmp);
  } finally {
    document.body.removeChild(tmp);
  }
}
