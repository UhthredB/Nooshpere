'use client'

import { useState, useEffect } from 'react'

const PROMPT = `You have access to my complete Perplexity session history.

Extract a knowledge artifact that preserves the full technical depth and specificity of what was explored. Do not simplify for a general audience. Write as if producing a technical brief for a domain expert who will use this to make real decisions — not a summary for someone unfamiliar with the field.

Output valid JSON only:

{
  "domain_map": {
    "<topic>": {
      "core_facts": ["Precise, technically specific claims. Preserve exact figures, tool names, architectural decisions, version numbers, benchmarks."],
      "key_insights": ["Non-obvious conclusions that required multiple sessions or sources to form. Include the reasoning chain, not just the conclusion."],
      "unresolved_tensions": ["Specific competing claims or architectures with their exact tradeoffs. Name the systems in tension."],
      "evolved_understanding": ["State the initial assumption, the evidence that changed it, and the revised position."],
      "open_questions": ["Specific, answerable research questions precise enough to design an experiment or search query."]
    }
  },
  "cross_domain_connections": [
    { "from": "<domain>", "to": "<domain>", "relationship": "Mechanistic explanation of how these domains interact." }
  ],
  "high_confidence_facts": ["Claims that appeared consistently across multiple sessions with source backing."],
  "source_domains": ["arxiv.org"],
  "knowledge_gaps": ["Specific gaps where sessions repeatedly approached a question but could not resolve it."],
  "confidence": "high|medium|low"
}

Rules:
- Preserve technical vocabulary — do not substitute jargon with plain language
- Preserve specificity — exact numbers, names, versions, benchmarks over approximations
- No personal context, names, or session-specific references
- A reader expert in this domain should find nothing oversimplified`

interface Artifact {
  id: string
  created_at: string
  confidence: string
  source_domains: string[]
}

type Stage = 'input' | 'cleaned' | 'submitted'

export default function Home() {
  const [raw, setRaw] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [cleaning, setCleaning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { loadArtifacts() }, [])

  async function loadArtifacts() {
    const res = await fetch('/api/artifacts')
    const data = await res.json()
    if (!data.error) setArtifacts(data.artifacts || [])
  }

  async function handleClean() {
    setCleaning(true)
    setError('')
    try {
      const res = await fetch('/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRaw(data.cleaned)
      setStage('cleaned')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCleaning(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const parsed = JSON.parse(raw)
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.validation_failed) throw new Error(data.issues?.[0]?.detail || 'Validation failed')
      setResult(data)
      setStage('submitted')
      setRaw('')
      await loadArtifacts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(val: string) {
    setRaw(val)
    setStage('input')
    setError('')
    setResult(null)
  }

  function copyPrompt() {
    navigator.clipboard.writeText(PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const res = await fetch('/api/artifacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!data.error) await loadArtifacts()
    setDeleting(null)
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <main style={{ minHeight: '100vh', background: '#F9F8F5', color: '#1A1A1A', fontFamily: 'var(--font-geist-sans)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #E8E4DC', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A1A1A', opacity: 0.4 }} />
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.4 }}>
            Noosphere
          </span>
        </div>
        <a href="/query" style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#666', textDecoration: 'none', letterSpacing: '0.04em', opacity: 0.6 }}>
          Query the network →
        </a>
      </header>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 'calc(100vh - 53px)' }}>

        {/* Left — prompt */}
        <div style={{ borderRight: '1px solid #E8E4DC', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #F0ECE4', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>Extraction prompt</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#999', letterSpacing: '0.02em' }}>Paste at end of your Perplexity session</div>
            </div>
            <button onClick={copyPrompt} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, padding: '6px 14px', background: copied ? '#1A1A1A' : 'transparent', color: copied ? '#F9F8F5' : '#666', border: '1px solid', borderColor: copied ? '#1A1A1A' : '#D4D0C8', borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.04em' }}>
              {copied ? 'copied' : 'copy'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 32px' }}>
            <pre style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, lineHeight: 1.8, color: '#555', whiteSpace: 'pre-wrap', background: '#F2EEE6', border: '1px solid #E4E0D8', borderRadius: 8, padding: '18px 20px', margin: 0, userSelect: 'all' }}>
              {PROMPT}
            </pre>
          </div>
        </div>

        {/* Right — ingest + sessions */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Form */}
          <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #E8E4DC', display: 'flex', flexDirection: 'column', height: '56%', flexShrink: 0 }}>
            <div style={{ marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>Add to the network</div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#999' }}>Paste the JSON output from Perplexity</div>
            </div>

            <textarea
              value={raw}
              onChange={e => handleChange(e.target.value)}
              placeholder={'{\n  "domain_map": { ... }\n}'}
              style={{ flex: 1, minHeight: 0, resize: 'none', fontFamily: 'var(--font-geist-mono)', fontSize: 11, lineHeight: 1.7, color: '#333', background: '#F2EEE6', border: '1px solid #E0DCD4', borderRadius: 8, padding: '14px 16px', outline: 'none', marginBottom: 12 }}
            />

            {error && (
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#B03A2E', background: '#FDF0EE', border: '1px solid #F0CECA', borderRadius: 6, padding: '10px 14px', marginBottom: 12, lineHeight: 1.5, flexShrink: 0 }}>
                {error}
              </div>
            )}

            {stage === 'submitted' && result && (
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#27614A', background: '#EEF7F2', border: '1px solid #C2DFD0', borderRadius: 6, padding: '10px 14px', marginBottom: 12, flexShrink: 0 }}>
                {result.domains_indexed} domains · {result.facts_indexed} facts · {result.connections_indexed} connections indexed
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {/* Step 1: Clean */}
              <button
                onClick={handleClean}
                disabled={!raw.trim() || cleaning || submitting}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-geist-mono)', fontSize: 12, letterSpacing: '0.04em', background: stage === 'cleaned' ? '#EEF7F2' : 'transparent', color: stage === 'cleaned' ? '#27614A' : '#555', border: '1px solid', borderColor: stage === 'cleaned' ? '#C2DFD0' : '#D4D0C8', borderRadius: 6, cursor: !raw.trim() || cleaning || submitting ? 'not-allowed' : 'pointer', opacity: !raw.trim() ? 0.4 : 1, transition: 'all 0.15s' }}
              >
                {cleaning ? 'cleaning...' : stage === 'cleaned' ? '✓ cleaned' : 'Clean document'}
              </button>

              {/* Step 2: Submit */}
              <button
                onClick={handleSubmit}
                disabled={stage !== 'cleaned' || submitting || cleaning}
                style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-geist-mono)', fontSize: 12, letterSpacing: '0.04em', background: stage === 'cleaned' ? '#1A1A1A' : 'transparent', color: stage === 'cleaned' ? '#F9F8F5' : '#AAA', border: '1px solid', borderColor: stage === 'cleaned' ? '#1A1A1A' : '#D4D0C8', borderRadius: 6, cursor: stage !== 'cleaned' || submitting ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
              >
                {submitting ? 'adding...' : 'Add to Network'}
              </button>
            </div>
          </div>

          {/* Sessions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>In the network</span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#999' }}>{artifacts.length} {artifacts.length === 1 ? 'session' : 'sessions'}</span>
            </div>

            {artifacts.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#BBB' }}>No sessions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {artifacts.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 6, transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F0ECE4'; (e.currentTarget.querySelector('button') as HTMLElement).style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; (e.currentTarget.querySelector('button') as HTMLElement).style.opacity = '0' }}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: '#444' }}>{fmt(a.created_at)}</span>
                      {a.confidence && <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#999', border: '1px solid #DDD', borderRadius: 3, padding: '1px 5px', marginLeft: 8 }}>{a.confidence}</span>}
                      {a.source_domains?.length > 0 && <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#AAA', marginTop: 2 }}>{a.source_domains.slice(0, 3).join(' · ')}</div>}
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 0.1s', padding: '2px 6px' }}
                    >
                      {deleting === a.id ? '...' : 'remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
