import { z } from "zod";
import type { StyleStore } from "../types.js";

export const searchStyleRulesSchema = z.object({
  query: z.string().describe("Search string matched against topic, category, tags and content"),
});

export async function searchStyleRulesTool(
  args: z.infer<typeof searchStyleRulesSchema>,
  store: StyleStore,
) {
  const rules = await store.searchRules(args.query);

  if (rules.length === 0) {
    return {
      content: [{ type: "text" as const, text: `No style rules matched "${args.query}".` }],
    };
  }

  const lines = rules.map(
    (r) =>
      `[${r.id}] [${r.category}] ${r.topic}${r.tags.length ? ` (${r.tags.join(", ")})` : ""}\n` +
      `  ${r.content.slice(0, 120).replace(/\n/g, " ")}${r.content.length > 120 ? "..." : ""}`,
  );

  return {
    content: [{ type: "text" as const, text: `Found ${rules.length} style rule(s):\n\n${lines.join("\n\n")}` }],
  };
}
