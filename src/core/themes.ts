/**
 * 主题管理 — CSS 自定义属性驱动
 *
 * applyTheme(name) → 设置 <html data-theme="..."> → CSS 变量切换。
 * 主题持久化到 localStorage，启动时自动恢复。
 * 切换时发射 THEME_CHANGED 事件，其他模块可监听。
 */

import { bus, Events } from './events.js';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'svg-animator-theme';

export function getCurrentTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light') return 'light';
  return 'dark';
}

export function applyTheme(name: ThemeName): void {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(STORAGE_KEY, name);
  bus.emit(Events.THEME_CHANGED, { theme: name });
}

export function toggleTheme(): ThemeName {
  const current = getCurrentTheme();
  const next: ThemeName = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** 启动时恢复主题（main.ts 中调用） */
export function initTheme(): void {
  applyTheme(getCurrentTheme());
}
