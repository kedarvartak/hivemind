import { z } from "zod";
import type { MemoryStore } from "../types.js";

export const searchMemorySchema = z.object({
  query: z.string().describe("Search string — matched against topic, tags and content"),
});

export async function searchMemoryTool(
  args: z.infer<typeof searchMemorySchema>,
  store: MemoryStore,
) {
  const blocks = await store.searchBlocks(args.query);

  if (blocks.length === 0) {
    return {
      content: [{ type: "text" as const, text: `No blocks matched "${args.query}".` }],
    };
  }

  const lines = blocks.map(
    (b) =>
      `[${b.id}] ${b.topic}${b.tags.length ? ` (${b.tags.join(", ")})` : ""}\n  ${b.content.slice(0, 120).replace(/\n/g, " ")}${b.content.length > 120 ? "…" : ""}`,
  );

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${blocks.length} block(s):\n\n${lines.join("\n\n")}`,
      },
    ],
  };
}
