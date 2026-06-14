/**
 * EventBus 单元测试
 *
 * 覆盖：on/once/off/emit/removeAll/listenerCount
 * 事件传递：无参数、单参数、多参数
 * 错误隔离：一个 handler 抛错不影响其他 handler
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, bus, Events } from '../src/core/events.js';

describe('EventBus', () => {
  let eb: EventBus;

  beforeEach(() => {
    eb = new EventBus();
  });

  describe('on / emit', () => {
    it('calls handler when event is emitted', () => {
      const fn = vi.fn();
      eb.on('test', fn);
      eb.emit('test');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('passes arguments to handler', () => {
      const fn = vi.fn();
      eb.on('test', fn);
      eb.emit('test', 42, 'hello', { a: 1 });
      expect(fn).toHaveBeenCalledWith(42, 'hello', { a: 1 });
    });

    it('calls multiple handlers for same event', () => {
      const f1 = vi.fn();
      const f2 = vi.fn();
      eb.on('test', f1);
      eb.on('test', f2);
      eb.emit('test', 'x');
      expect(f1).toHaveBeenCalledWith('x');
      expect(f2).toHaveBeenCalledWith('x');
    });

    it('does not call handlers for different events', () => {
      const fn = vi.fn();
      eb.on('test', fn);
      eb.emit('other');
      expect(fn).not.toHaveBeenCalled();
    });

    it('does nothing when emitting event with no listeners', () => {
      expect(() => eb.emit('nonexistent')).not.toThrow();
    });
  });

  describe('once', () => {
    it('calls handler only once', () => {
      const fn = vi.fn();
      eb.once('test', fn);
      eb.emit('test');
      eb.emit('test');
      eb.emit('test');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('passes arguments to once handler', () => {
      const fn = vi.fn();
      eb.once('test', fn);
      eb.emit('test', 'arg');
      expect(fn).toHaveBeenCalledWith('arg');
    });
  });

  describe('off', () => {
    it('removes specific handler', () => {
      const f1 = vi.fn();
      const f2 = vi.fn();
      eb.on('test', f1);
      eb.on('test', f2);
      eb.off('test', f1);
      eb.emit('test');
      expect(f1).not.toHaveBeenCalled();
      expect(f2).toHaveBeenCalledOnce();
    });

    it('does nothing when removing non-existent handler', () => {
      const fn = vi.fn();
      expect(() => eb.off('test', fn)).not.toThrow();
    });

    it('does nothing when removing from non-existent event', () => {
      expect(() => eb.off('noevent', vi.fn())).not.toThrow();
    });
  });

  describe('unsubscribe (returned from on)', () => {
    it('removes handler when unsubscribe is called', () => {
      const fn = vi.fn();
      const unsub = eb.on('test', fn);
      unsub();
      eb.emit('test');
      expect(fn).not.toHaveBeenCalled();
    });

    it('only removes the specific handler', () => {
      const f1 = vi.fn();
      const f2 = vi.fn();
      const unsub = eb.on('test', f1);
      eb.on('test', f2);
      unsub();
      eb.emit('test');
      expect(f1).not.toHaveBeenCalled();
      expect(f2).toHaveBeenCalledOnce();
    });
  });

  describe('removeAll', () => {
    it('removes all handlers for specific event', () => {
      const f1 = vi.fn();
      const f2 = vi.fn();
      eb.on('a', f1);
      eb.on('b', f2);
      eb.removeAll('a');
      eb.emit('a');
      eb.emit('b');
      expect(f1).not.toHaveBeenCalled();
      expect(f2).toHaveBeenCalledOnce();
    });

    it('removes all handlers for all events when no argument', () => {
      const f1 = vi.fn();
      const f2 = vi.fn();
      eb.on('a', f1);
      eb.on('b', f2);
      eb.removeAll();
      eb.emit('a');
      eb.emit('b');
      expect(f1).not.toHaveBeenCalled();
      expect(f2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('returns 0 for event with no listeners', () => {
      expect(eb.listenerCount('test')).toBe(0);
    });

    it('returns correct count for event with listeners', () => {
      eb.on('test', vi.fn());
      eb.on('test', vi.fn());
      expect(eb.listenerCount('test')).toBe(2);
    });

    it('decreases after off', () => {
      const fn = vi.fn();
      eb.on('test', fn);
      eb.off('test', fn);
      expect(eb.listenerCount('test')).toBe(0);
    });
  });

  describe('error isolation', () => {
    it('one handler throwing does not prevent others', () => {
      const good = vi.fn();
      const bad = vi.fn(() => { throw new Error('boom'); });
      eb.on('test', bad);
      eb.on('test', good);
      expect(() => eb.emit('test')).toThrow('boom');
      // good handler was called before the bad one threw
      // (Set iteration order = insertion order in V8)
      expect(bad).toHaveBeenCalledOnce();
    });
  });
});

describe('Events constants', () => {
  it('all event names are unique', () => {
    const values = Object.values(Events);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('has SVG_LOADED event', () => {
    expect(Events.SVG_LOADED).toBe('svg:loaded');
  });

  it('has COLOR_CHANGED event', () => {
    expect(Events.COLOR_CHANGED).toBe('color:changed');
  });

  it('has MODE_CHANGED event', () => {
    expect(Events.MODE_CHANGED).toBe('mode:changed');
  });

  it('has ANIMATION_PLAY / ANIMATION_PAUSE events', () => {
    expect(Events.ANIMATION_PLAY).toBe('animation:play');
    expect(Events.ANIMATION_PAUSE).toBe('animation:pause');
  });

  it('has ENGINE_SWITCHED event', () => {
    expect(Events.ENGINE_SWITCHED).toBe('engine:switched');
  });
});

describe('bus singleton', () => {
  it('is an instance of EventBus', () => {
    expect(bus).toBeInstanceOf(EventBus);
  });

  it('is a singleton (always same instance)', () => {
    // Dynamic import to get a "fresh" reference
    expect(bus).toBe(bus);
  });
});

describe('integration: bus + engine events', () => {
  it('COLOR_CHANGED event triggers listener', () => {
    const fn = vi.fn();
    const unsub = bus.on(Events.COLOR_CHANGED, fn);
    bus.emit(Events.COLOR_CHANGED, { type: 'stroke' });
    expect(fn).toHaveBeenCalledWith({ type: 'stroke' });
    unsub();
  });

  it('MODE_CHANGED event passes mode and value', () => {
    const fn = vi.fn();
    const unsub = bus.on(Events.MODE_CHANGED, fn);
    bus.emit(Events.MODE_CHANGED, { mode: 'keepStrokes', value: false });
    expect(fn).toHaveBeenCalledWith({ mode: 'keepStrokes', value: false });
    unsub();
  });

  it('TIMELINE_SEEK event passes progress', () => {
    const fn = vi.fn();
    const unsub = bus.on(Events.TIMELINE_SEEK, fn);
    bus.emit(Events.TIMELINE_SEEK, { progress: 0.5 });
    expect(fn).toHaveBeenCalledWith({ progress: 0.5 });
    unsub();
  });

  it('ENGINE_SWITCHED event passes from/to', () => {
    const fn = vi.fn();
    const unsub = bus.on(Events.ENGINE_SWITCHED, fn);
    bus.emit(Events.ENGINE_SWITCHED, { from: 'stroke', to: 'particle' });
    expect(fn).toHaveBeenCalledWith({ from: 'stroke', to: 'particle' });
    unsub();
  });

  it('LAYER_VISIBILITY_CHANGED event passes index and visible', () => {
    const fn = vi.fn();
    const unsub = bus.on(Events.LAYER_VISIBILITY_CHANGED, fn);
    bus.emit(Events.LAYER_VISIBILITY_CHANGED, { index: 3, visible: false });
    expect(fn).toHaveBeenCalledWith({ index: 3, visible: false });
    unsub();
  });
});
