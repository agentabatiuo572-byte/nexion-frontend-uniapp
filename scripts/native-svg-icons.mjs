import { parse } from "@vue/compiler-sfc";

// App-vue builds template SVG elements in the XHTML namespace, where they have no size
// and never paint. Every template SVG therefore goes through NxNativeSvg, which writes
// the markup through the App view layer's v-html path (SVG namespace). Rules for SVG
// written this way:
// - scoped styles reach the svg and its inner nodes only through :deep() on a real
//   scoped wrapper (the inner nodes carry no data-v attribute);
// - inner nodes keep attributes only: events and refs are dropped, so interaction
//   lives on a real element around the svg;
// - any change to the markup replaces the whole svg, so a value that changes over time
//   (countdowns, progress, toggled classes) belongs in a CSS variable or class on the
//   real wrapper, otherwise CSS animations restart and transitions never run.
export function nativeSvgIcons() {
  return {
    name: "nexgrid-native-svg-icons",
    enforce: "pre",
    transform(source, id) {
      if (process.env.UNI_PLATFORM !== "app" || !id.endsWith(".vue") || !source.includes("<svg")) return null;
      const { descriptor } = parse(source, { filename: id });
      const root = descriptor.template?.ast;
      if (!root) return null;

      const edits = [];
      const visit = (node) => {
        if (node.type === 1 && node.tag === "svg" && !node.isSelfClosing) {
          edits.push([node.loc.start.offset + 1, 3, "NxNativeSvg"]);
          edits.push([node.loc.end.offset - 4, 3, "NxNativeSvg"]);
          return; // the markup writer serialises nested nodes itself
        }
        for (const child of node.children ?? []) visit(child);
      };
      visit(root);
      if (!edits.length) return null;
      let code = source;
      for (const [offset, length, replacement] of edits.sort((a, b) => b[0] - a[0])) {
        code = code.slice(0, offset) + replacement + code.slice(offset + length);
      }
      return { code, map: null };
    },
  };
}
