/**
 * 粒子动画引擎
 *
 * 完全跟随时间轴进度（state.currentProgress），自动循环
 */
import { state, totalCycle, elementCycle } from '../state/store.js';
import { getLength } from './renderer.js';

interface Particle {
  targetX: number;   // 目标位置（0-1 比例）
  targetY: number;
  startX: number;    // 初始位置（0-1 比例）
  startY: number;
  color: string;
  size: number;
  delay: number;     // 启动延迟（0-1，占周期的比例）
}

interface ParticleGroup {
  particles: Particle[];
}

let groups: ParticleGroup[] = [];
let initialized = false;
let cycleDuration = 8.5;
let lastProgress = -1;

const DENSITY = 2.5;
const MAX_TOTAL = 5000;
const FLIGHT_TIME = 0.35;  // 飞行时间占周期的比例

export function initParticles(): number {
  if (!state.currentData || state.strokeElements.length === 0) return 0;
  groups = [];
  const n = state.strokeElements.length;
  cycleDuration = state.sequentialMode ? elementCycle(n) : totalCycle();

  const vb = state.currentData.viewBox.split(' ').map(Number);
  const svgW = vb[2] || 1024;
  const svgH = vb[3] || 1024;

  let total = 0;
  const maxPerPath = Math.floor(MAX_TOTAL / Math.max(1, n));

  state.strokeElements.forEach((el, pathIndex) => {
    if (!state.pathStrokeVisible[pathIndex]) return;
    const len = getLength(pathIndex);
    if (len <= 0) return;
    const count = Math.min(maxPerPath, Math.round(len * DENSITY / (svgW / 400)));
    if (count <= 0) return;

    const c = state.customFills[pathIndex]
      || (state.preserveOriginalColors ? state.originalFills[pathIndex] : null)
      || state.strokeColor;

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      try {
        const pt = (el as SVGGeometryElement).getPointAtLength(t * len);
        const tx = pt.x / svgW;
        const ty = pt.y / svgH;

        // 从屏幕外四个方向之一随机飞入
        const side = Math.floor(Math.random() * 4);
        let sx: number, sy: number;
        switch (side) {
          case 0: sx = -0.3 + Math.random() * 0.3; sy = Math.random(); break;         // 左边
          case 1: sx = 1.0 + Math.random() * 0.3; sy = Math.random(); break;           // 右边
          case 2: sx = Math.random(); sy = -0.3 + Math.random() * 0.3; break;          // 上边
          default: sx = Math.random(); sy = 1.0 + Math.random() * 0.3; break;          // 下边
        }

        particles.push({
          targetX: tx, targetY: ty,
          startX: sx, startY: sy,
          color: c,
          size: 1.8 + Math.random() * 2.2,
          delay: state.sequentialMode
            ? (pathIndex * state.staggerFactor * (6 / Math.max(1, n))) / cycleDuration
            : Math.random() * 0.02,
        });
      } catch { /* skip */ }
    }
    if (particles.length > 0) {
      groups.push({ particles });
      total += particles.length;
    }
  });

  lastProgress = -1;
  initialized = true;
  return total;
}

export function updateParticles(_dt: number): void {
  // progress 由 animator 的 tick() 驱动，这里不需要独立时钟
}

export function renderParticles(cvs: HTMLCanvasElement): void {
  if (!initialized || groups.length === 0) return;
  const ctx = cvs.getContext('2d')!;
  const w = cvs.width;
  const h = cvs.height;

  const progress = state.currentProgress;
  const cycleTime = progress * cycleDuration;

  // 新周期开始：重新随机初始位置
  if (progress < lastProgress && lastProgress > 0.9) {
    groups.forEach(g => g.particles.forEach(p => {
      const side = Math.floor(Math.random() * 4);
      switch (side) {
        case 0: p.startX = -0.3 + Math.random() * 0.3; p.startY = Math.random(); break;
        case 1: p.startX = 1.0 + Math.random() * 0.3; p.startY = Math.random(); break;
        case 2: p.startX = Math.random(); p.startY = -0.3 + Math.random() * 0.3; break;
        default: p.startX = Math.random(); p.startY = 1.0 + Math.random() * 0.3; break;
      }
    }));
  }
  lastProgress = progress;

  // 半透明背景产生拖尾
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, w, h);

  groups.forEach(g => {
    g.particles.forEach(p => {
      const localTime = Math.max(0, cycleTime - p.delay * cycleDuration);
      const flightDuration = cycleDuration * FLIGHT_TIME;
      const life = Math.min(1, localTime / Math.max(0.01, flightDuration));
      if (life <= 0) return;

      // 平滑缓出曲线
      const t = 1 - Math.pow(1 - life, 2.5);

      // 插值：初始位置 → 目标位置
      const px = (p.startX + (p.targetX - p.startX) * t) * w;
      const py = (p.startY + (p.targetY - p.startY) * t) * h;

      // 剪裁到画布内
      if (px < -10 || px > w + 10 || py < -10 || py > h + 10) return;

      const alpha = Math.min(1, life * 2);
      const r = parseInt(p.color.slice(1, 3), 16) || 255;
      const g = parseInt(p.color.slice(3, 5), 16) || 255;
      const b = parseInt(p.color.slice(5, 7), 16) || 255;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

export function destroyParticles(): void {
  groups = [];
  initialized = false;
  lastProgress = -1;
}

export function getParticleCount(): number {
  return groups.reduce((s, g) => s + g.particles.length, 0);
}
