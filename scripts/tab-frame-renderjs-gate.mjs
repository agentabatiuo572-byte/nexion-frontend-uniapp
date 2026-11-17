// Tab 页 renderjs 门(2026-11-18):模板根用 tab-page-frame 的页面不许声明 renderjs 模块。
//
// uni 把页面级 renderjs 模块(.vOwnerId / .vRenderjs)设在组件根元素上。tab-page-frame 在 Tab 宿主里
// 渲染成 Fragment(两个 slot),根是 #text 锚点:视图层 setAttr 抛错,同一批 vdSync 后面的操作全丢,
// iOS App 切 Tab 卡住、内容错乱。renderjs 放进单根子组件(参照 src/components/earn/earn-hero-tile.vue)。
//
// 用法:node scripts/tab-frame-renderjs-gate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FRAME_IMPORT = /import\s+\w+\s+from\s+["']@\/components\/tab-page-frame\.vue["']/;
const RENDERJS = /lang=["']renderjs["']/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".vue")) out.push(p);
  }
  return out;
}

const framed = walk("src").filter((file) => FRAME_IMPORT.test(readFileSync(file, "utf8")));
const bad = framed.filter((file) => RENDERJS.test(readFileSync(file, "utf8")));
for (const file of bad) {
  console.error(`  ✗ ${file}: 模板根是 tab-page-frame(Tab 宿主里是 Fragment),却声明了 lang="renderjs" —— 移到单根子组件`);
}
if (framed.length === 0) {
  console.error("  ✗ 没找到任何 import tab-page-frame.vue 的页面 —— 判据失效");
  process.exit(1);
}
if (bad.length) process.exit(1);
console.log(`Tab 页 renderjs 门:${framed.length} 个 tab-page-frame 页面均未声明 renderjs`);
