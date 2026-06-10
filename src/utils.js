// ── 纯工具函数 ──────────────────────────────────────────

/** HTML 实体转义 */
export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 规范化 viewBox，兼容逗号分隔 */
export function normalizeViewBox(vb) {
  return String(vb).trim().replace(/,/g, ' ').split(/\s+/).join(' ');
}

/** viewBox → [x, y, w, h] */
export function parseViewBoxParts(vb) {
  const parts = normalizeViewBox(vb).split(' ');
  const nums = parts.map(Number);
  if (nums.length >= 4 && nums.every(n => !isNaN(n))) return nums;
  return [0, 0, 1024, 1024];
}

/** 解析颜色值 → 规范化字符串或 null */
export function parseColor(val) {
  const v = (val || '').trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v.startsWith('rgb')) return v;
  if (v.startsWith('#')) {
    if (v.length === 4) return '#' + v[1]+v[1] + v[2]+v[2] + v[3]+v[3];
    return v;
  }
  return v; // named color
}

/** Hex → {r, g, b}，失败返回 null */
export function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** 临时 SVG 辅助：创建→回调→清理 */
export function withTempSVG(viewBox, fn) {
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('viewBox', viewBox);
  tmp.style.cssText =
    'position:absolute;visibility:hidden;width:1024px;height:1024px;pointer-events:none';
  document.body.appendChild(tmp);
  try {
    return fn(tmp);
  } finally {
    document.body.removeChild(tmp);
  }
}
