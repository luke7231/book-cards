const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!
const MODEL = 'black-forest-labs/flux-schnell'

// 결제수단 없을 때 burst=1, 6req/min 제한 대응
// 결제수단 추가 후 이 값을 높여도 됨
const CONCURRENT = 1        // 동시 요청 수
const DELAY_MS = 11_000     // 요청 간 딜레이 (ms) — 6/min = 10s 간격 + 여유

interface ReplicateInput {
  prompt: string
  aspect_ratio?: string
  output_format?: string
  output_quality?: number
  num_outputs?: number
}

interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string[]
  error?: string
  retry_after?: number
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function createPredictionWithRetry(
  input: ReplicateInput,
  maxRetries = 5
): Promise<ReplicatePrediction> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=60',
      },
      body: JSON.stringify({ input }),
    })

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const waitMs = ((body.retry_after ?? 10) + 2) * 1000
      console.log(`Replicate 429 — ${waitMs}ms 후 재시도 (attempt ${attempt + 1}/${maxRetries})`)
      await sleep(waitMs)
      continue
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Replicate API error: ${res.status} ${err}`)
    }

    return res.json()
  }
  throw new Error('Replicate 최대 재시도 초과 (429)')
}

async function pollPrediction(id: string, maxAttempts = 40): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    })
    const pred: ReplicatePrediction = await res.json()
    if (pred.status === 'succeeded' && pred.output?.[0]) {
      return pred.output[0]
    }
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(`Replicate prediction ${pred.status}: ${pred.error}`)
    }
    await sleep(2000)
  }
  throw new Error('Replicate prediction timed out')
}

export async function generateImage(prompt: string): Promise<string> {
  const pred = await createPredictionWithRetry({
    prompt,
    aspect_ratio: '4:5',
    output_format: 'jpg',
    output_quality: 90,
    num_outputs: 1,
  })

  if (pred.status === 'succeeded' && pred.output?.[0]) {
    return pred.output[0]
  }

  return pollPrediction(pred.id)
}

// 순차 처리 + 딜레이로 429 방지
export async function generateImagesParallel(
  prompts: string[]
): Promise<Array<{ index: number; url: string | null; error: string | null }>> {
  const results: Array<{ index: number; url: string | null; error: string | null }> = []

  // CONCURRENT 단위로 묶어서 순차 처리
  for (let i = 0; i < prompts.length; i += CONCURRENT) {
    const batch = prompts.slice(i, i + CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map((prompt, batchIdx) =>
        generateImage(prompt).then(url => ({ index: i + batchIdx, url, error: null }))
      )
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        const idx = i + batchResults.indexOf(r)
        results.push({ index: idx, url: null, error: String(r.reason) })
      }
    }

    // 마지막 배치가 아니면 딜레이
    if (i + CONCURRENT < prompts.length) {
      await sleep(DELAY_MS)
    }
  }

  return results
}
