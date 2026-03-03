import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JsonStore } from "./store/json-store.js";
import { TursoStyleStore } from "./store/turso-store.js";

// Personal memory tools
import { listBlocksSchema, listBlocksTool } from "./tools/list-blocks.js";
import { readMemorySchema, readMemoryTool } from "./tools/read-memory.js";
import { createBlockSchema, createBlockTool } from "./tools/create-block.js";
import { writeMemorySchema, writeMemoryTool } from "./tools/write-memory.js";
import { appendMemorySchema, appendMemoryTool } from "./tools/append-memory.js";
import { searchMemorySchema, searchMemoryTool } from "./tools/search-memory.js";
import { deleteBlockSchema, deleteBlockTool } from "./tools/delete-block.js";

// Team style-rule tools
import { listStyleRulesSchema, listStyleRulesTool } from "./tools/list-style-rules.js";
import { getStyleRuleSchema, getStyleRuleTool } from "./tools/get-style-rule.js";
import { createStyleRuleSchema, createStyleRuleTool } from "./tools/create-style-rule.js";
import { updateStyleRuleSchema, updateStyleRuleTool } from "./tools/update-style-rule.js";
import { appendStyleRuleSchema, appendStyleRuleTool } from "./tools/append-style-rule.js";
import { deleteStyleRuleSchema, deleteStyleRuleTool } from "./tools/delete-style-rule.js";
import { searchStyleRulesSchema, searchStyleRulesTool } from "./tools/search-style-rules.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_DIR = path.resolve(__dirname, "../memory");

const TURSO_URL   = process.env.TURSO_DATABASE_URL ?? "";
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN   ?? "";

// "reviewer" -> read + write access to style rules
// "member"   -> read-only (default)
const IS_REVIEWER  = (process.env.MEMOREE_ROLE ?? "member").toLowerCase() === "reviewer";
const REVIEWER_NAME = process.env.MEMOREE_USER ?? "reviewer";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Local personal memory store
  const memoryStore = new JsonStore(MEMORY_DIR);
  await memoryStore.init();

  // Cloud team style-rules store (Turso)
  if (!TURSO_URL || !TURSO_TOKEN) {
    console.error(
      "[hivemind] WARNING: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set. " +
        "Style-rule tools will not work. Add them to your .env file.",
    );
  }
  const styleStore = new TursoStyleStore(TURSO_URL, TURSO_TOKEN);
  await styleStore.init(); // creates table + indexes if they do not exist

  // MCP server
  const server = new McpServer({
    name: "hivemind",
    version: "0.2.0",
  });

  // ---- Personal memory tools -----------------------------------------------

  server.tool(
    "list_blocks",
    "List all personal memory blocks. Call at the START of every conversation to recall context.",
    listBlocksSchema.shape,
    (args) => listBlocksTool(args, memoryStore),
  );

  server.tool(
    "read_memory",
    "Read the full content of a specific personal memory block by ID.",
    readMemorySchema.shape,
    (args) => readMemoryTool(args, memoryStore),
  );

  server.tool(
    "create_block",
    "Create a new personal memory block (topic, content, tags).",
    createBlockSchema.shape,
    (args) => createBlockTool(args, memoryStore),
  );

  server.tool(
    "write_memory",
    "Fully replace the content of a personal memory block. Use append_memory to add without erasing.",
    writeMemorySchema.shape,
    (args) => writeMemoryTool(args, memoryStore),
  );

  server.tool(
    "append_memory",
    "Append new text to the end of a personal memory block without erasing existing content.",
    appendMemorySchema.shape,
    (args) => appendMemoryTool(args, memoryStore),
  );

  server.tool(
    "search_memory",
    "Fuzzy-search personal memory blocks by topic, tags or content.",
    searchMemorySchema.shape,
    (args) => searchMemoryTool(args, memoryStore),
  );

  server.tool(
    "delete_block",
    "Permanently delete a personal memory block.",
    deleteBlockSchema.shape,
    (args) => deleteBlockTool(args, memoryStore),
  );

  // ---- Team style-rule tools (Turso cloud) ----------------------------------

  server.tool(
    "list_style_rules",
    "List ALL team coding style rules, optionally filtered by category. " +
      "Call this at the start of any coding task and follow every rule strictly.",
    listStyleRulesSchema.shape,
    (args) => listStyleRulesTool(args, styleStore),
  );

  server.tool(
    "get_style_rule",
    "Read the full content of a specific team style rule by ID.",
    getStyleRuleSchema.shape,
    (args) => getStyleRuleTool(args, styleStore),
  );

  server.tool(
    "search_style_rules",
    "Fuzzy-search team style rules by topic, category, tags or content.",
    searchStyleRulesSchema.shape,
    (args) => searchStyleRulesTool(args, styleStore),
  );

  server.tool(
    "create_style_rule",
    "[REVIEWER ONLY] Create a new team coding style rule stored in the shared Turso database.",
    createStyleRuleSchema.shape,
    (args) => createStyleRuleTool(args, styleStore, REVIEWER_NAME, IS_REVIEWER),
  );

  server.tool(
    "update_style_rule",
    "[REVIEWER ONLY] Fully replace the content of an existing style rule.",
    updateStyleRuleSchema.shape,
    (args) => updateStyleRuleTool(args, styleStore, IS_REVIEWER),
  );

  server.tool(
    "append_style_rule",
    "[REVIEWER ONLY] Add more content to an existing style rule without erasing it.",
    appendStyleRuleSchema.shape,
    (args) => appendStyleRuleTool(args, styleStore, IS_REVIEWER),
  );

  server.tool(
    "delete_style_rule",
    "[REVIEWER ONLY] Permanently delete a team style rule.",
    deleteStyleRuleSchema.shape,
    (args) => deleteStyleRuleTool(args, styleStore, IS_REVIEWER),
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[hivemind] MCP server v0.2.0 running.\n` +
      `  Role     : ${IS_REVIEWER ? "reviewer (read+write)" : "member (read-only)"}\n` +
      `  User     : ${REVIEWER_NAME}\n` +
      `  MemoryDir: ${MEMORY_DIR}\n` +
      `  Turso    : ${TURSO_URL ? TURSO_URL : "NOT CONFIGURED"}`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
