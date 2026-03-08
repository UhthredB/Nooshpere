'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface MatchedDomain { name: string; similarity: number }
interface Connection { from_domain: string; to_domain: string; relationship: string }
interface QueryResult {
  answer: string
  matched_domains: MatchedDomain[]
  facts_count: number
  connections: Connection[]
  session_count: number
}
interface DomainNode { id: string; domain_name: string; artifact_id: string }

const PALETTE = [
  { border: 'rgba(124,58,237,0.5)', bg: 'rgba(124,58,237,0.06)', glow: 'rgba(124,58,237,0.15)' },
  { border: 'rgba(8,145,178,0.5)',  bg: 'rgba(8,145,178,0.06)',  glow: 'rgba(8,145,178,0.15)'  },
  { border: 'rgba(5,150,105,0.5)',  bg: 'rgba(5,150,105,0.06)',  glow: 'rgba(5,150,105,0.15)'  },
  { border: 'rgba(217,119,6,0.5)',  bg: 'rgba(217,119,6,0.06)',  glow: 'rgba(217,119,6,0.15)'  },
  { border: 'rgba(225,29,72,0.5)',  bg: 'rgba(225,29,72,0.06)',  glow: 'rgba(225,29,72,0.15)'  },
  { border: 'rgba(79,70,229,0.5)',  bg: 'rgba(79,70,229,0.06)',  glow: 'rgba(79,70,229,0.15)'  },
  { border: 'rgba(13,148,136,0.5)', bg: 'rgba(13,148,136,0.06)', glow: 'rgba(13,148,136,0.15)' },
  { border: 'rgba(147,51,234,0.5)', bg: 'rgba(147,51,234,0.06)', glow: 'rgba(147,51,234,0.15)' },
]

const RESULT_CARD_COLORS = [
  'border-violet-300 bg-violet-50 hover:border-violet-400',
  'border-cyan-300 bg-cyan-50 hover:border-cyan-400',
  'border-emerald-300 bg-emerald-50 hover:border-emerald-400',
  'border-amber-300 bg-amber-50 hover:border-amber-400',
  'border-rose-300 bg-rose-50 hover:border-rose-400',
  'border-indigo-300 bg-indigo-50 hover:border-indigo-400',
]

function BubbleBackground({ domains }: { domains: DomainNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const items = domains.length > 0 ? domains : Array.from({ length: 12 }, (_, i) => ({
      id: String(i), domain_name: '', artifact_id: String(Math.floor(i / 3))
    }))

    const W = () => canvas!.width
    const H = () => canvas!.height

    const bubbles = items.map((d, i) => {
      const color = PALETTE[i % PALETTE.length]
      const r = 30 + Math.random() * 30
      return {
        x: r + Math.random() * (window.innerWidth - r * 2),
        y: r + Math.random() * (window.innerHeight - r * 2),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r, color,
        label: d.domain_name.split(':')[0].split('&')[0].trim(),
        artifactId: d.artifact_id,
        pulse: Math.random() * Math.PI * 2,
      }
    })

    function draw() {
      ctx!.clearRect(0, 0, W(), H())

      // Connection lines between same-session bubbles
      bubbles.forEach((b, i) => {
        bubbles.forEach((b2, j) => {
          if (j <= i || b.artifactId !== b2.artifactId) return
          const dist = Math.hypot(b2.x - b.x, b2.y - b.y)
          if (dist > 260) return
          ctx!.beginPath()
          ctx!.moveTo(b.x, b.y)
          ctx!.lineTo(b2.x, b2.y)
          ctx!.strokeStyle = `rgba(0,0,0,${0.025 * (1 - dist / 260)})`
          ctx!.lineWidth = 1
          ctx!.stroke()
        })
      })

      bubbles.forEach(b => {
        b.pulse += 0.015
        const r = b.r * (1 + Math.sin(b.pulse) * 0.025)

        // Glow
        const grad = ctx!.createRadialGradient(b.x, b.y, r * 0.2, b.x, b.y, r * 2)
        grad.addColorStop(0, b.color.glow)
        grad.addColorStop(1, 'transparent')
        ctx!.beginPath()
        ctx!.arc(b.x, b.y, r * 2, 0, Math.PI * 2)
        ctx!.fillStyle = grad
        ctx!.fill()

        // Fill
        ctx!.beginPath()
        ctx!.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx!.fillStyle = b.color.bg
        ctx!.fill()

        // Border
        ctx!.beginPath()
        ctx!.arc(b.x, b.y, r, 0, Math.PI * 2)
        ctx!.strokeStyle = b.color.border
        ctx!.lineWidth = 1
        ctx!.stroke()

        // Label
        if (b.label) {
          const maxChars = Math.floor(r / 4.5)
          const label = b.label.length > maxChars ? b.label.slice(0, maxChars) + '…' : b.label
          ctx!.fillStyle = 'rgba(0,0,0,0.35)'
          ctx!.font = `${Math.max(8, Math.min(10, r / 4))}px ui-monospace,monospace`
          ctx!.textAlign = 'center'
          ctx!.textBaseline = 'middle'
          ctx!.fillText(label, b.x, b.y)
        }

        b.x += b.vx; b.y += b.vy
        if (b.x < b.r || b.x > W() - b.r) b.vx *= -1
        if (b.y < b.r || b.y > H() - b.r) b.vy *= -1
      })

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [domains])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [domains, setDomains] = useState<DomainNode[]>([])
  const [expandedBubble, setExpandedBubble] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/stats').then(r => r.json()).then(d => setSessionCount(d.session_count)).catch(() => {})
    fetch('/api/domains').then(r => r.json()).then(d => setDomains(d.domains || [])).catch(() => {})
  }, [])

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setExpandedBubble(null)
    try {
      const res = await fetch(`/api/query?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-black overflow-x-hidden">
      <BubbleBackground domains={domains} />

      {/* Header */}
      <div className="relative z-10 border-b border-black/5 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-black/40" />
          <span className="text-sm font-mono text-black/40 tracking-widest uppercase">Noosphere</span>
        </div>
        <div className="flex items-center gap-4">
          {sessionCount !== null && (
            <span className="text-xs font-mono text-black/25">
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} in network
            </span>
          )}
          <a href="/" className="text-xs font-mono text-black/35 hover:text-black/70 transition-colors border border-black/12 rounded px-3 py-1 hover:border-black/25 bg-white/60">
            + add session
          </a>
        </div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6">
        {/* Hero */}
        <div className="pt-20 pb-10 text-center">
          <h1 className="text-4xl font-light tracking-tight text-black/80 mb-3">
            Query the collective
          </h1>
          <p className="text-sm text-black/30 font-mono">
            Knowledge distilled from human research sessions. No opinions. No noise.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleQuery} className="relative mb-10">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to know?"
            className="w-full bg-white/90 border border-black/12 rounded-xl px-5 py-4 text-black placeholder-black/25 text-base outline-none focus:border-black/25 focus:bg-white transition-all font-light pr-24 shadow-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 text-xs font-mono text-black/40 border border-black/12 rounded-lg bg-white hover:border-black/30 hover:text-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'thinking' : 'ask'}
          </button>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="flex gap-3 items-center">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-full bg-black/15 animate-ping"
                  style={{ width: `${8 + i * 4}px`, height: `${8 + i * 4}px`, animationDelay: `${i * 120}ms`, animationDuration: '1.2s' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-red-600/80 text-sm font-mono mb-8 border border-red-200 rounded-xl px-4 py-3 bg-red-50">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="pb-24 space-y-6">
            {/* Meta */}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <span className="text-xs font-mono text-black/30">{result.session_count} session{result.session_count !== 1 ? 's' : ''} matched</span>
              <span className="text-black/15">·</span>
              <span className="text-xs font-mono text-black/30">{result.matched_domains.length} domains</span>
              <span className="text-black/15">·</span>
              <span className="text-xs font-mono text-black/30">{result.facts_count} facts</span>
            </div>

            {/* Domain cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.matched_domains.map((domain, i) => {
                const isExpanded = expandedBubble === i
                return (
                  <div key={i}
                    onClick={() => setExpandedBubble(isExpanded ? null : i)}
                    className={`border rounded-2xl p-5 cursor-pointer transition-all duration-200 bg-white/80 backdrop-blur-sm shadow-sm ${RESULT_CARD_COLORS[i % RESULT_CARD_COLORS.length]} ${isExpanded ? 'md:col-span-2' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-medium text-black/75 leading-tight">{domain.name}</h3>
                      <span className="text-black/25 text-xs font-mono shrink-0">{(domain.similarity * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-0.5 rounded-full bg-black/5 mb-3 overflow-hidden">
                      <div className="h-full rounded-full bg-black/20" style={{ width: `${domain.similarity * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Answer */}
            <div className="border border-black/8 rounded-2xl p-6 bg-white/80 backdrop-blur-sm shadow-sm">
              <p className="text-xs font-mono text-black/30 uppercase tracking-widest mb-4">Synthesized answer</p>
              <p className="text-sm text-black/65 leading-relaxed whitespace-pre-wrap font-light">{result.answer}</p>
            </div>

            {/* Connections */}
            {result.connections.length > 0 && (
              <div>
                <p className="text-xs font-mono text-black/25 uppercase tracking-widest mb-3">Cross-domain threads</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.connections.map((c, i) => (
                    <div key={i} className="border border-black/8 rounded-xl px-4 py-3 bg-white/70 text-xs font-mono shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-black/50">{c.from_domain}</span>
                        <span className="text-black/20">→</span>
                        <span className="text-black/50">{c.to_domain}</span>
                      </div>
                      <p className="text-black/35 leading-relaxed">{c.relationship}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-8">
            <p className="text-xs font-mono text-black/20 leading-relaxed">
              Knowledge graph built from Perplexity research sessions.<br />
              Ask anything that has been explored in the network.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
