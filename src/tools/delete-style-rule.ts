import { z } from "zod";
import type { StyleStore } from "../types.js";

export const deleteStyleRuleSchema = z.object({
  id: z.string().describe("UUID of the style rule to permanently delete"),
});

export async function deleteStyleRuleTool(
  args: z.infer<typeof deleteStyleRuleSchema>,
  store: StyleStore,
  isReviewer: boolean,
) {
  if (!isReviewer) {
    return {
      content: [{ type: "text" as const, text: "Permission denied. Only reviewers can delete style rules." }],
      isError: true,
    };
  }

  const existing = await store.getRule(args.id);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `No style rule found with id: ${args.id}` }],
      isError: true,
    };
  }

  try {
    await store.deleteRule(args.id);
    return {
      content: [{ type: "text" as const, text: `Style rule "${existing.topic}" (${args.id}) deleted.` }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
