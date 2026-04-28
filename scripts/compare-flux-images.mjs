#!/usr/bin/env node
/**
 * 같은 프롬프트로 flux-schnell · flux-1.1-pro · flux-2-pro 를 각 1장씩 생성해 URL 출력.
 *
 * 사용:
 *   npm run compare-flux -- "전체 프롬프트"
 *
 * Replicate 는 Prefer: wait 최대 60초만 허용 → 그 이상 걸리면 자동 폴링.
 *
 * 모델 슬럿 변경 (선택):
 *   FLUX11_MODEL=... FLUX2_MODEL=... npm run compare-flux -- "..."
 *
 * 저크레딧 시 Replicate 가 생성 요청을 ~6회/분·버스트 1으로 막음 → 작업 사이 기본 11초 공백.
 *   COMPARE_FLUX_GAP_MS=12000 npm run compare-flux -- "..."
 */

const TOKEN = process.env.REPLICATE_API_TOKEN
/** @type {number} */
const GAP_MS = Number(process.env.COMPARE_FLUX_GAP_MS) || 11_000
const MAX_429_RETRIES = 8

const SCHNELL_MODEL = 'black-forest-labs/flux-schnell'
const FLUX11_MODEL =
  process.env.FLUX11_MODEL?.trim() || 'black-forest-labs/flux-1.1-pro'
const FLUX2_MODEL =
  process.env.FLUX2_MODEL?.trim() || 'black-forest-labs/flux-2-pro'

const promptFromCli = process.argv.slice(2).join(' ').trim()
const DEFAULT_PROMPT = [
  'traditional copper plate engraving print, ink on aged paper, visible crosshatching,',
  'Mood and era fitting the literary work "Zorba the Greek", unnamed generic figures only,',
  'a lone man seen from behind in a long coat walking on a rocky path between gnarled trees toward a distant sea at dusk, dramatic sky, sepia book illustration,',
  'NOT photograph NOT digital painting NOT smooth gradient',
].join(' ')

const prompt = promptFromCli || DEFAULT_PROMPT

function outputUrl(pred) {
  const o = pred.output
  if (!o) return null
  if (typeof o === 'string') return o
  if (Array.isArray(o) && o[0]) return o[0]
  return null
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function pollPrediction(id) {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    const pred = await res.json()
    const url = outputUrl(pred)
    if (pred.status === 'succeeded' && url) return url
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(pred.error || `${pred.status}`)
    }
    await sleep(2000)
  }
  throw new Error(`폴링 타임아웃 prediction ${id}`)
}

async function postPrediction(model, input) {
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      // Replicate: 1 <= wait <= 60 (초과 시 422)
      Prefer: 'wait=60',
    },
    body: JSON.stringify({ input }),
  })
  const text = await res.text()
  return { res, text }
}

async function createAndWait(model, input) {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const { res, text } = await postPrediction(model, input)

    if (res.status === 429) {
      let retryAfter = 10
      try {
        const j = JSON.parse(text)
        retryAfter = Number(j.retry_after ?? j.detail?.retry_after) || retryAfter
      } catch {
        /* ignore */
      }
      const waitMs = (retryAfter + 2) * 1000
      console.error(
        `   (429 스로틀 — ${Math.ceil(waitMs / 1000)}초 후 재시도 ${attempt + 1}/${MAX_429_RETRIES})`
      )
      await sleep(waitMs)
      continue
    }

    if (!res.ok) {
      throw new Error(`${model} ${res.status}: ${text}`)
    }

    const pred = JSON.parse(text)
    const immediate = outputUrl(pred)
    if (immediate) return immediate
    if (pred.id && (pred.status === 'starting' || pred.status === 'processing')) {
      return pollPrediction(pred.id)
    }
    if (pred.id) {
      return pollPrediction(pred.id)
    }
    throw new Error(`${model} 응답에 output/id 없음: ${text.slice(0, 400)}`)
  }
  throw new Error(`${model} 429 재시도 한도 초과`)
}

function inputForSchnell() {
  return {
    prompt,
    aspect_ratio: '4:5',
    output_format: 'jpg',
    output_quality: 90,
    num_outputs: 1,
  }
}

function inputForFlux11Pro() {
  return {
    prompt,
    aspect_ratio: '4:5',
    output_format: 'jpg',
    output_quality: 90,
    safety_tolerance: 2,
    prompt_upsampling: true,
  }
}

function inputForFlux2() {
  return {
    prompt,
    aspect_ratio: '4:5',
    safety_tolerance: 2,
  }
}

async function main() {
  if (!TOKEN) {
    console.error('REPLICATE_API_TOKEN 이 없습니다. .env.local 과 npm run compare-flux 사용을 확인하세요.')
    process.exit(1)
  }

  console.log('프롬프트 길이:', prompt.length, '자\n')

  const jobs = [
    { label: 'schnell', model: SCHNELL_MODEL, input: inputForSchnell() },
    { label: 'flux-1.1-pro', model: FLUX11_MODEL, input: inputForFlux11Pro() },
    { label: 'flux-2-pro', model: FLUX2_MODEL, input: inputForFlux2() },
  ]

  let i = 0
  for (const { label, model, input } of jobs) {
    i++
    if (i > 1) {
      console.log(`   (레이트리밋 회피 ${GAP_MS}ms 대기)\n`)
      await sleep(GAP_MS)
    }
    console.log(`${i}/3 ${model} …`)
    const url = await createAndWait(model, input)
    console.log(`   ${label}:`, url, '\n')
  }

  console.log('세 URL을 브라우저에서 열어 비교하세요.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
