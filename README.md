# Noosphere 🌐

> *Your research sessions, transformed into a queryable knowledge network.*

**Live:** [nooshpere-w4gu.vercel.app](https://nooshpere-w4gu.vercel.app/)

Noosphere turns your [Perplexity](https://perplexity.ai) research conversations into a structured, semantically searchable knowledge graph. Paste a prompt at the end of any session, ingest the structured JSON output, and then query across everything you've ever researched — with synthesised answers grounded only in your own knowledge, not the open internet. Built in 48 hours at the **AIGIxZo Build Sprint #1** at Zo House Bangalore.

---

## What It Does

- **Extracts structured knowledge from Perplexity sessions** using a carefully designed prompt that forces Perplexity to output a domain-mapped JSON artifact with core facts, key insights, unresolved tensions, and cross-domain connections.
- **Embeds and indexes** every domain node and high-confidence fact using [Voyage AI](https://www.voyageai.com/) (`voyage-3-lite`, 512-dimensional vectors) stored in Supabase with pgvector.
- **Lets you query the collective** — ask any question in natural language and get a synthesised answer backed by semantic search across all your sessions, with source attribution and cross-domain connections surfaced.
- **Cleans messy output** — LLM responses often come with citation markers, superscripts, and encoding noise. A `/api/clean` step strips this before ingest.

---

## Architecture

```
Perplexity (research session)
    │  Paste extraction prompt at end of session
    ▼
Noosphere Web App (Next.js 16)
    │
    ├── /api/clean   → Claude Sonnet 4.6 (strips citation noise, validates JSON)
    ├── /api/ingest  → Voyage AI embed (domain nodes + facts in batch)
    │                  Supabase: artifacts, domain_nodes, facts, connections
    └── /api/query   → Voyage AI embed (query)
                       Supabase RPC: search_domains + search_facts (pgvector cosine)
                       Claude Sonnet 4.6 (synthesis, grounded to retrieved context)
```

**Ingest flow:**
1. User pastes the extraction prompt into their Perplexity session.
2. Perplexity outputs a structured JSON artifact (`domain_map`, `high_confidence_facts`, `cross_domain_connections`, etc.).
3. User pastes the raw JSON into Noosphere → clicks **Clean document** (Claude normalises it).
4. User clicks **Add to Network** → domains and facts are embedded in batch by Voyage AI and stored in Supabase with their vector embeddings.

**Query flow:**
1. User types a question on the Query page.
2. Query is embedded by Voyage AI.
3. Supabase runs `search_domains` and `search_facts` RPC functions (IVFFlat cosine index) in parallel, returning the top 5 domain nodes and top 8 facts.
4. Relevant cross-domain connections for the matched domains are fetched.
5. Everything is bundled into a structured prompt for Claude Sonnet 4.6, which synthesises a grounded answer.
6. The UI shows: an answer, matched domain cards with similarity scores, and cross-domain connection threads.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Embeddings | Voyage AI `voyage-3-lite` (512-dim) |
| LLM | Anthropic Claude Sonnet 4.6 |
| Database | Supabase (PostgreSQL + pgvector) |
| Deployment | Vercel (Next.js native) |

---

## Project Structure

```
noosphere/
├── app/
│   ├── page.tsx              # Ingest page — extraction prompt + JSON paste + session list
│   ├── query/
│   │   └── page.tsx          # Query page — search input, bubble background, results
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── clean/route.ts    # POST: Claude strips citation noise, validates JSON
│       ├── ingest/route.ts   # POST: Voyage embed + Supabase store
│       ├── query/route.ts    # GET:  Voyage embed + pgvector search + Claude synthesis
│       ├── artifacts/route.ts # GET/DELETE: list and remove artifacts
│       ├── domains/route.ts   # GET: list all domain nodes (for bubble visualisation)
│       └── stats/route.ts     # GET: session count
├── lib/
│   ├── embed.ts              # Voyage AI embedding helper (batch + single)
│   └── supabase.ts           # Supabase client (service role)
├── schema.sql                # DB schema + pgvector indexes + search RPCs
├── package.json
└── .env.local.example
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (with the `vector` extension enabled)
- A [Voyage AI](https://www.voyageai.com/) API key
- An [Anthropic](https://console.anthropic.com) API key

### 1. Set Up the Database

Run `schema.sql` in your Supabase SQL editor. This creates `artifacts`, `domain_nodes`, `facts`, and `connections` tables, IVFFlat vector indexes, and the `search_domains` / `search_facts` search functions.

> **Note:** The `vector` extension must be enabled in Supabase before running the schema. It is available on all Supabase hosted projects.

### 2. Configure Environment Variables

Create a `.env.local` file at the project root and set the following:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `VOYAGE_API_KEY` | Voyage AI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

```bash
npx vercel
```

Set the four environment variables in the Vercel dashboard. Vercel handles Next.js natively — no additional configuration needed.

---

## Using the Extraction Prompt

The prompt is available on the Ingest page with a one-click **copy** button. To use it:

1. At the end of any Perplexity research session, type:  
   *(paste the extraction prompt)*
2. Perplexity will output a JSON artifact with the structure:
   ```json
   {
     "domain_map": { "<topic>": { "core_facts": [...], "key_insights": [...], ... } },
     "cross_domain_connections": [...],
     "high_confidence_facts": [...],
     "source_domains": [...],
     "knowledge_gaps": [...],
     "confidence": "high|medium|low"
   }
   ```
3. Paste the raw output into Noosphere → **Clean document** → **Add to Network**.

The clean step handles Perplexity's citation superscripts (`[1]`, `[2]`, etc.) and any encoding artefacts automatically.

---

## Database Schema

```
artifacts        — full raw JSON blob, confidence, source_domains, timestamp
domain_nodes     — one row per topic in domain_map, 512-dim embedding
facts            — one row per high_confidence_fact, 512-dim embedding
connections      — cross-domain relationships (from, to, relationship text)
```

Vector search uses **cosine similarity** via IVFFlat indexes (`lists=10`). The `search_domains` and `search_facts` Postgres functions allow Supabase RPC calls from the Next.js API layer with a single round-trip.

---

## Design Decisions

**Why Voyage AI instead of OpenAI embeddings?**  
`voyage-3-lite` produces dense 512-dimensional embeddings suited for technical/research content at lower cost than OpenAI Ada-002, and Voyage's retrieval quality on domain-specific technical documents is competitive.

**Why structured extraction instead of raw session dumps?**  
Perplexity sessions are verbose and repetitive. The extraction prompt forces the model to distill only the durable knowledge — precise facts, non-obvious insights, unresolved tensions — while discarding conversational scaffolding. This makes the vector index dense and high-signal rather than noisy.

**Why a two-step clean → ingest flow?**  
Perplexity embeds citation markers (`[1][2]`) and sometimes produces malformed JSON at context limits. The clean step uses Claude to strip noise and validate structure before ingest, preventing garbage from polluting the index.

**Why Claude Sonnet 4.6 for synthesis?**  
The query prompt explicitly instructs Claude to answer only from retrieved context, cite domains, present conflicting positions, and avoid hallucination. Sonnet's instruction-following is reliable enough that the grounding constraint holds in practice. Haiku would be faster, but Sonnet produces more careful synthesis when multiple domain matches conflict.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/clean` | POST `{ raw: string }` | Strips citation noise, returns valid pretty-printed JSON |
| `/api/ingest` | POST `{ ...artifact }` | Embeds + stores artifact; returns counts of indexed items |
| `/api/query` | GET `?q=<query>` | Semantic search + Claude synthesis; returns answer + metadata |
| `/api/artifacts` | GET | List all artifact stubs (id, created_at, confidence, source_domains) |
| `/api/artifacts` | DELETE `{ id }` | Remove an artifact and all its nodes/facts (cascade delete) |
| `/api/domains` | GET | List all domain nodes (for bubble visualisation on query page) |
| `/api/stats` | GET | Returns `{ session_count }` |

---

## Pages

### `/` — Ingest
- Left panel: the extraction prompt (copy to clipboard with one click).
- Right panel top: paste JSON, clean it, then add to network. Shows indexed counts on success.
- Right panel bottom: list of sessions currently in the network, with confidence and source domains. Sessions can be removed individually.

### `/query` — Query the Network
- Animated canvas background shows domain nodes as floating bubbles (connected within the same session).
- Full-text search input → semantic search → synthesised answer.
- Results show: matched domain cards (with similarity % bars), a synthesised answer card, and cross-domain connection threads.

---

## Built At

**AIGIxZo Build Sprint #1** — Zo House Bangalore, March 7–8, 2026  
Powered by Zo World & AI Grants India
