// ── SVG 解析 ────────────────────────────────────────────

import type { SVGElementData, ParsedSVG } from './types.js';
import { normalizeViewBox, parseColor } from './utils.js';

const SKIP_ATTRS = new Set([
  'stroke', 'stroke-width', 'style', 'class', 'id',
  'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
]);

const GEOM_TAGS = new Set([
  'path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline',
]);

export function extractAttrsAndFill(
  element: Element
): { attrs: Record<string, string>; fill: string | null } {
  const attrs: Record<string, string> = {};
  let fill: string | null = null;
  let hasExplicitFill = false;

  for (const attr of (element as Element).attributes) {
    if (attr.name === 'fill') {
      const raw = (attr.value || '').trim().toLowerCase();
      if (raw === 'none' || raw === 'transparent') {
        fill = null;
        hasExplicitFill = true;
      } else if (raw) {
        fill = parseColor(attr.value);
        hasExplicitFill = true;
      }
    } else if (!SKIP_ATTRS.has(attr.name)) {
      attrs[attr.name] = attr.value;
    }
  }

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

  if (fill === null && !hasExplicitFill) {
    fill = '#000000';
  }

  return { attrs, fill };
}

export function parseSVG(text: string): ParsedSVG | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;

    const viewBox = normalizeViewBox(
      svg.getAttribute('viewBox') || '0 0 1024 1024'
    );
    const elements: SVGElementData[] = [];

    function walk(node: Element) {
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
