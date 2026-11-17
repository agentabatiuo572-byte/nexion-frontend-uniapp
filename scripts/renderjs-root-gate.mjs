// renderjs 根元素门(2026-11-18):声明 renderjs 模块的 .vue,模板根必须是单个原生元素。
//
// uni 把组件的 renderjs 模块(.vOwnerId / .vRenderjs)设在组件的根元素上:
//   · 根是 Fragment / 多根 / v-if 根(如 tab-page-frame 在 Tab 宿主里)→ 属性落到 #text 锚点,视图层 setAttr 抛错,
//     同一批 vdSync 后面的操作全丢,iOS App 切 Tab 卡住、内容错乱;
//   · 根是组件(如页面根 AppChassis,它的根 view 自带 chromeView renderjs)→ 父子两层写同一元素,后写覆盖 owner。
// renderjs 放进以原生元素为根的子组件(参照 src/components/earn/earn-hero-tile.vue、src/components/me/trial-count-amount.vue)。
//
// 用法:node scripts/renderjs-root-gate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@vue/compiler-sfc";

const RENDERJS = /lang=["']renderjs["']/;
const IMPORT = /import\s+(\w+)\s+from\s+["'][^"']+\.vue["']/g;
const BRANCH = new Set(["if", "else-if", "else", "for"]);
const camel = (tag) => tag.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase());

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".vue")) out.push(p);
  }
  return out;
}

const owners = walk("src").filter((file) => RENDERJS.test(readFileSync(file, "utf8")));
const bad = [];
for (const file of owners) {
  const src = readFileSync(file, "utf8");
  const ast = parse(src, { filename: file }).descriptor.template?.ast;
  const roots = (ast?.children ?? []).filter((n) => n.type === 1);
  const components = new Set([...src.matchAll(IMPORT)].map((m) => m[1]));
  const root = roots[0];
  const why = roots.length !== 1 ? `模板有 ${roots.length} 个根元素(Fragment)`
    : root.tag === "template" || root.tag === "slot" ? `根是 <${root.tag}>(Fragment)`
    : root.props.some((p) => p.type === 7 && BRANCH.has(p.name)) ? `根 <${root.tag}> 带 v-if/v-for(可能渲染成注释或 Fragment)`
    : components.has(camel(root.tag)) || /^[A-Z]/.test(root.tag) ? `根是组件 <${root.tag}>(owner 写到子组件的根元素上)`
    : "";
  if (why) bad.push(`  ✗ ${file}: 声明了 lang="renderjs",但${why} —— 把 renderjs 移到以原生元素为根的子组件`);
}
for (const line of bad) console.error(line);
if (owners.length === 0) {
  console.error("  ✗ 没找到任何声明 renderjs 的 .vue —— 判据失效");
  process.exit(1);
}
if (bad.length) process.exit(1);
console.log(`renderjs 根元素门:${owners.length} 个声明 renderjs 的 .vue 根均为单个原生元素`);
