import './style.css';
import { initUI } from './ui/controls.js';

// Build version stamp (replaced at build time)
declare const __BUILD_TIME__: string;
console.log('SVG Animation Generator — built ' + __BUILD_TIME__);


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// PWA: register service worker for offline caching (only on https/localhost)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

