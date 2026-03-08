import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { raw } = await req.json()
    if (!raw) return NextResponse.json({ error: 'No input' }, { status: 400 })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      messages: [{
        role: 'user',
        content: `Extract the JSON object from the text below and return it as valid, minified JSON.
- Remove all citation markers, superscripts, and non-printable characters from string values
- Do not change any content — only fix formatting and encoding
- Return ONLY the raw JSON object, no explanation, no code fences

TEXT:
${raw}`,
      }],
    })

    const text = (message.content[0] as { text: string }).text.trim()
    // Parse to validate, then return pretty-printed
    const parsed = JSON.parse(text)
    return NextResponse.json({ cleaned: JSON.stringify(parsed, null, 2) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
