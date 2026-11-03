// uni-app turns newlines (including a literal \n) inside <text> into forced breaks.
export function receiptLine(value = ""): string {
  return value.replace(/(?:\\r\\n|\\n|[\r\n\u2028\u2029])+/g, " ");
}
