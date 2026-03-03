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

export interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface StyleRule {
  id: string;
  title: string;
  content: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}
