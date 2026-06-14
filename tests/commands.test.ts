/**
 * 命令模式 + 撤销栈测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { undoMgr, createPropertyCommand, createCallbackCommand, createCompositeCommand, type Command } from '../src/core/commands.js';
import { bus, Events } from '../src/core/events.js';

describe('UndoManager', () => {
  beforeEach(() => {
    undoMgr.clear();
  });

  describe('execute', () => {
    it('executes command and makes it undoable', () => {
      const fn = vi.fn();
      undoMgr.execute({ execute: fn, undo: vi.fn() });
      expect(fn).toHaveBeenCalledOnce();
      expect(undoMgr.canUndo()).toBe(true);
      expect(undoMgr.canRedo()).toBe(false);
    });

    it('clears redo stack on new execute', () => {
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      undoMgr.undo();
      expect(undoMgr.canRedo()).toBe(true);
      // new execute clears redo
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      expect(undoMgr.canRedo()).toBe(false);
    });

    it('emits UNDO_STACK_CHANGED event', () => {
      const fn = vi.fn();
      const unsub = bus.on(Events.UNDO_STACK_CHANGED, fn);
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      expect(fn).toHaveBeenCalledWith({ canUndo: true, canRedo: false });
      unsub();
    });
  });

  describe('undo / redo', () => {
    it('undo calls command.undo and makes it redoable', () => {
      const undoFn = vi.fn();
      undoMgr.execute({ execute: vi.fn(), undo: undoFn });
      undoMgr.undo();
      expect(undoFn).toHaveBeenCalledOnce();
      expect(undoMgr.canRedo()).toBe(true);
      expect(undoMgr.canUndo()).toBe(false);
    });

    it('redo calls command.execute again', () => {
      const execFn = vi.fn();
      undoMgr.execute({ execute: execFn, undo: vi.fn() });
      undoMgr.undo();
      execFn.mockClear();
      undoMgr.redo();
      expect(execFn).toHaveBeenCalledOnce();
      expect(undoMgr.canUndo()).toBe(true);
    });

    it('undo does nothing when stack empty', () => {
      expect(() => undoMgr.undo()).not.toThrow();
      expect(undoMgr.canUndo()).toBe(false);
    });

    it('redo does nothing when stack empty', () => {
      expect(() => undoMgr.redo()).not.toThrow();
      expect(undoMgr.canRedo()).toBe(false);
    });

    it('undo + redo restore original state', () => {
      let val = 10;
      const cmd: Command = {
        execute: () => { val = 20; },
        undo: () => { val = 10; },
      };
      undoMgr.execute(cmd);
      expect(val).toBe(20);
      undoMgr.undo();
      expect(val).toBe(10);
      undoMgr.redo();
      expect(val).toBe(20);
    });

    it('emits event on undo', () => {
      const fn = vi.fn();
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      const unsub = bus.on(Events.UNDO_STACK_CHANGED, fn);
      undoMgr.undo();
      expect(fn).toHaveBeenCalledWith({ canUndo: false, canRedo: true });
      unsub();
    });
  });

  describe('clear', () => {
    it('clears both stacks', () => {
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
      undoMgr.undo();
      undoMgr.clear();
      expect(undoMgr.canUndo()).toBe(false);
      expect(undoMgr.canRedo()).toBe(false);
    });
  });
});

describe('createPropertyCommand', () => {
  it('switches value from old to new on execute', () => {
    const state = { color: '#fff' };
    const cmd = createPropertyCommand(
      () => state.color,
      (v) => { state.color = v; },
      '#000',
    );
    cmd.execute();
    expect(state.color).toBe('#000');
  });

  it('restores old value on undo', () => {
    const state = { color: '#fff' };
    const cmd = createPropertyCommand(
      () => state.color,
      (v) => { state.color = v; },
      '#000',
    );
    cmd.execute();
    cmd.undo();
    expect(state.color).toBe('#fff');
  });

  it('captures old value at creation time', () => {
    const state = { color: '#fff' };
    const cmd = createPropertyCommand(
      () => state.color,
      (v) => { state.color = v; },
      '#000',
    );
    // Change state before execute — old value already captured
    state.color = '#abc';
    cmd.execute();
    expect(state.color).toBe('#000');
    cmd.undo();
    expect(state.color).toBe('#fff'); // restored to creation-time old value
  });
});

describe('createCallbackCommand', () => {
  it('calls doFn on execute, undoFn on undo', () => {
    const doFn = vi.fn();
    const undoFn = vi.fn();
    const cmd = createCallbackCommand(doFn, undoFn);
    cmd.execute();
    expect(doFn).toHaveBeenCalledOnce();
    cmd.undo();
    expect(undoFn).toHaveBeenCalledOnce();
  });

  it('works with UndoManager', () => {
    let val = 0;
    const cmd = createCallbackCommand(
      () => { val = 100; },
      () => { val = 0; },
    );
    undoMgr.clear();
    undoMgr.execute(cmd);
    expect(val).toBe(100);
    undoMgr.undo();
    expect(val).toBe(0);
  });
});

describe('createCompositeCommand', () => {
  it('executes all sub-commands in order', () => {
    const log: string[] = [];
    const cmd = createCompositeCommand([
      { execute: () => log.push('a'), undo: () => log.push('ua') },
      { execute: () => log.push('b'), undo: () => log.push('ub') },
    ]);
    cmd.execute();
    expect(log).toEqual(['a', 'b']);
  });

  it('undoes sub-commands in reverse order', () => {
    const log: string[] = [];
    const cmd = createCompositeCommand([
      { execute: () => log.push('a'), undo: () => log.push('ua') },
      { execute: () => log.push('b'), undo: () => log.push('ub') },
    ]);
    cmd.execute();
    log.length = 0;
    cmd.undo();
    expect(log).toEqual(['ub', 'ua']);
  });

  it('works with UndoManager', () => {
    const state = { a: 1, b: 10 };
    undoMgr.clear();
    undoMgr.execute(createCompositeCommand([
      createPropertyCommand(() => state.a, (v) => { state.a = v; }, 2),
      createPropertyCommand(() => state.b, (v) => { state.b = v; }, 20),
    ]));
    expect(state).toEqual({ a: 2, b: 20 });
    undoMgr.undo();
    expect(state).toEqual({ a: 1, b: 10 });
  });
});

describe('MAX_STACK limit', () => {
  it('drops oldest commands when exceeding limit', () => {
    undoMgr.clear();
    // Push 52 commands (limit is 50)
    for (let i = 0; i < 52; i++) {
      undoMgr.execute({ execute: vi.fn(), undo: vi.fn() });
    }
    // Can undo 50 times max, but we can only verify it doesn't crash
    for (let i = 0; i < 50; i++) {
      undoMgr.undo();
    }
    expect(undoMgr.canUndo()).toBe(false);
  });
});
