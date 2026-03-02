import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Fuse from "fuse.js";
import type { MemoryBlock } from "./types";

/**
 * Reads/writes memory blocks as individual JSON files in `storeDir`.
 * Shared by both the MCP server and the VS Code extension — they read the same
 * directory so any agent-written updates appear immediately in the UI.
 *
 * Uses synchronous fs calls so the extension API (which expects sync return
 * values in places like getChildren) stays simple.
 */
export class JsonStore {
  private readonly storeDir: string;
  private readonly indexPath: string;

  constructor(storeDir: string) {
    this.storeDir = storeDir;
    this.indexPath = path.join(storeDir, "index.json");
  }

  init(): void {
    try {
      fs.mkdirSync(this.storeDir, { recursive: true });
    } catch {
      // Directory already exists
    }
    if (!fs.existsSync(this.indexPath)) {
      fs.writeFileSync(this.indexPath, JSON.stringify([], null, 2), "utf-8");
    }
  }

  // ---------------------------------------------------------------------------
  // Index
  // ---------------------------------------------------------------------------

  private readIndex(): MemoryBlock[] {
    try {
      return JSON.parse(fs.readFileSync(this.indexPath, "utf-8")) as MemoryBlock[];
    } catch {
      return [];
    }
  }

  private writeIndex(blocks: MemoryBlock[]): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(blocks, null, 2), "utf-8");
  }

  // ---------------------------------------------------------------------------
  // Block files
  // ---------------------------------------------------------------------------

  private blockPath(id: string): string {
    return path.join(this.storeDir, `${id}.json`);
  }

  private readBlock(id: string): MemoryBlock | null {
    try {
      return JSON.parse(fs.readFileSync(this.blockPath(id), "utf-8")) as MemoryBlock;
    } catch {
      return null;
    }
  }

  private persistBlock(block: MemoryBlock): void {
    fs.writeFileSync(this.blockPath(block.id), JSON.stringify(block, null, 2), "utf-8");
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  listBlocks(): MemoryBlock[] {
    return this.readIndex();
  }

  getBlock(id: string): MemoryBlock | null {
    return this.readBlock(id);
  }

  createBlock(topic: string, content = "", tags: string[] = []): MemoryBlock {
    const now = new Date().toISOString();
    const block: MemoryBlock = {
      id: uuidv4(),
      topic,
      content,
      tags,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {},
    };
    this.persistBlock(block);

    const index = this.readIndex();
    index.push(block);
    this.writeIndex(index);

    return block;
  }

  /**
   * Update an existing block.
   * @param id    - block UUID
   * @param topic - new topic (required; pass existing topic to keep it unchanged)
   * @param content - new content body
   * @param tags  - new tags array
   */
  updateBlock(id: string, topic: string, content: string, tags: string[]): MemoryBlock {
    const existing = this.readBlock(id);
    if (!existing) {
      throw new Error(`Block not found: ${id}`);
    }
    const updated: MemoryBlock = {
      ...existing,
      topic,
      content,
      tags,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    this.persistBlock(updated);

    const index = this.readIndex();
    const idx = index.findIndex((b) => b.id === id);
    if (idx !== -1) {
      index[idx] = updated;
    }
    this.writeIndex(index);

    return updated;
  }

  deleteBlock(id: string): void {
    try {
      fs.unlinkSync(this.blockPath(id));
    } catch {
      // file already gone — that's fine
    }
    const index = this.readIndex();
    this.writeIndex(index.filter((b) => b.id !== id));
  }

  searchBlocks(query: string): MemoryBlock[] {
    const blocks = this.readIndex();
    if (!query.trim()) {
      return blocks;
    }
    const fuse = new Fuse(blocks, {
      keys: [
        { name: "topic", weight: 0.5 },
        { name: "tags", weight: 0.3 },
        { name: "content", weight: 0.2 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
    return fuse.search(query).map((r) => r.item);
  }
}
