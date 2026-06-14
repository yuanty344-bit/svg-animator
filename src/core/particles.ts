/**
 * 粒子动画引擎 v3 — 简洁可靠
 *
 * - 粒子在预览区内部随机散布，向 target 飞行
 * - 完全跟随 time 参数（可以是 currentProgress 或独立时钟）
 * - 每周期自动重设粒子起点
 */
import { state, totalCycle, elementCycle } from '../state/store.js';
import { getLength } from './renderer.js';
import type { AnimationEngine } from './engine-registry.js';

let groups: { particles: { tx:number; ty:number; sx:number; sy:number; col:string; sz:number; dr:number }[] }[] = [];
let initialized = false;
let cycleDur = 8.5;
let lastP = -1;

export function initParticles(): number {
  if (!state.currentData || state.strokeElements.length === 0) return 0;
  const n = state.strokeElements.length;
  cycleDur = state.sequentialMode ? elementCycle(n) : totalCycle();
  groups = [];

  const vb = state.currentData.viewBox.split(' ').map(Number);
  const sw = vb[2] || 1024;
  const sh = vb[3] || 1024;
  let total = 0;
  const maxPer = Math.floor(4000 / Math.max(1, n));

  state.strokeElements.forEach((el, pi) => {
    if (!state.pathStrokeVisible[pi]) return;
    const len = getLength(pi);
    if (len <= 0) return;
    const count = Math.min(maxPer, Math.round(len * 2 / (sw / 400)));
    if (count <= 0) return;

    const col = state.customFills[pi]
      || (state.preserveOriginalColors ? state.originalFills[pi] : null)
      || state.strokeColor;

    const pts: { tx:number; ty:number; sx:number; sy:number; col:string; sz:number; dr:number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      try {
        const pt = (el as SVGGeometryElement).getPointAtLength(t * len);
        const angle = Math.random() * Math.PI * 2;
        const rad = 0.1 + Math.random() * 0.4;
        pts.push({
          tx: pt.x / sw, ty: pt.y / sh,
          sx: 0.5 + Math.cos(angle) * rad,
          sy: 0.5 + Math.sin(angle) * rad,
          col, sz: 1.5 + Math.random() * 3,
          dr: state.sequentialMode ? (pi * state.staggerFactor * 6 / Math.max(1,n)) / cycleDur : Math.random() * 0.02,
        });
        total++;
      } catch { /* skip */ }
    }
    if (pts.length > 0) groups.push({ particles: pts });
  });

  lastP = -1;
  initialized = true;
  return total;
}

export function updateParticles(_dt: number): void {}

/** 渲染粒子。time = 当前周期内时间（秒） */
export function renderParticles(cvs: HTMLCanvasElement): void {
  if (!initialized || groups.length === 0) return;
  const ctx = cvs.getContext('2d')!;
  const w = cvs.width, h = cvs.height;
  const p = state.currentProgress;

  // 周期回绕检测
  if (lastP > 0.85 && p < 0.15) {
    groups.forEach(g => g.particles.forEach(pt => {
      const a = Math.random() * Math.PI * 2;
      const r = 0.1 + Math.random() * 0.4;
      pt.sx = 0.5 + Math.cos(a) * r;
      pt.sy = 0.5 + Math.sin(a) * r;
    }));
  }
  lastP = p;

  const cycleTime = p * cycleDur;
  const flightDur = cycleDur * 0.7;

  // 背景色（读当前 state.bgColor）
  const bg = state.bgColor || '#000';
  const r0 = parseInt(bg.slice(1,3),16), g0 = parseInt(bg.slice(3,5),16), b0 = parseInt(bg.slice(5,7),16);
  ctx.fillStyle = `rgba(${r0},${g0},${b0},0.25)`;
  ctx.fillRect(0, 0, w, h);

  // 进度为 0 时清空，不画粒子
  if (p < 0.001) return;

  groups.forEach(g => {
    g.particles.forEach(pt => {
      const local = Math.max(0, cycleTime - pt.dr * cycleDur);
      const life = Math.min(1, local / Math.max(0.01, flightDur));
      if (life <= 0) return;

      const t = 1 - Math.pow(1 - life, 3);
      const px = (pt.sx + (pt.tx - pt.sx) * t) * w;
      const py = (pt.sy + (pt.ty - pt.sy) * t) * h;

      const alpha = life < 0.3 ? life / 0.3 : 1;
      const r = parseInt(pt.col.slice(1, 3), 16) || 255;
      const g = parseInt(pt.col.slice(3, 5), 16) || 255;
      const b = parseInt(pt.col.slice(5, 7), 16) || 255;

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, pt.sz, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

export function destroyParticles(): void { groups = []; initialized = false; lastP = -1; }
export function getParticleCount(): number { return groups.reduce((s, g) => s + g.particles.length, 0); }

export const particleEngine: AnimationEngine = {
  id: 'particle',
  name: '粒子动画',

  init() {
    if (!state.currentData) return;
    initParticles();
  },

  tick(progress: number) {
    updateParticles(1 / 60);
  },

  render(ctx) {
    if (ctx?.canvas) renderParticles(ctx.canvas);
  },

  destroy() {
    destroyParticles();
  },
};
