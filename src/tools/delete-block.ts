import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const deleteBlockSchema = z.object({
  id: z.string().describe("The UUID of the memory block to permanently delete"),
});

export async function deleteBlockTool(
  args: z.infer<typeof deleteBlockSchema>,
  store: MemoryStore,
) {
  const existing = await store.getBlock(args.id);
  if (!existing) {
    return {
      content: [{ type: "text" as const, text: `No block found with id: ${args.id}` }],
      isError: true,
    };
  }

  await store.deleteBlock(args.id);

  return {
    content: [
      {
        type: "text" as const,
        text: `Block "${existing.topic}" (${args.id}) deleted successfully.`,
      },
    ],
  };
}
