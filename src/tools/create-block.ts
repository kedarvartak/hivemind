import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const createBlockSchema = z.object({
  topic: z.string().describe("Short topic label for the new memory block, e.g. 'Auth design decisions'"),
  content: z.string().optional().describe("Initial content of the block (markdown supported)"),
  tags: z.array(z.string()).optional().describe("Optional list of tags for categorisation"),
});

export async function createBlockTool(
  args: z.infer<typeof createBlockSchema>,
  store: MemoryStore,
) {
  const block = await store.createBlock(args.topic, args.content ?? "", args.tags ?? []);

  return {
    content: [
      {
        type: "text" as const,
        text: `Memory block created.\nID: ${block.id}\nTopic: ${block.topic}`,
      },
    ],
  };
}
