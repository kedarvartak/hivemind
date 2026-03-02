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
