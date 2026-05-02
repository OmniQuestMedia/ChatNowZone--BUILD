// apps/chatnow-zone/lib/render-plan-to-react.tsx
// PAYLOAD-9 (Next.js bootstrap) — adapter that converts a RenderElement tree
// (produced by page builders in ui/app/*) into React elements.
//
// The render-plan is framework-agnostic by design (see ui/components/render-plan.ts):
//   - tag         → React element type (HTML tag string)
//   - test_id     → data-testid
//   - aria        → spread as ARIA attrs
//   - classes     → className (joined)
//   - style       → style prop
//   - on          → event-handler hooks (NOT bound in this Alpha bootstrap;
//                   interactive surfaces will wire handlers in a follow-up)
//   - props       → standard HTML attrs are passed through; everything else
//                   becomes a data-* attribute so React does not warn about
//                   unknown DOM properties.

import type { ReactNode } from 'react';
import { createElement, Fragment } from 'react';

interface RenderElement {
  tag: string;
  test_id?: string;
  aria?: Record<string, string>;
  classes?: readonly string[];
  style?: Record<string, string | number>;
  on?: Readonly<Record<string, string>>;
  props?: Readonly<Record<string, unknown>>;
  children?: RenderNode[];
}

type RenderNode = RenderElement | string | number | null | undefined | RenderNode[];

const PASSTHROUGH_ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'value',
  'maxLength',
  'maxlength',
  'required',
  'rel',
  'target',
  'placeholder',
  'tabIndex',
  'type',
  'name',
  'id',
  'role',
]);

function snakeToDashKey(name: string): string {
  return `data-${name.replace(/_/g, '-')}`;
}

export function renderPlanToReact(node: RenderNode, key?: string | number): ReactNode {
  if (node == null) return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) {
    return createElement(
      Fragment,
      { key },
      ...node.map((child, i) => renderPlanToReact(child, i)),
    );
  }

  const { tag, test_id, aria, classes, style, props, children } = node;
  const reactProps: Record<string, unknown> = {};
  if (key !== undefined) reactProps.key = key;
  if (test_id) reactProps['data-testid'] = test_id;
  if (classes && classes.length > 0) reactProps.className = classes.join(' ');
  if (style) reactProps.style = style;
  if (aria) {
    for (const [k, v] of Object.entries(aria)) {
      reactProps[k] = v;
    }
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (PASSTHROUGH_ATTRS.has(k)) {
        reactProps[k] = v;
      } else {
        reactProps[snakeToDashKey(k)] = v == null ? '' : String(v);
      }
    }
  }
  // Event handlers (`on`) are intentionally not bound here. Page builders
  // emit handler names as strings (e.g. on: { click: 'navigateToCyranoPanel' });
  // wiring them to actual functions is a follow-up once the routes that
  // need interactivity are in scope.

  const childNodes = children?.map((c, i) => renderPlanToReact(c, i)) ?? [];
  return createElement(tag, reactProps, ...childNodes);
}
