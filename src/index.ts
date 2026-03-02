import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JsonStore } from "./store/json-store.js";
import { listBlocksSchema, listBlocksTool } from "./tools/list-blocks.js";
import { readMemorySchema, readMemoryTool } from "./tools/read-memory.js";
import { createBlockSchema, createBlockTool } from "./tools/create-block.js";
import { writeMemorySchema, writeMemoryTool } from "./tools/write-memory.js";
import { appendMemorySchema, appendMemoryTool } from "./tools/append-memory.js";
import { searchMemorySchema, searchMemoryTool } from "./tools/search-memory.js";
import { deleteBlockSchema, deleteBlockTool } from "./tools/delete-block.js";

// ---------------------------------------------------------------------------
// Resolve the memory directory relative to the project root
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_DIR = path.resolve(__dirname, "../memory");

async function main() {
  // Initialise store
  const store = new JsonStore(MEMORY_DIR);
  await store.init();

  // Create MCP server
  const server = new McpServer({
    name: "memoree",
    version: "0.1.0",
  });

  // ── Tools ─────────────────────────────────────────────────────────────────

  server.tool(
    "list_blocks",
    "List all memory blocks with their IDs, topics, tags and last-updated timestamps. " +
      "Call this at the START of every conversation to recall what you already know.",
    listBlocksSchema.shape,
    (args) => listBlocksTool(args, store),
  );

  server.tool(
    "read_memory",
    "Read the full content of a specific memory block by its ID.",
    readMemorySchema.shape,
    (args) => readMemoryTool(args, store),
  );

  server.tool(
    "create_block",
    "Create a new memory block with a topic, optional initial content and optional tags. " +
      "Use this when you need to remember something that doesn't fit any existing block.",
    createBlockSchema.shape,
    (args) => createBlockTool(args, store),
  );

  server.tool(
    "write_memory",
    "REPLACE the content (and optionally topic/tags) of an existing memory block. " +
      "Use this to rewrite a block from scratch. To ADD to existing content, use append_memory instead.",
    writeMemorySchema.shape,
    (args) => writeMemoryTool(args, store),
  );

  server.tool(
    "append_memory",
    "Append new text to the END of an existing memory block without erasing what's already there. " +
      "Prefer this over write_memory when adding new info to a block that already has content.",
    appendMemorySchema.shape,
    (args) => appendMemoryTool(args, store),
  );

  server.tool(
    "search_memory",
    "Fuzzy-search across all memory blocks by topic, tags or content. Returns ranked results.",
    searchMemorySchema.shape,
    (args) => searchMemoryTool(args, store),
  );

  server.tool(
    "delete_block",
    "Permanently delete a memory block by ID.",
    deleteBlockSchema.shape,
    (args) => deleteBlockTool(args, store),
  );

  // ── Transport ─────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Memoree MCP server running. Memory dir:", MEMORY_DIR);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
