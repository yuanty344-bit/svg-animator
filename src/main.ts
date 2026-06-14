import './style.css';
import { initTheme } from './core/themes.js';
import { initUI } from './ui/controls.js';

// Build version stamp (replaced at build time)
declare const __BUILD_TIME__: string;
console.log('SVG Animation Generator — built ' + __BUILD_TIME__);

// 主题恢复（在 UI 初始化前，避免闪烁）
initTheme();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// PWA: register service worker for offline caching (only on https/localhost)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

