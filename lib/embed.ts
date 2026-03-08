async function voyageEmbed(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

export async function embed(text: string): Promise<number[]> {
  const results = await voyageEmbed([text])
  return results[0]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return voyageEmbed(texts)
}
