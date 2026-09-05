import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./support-tickets.vue", {
  query: "?raw", import: "default", eager: true,
})["./support-tickets.vue"] ?? "") as string;

describe("ticket FAQ suggestion refresh", () => {
  it("preserves last-good suggestions only within the same locale/category scope", () => {
    expect(source).toContain("ticketSuggestionGeneration");
    expect(source).toContain("requestedLocale");
    expect(source).toContain("requestedCategory");
    expect(source).toContain("ticketSuggestionCache");
    expect(source).toContain("ticketSuggestionKey");
    expect(source).toContain("ticketSuggestionCache.get(scopeKey) ?? []");
  });

  it("uses bounded server pages and exposes all published suggestions through load more", () => {
    expect(source).toContain("supportApi.faqPage(requestedLocale, requestedCategory, \"Ticket Create\", 1, TICKET_SUGGESTION_PAGE_SIZE)");
    expect(source).toContain("async function loadMoreTicketSuggestions()");
    expect(source).toContain("ticketSuggestions.value.length < ticketSuggestionTotal.value");
    expect(source).toContain('@click="loadMoreTicketSuggestions"');
    expect(source).not.toContain("supportApi.faqs(");
  });
});
