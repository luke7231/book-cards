// Replicate 이미지 모델 slug 예시 (replicate.com 에서 API 탭으로 정확한 입력 확인)
// - black-forest-labs/flux-schnell
// - black-forest-labs/flux-1.1-pro
// - black-forest-labs/flux-2-pro | flux-2-max | flux-2-dev | flux-2-klein-4b 등 (slug에 flux-2 포함 시 아래 최소 입력 사용)
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!
const MODEL =
  process.env.REPLICATE_IMAGE_MODEL?.trim() || 'black-forest-labs/flux-1.1-pro'

const IS_FLUX_PRO = MODEL.includes('flux-1.1-pro')
const IS_FLUX_2 = MODEL.includes('flux-2')
const USE_LONG_WAIT = IS_FLUX_PRO || IS_FLUX_2

// 결제수단 없을 때 burst=1, 6req/min 제한 대응
const CONCURRENT = 1
const DELAY_MS = 11_000

interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  /** Schnell: URL 배열, 1.1 Pro: 단일 URL 문자열 */
  output?: string | string[]
  error?: string
  retry_after?: number
}

function buildModelInput(prompt: string): Record<string, unknown> {
  // FLUX.2 계열: Replicate 스키마가 1.1 Pro·Schnell과 다름 → 최소 필드만 (추가는 모델 페이지 참고)
  if (IS_FLUX_2) {
    return {
      prompt,
      aspect_ratio: '4:5',
      safety_tolerance: 2,
    }
  }
  const base = {
    prompt,
    aspect_ratio: '4:5',
    output_format: 'jpg',
    output_quality: 90,
  }
  if (IS_FLUX_PRO) {
    return {
      ...base,
      safety_tolerance: 2,
      prompt_upsampling: true,
    }
  }
  return { ...base, num_outputs: 1 }
}

function predictionOutputUrl(pred: ReplicatePrediction): string | null {
  const o = pred.output
  if (!o) return null
  if (typeof o === 'string') return o
  if (Array.isArray(o) && o[0]) return o[0]
  return null
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function createPredictionWithRetry(
  input: Record<string, unknown>,
  maxRetries = 5
): Promise<ReplicatePrediction> {
  // Replicate Prefer: wait 는 1~60초만 허용
  const preferWait = 'wait=60'
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: preferWait,
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

async function pollPrediction(id: string, maxAttempts = USE_LONG_WAIT ? 60 : 40): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    })
    const pred: ReplicatePrediction = await res.json()
    const url = predictionOutputUrl(pred)
    if (pred.status === 'succeeded' && url) {
      return url
    }
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(`Replicate prediction ${pred.status}: ${pred.error}`)
    }
    await sleep(2000)
  }
  throw new Error('Replicate prediction timed out')
}

export async function generateImage(prompt: string): Promise<string> {
  const input = buildModelInput(prompt)
  const pred = await createPredictionWithRetry(input)

  const url = predictionOutputUrl(pred)
  if (pred.status === 'succeeded' && url) {
    return url
  }

  return pollPrediction(pred.id)
}

// 순차 처리 + 딜레이로 429 방지
export async function generateImagesParallel(
  prompts: string[]
): Promise<Array<{ index: number; url: string | null; error: string | null }>> {
  const results: Array<{ index: number; url: string | null; error: string | null }> = []

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

    if (i + CONCURRENT < prompts.length) {
      await sleep(DELAY_MS)
    }
  }

  return results
}
