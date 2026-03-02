-- Run this once inside your Supabase project → SQL Editor
-- Creates the style_rules table used by the Memoree MCP server.

CREATE TABLE IF NOT EXISTS style_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general'
                CHECK (category IN ('naming','formatting','architecture','testing','documentation','git','general')),
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_by  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version     INTEGER     NOT NULL DEFAULT 1
);

-- Index for fast category filtering
CREATE INDEX IF NOT EXISTS style_rules_category_idx ON style_rules (category);

-- Index for full-text search (optional — used if you switch from client-side fuzzy to server-side FTS)
CREATE INDEX IF NOT EXISTS style_rules_fts_idx
  ON style_rules USING GIN (to_tsvector('english', topic || ' ' || content));

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS style_rules_updated_at ON style_rules;
CREATE TRIGGER style_rules_updated_at
  BEFORE UPDATE ON style_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security (RLS)
-- Everyone with the anon key can READ.
-- Only service_role key (reviewer machines) can write.
-- If you prefer no RLS and want role enforced only in the MCP layer, skip this block.
ALTER TABLE style_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_for_all"
  ON style_rules FOR SELECT
  USING (true);

-- Writes are gated in the MCP tool layer by MEMOREE_ROLE env var.
-- To also gate at DB level, replace the anon key on reviewer machines with
-- the service_role key (never commit it to git).
CREATE POLICY "allow_write_for_all_authenticated"
  ON style_rules FOR ALL
  USING (true)
  WITH CHECK (true);
