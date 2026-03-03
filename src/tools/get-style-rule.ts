import { z } from "zod";
import type { StyleStore } from "../types.js";

export const getStyleRuleSchema = z.object({
  id: z.string().describe("UUID of the style rule to retrieve"),
});

export async function getStyleRuleTool(
  args: z.infer<typeof getStyleRuleSchema>,
  store: StyleStore,
) {
  const rule = await store.getRule(args.id);

  if (!rule) {
    return {
      content: [{ type: "text" as const, text: `No style rule found with id: ${args.id}` }],
      isError: true,
    };
  }

  const text = [
    `# ${rule.topic}`,
    `ID: ${rule.id}`,
    `Category: ${rule.category}`,
    `Tags: ${rule.tags.length ? rule.tags.join(", ") : "none"}`,
    `Author: ${rule.createdBy}`,
    `Version: ${rule.version}`,
    `Updated: ${rule.updatedAt}`,
    "",
    rule.content,
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}
