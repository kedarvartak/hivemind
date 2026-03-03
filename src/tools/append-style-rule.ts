import { z } from "zod";
import type { StyleStore } from "../types.js";

export const appendStyleRuleSchema = z.object({
  id: z.string().describe("UUID of the style rule to append to"),
  text: z.string().describe("Text to append to the end of the rule. Existing content is preserved. A blank line separator is added automatically."),
});

export async function appendStyleRuleTool(
  args: z.infer<typeof appendStyleRuleSchema>,
  store: StyleStore,
  isReviewer: boolean,
) {
  if (!isReviewer) {
    return {
      content: [{ type: "text" as const, text: "Permission denied. Only reviewers can modify style rules." }],
      isError: true,
    };
  }

  try {
    const rule = await store.appendRule(args.id, args.text);

    return {
      content: [
        {
          type: "text" as const,
          text: `Style rule updated (append).\nID: ${rule.id}\nTopic: ${rule.topic}\nVersion: ${rule.version}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
