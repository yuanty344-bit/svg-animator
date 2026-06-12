/**
 * 粒子动画引擎
 *
 * SVG 路径 → 离散采样 → 粒子 → 物理飞向目标 → 聚合为原图案
 *
 * 每个粒子: { x, y, targetX, targetY, vx, vy, life, color, size }
 * 每帧: 向目标位置加速 + 阻尼衰减 + 画到 canvas
 */

import { state, CONST } from '../state/store.js';
import { getLength } from './renderer.js';

export interface Particle {
  x: number;        // 当前位置
  y: number;
  targetX: number;  // 目标位置（SVG 路径采样点）
  targetY: number;
  vx: number;       // 速度
  vy: number;
  life: number;     // 生命周期进度 0→1
  color: string;    // RGBA 颜色
  size: number;     // 粒子大小
  delay: number;    // 延迟启动
}

interface ParticleGroup {
  pathIndex: number;
  color: string;
  particles: Particle[];
  startTime: number;  // 此组粒子的启动时间（秒）
}

let groups: ParticleGroup[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animationTime = 0;
let initialized = false;

const PARTICLE_DENSITY = 2;  // 每像素采样点数（越高越多粒子）
const MAX_PARTICLES = 8000;  // 粒子上限
const SPREAD = 300;          // 粒子初始散布半径
const FLIGHT_DURATION = 4;   // 飞行持续时间（秒）
const PARTICLE_SIZE = 2.5;

/** 从当前 SVG 数据生成粒子 */
export function initParticles(): number {
  if (!state.currentData) return 0;
  groups = [];

  const previewSvg = document.getElementById('previewSvg')!;
  const rect = previewSvg.getBoundingClientRect();
  const vb = state.currentData.viewBox.split(' ').map(Number);
  const scaleX = rect.width / (vb[2] || 1024);
  const scaleY = rect.height / (vb[3] || 1024);
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  let totalParticles = 0;

  state.strokeElements.forEach((el, pathIndex) => {
    if (!state.pathStrokeVisible[pathIndex]) return;
    const len = getLength(pathIndex);
    if (len <= 0) return;

    // 根据路径长度决定粒子数量
    const rawCount = Math.round(len * PARTICLE_DENSITY / scaleX);
    const count = Math.min(rawCount, Math.floor((MAX_PARTICLES - totalParticles) / (state.strokeElements.length - pathIndex)));
    if (count <= 0) return;

    // 颜色
    const customColor = state.customFills[pathIndex];
    const origColor = state.originalFills[pathIndex];
    const uniformColor = state.fillColor;
    let color: string;
    if (customColor) color = customColor;
    else if (state.preserveOriginalColors && origColor) color = origColor;
    else color = uniformColor;

    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const t = i / count;
      // 使用 stroke-dashoffset 逻辑获取路径上的点
      // 简化：基于路径总长的百分比采样
      const pointLen = t * len;
      // 随机初始位置：围绕屏幕中心散布
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * SPREAD * (0.5 + Math.random() * 0.5);

      particles.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        targetX: 0,  // 将在渲染时从 SVG 采样
        targetY: 0,
        vx: 0,
        vy: 0,
        life: 0,
        color,
        size: PARTICLE_SIZE * (0.5 + Math.random()),
        delay: state.sequentialMode
          ? pathIndex * state.staggerFactor * perElemStrokeDur_calc(state.strokeElements.length)
          : Math.random() * 0.3,  // 微小随机延迟，更自然
      });
    }

    groups.push({ pathIndex, color, particles, startTime: 0 });
    totalParticles += count;
  });

  // 计算每组的启动时间（逐条模式）
  if (state.sequentialMode && groups.length > 0) {
    const stagger = state.staggerFactor * (6 / Math.max(1, groups.length));
    groups.forEach((g, i) => { g.startTime = i * stagger; });
  } else {
    groups.forEach(g => { g.startTime = Math.random() * 0.2; });
  }

  animationTime = 0;
  initialized = true;
  return totalParticles;
}

function perElemStrokeDur_calc(n: number): number {
  if (n <= 1) return 6;
  return Math.max(0.4, 6 / n);
}

/** 每帧更新粒子物理 */
export function updateParticles(dt: number): void {
  if (!initialized) return;
  animationTime += dt;

  groups.forEach(group => {
    if (animationTime < group.startTime) return;
    const localTime = animationTime - group.startTime;

    group.particles.forEach(p => {
      if (localTime < p.delay) return;

      const elapsed = localTime - p.delay;
      const flightProgress = Math.min(1, elapsed / FLIGHT_DURATION);
      const eased = easeOutCubic(flightProgress);

      // 目标位置：需要在 canvas 坐标中采样
      // 简化为直接飞向最终目标（在渲染时处理）
      if (flightProgress < 1) {
        const strength = 8 * (1 - flightProgress);
        const ax = (p.targetX - p.x) * strength;
        const ay = (p.targetY - p.y) * strength;
        p.vx += ax * dt;
        p.vy += ay * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
      } else {
        p.x = p.targetX;
        p.y = p.targetY;
        p.vx = 0;
        p.vy = 0;
      }
      p.life = flightProgress;
    });
  });
}

/** 渲染粒子到 canvas */
export function renderParticles(cvs: HTMLCanvasElement): void {
  if (!initialized || groups.length === 0) return;
  canvas = cvs;
  ctx = cvs.getContext('2d')!;

  const w = cvs.width;
  const h = cvs.height;

  // 半透明背景产生拖尾效果
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, h);

  // 为每个粒子计算 targetX/targetY（从 SVG DOM 采样）
  const previewSvg = document.getElementById('previewSvg')!;
  const svgRect = previewSvg.getBoundingClientRect();
  const vb = state.currentData!.viewBox.split(' ').map(Number);
  const scaleX = svgRect.width / (vb[2] || 1024);
  const scaleY = svgRect.height / (vb[3] || 1024);

  groups.forEach(group => {
    // 获取路径在 SVG 坐标中的点
    const pathEl = state.strokeElements[group.pathIndex];
    const len = getLength(group.pathIndex);

    group.particles.forEach((p, i) => {
      if (animationTime < group.startTime + p.delay) return;
      if (p.targetX === 0 && p.targetY === 0) {
        // 初次采样目标位置
        const t = i / group.particles.length;
        try {
          const pt = (pathEl as SVGGeometryElement).getPointAtLength(t * len);
          p.targetX = pt.x * scaleX + svgRect.left;
          p.targetY = pt.y * scaleY + svgRect.top;
        } catch {
          p.targetX = svgRect.left + svgRect.width * t;
          p.targetY = svgRect.top + svgRect.height * 0.5;
        }
      }
    });

    // 绘制粒子
    const alpha = Math.min(1, (animationTime - group.startTime) / 0.5);
    group.particles.forEach(p => {
      if (animationTime < group.startTime + p.delay) return;
      const r = Math.round(parseInt(p.color.slice(1, 3), 16));
      const g = Math.round(parseInt(p.color.slice(3, 5), 16));
      const b = Math.round(parseInt(p.color.slice(5, 7), 16));
      ctx!.fillStyle = `rgba(${r},${g},${b},${Math.min(1, p.life * 2) * alpha})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx!.fill();
    });
  });
}

/** 清理粒子数据 */
export function destroyParticles(): void {
  groups = [];
  initialized = false;
  animationTime = 0;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function getParticleCount(): number {
  return groups.reduce((sum, g) => sum + g.particles.length, 0);
}

export function getParticleProgress(): number {
  if (groups.length === 0) return 0;
  const allParticles = groups.flatMap(g => g.particles);
  if (allParticles.length === 0) return 0;
  return allParticles.reduce((s, p) => s + p.life, 0) / allParticles.length;
}
