import { createClient, type Client } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
import Fuse from "fuse.js";
import type { StyleRule, StyleStore, StyleCategory } from "../types.js";

// ---------------------------------------------------------------------------
// DB row shape — matches the SQLite table columns exactly.
// Tags are stored as a JSON string because SQLite has no array type.
// ---------------------------------------------------------------------------
interface StyleRuleRow {
  id: string;
  topic: string;
  content: string;
  category: string;
  tags: string;        // JSON-encoded string[]
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

function rowToRule(row: StyleRuleRow): StyleRule {
  return {
    id: row.id,
    topic: row.topic,
    content: row.content,
    category: row.category as StyleCategory,
    tags: JSON.parse(row.tags ?? "[]") as string[],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: Number(row.version),
  };
}

// ---------------------------------------------------------------------------
// TursoStyleStore
// ---------------------------------------------------------------------------

export class TursoStyleStore implements StyleStore {
  private readonly client: Client;

  constructor(url: string, authToken: string) {
    this.client = createClient({ url, authToken });
  }

  /**
   * Creates the style_rules table and indexes if they do not already exist.
   * Safe to call on every startup — uses IF NOT EXISTS throughout.
   */
  async init(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS style_rules (
        id          TEXT    PRIMARY KEY,
        topic       TEXT    NOT NULL,
        content     TEXT    NOT NULL DEFAULT '',
        category    TEXT    NOT NULL DEFAULT 'general'
                    CHECK (category IN (
                      'naming','formatting','architecture',
                      'testing','documentation','git','general'
                    )),
        tags        TEXT    NOT NULL DEFAULT '[]',
        created_by  TEXT    NOT NULL,
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL,
        version     INTEGER NOT NULL DEFAULT 1
      )
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS style_rules_category_idx
        ON style_rules (category)
    `);

    await this.client.execute(`
      CREATE INDEX IF NOT EXISTS style_rules_updated_idx
        ON style_rules (updated_at DESC)
    `);

    console.error("[hivemind] Turso style store initialised.");
  }

  // ── Read operations (available to all roles) ──────────────────────────────

  async listRules(category?: StyleCategory): Promise<StyleRule[]> {
    const sql = category
      ? "SELECT * FROM style_rules WHERE category = ? ORDER BY updated_at DESC"
      : "SELECT * FROM style_rules ORDER BY updated_at DESC";

    const args = category ? [category] : [];
    const result = await this.client.execute({ sql, args });
    return (result.rows as unknown as StyleRuleRow[]).map(rowToRule);
  }

  async getRule(id: string): Promise<StyleRule | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM style_rules WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return rowToRule(result.rows[0] as unknown as StyleRuleRow);
  }

  async searchRules(query: string): Promise<StyleRule[]> {
    const all = await this.listRules();
    if (!query.trim()) return all;

    const fuse = new Fuse(all, {
      keys: [
        { name: "topic", weight: 0.5 },
        { name: "category", weight: 0.2 },
        { name: "tags", weight: 0.2 },
        { name: "content", weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
    return fuse.search(query).map((r) => r.item);
  }

  // ── Write operations (reviewer only -- enforced in MCP tools layer) ───────

  async createRule(
    topic: string,
    content: string,
    category: StyleCategory,
    tags: string[],
    createdBy: string,
  ): Promise<StyleRule> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await this.client.execute({
      sql: `
        INSERT INTO style_rules
          (id, topic, content, category, tags, created_by, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      args: [id, topic, content, category, JSON.stringify(tags), createdBy, now, now],
    });

    console.error(`[hivemind] Created rule "${topic}" (${id}) by ${createdBy}`);

    return {
      id,
      topic,
      content,
      category,
      tags,
      createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  async updateRule(
    id: string,
    content: string,
    topic?: string,
    tags?: string[],
    category?: StyleCategory,
  ): Promise<StyleRule> {
    const existing = await this.getRule(id);
    if (!existing) throw new Error(`Style rule not found: ${id}`);

    const now = new Date().toISOString();
    const newTopic = topic ?? existing.topic;
    const newTags = tags ?? existing.tags;
    const newCategory = category ?? existing.category;
    const newVersion = existing.version + 1;

    await this.client.execute({
      sql: `
        UPDATE style_rules
        SET topic = ?, content = ?, category = ?, tags = ?, updated_at = ?, version = ?
        WHERE id = ?
      `,
      args: [newTopic, content, newCategory, JSON.stringify(newTags), now, newVersion, id],
    });

    console.error(`[hivemind] Updated rule "${newTopic}" (${id}) -> v${newVersion}`);

    return {
      ...existing,
      topic: newTopic,
      content,
      category: newCategory,
      tags: newTags,
      updatedAt: now,
      version: newVersion,
    };
  }

  async appendRule(id: string, text: string): Promise<StyleRule> {
    const existing = await this.getRule(id);
    if (!existing) throw new Error(`Style rule not found: ${id}`);

    const separator = existing.content.trim() ? "\n\n" : "";
    const newContent = existing.content + separator + text.trim();
    return this.updateRule(id, newContent);
  }

  async deleteRule(id: string): Promise<void> {
    await this.client.execute({
      sql: "DELETE FROM style_rules WHERE id = ?",
      args: [id],
    });
    console.error(`[hivemind] Deleted rule ${id}`);
  }
}
