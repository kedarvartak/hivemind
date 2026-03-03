import { z } from "zod";
import { STYLE_CATEGORIES, type StyleStore } from "../types.js";

export const updateStyleRuleSchema = z.object({
  id: z.string().describe("UUID of the style rule to update"),
  content: z.string().describe("New content for the rule. Fully replaces the existing content. Use append_style_rule to add without erasing."),
  topic: z.string().optional().describe("If provided, renames the rule topic"),
  tags: z.array(z.string()).optional().describe("If provided, replaces the current tags"),
  category: z.enum(STYLE_CATEGORIES as [string, ...string[]]).optional().describe("If provided, moves the rule to a different category"),
});

export async function updateStyleRuleTool(
  args: z.infer<typeof updateStyleRuleSchema>,
  store: StyleStore,
  isReviewer: boolean,
) {
  if (!isReviewer) {
    return {
      content: [{ type: "text" as const, text: "Permission denied. Only reviewers can update style rules." }],
      isError: true,
    };
  }

  try {
    const rule = await store.updateRule(args.id, args.content, args.topic, args.tags, args.category as any);

    return {
      content: [
        {
          type: "text" as const,
          text: `Style rule updated.\nID: ${rule.id}\nTopic: ${rule.topic}\nVersion: ${rule.version}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
