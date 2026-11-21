import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const entry = require.resolve("@dcloudio/uni-h5/dist/uni-h5.es.js").replace(/\\/g, "/");
const { version } = require("@dcloudio/uni-h5/package.json");
const before = `  snap() {
    const itemSize = this._itemSize;
    const position = this._position % itemSize;
    const i = Math.abs(position) > this._itemSize / 2 ? this._position - (itemSize - Math.abs(position)) : this._position - position;
    if (this._position !== i) {
      this._snapping = true;
      this.scrollTo(-i);
      if (isFunction(this._options.onSnap)) {
        this._options.onSnap(
          Math.round(Math.abs(this._position) / this._itemSize)
        );
      }
    }
  }`;
const after = `  snap() {
    const itemSize = this._itemSize;
    const position = this._position % itemSize;
    const i = Math.abs(position) > this._itemSize / 2 ? this._position - (itemSize - Math.abs(position)) : this._position - position;
    if (this._position !== i) {
      this._snapping = true;
      this.scrollTo(-i);
    }
    if (isFunction(this._options.onSnap)) {
      this._options.onSnap(
        Math.round(Math.abs(this._position) / this._itemSize)
      );
    }
  }`;

// BUG-393: an aligned drag still commits its row; only an unaligned row needs scrollTo.
export function uniH5PickerSnap() {
  let applied = false;
  const drift = detail => `uni-h5 升级后这段源码变了，需要重核 BUG-393（当前依赖版本 ${version}；${detail}）`;
  return {
    name: "nexgrid-uni-h5-picker-snap",
    apply: (_config, { command }) => command === "build" && process.env.UNI_PLATFORM === "h5",
    enforce: "pre",
    transform(source, id) {
      if (id.split("?")[0].replace(/\\/g, "/") !== entry) return null;
      const matches = source.split(before).length - 1;
      if (matches !== 1) this.error(drift(`目标片段匹配 ${matches} 处，必须恰好 1 处`));
      applied = true;
      return { code: source.replace(before, after), map: null };
    },
    generateBundle() {
      if (!applied) this.error(drift("未找到目标 uni-h5 ES 文件"));
    },
  };
}
