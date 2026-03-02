# HiveMind

HiveMind is an MCP (Model Context Protocol) server that solves two problems for software teams:

1. AI agents forget everything between conversations. HiveMind gives each developer a persistent personal memory that survives across sessions.
2. Teams have coding standards that AI agents ignore. HiveMind lets reviewers define style rules in a shared cloud database, and every AI agent on the team reads and enforces those rules automatically.

---

## How it works

HiveMind runs as a local MCP server on each developer's machine. It exposes tools that the AI agent calls during a conversation. There are two separate stores:

**Personal memory** is stored as JSON files on the developer's local machine. The AI uses these to remember project context, decisions, and preferences across conversations. Only that developer's agent reads and writes this store.

**Team style rules** are stored in a shared Supabase (Postgres) database in the cloud. All team members connect to the same database. Reviewers write the rules. Every developer's AI agent reads them. When a new rule is added by a reviewer, all agents pick it up the next time they call `list_style_rules`.

---

## Role system

There are two roles:

- **reviewer** - can create, update, append to, and delete style rules. Set `MEMOREE_ROLE=reviewer` in the `.env` file for the 4 reviewers on your team.
- **member** - read-only access to style rules. This is the default. Set `MEMOREE_ROLE=member` or leave it unset for all other developers.

Write operations are blocked at the tool layer for members. Even if a member tries to call `create_style_rule`, the server rejects it with a permission error.

---

## Setup

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open the SQL Editor inside your Supabase project dashboard
3. Paste and run the contents of `supabase-setup.sql` — this creates the `style_rules` table, indexes, and auto-update triggers
4. Go to Settings > API and copy your project URL and anon key

### Step 3: Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

MEMOREE_USER=Alice
MEMOREE_ROLE=member
```

Set `MEMOREE_ROLE=reviewer` on reviewer machines. Set `MEMOREE_USER` to the person's name so it is recorded against any rules they create.

### Step 4: Build

```bash
npm run build
```

### Step 5: Add to your AI client

In your MCP config file (for example `~/.cursor/mcp.json` for Cursor, or `claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "hivemind": {
      "command": "node",
      "args": ["/absolute/path/to/Memoree/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key-here",
        "MEMOREE_USER": "Alice",
        "MEMOREE_ROLE": "member"
      }
    }
  }
}
```

Restart your AI client after adding this. Each team member adds their own copy with their own name and role.

---

## System prompt

For the memory and style enforcement to work automatically, add the following to your AI client's system prompt or rules settings:

```
You have access to a team memory and style enforcement system via MCP tools.

STYLE RULES
At the start of every coding task, call list_style_rules to load all team style rules.
Follow every rule strictly when writing or reviewing code.
If the user's code or request would violate a rule, point out the violation and explain the correct approach according to the rule.
Do not make exceptions to style rules even if asked.
Use search_style_rules to find rules relevant to the current task.
Use get_style_rule to read the full content of a specific rule.

PERSONAL MEMORY
At the start of each conversation, call list_blocks to recall your context.
Use create_block or append_memory during the conversation to save important information such as decisions made, project facts, and user preferences.
Use write_memory only when replacing an entire block from scratch.
```

---

## Tools

### Style rule tools (shared cloud database)

| Tool                 | Who can use it | What it does                                            |
| -------------------- | -------------- | ------------------------------------------------------- |
| `list_style_rules`   | Everyone       | List all rules, optionally filtered by category         |
| `get_style_rule`     | Everyone       | Read the full content of a rule by ID                   |
| `search_style_rules` | Everyone       | Fuzzy-search rules by topic, category, tags, or content |
| `create_style_rule`  | Reviewers only | Create a new style rule                                 |
| `update_style_rule`  | Reviewers only | Fully replace the content of an existing rule           |
| `append_style_rule`  | Reviewers only | Add to an existing rule without erasing it              |
| `delete_style_rule`  | Reviewers only | Permanently delete a rule                               |

### Personal memory tools (local JSON files)

| Tool            | What it does                                           |
| --------------- | ------------------------------------------------------ |
| `list_blocks`   | List all personal memory blocks                        |
| `read_memory`   | Read the full content of a memory block by ID          |
| `create_block`  | Create a new memory block                              |
| `write_memory`  | Replace a memory block's content entirely              |
| `append_memory` | Add to a memory block without erasing existing content |
| `search_memory` | Fuzzy-search memory blocks                             |
| `delete_block`  | Permanently delete a memory block                      |

---

## Style rule categories

When creating a style rule, assign it one of these categories:

| Category        | What it covers                                            |
| --------------- | --------------------------------------------------------- |
| `naming`        | Variable, function, class, and file naming conventions    |
| `formatting`    | Indentation, line length, spacing, quote style            |
| `architecture`  | Folder structure, module boundaries, design patterns      |
| `testing`       | Test structure, naming conventions, coverage requirements |
| `documentation` | Inline comments, JSDoc, README expectations               |
| `git`           | Commit message format, branch naming, PR conventions      |
| `general`       | Anything that does not fit the above                      |

---

## File structure

```
src/
  index.ts                  - MCP server entry point, registers all tools
  types.ts                  - TypeScript interfaces for MemoryBlock and StyleRule
  store/
    json-store.ts           - Local JSON file store for personal memory
    supabase-store.ts       - Supabase store for team style rules
  tools/
    list-blocks.ts          - list_blocks tool
    read-memory.ts          - read_memory tool
    create-block.ts         - create_block tool
    write-memory.ts         - write_memory tool
    append-memory.ts        - append_memory tool
    search-memory.ts        - search_memory tool
    delete-block.ts         - delete_block tool
    list-style-rules.ts     - list_style_rules tool
    get-style-rule.ts       - get_style_rule tool
    create-style-rule.ts    - create_style_rule tool
    update-style-rule.ts    - update_style_rule tool
    append-style-rule.ts    - append_style_rule tool
    delete-style-rule.ts    - delete_style_rule tool
    search-style-rules.ts   - search_style_rules tool

memory/                     - Local JSON files for personal memory (gitignored)
supabase-setup.sql          - SQL to run once in Supabase to create the table
.env.example                - Template for environment variables
```

---

## Notes

- The `memory/` directory is gitignored by default. Each developer's personal memory stays on their machine.
- The `.env` file is also gitignored. Never commit it.
- Supabase's free tier is sufficient for a team of this size.
- Style rules are fetched fresh from the database on every tool call, so updates by reviewers are immediately visible to all agents without any restart required.
