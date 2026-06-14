/**
 * UI 事件 & 图层面板 — 所有用户交互的入口
 *
 * initUI() 绑定所有事件，是应用启动入口
 * 包含：上传、时间轴、速度、颜色、预设、图层、键盘、导出
 */

import { state, CONST, totalCycle, elementCycle } from '../state/store.js';
import { parseSVG } from '../core/parser.js';
import { rebuildPreviewDOM, reorderDomElements, measureAndCacheLengths } from '../core/renderer.js';
import { resetAnimation, tick, setRenderContext } from '../core/animator.js';
import { updateColors, updateElements } from '../engines/stroke-engine.js';
import { buildCurrentSnapshotSVG, exportHTML, exportSVG, exportImage, exportParticleVideo, showToast } from '../export/exporter.js';
import { initParticles, destroyParticles, particleEngine } from '../core/particles.js';
import { registerControl, setControlValue, bindAllControls } from '../core/control-registry.js';
import { registerEngine, switchEngine, getActiveId } from '../core/engine-registry.js';
import { strokeEngine } from '../engines/stroke-engine.js';
import { bus, Events } from '../core/events.js';

// 注册引擎
registerEngine(strokeEngine);
registerEngine(particleEngine);

// ═══════════════════════════════════════════════════════════
// 控件注册 — 声明式定义所有控件。
// 加新控件：加一个 registerControl({...})，不动 HTML/CSS。
// ═══════════════════════════════════════════════════════════

function registerAllControls() {
  registerControl({ id: 'strokeColor', type: 'color', label: '描边', title: '描边颜色', group: 'colors', default: '#ffffff',
    onChange: (v) => { state.strokeColor = v as string; bus.emit(Events.COLOR_CHANGED, { type: 'stroke' }); } });
  registerControl({ id: 'fillColor', type: 'color', label: '填色', title: '填色颜色', group: 'colors', default: '#ffffff',
    onChange: (v) => { state.fillColor = v as string; state.syncColors = false; setControlValue('syncColors', false); bus.emit(Events.COLOR_CHANGED, { type: 'fill' }); } });
  registerControl({ id: 'syncColors', type: 'checkbox', label: '同步', title: '填色跟随描边', group: 'colors', default: true,
    onChange: (v) => { state.syncColors = v as boolean; bus.emit(Events.COLOR_CHANGED, { type: 'sync' }); } });
  registerControl({ id: 'preserveColors', type: 'checkbox', label: '保留原色', title: '恢复SVG原始颜色', group: 'animation', default: false,
    onChange: (v) => { state.preserveOriginalColors = v as boolean; if (state.currentData) { fullRebuild(); const lp = document.getElementById('layerPanel'); if (lp && lp.style.display === 'flex') renderLayerPathList(); } showToast(v ? '保留原色：开' : '统一颜色：开'); } });
  registerControl({ id: 'sequentialMode', type: 'checkbox', label: '逐条', title: '路径逐条绘制', group: 'animation', default: false,
    onChange: (v) => { state.sequentialMode = v as boolean; if (state.currentData) fullRebuild(); showToast(v ? '逐条绘制：开' : '同步绘制：开'); } });
  registerControl({ id: 'staggerFactor', type: 'range', label: '间隔', title: '逐条间隔', group: 'animation', min: 0.5, max: 3, step: 0.25, default: 1,
    onChange: (v) => { state.staggerFactor = v as number; if (state.currentData && state.sequentialMode) fullRebuild(); } });
  registerControl({ id: 'particleMode', type: 'checkbox', label: '粒子', title: '粒子从四周飞入聚合', group: 'animation', default: false,
    onChange: (v) => { toggleParticleMode(v as boolean); } });
  registerControl({ id: 'keepStrokes', type: 'checkbox', label: '保留描边', title: '动画结束后保留描边轮廓', group: 'animation', default: true,
    onChange: (v) => { state.keepStrokes = v as boolean; bus.emit(Events.MODE_CHANGED, { mode: 'keepStrokes', value: v }); } });
  registerControl({ id: 'easing', type: 'select', label: '缓动', title: '动画缓动曲线', group: 'animation', default: 'linear',
    options: [{value:'linear',label:'线性'},{value:'ease-in',label:'缓入'},{value:'ease-out',label:'缓出'},{value:'ease-in-out',label:'缓入缓出'}],
    onChange: (v) => { state.easing = v as string; bus.emit(Events.MODE_CHANGED, { mode: 'easing', value: v }); } });
}

// ── 图层面板 ────────────────────────────────────────────

export function renderLayerPathList(): void {
  const layerPathList = document.getElementById('layerPathList')!;
  layerPathList.innerHTML = '';
  if (!state.currentData) return;
  state.currentData.elements.forEach((el, i) => {
    const div = document.createElement('div');
    div.className = 'path-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.pathStrokeVisible[i];
    cb.dataset.index = String(i);
    cb.addEventListener('change', function () {
      const idx = parseInt(this.dataset.index!);
      state.pathStrokeVisible[idx] = this.checked;
      bus.emit(Events.LAYER_VISIBILITY_CHANGED, { index: idx, visible: this.checked });
    });
    div.appendChild(cb);
    // 逐路径颜色选择器：显示当前有效填充色
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    const customColor = state.customFills[i];
    const effectiveColor = customColor
      || (state.preserveOriginalColors ? state.originalFills[i] : state.fillColor)
      || '#ffffff';
    colorInput.value = effectiveColor;
    colorInput.title = '路径 ' + (i + 1) + ' 颜色';
    colorInput.style.cssText = 'width:18px;height:18px;border:none;background:transparent;cursor:pointer;padding:0;flex-shrink:0';
    colorInput.addEventListener('input', function () {
      state.customFills[i] = colorInput.value;
      bus.emit(Events.LAYER_COLOR_CHANGED, { index: i, color: colorInput.value });
    });
    div.appendChild(colorInput);

    const label = document.createElement('span');
    label.textContent = el.tag + ' ' + (i + 1);
    div.appendChild(label);
    layerPathList.appendChild(div);
  });
}

// ── 文件处理 ────────────────────────────────────────────

function handleFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.svg')) {
    alert('请上传 .svg 文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const data = parseSVG(reader.result as string);
    if (!data) {
      alert('SVG解析失败');
      return;
    }
    state.currentData = data;
    fullRebuild();
  };
  reader.readAsText(file);
}

// ── 完整重建 ────────────────────────────────────────────

function fullRebuild(): void {
  rebuildPreviewDOM();
  updateColors();
  state.playDesired = true;
  state.paused = false;
  syncPlayIcon();
  resetAnimation();
  // 通知其他模块 SVG 数据已就绪
  bus.emit(Events.SVG_LOADED);
  // 通知引擎模式可能已变更
  bus.emit(Events.MODE_CHANGED, { mode: 'rebuild' });
}

// ── 图标同步 ────────────────────────────────────────────

function syncPlayIcon(): void {
  const icon = document.getElementById('playIcon')!;
  icon.innerHTML = state.paused
    ? '<polygon points="6,4 20,12 6,20" fill="currentColor"/>'
    : '<rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/>';
}

// ── 键盘恢复 ────────────────────────────────────────────

function scheduleKeyboardResume(): void {
  if (state.keyboardResumeTimer) clearTimeout(state.keyboardResumeTimer);
  state.keyboardResumeTimer = window.setTimeout(() => {
    state.keyboardResumeTimer = null;
    if (state.playDesired && state.paused) {
      state.paused = false;
      syncPlayIcon();
      bus.emit(Events.ANIMATION_PLAY);
    }
  }, CONST.KEYBOARD_RESUME_DELAY);
}

// ── 粒子模式切换 ────────────────────────────────────────

let particleCheckbox: HTMLInputElement | null = null;
let particleCanvas: HTMLCanvasElement | null = null;

function toggleParticleMode(on: boolean) {
  state.particleMode = on;
  const svg = document.getElementById('previewSvg')!;
  if (!particleCanvas) particleCanvas = document.getElementById('particleCanvas') as HTMLCanvasElement;
  const cvs = particleCanvas!;

  if (on) {
    switchEngine('particle');
    svg.style.display = 'none'; cvs.style.display = 'block';
    const rect = document.getElementById('previewBg')!.getBoundingClientRect();
    cvs.width = Math.round(rect.width); cvs.height = Math.round(rect.height);
    setRenderContext({ canvas: cvs });
    initParticles();
    const n = getParticleCount();
    state.particleCount = n;
    if (n === 0) {
      state.particleMode = false; svg.style.display = 'block'; cvs.style.display = 'none';
      switchEngine('stroke');
      showToast('粒子模式需要先上传 SVG'); return;
    }
    showToast('粒子模式：' + n + ' 个粒子');
    state.paused = false;
    syncPlayIcon();
    if (!state.rafId) { state.animStart = performance.now(); state.lastTickTime = 0; tick(); }
  } else {
    switchEngine('stroke');
    setRenderContext({});
    svg.style.display = 'block'; cvs.style.display = 'none';
    destroyParticles();
    state.particleCount = 0;
  }
}

import { getParticleCount } from '../core/particles.js';

// ── 初始化 ──────────────────────────────────────────────

export function initUI(): void {
  // 注册所有控件 → 自动绑定事件
  registerAllControls();
  bindAllControls();

  // prettier-ignore
  const $ = (id: string) => document.getElementById(id)!;

  const previewBg = $('previewBg');
  const timelineSlider = $('timeline') as HTMLInputElement;
  const timeVal = $('timeVal');
  const speedSlider = $('speed') as HTMLInputElement;
  const speedVal = $('speedVal');
  const strokeWidthInput = $('strokeWidth') as HTMLInputElement;
  const strokeWidthVal = $('strokeWidthVal');
  const bgColorInput = $('bgColor') as HTMLInputElement;
  const strokeColorInput = $('strokeColor') as HTMLInputElement;
  const fillColorInput = $('fillColor') as HTMLInputElement;
  const preserveColorsCheckbox = $('preserveColors') as HTMLInputElement;
  const sequentialCheckbox = $('sequentialMode') as HTMLInputElement;
  const layerPanel = $('layerPanel');
  const layerHeader = $('layerHeader');
  const autoBgCheckPanel = $('autoBgCheckPanel') as HTMLInputElement;
  const pastePanel = $('pastePanel');
  const pasteText = $('pasteText') as HTMLTextAreaElement;
  const fileInput = $('fileInput') as HTMLInputElement;
  const particleCanvas = $('particleCanvas') as HTMLCanvasElement;

  previewBg.style.backgroundColor = state.bgColor;
  updateColors();

  // ── 上传 ──────────────────────────────────────────────
  $('uploadFloat').addEventListener('click', () => {
    if (!state.paused) { state.paused = true; syncPlayIcon(); }
    fileInput.click();
  });
  fileInput.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) handleFile(f);
  });
  ['dragenter', 'dragover', 'drop'].forEach((ev) => {
    $('previewArea').addEventListener(ev, (e) => e.preventDefault());
  });
  $('previewArea').addEventListener('drop', (e) => {
    e.preventDefault();
    const f = (e as DragEvent).dataTransfer?.files[0];
    if (f) handleFile(f);
  });

  // ── 时间轴 ────────────────────────────────────────────
  timelineSlider.addEventListener('input', () => {
    if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
    state.paused = true;
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    state.currentProgress = parseFloat(timelineSlider.value) / 100;
    timeVal.textContent = Math.round(state.currentProgress * 100) + '%';
    bus.emit(Events.TIMELINE_SEEK, { progress: state.currentProgress });
  });
  timelineSlider.addEventListener('change', () => {
    if (state.playDesired) {
      bus.emit(Events.TIMELINE_DRAG_END, { progress: state.currentProgress });
    } else {
      state.paused = true;
    }
  });

  // ── 速度 ──────────────────────────────────────────────
  speedSlider.addEventListener('input', () => {
    state.speedFactor = parseFloat(speedSlider.value);
    speedVal.textContent = state.speedFactor + '×';
    bus.emit(Events.SPEED_CHANGED, { speed: state.speedFactor });
  });

  // ── 描边宽 ────────────────────────────────────────────
  strokeWidthInput.addEventListener('input', () => {
    state.strokeWidth = parseFloat(strokeWidthInput.value);
    strokeWidthVal.textContent = String(state.strokeWidth);
    bus.emit(Events.STROKE_WIDTH_CHANGED, { width: state.strokeWidth });
  });

  // ── 颜色 / 模式 ─────────────────────────────────────────
  // 核心逻辑已由控件注册中心处理（registerAllControls 中的 onChange）
  // 粒子模式需要特殊 DOM 处理，保留手动监听

  const particleCheckbox = $('particleMode') as HTMLInputElement;

  const startParticleMode = () => {
    const svg = $('previewSvg');
    svg.style.display = 'none';
    particleCanvas.style.display = 'block';
    const rect = $('previewBg').getBoundingClientRect();
    particleCanvas.width = Math.round(rect.width);
    particleCanvas.height = Math.round(rect.height);
    const n = initParticles();
    state.particleCount = n;
    if (n === 0) {
      particleCheckbox.checked = false;
      state.particleMode = false;
      svg.style.display = 'block';
      particleCanvas.style.display = 'none';
      showToast('粒子模式需要先上传 SVG');
      return;
    }
    showToast('粒子模式：' + n + ' 个粒子');
    state.paused = false;
    syncPlayIcon();
    if (!state.rafId) { state.animStart = performance.now(); state.lastTickTime = 0; tick(); }
  };

  particleCheckbox.addEventListener('change', () => {
    state.particleMode = particleCheckbox.checked;
    if (state.particleMode) startParticleMode();
    else {
      $('previewSvg').style.display = 'block';
      particleCanvas.style.display = 'none';
      destroyParticles();
      state.particleCount = 0;
    }
  });

  // ── 动画预设 ──────────────────────────────────────────
  type PresetName = 'fast' | 'standard' | 'film';
  const presets: Record<PresetName, { speed: number; strokeWidth: number; stagger: number; label: string }> = {
    fast:     { speed: 3,   strokeWidth: 4,  stagger: 0.5, label: '快速' },
    standard: { speed: 1,   strokeWidth: 8,  stagger: 1,   label: '标准' },
    film:     { speed: 0.5, strokeWidth: 12, stagger: 1.5, label: '电影' },
  };
  const applyPreset = (name: PresetName) => {
    const p = presets[name];
    state.speedFactor = p.speed; (speedSlider as HTMLInputElement).value = String(p.speed); speedVal.textContent = p.speed + '×';
    state.strokeWidth = p.strokeWidth; strokeWidthInput.value = String(p.strokeWidth); strokeWidthVal.textContent = String(p.strokeWidth);
    state.staggerFactor = p.stagger; (staggerSlider as HTMLInputElement).value = String(p.stagger); staggerVal.textContent = p.stagger + '×';
    state.strokeElements.forEach(el => el.style.strokeWidth = String(p.strokeWidth));
    updateElements(state.currentProgress);
    bus.emit(Events.PRESET_APPLIED, { preset: name });
    bus.emit(Events.STROKE_WIDTH_CHANGED, { width: p.strokeWidth });
    bus.emit(Events.SPEED_CHANGED, { speed: p.speed });
    bus.emit(Events.MODE_CHANGED, { mode: 'stagger', value: p.stagger });
    showToast('预设：' + p.label);
  };
  $('presetFast').addEventListener('click', () => applyPreset('fast'));
  $('presetStd').addEventListener('click', () => applyPreset('standard'));
  $('presetFilm').addEventListener('click', () => applyPreset('film'));

  const staggerSlider = $('staggerFactor') as HTMLInputElement;
  const staggerVal = $('staggerVal');
  staggerSlider.addEventListener('input', () => {
    state.staggerFactor = parseFloat(staggerSlider.value);
    staggerVal.textContent = state.staggerFactor + '×';
    bus.emit(Events.MODE_CHANGED, { mode: 'stagger', value: state.staggerFactor });
    if (state.currentData && state.sequentialMode) fullRebuild();
  });
  bgColorInput.addEventListener('input', () => {
    state.bgColor = bgColorInput.value;
    previewBg.style.backgroundColor = state.bgColor;
    bus.emit(Events.BG_COLOR_CHANGED, { color: state.bgColor });
  });

  // ── 播放/暂停 ─────────────────────────────────────────
  $('playPauseBtn').addEventListener('click', () => {
    if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
    state.playDesired = !state.playDesired;
    if (state.playDesired) {
      state.paused = false;
      syncPlayIcon();
      bus.emit(Events.ANIMATION_PLAY);
    } else {
      state.paused = true;
      syncPlayIcon();
      bus.emit(Events.ANIMATION_PAUSE);
    }
  });

  // ── 粘贴 ──────────────────────────────────────────────
  $('pasteBtn').addEventListener('click', () => { pastePanel.style.display = pastePanel.style.display === 'flex' ? 'none' : 'flex'; });
  $('cancelPaste').addEventListener('click', () => { pastePanel.style.display = 'none'; });
  $('applyPaste').addEventListener('click', () => {
    const code = pasteText.value.trim();
    if (!code) return;
    const data = parseSVG(code);
    if (!data) { alert('无法解析SVG代码'); return; }
    state.currentData = data;
    fullRebuild();
    pastePanel.style.display = 'none';
    pasteText.value = '';
  });

  // ── 重置 ──────────────────────────────────────────────
  $('resetBtn').addEventListener('click', () => {
    if (!state.currentData) return;
    state.strokeWidth = 8; strokeWidthInput.value = '8'; strokeWidthVal.textContent = '8';
    state.strokeColor = '#ffffff'; state.fillColor = '#ffffff'; state.syncColors = true;
    strokeColorInput.value = '#ffffff'; fillColorInput.value = '#ffffff';
    (document.getElementById('syncColors') as HTMLInputElement).checked = true;
    state.bgColor = '#000000'; bgColorInput.value = '#000000'; previewBg.style.backgroundColor = '#000000';
    state.speedFactor = 1; speedSlider.value = '1'; speedVal.textContent = '1×';
    state.autoBgEnabled = true; autoBgCheckPanel.checked = true;
    state.preserveOriginalColors = false; preserveColorsCheckbox.checked = false;
    state.sequentialMode = false; sequentialCheckbox.checked = false;
    state.staggerFactor = 1; staggerSlider.value = '1'; staggerVal.textContent = '1×';
    state.keepStrokes = true;
    (document.getElementById('keepStrokes') as HTMLInputElement).checked = true;
    state.easing = 'linear';
    (document.getElementById('easing') as HTMLSelectElement).value = 'linear';
    fullRebuild();
    state.customFills = state.originalFills.map(() => null);
    if (layerPanel.style.display === 'flex') renderLayerPathList();
    fileInput.value = '';
    if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
    bus.emit(Events.ANIMATION_RESET);
  });

  // ── 图层面板 ──────────────────────────────────────────
  $('layerBtn').addEventListener('click', () => {
    if (layerPanel.style.display === 'flex') {
      layerPanel.style.display = 'none';
    } else {
      if (state.currentData) {
      renderLayerPathList();
      autoBgCheckPanel.checked = state.autoBgEnabled;
    }
    layerPanel.style.display = 'flex';
    }
  });
  $('layerClose').addEventListener('click', () => { layerPanel.style.display = 'none'; });
  const resetPathColorsBtn = document.getElementById('resetPathColors')!;
  resetPathColorsBtn.addEventListener('click', () => {
    state.customFills = state.originalFills.map(() => null);
    bus.emit(Events.LAYER_COLORS_RESET);
    renderLayerPathList();
    showToast('路径颜色已重置');
  });

  autoBgCheckPanel.addEventListener('change', () => {
    const newAutoBg = autoBgCheckPanel.checked;
    if (newAutoBg === state.autoBgEnabled) return;
    // 始终使用原始 SVG 顺序
    state.currentData!.elements = state.currentData!.originalElements || state.currentData!.elements;
    measureAndCacheLengths();
    reorderDomElements();
    state.pathStrokeVisible = state.currentData!.elements.map(() => true);
    state.autoBgEnabled = newAutoBg;
    updateElements(state.currentProgress);
    bus.emit(Events.LAYER_COLORS_RESET);
    renderLayerPathList();
  });

  // ── 拖动 ──────────────────────────────────────────────
  let isDragging = false, dragOffX = 0, dragOffY = 0;
  const dragStart = (cx: number, cy: number) => {
    isDragging = true;
    const r = layerPanel.getBoundingClientRect();
    dragOffX = cx - r.left; dragOffY = cy - r.top;
    layerHeader.style.cursor = 'grabbing';
  };
  const dragMove = (cx: number, cy: number) => {
    if (!isDragging) return;
    layerPanel.style.left = cx - dragOffX + 'px';
    layerPanel.style.top = cy - dragOffY + 'px';
  };
  const dragEnd = () => { if (isDragging) { isDragging = false; layerHeader.style.cursor = 'move'; } };
  layerHeader.addEventListener('mousedown', (e) => { dragStart(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', (e) => dragMove(e.clientX, e.clientY));
  document.addEventListener('mouseup', dragEnd);
  layerHeader.addEventListener('touchstart', (e) => { dragStart(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (!isDragging) return; dragMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  document.addEventListener('touchend', () => { if (isDragging) dragEnd(); });

  // ── 键盘 ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
    if (!state.currentData) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!state.paused) {
        state.paused = true;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        syncPlayIcon();
        scheduleKeyboardResume();
      }
      const step = e.shiftKey ? 5 : 1;
      let newVal = parseFloat(timelineSlider.value);
      if (e.key === 'ArrowRight') newVal = Math.min(100, newVal + step);
      else newVal = Math.max(0, newVal - step);
      timelineSlider.value = String(newVal);
      state.currentProgress = newVal / 100;
      timeVal.textContent = Math.round(newVal) + '%';
      bus.emit(Events.TIMELINE_SEEK, { progress: state.currentProgress });
      if (state.keyboardResumeTimer) scheduleKeyboardResume();
    }
  });

  // ── 导出 ──────────────────────────────────────────────
  $('shareBtn').addEventListener('click', () => {
    if (!state.currentData) return;
    navigator.clipboard.writeText(buildCurrentSnapshotSVG(true)).then(() => showToast('SVG代码已复制'));
  });
  $('dlBtn').addEventListener('click', () => {
    if (!state.currentData) return;
    const fmt = ($('exportFormat') as HTMLSelectElement).value;
    if (fmt === 'html') { if (state.particleMode) exportParticleVideo(); else exportHTML(); }
    else if (fmt === 'svg') exportSVG();
    else if (fmt === 'png' || fmt === 'jpg') exportImage(fmt as 'png' | 'jpg');
  });

  window.addEventListener('beforeunload', () => { if (state.rafId) cancelAnimationFrame(state.rafId); });
}
