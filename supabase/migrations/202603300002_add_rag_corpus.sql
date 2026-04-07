-- Add Vertex AI RAG corpus support to knowledge_bases and agents

-- Add corpus_id to knowledge_bases table
ALTER TABLE knowledge_bases 
ADD COLUMN IF NOT EXISTS vertex_corpus_id text,
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'file' 
  CHECK (source_type IN ('file', 'website', 'google_drive', 'slack', 'jira', 'sharepoint')),
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS source_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add corpus_id to agents table for quick lookup
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS vertex_corpus_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_corpus ON knowledge_bases(vertex_corpus_id);
CREATE INDEX IF NOT EXISTS idx_agents_corpus ON agents(vertex_corpus_id);

-- Add comment
COMMENT ON COLUMN knowledge_bases.vertex_corpus_id IS 'Vertex AI RAG Engine corpus ID for this knowledge base';
COMMENT ON COLUMN knowledge_bases.source_type IS 'Type of knowledge source: file, website, google_drive, slack, jira, sharepoint';
COMMENT ON COLUMN knowledge_bases.source_url IS 'URL for website crawling or connection identifier';
COMMENT ON COLUMN agents.vertex_corpus_id IS 'Vertex AI RAG corpus ID linked to this agent';
