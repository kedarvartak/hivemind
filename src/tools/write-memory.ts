import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const writeMemorySchema = z.object({
  id: z.string().describe("The UUID of the memory block to update"),
  content: z
    .string()
    .describe(
      "New content to write into the block. This REPLACES all existing content. " +
        "Use append_memory instead if you want to add to existing content.",
    ),
  topic: z
    .string()
    .optional()
    .describe("If provided, also renames the block's topic label"),
  tags: z
    .array(z.string())
    .optional()
    .describe("If provided, replaces the block's current tags"),
});

export async function writeMemoryTool(
  args: z.infer<typeof writeMemorySchema>,
  store: MemoryStore,
) {
  try {
    const block = await store.updateBlock(args.id, args.content, args.tags, args.topic);

    return {
      content: [
        {
          type: "text" as const,
          text: `Block updated.\n**ID:** ${block.id}\n**Topic:** ${block.topic}\n**Version:** ${block.version}`,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
  }
}
