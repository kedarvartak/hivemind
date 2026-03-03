export interface MemoryBlock {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  metadata: Record<string, unknown>;
}

export interface MemoryStore {
  listBlocks(): Promise<MemoryBlock[]>;
  getBlock(id: string): Promise<MemoryBlock | null>;
  createBlock(topic: string, content?: string, tags?: string[]): Promise<MemoryBlock>;
  updateBlock(id: string, content: string, tags?: string[], topic?: string): Promise<MemoryBlock>;
  appendBlock(id: string, text: string, tags?: string[]): Promise<MemoryBlock>;
  deleteBlock(id: string): Promise<void>;
  searchBlocks(query: string): Promise<MemoryBlock[]>;
}

export interface StyleRule {
  id: string;
  topic: string;
  content: string;
  category: StyleCategory;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type StyleCategory =
  | "naming"
  | "formatting"
  | "architecture"
  | "testing"
  | "documentation"
  | "git"
  | "general";

export const STYLE_CATEGORIES: StyleCategory[] = [
  "naming",
  "formatting",
  "architecture",
  "testing",
  "documentation",
  "git",
  "general",
];

export interface StyleStore {
  listRules(category?: StyleCategory): Promise<StyleRule[]>;
  getRule(id: string): Promise<StyleRule | null>;
  createRule(topic: string, content: string, category: StyleCategory, tags: string[], createdBy: string): Promise<StyleRule>;
  updateRule(id: string, content: string, topic?: string, tags?: string[], category?: StyleCategory): Promise<StyleRule>;
  appendRule(id: string, text: string): Promise<StyleRule>;
  deleteRule(id: string): Promise<void>;
  searchRules(query: string): Promise<StyleRule[]>;
}
