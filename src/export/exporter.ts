/**
 * 导出功能 — 所有格式的导出逻辑
 *
 * 支持格式：HTML（完整动画）、SVG（当前快照）、PNG、JPG
 * HTML 导出包含独立 CSS 动画 + JS 循环，可脱离主项目运行
 */

import { state, CONST, totalCycle, elementCycle, perElemStrokeDur } from '../state/store.js';
import { escHtml, parseViewBoxParts } from '../utils/helpers.js';
import { getLength } from '../core/renderer.js';

export function buildCurrentSnapshotSVG(includeBg: boolean): string {
  if (!state.currentData || state.strokeElements.length === 0) return '';
  const { viewBox, elements } = state.currentData;
  let inner = '';
  if (includeBg)
    inner += `<rect width="100%" height="100%" fill="${escHtml(state.bgColor)}"/>`;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const sEl = state.strokeElements[i];
    const fEl = state.fillElements[i];
    if (!sEl || !fEl) continue;
    const fillVal = fEl.style.fill || 'transparent';
    const fillOpacity = fEl.style.opacity || '1';
    const strokeVal = sEl.style.stroke || state.strokeColor;
    const sw = sEl.style.strokeWidth || String(state.strokeWidth);
    const dashOff = sEl.style.strokeDashoffset || String(getLength(i));
    const dashArr = String(getLength(i));
    const sop = sEl.style.strokeOpacity ?? '1';
    const attrs = Object.entries(el.attrs)
      .map(([k, v]) => `${k}="${escHtml(v)}"`)
      .join(' ');
    const style =
      `fill:${fillVal};stroke:${strokeVal};stroke-width:${sw};` +
      `stroke-dasharray:${dashArr};stroke-dashoffset:${dashOff};` +
      `stroke-opacity:${sop};stroke-linecap:round;stroke-linejoin:round`;
    if (Number(fillOpacity) < 1)
      inner += `<${el.tag} ${attrs} style="${style}" opacity="${fillOpacity}"/>`;
    else inner += `<${el.tag} ${attrs} style="${style}"/>`;
  }
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function downloadBlob(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportHTML(): void {
  if (!state.currentData) return;
  const { viewBox, elements } = state.currentData;
  const lens = state.currentData.lengths || [];
  const n = elements.length;
  const spd = 1 / state.speedFactor;  // speedFactor在导出HTML中体现为时长缩放
  const perElemStroke = (state.sequentialMode ? perElemStrokeDur(n) : CONST.STROKE_DUR) * spd;
  const fillDur = CONST.FILL_DUR * spd;
  const stagger = state.sequentialMode ? perElemStroke * state.staggerFactor : 0;
  const cycleMs = Math.round(elementCycle(n) * spd * 1000);

  // 交错排列描边和填色，和预览区 DOM 顺序一致
  let pairs = '';
  elements.forEach((el, i) => {
    const len = lens[i] || getLength(i);
    const a = Object.entries(el.attrs)
      .map(([k, v]) => `${k}="${escHtml(v)}"`)
      .join(' ');
    const delay = stagger * i;
    const strokeSec = perElemStroke.toFixed(2);
    pairs += `\n    <${el.tag} ${a} class="ap" style="--l:${len}px;--d:${delay.toFixed(2)}s;--s:${strokeSec}"/>`;
    const customFill = state.customFills[i];
    const origFill = state.originalFills[i];
    const ft = customFill
      || (state.preserveOriginalColors && origFill ? origFill
        : state.preserveOriginalColors ? 'transparent'
        : state.fillColor);
    pairs += `\n    <${el.tag} ${a} class="fill-el" style="--fc:${escHtml(ft)};--d:${delay.toFixed(2)}s;--s:${strokeSec}"/>`;
  });

  const hasCustomFills = state.customFills.some((f) => f !== null);
  const fillVal = (state.preserveOriginalColors || hasCustomFills) ? 'var(--fc)' : escHtml(state.fillColor);
  const strokeDur = state.sequentialMode ? 'var(--s)' : String(CONST.STROKE_DUR);
  const keepStrokes = state.keepStrokes;

  const fd = fillDur.toFixed(2);
  const fadeOutCss = keepStrokes ? '' : `@keyframes fadeOut{to{stroke-opacity:0}}`;
  const apAnimName = keepStrokes ? 'd' : 'd,fadeOut';
  const apAnimDur = keepStrokes ? 'var(--s)s' : `var(--s)s,${fd}s`;
  // fadeOut 需要独立延迟 = stagger + stroke时长，不能和 d 共用同一个 delay
  const apAnimDelay = keepStrokes ? 'var(--d)' : `var(--d),calc(var(--d) + var(--s)*1s)`;

  const html =
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>SVG Animation</title>\n` +
    `<style>\n*{margin:0;padding:0;box-sizing:border-box}\n` +
    `body{width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;background:${escHtml(state.bgColor)};overflow:hidden}\n` +
    `svg{width:min(80vw,80vh,480px);height:min(80vw,80vh,480px)}\n` +
    `.ap{fill:transparent;stroke:${escHtml(state.strokeColor)};stroke-width:${state.strokeWidth};` +
    `stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:var(--l);stroke-dashoffset:var(--l);` +
    `animation-name:${apAnimName};animation-duration:${apAnimDur};animation-timing-function:${state.easing};` +
    `animation-fill-mode:forwards;animation-delay:${apAnimDelay}}\n` +
    `.fill-el{opacity:0;fill:${fillVal};stroke:none;` +
    `animation-name:fadeIn;animation-duration:${fd}s;animation-timing-function:${state.easing};` +
    `animation-fill-mode:forwards;animation-delay:calc(var(--d) + ${strokeDur}s)}\n` +
    `@keyframes d{to{stroke-dashoffset:0}}\n` +
    `${fadeOutCss}` +
    `@keyframes fadeIn{to{opacity:1}}\n</style></head><body>` +
    `<svg viewBox="${viewBox}">${pairs}</svg>\n<script>\n` +
    `(function(){var s=document.querySelectorAll(".ap"),f=document.querySelectorAll(".fill-el");` +
    `function reset(){` +
    `s.forEach(function(p){p.style.animation="none";` +
    `p.style.strokeDashoffset=p.style.getPropertyValue("--l");p.style.strokeOpacity=1;});` +
    `f.forEach(function(p){p.style.animation="none";p.style.opacity=0;});` +
    `void document.querySelector("svg").offsetWidth;` +
    `s.forEach(function(p){var d=(p.style.getPropertyValue("--d")||\"0s\");` +
    `p.style.animationName="d";` +
    `p.style.animationDuration=(p.style.getPropertyValue("--s")||"6")+"s";` +
    `p.style.animationDelay=d;` +
    `p.style.animationTimingFunction="${state.easing}";` +
    `p.style.animationFillMode="forwards";` +
    (keepStrokes ? ``
      : `p.style.animationName="d,fadeOut";p.style.animationDuration=(p.style.getPropertyValue(\"--s\")||\"6\")+\"s,${fd}s\";p.style.animationDelay=d+\",calc(\"+d+\" + \"+(p.style.getPropertyValue(\"--s\")||\"6\")+\"*1s)\";`) +
    `});` +
    `f.forEach(function(p){p.style.animationName="fadeIn";` +
    `p.style.animationDuration="${fd}s";` +
    `p.style.animationDelay="calc("+(p.style.getPropertyValue(\"--d\")||\"0s\")+\" + \"+(p.style.getPropertyValue(\"--s\")||\"6\")+\"s)\";` +
    `p.style.animationTimingFunction="${state.easing}";` +
    `p.style.animationFillMode="forwards";});}` +
    `reset();setInterval(reset,${cycleMs});})();\n<\/script></body></html>`;

  downloadBlob(URL.createObjectURL(new Blob([html], { type: 'text/html' })), 'animation.html');
  showToast('HTML动画已下载');
}

export function exportSVG(): void {
  if (!state.currentData) return;
  downloadBlob(
    URL.createObjectURL(new Blob([buildCurrentSnapshotSVG(true)], { type: 'image/svg+xml' })),
    'image.svg'
  );
  showToast('SVG已下载');
}

export function exportImage(format: 'png' | 'jpg'): void {
  if (!state.currentData) return;
  const svgStr = buildCurrentSnapshotSVG(false);
  const img = new Image();
  img.onload = () => {
    const [, , w0, h0] = parseViewBoxParts(state.currentData!.viewBox);
    let w = w0,
      h = h0;
    if (w > CONST.MAX_IMAGE_SIZE || h > CONST.MAX_IMAGE_SIZE) {
      const s = Math.min(CONST.MAX_IMAGE_SIZE / w, CONST.MAX_IMAGE_SIZE / h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    downloadBlob(canvas.toDataURL(mime), `image.${format}`);
    showToast(format.toUpperCase() + '已下载');
  };
  img.onerror = () => {
    alert('图片导出失败：SVG 可能包含浏览器不支持的外部资源或特性');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}


let toastTimer: number | null = null;
function showToast(msg: string): void {
  const toast = document.getElementById('toast')!;
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2000);
}

export { showToast };
