import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const listBlocksSchema = z.object({});

export async function listBlocksTool(
  _args: z.infer<typeof listBlocksSchema>,
  store: MemoryStore,
) {
  const blocks = await store.listBlocks();

  if (blocks.length === 0) {
    return { content: [{ type: "text" as const, text: "No memory blocks found." }] };
  }

  const summary = blocks
    .map(
      (b) =>
        `[${b.id}] ${b.topic}${b.tags.length ? ` (${b.tags.join(", ")})` : ""} — v${b.version}, updated ${b.updatedAt}`,
    )
    .join("\n");

  return { content: [{ type: "text" as const, text: summary }] };
}
