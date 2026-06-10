// ── SVG 解析 ────────────────────────────────────────────

import { normalizeViewBox, parseColor } from './utils.js';

const SKIP_ATTRS = new Set([
  'stroke',
  'stroke-width',
  'style',
  'class',
  'id',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
]);

const GEOM_TAGS = new Set([
  'path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline',
]);

/**
 * 提取元素属性 + 原始填充色
 * - fill="none" / fill="transparent" → null（显式透明）
 * - fill="" 或无 fill 属性 → #000000（SVG 默认黑色）
 * - fill="#xxx" → 规范化颜色
 */
export function extractAttrsAndFill(element) {
  const attrs = {};
  let fill = null;
  let hasExplicitFill = false;

  for (const attr of element.attributes) {
    if (attr.name === 'fill') {
      const raw = (attr.value || '').trim().toLowerCase();
      if (raw === 'none' || raw === 'transparent') {
        fill = null;
        hasExplicitFill = true;
      } else if (raw) {
        fill = parseColor(attr.value);
        hasExplicitFill = true;
      }
      // raw === '' → 走 SVG 默认黑色
    } else if (!SKIP_ATTRS.has(attr.name)) {
      attrs[attr.name] = attr.value;
    }
  }

  // 检查 style 属性中的 fill
  if (!hasExplicitFill) {
    const style = element.getAttribute('style') || '';
    const m = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);
    if (m) {
      const sf = m[1].trim().toLowerCase();
      if (sf === 'none' || sf === 'transparent') {
        fill = null;
        hasExplicitFill = true;
      } else if (sf) {
        fill = parseColor(sf);
        hasExplicitFill = true;
      }
    }
  }

  // SVG 默认：无显式 fill → 黑色
  if (fill === null && !hasExplicitFill) {
    fill = '#000000';
  }

  return { attrs, fill };
}

/** 解析 SVG 文本 → { viewBox, elements, originalElements } */
export function parseSVG(text) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;

    const viewBox = normalizeViewBox(
      svg.getAttribute('viewBox') || '0 0 1024 1024'
    );
    const elements = [];

    function walk(node) {
      for (const child of node.children) {
        if (GEOM_TAGS.has(child.tagName.toLowerCase())) {
          const { attrs, fill } = extractAttrsAndFill(child);
          elements.push({
            tag: child.tagName.toLowerCase(),
            attrs,
            originalFill: fill,
          });
        } else {
          walk(child);
        }
      }
    }
    walk(svg);

    return elements.length
      ? { viewBox, elements, originalElements: elements.slice() }
      : null;
  } catch {
    return null;
  }
}
