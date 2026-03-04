/**
 * Talks to Turso via the libSQL HTTP pipeline API using Node's built-in fetch.
 * No native .node bindings — safe to run inside the VS Code extension host.
 */

export interface CloudGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface CloudRule {
  id: string;
  groupId: string;
  title: string;
  content: string;
  createdAt: string;
}

type SqlValue =
  | { type: "text"; value: string }
  | { type: "integer"; value: string }
  | { type: "null" };

function toSqlValue(v: string | number | null): SqlValue {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}

interface PipelineResult {
  results: Array<{
    type: "ok" | "error";
    response?: {
      result?: {
        cols: Array<{ name: string }>;
        rows: Array<Array<string | number | null>>;
      };
    };
    error?: { message: string };
  }>;
}

export class TursoExtensionStore {
  private readonly endpoint: string;
  private readonly authToken: string;

  constructor(url: string, authToken: string) {
    // Turso URLs: libsql://foo.turso.io  →  https://foo.turso.io
    this.endpoint = url.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";
    this.authToken = authToken;
  }

  /** Run a single SQL statement, return { cols, rows }. */
  private async run(
    sql: string,
    args: Array<string | number | null> = [],
  ): Promise<{ cols: string[]; rows: Array<Array<string | number | null>> }> {
    const body = JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: { sql, args: args.map(toSqlValue) },
        },
        { type: "close" },
      ],
    });

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Turso HTTP ${res.status}: ${text}`);
    }

    const data = (await res.json()) as PipelineResult;
    const first = data.results[0];

    if (first.type === "error") {
      throw new Error(`Turso: ${first.error?.message ?? "unknown error"}`);
    }

    const cols = first.response?.result?.cols.map((c) => c.name) ?? [];
    const rows = first.response?.result?.rows ?? [];
    return { cols, rows };
  }

  private rowToObj(
    cols: string[],
    row: Array<string | number | null>,
  ): Record<string, string | number | null> {
    const obj: Record<string, string | number | null> = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  }

  // ---------------------------------------------------------------------------
  // Schema setup
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Groups table
    await this.run(`
      CREATE TABLE IF NOT EXISTS rule_groups (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Ensure style_rules table exists (MCP server may have already created it)
    await this.run(`
      CREATE TABLE IF NOT EXISTS style_rules (
        id          TEXT PRIMARY KEY,
        topic       TEXT NOT NULL,
        content     TEXT NOT NULL DEFAULT '',
        category    TEXT NOT NULL DEFAULT 'general',
        tags        TEXT NOT NULL DEFAULT '[]',
        created_by  TEXT NOT NULL DEFAULT 'extension',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        version     INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Add group_id column (idempotent via try/catch — SQLite has no ADD COLUMN IF NOT EXISTS)
    try {
      await this.run(`ALTER TABLE style_rules ADD COLUMN group_id TEXT`);
    } catch {
      // Column already exists — ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  async listGroups(): Promise<CloudGroup[]> {
    const { cols, rows } = await this.run(
      `SELECT id, name, created_at FROM rule_groups ORDER BY created_at ASC`,
    );
    return rows.map((r) => {
      const o = this.rowToObj(cols, r);
      return {
        id: String(o.id),
        name: String(o.name),
        createdAt: String(o.created_at),
      };
    });
  }

  async createGroup(name: string): Promise<CloudGroup> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.run(
      `INSERT INTO rule_groups (id, name, created_at) VALUES (?, ?, ?)`,
      [id, name, now],
    );
    return { id, name, createdAt: now };
  }

  async deleteGroup(id: string): Promise<void> {
    await this.run(`DELETE FROM rule_groups WHERE id = ?`, [id]);
    // Also remove rules belonging to this group
    await this.run(`DELETE FROM style_rules WHERE group_id = ?`, [id]);
  }

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  async listRules(): Promise<CloudRule[]> {
    const { cols, rows } = await this.run(
      `SELECT id, group_id, topic, content, created_at FROM style_rules WHERE group_id IS NOT NULL ORDER BY created_at ASC`,
    );
    return rows.map((r) => {
      const o = this.rowToObj(cols, r);
      return {
        id: String(o.id),
        groupId: String(o.group_id),
        title: String(o.topic),
        content: String(o.content),
        createdAt: String(o.created_at),
      };
    });
  }

  async createRule(
    groupId: string,
    title: string,
    content: string,
  ): Promise<CloudRule> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.run(
      `INSERT INTO style_rules (id, topic, content, category, tags, created_by, created_at, updated_at, version, group_id)
       VALUES (?, ?, ?, 'general', '[]', 'extension', ?, ?, 1, ?)`,
      [id, title, content, now, now, groupId],
    );
    return { id, groupId, title, content, createdAt: now };
  }

  async updateRule(
    id: string,
    title: string,
    content: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE style_rules SET topic = ?, content = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
      [title, content, now, id],
    );
  }

  async deleteRule(id: string): Promise<void> {
    await this.run(`DELETE FROM style_rules WHERE id = ?`, [id]);
  }
}
