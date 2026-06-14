/**
 * 控件注册中心
 *
 * 注册控件 → 绑定到已有 DOM 元素（id 匹配）→ 自动绑定事件。
 * 加新控件：在 index.html 添加元素 + registerControl({...})
 */

export interface ControlDescriptor {
  id: string;
  type: 'color' | 'checkbox' | 'range' | 'select' | 'button';
  label?: string;
  title?: string;
  group: string;
  default?: string | number | boolean;
  min?: number; max?: number; step?: number;
  options?: { value: string; label: string }[];
  onChange?: (value: any) => void;
}

const bindings: ControlDescriptor[] = [];

export function registerControl(ctl: ControlDescriptor): void {
  bindings.push(ctl);
}

/** 绑定所有已注册控件到 DOM（在 initUI 中调用） */
export function bindAllControls(): void {
  for (const ctl of bindings) {
    const el = document.getElementById(ctl.id);
    if (!el) continue;

    if (ctl.type === 'color' || ctl.type === 'range') {
      const input = el as HTMLInputElement;
      if (ctl.onChange) {
        input.addEventListener('input', () => ctl.onChange!(ctl.type === 'range' ? parseFloat(input.value) : input.value));
      }
    } else if (ctl.type === 'checkbox') {
      const input = el as HTMLInputElement;
      if (ctl.onChange) input.addEventListener('change', () => ctl.onChange!(input.checked));
    } else if (ctl.type === 'select') {
      const sel = el as HTMLSelectElement;
      if (ctl.onChange) sel.addEventListener('change', () => ctl.onChange!(sel.value));
    } else if (ctl.type === 'button') {
      const btn = el as HTMLButtonElement;
      if (ctl.onChange) btn.addEventListener('click', () => ctl.onChange!(true));
    }
  }
}

/** 更新已注册控件的值 */
export function setControlValue(id: string, value: string | number | boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else el.value = String(value);
}

