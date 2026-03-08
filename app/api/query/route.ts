import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { embed } from '@/lib/embed'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 })

  try {
    const queryEmbedding = await embed(q)

    // Search domain nodes and facts in parallel
    const [domainRes, factRes] = await Promise.all([
      supabase.rpc('search_domains', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: 5,
      }),
      supabase.rpc('search_facts', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: 8,
      }),
    ])

    if (domainRes.error) throw domainRes.error
    if (factRes.error) throw factRes.error

    const matchedDomains = domainRes.data || []
    const matchedFacts = factRes.data || []

    if (matchedDomains.length === 0 && matchedFacts.length === 0) {
      return NextResponse.json({
        answer: 'No knowledge found in the network for this query yet.',
        sources: [],
        facts: [],
      })
    }

    // Fetch connections relevant to matched domains
    const domainNames = [...new Set(matchedDomains.map((d: any) => d.domain_name))]
    const { data: connections } = await supabase
      .from('connections')
      .select('from_domain, to_domain, relationship')
      .or(
        domainNames.map((n) => `from_domain.eq.${n}`).join(',') +
        ',' +
        domainNames.map((n) => `to_domain.eq.${n}`).join(',')
      )
      .limit(10)

    // Count unique artifact contributors
    const artifactIds = new Set([
      ...matchedDomains.map((d: any) => d.artifact_id),
      ...matchedFacts.map((f: any) => f.artifact_id),
    ])

    // Build context for Claude
    const domainContext = matchedDomains
      .map((d: any) => {
        const c = d.content
        return `[Domain: ${d.domain_name} | relevance: ${(d.similarity * 100).toFixed(0)}%]
Core facts: ${(c.core_facts || []).join(' | ')}
Key insights: ${(c.key_insights || []).join(' | ')}
Open questions: ${(c.open_questions || []).join(' | ')}`
      })
      .join('\n\n')

    const factContext = matchedFacts
      .map((f: any) => `• ${f.fact}`)
      .join('\n')

    const connectionContext = (connections || [])
      .map((c: any) => `${c.from_domain} → ${c.to_domain}: ${c.relationship}`)
      .join('\n')

    const prompt = `You are synthesizing knowledge from a distributed network of AI research sessions.

MATCHED DOMAIN KNOWLEDGE:
${domainContext}

HIGH-CONFIDENCE FACTS:
${factContext}

CROSS-DOMAIN CONNECTIONS:
${connectionContext}

USER QUERY: ${q}

Instructions:
- Answer using only what is in the knowledge above
- Cite which domain(s) support each claim
- If domains conflict, present both positions explicitly
- Surface any open questions in the knowledge that directly relate to the query
- Do not hallucinate beyond the retrieved knowledge
- Be precise and technically specific — do not dumb down the answer
- Replace any private personal information (private email addresses, phone numbers, personal addresses, private financial details of individuals) with [REDACTED]. Public figures, company names, product names, and publicly known facts about public figures should NOT be redacted.
- End with: "Synthesized from ${artifactIds.size} session${artifactIds.size !== 1 ? 's' : ''} across the network."`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const answer = (message.content[0] as { text: string }).text

    return NextResponse.json({
      answer,
      matched_domains: matchedDomains.map((d: any) => ({
        name: d.domain_name,
        similarity: d.similarity,
      })),
      facts_count: matchedFacts.length,
      connections: connections || [],
      session_count: artifactIds.size,
    })
  } catch (err: any) {
    console.error('Query error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
