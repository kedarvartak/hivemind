import { z } from "zod";
import { STYLE_CATEGORIES, type StyleStore } from "../types.js";

export const createStyleRuleSchema = z.object({
  topic: z.string().describe("Short label for the rule, e.g. 'Naming: React components must be PascalCase'"),
  content: z.string().describe("Full markdown content of the rule. Be specific and include correct/incorrect examples."),
  category: z.enum(STYLE_CATEGORIES as [string, ...string[]]).describe("Category: naming | formatting | architecture | testing | documentation | git | general"),
  tags: z.array(z.string()).optional().describe("Optional tags for easier searching"),
});

export async function createStyleRuleTool(
  args: z.infer<typeof createStyleRuleSchema>,
  store: StyleStore,
  reviewerName: string,
  isReviewer: boolean,
) {
  if (!isReviewer) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            "Permission denied. Only reviewers can create style rules.\n" +
            "Set MEMOREE_ROLE=reviewer in your .env file to enable write access.",
        },
      ],
      isError: true,
    };
  }

  try {
    const rule = await store.createRule(
      args.topic,
      args.content,
      args.category as any,
      args.tags ?? [],
      reviewerName,
    );

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Style rule created.\n` +
            `ID: ${rule.id}\n` +
            `Topic: ${rule.topic}\n` +
            `Category: ${rule.category}\n` +
            `Author: ${rule.createdBy}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
