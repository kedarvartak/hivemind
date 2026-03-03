import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const readMemorySchema = z.object({
  id: z.string().describe("The UUID of the memory block to read"),
});

export async function readMemoryTool(
  args: z.infer<typeof readMemorySchema>,
  store: MemoryStore,
) {
  const block = await store.getBlock(args.id);

  if (!block) {
    return {
      content: [{ type: "text" as const, text: `No block found with id: ${args.id}` }],
      isError: true,
    };
  }

  const text = [
    `# ${block.topic}`,
    `ID: ${block.id}`,
    `Tags: ${block.tags.length ? block.tags.join(", ") : "none"}`,
    `Version: ${block.version}`,
    `Created: ${block.createdAt}`,
    `Updated: ${block.updatedAt}`,
    "",
    block.content,
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}
