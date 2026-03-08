-- Run this in your Supabase SQL editor

create extension if not exists vector;

-- Full artifact blobs
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  raw jsonb not null,
  source text default 'perplexity',
  confidence text,
  source_domains text[],
  contributor_id text,
  created_at timestamptz default now()
);

-- One row per domain in domain_map — the embeddable unit
create table domain_nodes (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references artifacts(id) on delete cascade,
  domain_name text not null,
  content jsonb not null,
  embedding vector(512),
  created_at timestamptz default now()
);

-- High-confidence facts — fine-grained search surface
create table facts (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references artifacts(id) on delete cascade,
  domain_name text,
  fact text not null,
  embedding vector(512),
  created_at timestamptz default now()
);

-- Cross-domain connections
create table connections (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid references artifacts(id) on delete cascade,
  from_domain text not null,
  to_domain text not null,
  relationship text not null,
  created_at timestamptz default now()
);

-- Vector search indexes
create index on domain_nodes using ivfflat (embedding vector_cosine_ops) with (lists = 10);
create index on facts using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Semantic search function for domain nodes
create or replace function search_domains(query_embedding vector(512), match_count int default 5)
returns table (
  id uuid,
  artifact_id uuid,
  domain_name text,
  content jsonb,
  similarity float
)
language sql stable
as $$
  select
    domain_nodes.id,
    domain_nodes.artifact_id,
    domain_nodes.domain_name,
    domain_nodes.content,
    1 - (domain_nodes.embedding <=> query_embedding) as similarity
  from domain_nodes
  where domain_nodes.embedding is not null
  order by domain_nodes.embedding <=> query_embedding
  limit match_count;
$$;

-- Semantic search function for facts
create or replace function search_facts(query_embedding vector(512), match_count int default 8)
returns table (
  id uuid,
  artifact_id uuid,
  domain_name text,
  fact text,
  similarity float
)
language sql stable
as $$
  select
    facts.id,
    facts.artifact_id,
    facts.domain_name,
    facts.fact,
    1 - (facts.embedding <=> query_embedding) as similarity
  from facts
  where facts.embedding is not null
  order by facts.embedding <=> query_embedding
  limit match_count;
$$;
