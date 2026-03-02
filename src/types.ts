export interface MemoryBlock {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  version: number;
  metadata: Record<string, unknown>;
}

export interface MemoryStore {
  /** Return all blocks */
  listBlocks(): Promise<MemoryBlock[]>;

  /** Fetch a single block by id — reads the full per-block JSON file */
  getBlock(id: string): Promise<MemoryBlock | null>;

  /** Create a new block with the given topic */
  createBlock(topic: string, content?: string, tags?: string[]): Promise<MemoryBlock>;

  /**
   * Overwrite content (and optionally topic/tags) of an existing block.
   * Pass undefined for topic to keep the existing topic unchanged.
   */
  updateBlock(id: string, content: string, tags?: string[], topic?: string): Promise<MemoryBlock>;

  /** Append text to an existing block — preserves existing content */
  appendBlock(id: string, text: string, tags?: string[]): Promise<MemoryBlock>;

  /** Remove a block entirely */
  deleteBlock(id: string): Promise<void>;

  /** Fuzzy-search blocks by topic, tags or content. Returns ranked results. */
  searchBlocks(query: string): Promise<MemoryBlock[]>;
}
