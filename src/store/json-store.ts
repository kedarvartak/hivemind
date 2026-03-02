import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import Fuse from "fuse.js";
import type { MemoryBlock, MemoryStore } from "../types.js";

/**
 * Stores each memory block as an individual JSON file inside `storeDir`.
 * An index file (index.json) keeps lightweight metadata for fast listing
 * and fuzzy search without loading every block into memory.
 */
export class JsonStore implements MemoryStore {
  private readonly storeDir: string;
  private readonly indexPath: string;

  constructor(storeDir: string) {
    this.storeDir = storeDir;
    this.indexPath = path.join(storeDir, "index.json");
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    await fs.mkdir(this.storeDir, { recursive: true });
    try {
      await fs.access(this.indexPath);
    } catch {
      await this.writeIndex([]);
    }
  }

  // ---------------------------------------------------------------------------
  // Index helpers
  // ---------------------------------------------------------------------------

  private async readIndex(): Promise<MemoryBlock[]> {
    try {
      const raw = await fs.readFile(this.indexPath, "utf-8");
      return JSON.parse(raw) as MemoryBlock[];
    } catch {
      return [];
    }
  }

  private async writeIndex(blocks: MemoryBlock[]): Promise<void> {
    await fs.writeFile(
      this.indexPath,
      JSON.stringify(blocks, null, 2),
      "utf-8",
    );
  }

  // ---------------------------------------------------------------------------
  // Block file helpers
  // ---------------------------------------------------------------------------

  private blockPath(id: string): string {
    return path.join(this.storeDir, `${id}.json`);
  }

  private async readBlock(id: string): Promise<MemoryBlock | null> {
    try {
      const raw = await fs.readFile(this.blockPath(id), "utf-8");
      return JSON.parse(raw) as MemoryBlock;
    } catch {
      return null;
    }
  }

  private async persistBlock(block: MemoryBlock): Promise<void> {
    await fs.writeFile(
      this.blockPath(block.id),
      JSON.stringify(block, null, 2),
      "utf-8",
    );
  }

  // ---------------------------------------------------------------------------
  // MemoryStore interface
  // ---------------------------------------------------------------------------

  async listBlocks(): Promise<MemoryBlock[]> {
    return this.readIndex();
  }

  async getBlock(id: string): Promise<MemoryBlock | null> {
    return this.readBlock(id);
  }

  async createBlock(
    topic: string,
    content = "",
    tags: string[] = [],
  ): Promise<MemoryBlock> {
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

    await this.persistBlock(block);

    const index = await this.readIndex();
    index.push(block);
    await this.writeIndex(index);

    console.error(`[memoree] Created block "${topic}" (${block.id})`);
    return block;
  }

  /**
   * Overwrite content (and optionally topic/tags) of an existing block.
   * Topic update is optional — pass undefined to keep existing topic.
   */
  async updateBlock(
    id: string,
    content: string,
    tags?: string[],
    topic?: string,
  ): Promise<MemoryBlock> {
    const existing = await this.readBlock(id);
    if (!existing) throw new Error(`Block not found: ${id}`);

    const updated: MemoryBlock = {
      ...existing,
      topic: topic ?? existing.topic,
      content,
      tags: tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    await this.persistBlock(updated);

    const index = await this.readIndex();
    const idx = index.findIndex((b) => b.id === id);
    if (idx !== -1) index[idx] = updated;
    await this.writeIndex(index);

    console.error(
      `[memoree] Updated block "${updated.topic}" (${id}) → v${updated.version}`,
    );
    return updated;
  }

  /**
   * Append text to the end of an existing block's content, separated by a
   * newline. Useful for accumulating notes across conversations without losing
   * prior content.
   */
  async appendBlock(
    id: string,
    text: string,
    tags?: string[],
  ): Promise<MemoryBlock> {
    const existing = await this.readBlock(id);
    if (!existing) throw new Error(`Block not found: ${id}`);

    const separator = existing.content.trim() ? "\n\n" : "";
    const newContent = existing.content + separator + text.trim();

    return this.updateBlock(id, newContent, tags ?? existing.tags);
  }

  async deleteBlock(id: string): Promise<void> {
    try {
      await fs.unlink(this.blockPath(id));
    } catch {
      // Already gone — that's fine
    }

    const index = await this.readIndex();
    await this.writeIndex(index.filter((b) => b.id !== id));
    console.error(`[memoree] Deleted block ${id}`);
  }

  async searchBlocks(query: string): Promise<MemoryBlock[]> {
    const blocks = await this.readIndex();
    if (!query.trim()) return blocks;

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
