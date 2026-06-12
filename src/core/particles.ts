/**
 * 粒子动画引擎
 *
 * 路径 → 采样点 → 粒子从四周飞入 → 聚合为原图 → 循环
 */
import { state, CONST, totalCycle, elementCycle } from '../state/store.js';
import { getLength } from './renderer.js';

export interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  life: number;      // 0→1 飞行进度
  color: string;
  size: number;
  delay: number;     // 启动延迟（秒）
}

interface ParticleGroup {
  pathIndex: number;
  particles: Particle[];
}

let groups: ParticleGroup[] = [];
let initialized = false;
let animTime = 0;
let cycleDuration = 8.5;
let lastResetTime = 0;

const DENSITY = 3;           // 每像素采样点数
const MAX_TOTAL = 6000;      // 粒子总数上限
const SPREAD = 400;          // 初始散布半径
const FLIGHT_TIME = 2.5;     // 飞行时间（秒）

/** 初始化粒子 */
export function initParticles(): number {
  if (!state.currentData || state.strokeElements.length === 0) return 0;
  groups = [];
  const n = state.strokeElements.length;
  cycleDuration = state.sequentialMode ? elementCycle(n) : totalCycle();

  const previewSvg = document.getElementById('previewSvg')!;
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

    // 颜色
    const c = state.customFills[pathIndex]
      || (state.preserveOriginalColors ? state.originalFills[pathIndex] : null)
      || state.strokeColor;

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      try {
        const pt = (el as SVGGeometryElement).getPointAtLength(t * len);
        // SVG坐标 → 百分比坐标（0-1）
        const tx = pt.x / svgW;
        const ty = pt.y / svgH;
        // 随机初始位置：从外围飞入
        const angle = Math.random() * Math.PI * 2;
        const dist = SPREAD * (0.3 + Math.random() * 0.7);
        particles.push({
          x: 0, y: 0,    // 渲染时计算
          targetX: tx,
          targetY: ty,
          startX: 0.5 + Math.cos(angle) * dist / svgW,
          startY: 0.5 + Math.sin(angle) * dist / svgH,
          life: 0,
          color: c,
          size: 2.0 + Math.random() * 2.0,
          delay: state.sequentialMode
            ? pathIndex * state.staggerFactor * (6 / Math.max(1, n))
            : Math.random() * 0.15,
        });
      } catch {
        // getPointAtLength 失败，跳过
      }
    }
    if (particles.length > 0) {
      groups.push({ pathIndex, particles });
      total += particles.length;
    }
  });

  animTime = 0;
  lastResetTime = 0;
  initialized = true;
  return total;
}

/** 每帧更新 */
export function updateParticles(dt: number): void {
  if (!initialized || groups.length === 0) return;

  const dtClamped = Math.min(dt, 0.05); // 防止大帧跳跃
  animTime += dtClamped;

  // 循环重置：动画时间超过一个周期时重新初始化
  if (animTime >= cycleDuration - 0.1) {
    animTime = 0;
    groups.forEach(g => g.particles.forEach(p => {
      p.life = 0;
      p.startX = 0.5 + (Math.random() - 0.5) * SPREAD / 600;
      p.startY = 0.5 + (Math.random() - 0.5) * SPREAD / 600;
      p.delay = state.sequentialMode
        ? g.pathIndex * state.staggerFactor * (6 / Math.max(1, groups.length))
        : Math.random() * 0.1;
    }));
  }

  groups.forEach(g => {
    g.particles.forEach(p => {
      if (animTime < p.delay) return;
      const elapsed = animTime - p.delay;
      p.life = Math.min(1, elapsed / FLIGHT_TIME);
    });
  });
}

/** 渲染到 canvas */
export function renderParticles(cvs: HTMLCanvasElement): void {
  if (!initialized || groups.length === 0) return;
  const ctx = cvs.getContext('2d')!;
  const w = cvs.width;
  const h = cvs.height;

  // 清屏 + 轻微拖尾
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, w, h);

  groups.forEach(g => {
    g.particles.forEach(p => {
      if (animTime < p.delay || p.life <= 0) return;
      // smooth ease-out
      const t = 1 - Math.pow(1 - p.life, 2.5);
      const px = (p.startX + (p.targetX - p.startX) * t) * w;
      const py = (p.startY + (p.targetY - p.startY) * t) * h;

      const alpha = Math.min(1, t * 1.5);
      const r = parseInt(p.color.slice(1, 3), 16) || 255;
      const g = parseInt(p.color.slice(3, 5), 16) || 255;
      const b = parseInt(p.color.slice(5, 7), 16) || 255;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (0.8 + t * 0.2), 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

export function destroyParticles(): void {
  groups = [];
  initialized = false;
  animTime = 0;
}

export function getParticleCount(): number {
  return groups.reduce((s, g) => s + g.particles.length, 0);
}
