import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const appendMemorySchema = z.object({
  id: z.string().describe("The UUID of the memory block to append to"),
  text: z
    .string()
    .describe(
      "Text to append to the end of the block. Existing content is preserved. " +
        "A blank line is added as separator automatically.",
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe("If provided, replaces the block's current tags"),
});

export async function appendMemoryTool(
  args: z.infer<typeof appendMemorySchema>,
  store: MemoryStore,
) {
  try {
    const block = await store.appendBlock(args.id, args.text, args.tags);

    return {
      content: [
        {
          type: "text" as const,
          text: `Block updated (append).\n**ID:** ${block.id}\n**Topic:** ${block.topic}\n**Version:** ${block.version}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
