// ── UI 事件 & 图层面板 ──────────────────────────────────

import { state, CONST, totalCycle, elementCycle } from './state.js';
import { parseSVG } from './parser.js';
import { rebuildPreviewDOM, reorderDomElements, measureAndCacheLengths } from './renderer.js';
import { updateColors, updateElements, invalidateFillCache, resetAnimation, tick } from './animator.js';
import { buildCurrentSnapshotSVG, exportHTML, exportSVG, exportImage, showToast } from './exporter.js';

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
      updateElements(state.currentProgress);
    });
    div.appendChild(cb);
    // 逐路径颜色选择器：显示当前有效填充色
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    const effectiveColor = state.preserveOriginalColors
      ? (state.originalFills[i] || '#ffffff')
      : state.fillColor;
    colorInput.value = effectiveColor;
    colorInput.title = '路径 ' + (i + 1) + ' 颜色';
    colorInput.style.cssText = 'width:18px;height:18px;border:none;background:transparent;cursor:pointer;padding:0;flex-shrink:0';
    colorInput.addEventListener('input', function () {
      state.originalFills[i] = colorInput.value;
      updateElements(state.currentProgress);
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
      const n = state.strokeElements.length;
      const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
      state.animStart =
        performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
      state.lastTickTime = 0;
      syncPlayIcon();
      tick();
    }
  }, CONST.KEYBOARD_RESUME_DELAY);
}

// ── 初始化 ──────────────────────────────────────────────

export function initUI(): void {
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
  const syncCheckbox = $('syncColors') as HTMLInputElement;
  const preserveColorsCheckbox = $('preserveColors') as HTMLInputElement;
  const sequentialCheckbox = $('sequentialMode') as HTMLInputElement;
  const layerPanel = $('layerPanel');
  const layerHeader = $('layerHeader');
  const autoBgCheckPanel = $('autoBgCheckPanel') as HTMLInputElement;
  const pastePanel = $('pastePanel');
  const pasteText = $('pasteText') as HTMLTextAreaElement;
  const fileInput = $('fileInput') as HTMLInputElement;

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
    updateElements(state.currentProgress);
  });
  timelineSlider.addEventListener('change', () => {
    if (state.playDesired) {
      state.paused = false;
      const n = state.strokeElements.length;
      const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
      state.animStart = performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
      state.lastTickTime = 0;
      tick();
    } else {
      state.paused = true;
    }
  });

  // ── 速度 ──────────────────────────────────────────────
  speedSlider.addEventListener('input', () => {
    state.speedFactor = parseFloat(speedSlider.value);
    speedVal.textContent = state.speedFactor + '×';
    if (!state.paused) {
      const n = state.strokeElements.length;
      const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
      state.animStart = performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
      state.lastTickTime = 0;
    }
  });

  // ── 描边宽 ────────────────────────────────────────────
  strokeWidthInput.addEventListener('input', () => {
    state.strokeWidth = parseFloat(strokeWidthInput.value);
    strokeWidthVal.textContent = String(state.strokeWidth);
    state.strokeElements.forEach((el) => (el.style.strokeWidth = String(state.strokeWidth)));
  });

  // ── 颜色 ──────────────────────────────────────────────
  strokeColorInput.addEventListener('input', () => { state.strokeColor = strokeColorInput.value; updateColors(); });
  fillColorInput.addEventListener('input', () => { state.fillColor = fillColorInput.value; state.syncColors = false; syncCheckbox.checked = false; updateColors(); });
  syncCheckbox.addEventListener('change', () => { state.syncColors = syncCheckbox.checked; updateColors(); });
  preserveColorsCheckbox.addEventListener('change', () => {
    state.preserveOriginalColors = preserveColorsCheckbox.checked;
    if (state.currentData) {
      fullRebuild();
      if (layerPanel.style.display === 'flex') renderLayerPathList();
    }
    showToast(state.preserveOriginalColors ? '保留原色：开' : '统一颜色：开');
  });
  sequentialCheckbox.addEventListener('change', () => {
    state.sequentialMode = sequentialCheckbox.checked;
    if (state.currentData) fullRebuild();
    showToast(state.sequentialMode ? '逐条绘制：开' : '同步绘制：开');
  });
  const keepStrokesCheckbox = $('keepStrokes') as HTMLInputElement;
  keepStrokesCheckbox.addEventListener('change', () => {
    state.keepStrokes = keepStrokesCheckbox.checked;
    updateElements(state.currentProgress);
  });
  const easingSelect = $('easing') as HTMLSelectElement;
  easingSelect.addEventListener('change', () => {
    state.easing = easingSelect.value;
    updateElements(state.currentProgress);
  });
  const staggerSlider = $('staggerFactor') as HTMLInputElement;
  const staggerVal = $('staggerVal');
  staggerSlider.addEventListener('input', () => {
    state.staggerFactor = parseFloat(staggerSlider.value);
    staggerVal.textContent = state.staggerFactor + '×';
    if (state.currentData && state.sequentialMode) fullRebuild();
  });
  bgColorInput.addEventListener('input', () => { state.bgColor = bgColorInput.value; previewBg.style.backgroundColor = state.bgColor; });

  // ── 播放/暂停 ─────────────────────────────────────────
  $('playPauseBtn').addEventListener('click', () => {
    if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
    state.playDesired = !state.playDesired;
    if (state.playDesired) {
      state.paused = false;
      const n = state.strokeElements.length;
      const cd = state.sequentialMode ? elementCycle(n) : totalCycle();
      state.animStart = performance.now() - (state.currentProgress * cd) / state.speedFactor * 1000;
      state.lastTickTime = 0;
      syncPlayIcon();
      tick();
    } else {
      state.paused = true;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = null;
      syncPlayIcon();
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
    state.strokeColor = '#ffffff'; state.fillColor = '#ffffff'; state.syncColors = true; syncCheckbox.checked = true;
    strokeColorInput.value = '#ffffff'; fillColorInput.value = '#ffffff';
    state.bgColor = '#000000'; bgColorInput.value = '#000000'; previewBg.style.backgroundColor = '#000000';
    state.speedFactor = 1; speedSlider.value = '1'; speedVal.textContent = '1×';
    state.autoBgEnabled = true; autoBgCheckPanel.checked = true;
    state.preserveOriginalColors = false; preserveColorsCheckbox.checked = false;
    state.sequentialMode = false; sequentialCheckbox.checked = false;
    state.staggerFactor = 1; staggerSlider.value = '1'; staggerVal.textContent = '1×';
    state.keepStrokes = true; keepStrokesCheckbox.checked = true;
    state.easing = 'linear'; easingSelect.value = 'linear';
    fullRebuild();
    fileInput.value = '';
    if (state.keyboardResumeTimer) { clearTimeout(state.keyboardResumeTimer); state.keyboardResumeTimer = null; }
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
      updateElements(state.currentProgress);
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
    if (fmt === 'html') exportHTML();
    else if (fmt === 'svg') exportSVG();
    else if (fmt === 'png' || fmt === 'jpg') exportImage(fmt as 'png' | 'jpg');
  });

  window.addEventListener('beforeunload', () => { if (state.rafId) cancelAnimationFrame(state.rafId); });
}
