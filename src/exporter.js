// ── 导出功能 ────────────────────────────────────────────

import { state, CONST, totalCycle } from './state.js';
import { escHtml, parseViewBoxParts } from './utils.js';
import { getLength } from './renderer.js';

// ── 快照 ────────────────────────────────────────────────

export function buildCurrentSnapshotSVG(includeBg) {
  if (!state.currentData || state.strokeElements.length === 0) return '';
  const { viewBox, elements } = state.currentData;
  let inner = '';
  if (includeBg)
    inner += '<rect width="100%" height="100%" fill="' + escHtml(state.bgColor) + '"/>';
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const sEl = state.strokeElements[i];
    const fEl = state.fillElements[i];
    if (!sEl || !fEl) continue;
    const fillVal = fEl.style.fill || 'transparent';
    const fillOpacity = fEl.style.opacity || 1;
    const strokeVal = sEl.style.stroke || state.strokeColor;
    const sw = sEl.style.strokeWidth || state.strokeWidth;
    const dashOff = sEl.style.strokeDashoffset || getLength(i);
    const dashArr = getLength(i);
    const sop = sEl.style.strokeOpacity != null ? sEl.style.strokeOpacity : 1;
    const attrs = Object.entries(el.attrs)
      .map(([k, v]) => k + '="' + escHtml(v) + '"')
      .join(' ');
    const style =
      'fill:' +
      fillVal +
      ';stroke:' +
      strokeVal +
      ';stroke-width:' +
      sw +
      ';stroke-dasharray:' +
      dashArr +
      ';stroke-dashoffset:' +
      dashOff +
      ';stroke-opacity:' +
      sop +
      ';stroke-linecap:round;stroke-linejoin:round';
    if (fillOpacity < 1)
      inner +=
        '<' +
        el.tag +
        ' ' +
        attrs +
        ' style="' +
        style +
        '" opacity="' +
        fillOpacity +
        '"/>';
    else inner += '<' + el.tag + ' ' + attrs + ' style="' + style + '"/>';
  }
  return '<svg viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

// ── Blob 下载 ───────────────────────────────────────────

function downloadBlob(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── 导出 HTML ───────────────────────────────────────────

export function exportHTML() {
  if (!state.currentData) return;
  const { viewBox, elements } = state.currentData;
  const lens = state.currentData.lengths || [];
  let strokes = '',
    fills = '';
  elements.forEach((el, i) => {
    const len = lens[i] || getLength(i);
    const attrs = Object.entries(el.attrs)
      .map(([k, v]) => k + '="' + escHtml(v) + '"')
      .join(' ');
    strokes +=
      '\n    <' + el.tag + ' ' + attrs + ' class="ap" style="--l:' + len + 'px"/>';
    const origFill = state.originalFills[i];
    const fillTarget =
      state.preserveOriginalColors && origFill
        ? origFill
        : state.preserveOriginalColors
          ? 'transparent'
          : state.fillColor;
    fills +=
      '\n    <' +
      el.tag +
      ' ' +
      attrs +
      ' class="fill-el" style="--fc:' +
      escHtml(fillTarget) +
      '"/>';
  });

  const cycleMs = Math.round(
    (CONST.STROKE_DUR + CONST.FILL_DUR + CONST.PAUSE_TIME) * 1000
  );
  const fillCss = state.preserveOriginalColors
    ? 'fill:var(--fc)'
    : 'fill:' + escHtml(state.fillColor);

  const html =
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>SVG Animation</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;background:' +
    escHtml(state.bgColor) +
    ';overflow:hidden}\nsvg{width:min(80vw,80vh,480px);height:min(80vw,80vh,480px)}\n.ap{fill:transparent;stroke:' +
    escHtml(state.strokeColor) +
    ';stroke-width:' +
    state.strokeWidth +
    ';stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:var(--l);stroke-dashoffset:var(--l);animation:d ' +
    CONST.STROKE_DUR +
    's ease-in-out forwards,fadeOut ' +
    CONST.FILL_DUR +
    's ease-in-out forwards ' +
    CONST.STROKE_DUR +
    's;}\n.fill-el{fill:transparent;stroke:none;animation:fadeIn ' +
    CONST.FILL_DUR +
    's ease-in-out forwards ' +
    CONST.STROKE_DUR +
    's;}\n@keyframes d{to{stroke-dashoffset:0}}\n@keyframes fadeOut{to{stroke-opacity:0}}\n@keyframes fadeIn{to{' +
    fillCss +
    '}}\n</style></head><body><svg viewBox="' +
    viewBox +
    '">' +
    strokes +
    fills +
    '</svg>\n<script>\n(function(){\nvar strokes=document.querySelectorAll(".ap"),fills=document.querySelectorAll(".fill-el");\nfunction reset(){\nstrokes.forEach(function(p){p.style.animation="none";p.style.strokeDashoffset=p.style.getPropertyValue("--l");p.style.strokeOpacity=1;});\nfills.forEach(function(p){p.style.animation="none";p.style.fill="transparent";});\nvoid document.querySelector("svg").offsetWidth;\nstrokes.forEach(function(p){p.style.animation="d ' +
    CONST.STROKE_DUR +
    's ease-in-out forwards, fadeOut ' +
    CONST.FILL_DUR +
    's ease-in-out forwards ' +
    CONST.STROKE_DUR +
    's";});\nfills.forEach(function(p){p.style.animation="fadeIn ' +
    CONST.FILL_DUR +
    's ease-in-out forwards ' +
    CONST.STROKE_DUR +
    's";});\n}\nreset();\nsetInterval(reset,' +
    cycleMs +
    ');\n})();\n<\/script></body></html>';

  downloadBlob(
    URL.createObjectURL(new Blob([html], { type: 'text/html' })),
    'animation.html'
  );
  showToast('HTML动画已下载');
}

// ── 导出 SVG ────────────────────────────────────────────

export function exportSVG() {
  if (!state.currentData) return;
  downloadBlob(
    URL.createObjectURL(
      new Blob([buildCurrentSnapshotSVG(true)], { type: 'image/svg+xml' })
    ),
    'image.svg'
  );
  showToast('SVG已下载');
}

// ── 导出图片 ────────────────────────────────────────────

export function exportImage(format) {
  if (!state.currentData) return;
  const svgStr = buildCurrentSnapshotSVG(false);
  const img = new Image();
  img.onload = () => {
    const [, , w0, h0] = parseViewBoxParts(state.currentData.viewBox);
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
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    downloadBlob(canvas.toDataURL(mime), 'image.' + format);
    showToast(format.toUpperCase() + '已下载');
  };
  img.onerror = () => {
    alert('图片导出失败：SVG 可能包含浏览器不支持的外部资源或特性');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}

// ── Toast ───────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

export { showToast };
