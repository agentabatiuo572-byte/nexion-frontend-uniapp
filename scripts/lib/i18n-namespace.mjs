// i18n 词典的**命名空间切片** —— 各契约测试共用一份。
//
// 🔴 为什么必须按命名空间取,不能对整份词典做子串匹配(g-remote-authority-contract 的实付教训):
// 同一个 key 名在多个命名空间里并存(`remoteUnavailableClosed` 在 exchange 与 staking 都有;
// `unavailable` 在 uiChrome 之外也有)。整文件匹配时,把本命名空间那条清成空串,另一个命名空间
// 的同名 key 会**替它满足断言** —— 独立审计红测实测过「四道门同时绿而横幅渲染空白」。
//
// 🔴 为什么单独成文件:第二个使用者出现时就该收口。留在某个 test 文件里让另一个复制,
// 就是「修了一道门、漏了另一道」的标准形态(scripts/lib/strip-code.mjs 的文件头注记着同一个坑)。
import assert from "node:assert/strict";

/** 取顶层命名空间(缩进 2 空格)那一整块的源码文本;取不到即判据失效,按红处理。 */
export function namespaceBlock(source, name) {
  const start = source.search(new RegExp(`^  ${name}: \\{`, "m"));
  assert.ok(start >= 0, `i18n 词典里找不到命名空间 ${name} —— 判据失效,按红处理`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) return source.slice(start, i + 1); }
  }
  assert.fail(`命名空间 ${name} 的大括号未闭合 —— 判据失效,按红处理`);
}

/**
 * 断言某个 i18n key 在三语的指定命名空间里都有**非空**值。
 * 锚 key 的门必须同时锚「key 有值」,否则指向一个不存在的键也能绿(悬空 key = 页面渲染空白)。
 */
export function assertKeyInAllLocales(read, ns, keys, locales = ["en", "zh", "vi"]) {
  for (const locale of locales) {
    const block = namespaceBlock(read(`src/i18n/messages/${locale}.ts`), ns);
    for (const key of keys) {
      assert.match(block, new RegExp(`\\b${key}:\\s*"[^"]+"`), `${locale}.ts 的 ${ns} 命名空间缺 ${key} 或值为空`);
    }
  }
}
