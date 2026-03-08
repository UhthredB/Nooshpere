import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { embedBatch } from '@/lib/embed'

async function storeArtifact(artifact: any) {
  const { data: storedArtifact, error: artifactError } = await supabase
    .from('artifacts')
    .insert({ raw: artifact, confidence: artifact.confidence, source_domains: artifact.source_domains })
    .select('id')
    .single()

  if (artifactError) throw artifactError
  const artifactId = storedArtifact.id

  const domains = Object.entries(artifact.domain_map) as [string, any][]
  const highFacts: string[] = artifact.high_confidence_facts || []

  const domainTexts = domains.map(([name, data]) =>
    `${name}: ${(data.core_facts || []).join(' ')} ${(data.key_insights || []).join(' ')}`.slice(0, 8000)
  )

  const allTexts = [...domainTexts, ...highFacts]
  const allEmbeddings = await embedBatch(allTexts)
  const domainEmbeddings = allEmbeddings.slice(0, domains.length)
  const factEmbeddings = allEmbeddings.slice(domains.length)

  await supabase.from('domain_nodes').insert(
    domains.map(([name, data], i) => ({
      artifact_id: artifactId,
      domain_name: name,
      content: data,
      embedding: JSON.stringify(domainEmbeddings[i]),
    }))
  )

  if (highFacts.length > 0) {
    await supabase.from('facts').insert(
      highFacts.map((fact, i) => ({
        artifact_id: artifactId,
        fact,
        embedding: JSON.stringify(factEmbeddings[i]),
      }))
    )
  }

  if (artifact.cross_domain_connections?.length > 0) {
    await supabase.from('connections').insert(
      artifact.cross_domain_connections.map((c: any) => ({
        artifact_id: artifactId,
        from_domain: c.from,
        to_domain: c.to,
        relationship: c.relationship,
      }))
    )
  }

  return {
    artifact_id: artifactId,
    domains_indexed: domains.length,
    facts_indexed: highFacts.length,
    connections_indexed: artifact.cross_domain_connections?.length || 0,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const artifact = body.artifact ?? body

    if (!artifact.domain_map) {
      return NextResponse.json({ error: 'Invalid artifact: missing domain_map' }, { status: 400 })
    }

    const result = await storeArtifact(artifact)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('Ingest error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
