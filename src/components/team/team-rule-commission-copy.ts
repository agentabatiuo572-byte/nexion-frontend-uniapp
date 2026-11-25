import type { HowContentDocument, HowContentBlock } from '@/api/how-content-api';
import { platformDisplayText } from '@/lib/brand-copy';

export function commissionPublishedBlocks(document: HowContentDocument, tokens: Record<string, string>): HowContentBlock[] {
  return document.blocks.flatMap(block => {
    let available = true;
    const resolve = (raw: string) => platformDisplayText(raw.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (Object.prototype.hasOwnProperty.call(tokens, key)) return tokens[key];
      available = false;
      return '';
    }).trim());
    const title = resolve(block.title), body = resolve(block.body), items = block.items?.map(resolve);
    return available ? [{ ...block, title, body, ...(items ? { items } : {}) }] : [];
  });
}
