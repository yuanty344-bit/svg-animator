/**
 * 注册中心测试 — control-registry + engine-registry
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Control Registry', () => {
  // 每次测试前重新加载模块以获得干净状态
  let registerControl: Function;
  let bindAllControls: Function;
  let setControlValue: Function;

  beforeEach(async () => {
    document.body.innerHTML = `
      <input id="strokeColor" type="color" value="#ffffff" />
      <input id="syncColors" type="checkbox" checked />
      <input id="staggerFactor" type="range" min="0.5" max="3" step="0.25" value="1" />
      <select id="easing">
        <option value="linear" selected>线性</option>
        <option value="ease-in">缓入</option>
      </select>
      <button id="resetBtn">重置</button>
    `;

    // 动态导入以获得全新的模块状态
    const mod = await import('../src/core/control-registry.js');
    registerControl = mod.registerControl;
    bindAllControls = mod.bindAllControls;
    setControlValue = mod.setControlValue;
  });

  describe('registerControl + bindAllControls', () => {
    it('binds color input change', () => {
      const onChange = vi.fn();
      registerControl({ id: 'strokeColor', type: 'color', group: 'colors', onChange });
      bindAllControls();

      const el = document.getElementById('strokeColor') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(el, '#ff0000');
      el.dispatchEvent(new Event('input', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith('#ff0000');
    });

    it('binds checkbox change', () => {
      const onChange = vi.fn();
      registerControl({ id: 'syncColors', type: 'checkbox', group: 'colors', onChange });
      bindAllControls();

      const el = document.getElementById('syncColors') as HTMLInputElement;
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('binds range input change', () => {
      const onChange = vi.fn();
      registerControl({ id: 'staggerFactor', type: 'range', group: 'animation', onChange });
      bindAllControls();

      const el = document.getElementById('staggerFactor') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(el, '2');
      el.dispatchEvent(new Event('input', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('binds select change', () => {
      const onChange = vi.fn();
      registerControl({ id: 'easing', type: 'select', group: 'animation', onChange });
      bindAllControls();

      const el = document.getElementById('easing') as HTMLSelectElement;
      el.value = 'ease-in';
      el.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith('ease-in');
    });

    it('binds button click', () => {
      const onChange = vi.fn();
      registerControl({ id: 'resetBtn', type: 'button', group: 'actions', onChange });
      bindAllControls();

      const el = document.getElementById('resetBtn') as HTMLButtonElement;
      el.dispatchEvent(new Event('click', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('skips non-existent DOM element', () => {
      const onChange = vi.fn();
      registerControl({ id: 'nonexistent', type: 'checkbox', group: 'test', onChange });
      // should not throw
      expect(() => bindAllControls()).not.toThrow();
      // onChange never called because element doesn't exist
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('setControlValue', () => {
    it('sets color input value', () => {
      setControlValue('strokeColor', '#ff8800');
      const el = document.getElementById('strokeColor') as HTMLInputElement;
      expect(el.value).toBe('#ff8800');
    });

    it('sets range input value', () => {
      setControlValue('staggerFactor', 2.5);
      const el = document.getElementById('staggerFactor') as HTMLInputElement;
      expect(el.value).toBe('2.5');
    });

    it('sets checkbox checked state', () => {
      const el = document.getElementById('syncColors') as HTMLInputElement;
      expect(el.checked).toBe(true);
      setControlValue('syncColors', false);
      expect(el.checked).toBe(false);
    });

    it('does nothing for non-existent element', () => {
      expect(() => setControlValue('nonexistent', 'test')).not.toThrow();
    });
  });
});

describe('Engine Registry', () => {
  let registerEngine: Function;
  let switchEngine: Function;
  let getActiveEngine: Function;
  let getActiveId: Function;
  let getEngine: Function;
  let getEngineList: Function;

  const mockStrokeEngine = {
    id: 'stroke',
    name: '描边动画',
    init: vi.fn(),
    tick: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
  };

  const mockParticleEngine = {
    id: 'particle',
    name: '粒子动画',
    init: vi.fn(),
    tick: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
  };

  beforeEach(async () => {
    // Reset mock call history
    mockStrokeEngine.init.mockClear();
    mockStrokeEngine.tick.mockClear();
    mockStrokeEngine.render.mockClear();
    mockStrokeEngine.destroy.mockClear();
    mockParticleEngine.init.mockClear();
    mockParticleEngine.tick.mockClear();
    mockParticleEngine.render.mockClear();
    mockParticleEngine.destroy.mockClear();

    // Re-import to get fresh registry state
    const mod = await import('../src/core/engine-registry.js');
    registerEngine = mod.registerEngine;
    switchEngine = mod.switchEngine;
    getActiveEngine = mod.getActiveEngine;
    getActiveId = mod.getActiveId;
    getEngine = mod.getEngine;
    getEngineList = mod.getEngineList;

    // Register both engines
    registerEngine(mockStrokeEngine);
    registerEngine(mockParticleEngine);

    // Switch back to stroke (default) to reset state
    // First switch to particle, then back to stroke
    const currentId = getActiveId();
    if (currentId === 'particle') {
      await switchEngine('stroke');
      mockStrokeEngine.init.mockClear();
    }
  });

  describe('registerEngine', () => {
    it('registers engine and makes it retrievable', () => {
      const engine = getEngine('stroke');
      expect(engine).toBeDefined();
      expect(engine!.id).toBe('stroke');
      expect(engine!.name).toBe('描边动画');
    });

    it('getEngine returns undefined for unknown id', () => {
      expect(getEngine('nonexistent')).toBeUndefined();
    });
  });

  describe('switchEngine', () => {
    it('switches to new engine and calls init', () => {
      switchEngine('particle');
      expect(getActiveId()).toBe('particle');
      expect(mockParticleEngine.init).toHaveBeenCalledOnce();
    });

    it('calls destroy on old engine when switching', () => {
      switchEngine('particle');
      expect(mockStrokeEngine.destroy).toHaveBeenCalledOnce();
    });

    it('does nothing for non-existent engine id', () => {
      const prevId = getActiveId();
      // Should not throw
      expect(() => switchEngine('nonexistent')).not.toThrow();
      // active ID unchanged
      expect(getActiveId()).toBe(prevId);
    });

    it('emits ENGINE_SWITCHED event', async () => {
      const { bus, Events } = await import('../src/core/events.js');
      const fn = vi.fn();
      const unsub = bus.on(Events.ENGINE_SWITCHED, fn);

      switchEngine('particle');

      expect(fn).toHaveBeenCalledWith({ from: 'stroke', to: 'particle' });
      unsub();
    });
  });

  describe('getActiveEngine', () => {
    it('returns stroke engine by default', () => {
      const engine = getActiveEngine();
      expect(engine).toBeDefined();
      expect(engine!.id).toBe('stroke');
    });

    it('returns particle engine after switch', () => {
      switchEngine('particle');
      const engine = getActiveEngine();
      expect(engine!.id).toBe('particle');
    });
  });

  describe('getEngineList', () => {
    it('returns all registered engines', () => {
      const list = getEngineList();
      expect(list).toHaveLength(2);
      expect(list.map((e: any) => e.id).sort()).toEqual(['particle', 'stroke']);
    });
  });
});
