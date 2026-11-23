import { Comment, Fragment, Text, type VNode } from "vue";

const SVG_TAGS = new Set([
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse",
  "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "use", "text", "tspan",
]);

function escape(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function attrText(props: Record<string, unknown>): string {
  return Object.entries(props).flatMap(([name, value]) => {
    if (value == null || value === false || name === "key" || name === "ref" || /^on/i.test(name) || !/^[\w:-]+$/.test(name)) return [];
    if (["href", "xlink:href", "xlinkhref"].includes(name.toLowerCase())
        && !/^#[A-Za-z_][\w.-]*$/.test(String(value))) return [];
    if (name === "style" && typeof value === "object") {
      value = Object.entries(value).map(([key, val]) => `${key.replace(/[A-Z]/g, (x) => `-${x.toLowerCase()}`)}:${val}`).join(";");
    }
    if (name === "class" && Array.isArray(value)) value = value.join(" ");
    return [` ${name}="${escape(value)}"`];
  }).join("");
}

function childrenMarkup(nodes: unknown): string {
  if (Array.isArray(nodes)) return nodes.map(childrenMarkup).join("");
  if (typeof nodes === "string" || typeof nodes === "number") return escape(nodes);
  if (!nodes || typeof nodes !== "object") return "";
  const node = nodes as VNode;
  if (node.type === Comment) return "";
  if (node.type === Fragment) return childrenMarkup(node.children);
  if (node.type === Text) return escape(node.children ?? "");
  if (typeof node.type !== "string" || !SVG_TAGS.has(node.type)) return "";
  return `<${node.type}${attrText(node.props ?? {})}${scopeAttr(node.scopeId)}>${childrenMarkup(node.children)}</${node.type}>`;
}

// Vue marks every element a scoped template renders with that template's data-v attribute; markup written
// through v-html gets none, so it is added here and the page's own scoped rules reach the svg.
function scopeAttr(scopeId: string | null | undefined): string {
  return scopeId && /^data-v-[\w-]+$/.test(scopeId) ? ` ${scopeId}=""` : "";
}

export function svgMarkup(attrs: Record<string, unknown>, children: VNode[], rootScopeIds: readonly string[] = []): string {
  const rootScope = [...new Set(rootScopeIds)].map(scopeAttr).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg"${attrText(attrs)}${rootScope}>${childrenMarkup(children)}</svg>`;
}
