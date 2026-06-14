/**
 * UI 事件 & 图层面板 — 所有用户交互的入口
 *
 * initUI() 绑定所有事件，是应用启动入口
 * 包含：上传、时间轴、速度、颜色、预设、图层、键盘、导出
 */

import { state, CONST } from '../state/store.js';
import { parseSVG } from '../core/parser.js';
import { rebuildPreviewDOM, reorderDomElements, measureAndCacheLengths } from '../core/renderer.js';
import { resetAnimation, tick, setRenderContext } from '../core/animator.js';
import { updateColors, updateElements } from '../engines/stroke-engine.js';
import { buildCurrentSnapshotSVG, exportHTML, exportSVG, exportImage, exportParticleVideo, showToast } from '../export/exporter.js';
import { initParticles, destroyParticles, particleEngine } from '../core/particles.js';
import { registerControl, setControlValue, bindAllControls } from '../core/control-registry.js';
import { registerEngine, switchEngine } from '../core/engine-registry.js';
import { strokeEngine } from '../engines/stroke-engine.js';
import { bus, Events } from '../core/events.js';
import { toggleTheme, getCurrentTheme, type ThemeName } from '../core/themes.js';
import { undoMgr, createPropertyCommand, createCallbackCommand } from '../core/commands.js';

// 注册引擎
registerEngine(strokeEngine);
registerEngine(particleEngine);

// ═══════════════════════════════════════════════════════════
// 控件注册 — 声明式定义所有控件。
// 加新控件：加一个 registerControl({...})，不动 HTML/CSS。
// ═══════════════════════════════════════════════════════════

function registerAllControls() {
  registerControl({ id: 'strokeColor', type: 'color', label: '描边', title: '描边颜色', group: 'colors', default: '#ffffff',
    onChange: (v) => undoMgr.execute(createPropertyCommand(
      () => state.strokeColor,
      (c) => { state.strokeColor = c; bus.emit(Events.COLOR_CHANGED, { type: 'stroke' }); },
      v as string, '描边颜色')) });
  registerControl({ id: 'fillColor', type: 'color', label: '填色', title: '填色颜色', group: 'colors', default: '#ffffff',
    onChange: (v) => {
      const oldFill = state.fillColor;
      const oldSync = state.syncColors;
      undoMgr.execute(createCallbackCommand(
        () => { state.fillColor = v as string; state.syncColors = false; setControlValue('syncColors', false); bus.emit(Events.COLOR_CHANGED, { type: 'fill' }); },
        () => { state.fillColor = oldFill; state.syncColors = oldSync; setControlValue('syncColors', oldSync); bus.emit(Events.COLOR_CHANGED, { type: 'fill' }); },
        '填色'));
    } });
  registerControl({ id: 'syncColors', type: 'checkbox', label: '同步', title: '填色跟随描边', group: 'colors', default: true,
    onChange: (v) => undoMgr.execute(createPropertyCommand(
      () => state.syncColors,
      (c) => { state.syncColors = c; bus.emit(Events.COLOR_CHANGED, { type: 'sync' }); },
      v as boolean, '颜色同步')) });
  registerControl({ id: 'preserveColors', type: 'checkbox', label: '保留原色', title: '恢复SVG原始颜色', group: 'animation', default: false,
    onChange: (v) => { if (!state.currentData) return; undoMgr.execute(createCallbackCommand(
      () => { state.preserveOriginalColors = v as boolean; fullRebuild(); const lp = document.getElementById('layerPanel'); if (lp && lp.style.display === 'flex') renderLayerPathList(); showToast(v ? '保留原色：开' : '统一颜色：开'); },
      () => { state.preserveOriginalColors = !v; fullRebuild(); const lp = document.getElementById('layerPanel'); if (lp && lp.style.display === 'flex') renderLayerPathList(); showToast(!v ? '保留原色：开' : '统一颜色：开'); },
      '保留原色')); } });
  registerControl({ id: 'sequentialMode', type: 'checkbox', label: '逐条', title: '路径逐条绘制', group: 'animation', default: false,
    onChange: (v) => { if (!state.currentData) return; undoMgr.execute(createCallbackCommand(
      () => { state.sequentialMode = v as boolean; fullRebuild(); showToast(v ? '逐条绘制：开' : '同步绘制：开'); },
      () => { state.sequentialMode = !v; fullRebuild(); showToast(!v ? '逐条绘制：开' : '同步绘制：开'); },
      '逐条模式')); } });
  registerControl({ id: 'staggerFactor', type: 'range', label: '间隔', title: '逐条间隔', group: 'animation', min: 0.5, max: 3, step: 0.25, default: 1,
    onChange: (v) => undoMgr.execute(createPropertyCommand(
      () => state.staggerFactor,
      (c) => { state.staggerFactor = c; if (state.currentData && state.sequentialMode) fullRebuild(); },
      v as number, '逐条间隔')) });
  registerControl({ id: 'particleMode', type: 'checkbox', label: '粒子', title: '粒子从四周飞入聚合', group: 'animation', default: false,
    onChange: (v) => { undoMgr.execute(createCallbackCommand(
      () => toggleParticleMode(v as boolean),
      () => toggleParticleMode(!v),
      '粒子模式')); } });
  registerControl({ id: 'keepStrokes', type: 'checkbox', label: '保留描边', title: '动画结束后保留描边轮廓', group: 'animation', default: true,
    onChange: (v) => undoMgr.execute(createPropertyCommand(
      () => state.keepStrokes,
      (c) => { state.keepStrokes = c; bus.emit(Events.MODE_CHANGED, { mode: 'keepStrokes', value: c }); },
      v as boolean, '保留描边')) });
  registerControl({ id: 'themeToggle', type: 'button', label: '主题', title: '切换亮色/暗色主题', group: 'ui', default: 'dark',
    onChange: () => { const next = toggleTheme(); updateThemeIcon(next); } });
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
      const newVal = this.checked;
      undoMgr.execute(createPropertyCommand(
        () => state.pathStrokeVisible[idx],
        (v) => { state.pathStrokeVisible[idx] = v; bus.emit(Events.LAYER_VISIBILITY_CHANGED, { index: idx, visible: v }); },
        newVal, '图层' + (idx + 1) + '可见'));
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
      const idx = i;
      const newVal = colorInput.value;
      undoMgr.execute(createPropertyCommand(
        () => state.customFills[idx],
        (c) => { state.customFills[idx] = c; bus.emit(Events.LAYER_COLOR_CHANGED, { index: idx, color: c! }); },
        newVal, '图层' + (idx + 1) + '颜色'));
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
    undoMgr.clear();
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

// ── 主题图标 ────────────────────────────────────────────

const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function updateThemeIcon(name: ThemeName): void {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = name === 'dark' ? SUN_ICON : MOON_ICON;
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

  // 初始化主题图标
  updateThemeIcon(getCurrentTheme());
  bus.on(Events.THEME_CHANGED, ({ theme }: { theme: ThemeName }) => {
    updateThemeIcon(theme);
    // 颜色同步：暗色→黑底白线，亮色→白底黑线
    const newBg = theme === 'dark' ? '#000000' : '#ffffff';
    const newStroke = theme === 'dark' ? '#ffffff' : '#000000';
    state.bgColor = newBg;
    state.strokeColor = newStroke;
    state.fillColor = newStroke;
    state.syncColors = true;
    const bgInput = document.getElementById('bgColor') as HTMLInputElement;
    const scInput = document.getElementById('strokeColor') as HTMLInputElement;
    const fcInput = document.getElementById('fillColor') as HTMLInputElement;
    const syncCb = document.getElementById('syncColors') as HTMLInputElement;
    if (bgInput) bgInput.value = newBg;
    if (scInput) scInput.value = newStroke;
    if (fcInput) { fcInput.value = newStroke; fcInput.disabled = true; }
    if (syncCb) syncCb.checked = true;
    const pb = document.getElementById('previewBg');
    if (pb) pb.style.backgroundColor = newBg;
    updateColors();
  });

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

  // 预览区 + 描边/填色跟随主题
  const isDark = getCurrentTheme() === 'dark';
  const initBg = isDark ? '#000000' : '#ffffff';
  const initColor = isDark ? '#ffffff' : '#000000';
  state.bgColor = initBg;
  state.strokeColor = initColor;
  state.fillColor = initColor;
  bgColorInput.value = initBg;
  strokeColorInput.value = initColor;
  fillColorInput.value = initColor;
  previewBg.style.backgroundColor = initBg;
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
    const newVal = parseFloat(speedSlider.value);
    undoMgr.execute(createPropertyCommand(
      () => state.speedFactor,
      (s) => { state.speedFactor = s; speedVal.textContent = s + '×'; bus.emit(Events.SPEED_CHANGED, { speed: s }); },
      newVal, '播放速度'));
  });

  // ── 描边宽 ────────────────────────────────────────────
  strokeWidthInput.addEventListener('input', () => {
    const newVal = parseFloat(strokeWidthInput.value);
    undoMgr.execute(createPropertyCommand(
      () => state.strokeWidth,
      (w) => { state.strokeWidth = w; strokeWidthVal.textContent = String(w); bus.emit(Events.STROKE_WIDTH_CHANGED, { width: w }); },
      newVal, '描边宽度'));
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
  const applyPresetValues = (speed: number, sw: number, stagger: number, label: string) => {
    state.speedFactor = speed; (speedSlider as HTMLInputElement).value = String(speed); speedVal.textContent = speed + '×';
    state.strokeWidth = sw; strokeWidthInput.value = String(sw); strokeWidthVal.textContent = String(sw);
    state.staggerFactor = stagger; (staggerSlider as HTMLInputElement).value = String(stagger); staggerVal.textContent = stagger + '×';
    state.strokeElements.forEach(el => el.style.strokeWidth = String(sw));
    updateElements(state.currentProgress);
    bus.emit(Events.PRESET_APPLIED, { preset: label });
    bus.emit(Events.STROKE_WIDTH_CHANGED, { width: sw });
    bus.emit(Events.SPEED_CHANGED, { speed });
    bus.emit(Events.MODE_CHANGED, { mode: 'stagger', value: stagger });
    showToast('预设：' + label);
  };
  const makePresetCmd = (name: PresetName) => {
    const p = presets[name];
    const oldSpeed = state.speedFactor, oldSW = state.strokeWidth, oldStagger = state.staggerFactor;
    return createCallbackCommand(
      () => applyPresetValues(p.speed, p.strokeWidth, p.stagger, p.label),
      () => applyPresetValues(oldSpeed, oldSW, oldStagger, '恢复'),
      '预设-' + p.label);
  };
  $('presetFast').addEventListener('click', () => undoMgr.execute(makePresetCmd('fast')));
  $('presetStd').addEventListener('click', () => undoMgr.execute(makePresetCmd('standard')));
  $('presetFilm').addEventListener('click', () => undoMgr.execute(makePresetCmd('film')));

  const staggerSlider = $('staggerFactor') as HTMLInputElement;
  const staggerVal = $('staggerVal');
  const onStaggerChange = (newVal: number) => {
    state.staggerFactor = newVal;
    staggerVal.textContent = newVal + '×';
    bus.emit(Events.MODE_CHANGED, { mode: 'stagger', value: newVal });
    if (state.currentData && state.sequentialMode) fullRebuild();
  };
  staggerSlider.addEventListener('input', () => {
    const newVal = parseFloat(staggerSlider.value);
    const oldVal = state.staggerFactor;
    undoMgr.execute(createCallbackCommand(
      () => onStaggerChange(newVal),
      () => onStaggerChange(oldVal),
      '逐条间隔'));
  });
  bgColorInput.addEventListener('input', () => {
    const newVal = bgColorInput.value;
    undoMgr.execute(createPropertyCommand(
      () => state.bgColor,
      (c) => { state.bgColor = c; previewBg.style.backgroundColor = c; bus.emit(Events.BG_COLOR_CHANGED, { color: c }); },
      newVal, '背景颜色'));
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
    undoMgr.clear();
    fullRebuild();
    pastePanel.style.display = 'none';
    pasteText.value = '';
  });

  // ── 重置 ──────────────────────────────────────────────
  $('resetBtn').addEventListener('click', () => {
    if (!state.currentData) return;
    // 捕获重置前快照
    const snap = {
      strokeWidth: state.strokeWidth, speedFactor: state.speedFactor,
      strokeColor: state.strokeColor, fillColor: state.fillColor,
      syncColors: state.syncColors, bgColor: state.bgColor,
      preserveOriginalColors: state.preserveOriginalColors,
      sequentialMode: state.sequentialMode, staggerFactor: state.staggerFactor,
      keepStrokes: state.keepStrokes,
      customFills: [...state.customFills],
    };
    const applyState = (s: typeof snap) => {
      state.strokeWidth = s.strokeWidth; strokeWidthInput.value = String(s.strokeWidth); strokeWidthVal.textContent = String(s.strokeWidth);
      state.strokeColor = s.strokeColor; strokeColorInput.value = s.strokeColor;
      state.fillColor = s.fillColor; fillColorInput.value = s.fillColor;
      state.syncColors = s.syncColors; (document.getElementById('syncColors') as HTMLInputElement).checked = s.syncColors;
      state.bgColor = s.bgColor; bgColorInput.value = s.bgColor; previewBg.style.backgroundColor = s.bgColor;
      state.speedFactor = s.speedFactor; speedSlider.value = String(s.speedFactor); speedVal.textContent = s.speedFactor + '×';
      state.preserveOriginalColors = s.preserveOriginalColors; preserveColorsCheckbox.checked = s.preserveOriginalColors;
      state.sequentialMode = s.sequentialMode; sequentialCheckbox.checked = s.sequentialMode;
      state.staggerFactor = s.staggerFactor; staggerSlider.value = String(s.staggerFactor); staggerVal.textContent = s.staggerFactor + '×';
      state.keepStrokes = s.keepStrokes; (document.getElementById('keepStrokes') as HTMLInputElement).checked = s.keepStrokes;
      state.customFills = [...s.customFills];
      fullRebuild();
    };
    undoMgr.execute(createCallbackCommand(
      () => {
        const defIsDark = getCurrentTheme() === 'dark';
        const defColor = defIsDark ? '#ffffff' : '#000000';
        const defBg = defIsDark ? '#000000' : '#ffffff';
        state.strokeWidth = 8; strokeWidthInput.value = '8'; strokeWidthVal.textContent = '8';
        state.strokeColor = defColor; strokeColorInput.value = defColor;
        state.fillColor = defColor; fillColorInput.value = defColor;
        state.syncColors = true; (document.getElementById('syncColors') as HTMLInputElement).checked = true;
        state.bgColor = defBg; bgColorInput.value = defBg; previewBg.style.backgroundColor = defBg;
        state.speedFactor = 1; speedSlider.value = '1'; speedVal.textContent = '1×';
        state.autoBgEnabled = true; autoBgCheckPanel.checked = true;
        state.preserveOriginalColors = false; preserveColorsCheckbox.checked = false;
        state.sequentialMode = false; sequentialCheckbox.checked = false;
        state.staggerFactor = 1; staggerSlider.value = '1'; staggerVal.textContent = '1×';
        state.keepStrokes = true; (document.getElementById('keepStrokes') as HTMLInputElement).checked = true;
        fullRebuild();
        state.customFills = state.originalFills.map(() => null);
        if (layerPanel.style.display === 'flex') renderLayerPathList();
        fileInput.value = '';
        if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
        bus.emit(Events.ANIMATION_RESET);
      },
      () => { applyState(snap); if (layerPanel.style.display === 'flex') renderLayerPathList(); },
      '重置'));
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
    const oldFills = [...state.customFills];
    undoMgr.execute(createCallbackCommand(
      () => { state.customFills = state.originalFills.map(() => null); bus.emit(Events.LAYER_COLORS_RESET); renderLayerPathList(); showToast('路径颜色已重置'); },
      () => { state.customFills = [...oldFills]; bus.emit(Events.LAYER_COLORS_RESET); renderLayerPathList(); showToast('路径颜色已恢复'); },
      '重置路径颜色'));
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
        bus.emit(Events.ANIMATION_PAUSE);
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

  // ── 撤销/重做快捷键 ────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (undoMgr.canUndo()) { undoMgr.undo(); showToast('撤销 ↩'); }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (undoMgr.canRedo()) { undoMgr.redo(); showToast('重做 ↪'); }
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
