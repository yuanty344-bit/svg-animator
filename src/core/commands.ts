/**
 * 命令模式 + 撤销栈
 *
 * 每次数据变更包装为 Command → UndoManager 管理 undo/redo。
 * Ctrl+Z 撤销，Ctrl+Y / Ctrl+Shift+Z 重做。
 * 发射 UNDO_STACK_CHANGED 事件通知 UI 更新。
 *
 * 用法：
 *   import { undoMgr, createPropertyCommand, createCallbackCommand } from './commands.js';
 *   undoMgr.execute(createPropertyCommand(() => state.foo, (v) => { state.foo = v; ... }, newVal));
 */

import { bus, Events } from './events.js';

// ── 接口 ──────────────────────────────────────────────────

export interface Command {
  execute(): void;
  undo(): void;
  description?: string;
}

// ── 撤销管理器 ────────────────────────────────────────────

const MAX_STACK = 50;

class UndoManager {
  private _undo: Command[] = [];
  private _redo: Command[] = [];

  /** 执行命令并入栈 */
  execute(cmd: Command): void {
    cmd.execute();
    this._undo.push(cmd);
    if (this._undo.length > MAX_STACK) this._undo.shift();
    this._redo = [];
    this._notify();
  }

  /** 撤销最近一步 */
  undo(): void {
    const cmd = this._undo.pop();
    if (!cmd) return;
    cmd.undo();
    this._redo.push(cmd);
    this._notify();
  }

  /** 重做 */
  redo(): void {
    const cmd = this._redo.pop();
    if (!cmd) return;
    cmd.execute();
    this._undo.push(cmd);
    this._notify();
  }

  canUndo(): boolean { return this._undo.length > 0; }
  canRedo(): boolean { return this._redo.length > 0; }

  /** 清空（SVG 加载时调用） */
  clear(): void {
    this._undo = [];
    this._redo = [];
    this._notify();
  }

  private _notify(): void {
    bus.emit(Events.UNDO_STACK_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }
}

export const undoMgr = new UndoManager();

// ── 命令工厂 ──────────────────────────────────────────────

/**
 * 属性变更命令 — 适用于简单的 old→new 状态变更。
 * `get` 在创建时调用以捕获旧值，`set` 在 execute/undo 时调用。
 */
export function createPropertyCommand<T>(
  get: () => T,
  set: (value: T) => void,
  newValue: T,
  description?: string,
): Command {
  const oldValue = get();
  return {
    description,
    execute: () => set(newValue),
    undo: () => set(oldValue),
  };
}

/**
 * 回调命令 — 适用于复杂操作（execute 和 undo 逻辑不同）。
 * `execute` / `undo` 均无参数，由调用方闭包捕获上下文。
 */
export function createCallbackCommand(
  doFn: () => void,
  undoFn: () => void,
  description?: string,
): Command {
  return {
    description,
    execute: doFn,
    undo: undoFn,
  };
}

/**
 * 组合命令 — 多个子命令打包为一个原子操作。
 * 用于预设、重置等一次改多个属性的场景。
 */
export function createCompositeCommand(
  cmds: Command[],
  description?: string,
): Command {
  return {
    description,
    execute: () => cmds.forEach(c => c.execute()),
    undo: () => [...cmds].reverse().forEach(c => c.undo()),
  };
}
